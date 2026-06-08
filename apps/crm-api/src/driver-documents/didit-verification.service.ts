import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma.service';
import {
  DriverDocumentType,
  DriverDocumentStatus,
  Prisma,
} from '@prisma/client';
// import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DriverDocumentExtractedData,
  DiditSessionResponse,
  DiditDecisionResponse,
} from './driver-documents.types';
import { mapToPanamaLicenseType } from './driver-documents.utils';

@Injectable()
export class DiditVerificationService {
  private readonly logger = new Logger(DiditVerificationService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) { }

  /**
   * Crea una sesión de verificación de identidad con Didit.
   */
  async createDiditSession(
    driverId: string,
    type: DriverDocumentType,
    driverFirstName: string | null,
    driverLastName: string | null,
    driverNationalId: string,
  ): Promise<{ url: string; sessionId: string }> {
    const apiKey = this.configService.get<string>('DIDIT_API_KEY');

    // Support separate workflows for each document type, falling back to the default workflow
    let workflowId = this.configService.get<string>('DIDIT_WORKFLOW_ID');
    const nationalIdWorkflow = this.configService.get<string>(
      'DIDIT_WORKFLOW_ID_NATIONAL_ID',
    );
    const dlWorkflow = this.configService.get<string>(
      'DIDIT_WORKFLOW_ID_DRIVERS_LICENSE',
    );

    if (type === DriverDocumentType.NATIONAL_ID && nationalIdWorkflow) {
      workflowId = nationalIdWorkflow;
    } else if (type === DriverDocumentType.DRIVERS_LICENSE && dlWorkflow) {
      workflowId = dlWorkflow;
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    const callbackUrl = `${frontendUrl}/account`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<DiditSessionResponse>(
          'https://verification.didit.me/v3/session/',
          {
            workflow_id: workflowId,
            vendor_data: `${driverId}:${type}`,
            callback: callbackUrl,
            expected_details: {
              expected_document_types: [
                type === DriverDocumentType.NATIONAL_ID ? 'ID' : 'DL',
              ],
              first_name: driverFirstName || undefined,
              last_name: driverLastName || undefined,
              personal_number: driverNationalId || undefined,
            },
          },
          {
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const sessionData = response.data;
      const sessionId = sessionData.session_id;
      const url = sessionData.url;

      await this.prisma.driverDocument.upsert({
        where: {
          driverId_type: {
            driverId,
            type,
          },
        },
        update: {
          status: DriverDocumentStatus.PENDING_VALIDATION,
          fileKey: null,
          fileUrl: null,
          extractedData: {
            diditSessionId: sessionId,
            diditUrl: url,
          },
        },
        create: {
          driverId,
          type,
          status: DriverDocumentStatus.PENDING_VALIDATION,
          extractedData: {
            diditSessionId: sessionId,
            diditUrl: url,
          },
        },
      });

      return { url, sessionId };
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status: number; data: unknown };
      };
      if (axiosError.response) {
        this.logger.error(
          `Error al crear sesión en Didit: ${axiosError.response.status} ${JSON.stringify(axiosError.response.data)}`,
        );
      } else {
        this.logger.error('Error al generar la sesión de Didit', error);
      }
      throw new BadRequestException(
        'No se pudo crear la sesión de verificación.',
      );
    }
  }

  /**
   * Sincroniza el estado del documento con el veredicto de Didit.
   */
  async syncDiditSessionStatus(
    documentId: string,
    sessionId: string,
  ): Promise<void> {
    const doc = await this.prisma.driverDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) return;

    const extractedDataObj =
      (doc.extractedData as DriverDocumentExtractedData | null) ?? {};

    const apiKey = this.configService.get<string>('DIDIT_API_KEY');
    if (!apiKey || apiKey === 'mock_didit_api_key_value') {
      this.logger.warn('Didit API key no configurada para sincronización.');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<DiditDecisionResponse>(
          `https://verification.didit.me/v3/session/${sessionId}/decision/`,
          {
            headers: {
              'x-api-key': apiKey,
            },
          },
        ),
      );

      const decision = response.data;
      const diditStatus = decision.status;

      let dbStatus: DriverDocumentStatus;
      switch (diditStatus) {
        case 'Approved':
          dbStatus = DriverDocumentStatus.APPROVED;
          break;
        case 'Declined':
        case 'Abandoned':
          dbStatus = DriverDocumentStatus.REJECTED;
          break;
        case 'In Review':
          dbStatus = DriverDocumentStatus.PENDING_MANUAL_REVIEW;
          break;
        case 'In Progress':
        default:
          dbStatus = DriverDocumentStatus.PENDING_VALIDATION;
          break;
      }

      // Extraer fecha de vencimiento y tipo de licencia si está aprobado
      // let expirationDate: string | null = null;
      let licenseType: string | null = null;

      if (
        dbStatus === DriverDocumentStatus.APPROVED &&
        decision.id_verifications &&
        decision.id_verifications.length > 0
      ) {
        const verification = decision.id_verifications[0];
        if (verification) {
          // expirationDate = verification.expiration_date || null;
          if (doc.type === DriverDocumentType.DRIVERS_LICENSE) {
            licenseType =
              verification.extra_fields?.dl_categories ||
              verification.document_type ||
              null;
          }
        }
      }

      const updatedExtractedData: DriverDocumentExtractedData = {
        ...extractedDataObj,
        // No guardamos la decisión ni los datos extraídos de Didit en la base de datos por ahora
      };

      await this.prisma.driverDocument.update({
        where: { id: documentId },
        data: {
          status: dbStatus,
          extractedData:
            updatedExtractedData as unknown as Prisma.InputJsonValue,
        },
      });

      const mappedLicenseType = mapToPanamaLicenseType(licenseType);

      if (
        dbStatus === DriverDocumentStatus.APPROVED &&
        doc.type === DriverDocumentType.DRIVERS_LICENSE &&
        mappedLicenseType
      ) {
        await this.prisma.driver.update({
          where: { id: doc.driverId },
          data: { licenseType: mappedLicenseType },
        });
      }

      this.logger.log(
        `Documento ${documentId} sincronizado con Didit. Nuevo estado: ${dbStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al sincronizar sesión de Didit ${sessionId}`,
        error,
      );
    }
  }

  /**
   * Cron de respaldo para sincronizar todas las sesiones pendientes o en revisión manual de Didit.
   */
  // @Cron(CronExpression.EVERY_HOUR)
  // async syncAllPendingDiditSessions(): Promise<void> {
  //   this.logger.log(
  //     'Iniciando cron de sincronización de documentos con Didit...',
  //   );
  //   try {
  //     const pendingDocs = await this.prisma.driverDocument.findMany({
  //       where: {
  //         status: {
  //           in: [
  //             DriverDocumentStatus.PENDING_VALIDATION,
  //             DriverDocumentStatus.PENDING_MANUAL_REVIEW,
  //           ],
  //         },
  //       },
  //     });

  //     for (const doc of pendingDocs) {
  //       if (doc.extractedData) {
  //         const dataObj = doc.extractedData as DriverDocumentExtractedData;
  //         if (dataObj.diditSessionId) {
  //           await this.syncDiditSessionStatus(doc.id, dataObj.diditSessionId);
  //         }
  //       }
  //     }
  //     this.logger.log(
  //       'Sincronización cron de documentos con Didit finalizada.',
  //     );
  //   } catch (err) {
  //     this.logger.error('Error en cron de sincronización con Didit', err);
  //   }
  // }
}
