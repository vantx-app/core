import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HereClientService {
  private readonly logger = new Logger(HereClientService.name);
  private consecutiveErrors = 0;
  private isSuspended = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Envía una secuencia de coordenadas GPS al servicio de Route Matching de HERE API.
   * Retorna los tracePoints y RouteLinks mapeados.
   */
  async matchRoute(
    csvContent: string,
    mode = 'fastest;car',
    attributes = 'SPEED_LIMITS_FCn(*)',
  ): Promise<{ tracePoints: any[]; RouteLinks: any[] } | null> {
    if (this.isSuspended) {
      return null;
    }

    const apiKey = this.configService.get<string>('HERE_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'HERE_API_KEY no configurada en las variables de entorno.',
      );
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          `https://routematching.hereapi.com/v8/match/routelinks`,
          csvContent,
          {
            params: {
              routeMatch: 1,
              mode,
              attributes,
              apikey: apiKey,
            },
            headers: {
              'Content-Type': 'text/plain',
            },
            timeout: 10000, // 10 segundos de límite
          },
        ),
      );

      this.consecutiveErrors = 0; // Resetear contador al tener éxito
      const data = response.data;
      if (!data || !data.tracePoints) {
        this.logger.warn('La respuesta de HERE API no contiene tracePoints.');
        return null;
      }

      return {
        tracePoints: data.tracePoints,
        RouteLinks: data.RouteLinks || [],
      };
    } catch (error: any) {
      this.consecutiveErrors++;
      this.logger.error(
        `Error al llamar a HERE Route Matching API (#${this.consecutiveErrors}): ${error.message}`,
      );

      if (this.consecutiveErrors >= 3) {
        this.isSuspended = true;
        this.logger.error(
          'Se suspenden temporalmente las llamadas a la API de HERE por exceso de errores consecutivos. Usando fallback simple.',
        );
      }
      return null;
    }
  }

  /**
   * Reinicia la suspensión del cliente (por ejemplo, al iniciar un nuevo cron run).
   */
  resetSuspension() {
    this.isSuspended = false;
    this.consecutiveErrors = 0;
  }
}
