import { Test, TestingModule } from '@nestjs/testing';
import { HereClientService } from './here-client.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('HereClientService', () => {
  let service: HereClientService;
  let configMock: any;
  let httpMock: any;

  beforeEach(async () => {
    configMock = {
      get: jest.fn().mockReturnValue('mock-api-key'),
    };
    httpMock = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HereClientService,
        { provide: ConfigService, useValue: configMock },
        { provide: HttpService, useValue: httpMock },
      ],
    }).compile();

    service = module.get<HereClientService>(HereClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('debe retornar null si no hay API key configurada', async () => {
    configMock.get.mockReturnValue(null);
    const result = await service.matchRoute('LATITUDE,LONGITUDE\n1,1\n2,2');
    expect(result).toBeNull();
    expect(httpMock.post).not.toHaveBeenCalled();
  });

  it('debe suspender temporalmente las llamadas después de 3 errores consecutivos', async () => {
    httpMock.post.mockReturnValue(throwError(() => new Error('API Error')));

    // Primer error
    let result = await service.matchRoute('LATITUDE,LONGITUDE\n1,1\n2,2');
    expect(result).toBeNull();
    expect(service['consecutiveErrors']).toBe(1);
    expect(service['isSuspended']).toBe(false);

    // Segundo error
    result = await service.matchRoute('LATITUDE,LONGITUDE\n1,1\n2,2');
    expect(result).toBeNull();
    expect(service['consecutiveErrors']).toBe(2);
    expect(service['isSuspended']).toBe(false);

    // Tercer error (activa la suspensión)
    result = await service.matchRoute('LATITUDE,LONGITUDE\n1,1\n2,2');
    expect(result).toBeNull();
    expect(service['consecutiveErrors']).toBe(3);
    expect(service['isSuspended']).toBe(true);

    // Cuarta llamada (debe cortocircuitar de inmediato sin llamar a HTTP)
    jest.clearAllMocks();
    result = await service.matchRoute('LATITUDE,LONGITUDE\n1,1\n2,2');
    expect(result).toBeNull();
    expect(httpMock.post).not.toHaveBeenCalled();

    // Resetear suspensión
    service.resetSuspension();
    expect(service['isSuspended']).toBe(false);
    expect(service['consecutiveErrors']).toBe(0);
  });

  it('debe retornar los datos si la API responde correctamente', async () => {
    httpMock.post.mockReturnValue(
      of({
        data: {
          tracePoints: [{ linkIdMatched: 1 }],
          RouteLinks: [{ linkId: 1 }],
        },
      }),
    );

    const result = await service.matchRoute('LATITUDE,LONGITUDE\n1,1\n2,2');
    expect(result).toEqual({
      tracePoints: [{ linkIdMatched: 1 }],
      RouteLinks: [{ linkId: 1 }],
    });
    expect(service['consecutiveErrors']).toBe(0);
  });
});
