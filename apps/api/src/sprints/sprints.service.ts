import { type SprintDto } from '@circle/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma, Sprint } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';

type Tx = Prisma.TransactionClient;

/** Fim previsto a partir da duração escolhida (em dias). 0 = indeterminada (sem prazo). */
export const plannedEnd = (start: Date, days: number) => (days > 0 ? new Date(start.getTime() + (days - 1) * 24 * 3600 * 1000) : null);

export const toSprintDto = (s: Sprint): SprintDto => ({
  id: s.id,
  number: s.number,
  startAt: s.startAt.toISOString(),
  plannedEnd: s.plannedEnd?.toISOString() ?? null,
  closedAt: s.closedAt?.toISOString() ?? null,
  doneCount: s.doneCount,
  totalCount: s.totalCount,
});

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
  ) {}

  /** Sprint em andamento da pessoa. Se ainda não existir nenhuma, cria a Sprint 1 começando agora. */
  async current(userId: string, tx: Tx = this.prisma): Promise<Sprint> {
    const open = await tx.sprint.findFirst({ where: { userId, closedAt: null }, orderBy: { number: 'desc' } });
    if (open) return open;
    const last = await tx.sprint.findFirst({ where: { userId }, orderBy: { number: 'desc' } });
    const startAt = new Date();
    const length = await this.sprintLength(userId, tx);
    return tx.sprint.create({ data: { userId, number: (last?.number ?? 0) + 1, startAt, plannedEnd: plannedEnd(startAt, length) } });
  }

  /** Duração da sprint escolhida pela pessoa (em dias; 0 = sem prazo). */
  private async sprintLength(userId: string, tx: Tx = this.prisma) {
    return (await tx.user.findUnique({ where: { id: userId }, select: { sprintLength: true } }))?.sprintLength ?? 14;
  }

  /** Sprint atual e histórico das anteriores (mais recente primeiro). */
  async overview(userId: string) {
    const current = await this.current(userId);
    const history = await this.prisma.sprint.findMany({ where: { userId, closedAt: { not: null } }, orderBy: { number: 'desc' } });
    return { current: toSprintDto(current), history: history.map(toSprintDto) };
  }

  /**
   * Encerrar a sprint:
   * - tarefas prontas saem do quadro (arquivadas; vão para os relatórios);
   * - tarefas em A Fazer ou Fazendo voltam para o backlog, com registro no histórico;
   * - a sprint vai para o histórico com "prontas/total" e abre-se a próxima.
   * `full` diz se a sprint terminou com todas as tarefas prontas (só assim rende XP).
   */
  async close(userId: string) {
    return this.prisma.$transaction(async tx => {
      const sprint = await this.current(userId, tx);
      const board = await tx.task.findMany({
        where: { userId, archivedAt: null, status: { in: ['todo', 'doing', 'done'] } },
        select: { id: true, status: true },
      });
      const done = board.filter(t => t.status === 'done');
      const open = board.filter(t => t.status !== 'done');
      const now = new Date();

      await tx.task.updateMany({ where: { id: { in: done.map(t => t.id) } }, data: { archivedAt: now, sprintId: sprint.id } });
      for (const t of open) {
        await tx.task.update({
          where: { id: t.id },
          data: { status: 'backlog', sprintId: null, logs: { create: { text: `Voltou ao backlog no fim da sprint ${sprint.number}` } } },
        });
      }
      const closed = await tx.sprint.update({
        where: { id: sprint.id },
        data: { closedAt: now, doneCount: done.length, totalCount: board.length },
      });
      const length = await this.sprintLength(userId, tx);
      const next = await tx.sprint.create({
        data: { userId, number: sprint.number + 1, startAt: now, plannedEnd: plannedEnd(now, length) },
      });
      const full = board.length > 0 && open.length === 0;
      const gained = full ? await this.xp.grant(tx, userId, 'sprint', sprint.id) : 0;
      await this.activity.add(tx, userId, 'flag', `Você encerrou a sprint ${sprint.number} (${done.length}/${board.length})`, '/board');
      return {
        closed: toSprintDto(closed),
        next: toSprintDto(next),
        done: done.length,
        open: open.length,
        full,
        xp: await this.xp.change(tx, userId, gained),
      };
    });
  }
}
