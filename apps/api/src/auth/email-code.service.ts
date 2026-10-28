import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { EmailCodePurpose, Prisma } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashEmailCode, newEmailCode } from './password';

const VALID_MS = 15 * 60_000;
const COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

const TEXTS: Record<EmailCodePurpose, { subject: string; title: string; intro: string }> = {
  cadastro: {
    subject: 'Seu código para criar a conta',
    title: 'Confirme o seu e-mail',
    intro: 'Digite este código no app para terminar de criar a sua conta no Circle of Life.',
  },
  senha: {
    subject: 'Seu código para criar uma senha nova',
    title: 'Crie uma senha nova',
    intro: 'Digite este código no app para criar uma senha nova.',
  },
};

/**
 * Códigos de 6 números enviados por e-mail (cadastro e "esqueci minha senha").
 * O banco guarda só o resumo do código. Vale 15 minutos e 5 tentativas;
 * pedir outro só depois de 1 minuto, e o novo cancela o anterior.
 */
@Injectable()
export class EmailCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  get enabled() {
    return this.mail.enabled;
  }

  ensureEnabled() {
    if (!this.mail.enabled) throw new ServiceUnavailableException('O envio de e-mails ainda não está ligado. Entre com o Google.');
  }

  async send(email: string, purpose: EmailCodePurpose, data?: Prisma.InputJsonValue) {
    this.ensureEnabled();
    const last = await this.prisma.emailCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } });
    if (last && Date.now() - last.createdAt.getTime() < COOLDOWN_MS) {
      throw new HttpException('Espere um minuto para pedir outro código.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = newEmailCode();
    await this.prisma.$transaction([
      this.prisma.emailCode.deleteMany({ where: { email, purpose } }),
      this.prisma.emailCode.create({ data: { email, purpose, codeHash: hashEmailCode(code), data, expiresAt: new Date(Date.now() + VALID_MS) } }),
    ]);
    const t = TEXTS[purpose];
    await this.mail.send({
      to: email,
      subject: `${code} · ${t.subject}`,
      title: t.title,
      paragraphs: [t.intro, 'O código vale por 15 minutos.', 'Se não foi você que pediu, ignore este e-mail.'],
      code,
    });
  }

  /** Confere o código. Certo: apaga e devolve os dados guardados com ele. */
  async consume(email: string, purpose: EmailCodePurpose, code: string) {
    const row = await this.prisma.emailCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } });
    if (!row || row.expiresAt <= new Date()) throw new BadRequestException('Esse código expirou. Peça um novo.');
    if (row.attempts >= MAX_ATTEMPTS) throw new BadRequestException('Muitas tentativas erradas. Peça um novo código.');
    const ok = timingSafeEqual(Buffer.from(hashEmailCode(code.trim())), Buffer.from(row.codeHash));
    if (!ok) {
      await this.prisma.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Código incorreto. Confira o e-mail e tente de novo.');
    }
    await this.prisma.emailCode.deleteMany({ where: { email, purpose } });
    return row.data;
  }
}
