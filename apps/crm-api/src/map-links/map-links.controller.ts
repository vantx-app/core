import { Controller, Get, Patch, Param, Body, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ROLES } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('map-links')
export class MapLinksController {
  constructor(private readonly prisma: PrismaService) { }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Get()
  async getMapLinks(
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string,
  ) {
    let links: any[] = [];

    const hasBbox = minLat && maxLat && minLng && maxLng;

    if (hasBbox) {
      const nMinLat = parseFloat(minLat) - 0.005;
      const nMaxLat = parseFloat(maxLat) + 0.005;
      const nMinLng = parseFloat(minLng) - 0.005;
      const nMaxLng = parseFloat(maxLng) + 0.005;

      if (isNaN(nMinLat) || isNaN(nMaxLat) || isNaN(nMinLng) || isNaN(nMaxLng)) {
        throw new BadRequestException('Bounding box coordinates must be numbers');
      }

      // Query segments inside bounding box using spatial GIST index ordered by latest updates
      links = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM "MapLink"
        WHERE box(point("minLng", "minLat"), point("maxLng", "maxLat")) && box(point(${nMinLng}, ${nMinLat}), point(${nMaxLng}, ${nMaxLat}))
        ORDER BY "updatedAt" DESC
        LIMIT 5000
      `;
    } else {
      // Default: fetch latest map links ordered by update time (capped for API memory safety)
      links = await this.prisma.mapLink.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 1500,
      });
    }

    // Convert into a GeoJSON FeatureCollection
    const features = links.map((link) => {
      let coordinates: [number, number][] = [];
      try {
        if (link.geometry) {
          coordinates = link.geometry.split(';').map((pair: string) => {
            const [lng, lat] = pair.split(',').map(Number);
            return [lng, lat] as [number, number];
          });
        }
      } catch (err) {
        // Skip malformed geometry
      }

      // Calculate approximate general heading of the segment (from first to last coordinate)
      let segmentHeading = 0;
      if (coordinates.length >= 2) {
        const start = coordinates[0];
        const end = coordinates[coordinates.length - 1];
        // calculate heading
        const dLon = ((end[0] - start[0]) * Math.PI) / 180;
        const lat1Rad = (start[1] * Math.PI) / 180;
        const lat2Rad = (end[1] * Math.PI) / 180;
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x =
          Math.cos(lat1Rad) * Math.sin(lat2Rad) -
          Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        const brng = (Math.atan2(y, x) * 180) / Math.PI;
        segmentHeading = Math.round((brng + 360) % 360);
      }

      return {
        type: 'Feature',
        id: link.linkId,
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          linkId: link.linkId,
          functionalClass: link.functionalClass,
          speedLimit: link.speedLimit,
          heading: segmentHeading,
          isBidirectional: link.isBidirectional,
          isVerified: link.isVerified ?? false,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN)
  @Patch(':linkId')
  async updateMapLink(
    @Param('linkId') linkId: string,
    @Body() body: { speedLimit?: number; functionalClass?: number; isVerified?: boolean; isBidirectional?: boolean },
  ) {
    const existing = await this.prisma.mapLink.findUnique({ where: { linkId } });
    if (!existing) {
      throw new NotFoundException(`Segment link ${linkId} not found`);
    }

    const updated = await this.prisma.mapLink.update({
      where: { linkId },
      data: {
        speedLimit: body.speedLimit !== undefined ? Number(body.speedLimit) : existing.speedLimit,
        functionalClass: body.functionalClass !== undefined ? Number(body.functionalClass) : existing.functionalClass,
        isVerified: body.isVerified !== undefined ? Boolean(body.isVerified) : true,
        isBidirectional: body.isBidirectional !== undefined ? Boolean(body.isBidirectional) : existing.isBidirectional,
      },
    });

    return updated;
  }
}
