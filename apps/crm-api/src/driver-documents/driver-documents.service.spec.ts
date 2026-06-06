import { Test, TestingModule } from '@nestjs/testing';
import { DriverDocumentsService } from './driver-documents.service';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DriverDocumentType, DriverDocumentStatus } from '@prisma/client';
import { DocumentStorageService } from './document-storage.service';
import { DocumentVerificationService } from './document-verification.service';
import { DiditVerificationService } from './didit-verification.service';

// Mock de AWS SDK y S3 presigner
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        Body: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('mock data'));
            }
            if (event === 'end') {
              callback();
            }
          }),
        },
      }),
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: jest.fn().mockResolvedValue('http://mock-presigned-url'),
  };
});

jest.mock('@aws-sdk/client-textract', () => {
  return {
    TextractClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        Blocks: [
          { BlockType: 'LINE', Text: 'ID: 8-123-456 Nombre: Juan Perez' },
        ],
      }),
    })),
    DetectDocumentTextCommand: jest.fn(),
  };
});

describe('DriverDocumentsService', () => {
  let service: DriverDocumentsService;
  let prismaMock: {
    driver: {
      findUnique: jest.Mock;
    };
    driverDocument: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };
  let configMock: {
    get: jest.Mock;
  };
  let httpServiceMock: {
    post: jest.Mock;
    get: jest.Mock;
  };
  let storageServiceMock: {
    getExtensionFromContentType: jest.Mock;
    generateUploadUrl: jest.Mock;
    generateReadUrl: jest.Mock;
    deleteObject: jest.Mock;
  };
  let verificationServiceMock: {
    runVerificationWorker: jest.Mock;
  };
  let diditServiceMock: {
    createDiditSession: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      driver: {
        findUnique: jest.fn(),
      },
      driverDocument: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_S3_BUCKET_NAME') return 'test-bucket';
        return null;
      }),
    };

    httpServiceMock = {
      post: jest.fn(),
      get: jest.fn(),
    };

    storageServiceMock = {
      getExtensionFromContentType: jest.fn((contentType: string) => {
        if (
          contentType === 'image/png' ||
          contentType === 'image/jpeg' ||
          contentType === 'application/pdf'
        ) {
          return contentType.split('/')[1] === 'jpeg'
            ? 'jpg'
            : contentType.split('/')[1];
        }
        throw new BadRequestException(
          'Formato de archivo no soportado. Suba una imagen JPG, PNG o un archivo PDF.',
        );
      }),
      generateUploadUrl: jest
        .fn()
        .mockResolvedValue('http://mock-presigned-url'),
      generateReadUrl: jest.fn().mockResolvedValue('http://mock-presigned-url'),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };

    verificationServiceMock = {
      runVerificationWorker: jest.fn().mockResolvedValue(undefined),
    };

    diditServiceMock = {
      createDiditSession: jest.fn().mockResolvedValue({
        url: 'http://didit-session-url',
        sessionId: 'session-id',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverDocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: HttpService, useValue: httpServiceMock },
        { provide: DocumentStorageService, useValue: storageServiceMock },
        {
          provide: DocumentVerificationService,
          useValue: verificationServiceMock,
        },
        { provide: DiditVerificationService, useValue: diditServiceMock },
      ],
    }).compile();

    service = module.get<DriverDocumentsService>(DriverDocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUploadUrl', () => {
    it('debe lanzar NotFoundException si el conductor no existe', async () => {
      prismaMock.driver.findUnique.mockResolvedValue(null);

      await expect(
        service.getUploadUrl(
          'user-uuid',
          DriverDocumentType.NATIONAL_ID,
          'image/png',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'No se encontró perfil de conductor asociado a este usuario.',
        ),
      );
    });

    it('debe lanzar BadRequestException si el contentType no es soportado', async () => {
      prismaMock.driver.findUnique.mockResolvedValue({ id: 'driver-uuid' });

      await expect(
        service.getUploadUrl(
          'user-uuid',
          DriverDocumentType.NATIONAL_ID,
          'image/gif',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Formato de archivo no soportado. Suba una imagen JPG, PNG o un archivo PDF.',
        ),
      );
    });

    it('debe retornar la URL presignada y la key, y upsertar el documento en BD', async () => {
      prismaMock.driver.findUnique.mockResolvedValue({ id: 'driver-uuid' });
      prismaMock.driverDocument.upsert.mockResolvedValue({});

      const result = await service.getUploadUrl(
        'user-uuid',
        DriverDocumentType.NATIONAL_ID,
        'image/png',
      );

      expect(prismaMock.driverDocument.upsert).toHaveBeenCalled();
      expect(result.uploadUrl).toBe('http://mock-presigned-url');
      expect(result.fileKey).toContain('documents/driver-uuid/national_id');
    });
  });

  describe('getDriverDocuments', () => {
    it('debe retornar la lista de documentos del conductor', async () => {
      prismaMock.driver.findUnique.mockResolvedValue({ id: 'driver-uuid' });
      const mockDocs = [
        {
          id: 'doc-1',
          driverId: 'driver-uuid',
          type: DriverDocumentType.NATIONAL_ID,
          status: DriverDocumentStatus.APPROVED,
        },
      ];
      prismaMock.driverDocument.findMany.mockResolvedValue(mockDocs);

      const result = await service.getDriverDocuments('user-uuid');
      expect(result).toEqual(mockDocs);
    });
  });

  describe('verifyDocument', () => {
    it('debe lanzar NotFoundException si no hay registro del documento', async () => {
      prismaMock.driver.findUnique.mockResolvedValue({ id: 'driver-uuid' });
      prismaMock.driverDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyDocument('user-uuid', DriverDocumentType.NATIONAL_ID),
      ).rejects.toThrow(
        new NotFoundException(
          'No se encontró ningún archivo subido para este documento.',
        ),
      );
    });

    it('debe actualizar el estado a PENDING_VALIDATION y retornar confirmación', async () => {
      prismaMock.driver.findUnique.mockResolvedValue({ id: 'driver-uuid' });
      prismaMock.driverDocument.findUnique.mockResolvedValue({
        id: 'doc-uuid',
        fileKey: 'key/path',
      });
      prismaMock.driverDocument.update.mockResolvedValue({});

      const result = await service.verifyDocument(
        'user-uuid',
        DriverDocumentType.NATIONAL_ID,
      );

      expect(prismaMock.driverDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-uuid' },
        data: { status: DriverDocumentStatus.PENDING_VALIDATION },
      });
      expect(result.status).toBe(DriverDocumentStatus.PENDING_VALIDATION);
    });
  });

  describe('reviewDocument', () => {
    it('debe lanzar NotFoundException si el documento no existe', async () => {
      prismaMock.driverDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewDocument('doc-uuid', DriverDocumentStatus.APPROVED),
      ).rejects.toThrow(new NotFoundException('Documento no encontrado.'));
    });

    it('debe lanzar BadRequestException si el estado de revisión es inválido', async () => {
      prismaMock.driverDocument.findUnique.mockResolvedValue({
        id: 'doc-uuid',
      });

      await expect(
        service.reviewDocument(
          'doc-uuid',
          DriverDocumentStatus.PENDING_VALIDATION,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Acción inválida. Solo se permite APPROVED o REJECTED.',
        ),
      );
    });

    it('debe actualizar el estado del documento y retornar el registro actualizado', async () => {
      prismaMock.driverDocument.findUnique.mockResolvedValue({
        id: 'doc-uuid',
        fileKey: 'key/path',
      });
      prismaMock.driverDocument.update.mockResolvedValue({
        id: 'doc-uuid',
        status: DriverDocumentStatus.APPROVED,
      });

      const result = await service.reviewDocument(
        'doc-uuid',
        DriverDocumentStatus.APPROVED,
      );

      expect(prismaMock.driverDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-uuid' },
        data: { status: DriverDocumentStatus.APPROVED, fileUrl: null },
      });
      expect(result.status).toBe(DriverDocumentStatus.APPROVED);
    });
  });
});
