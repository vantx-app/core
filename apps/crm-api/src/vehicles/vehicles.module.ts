import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from 'src/prisma.service';
import { AssignmentService } from 'src/assignment/assignment.service';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';

@Module({
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    PrismaService,
    AssignmentService,
    RulesEngineService,
  ],
})
export class VehiclesModule {}
