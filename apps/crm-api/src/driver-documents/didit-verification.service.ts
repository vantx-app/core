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
import { Cron } from '@nestjs/schedule';
import {
  DriverDocumentExtractedData,
  DiditSessionResponse,
  DiditDecisionResponse,
} from './driver-documents.types';
import {
  mapToPanamaLicenseType,
  extractLicenseTypeFromBarcodes,
} from './driver-documents.utils';

@Injectable()
export class DiditVerificationService {
  private readonly logger = new Logger(DiditVerificationService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Crea una sesión de verificación de identidad con Didit.
   */
  async createDiditSession(
    driverId: string,
    type: DriverDocumentType,
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

    // Tras completar la verificación en Didit, el conductor regresa al marketplace
    // en la pestaña de documentos para ver el resultado actualizado.
    const marketplaceUrl =
      this.configService.get<string>('MARKETPLACE_URL') ??
      'http://localhost:3002';

    const callbackUrl = `${marketplaceUrl}?tab=documents`;

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
              // first_name / last_name intentionally omitted: Panama documents
              // split surnames across two lines (paternal + maternal) which
              // can't map to a single lastName field — triggers Didit warnings.
              // The cédula (personal_number) is the unique identifier and is
              // sufficient for identity verification.
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
      let expirationDate: string | null = null;
      let licenseType: string | null = null;

      if (
        dbStatus === DriverDocumentStatus.APPROVED &&
        decision.id_verifications &&
        decision.id_verifications.length > 0
      ) {
        const verification = decision.id_verifications[0];
        if (verification) {
          expirationDate = verification.expiration_date || null;
          if (doc.type === DriverDocumentType.DRIVERS_LICENSE) {
            // Priority 1: QR barcode raw_text on the back of the license
            licenseType =
              extractLicenseTypeFromBarcodes(verification) ??
              // Priority 2: extra_fields.dl_categories from Didit OCR
              verification.extra_fields?.dl_categories ??
              // Priority 3: generic document_type field
              verification.document_type ??
              null;
          }
        }
      }

      const updatedExtractedData: DriverDocumentExtractedData = {
        ...extractedDataObj,
        diditDecision: decision,
        expirationDate: expirationDate || undefined,
      };

      const mappedLicenseType = mapToPanamaLicenseType(licenseType);

      // Si es licencia de conducir y está aprobada por Didit, pero no se pudo mapear la categoría de Panamá,
      // enviamos a PENDING_MANUAL_REVIEW en lugar de aprobar automáticamente.
      let finalDocStatus = dbStatus;
      if (
        dbStatus === DriverDocumentStatus.APPROVED &&
        doc.type === DriverDocumentType.DRIVERS_LICENSE &&
        !mappedLicenseType
      ) {
        finalDocStatus = DriverDocumentStatus.PENDING_MANUAL_REVIEW;
        updatedExtractedData.verificationFailureReason =
          'No se pudo extraer automáticamente el tipo de licencia de Panamá. Requiere revisión manual.';
      }

      await this.prisma.driverDocument.update({
        where: { id: documentId },
        data: {
          status: finalDocStatus,
          extractedData:
            updatedExtractedData as unknown as Prisma.InputJsonValue,
        },
      });

      if (
        finalDocStatus === DriverDocumentStatus.APPROVED &&
        doc.type === DriverDocumentType.DRIVERS_LICENSE &&
        mappedLicenseType
      ) {
        await this.prisma.driver.update({
          where: { id: doc.driverId },
          data: {
            licenseType: mappedLicenseType,
            status: 'ACTIVE',
          },
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
   * Safety-net cron: sincroniza sesiones Didit que quedaron huérfanas (el conductor
   * no volvió a abrir la app y el lazy-sync nunca se disparó).
   *
   * Criterios de selección:
   *   - Estado PENDING_VALIDATION o PENDING_MANUAL_REVIEW
   *   - updatedAt > 2 horas atrás  → el lazy-sync ya cubrió los recientes
   *   - createdAt < 7 días atrás   → las sesiones Didit expiran, no tiene sentido consultar más
   *
   * Se ejecuta una vez al día a las 04:00 para mantener el costo de API mínimo.
   */
  @Cron('0 4 * * *', { name: 'didit-daily-safety-net' })
  async syncAllPendingDiditSessions(): Promise<void> {
    this.logger.log(
      'Iniciando cron diario de sincronización de documentos con Didit...',
    );

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const stuckDocs = await this.prisma.driverDocument.findMany({
        where: {
          status: {
            in: [
              DriverDocumentStatus.PENDING_VALIDATION,
              DriverDocumentStatus.PENDING_MANUAL_REVIEW,
            ],
          },
          updatedAt: { lt: twoHoursAgo },
          createdAt: { gt: sevenDaysAgo },
        },
      });

      this.logger.log(
        `Cron Didit: ${stuckDocs.length} sesión(es) huérfana(s) encontrada(s).`,
      );

      for (const doc of stuckDocs) {
        if (doc.extractedData) {
          const dataObj = doc.extractedData as DriverDocumentExtractedData;
          if (dataObj.diditSessionId) {
            await this.syncDiditSessionStatus(doc.id, dataObj.diditSessionId);
          }
        }
      }

      this.logger.log('Cron diario de sincronización con Didit finalizado.');
    } catch (err) {
      this.logger.error('Error en cron de sincronización con Didit', err);
    }
  }
}
