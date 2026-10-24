import { SPRINT_DAYS, type SprintDto } from '@circle/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma, Sprint } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

export const plannedEnd = (start: Date) => new Date(start.getTime() + (SPRINT_DAYS - 1) * 24 * 3600 * 1000);

export const toSprintDto = (s: Sprint): SprintDto => ({
  id: s.id,
  number: s.number,
  startAt: s.startAt.toISOString(),
  plannedEnd: s.plannedEnd.toISOString(),
  closedAt: s.closedAt?.toISOString() ?? null,
  doneCount: s.doneCount,
  totalCount: s.totalCount,
});

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sprint em andamento da pessoa. Se ainda não existir nenhuma, cria a Sprint 1 começando agora. */
  async current(userId: string, tx: Tx = this.prisma): Promise<Sprint> {
    const open = await tx.sprint.findFirst({ where: { userId, closedAt: null }, orderBy: { number: 'desc' } });
    if (open) return open;
    const last = await tx.sprint.findFirst({ where: { userId }, orderBy: { number: 'desc' } });
    const startAt = new Date();
    return tx.sprint.create({ data: { userId, number: (last?.number ?? 0) + 1, startAt, plannedEnd: plannedEnd(startAt) } });
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
   * `full` diz se a sprint terminou com todas as tarefas prontas.
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
      const next = await tx.sprint.create({
        data: { userId, number: sprint.number + 1, startAt: now, plannedEnd: plannedEnd(now) },
      });
      return { closed: toSprintDto(closed), next: toSprintDto(next), done: done.length, open: open.length, full: board.length > 0 && open.length === 0 };
    });
  }
}
