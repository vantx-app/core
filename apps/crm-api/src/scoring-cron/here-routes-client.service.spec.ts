import { Test, TestingModule } from '@nestjs/testing';
import { HereRoutesClientService } from './here-routes-client.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('HereRoutesClientService', () => {
  let service: HereRoutesClientService;
  let configMock: any;
  let httpMock: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HereRoutesClientService,
        { provide: ConfigService, useValue: configMock },
        { provide: HttpService, useValue: httpMock },
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

  it('debe parsear y decodificar correctamente la respuesta de HERE Routing', async () => {
    // Mock de la respuesta HTTP con un polyline codificado válido y spans en m/s
    const mockResponse = {
      data: {
        routes: [
          {
            sections: [
              {
                polyline:
                  'BGgn6lRjk613E3N3DnkBjN_EU7B3DUjDkN7pB8Q_EwMzFwvB3X0jBnQ8pBnVwHT0K0PzKzPvHU7pBoVge4wBkhBjSkInB0F4D4N0UoG8GsJoB8Q3Dwb3DsTjD7GjwB7GnfvW3wB7GnkBsE3NgF_OkDsE0UoL6T2R',
                spans: [
                  { offset: 0, maxSpeed: 11.1111116, functionalClass: 2 }, // ~40 km/h
                  { offset: 24, maxSpeed: 16.6666679, functionalClass: 1 }, // ~60 km/h
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
    expect(result!.spans).toEqual([
      { geometryOffset: 0, speedLimit: 40, functionalClass: 2 },
      { geometryOffset: 24, speedLimit: 60, functionalClass: 1 },
    ]);
    // El decoder oficial decodifica y el servicio convierte a [lng, lat]
    expect(result!.geometry.length).toBeGreaterThan(0);
    expect(result!.geometry[0]).toEqual(
      expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    );
  });
});
