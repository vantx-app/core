jest.mock('@prisma/client', () => {
  const mockFindUnique = jest.fn();
  const mockUpdateVehicle = jest.fn();
  const mockFindFirst = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();
  const mockDeleteMany = jest.fn();
  const mockCreateMany = jest.fn();
  const mockUpsert = jest.fn();
  const mock$transaction = jest.fn().mockImplementation(async (arr) => arr);

  const mockFindMany = jest.fn().mockResolvedValue([]);
  const mockInstance = {
    vehicle: { findFirst: mockFindUnique, update: mockUpdateVehicle },
    trip: {
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      deleteMany: mockDeleteMany,
    },
    telemetryLog: { createMany: mockCreateMany, updateMany: jest.fn() },
    vehicleLiveState: { upsert: mockUpsert },
    mapLink: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: mock$transaction,
  };

  const prismaClientMock = jest.fn().mockImplementation(() => mockInstance);
  (prismaClientMock as any)._mocks = mockInstance;

  return {
    PrismaClient: prismaClientMock,
  };
});

// Mock notification module
jest.mock('../../../telemetry-ingestor/src/utils/notifyApi', () => ({
  notifyApi: jest.fn().mockResolvedValue({ success: true }),
}));

import { parseTeltonikaData } from '../../../../packages/telemetry-parser/src/parseTeltonikaData';
import { processDataBatch } from '../../../telemetry-ingestor/src/utils/processDataBatch';
import { DEVICE_PROFILES } from '@vantx/telemetry-parser';
import { PrismaClient } from '@prisma/client';

// Retrieve the mocked methods safely
const mockPrisma = (PrismaClient as any)._mocks;

