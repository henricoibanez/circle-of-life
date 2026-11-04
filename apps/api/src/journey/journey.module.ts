import {
  AREA_IDS,
  BOARD_LOCKED_MESSAGE,
  JOURNEY_PHASES,
  NECRO_MIN_CHARS,
  SOCIAL_UNLOCK_PRICE,
  socialStatus,
  XP,
  type JourneyDto,
  type JourneyPhase,
} from '@circle/shared';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Global, HttpCode, Injectable, Module, Post } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import sanitizeHtml from 'sanitize-html';
import { CurrentUser } from '../common/decorators';
import type { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';

type Tx = Prisma.TransactionClient;

/** Texto do necrológio sem formatação e com espaços normalizados. */
export const necroText = (html: string) =>
  sanitizeHtml(html.replace(/<(br|\/p|\/div|\/h1|\/h2|\/li)\b[^>]*>/gi, ' '), { allowedTags: [], allowedAttributes: {} })
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e: string) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]!)
    .replace(/\s+/g, ' ')
    .trim();

const SOCIAL_FIELDS = { journey: true, journeyFinishedAt: true, socialUnlockedAt: true } as const;

class SeenDto {
  @IsInt() @Min(0) @Max(JOURNEY_PHASES.length) phase!: number;
}

/**
 * Jornada de primeiro acesso (decisões do dono de 03 e 04/11/2026): 7 fases em ordem
 * (ver JOURNEY_PHASES). As 4 primeiras (Minha vida) destrancam o quadro; depois que
 * completam uma vez (minhaVidaAt), o quadro não tranca mais, mesmo que a pessoa
 * apague algo. "Concluir minha jornada" rende o prêmio de XP (antes disso nada rende
 * XP; ver XpService) e começa a contar os 7 dias para liberar o resto de graça.
 */
