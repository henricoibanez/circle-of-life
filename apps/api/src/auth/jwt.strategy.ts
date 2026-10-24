import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_COOKIE, type SessionPayload } from './session.service';

/** Lê o cookie de sessão em cada pedido e carrega o usuário do banco. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? null,
      secretOrKey: config.get('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: SessionPayload) {
    // Buscar no banco a cada pedido garante que uma conta excluída perde o acesso na hora.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Sessão inválida. Entre de novo.');
    return user;
  }
}
