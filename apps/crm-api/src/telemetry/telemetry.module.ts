import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryGateway } from './telemetry.gateway';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TelemetryController],
  providers: [TelemetryGateway, JwtService, ConfigService, PrismaService],
  exports: [TelemetryGateway],
})
export class TelemetryModule {}
