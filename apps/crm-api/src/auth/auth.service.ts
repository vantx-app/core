import * as bcrypt from 'bcrypt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { UserWithoutPassword } from 'src/users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';
import { SessionService } from 'src/session/session.service';
import { Metadata } from 'src/session/types';
import { RefreshTokenPayload } from './types';
import { decode } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithoutPassword | undefined> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) return;
    const { password: hashedPassword, ...userWithoutPassword } = user;
    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) return;

    return userWithoutPassword;
  }

  async login(user: UserWithoutPassword, metadata: Metadata) {
    const session = await this.sessionService.create(user.id, metadata);
    const jwtPayload = {
      sub: user.id,
      role: user.role,
      orgId: user.orgId ?? null,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateJwtToken(jwtPayload, '15m'),
      this.generateJwtToken({ ...jwtPayload, sessionId: session.id }, '7d'),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, metadata: Metadata) {
    // 1. Validación estricta
    const payload = await this.verifyJwtToken(refreshToken);
    const session = await this.sessionService.validate(payload.sessionId);

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // 2. Extender la vida de la sesión en la base de datos (CRÍTICO)
    // Sincroniza la expiración real en Postgres con los 7 días del nuevo JWT.
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: metadata.ip, // Rastreo pasivo, útil para auditorías de seguridad
        userAgent: metadata.userAgent,
      },
    });

    const jwtPayload = {
      sub: user.id,
      role: user.role,
      orgId: user.orgId,
    };

    // 3. Generación en paralelo y retorno estructurado
    const [accessToken, newRefreshToken] = await Promise.all([
      this.generateJwtToken(jwtPayload, '15m'),
      this.generateJwtToken({ ...jwtPayload, sessionId: session.id }, '7d'),
    ]);

    // Retornar un objeto es más robusto para el controlador que depender de los índices de un array
    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    const payload = decode(refreshToken) as RefreshTokenPayload | null;
    if (payload?.sessionId) {
      await this.sessionService.revoke(payload.sessionId);
    }
  }

  // PRIVATE METHODS
  private async generateJwtToken(
    payload: Record<string, string | null>,
    expiresIn: string,
  ): Promise<string> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    return this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: expiresIn as any,
    });
  }

  private async verifyJwtToken(refreshToken: string) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: jwtSecret,
        },
      );
      return payload;
    } catch (error) {
      throw new UnauthorizedException(
        'Token de actualización inválido o expirado',
      );
    }
  }
}
