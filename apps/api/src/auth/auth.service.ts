import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { hashInviteToken, inviteStatus, normalizeEmail } from '../invites/invite-token';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueHandle } from '../users/handle';
import { EmailCodeService } from './email-code.service';
import type { GoogleIdentity } from './google.strategy';
import { checkPassword, hashPassword } from './password';
import { RateLimitService } from './rate-limit.service';

/** Motivos de recusa do login, mostrados em português na tela de login. */
export type LoginError = 'email-nao-verificado' | 'sem-convite' | 'convite-outro-email';

const NO_INVITE = 'O Circle of Life está em fase de testes e o acesso é só por convite. Peça um convite a um administrador.';

/** Dados do cadastro guardados junto com o código, até o e-mail ser confirmado. */
type PendingSignup = { name: string; passwordHash: string; termsAcceptedAt: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly codes: EmailCodeService,
    private readonly rate: RateLimitService,
  ) {}

  private isAdminEmail(email: string) {
    return this.config.get('ADMIN_EMAILS').includes(email.toLowerCase());
  }

  private promote(u: User) {
    return this.isAdminEmail(u.email) && u.role !== 'admin' ? this.prisma.user.update({ where: { id: u.id }, data: { role: 'admin' } }) : u;
  }

  /** Quem ainda não tem conta pode criar uma? (convite válido, e-mail de admin ou cadastro aberto) */
  private async access(email: string) {
    const invites = await this.prisma.invite.findMany({ where: { email, acceptedAt: null } });
    const valid = invites.filter(i => inviteStatus(i) === 'pendente');
    const allowed = valid.length > 0 || this.isAdminEmail(email) || this.config.get('SIGNUP_MODE') === 'open';
    return { valid, allowed };
  }

  /**
   * Cria a conta e marca como aceitos os convites pendentes para o e-mail.
   * Toda conta nova, admins inclusive, começa pela Jornada (decisão do dono de 05/11/2026).
   */
  private async register(data: { email: string; name: string; googleId?: string; passwordHash?: string; termsAcceptedAt?: Date }, inviteIds: string[]) {
    const handle = await uniqueHandle(data.name, data.email, async h =>
      Boolean(await this.prisma.user.findUnique({ where: { handle: h }, select: { id: true } })),
    );
    return this.prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { ...data, handle, journey: true, role: this.isAdminEmail(data.email) ? 'admin' : 'member' } });
      await tx.invite.updateMany({ where: { id: { in: inviteIds } }, data: { acceptedAt: new Date(), acceptedUserId: created.id } });
      return created;
    });
  }

  /**
   * Decide se uma conta Google pode entrar:
   * 1. já tem conta (pelo Google ou pelo e-mail) → entra;
   * 2. não tem conta, mas tem convite válido para aquele e-mail → conta criada;
   * 3. senão → recusado ("acesso só por convite").
   * E-mails listados em ADMIN_EMAILS entram sem convite e viram administradores
   * (é assim que o primeiro administrador entra em produção).
   */
  async loginWithGoogle(google: GoogleIdentity, inviteToken?: string): Promise<{ user: User } | { error: LoginError }> {
    if (!google.emailVerified || !google.email) return { error: 'email-nao-verificado' };

    const byGoogle = await this.prisma.user.findUnique({ where: { googleId: google.googleId } });
    if (byGoogle) return { user: await this.promote(byGoogle) };

    const byEmail = await this.prisma.user.findUnique({ where: { email: google.email } });
    if (byEmail) {
      const user = byEmail.googleId
        ? byEmail
        : await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId: google.googleId } });
      return { user: await this.promote(user) };
    }

    // Convite aberto pelo link: tem que ser para o mesmo e-mail da conta Google.
    if (inviteToken) {
      const invite = await this.prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(inviteToken) } });
      if (invite && invite.email !== google.email && inviteStatus(invite) === 'pendente') return { error: 'convite-outro-email' };
    }

    const { valid, allowed } = await this.access(google.email);
    if (!allowed) return { error: 'sem-convite' };
    const user = await this.register({ email: google.email, googleId: google.googleId, name: google.name }, valid.map(i => i.id));
    return { user };
  }

  // ---------- E-mail e senha ----------

  /** 1º passo do cadastro: confere o convite e manda o código. A conta só nasce com o e-mail confirmado. */
  async signupStart(input: { name: string; email: string; password: string }) {
    const email = normalizeEmail(input.email);
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('Já existe uma conta com esse e-mail. Entre com a senha ou com o Google, ou use "Esqueci minha senha".');
    }
    if (!(await this.access(email)).allowed) throw new ForbiddenException(NO_INVITE);
    const data: PendingSignup = { name: input.name.trim(), passwordHash: await hashPassword(input.password), termsAcceptedAt: new Date().toISOString() };
    await this.codes.send(email, 'cadastro', data);
  }

  /** 2º passo do cadastro: código certo → conta criada. */
  async signupVerify(rawEmail: string, code: string) {
    const email = normalizeEmail(rawEmail);
    const data = (await this.codes.consume(email, 'cadastro', code)) as PendingSignup | null;
    if (!data) throw new ConflictException('Esse código não é de cadastro. Comece de novo.');
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException('Essa conta já foi criada. Entre com a senha.');
    const { valid, allowed } = await this.access(email);
    if (!allowed) throw new ForbiddenException(NO_INVITE);
    return this.register(
      { email, name: data.name, passwordHash: data.passwordHash, termsAcceptedAt: new Date(data.termsAcceptedAt) },
      valid.map(i => i.id),
    );
  }

  async loginWithPassword(rawEmail: string, password: string) {
    const email = normalizeEmail(rawEmail);
    // Trava a força bruta: até 10 tentativas por e-mail a cada 10 minutos.
    await this.rate.hit(`login:${email}`, 10, 10 * 60_000);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      throw new UnauthorizedException(
        user && !user.passwordHash ? 'Essa conta entra com o Google. Para usar senha, toque em "Esqueci minha senha".' : 'E-mail ou senha incorretos.',
      );
    }
    // Deu certo: zera o contador para não atrapalhar os próximos logins.
    await this.rate.clear(`login:${email}`);
    return this.promote(user);
  }

  /** "Esqueci minha senha": manda o código só se a conta existir (sem contar a quem pergunta). */
  async forgotPassword(rawEmail: string) {
    this.codes.ensureEnabled();
    const email = normalizeEmail(rawEmail);
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) await this.codes.send(email, 'senha');
  }

  /** Código certo → senha nova (também serve para quem só entrava com o Google criar uma senha). */
  async resetPassword(rawEmail: string, code: string, password: string) {
    const email = normalizeEmail(rawEmail);
    await this.codes.consume(email, 'senha', code);
    const user = await this.prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(password) } });
    return this.promote(user);
  }
}
