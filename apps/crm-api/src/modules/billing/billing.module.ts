import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaService } from 'src/prisma.service';
import { DriverDocumentsModule } from 'src/driver-documents/driver-documents.module';

@Module({
  imports: [DriverDocumentsModule],
  controllers: [BillingController],
  providers: [BillingService, PrismaService],
  exports: [BillingService],
})
export class BillingModule {}
