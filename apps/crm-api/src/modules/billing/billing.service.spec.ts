import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from 'src/prisma.service';
import { DocumentStorageService } from 'src/driver-documents/document-storage.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BillingService', () => {
  let service: BillingService;
  let prismaMock: {
    organization: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    systemSetting: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    vehicle: {
      findMany: jest.Mock;
    };
  };
  let storageServiceMock: {
    getExtensionFromContentType: jest.Mock;
    generateUploadUrl: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      systemSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      vehicle: {
        findMany: jest.fn(),
      },
    };

    storageServiceMock = {
      getExtensionFromContentType: jest.fn().mockReturnValue('png'),
      generateUploadUrl: jest.fn().mockResolvedValue('http://mock-upload-url'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: DocumentStorageService, useValue: storageServiceMock },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOfflineUploadUrl', () => {
    it('debe lanzar NotFoundException/HttpException si la organización no existe', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.getOfflineUploadUrl('invalid-org-id', 'image/png'),
      ).rejects.toThrow(
        new HttpException('Organización no encontrada', HttpStatus.NOT_FOUND),
      );
    });

    it('debe generar la URL de subida para comprobantes si existe la organización', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });

      const result = await service.getOfflineUploadUrl('org-uuid', 'image/png');

      expect(
        storageServiceMock.getExtensionFromContentType,
      ).toHaveBeenCalledWith('image/png');
      expect(storageServiceMock.generateUploadUrl).toHaveBeenCalled();
      expect(result.uploadUrl).toBe('http://mock-upload-url');
      expect(result.fileKey).toContain('receipts/org-uuid/proof-');
    });
  });

  describe('processOfflinePayment', () => {
    it('debe actualizar el estado a PENDING_ACTIVATION y guardar la key del recibo', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });
      prismaMock.organization.update.mockResolvedValue({ id: 'org-uuid' });

      await service.processOfflinePayment(
        'org-uuid',
        'YAPPY',
        'Ref-12345',
        'receipts/org-uuid/key.png',
      );

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-uuid' },
        data: {
          subscriptionStatus: 'PENDING_ACTIVATION',
          paymentMethod: 'YAPPY',
          paymentReceiptKey: 'receipts/org-uuid/key.png',
        },
      });
    });
  });

  describe('createPagueloFacilSession', () => {
    beforeEach(() => {
      prismaMock.systemSetting.findUnique.mockResolvedValue(null);
      prismaMock.vehicle.findMany.mockResolvedValue([
        { id: 'v1', subscriptionTier: 'ACTIVE' },
      ]);
    });

    it('debe lanzar NotFoundException/HttpException si la organización no existe', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.createPagueloFacilSession('invalid-org-id'),
      ).rejects.toThrow(
        new HttpException('Organización no encontrada', HttpStatus.NOT_FOUND),
      );
    });

    it('debe retornar la URL de la API de PágueloFácil si es exitosa con monto del vehículo de pago ($15.00)', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });
      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          data: { url: 'https://checkout.paguelofacil.com/test' },
        },
      } as any);

      const url = await service.createPagueloFacilSession('org-uuid');

      expect(url).toBe('https://checkout.paguelofacil.com/test');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const postCall = mockedAxios.post.mock.calls[0];
      const params = postCall[1] as URLSearchParams;
      expect(params.get('CMTN')).toBe('15.00');
    });

    it('debe calcular el monto dinámico con vehículos de pago y sin la cuota flat de SaaS', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });
      prismaMock.vehicle.findMany.mockResolvedValue([
        { id: 'v1', subscriptionTier: 'ACTIVE' },
        { id: 'v2', subscriptionTier: 'ACTIVE' },
        { id: 'v3', subscriptionTier: 'NONE' },
      ]);
      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          data: { url: 'https://checkout.paguelofacil.com/test' },
        },
      } as any);

      const url = await service.createPagueloFacilSession('org-uuid');

      expect(url).toBe('https://checkout.paguelofacil.com/test');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const postCall = mockedAxios.post.mock.calls[0];
      const params = postCall[1] as URLSearchParams;
      expect(params.get('CMTN')).toBe('30.00');
    });

    it('debe usar tarifas de base de datos cuando existen', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });
      prismaMock.vehicle.findMany.mockResolvedValue([
        { id: 'v1', subscriptionTier: 'ACTIVE' },
        { id: 'v2', subscriptionTier: 'ACTIVE' },
      ]);
      prismaMock.systemSetting.findUnique.mockImplementation(async (args) => {
        if (args.where.key === 'PRICING_GEOLOCATION') return { value: '20.00' };
        return null;
      });
      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          data: { url: 'https://checkout.paguelofacil.com/test' },
        },
      } as any);

      const url = await service.createPagueloFacilSession('org-uuid');

      expect(url).toBe('https://checkout.paguelofacil.com/test');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const postCall = mockedAxios.post.mock.calls[0];
      const params = postCall[1] as URLSearchParams;
      expect(params.get('CMTN')).toBe('40.00');
    });

    it('debe lanzar ServiceUnavailableException en español si la llamada API de PagueloFacil falla', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        service.createPagueloFacilSession('org-uuid'),
      ).rejects.toThrow(
        new HttpException(
          'El servicio de pago PágueloFácil no está disponible en este momento. Por favor, intente de nuevo más tarde.',
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    });

    it('debe lanzar ServiceUnavailableException en español si el API responde éxito falso o sin url', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-uuid' });
      mockedAxios.post.mockResolvedValue({
        data: { success: false, data: {} },
      } as any);

      await expect(
        service.createPagueloFacilSession('org-uuid'),
      ).rejects.toThrow(
        new HttpException(
          'El proveedor de pagos no devolvió una URL de sesión válida.',
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    });
  });

  describe('handlePagueloFacilWebhook', () => {
    it('debe activar la suscripción si el estado es approved', async () => {
      prismaMock.organization.update.mockResolvedValue({});

      await service.handlePagueloFacilWebhook({
        PARM_1: 'org-uuid',
        Estado: 'approved',
      });

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-uuid' },
        data: expect.objectContaining({
          subscriptionStatus: 'ACTIVE',
          paymentMethod: 'PAGUELOFACIL',
        }),
      });
    });
  });

  describe('pricing settings', () => {
    it('debe retornar precios por defecto si no existen en BD', async () => {
      prismaMock.systemSetting.findUnique.mockResolvedValue(null);
      const settings = await service.getPricingSettings();
      expect(settings).toEqual({
        flatSaaSPrice: 49.0,
        geolocationPrice: 15.0,
        diagnosticsPrice: 30.0,
      });
    });

    it('debe retornar precios de BD si existen', async () => {
      prismaMock.systemSetting.findUnique.mockImplementation(async (args) => {
        if (args.where.key === 'PRICING_FLAT_SAAS') return { value: '100.00' };
        if (args.where.key === 'PRICING_GEOLOCATION') return { value: '25.00' };
        if (args.where.key === 'PRICING_DIAGNOSTICS') return { value: '50.00' };
        return null;
      });

      const settings = await service.getPricingSettings();
      expect(settings).toEqual({
        flatSaaSPrice: 100.0,
        geolocationPrice: 25.0,
        diagnosticsPrice: 50.0,
      });
    });

    it('debe upsertar los precios editados en la base de datos', async () => {
      prismaMock.systemSetting.upsert.mockResolvedValue({});

      await service.updatePricingSettings(120.0, 30.0, 60.0);

      expect(prismaMock.systemSetting.upsert).toHaveBeenCalledTimes(3);
      expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'PRICING_FLAT_SAAS' },
        update: { value: '120.00' },
        create: { key: 'PRICING_FLAT_SAAS', value: '120.00' },
      });
    });
  });
});
