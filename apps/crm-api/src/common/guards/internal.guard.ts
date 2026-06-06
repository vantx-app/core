import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from 'src/auth/types';

@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const ingestorSecret = this.configService.get<string>('INGESTOR_SECRET');
    const request: AuthenticatedRequest = context.switchToHttp().getRequest();
    const authHeader = request.headers['x-internal-secret'];

    if (authHeader !== ingestorSecret) {
      throw new UnauthorizedException('Invalid Internal Secret');
    }

    return true;
  }
}
