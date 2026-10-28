import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../config/env';
import { AuthController } from './auth.controller';
import { SessionGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { EmailCodeService } from './email-code.service';
import { GoogleAuthController, GoogleUnavailableController } from './google.controller';
import { GoogleAuthGuard } from './google-auth.guard';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { SessionService } from './session.service';

const googleOn = (env: NodeJS.ProcessEnv) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Núcleo da sessão: cookie, JWT e a guarda global que exige login. */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({ secret: config.get('JWT_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailCodeService, SessionService, JwtStrategy, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService, SessionService],
})
export class SessionModule {}

@Module({
  imports: [SessionModule],
  controllers: [GoogleAuthController],
  providers: [GoogleStrategy, GoogleAuthGuard],
})
export class GoogleLoginModule {}

@Module({ controllers: [GoogleUnavailableController] })
export class GoogleUnavailableModule {}

/** Login completo: sessão + Google (ou o aviso de Google indisponível). */
@Module({
  imports: [
    SessionModule,
    ConditionalModule.registerWhen(GoogleLoginModule, googleOn, { debug: false }),
    ConditionalModule.registerWhen(GoogleUnavailableModule, env => !googleOn(env), { debug: false }),
  ],
  exports: [SessionModule],
})
export class AuthModule {}
