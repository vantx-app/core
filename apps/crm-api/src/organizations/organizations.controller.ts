import { Controller, Post, Get, Body, Patch, Param } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { ROLES } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';

@Roles(ROLES.SUPER_ADMIN)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      ownerName: string;
      ownerEmail: string;
      ownerPassword?: string;
    },
  ) {
    return this.organizationsService.createOrganizationAndOwner(body);
  }

  @Get()
  async findAll() {
    return this.organizationsService.findAll();
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      ownerName?: string;
      ownerEmail?: string;
      subscriptionStatus?: string;
      subscriptionExpiresAt?: string | null;
    },
  ) {
    return this.organizationsService.update(id, body);
  }
}
