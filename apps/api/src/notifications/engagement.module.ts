import {
  AREA_IDS,
  AREA_IDLE_DAYS,
  AREA_TIP_NAME,
  type AreaId,
  COMEBACK_DAYS,
  GROUP_TIP_DAYS,
  JOURNEY_PHASES,
  JOURNEY_STALL_DAYS,
  MEMORY_EVERY_DAYS,
  MEMORY_MIN_DAYS,
  type MemoryDto,
  type MemoryKind,
  socialStatus,
  TIP_REPEAT_DAYS,
  timeAgo,
} from '@circle/shared';
import { Controller, Get, Injectable, Logger, Module, NotFoundException, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrentUser } from '../common/decorators';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { JourneyService } from '../journey/journey.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from './notifications.service';

const DAY = 86_400_000;
const dayKey = (tz: string, d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
const localHour = (tz: string, d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d));
/** Dias entre dois "AAAA-MM-DD". */
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY);
const maxDate = (ds: (Date | null | undefined)[]) => new Date(Math.max(...ds.map(d => d?.getTime() ?? 0)));

type Person = { id: string; timezone: string; journey: boolean; journeyFinishedAt: Date | null; socialUnlockedAt: Date | null; createdAt: Date };

/**
 * Avisos de engajamento (etapas 3 e 4 do plano de notificações): dicas, aviso da Jornada
 * parada e "Lembra disso?". Rodam junto com os alertas (de hora em hora; uma vez por dia na
 * Vercel), a partir da hora configurada, e passam pelos limites do NotificationsService.
 * Ordem do dia: lembrança e depois uma dica (no máximo uma dica por dia).
 */
