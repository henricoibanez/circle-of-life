import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import type { Env } from '../config/env';
import { AuthService } from './auth.service';
import { GoogleAuthGuard, type OAuthRequest } from './google-auth.guard';
import type { GoogleIdentity } from './google.strategy';
import { SessionService } from './session.service';

/** Rotas do login com Google (ativas só quando há credenciais configuradas). */
@Controller('auth')
export class GoogleAuthController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly auth: AuthService,
    private readonly session: SessionService,
  ) {}

  /** Vai para a tela de escolha de conta do Google. Aceita ?invite=código. */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google() {
    // O GoogleAuthGuard já redirecionou para o Google.
  }

  /** O Google devolve a pessoa para cá depois que ela escolhe a conta. */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async callback(@Req() req: OAuthRequest, @Res() res: Response) {
    const web = this.config.get('WEB_URL');
    if (req.authError || !req.user) return res.redirect(`${web}/login?erro=${req.authError ?? 'google-falhou'}`);

    const result = await this.auth.loginWithGoogle(req.user as GoogleIdentity, req.oauthState?.invite);
    if ('error' in result) return res.redirect(`${web}/login?erro=${result.error}`);

    await this.session.start(res, result.user.id);
    return res.redirect(`${web}/`);
  }
}

/** Sem credenciais do Google: o botão leva de volta ao login com um aviso. */
@Controller('auth')
export class GoogleUnavailableController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Public()
  @Get(['google', 'google/callback'])
  unavailable(@Res() res: Response) {
    res.redirect(`${this.config.get('WEB_URL')}/login?erro=google-indisponivel`);
  }
}
