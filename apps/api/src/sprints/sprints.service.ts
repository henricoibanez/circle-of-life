import { GEMS, sprintName, type SprintDto } from '@circle/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, Sprint } from '../generated/prisma/client';
import { JourneyService } from '../journey/journey.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';

type Tx = Prisma.TransactionClient;

/** Fim previsto a partir da duração escolhida (em dias). 0 = indeterminada (sem prazo). */
export const plannedEnd = (start: Date, days: number) => (days > 0 ? new Date(start.getTime() + (days - 1) * 24 * 3600 * 1000) : null);

/** A sprint já foi iniciada (não está mais em planejamento). */
export const isStarted = (s: Pick<Sprint, 'startAt'>) => s.startAt !== null;

export const toSprintDto = (s: Sprint): SprintDto => ({
  id: s.id,
  number: s.number,
  name: s.name,
  description: s.description,
  length: s.length,
  startAt: s.startAt?.toISOString() ?? null,
  plannedEnd: s.plannedEnd?.toISOString() ?? null,
  closedAt: s.closedAt?.toISOString() ?? null,
  doneCount: s.doneCount,
  totalCount: s.totalCount,
});

export type SprintEdit = { name?: string; description?: string; length?: number };

/** "23/10" no fuso da pessoa. */
const ddmm = (d: Date, timezone: string) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: timezone });

/**
 * Sprints manuais (decisão do dono de 03/11/2026): a sprint nasce "em planejamento"
 * e só começa quando a pessoa aperta "Iniciar sprint". Tarefa concluída sem sprint
 * iniciada não rende XP (ver BacklogService.moveTask).
 */
