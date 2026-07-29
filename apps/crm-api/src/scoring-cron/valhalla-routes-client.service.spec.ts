import { Test, TestingModule } from '@nestjs/testing';
import { ValhallaRoutesClientService, mapValhallaRoadClassToFC } from './valhalla-routes-client.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { of, throwError } from 'rxjs';
import { encodePolyline6 } from './route-utils';

describe('ValhallaRoutesClientService', () => {
  let service: ValhallaRoutesClientService;
  let configMock: any;
  let httpMock: any;
  let prismaMock: any;

  beforeEach(async () => {
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'VALHALLA_URL') return 'http://localhost:8005';
        return null;
      }),
    };

    httpMock = {
      post: jest.fn(),
    };

    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
      mapLink: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValhallaRoutesClientService,
        { provide: ConfigService, useValue: configMock },
        { provide: HttpService, useValue: httpMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ValhallaRoutesClientService>(ValhallaRoutesClientService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe mapear correctamente clases de ruta de Valhalla a FC y límites de Panamá', () => {
    expect(mapValhallaRoadClassToFC('motorway')).toEqual({ fc: 1, speedLimit: 110, isVerified: false });
    expect(mapValhallaRoadClassToFC('motorway', 100)).toEqual({ fc: 1, speedLimit: 100, isVerified: true });
    expect(mapValhallaRoadClassToFC('primary')).toEqual({ fc: 3, speedLimit: 60, isVerified: false });
    expect(mapValhallaRoadClassToFC('tertiary')).toEqual({ fc: 3, speedLimit: 60, isVerified: false });
    expect(mapValhallaRoadClassToFC('residential')).toEqual({ fc: 5, speedLimit: 40, isVerified: false });
    expect(mapValhallaRoadClassToFC('primary', 80)).toEqual({ fc: 3, speedLimit: 80, isVerified: true });
    expect(mapValhallaRoadClassToFC('motorway', 90)).toEqual({ fc: 1, speedLimit: 90, isVerified: true });
  });

  it('debe suspender temporalmente las llamadas después de 5 errores consecutivos', async () => {
    httpMock.post.mockReturnValue(
      throwError(() => new Error('Valhalla Connection Refused')),
    );

    const coords = [
      { lat: 9.0083, lng: -79.5246 },
      { lat: 9.0123, lng: -79.5286 },
    ];

    for (let i = 1; i <= 4; i++) {
      const res = await service.calculateRouteWithSpeedLimits(coords, 'Car');
      expect(res).toBeNull();
      expect(service['isSuspended']).toBe(false);
    }

    // Quinto error
    const res5 = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(res5).toBeNull();
    expect(service['isSuspended']).toBe(true);

    // Siguiente llamada
    httpMock.post.mockReset();
    const res6 = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(res6).toBeNull();
    expect(httpMock.post).not.toHaveBeenCalled();

    service.resetSuspension();
    expect(service['isSuspended']).toBe(false);
  });

  it('debe parsear y decodificar correctamente la respuesta de Valhalla /trace_attributes', async () => {
    // Array de coordenadas [lat, lon] en Panamá
    const latLonPts: [number, number][] = [
      [9.0083, -79.5246],
      [9.0123, -79.5286],
    ];
    const shapePolyline6 = encodePolyline6(latLonPts);

    const mockResponse = {
      data: {
        shape: shapePolyline6,
        edges: [
          {
            way_id: 998877,
            road_class: 'primary',
            speed_limit: 80,
            drive_on_right: true,
          },
        ],
      },
    };

    httpMock.post.mockReturnValue(of(mockResponse));

    const result = await service.calculateRouteWithSpeedLimits(
      [
        { lat: 9.0083, lng: -79.5246 },
        { lat: 9.0123, lng: -79.5286 },
      ],
      'Car',
    );

    expect(result).not.toBeNull();
    expect(result!.spans).toEqual([
      { geometryOffset: 0, speedLimit: 80, functionalClass: 3 },
    ]);
    expect(result!.geometry.length).toBe(2);
    // Verificar que los pares se hayan invertido a [lng, lat] para GeoJSON / Mapbox
    expect(result!.geometry[0]).toEqual([-79.5246, 9.0083]);
    expect(result!.geometry[1]).toEqual([-79.5286, 9.0123]);
    expect(prismaMock.mapLink.upsert).toHaveBeenCalledTimes(1);
  });
});
