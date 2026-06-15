import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  DriverDocumentType,
  DriverDocumentStatus,
  Prisma,
} from '@prisma/client';
import { DocumentStorageService } from './document-storage.service';
import { DocumentVerificationService } from './document-verification.service';
import { DiditVerificationService } from './didit-verification.service';
import { DriverDocumentExtractedData } from './driver-documents.types';
import {
  mapToPanamaLicenseType,
  extractLicenseTypeFromBarcodes,
} from './driver-documents.utils';

@Injectable()
export class DriverDocumentsService {
  private readonly logger = new Logger(DriverDocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: DocumentStorageService,
    private verificationService: DocumentVerificationService,
    private diditService: DiditVerificationService,
  ) {}

  /**
   * Genera una URL presignada para que el cliente suba el archivo directamente a S3
   */
  async getUploadUrl(
    userId: string,
    type: DriverDocumentType,
    contentType: string,
  ) {
    // 1. Validar que el conductor exista
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException(
        'No se encontró perfil de conductor asociado a este usuario.',
      );
    }

    const ext = this.storageService.getExtensionFromContentType(contentType);
    const fileKey = `documents/${driver.id}/${type.toLowerCase()}-${Date.now()}.${ext}`;

    // 2. Generar la URL presignada
    const uploadUrl = await this.storageService.generateUploadUrl(
      fileKey,
      contentType,
    );

    // 3. Crear o actualizar el registro en la base de datos
    await this.prisma.driverDocument.upsert({
      where: {
        driverId_type: {
          driverId: driver.id,
          type,
        },
      },
      update: {
        status: DriverDocumentStatus.PENDING_UPLOAD,
        fileKey,
        fileUrl: null,
        extractedData: Prisma.JsonNull,
      },
      create: {
        driverId: driver.id,
        type,
        status: DriverDocumentStatus.PENDING_UPLOAD,
        fileKey,
      },
    });

    this.logger.log(
      `URL de subida generada para conductor ${driver.id}, tipo: ${type}`,
    );

