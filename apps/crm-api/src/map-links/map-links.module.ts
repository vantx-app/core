import { Module } from '@nestjs/common';
import { MapLinksController } from './map-links.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MapLinksController],
  providers: [PrismaService],
})
export class MapLinksModule {}
