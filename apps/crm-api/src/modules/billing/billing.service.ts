import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { DocumentStorageService } from 'src/driver-documents/document-storage.service';
import axios from 'axios';
import PDFDocument from 'pdfkit';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: DocumentStorageService,
  ) {}

  async getOfflineUploadUrl(orgId: string, contentType: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new HttpException(
        'Organización no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    const ext = this.storageService.getExtensionFromContentType(contentType);
    const fileKey = `receipts/${orgId}/proof-${Date.now()}.${ext}`;

    const uploadUrl = await this.storageService.generateUploadUrl(
      fileKey,
      contentType,
    );

    return { uploadUrl, fileKey };
  }

  async createPagueloFacilSession(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new HttpException(
        'Organización no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    // Consultar configuración de precios
    const pricing = await this.getPricingSettings();

    // Consultar vehículos de la organización
    const vehicles = await this.prisma.vehicle.findMany({
      where: { orgId },
    });

    const activeVehiclesCount = vehicles.filter(
      (v) => v.subscriptionTier === 'ACTIVE',
    ).length;

    if (activeVehiclesCount === 0) {
      throw new HttpException(
        'No hay vehículos con telemetría activa seleccionados para el pago.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const amount = activeVehiclesCount * pricing.geolocationPrice;

    const cclw = process.env.PAGUELOFACIL_CCLW || 'test_cclw_123';
    const apiUrl =
      process.env.PAGUELOFACIL_API_URL ||
      'https://sandbox.paguelofacil.com/LinkDeamon.cfm';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${frontendUrl}/billing?status=success&payment_method=paguelofacil`;

    // Generar enlace en PágueloFácil LinkDeamon
    const hexReturnUrl = Buffer.from(returnUrl).toString('hex');

    try {
      this.logger.log(
        `Creando sesión de pago en PágueloFácil para la organización ${orgId} por un monto de $${amount.toFixed(2)}`,
      );

      const payload = {
        CCLW: cclw,
        CMTN: amount.toFixed(2),
        CDSC: 'Suscripción Mensual Premium Flota y Reclutamiento',
        RETURN_URL: hexReturnUrl,
        PARM_1: orgId,
      };

      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, val]) => {
        params.append(key, val.toString());
      });

      const response = await axios.post(apiUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 5000,
      });

      if (response.data && response.data.success && response.data.data?.url) {
        return response.data.data.url;
      }

      if (response.data?.url) {
        return response.data.url;
      }

      this.logger.error(
        `PágueloFácil no retornó URL estructurada. Datos de respuesta: ${JSON.stringify(response.data)}`,
      );
      throw new ServiceUnavailableException(
        'El proveedor de pagos no devolvió una URL de sesión válida.',
      );
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      this.logger.error(
        `Error al conectar con la API de PágueloFácil: ${err.message}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de pago PágueloFácil no está disponible en este momento. Por favor, intente de nuevo más tarde.',
      );
    }
  }

  async processOfflinePayment(
    orgId: string,
    paymentMethod: 'BANK_TRANSFER' | 'YAPPY',
    reference: string,
    receiptKey?: string,
  ): Promise<any> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new HttpException(
        'Organización no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!reference || reference.trim() === '') {
      throw new HttpException(
        'La referencia del pago es obligatoria.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Actualizamos el estado a PENDING_ACTIVATION
    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionStatus: 'PENDING_ACTIVATION',
        paymentMethod,
        paymentReceiptKey: receiptKey || null,
      },
    });
  }

  async handlePagueloFacilWebhook(payload: any): Promise<void> {
    this.logger.log('Recibido webhook de PágueloFácil:', payload);

    // Extraemos orgId y status de forma flexible
    const orgId =
      payload.orgId || payload.PARM_1 || payload.parm_1 || payload.PF_CF?.orgId;
    const status = payload.status || payload.Estado || payload.estado;

    if (!orgId) {
      this.logger.warn(
        'Webhook de PágueloFácil recibido sin identificador de organización (orgId/PARM_1)',
      );
      return;
    }

    const approvedStatuses = ['approved', 'APPROVED', 'Aprobada', 'aprobada'];
    if (approvedStatuses.includes(status)) {
      await this.activateSubscription(orgId, 'PAGUELOFACIL', 30);
    } else {
      await this.updateSubscriptionStatus(orgId, 'INACTIVE');
    }
  }

  async manualActivate(orgId: string, expiresAt: Date): Promise<void> {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
      },
    });
  }

  private async activateSubscription(
    orgId: string,
    method: string,
    days: number,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionStatus: 'ACTIVE',
        paymentMethod: method,
        subscriptionExpiresAt: expiresAt,
      },
    });
    this.logger.log(
      `Suscripción activada para la organización: ${orgId} hasta ${expiresAt}`,
    );
  }

  private async updateSubscriptionStatus(
    orgId: string,
    status: string,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionStatus: status,
      },
    });
    this.logger.log(
      `Estado de suscripción actualizado para la organización: ${orgId} a ${status}`,
    );
  }

  async getPricingSettings() {
    const flatSaaSPrice = await this.getNumericSetting(
      'PRICING_FLAT_SAAS',
      49.0,
    );
    const geolocationPrice = await this.getNumericSetting(
      'PRICING_GEOLOCATION',
      15.0,
    );
    const diagnosticsPrice = await this.getNumericSetting(
      'PRICING_DIAGNOSTICS',
      30.0,
    );

    return {
      flatSaaSPrice,
      geolocationPrice,
      diagnosticsPrice,
    };
  }

  async updatePricingSettings(
    flatSaaSPrice?: number,
    geolocationPrice?: number,
    diagnosticsPrice?: number,
  ) {
    if (flatSaaSPrice !== undefined) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'PRICING_FLAT_SAAS' },
        update: { value: flatSaaSPrice.toFixed(2) },
        create: { key: 'PRICING_FLAT_SAAS', value: flatSaaSPrice.toFixed(2) },
      });
    }

    if (geolocationPrice !== undefined) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'PRICING_GEOLOCATION' },
        update: { value: geolocationPrice.toFixed(2) },
        create: {
          key: 'PRICING_GEOLOCATION',
          value: geolocationPrice.toFixed(2),
        },
      });
    }

    if (diagnosticsPrice !== undefined) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'PRICING_DIAGNOSTICS' },
        update: { value: diagnosticsPrice.toFixed(2) },
        create: {
          key: 'PRICING_DIAGNOSTICS',
          value: diagnosticsPrice.toFixed(2),
        },
      });
    }

    return { success: true };
  }

  private async getNumericSetting(
    key: string,
    defaultValue: number,
  ): Promise<number> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key },
      });
      return setting ? parseFloat(setting.value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async generateSafetyPortfolioPdf(orgId: string): Promise<Buffer> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        vehicles: {
          include: {
            VehicleGlobalStats: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    const pricing = await this.getPricingSettings();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // PDF Content Design
      doc.rect(20, 20, 572, 752).strokeColor('#1e3a8a').lineWidth(2).stroke();

      doc
        .fillColor('#1e3a8a')
        .fontSize(24)
        .text('CERTIFICADO DE SEGURIDAD VIAL', { align: 'center' });
      doc.moveDown();
      doc
        .fillColor('#4b5563')
        .fontSize(10)
        .text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-ES')}`, {
          align: 'right',
        });
      doc.moveDown(2);

      doc
        .fillColor('#1f2937')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`Organización: ${org.name}`);
      doc.font('Helvetica').moveDown();

      // Aggregate Stats
      const totalMonitoredKm = org.vehicles.reduce(
        (sum, v) => sum + (v.VehicleGlobalStats?.totalKm ?? 0),
        0,
      );
      const totalEngineHours = org.vehicles.reduce(
        (sum, v) => sum + (v.VehicleGlobalStats?.totalEngineHours ?? 0),
        0,
      );

      const safetyScores = org.vehicles.map(
        (v) => v.VehicleGlobalStats?.globalSafetyScore ?? 100,
      );
      const avgSafetyScore =
        safetyScores.length > 0
          ? Math.round(
              safetyScores.reduce((sum, s) => sum + s, 0) / safetyScores.length,
            )
          : 100;

      const ecoScores = org.vehicles.map(
        (v) => v.VehicleGlobalStats?.globalFuelEfficiency ?? 100,
      );
      const avgEcoScore =
        ecoScores.length > 0
          ? Math.round(
              ecoScores.reduce((sum, s) => sum + s, 0) / ecoScores.length,
            )
          : 100;

      const overallScores = org.vehicles.map(
        (v) => v.VehicleGlobalStats?.globalOverallScore ?? 100,
      );
      const avgOverallScore =
        overallScores.length > 0
          ? Math.round(
              overallScores.reduce((sum, s) => sum + s, 0) /
                overallScores.length,
            )
          : 100;

      doc
        .fontSize(12)
        .text(
          `Kilómetros Totales Monitoreados: ${Math.round(totalMonitoredKm).toLocaleString()} km`,
        );
      doc.text(
        `Horas de Motor Totales: ${Math.round(totalEngineHours).toLocaleString()} hrs`,
      );
      doc.moveDown();

      doc.rect(50, doc.y, 500, 80).fillColor('#f3f4f6').fill();
      doc
        .fillColor('#1e3a8a')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('PUNTUACIONES PROMEDIO DE FLOTA', 60, doc.y - 70);
      doc
        .fillColor('#1f2937')
        .font('Helvetica')
        .text(
          `Puntaje de Seguridad Vial: ${avgSafetyScore} pts`,
          60,
          doc.y - 50,
        );
      doc.text(
        `Puntaje de Eficiencia de Combustible (Eco): ${avgEcoScore} pts`,
        60,
        doc.y - 35,
      );
      doc.text(
        `Puntaje Operativo General: ${avgOverallScore} pts`,
        60,
        doc.y - 20,
      );

      doc.y = doc.y + 20;

      // Table of Vehicles
      doc
        .fillColor('#1e3a8a')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Detalle por Vehículo', 50, doc.y);
      doc.font('Helvetica').moveDown();

      doc.fontSize(10).fillColor('#1f2937');
      const tableY = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Placa / Alias', 50, tableY, { width: 150 });
      doc.text('Modelo GPS', 200, tableY, { width: 100 });
      doc.text('Km Recorridos', 300, tableY, { width: 100 });
      doc.text('Puntaje General', 420, tableY, { width: 100 });
      doc.font('Helvetica');
      doc.moveDown(0.5);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(520, doc.y)
        .stroke();
      doc.moveDown(0.5);

      org.vehicles.forEach((vehicle) => {
        const score = vehicle.VehicleGlobalStats?.globalOverallScore ?? 100;
        doc.text(vehicle.alias || vehicle.plateNumber, 50, doc.y, {
          width: 150,
        });
        doc.text(vehicle.deviceModel, 200, doc.y, { width: 100 });
        doc.text(
          `${Math.round(vehicle.VehicleGlobalStats?.totalKm ?? 0).toLocaleString()} km`,
          300,
          doc.y,
          { width: 100 },
        );
        doc.text(`${Math.round(score)} pts`, 420, doc.y, { width: 100 });
        doc.moveDown();
      });

      doc.moveDown(3);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          'Este certificado es emitido por VantX de forma digital e inalterable basándose en registros de telemetría GPS Teltonika de alta frecuencia.',
          { align: 'center' },
        );

      doc.end();
    });
  }
}