@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
    private readonly journey: JourneyService,
    private readonly storage: StorageService,
  ) {}

  /** Agendamento local (de hora em hora): primeiro os alertas, depois lembranças e dicas. */
  @Cron(CronExpression.EVERY_HOUR)
  async tick() {
    await this.notifications.hourly();
    await this.hourly();
  }

  async hourly() {
    try {
      const n = await this.run();
      if (n) this.logger.log(`${n} avisos de engajamento enviados`);
    } catch (e) {
      this.logger.error(`Falha nos avisos de engajamento: ${(e as Error).message}`);
    }
  }

  /** Passa por todo mundo. Devolve quantos avisos saíram. */
  async run(now = new Date()) {
    const hour = this.config.get('OVERDUE_HOUR');
    const people = await this.prisma.user.findMany({
      select: { id: true, timezone: true, journey: true, journeyFinishedAt: true, socialUnlockedAt: true, createdAt: true },
    });
    let sent = 0;
    for (const u of people) {
      if (localHour(u.timezone, now) < hour) continue;
      if (u.journey && !u.journeyFinishedAt) {
        if (await this.journeyStall(u, now)) sent++;
        continue;
      }
      if (await this.memory(u, now)) sent++;
      // Dicas: "volte ao app" primeiro; as outras se revezam a cada dia.
      const others = [this.areaIdle, this.groupTip, this.goodThing];
      const shift = Math.floor(now.getTime() / DAY) % others.length;
      const tips = [this.comeback, ...others.slice(shift), ...others.slice(0, shift)];
      for (const tip of tips) {
        if (await tip.call(this, u, now)) {
          sent++;
          break;
        }
      }
    }
    return sent;
  }

  // ---------- Dicas ----------

  /** "Volte ao app": 3 e 7 dias sem abrir (um aviso em cada marco; depois de um mês, para). */
  async comeback(u: Person, now: Date) {
    const last = await this.prisma.userLoginDay.findFirst({ where: { userId: u.id }, orderBy: { day: 'desc' } });
    if (!last) return false;
    const days = daysBetween(last.day, dayKey(u.timezone, now));
    const mark = [...COMEBACK_DAYS].reverse().find(m => days >= m);
    if (!mark || days > 30) return false;
    const week = mark >= 7;
    return Boolean(
      await this.notifications.notifyScheduled(
        {
          userId: u.id,
          type: 'volte_ao_app',
          key: `volte_ao_app:${last.day}:${mark}`,
          title: week ? 'Uma semana longe' : 'Sua vida não para',
          body: week ? 'Que tal abrir o backlog e escolher uma tarefa para hoje?' : `Faz ${days} dias que você não aparece. Que tal ver como está a sua sprint?`,
          link: week ? '/backlog' : '/board',
        },
        now,
      ),
    );
  }

  /** Área da vida sem tarefa criada nem concluída há 30 dias (a de nota mais baixa na Roda). */
  async areaIdle(u: Person, now: Date) {
    const since = new Date(now.getTime() - AREA_IDLE_DAYS * DAY);
    // Só para quem já usa o app há esse tempo (depois da Jornada, se fez).
    if ((u.journeyFinishedAt ?? u.createdAt) > since) return false;
    if (await this.notifications.sentTypeSince(u.id, ['area_parada'], new Date(now.getTime() - TIP_REPEAT_DAYS * DAY))) return false;
    const tasks = await this.prisma.task.findMany({
      where: { userId: u.id, OR: [{ createdAt: { gte: since } }, { doneAt: { gte: since } }] },
      select: { areas: true, epic: { select: { area: true, areas: true } } },
    });
    const active = new Set<string>();
    for (const t of tasks) for (const a of t.areas.length ? t.areas : t.epic.areas.length ? t.epic.areas : [t.epic.area]) active.add(a);
    const lastKey = (await this.notifications.lastOfType(u.id, 'area_parada'))?.key.split(':')[1];
    const idle = AREA_IDS.filter(a => !active.has(a) && a !== lastKey);
    if (!idle.length) return false;
    const scores = new Map((await this.prisma.rodaScore.findMany({ where: { userId: u.id } })).map(s => [s.area as string, s.score]));
    const area = [...idle].sort((a, b) => (scores.get(a) ?? 5) - (scores.get(b) ?? 5))[0] as AreaId;
    return Boolean(
      await this.notifications.notifyScheduled(
        {
          userId: u.id,
          type: 'area_parada',
          key: `area_parada:${area}:${dayKey(u.timezone, now)}`,
          title: 'Uma área da sua vida está parada',
          body: `Que tal olhar seu backlog e pensar em algo para ${AREA_TIP_NAME[area]}?`,
          link: `/backlog?area=${area}`,
        },
        now,
      ),
    );
  }

  /** Um grupo público de que a pessoa não participa, de preferência ligado às áreas que ela mais usa. */
  async groupTip(u: Person, now: Date) {
    if (!socialStatus(u).open) return false;
    if (await this.notifications.sentTypeSince(u.id, ['grupo_sugerido'], new Date(now.getTime() - GROUP_TIP_DAYS * DAY))) return false;
    const suggested = (await this.prisma.notificationLog.findMany({ where: { userId: u.id, type: 'grupo_sugerido' }, select: { key: true } })).map(
      l => l.key.split(':')[1]!,
    );
    const groups = await this.prisma.group.findMany({
      where: {
        private: false,
        id: { notIn: suggested },
        members: { none: { userId: u.id } },
        bans: { none: { userId: u.id } },
      },
      select: { id: true, name: true, area: true, _count: { select: { members: true } } },
    });
    if (!groups.length) return false;
    const tasks = await this.prisma.task.findMany({
      where: { userId: u.id, createdAt: { gte: new Date(now.getTime() - 90 * DAY) } },
      select: { areas: true, epic: { select: { area: true } } },
    });
    const use = new Map<string, number>();
    for (const t of tasks) for (const a of t.areas.length ? t.areas : [t.epic.area]) use.set(a, (use.get(a) ?? 0) + 1);
    const g = [...groups].sort((a, b) => (use.get(b.area) ?? 0) - (use.get(a.area) ?? 0) || b._count.members - a._count.members)[0]!;
    const n = g._count.members;
    return Boolean(
      await this.notifications.notifyScheduled(
        {
          userId: u.id,
          type: 'grupo_sugerido',
          key: `grupo_sugerido:${g.id}`,
          title: 'Um grupo para você',
          body: `O grupo “${g.name}” tem ${n} ${n === 1 ? 'pessoa' : 'pessoas'}. Quer conhecer?`,
          link: `/grupos/${g.id}`,
          refId: g.id,
        },
        now,
      ),
    );
  }

  /** "Aconteceu algo bom?": a cada 14 dias no máximo, se a pessoa não postou nada nesse tempo. */
  async goodThing(u: Person, now: Date) {
    if (!socialStatus(u).open) return false;
    const since = new Date(now.getTime() - TIP_REPEAT_DAYS * DAY);
    if (await this.notifications.sentTypeSince(u.id, ['algo_bom'], since)) return false;
    if (await this.prisma.post.count({ where: { authorId: u.id, createdAt: { gte: since } } })) return false;
    return Boolean(
      await this.notifications.notifyScheduled(
        {
          userId: u.id,
          type: 'algo_bom',
          key: `algo_bom:${dayKey(u.timezone, now)}`,
          title: 'Aconteceu algo bom?',
          body: 'Aconteceu algo bom que não estava planejado? Compartilhe com seus amigos.',
          link: '/feed?novo=post',
        },
        now,
      ),
    );
  }

  // ---------- Jornada ----------

  /** Jornada parada há 2, 5 e 10 dias: lembra o próximo passo (o único aviso automático durante a Jornada). */
  async journeyStall(u: Person, now: Date) {
    const id = u.id;
    const [user, roda, maslow, dream, necro, ini, epic, task, sprint] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id }, select: { createdAt: true, journeyWelcomedAt: true } }),
      this.prisma.rodaScore.aggregate({ where: { userId: id }, _max: { updatedAt: true } }),
      this.prisma.maslowCheck.aggregate({ where: { userId: id }, _max: { checkedAt: true } }),
      this.prisma.dream.aggregate({ where: { userId: id }, _max: { createdAt: true } }),
      this.prisma.necrologio.findUnique({ where: { userId: id }, select: { updatedAt: true } }),
      this.prisma.initiative.aggregate({ where: { userId: id }, _max: { createdAt: true } }),
      this.prisma.epic.aggregate({ where: { userId: id }, _max: { createdAt: true } }),
      this.prisma.task.aggregate({ where: { userId: id }, _max: { updatedAt: true } }),
      this.prisma.sprint.aggregate({ where: { userId: id }, _max: { startAt: true } }),
    ]);
    const last = maxDate([
      user.createdAt,
      user.journeyWelcomedAt,
      roda._max.updatedAt,
      maslow._max.checkedAt,
      dream._max.createdAt,
      necro?.updatedAt,
      ini._max.createdAt,
      epic._max.createdAt,
      task._max.updatedAt,
      sprint._max.startAt,
    ]);
    const days = Math.floor((now.getTime() - last.getTime()) / DAY);
    const mark = [...JOURNEY_STALL_DAYS].reverse().find(m => days >= m);
    if (!mark) return false;
    const current = (await this.journey.get(id)).current;
    const phase = JOURNEY_PHASES.find(p => p.id === current);
    if (!phase) return false;
    return Boolean(
      await this.notifications.notifyScheduled(
        {
          userId: id,
          type: 'jornada_parada',
          key: `jornada_parada:${phase.id}:${dayKey(u.timezone, last)}:${mark}`,
          title: 'Sua Jornada está esperando você',
          body: `Próximo passo: ${phase.title}. ${phase.goal}`,
          link: '/jornada',
        },
        now,
      ),
    );
  }

  // ---------- Lembra disso? ----------

  /** Uma conquista sorteada, de pelo menos 30 dias atrás; no máximo uma lembrança a cada 7 dias. */
  async memory(u: Person, now: Date) {
    if (await this.notifications.sentTypeSince(u.id, ['lembranca'], new Date(now.getTime() - MEMORY_EVERY_DAYS * DAY))) return false;
    const before = new Date(now.getTime() - MEMORY_MIN_DAYS * DAY);
    const [tasks, epics, inis, logs] = await Promise.all([
      this.prisma.task.findMany({ where: { userId: u.id, status: 'done', doneAt: { lte: before } }, select: { id: true } }),
      this.prisma.epic.findMany({ where: { userId: u.id, closedAt: { lte: before } }, select: { id: true } }),
      this.prisma.initiative.findMany({ where: { userId: u.id, completedAt: { lte: before } }, select: { id: true } }),
      this.prisma.notificationLog.findMany({ where: { userId: u.id, type: 'lembranca' }, select: { key: true } }),
    ]);
    const seen = new Set(logs.map(l => l.key));
    const pool = [
      ...tasks.map(t => ['task', t.id] as const),
      ...epics.map(e => ['epic', e.id] as const),
      ...inis.map(i => ['initiative', i.id] as const),
    ].filter(([k, id]) => !seen.has(`lembranca:${k}:${id}`));
    if (!pool.length) return false;
    const [kind, id] = pool[Math.floor(Math.random() * pool.length)]!;
    const m = await this.memoryData(u.id, kind, id);
    if (!m) return false;
    const what = kind === 'task' ? `você concluiu “${m.title}”` : kind === 'epic' ? `você encerrou o épico “${m.title}”` : `você concluiu a iniciativa “${m.title}”`;
    return Boolean(
      await this.notifications.notifyScheduled(
        {
          userId: u.id,
          type: 'lembranca',
          key: `lembranca:${kind}:${id}`,
          title: 'Lembra disso?',
          body: `${timeAgo(m.doneAt, now)} ${what}.`,
          link: `/lembranca?tipo=${kind}&id=${id}`,
          refId: id,
          imageFileId: m.imageFileId,
        },
        now,
      ),
    );
  }

  /** Dados da conquista (só da própria pessoa) e a foto: anexo da tarefa ou foto do post em que ela foi compartilhada. */
  private async memoryData(userId: string, kind: MemoryKind, id: string) {
    const fromPost = async () => {
      const post = await this.prisma.post.findFirst({
        where: { authorId: userId, refType: kind, refId: id, media: { some: {} } },
        orderBy: { createdAt: 'desc' },
        select: { media: { select: { fileId: true }, take: 1 } },
      });
      return post?.media[0]?.fileId ?? null;
    };
    const fromTasks = async (where: { id?: string; epicId?: string; epic?: { initiativeId: string } }) => {
      const a = await this.prisma.taskAttachment.findFirst({ where: { task: { userId, ...where }, file: { status: 'ready' } }, orderBy: { createdAt: 'asc' } });
      return a?.fileId ?? null;
    };
    if (kind === 'task') {
      const t = await this.prisma.task.findFirst({
        where: { id, userId, status: 'done', doneAt: { not: null } },
        include: { epic: { include: { initiative: true } } },
      });
      if (!t) return null;
      return {
        title: t.title,
        description: t.description,
        doneAt: t.doneAt!,
        areas: t.areas.length ? t.areas : t.epic.areas.length ? t.epic.areas : [t.epic.area],
        epic: t.epic.title,
        initiative: t.epic.initiative.title,
        tasks: null,
        imageFileId: (await fromTasks({ id })) ?? (await fromPost()),
      };
    }
    if (kind === 'epic') {
      const e = await this.prisma.epic.findFirst({ where: { id, userId, closedAt: { not: null } }, include: { initiative: true, _count: { select: { tasks: true } } } });
      if (!e) return null;
      return {
        title: e.title,
        description: e.description,
        doneAt: e.closedAt!,
        areas: e.areas.length ? e.areas : [e.area],
        epic: null,
        initiative: e.initiative.title,
        tasks: e._count.tasks,
        imageFileId: (await fromPost()) ?? (await fromTasks({ epicId: id })),
      };
    }
    const i = await this.prisma.initiative.findFirst({ where: { id, userId, completedAt: { not: null } } });
    if (!i) return null;
    const tasks = await this.prisma.task.count({ where: { userId, epic: { initiativeId: id } } });
    return {
      title: i.title,
      description: i.description,
      doneAt: i.completedAt!,
      areas: i.areas,
      epic: null,
      initiative: null,
      tasks,
      imageFileId: (await fromPost()) ?? (await fromTasks({ epic: { initiativeId: id } })),
    };
  }

  /** Tela "Lembra disso?". */
  async memoryDto(userId: string, kind: string, id: string): Promise<MemoryDto> {
    if (kind !== 'task' && kind !== 'epic' && kind !== 'initiative') throw new NotFoundException();
    const m = await this.memoryData(userId, kind, id);
    if (!m) throw new NotFoundException('Essa conquista não existe mais.');
    const file = m.imageFileId ? await this.prisma.file.findFirst({ where: { id: m.imageFileId, status: 'ready' } }) : null;
    return {
      kind,
      id,
      title: m.title,
      description: m.description,
      doneAt: m.doneAt.toISOString(),
      ago: timeAgo(m.doneAt),
      areas: m.areas,
      epic: m.epic,
      initiative: m.initiative,
      tasks: m.tasks,
      imageUrl: file ? await this.storage.downloadUrl(file.key) : null,
    };
  }
}

@Controller('memories')
class MemoriesController {
  constructor(private readonly engagement: EngagementService) {}

  @Get(':kind/:id')
  get(@CurrentUser() u: User, @Param('kind') kind: string, @Param('id') id: string) {
    return this.engagement.memoryDto(u.id, kind, id);
  }
}

@Module({ controllers: [MemoriesController], providers: [EngagementService], exports: [EngagementService] })
export class EngagementModule {}
