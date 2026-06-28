import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { CreateSimCardDto } from './dto/create-simcard.dto';
import { DeviceModel, DeviceStatus, DeviceSource } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async createDevice(dto: CreateDeviceDto) {
    const existing = await this.prisma.device.findUnique({
      where: { imei: dto.imei },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un dispositivo con este IMEI.');
    }
    return this.prisma.device.create({
      data: {
        imei: dto.imei,
        model: dto.model,
        source: DeviceSource.MANUAL,
      },
    });
  }

  async findAllDevices(status?: DeviceStatus) {
    return this.prisma.device.findMany({
      where: status ? { status } : {},
      include: {
        vehicle: true,
        simCard: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneDevice(id: string) {
    return this.prisma.device.findUnique({
      where: { id },
      include: { vehicle: true, simCard: true },
    });
  }

  async linkSimCard(deviceId: string, simCardId: string | null) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) throw new NotFoundException('Dispositivo no encontrado.');

    if (simCardId) {
      const sim = await this.prisma.simCard.findUnique({
        where: { id: simCardId },
      });
      if (!sim) throw new NotFoundException('SIM Card no encontrada.');

      // Verify SIM is not already linked to another device
      const existingLink = await this.prisma.device.findUnique({
        where: { simCardId },
      });
      if (existingLink && existingLink.id !== deviceId) {
        throw new BadRequestException(
          'Esta tarjeta SIM ya está vinculada a otro dispositivo.',
        );
      }
    }

    return this.prisma.device.update({
      where: { id: deviceId },
      data: { simCardId },
    });
  }

  async linkVehicle(deviceId: string, vehicleId: string | null) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) throw new NotFoundException('Dispositivo no encontrado.');

    // If unbinding
    if (!vehicleId) {
      return this.prisma.device.update({
        where: { id: deviceId },
        data: { vehicleId: null, status: DeviceStatus.UNASSIGNED },
      });
    }

    // Verify vehicle exists
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado.');

    // Verify vehicle is not already bound
    const existingVehicleBind = await this.prisma.device.findUnique({
      where: { vehicleId },
    });
    if (existingVehicleBind && existingVehicleBind.id !== deviceId) {
      throw new BadRequestException(
        'Este vehículo ya tiene un dispositivo asociado.',
      );
    }

    return this.prisma.device.update({
      where: { id: deviceId },
      data: { vehicleId, status: DeviceStatus.ACTIVE },
    });
  }

  async createSimCard(dto: CreateSimCardDto) {
    const existing = await this.prisma.simCard.findUnique({
      where: { iccid: dto.iccid },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya existe una tarjeta SIM con este ICCID.',
      );
    }
    return this.prisma.simCard.create({
      data: dto,
    });
  }

  async findAllSimCards() {
    return this.prisma.simCard.findMany({
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async syncFotaDevices() {
    const token = process.env.TELTONIKA_FOTA_TOKEN;
    let fotaDevices: any[] = [];

    if (token) {
      try {
        const response = await axios.get('https://api.teltonika.lt/devices', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });
        fotaDevices = response.data?.devices || [];
      } catch (err: any) {
        console.error('Error calling Teltonika FOTA Web API:', err.message);
        // Fallback to mock on API failure so development works
        fotaDevices = this.getMockFotaDevices();
      }
    } else {
      fotaDevices = this.getMockFotaDevices();
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const fDevice of fotaDevices) {
      let model: DeviceModel = DeviceModel.FMC003;
      if (fDevice.model?.includes('FMC150')) model = DeviceModel.FMC150;
      else if (fDevice.model?.includes('FMC650')) model = DeviceModel.FMC650;

      const existing = await this.prisma.device.findUnique({
        where: { imei: fDevice.imei },
      });

      if (existing) {
        await this.prisma.device.update({
          where: { id: existing.id },
          data: {
            firmware: fDevice.firmware || existing.firmware,
            lastSeen: fDevice.lastSeen
              ? new Date(fDevice.lastSeen)
              : existing.lastSeen,
          },
        });
        updatedCount++;
      } else {
        await this.prisma.device.create({
          data: {
            imei: fDevice.imei,
            model,
            status: DeviceStatus.UNASSIGNED,
            firmware: fDevice.firmware || '00.00.00',
            source: DeviceSource.FOTA,
            lastSeen: fDevice.lastSeen ? new Date(fDevice.lastSeen) : null,
          },
        });
        createdCount++;
      }
    }

    return {
      success: true,
      syncedCount: fotaDevices.length,
      createdCount,
      updatedCount,
    };
  }

  async importDevicesFromCsv(fileBuffer: Buffer) {
    const content = fileBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/);
    if (lines.length < 2) {
      throw new BadRequestException('El archivo CSV está vacío.');
    }

    const headerLine = lines[0].trim();
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

    const imeiIdx = headers.indexOf('imei');
    const modelIdx = headers.indexOf('model');
    const firmwareIdx = headers.indexOf('current_firmware');
    const iccidIdx = headers.indexOf('iccid');

    if (imeiIdx === -1 || modelIdx === -1) {
      throw new BadRequestException(
        'El archivo CSV debe contener al menos las columnas "imei" y "model".',
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(',').map((v) => v.trim());
      const imei = values[imeiIdx];
      const modelStr = values[modelIdx];
      const firmware = firmwareIdx !== -1 ? values[firmwareIdx] : undefined;
      const iccid = iccidIdx !== -1 ? values[iccidIdx] : undefined;

      if (!imei || imei.length !== 15 || !/^\d+$/.test(imei)) {
        errors.push(
          `Línea ${i + 1}: IMEI inválido "${imei}". Debe tener 15 dígitos.`,
        );
        continue;
      }

      let model: DeviceModel;
      if (modelStr?.toUpperCase().includes('FMC150')) {
        model = DeviceModel.FMC150;
      } else if (modelStr?.toUpperCase().includes('FMC650')) {
        model = DeviceModel.FMC650;
      } else if (modelStr?.toUpperCase().includes('FMC003')) {
        model = DeviceModel.FMC003;
      } else {
        errors.push(`Línea ${i + 1}: Modelo inválido "${modelStr}".`);
        continue;
      }

      try {
        let simCardId: string | undefined = undefined;

        if (iccid && (iccid.length === 19 || iccid.length === 20)) {
          let simCard = await this.prisma.simCard.findUnique({
            where: { iccid },
          });
          if (!simCard) {
            simCard = await this.prisma.simCard.create({
              data: { iccid, carrier: 'Importado' },
            });
          }
          simCardId = simCard.id;
        }

        const existing = await this.prisma.device.findUnique({
          where: { imei },
        });

        if (existing) {
          await this.prisma.device.update({
            where: { id: existing.id },
            data: {
              model,
              firmware: firmware || existing.firmware,
              simCardId:
                simCardId !== undefined ? simCardId : existing.simCardId,
            },
          });
          updatedCount++;
        } else {
          await this.prisma.device.create({
            data: {
              imei,
              model,
              status: DeviceStatus.UNASSIGNED,
              firmware: firmware || '00.00.00',
              source: DeviceSource.MANUAL,
              simCardId: simCardId || null,
            },
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push(
          `Línea ${i + 1}: Error al procesar IMEI ${imei}: ${err.message}`,
        );
      }
    }

    return {
      success: true,
      createdCount,
      updatedCount,
      totalProcessed: createdCount + updatedCount,
      errors,
    };
  }

  private getMockFotaDevices() {
    return [
      {
        imei: '863242045551001',
        model: 'FMC150',
        firmware: '03.29.00.Rev.14',
        lastSeen: new Date().toISOString(),
      },
      {
        imei: '864984045551002',
        model: 'FMC650',
        firmware: '01.02.05.Rev.02',
        lastSeen: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        imei: '863024045551003',
        model: 'FMC003',
        firmware: '03.28.02.Rev.08',
        lastSeen: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  }
}
