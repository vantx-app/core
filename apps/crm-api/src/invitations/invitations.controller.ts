import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { InvitationsService } from './invitations.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AccessTokenPayload } from 'src/auth/types';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * Endpoint público para verificar la validez de un token en el montaje de la página.
   * @param token Token de invitación recibido como query parameter
   */
  @Public()
  @Get('validate')
  validate(@Query('token') token: string) {
    // Validamos que el parámetro 'token' esté presente en la petición
    if (!token) {
      throw new BadRequestException('El token es requerido.');
    }
    return this.invitationsService.validateToken(token);
  }

  /**
   * Endpoint para generar un nuevo token de invitación.
   * Restringido a SUPER_ADMIN.
   */
  @Roles(Role.SUPER_ADMIN)
  @Post()
  async createInvitation(@Req() req: Request & { user: AccessTokenPayload }) {
    const creatorId = req.user.sub;
    return this.invitationsService.createInvitation(creatorId);
  }

  /**
   * Endpoint para obtener el listado de invitaciones.
   * Restringido a SUPER_ADMIN.
   */
  @Roles(Role.SUPER_ADMIN)
  @Get()
  async getInvitations() {
    return this.invitationsService.getInvitations();
  }
}
