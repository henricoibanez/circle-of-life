import { Controller, Delete, Get, Global, HttpCode, Module, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Response } from 'express';
import { CurrentUser, Public } from '../common/decorators';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { CalendarService } from './calendar.service';

@Controller('calendar')
class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Leva a pessoa para a tela do Google autorizar o acesso à agenda. */
  @Get('google')
  async connect(@CurrentUser() u: User, @Res() res: Response) {
    res.redirect(await this.calendar.authUrl(u));
  }

  /** O Google devolve a pessoa para cá; guardamos a conexão e voltamos ao perfil. */
  @Public()
  @Get('google/callback')
  async callback(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string) {
    const web = this.config.get('WEB_URL');
    try {
      if (!code || !state) throw new Error('faltou dado');
      await this.calendar.handleCallback(code, state);
      res.redirect(`${web}/perfil?agenda=ok`);
    } catch {
      res.redirect(`${web}/perfil?agenda=erro`);
    }
  }

  /** "Agora não" na sugestão de conectar a agenda (volta depois de alguns dias). */
  @Post('ask/dismiss')
  @HttpCode(204)
  dismissAsk(@CurrentUser() u: User) {
    return this.calendar.dismissAsk(u.id);
  }

  /** Desconectar a Google Agenda. */
  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() u: User) {
    return this.calendar.disconnect(u);
  }
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({ secret: config.get('JWT_SECRET') }),
    }),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
