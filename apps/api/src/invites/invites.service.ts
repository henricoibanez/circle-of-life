import { BadGatewayException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashInviteToken, inviteStatus, newInviteToken, normalizeEmail } from './invite-token';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list() {
    const invites = await this.prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { name: true } }, acceptedUser: { select: { name: true } } },
    });
    return invites.map(i => ({
      id: i.id,
      email: i.email,
      status: inviteStatus(i),
      convidadoPor: i.invitedBy.name,
      aceitoPor: i.acceptedUser?.name ?? null,
      criadoEm: i.createdAt,
      expiraEm: i.expiresAt,
      aceitoEm: i.acceptedAt,
    }));
  }

  async create(rawEmail: string, admin: User) {
    const email = normalizeEmail(rawEmail);
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Essa pessoa já tem conta no app.');
    }
    const pending = await this.prisma.invite.findMany({ where: { email, acceptedAt: null } });
    if (pending.some(i => inviteStatus(i) === 'pendente')) {
      throw new ConflictException('Já existe um convite pendente para esse e-mail. Use "Reenviar".');
    }
    const token = newInviteToken();
    const invite = await this.prisma.invite.create({
      data: { email, tokenHash: hashInviteToken(token), invitedById: admin.id, expiresAt: this.expiry() },
    });
    try {
      await this.sendEmail(email, token, admin.name);
    } catch {
      await this.prisma.invite.delete({ where: { id: invite.id } });
      throw new BadGatewayException('Não foi possível enviar o e-mail do convite. Tente de novo em instantes.');
    }
    return { id: invite.id, email };
  }

  /** Gera um código novo (o anterior deixa de valer), renova a validade e reenvia. */
  async resend(id: string, admin: User) {
    const invite = await this.prisma.invite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Convite não encontrado.');
    if (invite.acceptedAt) throw new ConflictException('Esse convite já foi aceito.');
    const token = newInviteToken();
    await this.prisma.invite.update({ where: { id }, data: { tokenHash: hashInviteToken(token), expiresAt: this.expiry() } });
    try {
      await this.sendEmail(invite.email, token, admin.name);
    } catch {
      throw new BadGatewayException('Não foi possível enviar o e-mail do convite. Tente de novo em instantes.');
    }
  }

  async cancel(id: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Convite não encontrado.');
    if (invite.acceptedAt) throw new ConflictException('Esse convite já foi aceito e não pode ser cancelado.');
    await this.prisma.invite.delete({ where: { id } });
  }

  /** Usado pela tela pública do convite: para qual e-mail é e se ainda vale. */
  async check(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(token) } });
    if (!invite) throw new NotFoundException('Convite não encontrado. Peça um novo a quem te convidou.');
    return { email: invite.email, status: inviteStatus(invite) };
  }

  private expiry() {
    return new Date(Date.now() + this.config.get('INVITE_DAYS') * 24 * 3600 * 1000);
  }

  private sendEmail(email: string, token: string, adminName: string) {
    const days = this.config.get('INVITE_DAYS');
    return this.mail.send({
      to: email,
      subject: 'Seu convite para o Circle of Life',
      title: 'Você foi convidado para o Circle of Life',
      paragraphs: [
        `${adminName} convidou você para usar o Circle of Life, o app do Sprint da Vida.`,
        `Para entrar, use a conta Google deste e-mail (${email}). O convite vale por ${days} dias.`,
      ],
      button: { label: 'Aceitar convite', url: `${this.config.get('WEB_URL')}/convite/${token}` },
    });
  }
}
