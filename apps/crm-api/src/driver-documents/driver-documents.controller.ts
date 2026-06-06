import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { DriverDocumentsService } from './driver-documents.service';
import { AccessTokenPayload } from 'src/auth/types';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ROLES } from 'src/common/enums/roles.enum';
import { DriverDocumentType, DriverDocumentStatus } from '@prisma/client';

@Controller('documents')
export class DriverDocumentsController {
  constructor(
    private readonly driverDocumentsService: DriverDocumentsService,
  ) {}

  // --- Endpoints del Conductor (Driver) ---

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Post('me/upload-url')
  async getUploadUrl(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() body: { type: DriverDocumentType; contentType: string },
  ) {
    if (!body.type || !body.contentType) {
      throw new BadRequestException(
        'El tipo de documento y el contentType son requeridos.',
      );
    }
    return this.driverDocumentsService.getUploadUrl(
      req.user.sub,
      body.type,
      body.contentType,
    );
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Post('me/verify')
  async verifyDocument(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() body: { type: DriverDocumentType },
  ) {
    if (!body.type) {
      throw new BadRequestException('El tipo de documento es requerido.');
    }
    return this.driverDocumentsService.verifyDocument(req.user.sub, body.type);
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Post('me/didit-session')
  async createDiditSession(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() body: { type: DriverDocumentType },
  ) {
    if (!body.type) {
      throw new BadRequestException('El tipo de documento es requerido.');
    }
    if (
      body.type !== DriverDocumentType.NATIONAL_ID &&
      body.type !== DriverDocumentType.DRIVERS_LICENSE
    ) {
      throw new BadRequestException(
        'El tipo de documento debe ser NATIONAL_ID o DRIVERS_LICENSE.',
      );
    }
    return this.driverDocumentsService.createDiditSession(
      req.user.sub,
      body.type,
    );
  }

  @Roles(ROLES.DRIVER, ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @Get('me')
  async getMyDocuments(@Req() req: Request & { user: AccessTokenPayload }) {
    return this.driverDocumentsService.getDriverDocuments(req.user.sub);
  }

  // --- Endpoints del Administrador (Admin/Owner/SuperAdmin) ---

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Get('admin/pending')
  async getPendingDocuments() {
    return this.driverDocumentsService.getPendingDocumentsForAdmin();
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Post('admin/:id/review')
  async reviewDocument(
    @Param('id') id: string,
    @Body() body: { status: DriverDocumentStatus },
  ) {
    if (
      body.status !== DriverDocumentStatus.APPROVED &&
      body.status !== DriverDocumentStatus.REJECTED
    ) {
      throw new BadRequestException(
        'El estado de revisión debe ser APPROVED o REJECTED.',
      );
    }
    return this.driverDocumentsService.reviewDocument(id, body.status);
  }
}
