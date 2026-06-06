import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';
import {
  DriverDocumentType,
  DriverDocumentStatus,
  Driver,
  DriverDocument,
  Prisma,
} from '@prisma/client';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import { S3ClientConfig } from '@aws-sdk/client-s3';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import { DocumentStorageService } from './document-storage.service';

@Injectable()
export class DocumentVerificationService {
  private readonly logger = new Logger(DocumentVerificationService.name);
  private textractClient: TextractClient;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private storageService: DocumentStorageService,
  ) {
    const region = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    const awsConfig: any = {
      region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
    };

    this.textractClient = new TextractClient(awsConfig);
  }

  /**
   * Worker asíncrono que realiza la extracción QR, Textract OCR y matching
   */
  async runVerificationWorker(
    documentId: string,
    driverId: string,
    fileKey: string,
  ): Promise<void> {
    this.logger.log(
      `Iniciando worker de validación para doc: ${documentId}, key: ${fileKey}`,
    );

    try {
      // 1. Obtener datos actualizados del conductor
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
      });

      if (!driver) {
        throw new Error(
          `Conductor ${driverId} no encontrado en la base de datos.`,
        );
      }

      const doc = await this.prisma.driverDocument.findUnique({
        where: { id: documentId },
      });

      if (!doc) {
        throw new Error(
          `Documento ${documentId} no encontrado en la base de datos.`,
        );
      }

      // 2. Descargar el archivo de S3
      const buffer = await this.storageService.downloadFile(fileKey);
      let extractedText = '';
      let scanMethod = 'NONE';

      const isPdf = fileKey.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        const qrResult = await this.extractQrCodes(buffer);
        if (qrResult) {
          extractedText = qrResult.extractedText;
          scanMethod = qrResult.scanMethod;
        }
      }

      // 4. Intento 2: Fallback a AWS Textract OCR
      if (!extractedText) {
        const ocrResult = await this.runTextractOcr(buffer, documentId);
        if (ocrResult) {
          extractedText = ocrResult;
          scanMethod = 'AWS_TEXTRACT_OCR';
        }
      }

      // 5. Algoritmo de Coincidencia de Datos (Matching)
      const matchResult = this.performMatching(
        extractedText,
        scanMethod,
        driver,
        doc,
      );

      this.logger.log(
        `Resultados de matching para conductor ${driver.id}: ID matches=${matchResult.nationalIdMatches}, Name matches=${matchResult.nameMatches}, Final success=${matchResult.isSuccessful}. Motivo si falló: ${matchResult.failureReason}`,
      );

      // 6. Actualización del Lifecycle del Documento
      if (matchResult.isSuccessful) {
        await this.handleSuccessfulVerification(
          documentId,
          fileKey,
          scanMethod,
          matchResult,
          extractedText,
        );
      } else {
        await this.handleFailedVerification(
          documentId,
          scanMethod,
          matchResult,
          extractedText,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error fatal en la ejecución del worker para documento ${documentId}`,
        err,
      );

      // Si falla catastróficamente la extracción, movemos a revisión manual
      await this.prisma.driverDocument.update({
        where: { id: documentId },
        data: {
          status: DriverDocumentStatus.PENDING_MANUAL_REVIEW,
          extractedData: Prisma.JsonNull,
        },
      });
    }
  }

  /**
   * Intenta extraer códigos QR de un buffer de imagen
   */
  private async extractQrCodes(
    buffer: Buffer,
  ): Promise<{ extractedText: string; scanMethod: string } | null> {
    try {
      const image = await Jimp.read(buffer);
      const qrCodesFound: string[] = [];
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const { data, width, height } = image.bitmap;
        const qrCode = jsQR(new Uint8ClampedArray(data), width, height);

        if (qrCode && qrCode.data) {
          qrCodesFound.push(qrCode.data);
          this.logger.log(
            `Código QR #${qrCodesFound.length} decodificado exitosamente.`,
          );

          // 1. Safe Boundary Calculation (Handles rotated/skewed QR codes)
          const points = [
            qrCode.location.topLeftCorner,
            qrCode.location.topRightCorner,
            qrCode.location.bottomLeftCorner,
            qrCode.location.bottomRightCorner,
          ];

          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);

          const padding = 6;
          const startX = Math.max(0, Math.floor(Math.min(...xs)) - padding);
          const startY = Math.max(0, Math.floor(Math.min(...ys)) - padding);
          const endX = Math.min(width, Math.ceil(Math.max(...xs)) + padding);
          const endY = Math.min(height, Math.ceil(Math.max(...ys)) + padding);

          const qrWidth = endX - startX;
          const qrHeight = endY - startY;

          // 2. High-Performance Direct Masking
          image.scan(startX, startY, qrWidth, qrHeight, (x, y, idx) => {
            image.bitmap.data[idx] = 255; // R
            image.bitmap.data[idx + 1] = 255; // G
            image.bitmap.data[idx + 2] = 255; // B
            image.bitmap.data[idx + 3] = 255; // A
          });

          attempts++;
        } else {
          break;
        }
      }

      if (qrCodesFound.length > 0) {
        return {
          extractedText: qrCodesFound.join(' | '),
          scanMethod: qrCodesFound.length > 1 ? 'MULTIPLE_QR_CODES' : 'QR_CODE',
        };
      }

      return null;
    } catch (qrError) {
      this.logger.warn(
        `Fallo decodificación QR: ${qrError instanceof Error ? qrError.message : String(qrError)}`,
      );
      return null;
    }
  }

  /**
   * Ejecuta AWS Textract OCR sobre un buffer de documento
   */
  private async runTextractOcr(
    buffer: Buffer,
    documentId: string,
  ): Promise<string | null> {
    this.logger.log(
      `Ejecutando fallback de OCR AWS Textract para documento ${documentId}`,
    );
    try {
      const textractCommand = new DetectDocumentTextCommand({
        Document: { Bytes: buffer },
      });
      const textractRes = await this.textractClient.send(textractCommand);
      const lines =
        textractRes.Blocks?.filter((b) => b.BlockType === 'LINE').map(
          (b) => b.Text,
        ) ?? [];
      return lines.join(' ');
    } catch (textractError) {
      this.logger.error('Error al llamar a AWS Textract', textractError);
      throw textractError;
    }
  }

  /**
   * Normaliza textos para eliminar acentos, espacios, guiones y mayúsculas
   */
  private normalizeString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos/diacríticos
      .replace(/[^a-z0-9]/g, ''); // Elimina todo lo que no sea alfanumérico
  }

  /**
   * Realiza la coincidencia de datos extraídos contra el perfil del conductor
   */
  private performMatching(
    extractedText: string,
    scanMethod: string,
    driver: Driver,
    doc: DriverDocument,
  ): {
    nationalIdMatches: boolean;
    nameMatches: boolean;
    isSuccessful: boolean;
    failureReason: string;
  } {
    const normalizedOCR = this.normalizeString(extractedText);
    const normalizedNationalId = this.normalizeString(driver.nationalId);

    const nationalIdMatches = normalizedOCR.includes(normalizedNationalId);

    // Descomponer nombres para buscar coincidencias parciales
    const firstNameParts = this.normalizeString(driver.firstName ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const lastNameParts = this.normalizeString(driver.lastName ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const allDriverNameParts = [...firstNameParts, ...lastNameParts];

    const nameMatches =
      allDriverNameParts.length === 0 ||
      allDriverNameParts.some((part) => normalizedOCR.includes(part));

    let isSuccessful = nationalIdMatches && nameMatches;
    let failureReason = '';

    if (isSuccessful && doc.type === DriverDocumentType.POLICE_RECORD) {
      const policeResult = this.validatePoliceRecord(
        normalizedOCR,
        extractedText,
        scanMethod,
      );
      isSuccessful = policeResult.isSuccessful;
      failureReason = policeResult.failureReason;
    } else if (!isSuccessful) {
      failureReason = !nationalIdMatches
        ? 'El número de identificación no coincide.'
        : 'El nombre del conductor no fue detectado en el documento.';
    }

    return { nationalIdMatches, nameMatches, isSuccessful, failureReason };
  }

  /**
   * Validaciones específicas para documentos de tipo Record Policivo
   */
  private validatePoliceRecord(
    normalizedOCR: string,
    extractedText: string,
    scanMethod: string,
  ): { isSuccessful: boolean; failureReason: string } {
    // 1. Verificar que el documento contenga palabras clave de Record Policivo
    const hasRecordKeywords =
      normalizedOCR.includes('recordpolicivo') ||
      normalizedOCR.includes('antecedentespenales') ||
      normalizedOCR.includes('dij') ||
      normalizedOCR.includes('policianacional');

    // 2. Verificar que indique "No registra" o similar
    const isClean = normalizedOCR.includes('nomantiene');

    // 3. Si se escaneó QR, verificar que el dominio sea gubernamental panameño
    let isQrValid = true;
    if (scanMethod === 'QR_CODE' || scanMethod === 'MULTIPLE_QR_CODES') {
      isQrValid =
        extractedText.toLowerCase().includes('gob.pa') ||
        extractedText.toLowerCase().includes('dij.gob.pa');
    }

    // 4. Verificar fecha de vigencia (máximo 30 días)
    let isDateFresh = false;
    let failureReason = '';

    const matchedDate = this.extractDateFromText(extractedText);

    if (matchedDate && !isNaN(matchedDate.getTime())) {
      const diffTime = Math.abs(Date.now() - matchedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        isDateFresh = true;
      } else {
        failureReason =
          'El documento está vencido (tiene más de 30 días de emitido).';
      }
    } else {
      failureReason =
        'No se pudo detectar la fecha de emisión en el documento.';
    }

    if (!hasRecordKeywords) {
      return {
        isSuccessful: false,
        failureReason: 'El archivo no parece ser un Record Policivo oficial.',
      };
    } else if (!isClean) {
      return {
        isSuccessful: false,
        failureReason:
          'No se pudo verificar la ausencia de antecedentes penales.',
      };
    } else if (!isQrValid) {
      return {
        isSuccessful: false,
        failureReason:
          'El código QR no pertenece a un portal gubernamental oficial (.gob.pa).',
      };
    } else if (!isDateFresh) {
      return { isSuccessful: false, failureReason };
    }

    return { isSuccessful: true, failureReason: '' };
  }

  /**
   * Extrae una fecha del texto escaneado usando múltiples formatos
   */
  private extractDateFromText(text: string): Date | null {
    // Regex para dd-mm-yyyy, dd/mm/yyyy o dd.mm.yyyy
    const dateRegexSlash = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/;
    // Regex para "dd de [mes] de yyyy"
    const dateRegexWord =
      /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i;

    const matchSlash = text.match(dateRegexSlash);
    const matchWord = text.match(dateRegexWord);

    if (matchSlash) {
      const day = parseInt(matchSlash[1], 10);
      const month = parseInt(matchSlash[2], 10) - 1;
      const year = parseInt(matchSlash[3], 10);
      return new Date(year, month, day);
    } else if (matchWord) {
      const day = parseInt(matchWord[1], 10);
      const monthStr = matchWord[2].toLowerCase();
      const year = parseInt(matchWord[3], 10);
      const months = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      const month = months.indexOf(monthStr);
      if (month !== -1) {
        return new Date(year, month, day);
      }
    }

    return null;
  }

  /**
   * Maneja el caso de verificación exitosa
   */
  private async handleSuccessfulVerification(
    documentId: string,
    fileKey: string,
    scanMethod: string,
    matchResult: {
      nationalIdMatches: boolean;
      nameMatches: boolean;
    },
    extractedText: string,
  ): Promise<void> {
    await this.prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        status: DriverDocumentStatus.APPROVED,
        fileUrl: null,
        extractedData: Prisma.JsonNull,
      },
    });

    // Eliminar el archivo de S3 para cumplir con regulaciones de privacidad
    await this.storageService.deleteObject(fileKey);
  }

  /**
   * Maneja el caso de verificación fallida → Revisión Manual
   */
  private async handleFailedVerification(
    documentId: string,
    scanMethod: string,
    matchResult: {
      nationalIdMatches: boolean;
      nameMatches: boolean;
      failureReason: string;
    },
    extractedText: string,
  ): Promise<void> {
    await this.prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        status: DriverDocumentStatus.PENDING_MANUAL_REVIEW,
        extractedData: Prisma.JsonNull,
      },
    });
    this.logger.log(
      `Documento ${documentId} falló validación automática. Marcado para revisión manual.`,
    );
  }
}
