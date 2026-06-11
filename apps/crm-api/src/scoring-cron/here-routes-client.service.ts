import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RouteSpanWithSpeedLimit,
  CalculatedRouteResult,
} from './aws-routes-client.service';

@Injectable()
export class HereRoutesClientService {
  private readonly logger = new Logger(HereRoutesClientService.name);
  public readonly enabled = false; // Desactivado tal como se solicitó

  constructor(private readonly configService: ConfigService) {}

  async calculateRouteWithSpeedLimits(
    coordinates: { lat: number; lng: number }[],
    travelMode: 'Car' | 'Truck',
  ): Promise<CalculatedRouteResult | null> {
    // Retorna null de inmediato ya que está desactivado, para forzar el uso del fallback
    return null;
  }

  resetSuspension() {
    // No-op
  }
}
