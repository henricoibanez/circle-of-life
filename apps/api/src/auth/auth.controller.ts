import { Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import type { Env } from '../config/env';
import { isGoogleConfigured } from './google.strategy';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly session: SessionService,
  ) {}

  /** Quais formas de entrar estão disponíveis (para a tela de login). */
  @Public()
  @Get('providers')
  providers() {
    return {
      google: isGoogleConfigured(this.config),
      dev: this.config.get('NODE_ENV') === 'development',
      convite: this.config.get('SIGNUP_MODE') === 'invite',
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    this.session.end(res);
  }
}
