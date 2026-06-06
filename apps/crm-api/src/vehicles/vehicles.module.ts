import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from 'src/prisma.service';
import { AssignmentService } from 'src/assignment/assignment.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, PrismaService, AssignmentService],
})
export class VehiclesModule {}