@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly journey: JourneyService,
  ) {}

  /** Sprint aberta da pessoa (iniciada ou em planejamento). Se não houver nenhuma, cria a próxima, em planejamento. */
  async current(userId: string, tx: Tx = this.prisma): Promise<Sprint> {
    const open = await tx.sprint.findFirst({ where: { userId, closedAt: null }, orderBy: { number: 'desc' } });
    if (open) return open;
    const last = await tx.sprint.findFirst({ where: { userId }, orderBy: { number: 'desc' } });
    return tx.sprint.create({ data: { userId, number: (last?.number ?? 0) + 1, length: last?.length ?? 14 } });
  }

  /** Sprint atual e histórico das anteriores (mais recente primeiro). */
  async overview(userId: string) {
    const current = await this.current(userId);
    const history = await this.prisma.sprint.findMany({ where: { userId, closedAt: { not: null } }, orderBy: { number: 'desc' } });
    return { current: toSprintDto(current), history: history.map(toSprintDto) };
  }

  /** Nome, descrição e duração. Mudar a duração de uma sprint já iniciada recalcula o fim previsto. */
  async update(userId: string, dto: SprintEdit) {
    const s = await this.current(userId);
    const length = dto.length ?? s.length;
    const end = s.startAt ? plannedEnd(s.startAt, length) : null;
    const updated = await this.prisma.sprint.update({
      where: { id: s.id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        length,
        plannedEnd: end,
        // Prazo mudou: o aviso de prazo vencido pode valer de novo.
        deadlineNotifiedAt: end?.getTime() !== s.plannedEnd?.getTime() ? null : undefined,
      },
    });
    return toSprintDto(updated);
  }

  /**
   * "Iniciar sprint": precisa de pelo menos 1 tarefa em A Fazer. As tarefas que
   * foram para Pronto enquanto não havia sprint saem do quadro (continuam
   * concluídas, sem XP). Avisa no sino e no celular.
   */
  async start(userId: string, dto: SprintEdit = {}) {
    return this.prisma.$transaction(async tx => {
      const s = await this.current(userId, tx);
      if (isStarted(s)) throw new BadRequestException('Essa sprint já começou.');
      await this.journey.assertBoardOpen(userId, tx);
      const todo = await tx.task.count({ where: { userId, status: 'todo', archivedAt: null } });
      if (!todo) throw new BadRequestException('Puxe pelo menos uma tarefa do backlog para A Fazer antes de iniciar a sprint.');

      const now = new Date();
      const loose = await tx.task.findMany({ where: { userId, status: 'done', archivedAt: null }, select: { id: true } });
      for (const t of loose) {
        await tx.task.update({
          where: { id: t.id },
          data: { archivedAt: now, sprintId: null, logs: { create: { text: 'Saiu do quadro ao iniciar a sprint (concluída sem sprint, sem XP)' } } },
        });
      }

      const length = dto.length ?? s.length;
      const started = await tx.sprint.update({
        where: { id: s.id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          length,
          startAt: now,
          plannedEnd: plannedEnd(now, length),
          offSprintWarned: false,
          deadlineNotifiedAt: null,
        },
      });
      const name = sprintName(started);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
      await this.activity.add(tx, userId, 'flag', `Você iniciou a ${name}`, '/board');
      await this.notifications.notify(
        {
          userId,
          type: 'sprint_iniciada',
          title: `${name} começou`,
          body: started.plannedEnd ? `Termina em ${ddmm(started.plannedEnd, user.timezone)}. Bom trabalho!` : 'Sem prazo: você encerra quando quiser.',
          link: '/sprint',
          refId: started.id,
        },
        tx,
      );
      return { sprint: toSprintDto(started), removed: loose.length };
    });
  }

  /**
   * Encerrar a sprint:
   * - tarefas prontas saem do quadro (arquivadas; vão para os relatórios);
   * - tarefas em A Fazer ou Fazendo voltam para o backlog, com registro no histórico;
   * - a sprint vai para o histórico com "prontas/total" e a próxima fica em planejamento
   *   (começa só quando a pessoa apertar "Iniciar sprint").
   * `full` diz se a sprint terminou com todas as tarefas prontas (e pelo menos uma): só assim
   * rende os +100 XP e as 50 gemas (decisão do dono de 06/11/2026).
   */
  async close(userId: string) {
    return this.prisma.$transaction(async tx => {
      const sprint = await this.current(userId, tx);
      if (!isStarted(sprint)) throw new BadRequestException('Essa sprint ainda não começou.');
      const board = await tx.task.findMany({
        where: { userId, archivedAt: null, status: { in: ['todo', 'doing', 'done'] } },
        select: { id: true, status: true },
      });
      const done = board.filter(t => t.status === 'done');
      const open = board.filter(t => t.status !== 'done');
      const now = new Date();
      const name = sprintName(sprint);

      await tx.task.updateMany({ where: { id: { in: done.map(t => t.id) } }, data: { archivedAt: now, sprintId: sprint.id } });
      // Em lote (2 consultas): uma por tarefa ficava lenta com o servidor longe do banco.
      await tx.task.updateMany({ where: { id: { in: open.map(t => t.id) } }, data: { status: 'backlog', sprintId: null } });
      await tx.taskLog.createMany({ data: open.map(t => ({ taskId: t.id, text: `Voltou ao backlog no fim da ${name}` })) });
      const closed = await tx.sprint.update({
        where: { id: sprint.id },
        data: { closedAt: now, doneCount: done.length, totalCount: board.length },
      });
      const next = await tx.sprint.create({ data: { userId, number: sprint.number + 1, length: sprint.length } });
      const full = board.length > 0 && open.length === 0;
      const gained = full ? await this.xp.grant(tx, userId, 'sprint', sprint.id) : 0;
      const gems = full ? await this.xp.grantGems(tx, userId, 'sprint', sprint.id, GEMS.sprint) : 0;
      await this.activity.add(tx, userId, 'flag', `Você encerrou a ${name} (${done.length}/${board.length})`, '/board');
      return {
        closed: toSprintDto(closed),
        next: toSprintDto(next),
        done: done.length,
        open: open.length,
        full,
        xp: await this.xp.change(tx, userId, gained, gems),
      };
    });
  }
}
