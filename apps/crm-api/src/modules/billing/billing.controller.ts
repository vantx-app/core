import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ROLES } from 'src/common/enums/roles.enum';
import { AccessTokenPayload } from 'src/auth/types';
import { Response } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Roles(ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Post('checkout/paguelofacil')
  async createPagueloFacilCheckout(@Req() req: any) {
    const user: AccessTokenPayload = req.user;
    const url = await this.billingService.createPagueloFacilSession(user.orgId);
    return { url };
  }

  @Roles(ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Post('checkout/offline/upload-url')
  async getOfflineUploadUrl(
    @Req() req: any,
    @Body() body: { contentType: string },
  ) {
    const user: AccessTokenPayload = req.user;
    if (!body.contentType) {
      throw new HttpException(
        'El tipo de contenido es obligatorio.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.billingService.getOfflineUploadUrl(
      user.orgId,
      body.contentType,
    );
  }

  @Roles(ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Post('checkout/offline')
  async processOfflineCheckout(
    @Req() req: any,
    @Body()
    body: {
      paymentMethod: 'BANK_TRANSFER' | 'YAPPY';
      reference: string;
      receiptKey?: string;
    },
  ) {
    const user: AccessTokenPayload = req.user;
    const result = await this.billingService.processOfflinePayment(
      user.orgId,
      body.paymentMethod,
      body.reference,
      body.receiptKey,
    );
    return {
      message:
        'Comprobante recibido con éxito. Activación pendiente de revisión.',
      data: result,
    };
  }

  @Public()
  @Post('webhook/paguelofacil')
  async handlePagueloFacilWebhook(@Body() payload: any) {
    await this.billingService.handlePagueloFacilWebhook(payload);
    return { success: true };
  }

  @Roles(ROLES.SUPER_ADMIN)
  @Post('admin/activate')
  async manualActivate(@Body() body: { orgId: string; expiresAt: string }) {
    if (!body.orgId || !body.expiresAt) {
      throw new HttpException(
        'Parámetros orgId y expiresAt obligatorios',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.billingService.manualActivate(
      body.orgId,
      new Date(body.expiresAt),
    );
    return { message: 'Suscripción activada manualmente con éxito.' };
  }

  @Roles(ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get('settings')
  async getPricingSettings() {
    return this.billingService.getPricingSettings();
  }

  @Roles(ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get('reports/safety-portfolio')
  async downloadSafetyPortfolio(@Req() req: any, @Res() res: Response) {
    const user: AccessTokenPayload = req.user;
    const pdfBuffer = await this.billingService.generateSafetyPortfolioPdf(
      user.orgId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'attachment; filename=Certificado_Seguridad_Flota.pdf',
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  @Roles(ROLES.SUPER_ADMIN)
  @Patch('settings')
  async updatePricingSettings(
    @Body()
    body: {
      flatSaaSPrice?: number;
      geolocationPrice?: number;
      diagnosticsPrice?: number;
    },
  ) {
    return this.billingService.updatePricingSettings(
      body.flatSaaSPrice,
      body.geolocationPrice,
      body.diagnosticsPrice,
    );
  }
}
