import { Test, TestingModule } from '@nestjs/testing';
import { HereRoutesClientService } from './here-routes-client.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { of, throwError } from 'rxjs';
import { encodeFlexiblePolyline } from './route-utils';

describe('HereRoutesClientService', () => {
  let service: HereRoutesClientService;
  let configMock: any;
  let httpMock: any;
  let prismaMock: any;

  beforeEach(async () => {
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'HERE_API_KEY') return 'mock-here-key';
        return null;
      }),
    };

    httpMock = {
      get: jest.fn(),
    };

    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      mapLink: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HereRoutesClientService,
        { provide: ConfigService, useValue: configMock },
        { provide: HttpService, useValue: httpMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<HereRoutesClientService>(HereRoutesClientService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe retornar null si no hay HERE_API_KEY configurada', async () => {
    configMock.get.mockReturnValue(null);

    const result = await service.calculateRouteWithSpeedLimits(
      [
        { lat: 9.0083, lng: -79.5246 },
        { lat: 9.0123, lng: -79.5286 },
      ],
      'Car',
    );
    expect(result).toBeNull();
    expect(httpMock.get).not.toHaveBeenCalled();
  });

  it('debe suspender temporalmente las llamadas después de 3 errores consecutivos', async () => {
    httpMock.get.mockReturnValue(
      throwError(() => new Error('HERE Connection Timeout')),
    );

    const coords = [
      { lat: 9.0083, lng: -79.5246 },
      { lat: 9.0123, lng: -79.5286 },
    ];

    // Primer error
    let result = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(result).toBeNull();
    expect(service['consecutiveErrors']).toBe(1);
    expect(service['isSuspended']).toBe(false);

    // Segundo error
    result = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(result).toBeNull();
    expect(service['consecutiveErrors']).toBe(2);
    expect(service['isSuspended']).toBe(false);

    // Tercer error — activa suspensión
    result = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(result).toBeNull();
    expect(service['consecutiveErrors']).toBe(3);
    expect(service['isSuspended']).toBe(true);

    // Cuarta llamada — cortocircuita de inmediato sin llamar a HttpService
    httpMock.get.mockReset();
    result = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(result).toBeNull();
    expect(httpMock.get).not.toHaveBeenCalled();

    // Resetear suspensión
    service.resetSuspension();
    expect(service['isSuspended']).toBe(false);
    expect(service['consecutiveErrors']).toBe(0);
  });

  it('debe parsear y decodificar correctamente la respuesta de HERE Map Attributes API', async () => {
    // Mock de la respuesta HTTP con el formato correcto de v8 routes y coordenadas en Panamá
    const mockPolyline = encodeFlexiblePolyline([
      [9.0083, -79.5246],
      [9.0123, -79.5286],
    ]);

    const mockResponse = {
      data: {
        routes: [
          {
            sections: [
              {
                polyline: mockPolyline,
                spans: [
                  {
                    offset: 0,
                    functionalClass: 2,
                    segmentId: '12345',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    httpMock.get.mockReturnValue(of(mockResponse));

    const result = await service.calculateRouteWithSpeedLimits(
      [
        { lat: 9.0083, lng: -79.5246 },
        { lat: 9.0123, lng: -79.5286 },
      ],
      'Car',
    );

    expect(result).not.toBeNull();
    // FC2 se mapea a 80 km/h en Panamá
    expect(result!.spans).toEqual([
      { geometryOffset: 0, speedLimit: 80, functionalClass: 2 },
    ]);
    expect(result!.geometry.length).toBe(2);
    expect(result!.geometry[0]).toEqual([-79.5246, 9.0083]);
    expect(result!.geometry[1]).toEqual([-79.5286, 9.0123]);
    expect(prismaMock.mapLink.upsert).toHaveBeenCalledTimes(1);
  });
});
