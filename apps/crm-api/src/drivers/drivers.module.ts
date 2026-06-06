import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { RulesEngineService } from 'src/rules-engine/rules-engine.service';

@Module({
  controllers: [DriversController],
  providers: [
    DriversService,
    PrismaService,
    UsersService,
    ConfigService,
    RulesEngineService,
  ],
})
export class DriversModule {}