@Injectable()
export class JourneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
  ) {}

  /** Situação de cada critério (sem considerar a ordem) e os detalhes para a tela. */
  private async raw(userId: string, tx: Tx) {
    const [user, necro, maslow, rodaAreas, dreams, initiative, epic, task, inSprint, started] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId }, select: { journeyFinishedAt: true } }),
      tx.necrologio.findUnique({ where: { userId }, select: { html: true } }),
      tx.maslowCheck.count({ where: { userId } }),
      tx.rodaScore.count({ where: { userId } }),
      tx.dream.count({ where: { userId } }),
      tx.initiative.count({ where: { userId } }),
      tx.epic.count({ where: { userId } }),
      tx.task.count({ where: { userId } }),
      tx.task.count({ where: { userId, OR: [{ status: { not: 'backlog' } }, { sprintId: { not: null } }] } }),
      tx.sprint.count({ where: { userId, startAt: { not: null } } }),
    ]);
    const necroChars = necroText(necro?.html ?? '').length;
    const backlog = { initiative: initiative > 0, epic: epic > 0, task: task > 0, inSprint: inSprint > 0 };
    const ok: Record<JourneyPhase, boolean> = {
      roda: rodaAreas >= AREA_IDS.length,
      maslow: maslow > 0,
      quadro: dreams > 0,
      necrologio: necroChars >= NECRO_MIN_CHARS,
      backlog: backlog.initiative && backlog.epic && backlog.task && backlog.inSprint,
      sprint: started > 0,
      concluir: Boolean(user.journeyFinishedAt),
    };
    // Em ordem: uma fase só conta como feita se as anteriores também estiverem.
    let before = true;
    const phases = JOURNEY_PHASES.map(p => ({ id: p.id, done: (before = before && ok[p.id]) }));
    const minhaVida = ok.roda && ok.maslow && ok.quadro && ok.necrologio;
    return { phases, minhaVida, detail: { rodaAreas, necroChars, backlog } };
  }

  /** Confere (e registra, se acabou de completar) Minha vida. Devolve se o quadro está liberado. */
  private async boardUnlocked(userId: string, tx: Tx) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { journey: true, minhaVidaAt: true } });
    if (!user.journey || user.minhaVidaAt) return true;
    if (!(await this.raw(userId, tx)).minhaVida) return false;
    await tx.user.update({ where: { id: userId }, data: { minhaVidaAt: new Date() } });
    return true;
  }

  /** Trava do quadro: mover para A Fazer/Fazendo/Pronto, criar tarefa na sprint e iniciar sprint. */
  async assertBoardOpen(userId: string, tx: Tx = this.prisma) {
    if (!(await this.boardUnlocked(userId, tx))) throw new ForbiddenException(BOARD_LOCKED_MESSAGE);
  }

  /** O quadro está liberado? (sem lançar erro) */
  boardOpen(userId: string, tx: Tx = this.prisma) {
    return this.boardUnlocked(userId, tx);
  }

  async get(userId: string): Promise<JourneyDto> {
    await this.boardUnlocked(userId, this.prisma);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { phases, detail } = await this.raw(userId, this.prisma);
    return {
      active: user.journey,
      welcomed: Boolean(user.journeyWelcomedAt),
      phases,
      current: phases.find(p => !p.done)?.id ?? null,
      phaseSeen: user.journeyPhaseSeen,
      detail,
      finished: Boolean(user.journeyFinishedAt),
      prize: XP.primeiros_passos,
      social: socialStatus(user),
    };
  }

  /** Marca até qual fase o pop-up de parabéns já apareceu. */
  async seen(userId: string, phase: number) {
    await this.prisma.user.updateMany({ where: { id: userId, journeyPhaseSeen: { lt: phase } }, data: { journeyPhaseSeen: phase } });
  }

  /** "Concluir minha jornada": precisa ter iniciado a 1ª sprint. Rende o prêmio (uma vez) e começa os 7 dias. */
  async finish(userId: string) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { journey: true, journeyFinishedAt: true } });
      if (!user.journey) throw new BadRequestException('Você não está na Jornada.');
      if (user.journeyFinishedAt) throw new BadRequestException('Você já concluiu a sua Jornada.');
      const { phases } = await this.raw(userId, tx);
      if (!phases.find(p => p.id === 'sprint')!.done) throw new BadRequestException('Conclua as etapas anteriores da Jornada antes.');
      // A data vem antes do prêmio: a partir daqui o XP volta a valer (ver XpService).
      await tx.user.update({ where: { id: userId }, data: { journeyFinishedAt: new Date() } });
      const gained = await this.xp.grant(tx, userId, 'primeiros_passos', userId);
      await this.activity.add(tx, userId, 'trophy', 'Você concluiu a sua Jornada', '/jornada');
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: SOCIAL_FIELDS });
      return { xp: await this.xp.change(tx, userId, gained), social: socialStatus(fresh) };
    });
  }

  /** A rede social (e o resto do app) está aberta para a pessoa? Fora da Jornada, sempre. */
  async socialOpen(userId: string, tx: Tx = this.prisma) {
    return socialStatus(await tx.user.findUniqueOrThrow({ where: { id: userId }, select: SOCIAL_FIELDS })).open;
  }

  /**
   * Liberar tudo (concluir a Jornada de vez): de graça depois dos 7 dias; antes
   * disso, gastando 500 XP disponíveis.
   */
  async unlockSocial(userId: string) {
    return this.prisma.$transaction(async tx => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: SOCIAL_FIELDS });
      const s = socialStatus(u);
      if (s.open) throw new BadRequestException('Você já liberou tudo.');
      if (!s.freeAt) throw new BadRequestException('Conclua a sua Jornada antes.');
      const free = new Date() >= new Date(s.freeAt);
      if (!free) await this.xp.spend(tx, userId, SOCIAL_UNLOCK_PRICE, userId, 'rede_social');
      await tx.user.update({ where: { id: userId }, data: { socialUnlockedAt: new Date() } });
      await this.activity.add(tx, userId, 'trophy', 'Você concluiu a sua Jornada e liberou a rede social', '/feed');
      return { paid: free ? 0 : SOCIAL_UNLOCK_PRICE, xp: await this.xp.change(tx, userId, 0) };
    });
  }

  /** O troféu "Jornada concluída" só aparece uma vez (e só depois que tudo abriu). */
  async celebrated(userId: string) {
    if (!(await this.socialOpen(userId))) return;
    await this.prisma.user.updateMany({ where: { id: userId, journey: true, journeyCelebratedAt: null }, data: { journeyCelebratedAt: new Date() } });
  }

  async welcome(userId: string) {
    await this.prisma.user.updateMany({ where: { id: userId, journeyWelcomedAt: null }, data: { journeyWelcomedAt: new Date() } });
  }
}

@Controller('journey')
class JourneyController {
  constructor(private readonly journey: JourneyService) {}

  /** Progresso da Jornada. */
  @Get()
  get(@CurrentUser() u: User) {
    return this.journey.get(u.id);
  }

  /** Marca até qual fase o pop-up de parabéns já apareceu. */
  @Post('seen')
  @HttpCode(204)
  seen(@CurrentUser() u: User, @Body() dto: SeenDto) {
    return this.journey.seen(u.id, dto.phase);
  }

  /** "Concluir minha jornada" (prêmio de XP). */
  @Post('finish')
  finish(@CurrentUser() u: User) {
    return this.journey.finish(u.id);
  }

  /** Libera tudo: por 500 XP, ou de graça depois dos 7 dias. */
  @Post('social/unlock')
  unlockSocial(@CurrentUser() u: User) {
    return this.journey.unlockSocial(u.id);
  }

  /** Marca o troféu "Jornada concluída" como visto. */
  @Post('celebrated')
  @HttpCode(204)
  celebrated(@CurrentUser() u: User) {
    return this.journey.celebrated(u.id);
  }

  /** Marca as boas-vindas como vistas. */
  @Post('welcome')
  @HttpCode(204)
  welcome(@CurrentUser() u: User) {
    return this.journey.welcome(u.id);
  }
}

@Global()
@Module({ controllers: [JourneyController], providers: [JourneyService], exports: [JourneyService] })
export class JourneyModule {}
