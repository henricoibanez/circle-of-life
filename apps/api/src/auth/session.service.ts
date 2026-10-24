import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env';

/** Nome do cookie de sessão. */
export const SESSION_COOKIE = 'col_session';

export type SessionPayload = { sub: string };

/**
 * Cria e apaga a sessão: um JWT guardado num cookie httpOnly (o JavaScript
 * da página não consegue ler, o que protege contra roubo de sessão).
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Opções comuns a todos os cookies da API. */
  cookieOptions(maxAgeMs?: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      // Em produção o site é https e o cookie só viaja por conexão segura.
      secure: this.config.get('WEB_URL').startsWith('https://'),
      path: '/',
      domain: this.config.get('COOKIE_DOMAIN') || undefined,
      maxAge: maxAgeMs,
    };
  }

  async start(res: Response, userId: string) {
    const days = this.config.get('SESSION_DAYS');
    const token = await this.jwt.signAsync({ sub: userId } satisfies SessionPayload, { expiresIn: `${days}d` });
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(days * 24 * 3600 * 1000));
  }

  end(res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }
}
