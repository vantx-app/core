/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { TelemetryGateway } from './telemetry.gateway';
import { Public } from 'src/common/decorators/public.decorator';
import { InternalGuard } from 'src/common/guards/internal.guard';
import { RequiresSubscription } from 'src/common/decorators/requires-subscription.decorator';

@RequiresSubscription()
@Controller('internal')
export class TelemetryController {
  private readonly logger = new Logger('TelemetryController');

  // Inject the Gateway so we can trigger the WebSocket emission
  constructor(private readonly telemetryGateway: TelemetryGateway) {}

  @Public()
  @UseGuards(InternalGuard)
  @Post('telemetry')
  @HttpCode(200)
  receiveTelemetryUpdate(@Body() payload: any) {
    this.logger.log(
      `📥 Coordenada recibida para el vehículo: ${payload.vehicleAlias}`,
    );

    // Push the payload to all connected Next.js browsers
    this.telemetryGateway.broadcastToClients(payload);

    return { success: true };
  }
}
