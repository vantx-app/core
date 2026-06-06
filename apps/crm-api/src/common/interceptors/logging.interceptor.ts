import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LoggingInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const { method, url } = request;
    const ip =
      request.ip || request.headers['x-forwarded-for'] || 'Desconocido';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const userIdentifier = request.user?.sub || 'Invitado';

        this.logger.log(
          `[HTTP] ${method} ${url} - Estado: ${statusCode} - IP: ${ip} - Usuario: ${userIdentifier} - Duración: ${duration}ms`,
        );
      }),
    );
  }
}
