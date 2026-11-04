import { sprintName } from '@circle/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import webpush from 'web-push';
import type { Env } from '../config/env';
import type { NotificationType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link: string;
  actorId?: string | null;
  refId?: string | null;
};

/** Notificações com mais de 90 dias são apagadas automaticamente. */
const KEEP_DAYS = 90;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  readonly pushEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    const pub = config.get('VAPID_PUBLIC_KEY');
    const priv = config.get('VAPID_PRIVATE_KEY');
    this.pushEnabled = Boolean(pub && priv);
    if (this.pushEnabled) webpush.setVapidDetails(config.get('VAPID_SUBJECT'), pub, priv);
  }

  get publicKey() {
    return this.pushEnabled ? this.config.get('VAPID_PUBLIC_KEY') : null;
  }

  /**
   * Cria a notificação do sino e, se a pessoa ativou, manda para o celular.
   * Ninguém recebe notificação das próprias ações.
   */
  async notify(n: NotifyInput, tx: Tx = this.prisma) {
    if (n.actorId && n.actorId === n.userId) return null;
    const created = await tx.notification.create({
      data: { userId: n.userId, type: n.type, title: n.title, body: n.body ?? '', link: n.link, actorId: n.actorId ?? null, refId: n.refId ?? null },
    });
    void this.push(n.userId, { title: n.title, body: n.body ?? '', link: n.link });
    return created;
  }

  /** Envio ao celular. Aparelhos que não aceitam mais (inscrição expirada) são descartados. */
  async push(userId: string, payload: { title: string; body: string; link: string }) {
    if (!this.pushEnabled) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        else this.logger.warn(`Falha ao enviar push: ${(e as Error).message}`);
      }
    }
  }

  // ---------- Sino ----------

  async list(userId: string, take = 50) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { name: true, photoFileId: true } } },
    });
    return items.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      actorName: n.actor?.name ?? null,
      read: Boolean(n.readAt),
      createdAt: n.createdAt.toISOString(),
    }));
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async setRead(userId: string, id: string, read: boolean) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: read ? new Date() : null } });
  }

  async readAll(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  async remove(userId: string, id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async clear(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
  }

  // ---------- Push: aparelhos ----------

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  // ---------- Tarefas atrasadas ----------

  /** Roda a cada hora: avisa uma vez por tarefa, no dia seguinte ao prazo, a partir da hora configurada. */
  @Cron(CronExpression.EVERY_HOUR)
  async hourly() {
    try {
      const n = await this.checkOverdue();
      if (n) this.logger.log(`${n} avisos de tarefa atrasada enviados`);
      const s = await this.checkSprintDeadlines();
      if (s) this.logger.log(`${s} avisos de prazo de sprint enviados`);
      await this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86400000) } } });
    } catch (e) {
      this.logger.error(`Falha na verificação de atrasadas: ${(e as Error).message}`);
    }
  }

  /** Verifica as tarefas atrasadas de todo mundo. Devolve quantos avisos saíram. */
  async checkOverdue(now = new Date()) {
    const hour = this.config.get('OVERDUE_HOUR');
    const tasks = await this.prisma.task.findMany({
      where: { status: { not: 'done' }, archivedAt: null, dueDate: { not: null }, overdueNotifiedAt: null },
      include: { user: { select: { timezone: true } } },
    });
    let sent = 0;
    for (const t of tasks) {
      const tz = t.user.timezone;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
      const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now));
      const due = t.dueDate!.toISOString().slice(0, 10);
      if (due >= today || localHour < hour) continue;
      await this.prisma.$transaction(async tx => {
        await tx.task.update({ where: { id: t.id }, data: { overdueNotifiedAt: now } });
        await this.notify({ userId: t.userId, type: 'tarefa_atrasada', title: 'Tarefa atrasada', body: `“${t.title}” passou do prazo.`, link: '/board', refId: t.id }, tx);
      });
      sent++;
    }
    return sent;
  }

  /**
   * Prazo da sprint vencido: avisa uma vez por sprint, no dia seguinte ao fim
   * previsto, a partir da mesma hora das atrasadas. A sprint não é encerrada
   * sozinha (decisão do dono): a pessoa encerra quando quiser.
   */
  async checkSprintDeadlines(now = new Date()) {
    const hour = this.config.get('OVERDUE_HOUR');
    const sprints = await this.prisma.sprint.findMany({
      where: { startAt: { not: null }, closedAt: null, plannedEnd: { not: null, lt: now }, deadlineNotifiedAt: null },
      include: { user: { select: { timezone: true } } },
    });
    let sent = 0;
    for (const s of sprints) {
      const tz = s.user.timezone;
      const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
      const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now));
      if (day(s.plannedEnd!) >= day(now) || localHour < hour) continue;
      const name = sprintName(s);
      await this.prisma.$transaction(async tx => {
        await tx.sprint.update({ where: { id: s.id }, data: { deadlineNotifiedAt: now } });
        await this.notify(
          { userId: s.userId, type: 'sprint_prazo', title: 'O prazo da sprint terminou', body: `A ${name} chegou ao fim do prazo. Encerre quando estiver pronto.`, link: '/board', refId: s.id },
          tx,
        );
      });
      sent++;
    }
    return sent;
  }
}
