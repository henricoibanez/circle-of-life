import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { hashInviteToken, inviteStatus } from '../invites/invite-token';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueHandle } from '../users/handle';
import type { GoogleIdentity } from './google.strategy';

/** Motivos de recusa do login, mostrados em português na tela de login. */
export type LoginError = 'email-nao-verificado' | 'sem-convite' | 'convite-outro-email';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Decide se uma conta Google pode entrar:
   * 1. já tem conta (pelo Google ou pelo e-mail) → entra;
   * 2. não tem conta, mas tem convite válido para aquele e-mail → conta criada;
   * 3. senão → recusado ("acesso só por convite").
   */
  async loginWithGoogle(google: GoogleIdentity, inviteToken?: string): Promise<{ user: User } | { error: LoginError }> {
    if (!google.emailVerified || !google.email) return { error: 'email-nao-verificado' };

    const byGoogle = await this.prisma.user.findUnique({ where: { googleId: google.googleId } });
    if (byGoogle) return { user: byGoogle };

    const byEmail = await this.prisma.user.findUnique({ where: { email: google.email } });
    if (byEmail) {
      const user = byEmail.googleId
        ? byEmail
        : await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId: google.googleId } });
      return { user };
    }

    // Convite aberto pelo link: tem que ser para o mesmo e-mail da conta Google.
    if (inviteToken) {
      const invite = await this.prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(inviteToken) } });
      if (invite && invite.email !== google.email && inviteStatus(invite) === 'pendente') return { error: 'convite-outro-email' };
    }

    const invites = await this.prisma.invite.findMany({ where: { email: google.email, acceptedAt: null } });
    const valid = invites.filter(i => inviteStatus(i) === 'pendente');
    if (!valid.length && this.config.get('SIGNUP_MODE') === 'invite') return { error: 'sem-convite' };

    const handle = await uniqueHandle(google.name, google.email, async h =>
      Boolean(await this.prisma.user.findUnique({ where: { handle: h }, select: { id: true } })),
    );
    const user = await this.prisma.$transaction(async tx => {
      const created = await tx.user.create({
        data: { email: google.email, googleId: google.googleId, name: google.name, handle },
      });
      // Todos os convites pendentes para o e-mail ficam como aceitos por esta conta.
      await tx.invite.updateMany({
        where: { id: { in: valid.map(i => i.id) } },
        data: { acceptedAt: new Date(), acceptedUserId: created.id },
      });
      return created;
    });
    return { user };
  }
}
