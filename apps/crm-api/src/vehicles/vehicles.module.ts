import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from 'src/prisma.service';
import { AssignmentService } from 'src/assignment/assignment.service';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';
import { ValhallaRoutesClientService } from 'src/scoring-cron/valhalla-routes-client.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    PrismaService,
    AssignmentService,
    RulesEngineService,
    ValhallaRoutesClientService,
  ],
})
export class VehiclesModule {}
