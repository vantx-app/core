import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { UsersModule } from 'src/users/users.module';
import { DriverDocumentsModule } from 'src/driver-documents/driver-documents.module';

@Module({
  imports: [UsersModule, DriverDocumentsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
