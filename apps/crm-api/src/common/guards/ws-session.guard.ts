/* eslint-disable @typescript-eslint/no-unused-vars */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as cookie from 'cookie';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedSocket } from '../types';

@Injectable()
export class WsSessionGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: AuthenticatedSocket = context.switchToWs().getClient();
    const rawCookies = client.handshake.headers.cookie;

    if (!rawCookies) return false;

    const cookies = cookie.parse(rawCookies);
    const token = cookies['Authentication']; // TODO: check name

    if (!token) return false;

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.user = payload;
      return true;
    } catch (error) {
      return false;
    }
  }
}
