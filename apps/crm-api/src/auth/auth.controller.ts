import {
  Controller,
  UseGuards,
  Post,
  Req,
  Res,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../common/guards/local-auth.guard';
import { AuthenticatedRequest } from './types';
import { Request, Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { TIME_TO_LIVE_IN_MS } from 'src/common/constants';
import { getCookieSettings } from '@vantx/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ip, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
      {
        ip,
        userAgent,
      },
    );

    res.cookie(
      'refresh_token',
      refreshToken,
      getCookieSettings(TIME_TO_LIVE_IN_MS),
    );
    return { accessToken };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Extraer IP real detrás de Nginx
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip =
      typeof forwardedFor === 'string' ? forwardedFor.split(',')[0] : req.ip;

    const userAgent = req.headers['user-agent'] || 'unknown';

    const refreshToken = (req.cookies as Record<string, string>)[
      'refresh_token'
    ];

    if (!refreshToken) {
      // Si no hay token, nos aseguramos de que no haya cookies residuales
      res.clearCookie('refresh_token', getCookieSettings(0));
      throw new UnauthorizedException('No refresh token provided');
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refresh(refreshToken, { ip, userAgent });

      // 2. Inyección exitosa del nuevo token
      res.cookie(
        'refresh_token',
        newRefreshToken,
        getCookieSettings(TIME_TO_LIVE_IN_MS),
      );
      return { accessToken };
    } catch (error) {
      // 3. CIRCUIT BREAKER: Si la validación falla (revocada/expirada), matamos la cookie
      res.clearCookie('refresh_token', getCookieSettings(0));

      // Re-lanzamos el error para que Axios/Next.js reciban el 401/403 correctamente
      throw error;
    }
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)[
      'refresh_token'
    ];

    await this.authService.logout(refreshToken);
    res.clearCookie('refresh_token', getCookieSettings(0));
    res.clearCookie('access_token', getCookieSettings(0));
    return { message: 'Logged out successfully' };
  }
}
