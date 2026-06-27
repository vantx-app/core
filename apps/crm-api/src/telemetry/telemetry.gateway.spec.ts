import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryGateway } from './telemetry.gateway';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { ROLES } from 'src/common/enums/roles.enum';

describe('TelemetryGateway', () => {
  let gateway: TelemetryGateway;
  let jwtServiceMock: { verifyAsync: jest.Mock };
  let prismaServiceMock: {
    trackingLink: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    assignment: {
      findFirst: jest.Mock;
    };
    vehicle: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    jwtServiceMock = {
      verifyAsync: jest.fn(),
    };

    prismaServiceMock = {
      trackingLink: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      assignment: {
        findFirst: jest.fn(),
      },
      vehicle: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryGateway,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    gateway = module.get<TelemetryGateway>(TelemetryGateway);
  });

  it('debe estar definido', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit - Middleware de Autenticación', () => {
    let middleware: any;
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        use: jest.fn().mockImplementation((fn) => {
          middleware = fn;
        }),
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      gateway.server = mockServer;
      gateway.afterInit(mockServer);
    });

    it('debe registrar el middleware en el servidor', () => {
      expect(mockServer.use).toHaveBeenCalled();
      expect(middleware).toBeDefined();
    });

    it('debe rechazar conexión sin token ni trackingLinkId', () => {
      const mockSocket = { handshake: { auth: {} } };
      const nextSpy = jest.fn();

      middleware(mockSocket, nextSpy);

      expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(nextSpy.mock.calls[0][0].message).toContain(
        'Unauthorized: No token or trackingLinkId provided',
      );
    });

    describe('Autenticación mediante JWT Token', () => {
      it('debe conectar exitosamente si el JWT es válido', async () => {
        const mockPayload = {
          sub: 'user-uuid',
          role: ROLES.OWNER,
          orgId: 'org-uuid',
        };
        jwtServiceMock.verifyAsync.mockResolvedValue(mockPayload);

        const mockSocket = {
          handshake: { auth: { token: 'jwt-valido' } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        await middleware(mockSocket, nextSpy);

        expect(jwtServiceMock.verifyAsync).toHaveBeenCalledWith('jwt-valido', {
          secret: process.env.JWT_SECRET,
        });
        expect(mockSocket.data.user).toEqual(mockPayload);
        expect(nextSpy).toHaveBeenCalledWith();
      });

      it('debe rechazar conexión si el JWT expira o es inválido', async () => {
        jwtServiceMock.verifyAsync.mockRejectedValue(
          new Error('token expired'),
        );

        const mockSocket = {
          handshake: { auth: { token: 'jwt-invalido' } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        await middleware(mockSocket, nextSpy);

        expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(nextSpy.mock.calls[0][0].message).toContain(
          'Unauthorized: jwt expired',
        );
      });
    });

    describe('Autenticación mediante trackingLinkId', () => {
      const validLinkId = '00000000-0000-4000-a000-000000000000';

      it('debe rechazar si el trackingLinkId no tiene formato UUID', () => {
        const mockSocket = {
          handshake: { auth: { trackingLinkId: 'no-uuid' } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        middleware(mockSocket, nextSpy);

        expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(nextSpy.mock.calls[0][0].message).toContain(
          'Unauthorized: Invalid tracking link ID format',
        );
      });

      it('debe conectar exitosamente si el trackingLinkId es válido y activo', async () => {
        const mockLink = {
          id: validLinkId,
          vehicleId: 'vehicle-uuid',
          isActive: true,
          expiresAt: new Date(Date.now() + 60000), // expira en el futuro
        };
        prismaServiceMock.trackingLink.findUnique.mockResolvedValue(mockLink);

        const mockSocket = {
          handshake: { auth: { trackingLinkId: validLinkId } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        await middleware(mockSocket, nextSpy);

        expect(prismaServiceMock.trackingLink.findUnique).toHaveBeenCalledWith({
          where: { id: validLinkId },
        });
        expect(mockSocket.data.trackingLinkId).toBe(validLinkId);
        expect(mockSocket.data.vehicleId).toBe('vehicle-uuid');
        expect(nextSpy).toHaveBeenCalledWith();
      });

      it('debe rechazar si el trackingLinkId no existe', async () => {
        prismaServiceMock.trackingLink.findUnique.mockResolvedValue(null);

        const mockSocket = {
          handshake: { auth: { trackingLinkId: validLinkId } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        await middleware(mockSocket, nextSpy);

        expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(nextSpy.mock.calls[0][0].message).toContain(
          'Unauthorized: Invalid or expired tracking link',
        );
      });

      it('debe rechazar si el trackingLinkId está inactivo', async () => {
        const mockLink = {
          id: validLinkId,
          vehicleId: 'vehicle-uuid',
          isActive: false,
          expiresAt: new Date(Date.now() + 60000),
        };
        prismaServiceMock.trackingLink.findUnique.mockResolvedValue(mockLink);

        const mockSocket = {
          handshake: { auth: { trackingLinkId: validLinkId } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        await middleware(mockSocket, nextSpy);

        expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(nextSpy.mock.calls[0][0].message).toContain(
          'Unauthorized: Invalid or expired tracking link',
        );
      });

      it('debe rechazar si el trackingLinkId ha expirado', async () => {
        const mockLink = {
          id: validLinkId,
          vehicleId: 'vehicle-uuid',
          isActive: true,
          expiresAt: new Date(Date.now() - 60000), // expirado
        };
        prismaServiceMock.trackingLink.findUnique.mockResolvedValue(mockLink);

        const mockSocket = {
          handshake: { auth: { trackingLinkId: validLinkId } },
          data: {} as any,
        };
        const nextSpy = jest.fn();

        await middleware(mockSocket, nextSpy);

        expect(nextSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(nextSpy.mock.calls[0][0].message).toContain(
          'Unauthorized: Invalid or expired tracking link',
        );
      });
    });
  });

  describe('handleConnection', () => {
    it('debe unir al cliente anónimo a su sala de rastreo respectiva', () => {
      const mockClient = {
        data: { trackingLinkId: 'link-uuid' },
        join: jest.fn(),
      };

      gateway.handleConnection(mockClient);

      expect(mockClient.join).toHaveBeenCalledWith('tracking_link-uuid');
    });

    it('no debe hacer nada si el cliente no tiene trackingLinkId', () => {
      const mockClient = {
        data: { user: { sub: 'user-uuid' } },
        join: jest.fn(),
      };

      gateway.handleConnection(mockClient);

      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscription (subscribe-to-fleet)', () => {
    it('debe permitir a SUPER_ADMIN suscribirse a una organización específica', async () => {
      const mockClient = {
        data: { user: { sub: 'admin-uuid', role: ROLES.SUPER_ADMIN } },
        join: jest.fn(),
      };

      await gateway.handleSubscription(mockClient as any, {
        targetOrgId: 'target-org-uuid',
      });

      expect(mockClient.join).toHaveBeenCalledWith('org_target-org-uuid');
    });

    it('debe permitir a SUPER_ADMIN suscribirse al mapa global', async () => {
      const mockClient = {
        data: { user: { sub: 'admin-uuid', role: ROLES.SUPER_ADMIN } },
        join: jest.fn(),
      };

      await gateway.handleSubscription(mockClient as any, { global: true });

      expect(mockClient.join).toHaveBeenCalledWith('admin_global_map');
    });

    it('debe unir a OWNER a la sala de su organización', async () => {
      const mockClient = {
        data: {
          user: {
            sub: 'owner-uuid',
            role: ROLES.OWNER,
            orgId: 'owner-org-uuid',
          },
        },
        join: jest.fn(),
      };

      await gateway.handleSubscription(mockClient as any);

      expect(mockClient.join).toHaveBeenCalledWith('org_owner-org-uuid');
    });

    it('debe unir a DRIVER a la sala de su vehículo asignado', async () => {
      const mockClient = {
        data: {
          user: { sub: 'driver-uuid', role: ROLES.DRIVER, orgId: 'org-uuid' },
        },
        join: jest.fn(),
      };
      prismaServiceMock.assignment.findFirst.mockResolvedValue({
        vehicleId: 'assigned-vehicle-uuid',
      });

      await gateway.handleSubscription(mockClient as any);

      expect(prismaServiceMock.assignment.findFirst).toHaveBeenCalledWith({
        where: { driver: { userId: 'driver-uuid' }, to: null },
        select: { vehicleId: true },
      });
      expect(mockClient.join).toHaveBeenCalledWith(
        'vehicle_assigned-vehicle-uuid',
      );
    });

    it('no debe hacer nada si el DRIVER no tiene una asignación activa', async () => {
      const mockClient = {
        data: {
          user: { sub: 'driver-uuid', role: ROLES.DRIVER, orgId: 'org-uuid' },
        },
        join: jest.fn(),
      };
      prismaServiceMock.assignment.findFirst.mockResolvedValue(null);

      await gateway.handleSubscription(mockClient as any);

      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToClients', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      gateway.server = mockServer;
    });

    it('no debe hacer nada si falta orgId o vehicleId', () => {
      gateway.broadcastToClients({ vehicleId: 'vehicle-uuid' });
      expect(mockServer.to).not.toHaveBeenCalled();

      gateway.broadcastToClients({ orgId: 'org-uuid' });
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('debe emitir a salas internas de la flota y a salas públicas de tracking válidas', async () => {
      const payload = {
        orgId: 'org-uuid',
        vehicleId: 'vehicle-uuid',
        latitude: 8.98,
        longitude: -79.52,
        angle: 180,
        status: 'MOVING',
      };

      const mockLinks = [{ id: 'link-uuid-1' }, { id: 'link-uuid-2' }];
      prismaServiceMock.trackingLink.findMany.mockResolvedValue(mockLinks);

      await gateway.broadcastToClients(payload);

      // 1. Verificar emisión a salas internas de flota
      expect(mockServer.to).toHaveBeenCalledWith('org_org-uuid');
      expect(mockServer.to).toHaveBeenCalledWith('vehicle_vehicle-uuid');
      expect(mockServer.to).toHaveBeenCalledWith('admin_global_map');
      expect(mockServer.emit).toHaveBeenCalledWith('live-location', payload);

      // 2. Verificar consulta a la base de datos de tracking links
      expect(prismaServiceMock.trackingLink.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'vehicle-uuid',
          isActive: true,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        select: {
          id: true,
        },
      });

      // 3. Verificar emisión simplificada e individualizada a cada sala de tracking público
      expect(mockServer.to).toHaveBeenCalledWith('tracking_link-uuid-1');
      expect(mockServer.to).toHaveBeenCalledWith('tracking_link-uuid-2');
      expect(mockServer.emit).toHaveBeenCalledWith('live-location', {
        vehicleId: 'vehicle-uuid',
        lastLat: 8.98,
        lastLng: -79.52,
        lastAngle: 180,
        currentStatus: 'MOVING',
        latitude: 8.98,
        longitude: -79.52,
        angle: 180,
        status: 'MOVING',
      });
    });
  });
});
