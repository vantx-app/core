import { Controller, Post, Body } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { InvitationsService } from './invitations.service';
import { RegisterOwnerWithOrgDto } from './dto/register-owner-with-org.dto';

@Controller('register')
export class RegisterController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * Endpoint público para que los propietarios (Owners) completen su registro
   * e inicialicen su organización y opcionalmente su rol de conductor.
   */
  @Public()
  @Post('owner-with-org')
  async registerOwnerWithOrg(@Body() dto: RegisterOwnerWithOrgDto) {
    return this.invitationsService.registerOwnerWithOrg(dto);
  }
}
