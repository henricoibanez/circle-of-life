import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';

export type Mail = { to: string; subject: string; title: string; paragraphs: string[]; button?: { label: string; url: string }; code?: string };

/**
 * Envio de e-mails por SMTP (Mailpit localmente). Todos os e-mails usam o
 * mesmo modelo simples: título, parágrafos e um botão opcional.
 * Sem SMTP_HOST, o envio fica desligado: send() não faz nada e devolve false.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const user = config.get('SMTP_USER');
    this.from = config.get('SMTP_FROM');
    const host = config.get('SMTP_HOST');
    this.transport = host
      ? createTransport({
          host,
          port: config.get('SMTP_PORT'),
          secure: config.get('SMTP_PORT') === 465,
          auth: user ? { user, pass: config.get('SMTP_PASS') } : undefined,
        })
      : null;
  }

  get enabled() {
    return this.transport !== null;
  }

  /** Envia o e-mail. Devolve false quando o envio de e-mails está desligado. */
  async send(mail: Mail) {
    if (!this.transport) {
      this.logger.log(`E-mail desligado: "${mail.subject}" para ${mail.to} não foi enviado`);
      return false;
    }
    await this.transport.sendMail({
      from: this.from,
      to: mail.to,
      subject: mail.subject,
      text: [mail.title, ...(mail.code ? [mail.code] : []), ...mail.paragraphs, mail.button ? `${mail.button.label}: ${mail.button.url}` : ''].join('\n\n'),
      html: renderHtml(mail),
    });
    this.logger.log(`E-mail "${mail.subject}" enviado para ${mail.to}`);
    return true;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Modelo visual dos e-mails (cores do tema Natureza do protótipo). */
function renderHtml({ title, paragraphs, button, code }: Mail) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fafaf7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#181c16">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e9ebe4;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 20px;font-size:20px"><b style="color:#5e873c">Circle</b> <span style="color:#6e746a">of</span> <b style="color:#5e873c">Life</b></p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
${paragraphs
  .slice(0, 1)
  .map(p => `<p style="margin:0 0 12px;line-height:1.6;color:#3a4036">${esc(p)}</p>`)
  .join('')}
${code ? `<p style="margin:20px 0;padding:14px;border-radius:12px;background:#f1f3ec;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">${esc(code)}</p>` : ''}
${paragraphs
  .slice(1)
  .map(p => `<p style="margin:0 0 12px;line-height:1.6;color:#3a4036">${esc(p)}</p>`)
  .join('')}
${button ? `<p style="margin:24px 0 8px"><a href="${esc(button.url)}" style="display:inline-block;background:#5e873c;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${esc(button.label)}</a></p>` : ''}
</td></tr></table>
<p style="font-size:12px;color:#6e746a;margin-top:16px">Sprint da Vida · Circle of Life</p>
</td></tr></table></body></html>`;
}