describe('Teltonika Ingestor & Parser Refactor Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseTeltonikaData', () => {
    it('debe decodificar un buffer binario y retornar registros con ioData crudo', () => {
      // Creamos un buffer minimo de Teltonika para simular Codec 8
      const dataBuffer = Buffer.alloc(120);
      dataBuffer.writeUInt32BE(0, 0); // Preamble
      dataBuffer.writeUInt32BE(100, 4); // Data length
      dataBuffer.writeUInt8(8, 8); // Codec ID
      dataBuffer.writeUInt8(1, 9); // Number of records

      let offset = 10;
      // Timestamp: 8 bytes
      dataBuffer.writeBigUInt64BE(BigInt(1716570000000), offset);
      offset += 8;
      // Priority: 1 byte
      dataBuffer.writeUInt8(1, offset);
      offset += 1;
      // Longitude, Latitude: 4 + 4 bytes (en Teltonika long se envia antes que lat)
      dataBuffer.writeInt32BE(89800000, offset); // Longitude (8.98)
      offset += 4;
      dataBuffer.writeInt32BE(-795200000, offset); // Latitude (-79.52)
      offset += 4;
      // Altitude (2 bytes), Angle (2 bytes), Satellites (1 byte), Speed (2 bytes)
      dataBuffer.writeInt16BE(100, offset); // Altitude
      offset += 2;
      dataBuffer.writeInt16BE(90, offset); // Angle
      offset += 2;
      dataBuffer.writeUInt8(12, offset); // Satellites
      offset += 1;
      dataBuffer.writeUInt16BE(40, offset); // Speed
      offset += 2;

      // event ID: 1 byte, totalIo: 1 byte
      dataBuffer.writeUInt8(250, offset++); // EventId (Trip event)
      dataBuffer.writeUInt8(4, offset++); // Total IOs (1-byte, 2-byte, 4-byte, 8-byte count)

      // n1 (1-byte IO): 2 elements
      dataBuffer.writeUInt8(2, offset++);
      // element 1: ID 239 (ignition) = 1
      dataBuffer.writeUInt8(239, offset++);
      dataBuffer.writeUInt8(1, offset++);
      // element 2: ID 250 (tripStatus) = 1
      dataBuffer.writeUInt8(250, offset++);
      dataBuffer.writeUInt8(1, offset++);

      // n2 (2-byte IO): 1 element
      dataBuffer.writeUInt8(1, offset++);
      // element 3: ID 36 (rpm) = 2000
      dataBuffer.writeUInt8(36, offset++);
      dataBuffer.writeUInt16BE(2000, offset);
      offset += 2;

      // n4 (4-byte IO): 0 elements
      dataBuffer.writeUInt8(0, offset++);
      // n8 (8-byte IO): 0 elements
      dataBuffer.writeUInt8(0, offset++);

      // Number of records footer (1 byte)
      dataBuffer.writeUInt8(1, offset);

      const parsed = parseTeltonikaData(dataBuffer);
      expect(parsed).not.toBeNull();
      expect(parsed?.totalInBatch).toBe(1);
      expect(parsed?.records[0].latitude).toBe(-79.52);
      expect(parsed?.records[0].longitude).toBe(8.98);
      expect(parsed?.records[0].ioData[239]).toBe(1);
      expect(parsed?.records[0].ioData[250]).toBe(1);
      expect(parsed?.records[0].ioData[36]).toBe(2000);
      expect(parsed?.records[0].eventId).toBe(250);
    });
  });

  describe('processDataBatch', () => {
    beforeEach(() => {
      mockPrisma.trip.findFirst.mockResolvedValue(null);
      mockPrisma.trip.create.mockResolvedValue({ id: 'new-trip-uuid-456' });
    });

    it('debe mapear datos crudos a base de datos usando el perfil estático e iniciar un viaje mediante AVL ID 250', async () => {
      const mockVehicleId = 'vehicle-uuid-1';
      const mockImei = 'imei-1';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Test',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'EXISTINGVIN123',
      });

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 40,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Ignition Pin
            250: 1, // Trip Status (1 = Active)
            36: 2200, // RPM
            66: 13500, // Voltage
            16: 1245000, // Odometer
            999: 42, // Elemento extra no mapeado
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Debe consultar el vehículo en la BD
      expect(mockPrisma.vehicle.findFirst).toHaveBeenCalledWith({
        where: { device: { imei: mockImei } },
        select: {
          id: true,
          orgId: true,
          alias: true,
          vin: true,
          fuelType: true,
          isOdometerAbsolute: true,
          odometerSource: true,
          device: {
            select: {
              model: true,
            },
          },
          liveState: {
            select: {
              lastIgnition: true,
              unplugged: true,
              currentStatus: true,
            },
          },
        },
      });

      // Debe iniciar un viaje porque ID 250 es 1 (Active) y no hay viaje activo en caché
      expect(mockPrisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vehicleId: mockVehicleId,
            startTime: records[0].timestamp,
            id: expect.any(String),
          }),
        }),
      );

      // Debe insertar los registros de telemetría a la base de datos
      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[0][0].data[0];

      // Verificaciones de mapeo
      expect(telemetryPushed.ignition).toBe(true);
      expect(telemetryPushed.rpm).toBe(2200);
      expect(telemetryPushed.powerSupply).toBe(13.5); // 13500 / 1000
      expect(telemetryPushed.odometer).toBe(1245);
      const createdTripCall = mockPrisma.trip.create.mock.calls[0][0];
      const createdTripId = createdTripCall.data.id;
      expect(telemetryPushed.tripId).toBe(createdTripId);

      // Verificación de Deduplicación: los campos mapeados (36, 66, 239, 250, 16) no deben estar en extra
      expect(telemetryPushed.extra.rpm).toBeUndefined();
      expect(telemetryPushed.extra.voltage).toBeUndefined();
      expect(telemetryPushed.extra.ignition).toBeUndefined();
      expect(telemetryPushed.extra.tripStatus).toBeUndefined();
      expect(telemetryPushed.extra.odometer).toBeUndefined();

      // El elemento no mapeado debe seguir existiendo en extra
      expect(telemetryPushed.extra[999]).toBe(42);
    });

    it('debe terminar el viaje cuando AVL ID 250 es 0 (Inactive)', async () => {
      const mockVehicleId = 'vehicle-uuid-2';
      const mockImei = 'imei-2';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Test',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'EXISTINGVIN123',
      });
      // Simulamos que ya hay un viaje activo en caché/BD
      mockPrisma.trip.findFirst.mockResolvedValue({
        id: 'active-trip-uuid',
        startTime: new Date(1716570000000 - 120000), // 2 minutos antes para que sea viaje válido (>1 min)
      });

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0, // Ignition Pin
            250: 0, // Trip Status (0 = Inactive)
            36: 0,
            66: 12100,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Debe consultar el viaje a medias desde la BD
      expect(mockPrisma.trip.findFirst).toHaveBeenCalled();

      // Debe cerrar el viaje
      expect(mockPrisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'active-trip-uuid' },
        data: { endTime: records[0].timestamp },
      });
    });

    it('debe retroceder a la lógica de ignición si el perfil del dispositivo no define tripStatus', async () => {
      const mockVehicleId = 'vehicle-uuid-3';
      const mockImei = 'imei-3';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Test',
        device: { model: 'NO_TRIP_STATUS_PROFILE' },
        vin: 'EXISTINGVIN123',
      });

      // Añadimos temporalmente un perfil sin tripStatus
      DEVICE_PROFILES['NO_TRIP_STATUS_PROFILE'] = {
        ignition: 239,
        rpm: 36,
      };

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Ignition Active
            36: 1500,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Debe iniciar el viaje porque la ignición está encendida
      expect(mockPrisma.trip.create).toHaveBeenCalled();

      // Limpiamos el perfil temporal
      delete DEVICE_PROFILES['NO_TRIP_STATUS_PROFILE'];
    });

    it('debe actualizar el VIN del vehículo si el dispositivo lo reporta y el vehículo no tiene uno asignado', async () => {
      const mockVehicleId = 'vehicle-uuid-vin-test';
      const mockImei = 'imei-vin-test';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck VIN Test',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: null, // No VIN assigned
      });
      mockPrisma.vehicle.update.mockResolvedValue({});

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 1,
          ioData: {
            239: 0,
            256: 'TESTVIN1234567890', // VIN element
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Debe haber llamado a vehicle.update con el nuevo VIN en la transacción
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: mockVehicleId },
        data: { vin: 'TESTVIN1234567890' },
      });
    });

    it('no debe actualizar el VIN si el vehículo ya tiene uno configurado en la base de datos', async () => {
      const mockVehicleId = 'vehicle-uuid-vin-test-2';
      const mockImei = 'imei-vin-test-2';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck VIN Test 2',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'EXISTINGVIN12345', // Existing VIN
      });

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 1,
          ioData: {
            239: 0,
            256: 'NEWVIN987654321', // Different VIN from device
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // No debe haber llamado a vehicle.update
      expect(mockPrisma.vehicle.update).not.toHaveBeenCalled();
    });

    it('debe actualizar el fuelType del vehículo si el dispositivo lo reporta y el vehículo no tiene uno asignado', async () => {
      const mockVehicleId = 'vehicle-uuid-fuel-test';
      const mockImei = 'imei-fuel-test';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Fuel Test',
        device: { model: 'TELTONIKA_STANDARD' },
        fuelType: null, // No fuelType assigned
      });
      mockPrisma.vehicle.update.mockResolvedValue({});

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 1,
          ioData: {
            239: 0,
            759: 4, // Diesel
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Debe haber llamado a vehicle.update con el nuevo fuelType en la transacción
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: mockVehicleId },
        data: { fuelType: 'DIESEL' },
      });
    });

    it('no debe actualizar el fuelType si el vehículo ya tiene uno configurado en la base de datos', async () => {
      const mockVehicleId = 'vehicle-uuid-fuel-test-2';
      const mockImei = 'imei-fuel-test-2';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Fuel Test 2',
        device: { model: 'TELTONIKA_STANDARD' },
        fuelType: 'GASOLINE', // Existing fuelType
      });

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 1,
          ioData: {
            239: 0,
            759: 4, // Diesel
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // No debe haber llamado a vehicle.update
      expect(mockPrisma.vehicle.update).not.toHaveBeenCalled();
    });

    it('debe ignorar el fallback de voltaje si el perfil del dispositivo define ignition y se reporta como inactivo', async () => {
      const mockVehicleId = 'vehicle-uuid-voltage-test-1';
      const mockImei = 'imei-voltage-test-1';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Voltage Test 1',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'EXISTINGVIN123',
      });

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 1,
          ioData: {
            239: 0, // Ignition Pin = OFF
            66: 13500, // Voltage = 13.5V (greater than 13.2V)
          },
        },
      ];

      await processDataBatch(records, mockImei);

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[0][0].data[0];
      expect(telemetryPushed.ignition).toBe(false);
      expect(telemetryPushed.status).toBe('STOPPED');
    });

    it('debe usar el fallback de voltaje si el perfil del dispositivo no define ignition y el voltaje es alto', async () => {
      const mockVehicleId = 'vehicle-uuid-voltage-test-2';
      const mockImei = 'imei-voltage-test-2';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Voltage Test 2',
        device: { model: 'NO_IGNITION_PROFILE' },
        vin: 'EXISTINGVIN123',
      });

      // Creamos temporalmente un perfil sin ignition
      DEVICE_PROFILES['NO_IGNITION_PROFILE'] = {
        voltage: 66,
      };

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 1,
          ioData: {
            66: 13500, // Voltage = 13.5V (greater than 13.2V)
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Limpiamos el perfil temporal
      delete DEVICE_PROFILES['NO_IGNITION_PROFILE'];

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[0][0].data[0];
      expect(telemetryPushed.ignition).toBe(true);
      expect(telemetryPushed.status).toBe('IDLING');
    });

    it('debe procesar eventos de Advanced Eco-Driving con datos de 3 ejes y registrar valores correctamente', async () => {
      const mockVehicleId = 'vehicle-uuid-eco-test';
      const mockImei = 'imei-eco-test';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Eco Test',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'EXISTINGVIN123',
      });

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 253,
          ioData: {
            239: 1, // Ignition Active
            250: 1, // Trip Status (1 = Active)
            253: 2, // Eco Driving Type (2 = Harsh Braking)
            258: 1374393139086, // Eco Driving Value Max (packed axes: X=320, Y=28, Z=14)
            259: 1254132154309, // Eco Driving Average (packed axes: X=292, Y=12, Z=5)
            260: 2155, // Eco Driving Duration (2155 ms)
          },
        },
      ];

      await processDataBatch(records, mockImei);

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[0][0].data[0];

      // Verificaciones de Advanced Eco Driving
      expect(telemetryPushed.harshBraking).toBe(320); // Máximo de X, Y, Z extraído correctamente
      expect(telemetryPushed.harshBrakingAverage).toBe(292); // Promedio de X, Y, Z extraído correctamente
      expect(telemetryPushed.harshBrakingDuration).toBe(2155);

      // Verificación de que no se registraron eventos de aceleración o giros bruscos
      expect(telemetryPushed.harshAcceleration).toBe(0);
      expect(telemetryPushed.harshCornering).toBe(0);
    });

    it('debe descartar en memoria un viaje fantasma iniciado y terminado en el mismo lote', async () => {
      const mockVehicleId = 'vehicle-uuid-ghost-mem';
      const mockImei = 'imei-ghost-mem';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Ghost Truck',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'VIN123',
      });

      const records = [
        {
          timestamp: new Date(1716570000000), // Start trip
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1, // Active
          },
        },
        {
          timestamp: new Date(1716570030000), // End trip 30s later (< 1 min)
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0,
            250: 0, // Inactive
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // No debe llamar a trip.create ni trip.delete
      expect(mockPrisma.trip.create).not.toHaveBeenCalled();
      expect(mockPrisma.trip.delete).not.toHaveBeenCalled();

      // Debe insertar telemetry logs sin tripId (se limpiaron en memoria)
      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryLogsPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[0][0].data;
      expect(telemetryLogsPushed[0].tripId).toBeNull();
      expect(telemetryLogsPushed[1].tripId).toBeNull();
    });

    it('debe crear un viaje con endTime poblado si inicia y termina en el mismo lote y dura > 1 min', async () => {
      const mockVehicleId = 'vehicle-uuid-valid-mem';
      const mockImei = 'imei-valid-mem';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Valid Truck',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'VIN123',
      });

      const records = [
        {
          timestamp: new Date(1716570000000), // Start trip
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1, // Active
          },
        },
        {
          timestamp: new Date(1716570120000), // End trip 120s later (> 1 min)
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0,
            250: 0, // Inactive
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Debe llamar a trip.create con endTime
      expect(mockPrisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vehicleId: mockVehicleId,
            startTime: records[0].timestamp,
            endTime: records[1].timestamp,
            id: expect.any(String),
          }),
        }),
      );

      // Telemetry logs deben tener asignado el tripId correspondiente
      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryLogsPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[0][0].data;
      const createdTripId = mockPrisma.trip.create.mock.calls[0][0].data.id;
      expect(telemetryLogsPushed[0].tripId).toBe(createdTripId);
      // El log de cierre se pushea después de limpiar currentTrip, así que tiene tripId = null
      expect(telemetryLogsPushed[1].tripId).toBeNull();
    });

    it('debe procesar un lote para FMC150/FMC650 usando mapeos de LVCAN y escalar la temperatura del refrigerante', async () => {
      const mockVehicleId = 'vehicle-uuid-lvcan-test';
      const mockImei = 'imei-lvcan-test';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'LVCAN Truck',
        device: { model: 'TELTONIKA_FMC150' },
        vin: null,
      });
      mockPrisma.vehicle.update.mockResolvedValue({});

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Ignition
            85: 1500, // LVCAN RPM (AVL ID 85)
            81: 45, // LVCAN Speed (AVL ID 81)
            87: 125000, // LVCAN Total Mileage (125000 meters = 125 km)
            115: 850, // LVCAN Engine Temperature (850 = 85.0°C)
            82: 'LVCANVINTEST12345', // LVCAN VIN
          },
        },
      ];

      await processDataBatch(records, mockImei);

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryLogsPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[
          mockPrisma.telemetryLog.createMany.mock.calls.length - 1
        ][0].data;
      const log = telemetryLogsPushed[0];

      expect(log.rpm).toBe(1500);
      expect(log.speed).toBe(45);
      expect(log.odometer).toBe(125.0);
      expect(log.coolantTemp).toBe(85.0); // Verificación de escala LVCAN coolantTemp (850 / 10 = 85)

      // Debe haber detectado el VIN y programado la actualización en la BD
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockVehicleId },
          data: { vin: 'LVCANVINTEST12345' },
        }),
      );
    });

    it('debe aplicar snapping a la calle si la ignición está encendida', async () => {
      const mockVehicleId = 'vehicle-uuid-snap-on';
      const mockImei = 'imei-snap-on';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Snap On',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'VIN123',
      });

      const mockLink = {
        linkId: 'road-1',
        functionalClass: 3,
        speedLimit: 50,
        geometry: '-79.5201,8.9801;-79.5202,8.9802',
      };
      mockPrisma.$queryRaw.mockResolvedValue([mockLink]);

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Ignition Active
            250: 1,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[
          mockPrisma.telemetryLog.createMany.mock.calls.length - 1
        ][0].data[0];
      // Debe haber cambiado las coordenadas originales por el snapping
      expect(telemetryPushed.latitude).not.toBe(8.98);
      expect(telemetryPushed.longitude).not.toBe(-79.52);
    });

    it('debe saltarse el snapping si la ignición está apagada', async () => {
      const mockVehicleId = 'vehicle-uuid-snap-off';
      const mockImei = 'imei-snap-off';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Snap Off',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'VIN123',
      });

      const mockLink = {
        linkId: 'road-1',
        functionalClass: 3,
        speedLimit: 50,
        geometry: '-79.5201,8.9801;-79.5202,8.9802',
      };
      mockPrisma.$queryRaw.mockResolvedValue([mockLink]);

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0, // Ignition Inactive
            250: 0,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[
          mockPrisma.telemetryLog.createMany.mock.calls.length - 1
        ][0].data[0];
      // Debe conservar las coordenadas originales
      expect(telemetryPushed.latitude).toBe(8.98);
      expect(telemetryPushed.longitude).toBe(-79.52);
    });

    it('debe saltarse el snapping si la precisión del GPS es baja (satélites < 5)', async () => {
      const mockVehicleId = 'vehicle-uuid-snap-low-gps';
      const mockImei = 'imei-snap-low-gps';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Snap Low GPS',
        device: { model: 'TELTONIKA_STANDARD' },
        vin: 'VIN123',
      });

      const mockLink = {
        linkId: 'road-1',
        functionalClass: 3,
        speedLimit: 50,
        geometry: '-79.5201,8.9801;-79.5202,8.9802',
      };
      mockPrisma.$queryRaw.mockResolvedValue([mockLink]);

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 3, // Conteo bajo de satélites (< 5)
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Ignition Active
            250: 1,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      expect(mockPrisma.telemetryLog.createMany).toHaveBeenCalled();
      const telemetryPushed =
        mockPrisma.telemetryLog.createMany.mock.calls[
          mockPrisma.telemetryLog.createMany.mock.calls.length - 1
        ][0].data[0];
      // Debe conservar las coordenadas originales debido a los pocos satélites
      expect(telemetryPushed.latitude).toBe(8.98);
      expect(telemetryPushed.longitude).toBe(-79.52);
    });

    it('debe realizar eliminaciones idempotentes usando deleteMany para evitar fallos si el viaje no existe', async () => {
      const mockVehicleId = 'vehicle-uuid-idempotent';
      const mockImei = 'imei-idempotent';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Idempotent',
        device: { model: 'TELTONIKA_STANDARD' },
      });

      // Simular un viaje fantasma que ya existía (se resolverá findFirst del docker restart guard)
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: 'trip-ghost-uuid',
        startTime: new Date(1716570000000), // Mismo tiempo para simular que está activo y es de corta duración (fantasma)
      });

      const records = [
        {
          timestamp: new Date(1716570000000), // En el pasado
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0,
            250: 0,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // Verificamos que se llame a deleteMany y no a delete para la eliminación física
      expect(mockPrisma.trip.deleteMany).toHaveBeenCalledWith({
        where: { id: 'trip-ghost-uuid' },
      });
      expect(mockPrisma.trip.delete).not.toHaveBeenCalled();
    });

    it('debe evitar ensuciar el caché global de viajes activos si la transacción de base de datos falla', async () => {
      const mockVehicleId = 'vehicle-uuid-cache-fail';
      const mockImei = 'imei-cache-fail';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Cache Fail',
        device: { model: 'TELTONIKA_STANDARD' },
      });
      mockPrisma.trip.findFirst.mockResolvedValue(null);

      // Primer lote: Inicia un viaje, pero la transacción falla
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Error('Error de conexión a la base de datos'),
      );

      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1,
          },
        },
      ];

      await expect(processDataBatch(records, mockImei)).rejects.toThrow(
        'Error de conexión a la base de datos',
      );

      // Segundo lote (reintento): la transacción ahora tiene éxito.
      // Si el caché global no se ensució, debe volver a intentar crear un nuevo viaje
      // en lugar de asumir que el viaje anterior fue creado y tratar de actualizarlo.
      mockPrisma.$transaction.mockResolvedValueOnce([]);

      await processDataBatch(records, mockImei);

      // Debe haber intentado crear un viaje de nuevo
      expect(mockPrisma.trip.create).toHaveBeenCalled();
    });

    it('debe ignorar un viaje activo en el futuro cuando se procesan registros históricos (diferidos) del pasado', async () => {
      const mockVehicleId = 'vehicle-uuid-future-trip';
      const mockImei = 'imei-future-trip';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Future Trip',
        device: { model: 'TELTONIKA_STANDARD' },
      });

      // Simulamos que hay un viaje activo en el futuro en la base de datos (ej. viaje en tiempo real)
      const futureStartTime = new Date(1716570000000 + 3600000); // 1 hora en el futuro
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: 'future-active-trip-uuid',
        startTime: futureStartTime,
      });

      // Procesamos registros del pasado (hace 1 hora)
      const records = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // No debe haber intentado actualizar ni borrar el viaje del futuro
      expect(mockPrisma.trip.deleteMany).not.toHaveBeenCalledWith({
        where: { id: 'future-active-trip-uuid' },
      });
      expect(mockPrisma.trip.update).not.toHaveBeenCalledWith({
        where: { id: 'future-active-trip-uuid' },
        data: expect.anything(),
      });

      // Debe haber creado un nuevo viaje diferente en el pasado
      expect(mockPrisma.trip.create).toHaveBeenCalled();
      const createdTripCall =
        mockPrisma.trip.create.mock.calls[
          mockPrisma.trip.create.mock.calls.length - 1
        ][0];
      expect(createdTripCall.data.id).not.toBe('future-active-trip-uuid');
    });

    it('debe evitar reabrir un viaje cerrado si el registro es del pasado (histórico/diferido) y no hay viaje activo', async () => {
      const mockVehicleId = 'vehicle-uuid-hist-reopen-test';
      const mockImei = 'imei-hist-reopen-test';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Hist Reopen Test',
        device: { model: 'TELTONIKA_STANDARD' },
      });

      // Simulamos que el último viaje en la base de datos terminó hace poco
      const lastClosedEndTime = new Date(1716570000000);
      mockPrisma.trip.findFirst.mockResolvedValueOnce(null); // activeTrip: null
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: 'recent-closed-trip-uuid',
        startTime: new Date(1716570000000 - 3600000), // Iniciado 1 hora antes
        endTime: lastClosedEndTime,
      });

      // Procesamos un registro del pasado (hace 2 horas, anterior al inicio y fin del viaje cerrado)
      const records = [
        {
          timestamp: new Date(1716570000000 - 7200000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1,
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // No debe haber intentado actualizar (reabrir) el viaje cerrado
      expect(mockPrisma.trip.update).not.toHaveBeenCalled();

      // Debe haber creado un nuevo viaje diferente para el registro del pasado
      expect(mockPrisma.trip.create).toHaveBeenCalled();
      const createdTripCall =
        mockPrisma.trip.create.mock.calls[
          mockPrisma.trip.create.mock.calls.length - 1
        ][0];
      expect(createdTripCall.data.id).not.toBe('recent-closed-trip-uuid');
    });

    it('debe mantener lastClosedTripCache cuando se procesan lotes estacionarios (heartbeats) y cargarlo de la DB si se vacía', async () => {
      const mockVehicleId = 'vehicle-uuid-cache-preservation';
      const mockImei = 'imei-cache-preservation';
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Cache Preservation',
        device: { model: 'TELTONIKA_STANDARD' },
      });

      // 1. Simulamos un lote inicial que cierra un viaje
      const recordsTripClose = [
        {
          timestamp: new Date(1716570000000),
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0, // Motor apagado
            250: 0, // Viaje inactivo (Cierra viaje)
          },
        },
      ];

      // Simulamos que el viaje que se va a cerrar ya estaba activo en caché/db
      mockPrisma.trip.findFirst.mockResolvedValueOnce({
        id: 'active-trip-to-close',
        startTime: new Date(1716570000000 - 600000), // Hace 10 min
      });

      await processDataBatch(recordsTripClose, mockImei);

      // El último viaje cerrado debe haberse registrado en mockPrisma.trip.update
      expect(mockPrisma.trip.update).toHaveBeenCalled();

      // 2. Procesamos un lote de heartbeat (estacionario)
      // Este lote no tiene viaje activo ni cierra ninguno
      const recordsHeartbeat = [
        {
          timestamp: new Date(1716570000000 + 30000), // 30s después
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          ioData: {
            239: 0, // Motor apagado
            250: 0, // Viaje inactivo
          },
        },
      ];

      // Limpiamos los mocks para monitorear nuevas llamadas
      jest.clearAllMocks();
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Cache Preservation',
        device: { model: 'TELTONIKA_STANDARD' },
      });

      await processDataBatch(recordsHeartbeat, mockImei);

      // Verificamos que no se intentó crear ni actualizar ningún viaje
      expect(mockPrisma.trip.create).not.toHaveBeenCalled();
      expect(mockPrisma.trip.update).not.toHaveBeenCalled();

      // 3. Procesamos un nuevo lote con movimiento dentro de los 90s (reapertura)
      // Debe reabrir el viaje anterior porque el caché no se borró
      const recordsReopen = [
        {
          timestamp: new Date(1716570000000 + 40000), // 40s después (dentro de los 90s)
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Motor encendido
            250: 1, // Viaje activo
          },
        },
      ];

      jest.clearAllMocks();
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Cache Preservation',
        device: { model: 'TELTONIKA_STANDARD' },
      });

      await processDataBatch(recordsReopen, mockImei);

      // Debe haber reabierto el viaje original en vez de crear uno nuevo
      expect(mockPrisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'active-trip-to-close' },
          data: { endTime: null },
        }),
      );
      expect(mockPrisma.trip.create).not.toHaveBeenCalled();
    });

    it('debe detectar viajes solapados/duplicados en la base de datos y fusionarlos', async () => {
      const mockVehicleId = 'vehicle-uuid-overlap-merge-test';
      const mockImei = 'imei-overlap-merge-test';
      
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: mockVehicleId,
        orgId: 'org-uuid-999',
        alias: 'Truck Overlap Merge',
        device: { model: 'TELTONIKA_STANDARD' },
        liveState: {
          lastIgnition: false,
          currentStatus: 'STOPPED',
          unplugged: false,
        },
      });

      // Simulamos que ya existe un viaje duplicado en la base de datos (Trip B de 12:06 a 1:20)
      const existingTripStart = new Date(1716570000000 + 60000); // 12:06 (1 minuto después)
      const existingTripEnd = new Date(1716570000000 + 4500000); // 1:20
      
      mockPrisma.trip.findMany.mockResolvedValueOnce([
        {
          id: 'existing-trip-b-id',
          vehicleId: mockVehicleId,
          startTime: existingTripStart,
          endTime: existingTripEnd,
        },
      ]);

      // Enviamos un lote de registros que abarca desde 12:05 hasta 3:15
      const records = [
        {
          timestamp: new Date(1716570000000), // 12:05
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1, // Motor encendido
            250: 1, // Viaje activo
          },
        },
        {
          timestamp: new Date(1716570000000 + 60000), // 12:06
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1,
          },
        },
        {
          timestamp: new Date(1716570000000 + 4500000), // 1:20
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 30,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 1,
            250: 1,
          },
        },
        {
          timestamp: new Date(1716570000000 + 11400000), // 3:15
          latitude: 8.98,
          longitude: -79.52,
          altitude: 100,
          angle: 90,
          satellites: 12,
          gpsSpeed: 0,
          priority: 1,
          eventId: 250,
          ioData: {
            239: 0, // Motor apagado
            250: 0, // Viaje inactivo
          },
        },
      ];

      await processDataBatch(records, mockImei);

      // 1. Debe haber creado un nuevo viaje en la BD (Trip A)
      expect(mockPrisma.trip.create).toHaveBeenCalled();

      // 2. Debe haber reasignado las telemetrías del viaje duplicado (Trip B) al viaje activo nuevo (Trip A)
      expect(mockPrisma.telemetryLog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'existing-trip-b-id' },
          data: { tripId: expect.any(String) },
        }),
      );

      // 3. Debe haber eliminado físicamente el viaje duplicado (Trip B)
      expect(mockPrisma.trip.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-trip-b-id' },
        }),
      );
    });
  });
});
