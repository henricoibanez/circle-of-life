import {
  COUNTED_CATEGORIES,
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  inQuietHours,
  NOTIFICATION_VOLUMES,
  notificationCategory,
  type NotificationPrefsDto,
  PUSH_ASK_AGAIN_DAYS,
  sprintName,
  type SurveyDto,
  TIPS_PER_DAY,
} from '@circle/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import type { Env } from '../config/env';
import type { NotificationType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type Tx = Prisma.TransactionClient;

/** Dia "AAAA-MM-DD" no fuso da pessoa. */
const dayKey = (tz: string, d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
/** Hora local (0 a 23) no fuso da pessoa. */
const localHour = (tz: string, d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d));
/** Segunda-feira da semana do dia (a semana vai de segunda a domingo). */
const mondayOf = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/** O registro dos avisos automáticos (para não repetir) fica 1 ano. */
const LOG_KEEP_DAYS = 365;
/** Épico parado: dias sem tarefa nova (ou criado há tantos dias sem nenhuma tarefa). */
const EPIC_IDLE_DAYS = 3;
/** "Épico concluído?" só volta depois de tantos dias. */
const EPIC_REPEAT_DAYS = 14;

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link: string;
  actorId?: string | null;
  refId?: string | null;
  /** Foto do aviso ("Lembra disso?"). */
  imageFileId?: string | null;
};

type PushPayload = { title: string; body: string; link: string; image?: string; tag?: string };

