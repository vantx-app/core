import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/prisma.service';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverDocumentsService } from './driver-documents.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentVerificationService } from './document-verification.service';
import { DiditVerificationService } from './didit-verification.service';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [DriverDocumentsController],
  providers: [
    DriverDocumentsService,
    PrismaService,
    DocumentStorageService,
    DocumentVerificationService,
    DiditVerificationService,
  ],
  exports: [DriverDocumentsService, DocumentStorageService],
})
export class DriverDocumentsModule {}