    return { uploadUrl, fileKey };
  }

  /**
   * Retorna todos los documentos asociados al conductor
   */
  async getDriverDocuments(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException(
        'No se encontró perfil de conductor asociado a este usuario.',
      );
    }

    const docs = await this.prisma.driverDocument.findMany({
      where: { driverId: driver.id },
    });

    // Sincronizar perezosamente cualquier documento en PENDING_VALIDATION o PENDING_MANUAL_REVIEW con Didit
    for (const doc of docs) {
      if (
        (doc.status === DriverDocumentStatus.PENDING_VALIDATION ||
          doc.status === DriverDocumentStatus.PENDING_MANUAL_REVIEW) &&
        doc.extractedData
      ) {
        const dataObj = doc.extractedData as DriverDocumentExtractedData;
        if (dataObj.diditSessionId) {
          await this.diditService.syncDiditSessionStatus(
            doc.id,
            dataObj.diditSessionId,
          );
        }
      }
    }

    // Volver a leer la base de datos para obtener los estados actualizados tras la sincronización
    const updatedDocs = await this.prisma.driverDocument.findMany({
      where: { driverId: driver.id },
    });

    // Para cualquier documento en PENDING_MANUAL_REVIEW o REJECTED que tenga fileKey,
    // proveemos una URL GET firmada temporal para previsualización si se requiere.
    return Promise.all(
      updatedDocs.map(async (doc) => {
        if (
          doc.fileKey &&
          (doc.status === DriverDocumentStatus.PENDING_MANUAL_REVIEW ||
            doc.status === DriverDocumentStatus.REJECTED)
        ) {
          try {
            const fileUrl = await this.storageService.generateReadUrl(
              doc.fileKey,
              900,
            );
            return { ...doc, fileUrl };
          } catch {
            return doc;
          }
        }
        return doc;
      }),
    );
  }

  /**
   * Inicia el proceso de verificación asíncrona del documento
   */
  async verifyDocument(userId: string, type: DriverDocumentType) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException(
        'No se encontró perfil de conductor asociado a este usuario.',
      );
    }

    const document = await this.prisma.driverDocument.findUnique({
      where: {
        driverId_type: {
          driverId: driver.id,
          type,
        },
      },
    });

    if (!document || !document.fileKey) {
      throw new NotFoundException(
        'No se encontró ningún archivo subido para este documento.',
      );
    }

    // Actualizar el estado a PENDING_VALIDATION inmediatamente
    await this.prisma.driverDocument.update({
      where: { id: document.id },
      data: { status: DriverDocumentStatus.PENDING_VALIDATION },
    });

    // Lanzar el proceso de fondo (worker) asíncronamente
    this.verificationService
      .runVerificationWorker(document.id, driver.id, document.fileKey)
      .then(() => {
        this.logger.log(`Verificación de documento ${document.id} completada.`);
      })
      .catch((err) => {
        this.logger.error(
          `Error en el worker de verificación para documento ${document.id}`,
          err,
        );
      });

    return {
      status: DriverDocumentStatus.PENDING_VALIDATION,
      message: 'El documento está siendo procesado por el sistema.',
    };
  }

  /**
   * Obtiene la lista de documentos en revisión manual para el panel de administración,
   * inyectando URLs presignadas GET de acceso seguro por 15 minutos.
   */
  async getPendingDocumentsForAdmin() {
    const pendingDocs = await this.prisma.driverDocument.findMany({
      where: { status: DriverDocumentStatus.PENDING_MANUAL_REVIEW },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nationalId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Sincronizar perezosamente cualquier documento en revisión manual pendiente con Didit
    for (const doc of pendingDocs) {
      if (doc.extractedData) {
        const dataObj = doc.extractedData as DriverDocumentExtractedData;
        if (dataObj.diditSessionId) {
          await this.diditService.syncDiditSessionStatus(
            doc.id,
            dataObj.diditSessionId,
          );
        }
      }
    }

    // Volver a leer la base de datos para obtener los documentos que sigan en PENDING_MANUAL_REVIEW
    const updatedPendingDocs = await this.prisma.driverDocument.findMany({
      where: { status: DriverDocumentStatus.PENDING_MANUAL_REVIEW },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nationalId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      updatedPendingDocs.map(async (doc) => {
        if (!doc.fileKey) return doc;

        try {
          const fileUrl = await this.storageService.generateReadUrl(
            doc.fileKey,
            900,
          );
          return { ...doc, fileUrl };
        } catch (e) {
          this.logger.error(
            `Error al firmar URL para revisión de admin (documento: ${doc.id})`,
            e,
          );
          return doc;
        }
      }),
    );
  }

  /**
   * Procesa la revisión manual de un administrador (Aprobación o Rechazo)
   */
  async reviewDocument(documentId: string, status: DriverDocumentStatus) {
    const doc = await this.prisma.driverDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Documento no encontrado.');
    }

    if (
      status !== DriverDocumentStatus.APPROVED &&
      status !== DriverDocumentStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Acción inválida. Solo se permite APPROVED o REJECTED.',
      );
    }

    // Actualizar el estado en base de datos
    const updatedDoc = await this.prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        status,
        fileUrl: null, // Limpiamos URL firmada temporal
      },
    });

    // Si es una licencia de conducir aprobada, intentar actualizar el tipo de licencia del conductor
    if (
      status === DriverDocumentStatus.APPROVED &&
      doc.type === DriverDocumentType.DRIVERS_LICENSE
    ) {
      let licenseType: string | null = null;
      if (doc.extractedData) {
        const extracted = doc.extractedData as any;
        const idVerifications = extracted.diditDecision?.id_verifications;
        if (idVerifications?.length > 0) {
          const verification = idVerifications[0];
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

      const mappedLicenseType = mapToPanamaLicenseType(licenseType);
      if (mappedLicenseType) {
        await this.prisma.driver.update({
          where: { id: doc.driverId },
          data: {
            licenseType: mappedLicenseType,
            status: 'ACTIVE',
          },
        });
        this.logger.log(
          `Tipo de licencia "${mappedLicenseType}" asignado automáticamente al conductor ${doc.driverId} tras aprobación manual y activado (original: "${licenseType}").`,
        );
      }
    }

    // Si es aprobado, procedemos a borrar el objeto original de S3
    if (status === DriverDocumentStatus.APPROVED && doc.fileKey) {
      await this.storageService.deleteObject(doc.fileKey);
      this.logger.log(
        `Objeto S3 eliminado tras aprobación manual por administrador: ${doc.fileKey}`,
      );
    }

    this.logger.log(
      `Documento ${documentId} revisado manualmente. Nuevo estado: ${status}`,
    );

    return updatedDoc;
  }

  /**
   * Crea una sesión de verificación de identidad con Didit.
   */
  async createDiditSession(userId: string, type: DriverDocumentType) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException(
        'No se encontró perfil de conductor asociado a este usuario.',
      );
    }

    return this.diditService.createDiditSession(
      driver.id,
      type,
      driver.nationalId,
    );
  }
}
