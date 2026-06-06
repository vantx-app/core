import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { method, url } = request;
    const ip =
      request.ip || request.headers['x-forwarded-for'] || 'Desconocido';
    const userIdentifier = (request as any).user?.sub || 'Invitado';

    let rawMessage = 'Error interno del servidor';
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        rawMessage = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const resMessage = (exceptionResponse as any).message;
        rawMessage = Array.isArray(resMessage)
          ? resMessage.join(', ')
          : resMessage || exception.message;
      } else {
        rawMessage = exception.message;
      }
    } else if (exception instanceof Error) {
      rawMessage = exception.message;
    }

    const logMessage = `[ERROR] [HTTP] ${method} ${url} - Estado: ${status} - IP: ${ip} - Usuario: ${userIdentifier} - Mensaje: ${rawMessage}`;

    if (status >= 500) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(logMessage);
    }

    // Para errores 500, no exponemos detalles internos al cliente por seguridad
    const clientMessage =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Ocurrió un error interno en el servidor. Por favor, intente de nuevo más tarde.'
        : rawMessage;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: url,
      message: clientMessage,
    });
  }
}
