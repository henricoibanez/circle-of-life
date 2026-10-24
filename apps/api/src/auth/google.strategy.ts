import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import type { Env } from '../config/env';

/** Dados que aproveitamos da conta Google. */
export type GoogleIdentity = { googleId: string; email: string; emailVerified: boolean; name: string };

/**
 * Login com Google (Passport). Só é registrada quando GOOGLE_CLIENT_ID e
 * GOOGLE_CLIENT_SECRET existem (veja auth.module.ts).
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<Env, true>) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${config.get('WEB_URL')}/api/auth/google/callback`,
      scope: ['openid', 'email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleIdentity {
    const email = profile.emails?.[0];
    return {
      googleId: profile.id,
      email: (email?.value ?? '').toLowerCase(),
      emailVerified: email?.verified === true || (profile._json as { email_verified?: boolean }).email_verified === true,
      name: profile.displayName || email?.value.split('@')[0] || 'Sem nome',
    };
  }
}

export const isGoogleConfigured = (config: ConfigService<Env, true>) =>
  Boolean(config.get('GOOGLE_CLIENT_ID') && config.get('GOOGLE_CLIENT_SECRET'));