/** Notificações com mais de 90 dias são apagadas automaticamente. */
const KEEP_DAYS = 90;
/** Envio para muita gente (novidades, pesquisas) é feito em lotes deste tamanho. */
const BATCH = 200;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  readonly pushEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly storage: StorageService,
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
   * Aviso na hora (alguém curtiu, comentou, pediu amizade…): vai para o sino se a
   * categoria está ligada, e para o celular se também está ligada lá e fora do
   * horário de silêncio. Não conta no limite diário. Ninguém recebe aviso das próprias ações.
   */
  async notify(n: NotifyInput, tx: Tx = this.prisma) {
    if (n.actorId && n.actorId === n.userId) return null;
    const d = await this.delivery(n.userId, n.type);
    if (!d.bell) return null;
    const created = await tx.notification.create({
      data: { userId: n.userId, type: n.type, title: n.title, body: n.body ?? '', link: n.link, actorId: n.actorId ?? null, refId: n.refId ?? null },
    });
    if (d.push) void this.push(n.userId, { title: n.title, body: n.body ?? '', link: n.link });
    return created;
  }

  /**
   * Um aviso igual para muita gente (novidades, pesquisas), sem contar no limite diário.
   * Respeita a categoria desligada no sino e o horário de silêncio para o celular.
   * Com `key`, grava no registro (para não repetir). Devolve quantas pessoas receberam.
   */
  async broadcast(userIds: string[], n: Omit<NotifyInput, 'userId'> & { key?: string }, now = new Date()) {
    let sent = 0;
    for (let i = 0; i < userIds.length; i += BATCH) {
      const ids = userIds.slice(i, i + BATCH);
      const [prefs, users] = await Promise.all([
        this.prisma.notificationPrefs.findMany({ where: { userId: { in: ids } } }),
        this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, timezone: true } }),
      ]);
      const byUser = new Map(prefs.map(p => [p.userId, p]));
      const category = notificationCategory(n.type);
      const targets: { id: string; push: boolean }[] = [];
      for (const u of users) {
        const p = byUser.get(u.id);
        if (p?.offBell.includes(category)) continue;
        const quiet = inQuietHours(localHour(u.timezone, now), p?.quietStart ?? DEFAULT_QUIET_START, p?.quietEnd ?? DEFAULT_QUIET_END);
        targets.push({ id: u.id, push: !quiet && !p?.offPush.includes(category) });
      }
      if (!targets.length) continue;
      await this.prisma.$transaction(async tx => {
        if (n.key) {
          await tx.notificationLog.createMany({
            data: targets.map(t => ({ userId: t.id, type: n.type, category, key: n.key!, sentAt: now })),
            skipDuplicates: true,
          });
        }
        await tx.notification.createMany({
          data: targets.map(t => ({ userId: t.id, type: n.type, title: n.title, body: n.body ?? '', link: n.link, refId: n.refId ?? null, createdAt: now })),
        });
      });
      for (const t of targets) if (t.push) void this.push(t.id, { title: n.title, body: n.body ?? '', link: n.link });
      sent += targets.length;
    }
    return sent;
  }

  /** Envio ao celular. Aparelhos que não aceitam mais (inscrição expirada) são descartados. */
  async push(userId: string, payload: PushPayload) {
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
    // Fotos ("Lembra disso?") e pesquisas (para responder no próprio sino).
    const fileIds = items.map(n => n.imageFileId).filter((x): x is string => Boolean(x));
    const files = fileIds.length ? await this.prisma.file.findMany({ where: { id: { in: fileIds }, status: 'ready' } }) : [];
    const urls = new Map(await Promise.all(files.map(async f => [f.id, await this.storage.downloadUrl(f.key)] as const)));
    const surveyIds = items.filter(n => n.type === 'pesquisa' && n.refId).map(n => n.refId!);
    const surveys = surveyIds.length
      ? await this.prisma.survey.findMany({ where: { id: { in: surveyIds } }, include: { responses: { where: { userId } } } })
      : [];
    const surveyDto = new Map(
      surveys.map(s => {
        const r = s.responses[0];
        const dto: SurveyDto = { id: s.id, question: s.question, open: !s.closedAt, answer: r ? { score: r.score, comment: r.comment } : null };
        return [s.id, dto] as const;
      }),
    );
    return items.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      actorName: n.actor?.name ?? null,
      imageUrl: n.imageFileId ? (urls.get(n.imageFileId) ?? null) : null,
      survey: n.type === 'pesquisa' && n.refId ? (surveyDto.get(n.refId) ?? null) : null,
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

  // ---------- Preferências ----------

  async prefs(userId: string): Promise<NotificationPrefsDto> {
    const [p, user] = await Promise.all([
      this.prisma.notificationPrefs.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { journey: true, journeyFinishedAt: true } }),
    ]);
    const onJourney = Boolean(user?.journey && !user.journeyFinishedAt);
    const askedRecently = Boolean(p?.pushAskedAt && p.pushAskedAt.getTime() > Date.now() - PUSH_ASK_AGAIN_DAYS * 86_400_000);
    return {
      volume: p?.volume ?? 'normal',
      quietStart: p?.quietStart ?? DEFAULT_QUIET_START,
      quietEnd: p?.quietEnd ?? DEFAULT_QUIET_END,
      offBell: p?.offBell ?? [],
      offPush: p?.offPush ?? [],
      askPush: !onJourney && !askedRecently,
    };
  }

  /** "Agora não" no convite para ligar o celular: volta a perguntar daqui a PUSH_ASK_AGAIN_DAYS dias. */
  async dismissPushAsk(userId: string) {
    const now = new Date();
    await this.prisma.notificationPrefs.upsert({ where: { userId }, create: { userId, pushAskedAt: now }, update: { pushAskedAt: now } });
  }

  async savePrefs(userId: string, dto: Partial<NotificationPrefsDto>) {
    const data = {
      volume: dto.volume,
      quietStart: dto.quietStart,
      quietEnd: dto.quietEnd,
      offBell: dto.offBell ? [...new Set(dto.offBell)] : undefined,
      offPush: dto.offPush ? [...new Set(dto.offPush)] : undefined,
    };
    await this.prisma.notificationPrefs.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return this.prefs(userId);
  }

  /** Vai para o sino? E para o celular (categoria ligada e fora do horário de silêncio)? */
  private async delivery(userId: string, type: NotificationType, now = new Date()) {
    const [prefs, user] = await Promise.all([
      this.prefs(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    ]);
    const category = notificationCategory(type);
    const bell = !prefs.offBell.includes(category);
    const quiet = inQuietHours(localHour(user?.timezone ?? 'America/Sao_Paulo', now), prefs.quietStart, prefs.quietEnd);
    return { bell, push: bell && !prefs.offPush.includes(category) && !quiet, prefs, category };
  }

  // ---------- Avisos automáticos (limites e não repetir) ----------

  /**
   * Aviso mandado pelo próprio app (tarefas agendadas). Só sai se a pessoa não está
   * na Jornada, a categoria está ligada, a mesma chave nunca saiu e o limite do dia e
   * da semana (no fuso dela) não foi atingido. `onSent` roda na mesma transação, só se saiu.
   */
  async notifyScheduled(n: NotifyInput & { key: string }, now = new Date(), onSent?: (tx: Tx) => Promise<unknown>) {
    const user = await this.prisma.user.findUnique({
      where: { id: n.userId },
      select: { timezone: true, journey: true, journeyFinishedAt: true },
    });
    if (!user) return null;
    // Durante a Jornada só saem avisos sobre a própria Jornada (decisão do dono de 07/11/2026),
    // e o aviso da Jornada só sai durante ela.
    const onJourney = user.journey && !user.journeyFinishedAt;
    if (onJourney !== (n.type === 'jornada_parada')) return null;
    const d = await this.delivery(n.userId, n.type, now);
    if (!d.bell) return null;
    if (await this.prisma.notificationLog.findUnique({ where: { userId_key: { userId: n.userId, key: n.key } } })) return null;

    // Limites: só as categorias que o app manda sozinho contam (novidades e pesquisas não).
    const { perDay, perWeek } = NOTIFICATION_VOLUMES[d.prefs.volume];
    const today = dayKey(user.timezone, now);
    const monday = mondayOf(today);
    const recent = await this.prisma.notificationLog.findMany({
      where: { userId: n.userId, category: { in: COUNTED_CATEGORIES }, sentAt: { gte: new Date(now.getTime() - 8 * 86_400_000), lte: now } },
      select: { sentAt: true, category: true },
    });
    const todays = recent.filter(r => dayKey(user.timezone, r.sentAt) === today);
    if (todays.length >= perDay) return null;
    if (recent.filter(r => dayKey(user.timezone, r.sentAt) >= monday).length >= perWeek) return null;
    if (d.category === 'dicas' && todays.filter(r => r.category === 'dicas').length >= TIPS_PER_DAY) return null;

    const created = await this.prisma.$transaction(async tx => {
      await tx.notificationLog.create({ data: { userId: n.userId, type: n.type, category: d.category, key: n.key, sentAt: now } });
      const c = await tx.notification.create({
        data: {
          userId: n.userId,
          type: n.type,
          title: n.title,
          body: n.body ?? '',
          link: n.link,
          refId: n.refId ?? null,
          imageFileId: n.imageFileId ?? null,
          createdAt: now,
        },
      });
      if (onSent) await onSent(tx);
      return c;
    });
    if (d.push) {
      const file = n.imageFileId ? await this.prisma.file.findFirst({ where: { id: n.imageFileId, status: 'ready' } }) : null;
      const image = file ? await this.storage.downloadUrl(file.key) : undefined;
      void this.push(n.userId, { title: n.title, body: n.body ?? '', link: n.link, image });
    }
    return created;
  }

  /** Já saiu algum aviso automático deste tipo para a pessoa desde a data? */
  async sentTypeSince(userId: string, types: NotificationType[], since: Date) {
    return Boolean(await this.prisma.notificationLog.findFirst({ where: { userId, type: { in: types }, sentAt: { gte: since } } }));
  }

  /** Último aviso automático deste tipo (para variar, ex.: não repetir a mesma área). */
  lastOfType(userId: string, type: NotificationType) {
    return this.prisma.notificationLog.findFirst({ where: { userId, type }, orderBy: { sentAt: 'desc' } });
  }

  /**
   * Alertas do dia e limpezas. Roda a cada hora (chamado pelo EngagementService, antes das
   * dicas, para os alertas terem prioridade no limite do dia) e uma vez por dia na Vercel.
   */
  async hourly() {
    try {
      const n = await this.checkOverdue();
      if (n) this.logger.log(`${n} resumos de tarefas atrasadas enviados`);
      const s = await this.checkSprintDeadlines();
      if (s) this.logger.log(`${s} avisos de prazo de sprint enviados`);
      const e = await this.checkEpics();
      if (e) this.logger.log(`${e} alertas de épico enviados`);
      await this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
      await this.prisma.notificationLog.deleteMany({ where: { sentAt: { lt: new Date(Date.now() - LOG_KEEP_DAYS * 86_400_000) } } });
    } catch (e) {
      this.logger.error(`Falha nos avisos automáticos: ${(e as Error).message}`);
    }
  }

  // ---------- Tarefas atrasadas ----------

  /**
   * Resumo diário das tarefas atrasadas (decisão do dono de 07/11/2026): no máximo um
   * por dia, a partir da hora configurada, só quando há tarefa atrasada ainda não avisada.
   * A tarefa só volta a puxar um resumo se o prazo mudar. Devolve quantos resumos saíram.
   */
  async checkOverdue(now = new Date()) {
    const hour = this.config.get('OVERDUE_HOUR');
    const fresh = await this.prisma.task.findMany({
      where: { status: { not: 'done' }, archivedAt: null, dueDate: { not: null }, overdueNotifiedAt: null },
      select: { userId: true },
      distinct: ['userId'],
    });
    let sent = 0;
    for (const { userId } of fresh) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
      if (!user || localHour(user.timezone, now) < hour) continue;
      const today = dayKey(user.timezone, now);
      const overdue = await this.prisma.task.findMany({
        where: { userId, status: { not: 'done' }, archivedAt: null, dueDate: { lt: new Date(`${today}T00:00:00Z`) } },
        select: { id: true, title: true, overdueNotifiedAt: true },
        orderBy: { dueDate: 'asc' },
      });
      const fresh = overdue.filter(t => !t.overdueNotifiedAt).map(t => t.id);
      if (!fresh.length) continue;
      const one = overdue.length === 1;
      const out = await this.notifyScheduled(
        {
          userId,
          type: 'tarefas_atrasadas',
          key: `tarefas_atrasadas:${today}`,
          title: one ? 'Tarefa atrasada' : `${overdue.length} tarefas atrasadas`,
          body: one ? `“${overdue[0]!.title}” passou do prazo.` : `Você tem ${overdue.length} tarefas atrasadas. Que tal rever os prazos?`,
          link: '/board',
        },
        now,
        tx => tx.task.updateMany({ where: { id: { in: fresh } }, data: { overdueNotifiedAt: now } }),
      );
      if (out) sent++;
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
      if (dayKey(tz, s.plannedEnd!) >= dayKey(tz, now) || localHour(tz, now) < hour) continue;
      const name = sprintName(s);
      const out = await this.notifyScheduled(
        {
          userId: s.userId,
          type: 'sprint_prazo',
          key: `sprint_prazo:${s.id}`,
          title: 'O prazo da sprint terminou',
          body: `A ${name} chegou ao fim do prazo. Encerre quando estiver pronto.`,
          link: '/sprint',
          refId: s.id,
        },
        now,
        tx => tx.sprint.update({ where: { id: s.id }, data: { deadlineNotifiedAt: now } }),
      );
      if (out) sent++;
    }
    return sent;
  }

  // ---------- Épicos parados ----------

  /**
   * Alertas de épico (não encerrado), no máximo um por pessoa por dia, a partir da mesma hora:
   * - **sem próximo passo**: tem tarefas, todas prontas, e nenhuma tarefa criada ou concluída há
   *   EPIC_IDLE_DAYS dias. Pode voltar se entrarem tarefas novas, mas não antes de EPIC_REPEAT_DAYS dias.
   * - **vazio**: criado há EPIC_IDLE_DAYS dias ou mais e sem nenhuma tarefa. Avisa uma vez por épico.
   * Devolve quantos avisos saíram.
   */
  async checkEpics(now = new Date()) {
    const hour = this.config.get('OVERDUE_HOUR');
    const idleSince = new Date(now.getTime() - EPIC_IDLE_DAYS * 86_400_000);
    const epics = await this.prisma.epic.findMany({
      where: { closedAt: null, createdAt: { lte: idleSince } },
      select: {
        id: true,
        userId: true,
        title: true,
        createdAt: true,
        user: { select: { timezone: true } },
        tasks: { select: { status: true, createdAt: true, doneAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const done = new Set<string>();
    let sent = 0;
    for (const e of epics) {
      if (done.has(e.userId) || localHour(e.user.timezone, now) < hour) continue;
      if (await this.epicAlertToday(e.userId, e.user.timezone, now)) {
        done.add(e.userId);
        continue;
      }
      let n: (NotifyInput & { key: string }) | null = null;
      if (!e.tasks.length) {
        n = {
          userId: e.userId,
          type: 'epico_vazio',
          key: `epico_vazio:${e.id}`,
          title: 'Épico sem tarefas',
          body: `“${e.title}” ainda não tem tarefas. Qual é o primeiro passo?`,
          link: `/backlog?epico=${e.id}`,
          refId: e.id,
        };
      } else if (e.tasks.every(t => t.status === 'done')) {
        const last = Math.max(...e.tasks.map(t => Math.max(t.createdAt.getTime(), t.doneAt?.getTime() ?? 0)));
        if (last > idleSince.getTime()) continue;
        if (await this.sentSince(e.userId, `epico_sem_proximo:${e.id}:`, new Date(now.getTime() - EPIC_REPEAT_DAYS * 86_400_000))) continue;
        n = {
          userId: e.userId,
          type: 'epico_sem_proximo',
          // A chave muda quando o número de tarefas muda: entrou tarefa nova, pode avisar de novo.
          key: `epico_sem_proximo:${e.id}:${e.tasks.length}`,
          title: 'Épico concluído?',
          body: `Você concluiu tudo em “${e.title}”. Encerre o épico ou planeje o próximo passo.`,
          link: `/backlog?epico=${e.id}`,
          refId: e.id,
        };
      }
      if (!n) continue;
      if (await this.notifyScheduled(n, now)) {
        sent++;
        done.add(e.userId);
      }
    }
    return sent;
  }

  /** Já saiu algum alerta de épico hoje (no fuso da pessoa)? */
  private async epicAlertToday(userId: string, tz: string, now: Date) {
    const logs = await this.prisma.notificationLog.findMany({
      where: { userId, type: { in: ['epico_vazio', 'epico_sem_proximo'] }, sentAt: { gte: new Date(now.getTime() - 86_400_000), lte: now } },
      select: { sentAt: true },
    });
    return logs.some(l => dayKey(tz, l.sentAt) === dayKey(tz, now));
  }

  /** Já saiu algum aviso com essa chave (começo) desde a data? */
  private async sentSince(userId: string, keyPrefix: string, since: Date) {
    return Boolean(await this.prisma.notificationLog.findFirst({ where: { userId, key: { startsWith: keyPrefix }, sentAt: { gte: since } } }));
  }
}

