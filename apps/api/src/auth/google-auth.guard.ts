import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { SessionService } from './session.service';

/** Cookie temporário que protege a ida e volta ao Google contra falsificação. */
const STATE_COOKIE = 'col_oauth_state';

type State = { n: string; invite?: string };

/** Pedido com o resultado da ida ao Google (preenchido por esta guarda). */
export type OAuthRequest = Request & { authError?: string; oauthState?: State };

const encode = (s: State) => Buffer.from(JSON.stringify(s)).toString('base64url');
export function decodeState(raw: unknown): State | null {
  try {
    return JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8')) as State;
  } catch {
    return null;
  }
}

/**
 * Guarda das rotas do Google.
 * - Na ida (/auth/google): cria um número aleatório, guarda num cookie e
 *   envia junto ao Google (parâmetro "state"), com o convite, se houver.
 * - Na volta (/auth/google/callback): confere se o número voltou igual.
 *   Se não voltou, o pedido não veio do nosso site e é recusado.
 * Erros (ex.: a pessoa cancelou no Google) não estouram: o controller decide.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly session: SessionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OAuthRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.path.endsWith('/callback')) {
      const state = decodeState(req.query.state);
      const expected = req.cookies?.[STATE_COOKIE] as string | undefined;
      res.clearCookie(STATE_COOKIE, this.session.cookieOptions());
      if (!state?.n || !expected || !safeEqual(state.n, expected)) {
        req.authError = 'estado-invalido';
        return true;
      }
      req.oauthState = state;
    }
    try {
      await super.canActivate(context);
    } catch {
      req.authError ??= 'google-falhou';
    }
    return true;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<OAuthRequest>();
    if (req.path.endsWith('/callback')) return {};
    const nonce = randomBytes(16).toString('base64url');
    context.switchToHttp().getResponse<Response>().cookie(STATE_COOKIE, nonce, this.session.cookieOptions(10 * 60 * 1000));
    const invite = typeof req.query.invite === 'string' ? req.query.invite : undefined;
    return { state: encode({ n: nonce, invite }), prompt: 'select_account' };
  }

  handleRequest<T>(err: unknown, user: T, _info: unknown, context: ExecutionContext): T {
    const req = context.switchToHttp().getRequest<OAuthRequest>();
    if (err || !user) req.authError ??= 'google-falhou';
    return user;
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

