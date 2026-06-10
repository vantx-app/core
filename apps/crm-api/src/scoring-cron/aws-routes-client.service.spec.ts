import { Test, TestingModule } from '@nestjs/testing';
import { AwsRoutesClientService } from './aws-routes-client.service';
import { ConfigService } from '@nestjs/config';

// Mock del módulo @aws-sdk/client-geo-routes
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-geo-routes', () => {
  return {
    GeoRoutesClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    CalculateRoutesCommand: jest.fn().mockImplementation((params) => params),
  };
});

/** Helper para construir una respuesta válida de AWS CalculateRoutes */
function buildAwsResponse(
  lineString: number[][],
  spans: {
    GeometryOffset: number;
    SpeedLimit: { MaxSpeed?: number; Unlimited?: boolean };
  }[],
) {
  return {
    Routes: [
      {
        Legs: [
          {
            Geometry: { LineString: lineString },
            VehicleLegDetails: { Spans: spans },
          },
        ],
      },
    ],
  };
}

describe('AwsRoutesClientService', () => {
  let service: AwsRoutesClientService;
  let configMock: any;

  beforeEach(async () => {
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_GEO_ROUTES_API_KEY') return 'mock-api-key';
        if (key === 'AWS_REGION') return 'us-east-1';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwsRoutesClientService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AwsRoutesClientService>(AwsRoutesClientService);
    mockSend.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('debe retornar null si no hay API key configurada', async () => {
    configMock.get.mockReturnValue(null);
    const freshService = new AwsRoutesClientService(configMock);

    const result = await freshService.calculateRouteWithSpeedLimits(
      [
        { lat: 9.991, lng: -79.991 },
        { lat: 9.998, lng: -79.998 },
      ],
      'Car',
    );
    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('debe suspender temporalmente las llamadas después de 3 errores consecutivos', async () => {
    mockSend.mockRejectedValue(new Error('API Error'));

    const coords = [
      { lat: 9.991, lng: -79.991 },
      { lat: 9.998, lng: -79.998 },
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

    // Cuarta llamada — cortocircuita sin llamar al SDK
    mockSend.mockReset();
    result = await service.calculateRouteWithSpeedLimits(coords, 'Car');
    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();

    // Resetear suspensión
    service.resetSuspension();
    expect(service['isSuspended']).toBe(false);
    expect(service['consecutiveErrors']).toBe(0);
  });

  it('debe parsear correctamente los spans con MaxSpeed de la respuesta de AWS', async () => {
    mockSend.mockResolvedValue(
      buildAwsResponse(
        [
          [-79.991, 9.991],
          [-79.995, 9.995],
          [-79.998, 9.998],
        ],
        [
          { GeometryOffset: 0, SpeedLimit: { MaxSpeed: 80, Unlimited: false } },
          { GeometryOffset: 2, SpeedLimit: { MaxSpeed: 60, Unlimited: false } },
        ],
      ),
    );

    const result = await service.calculateRouteWithSpeedLimits(
      [
        { lat: 9.991, lng: -79.991 },
        { lat: 9.998, lng: -79.998 },
      ],
      'Car',
    );

    expect(result).not.toBeNull();
    expect(result!.spans).toEqual([
      { geometryOffset: 0, speedLimit: 80 },
      { geometryOffset: 2, speedLimit: 60 },
    ]);
    expect(result!.geometry).toHaveLength(3);
  });

  it('debe retornar speedLimit null para spans Unlimited', async () => {
    mockSend.mockResolvedValue(
      buildAwsResponse(
        [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
        [{ GeometryOffset: 0, SpeedLimit: { Unlimited: true } }],
      ),
    );

    const result = await service.calculateRouteWithSpeedLimits(
      [
        { lat: 9.991, lng: -79.991 },
        { lat: 9.998, lng: -79.998 },
      ],
      'Car',
    );

    expect(result).not.toBeNull();
    expect(result!.spans[0].speedLimit).toBeNull();
  });

  it('debe enviar TravelMode Truck cuando se solicita', async () => {
    mockSend.mockResolvedValue(
      buildAwsResponse(
        [
          [-79.991, 9.991],
          [-79.998, 9.998],
        ],
        [{ GeometryOffset: 0, SpeedLimit: { MaxSpeed: 60, Unlimited: false } }],
      ),
    );

    await service.calculateRouteWithSpeedLimits(
      [
        { lat: 9.991, lng: -79.991 },
        { lat: 9.998, lng: -79.998 },
      ],
      'Truck',
    );

    expect(mockSend).toHaveBeenCalled();
    const commandArg = mockSend.mock.calls[0][0];
    expect(commandArg.TravelMode).toBe('Truck');
  });

  describe('downsampleByDistance', () => {
    it('debe preservar el primer y último punto siempre', () => {
      const coords = [
        { lat: 9.0, lng: -79.0 },
        { lat: 9.001, lng: -79.001 },
        { lat: 9.01, lng: -79.01 },
      ];
      const result = service.downsampleByDistance(coords);
      expect(result[0]).toEqual(coords[0]);
      expect(result[result.length - 1]).toEqual(coords[coords.length - 1]);
    });

    it('debe retornar los mismos puntos si hay 2 o menos', () => {
      const coords = [
        { lat: 9.0, lng: -79.0 },
        { lat: 9.01, lng: -79.01 },
      ];
      const result = service.downsampleByDistance(coords);
      expect(result).toEqual(coords);
    });

    it('debe filtrar puntos que están demasiado cerca', () => {
      const coords = [
        { lat: 9.0, lng: -79.0 },
        { lat: 9.0001, lng: -79.0001 }, // ~15m — demasiado cerca
        { lat: 9.0002, lng: -79.0002 }, // ~30m — demasiado cerca
        { lat: 9.01, lng: -79.01 }, // ~1.5km — suficiente distancia
        { lat: 9.02, lng: -79.02 }, // ~1.5km — suficiente distancia
      ];
      const result = service.downsampleByDistance(coords);
      expect(result.length).toBeLessThan(coords.length);
      expect(result[0]).toEqual(coords[0]);
      expect(result[result.length - 1]).toEqual(coords[coords.length - 1]);
    });
  });

  describe('splitIntoChunks', () => {
    it('debe retornar un solo chunk si hay 23 puntos o menos', () => {
      const coords = Array.from({ length: 10 }, (_, i) => ({
        lat: 9.0 + i * 0.01,
        lng: -79.0 + i * 0.01,
      }));
      const chunks = service.splitIntoChunks(coords);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual(coords);
    });

    it('cada chunk debe tener como máximo 23 puntos', () => {
      const coords = Array.from({ length: 100 }, (_, i) => ({
        lat: 9.0 + i * 0.01,
        lng: -79.0 + i * 0.01,
      }));
      const chunks = service.splitIntoChunks(coords);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(23);
      }
    });

    it('debe dividir en chunks solapados con continuidad de puntos', () => {
      const coords = Array.from({ length: 50 }, (_, i) => ({
        lat: 9.0 + i * 0.01,
        lng: -79.0 + i * 0.01,
      }));
      const chunks = service.splitIntoChunks(coords);

      expect(chunks.length).toBeGreaterThan(1);

      // El último punto de cada chunk debe ser el primero del siguiente
      for (let i = 0; i < chunks.length - 1; i++) {
        const lastOfCurrent = chunks[i][chunks[i].length - 1];
        const firstOfNext = chunks[i + 1][0];
        expect(lastOfCurrent).toEqual(firstOfNext);
      }

      // Todos los puntos originales deben estar cubiertos
      const allPoints = new Set<string>();
      for (const chunk of chunks) {
        for (const point of chunk) {
          allPoints.add(`${point.lat},${point.lng}`);
        }
      }
      expect(allPoints.size).toBe(coords.length);
    });
  });
});
