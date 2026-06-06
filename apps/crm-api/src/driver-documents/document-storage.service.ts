import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  readonly s3Client: S3Client;
  readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') ??
      'vantx-app-documents';

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

    this.s3Client = new S3Client(awsConfig);
  }

  /**
   * Obtiene la extensión correcta a partir del tipo de contenido
   */
  getExtensionFromContentType(contentType: string): string {
    switch (contentType.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'application/pdf':
        return 'pdf';
      default:
        throw new BadRequestException(
          'Formato de archivo no soportado. Suba una imagen JPG, PNG o un archivo PDF.',
        );
    }
  }

  /**
   * Genera una URL presignada para subir un archivo a S3
   */
  async generateUploadUrl(
    fileKey: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
    });

    try {
      // URL válida por 10 minutos (600 segundos)
      return await getSignedUrl(this.s3Client, command, { expiresIn: 600 });
    } catch (error) {
      this.logger.error('Error al generar la URL presignada de S3', error);
      throw new BadRequestException('No se pudo generar el enlace de subida.');
    }
  }

  /**
   * Genera una URL presignada GET para leer un archivo de S3
   */
  async generateReadUrl(fileKey: string, expiresIn = 900): Promise<string> {
    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });
    return getSignedUrl(this.s3Client, getCommand, { expiresIn });
  }

  /**
   * Descarga un archivo de S3 y lo retorna como Buffer
   */
  async downloadFile(fileKey: string): Promise<Buffer> {
    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    const s3Response = await this.s3Client.send(getCommand);
    if (!s3Response.Body) {
      throw new Error('S3 devolvió un cuerpo de objeto vacío.');
    }

    return this.streamToBuffer(s3Response.Body as Readable);
  }

  /**
   * Elimina un archivo de S3
   */
  async deleteObject(fileKey: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });
      await this.s3Client.send(deleteCommand);
      this.logger.log(`Objeto de S3 eliminado de forma segura: ${fileKey}`);
    } catch (delErr) {
      this.logger.error(
        `Error al eliminar el archivo de S3 (${fileKey})`,
        delErr,
      );
    }
  }

  /**
   * Método de soporte para convertir el stream de S3 en un Buffer en memoria
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
