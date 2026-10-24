import { INITIATIVE_MIN_TASKS, STATUS_LABEL, type TaskStatus } from '@circle/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SprintsService } from '../sprints/sprints.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';
import type { CreateEpicDto, CreateInitiativeDto, CreateTaskDto, UpdateEpicDto, UpdateInitiativeDto, UpdateTaskDto } from './dto';
import { parseDay, toEpicDto, toInitiativeDto, toTaskDto } from './mappers';

type Tx = Prisma.TransactionClient;
const COPY = ' (cópia)';
const NOT_FOUND = {
  initiative: 'Iniciativa não encontrada.',
  epic: 'Épico não encontrado.',
  task: 'Tarefa não encontrada.',
};

/**
 * Regras do backlog: Iniciativa > Épico > Tarefa.
 * Tudo é sempre filtrado pelo dono (userId): ninguém vê ou altera o backlog de outra pessoa.
 */
@Injectable()
export class BacklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sprints: SprintsService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
  ) {}

  /** Backlog completo, em listas simples (o site monta a cascata e os filtros). */
  async all(userId: string) {
    const [initiatives, epics, tasks] = await Promise.all([
      this.prisma.initiative.findMany({ where: { userId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.epic.findMany({ where: { userId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.task.findMany({
        where: { userId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: { checklist: { select: { done: true } } },
      }),
    ]);
    return { initiatives: initiatives.map(toInitiativeDto), epics: epics.map(toEpicDto), tasks: tasks.map(toTaskDto) };
  }

  // ---------- Busca com checagem de dono ----------

  private async initiative(userId: string, id: string, tx: Tx = this.prisma) {
    const i = await tx.initiative.findFirst({ where: { id, userId } });
    if (!i) throw new NotFoundException(NOT_FOUND.initiative);
    return i;
  }
  private async epic(userId: string, id: string, tx: Tx = this.prisma) {
    const e = await tx.epic.findFirst({ where: { id, userId } });
    if (!e) throw new NotFoundException(NOT_FOUND.epic);
    return e;
  }
  private async task(userId: string, id: string, tx: Tx = this.prisma) {
    const t = await tx.task.findFirst({ where: { id, userId } });
    if (!t) throw new NotFoundException(NOT_FOUND.task);
    return t;
  }

  /**
   * Uma iniciativa concluída que ganha épico ou tarefa nova (ou reaberta) deixa
   * de estar concluída — e o XP da conclusão sai junto. Devolve o XP tirado.
   */
  private async reopenInitiative(initiativeId: string, tx: Tx) {
    const i = await tx.initiative.findUnique({ where: { id: initiativeId } });
    if (!i?.completedAt) return 0;
    await tx.initiative.update({ where: { id: initiativeId }, data: { completedAt: null } });
    return this.xp.revoke(tx, i.userId, 'iniciativa', i.id);
  }

  /** Tira o XP de tarefas, épicos e iniciativa antes de excluí-los (senão daria para "fabricar" XP). */
  private async revokeAll(tx: Tx, userId: string, ids: { tasks?: string[]; epics?: string[]; initiatives?: string[] }) {
    for (const id of ids.tasks ?? []) await this.xp.revoke(tx, userId, 'task', id);
    for (const id of ids.epics ?? []) await this.xp.revoke(tx, userId, 'epic', id);
    for (const id of ids.initiatives ?? []) await this.xp.revoke(tx, userId, 'iniciativa', id);
  }

  // ---------- Iniciativas ----------

  async createInitiative(userId: string, dto: CreateInitiativeDto) {
    const i = await this.prisma.initiative.create({
      data: { userId, title: dto.title.trim(), description: dto.description?.trim() ?? '', areas: dto.areas ?? [], isMaster: dto.isMaster ?? false },
    });
    return toInitiativeDto(i);
  }

  async updateInitiative(userId: string, id: string, dto: UpdateInitiativeDto) {
    await this.initiative(userId, id);
    const i = await this.prisma.initiative.update({
      where: { id },
      data: { title: dto.title?.trim(), description: dto.description?.trim(), areas: dto.areas, isMaster: dto.isMaster },
    });
    return toInitiativeDto(i);
  }

  async deleteInitiative(userId: string, id: string) {
    await this.initiative(userId, id);
    await this.prisma.$transaction(async tx => {
      const epics = await tx.epic.findMany({ where: { initiativeId: id }, select: { id: true } });
      const tasks = await tx.task.findMany({ where: { epic: { initiativeId: id } }, select: { id: true } });
      await this.revokeAll(tx, userId, { tasks: tasks.map(t => t.id), epics: epics.map(e => e.id), initiatives: [id] });
      await tx.initiative.delete({ where: { id } });
    });
  }

  /**
   * Concluir: só quando tem épicos e todos estão encerrados. Vira conquista.
   * Rende XP só se tiver mais de INITIATIVE_MIN_TASKS tarefas concluídas.
   */
  async completeInitiative(userId: string, id: string) {
    const i = await this.initiative(userId, id);
    if (i.completedAt) throw new ConflictException('Essa iniciativa já está concluída.');
    const epics = await this.prisma.epic.findMany({ where: { initiativeId: id }, select: { closedAt: true } });
    if (!epics.length || epics.some(e => !e.closedAt)) {
      throw new BadRequestException('Para concluir a iniciativa, encerre antes todos os épicos dela.');
    }
    return this.prisma.$transaction(async tx => {
      const done = await tx.task.count({ where: { epic: { initiativeId: id }, status: 'done' } });
      const updated = await tx.initiative.update({ where: { id }, data: { completedAt: new Date() } });
      const gained = done > INITIATIVE_MIN_TASKS ? await this.xp.grant(tx, userId, 'iniciativa', id) : 0;
      await this.activity.add(tx, userId, 'target', `Você concluiu a iniciativa “${i.title}”`, '/quadro?aba=conquistas');
      return { initiative: toInitiativeDto(updated), doneTasks: done, xp: await this.xp.change(tx, userId, gained) };
    });
  }

  async reopenInitiativeById(userId: string, id: string) {
    await this.initiative(userId, id);
    return this.prisma.$transaction(async tx => {
      const gained = await this.reopenInitiative(id, tx);
      const i = await tx.initiative.findUniqueOrThrow({ where: { id } });
      return { initiative: toInitiativeDto(i), xp: await this.xp.change(tx, userId, gained) };
    });
  }

  /** Duplica a iniciativa com todos os épicos e tarefas (tudo volta para o backlog, sem anexos nem histórico). */
  async duplicateInitiative(userId: string, id: string) {
    const src = await this.initiative(userId, id);
    return this.prisma.$transaction(async tx => {
      const copy = await tx.initiative.create({
        data: { userId, title: src.title + COPY, description: src.description, areas: src.areas, isMaster: false, source: 'duplicada' },
      });
      const epics = await tx.epic.findMany({ where: { initiativeId: id }, orderBy: { createdAt: 'asc' } });
      for (const e of epics) await this.copyEpic(tx, userId, e.id, copy.id, e.title);
      return toInitiativeDto(copy);
    });
  }

  // ---------- Épicos ----------

  async createEpic(userId: string, dto: CreateEpicDto) {
    await this.initiative(userId, dto.initiativeId);
    return this.prisma.$transaction(async tx => {
      const e = await tx.epic.create({
        data: { userId, initiativeId: dto.initiativeId, title: dto.title.trim(), description: dto.description?.trim() ?? '', area: dto.area },
      });
      await this.reopenInitiative(dto.initiativeId, tx);
      return toEpicDto(e);
    });
  }

  async updateEpic(userId: string, id: string, dto: UpdateEpicDto) {
    const epic = await this.epic(userId, id);
    if (dto.initiativeId && dto.initiativeId !== epic.initiativeId) await this.initiative(userId, dto.initiativeId);
    return this.prisma.$transaction(async tx => {
      const e = await tx.epic.update({
        where: { id },
        data: { initiativeId: dto.initiativeId, title: dto.title?.trim(), description: dto.description?.trim(), area: dto.area },
      });
      if (dto.initiativeId && !e.closedAt) await this.reopenInitiative(dto.initiativeId, tx);
      return toEpicDto(e);
    });
  }

  async deleteEpic(userId: string, id: string) {
    await this.epic(userId, id);
    await this.prisma.$transaction(async tx => {
      const tasks = await tx.task.findMany({ where: { epicId: id }, select: { id: true } });
      await this.revokeAll(tx, userId, { tasks: tasks.map(t => t.id), epics: [id] });
      await tx.epic.delete({ where: { id } });
    });
  }

  /** Encerrar: só quando tem tarefas e todas estão prontas. Vira conquista e rende XP. */
  async closeEpic(userId: string, id: string) {
    const e = await this.epic(userId, id);
    if (e.closedAt) throw new ConflictException('Esse épico já está encerrado.');
    const tasks = await this.prisma.task.findMany({ where: { epicId: id }, select: { status: true } });
    if (!tasks.length || tasks.some(t => t.status !== 'done')) {
      throw new BadRequestException('Para encerrar o épico, todas as tarefas dele precisam estar prontas.');
    }
    return this.prisma.$transaction(async tx => {
      const updated = await tx.epic.update({ where: { id }, data: { closedAt: new Date() } });
      const gained = await this.xp.grant(tx, userId, 'epic', id);
      await this.activity.add(tx, userId, 'trophy', `Você encerrou o épico “${e.title}”`, '/quadro?aba=conquistas');
      return { epic: toEpicDto(updated), doneTasks: tasks.length, xp: await this.xp.change(tx, userId, gained) };
    });
  }

  async reopenEpic(userId: string, id: string) {
    const e = await this.epic(userId, id);
    return this.prisma.$transaction(async tx => {
      const updated = await tx.epic.update({ where: { id }, data: { closedAt: null } });
      const lost = (await this.xp.revoke(tx, userId, 'epic', id)) + (await this.reopenInitiative(e.initiativeId, tx));
      return { epic: toEpicDto(updated), xp: await this.xp.change(tx, userId, lost) };
    });
  }

  async duplicateEpic(userId: string, id: string) {
    const e = await this.epic(userId, id);
    return this.prisma.$transaction(async tx => {
      const copy = await this.copyEpic(tx, userId, id, e.initiativeId, e.title + COPY);
      await this.reopenInitiative(e.initiativeId, tx);
      return toEpicDto(copy);
    });
  }

  private async copyEpic(tx: Tx, userId: string, epicId: string, initiativeId: string, title: string) {
    const src = await tx.epic.findUniqueOrThrow({ where: { id: epicId } });
    const copy = await tx.epic.create({ data: { userId, initiativeId, title, description: src.description, area: src.area } });
    const tasks = await tx.task.findMany({ where: { epicId }, orderBy: { createdAt: 'asc' }, include: { checklist: true } });
    for (const t of tasks) await this.copyTask(tx, userId, t.id, copy.id, t.title);
    return copy;
  }

  // ---------- Tarefas ----------

  async createTask(userId: string, dto: CreateTaskDto) {
    const epic = await this.epic(userId, dto.epicId);
    if (epic.closedAt) throw new BadRequestException('Esse épico está encerrado. Reabra o épico para adicionar tarefas.');
    return this.prisma.$transaction(async tx => {
      const status = dto.status ?? 'backlog';
      const sprint = status === 'todo' ? await this.sprints.current(userId, tx) : null;
      const t = await tx.task.create({
        data: {
          userId,
          epicId: epic.id,
          title: dto.title.trim(),
          description: dto.description?.trim() ?? '',
          priority: dto.priority ?? 'media',
          dueDate: parseDay(dto.dueDate) ?? null,
          status,
          sprintId: sprint?.id ?? null,
          logs: { create: { text: status === 'todo' ? 'Tarefa criada na sprint atual' : 'Tarefa criada' } },
        },
      });
      await this.reopenInitiative(epic.initiativeId, tx);
      return toTaskDto(t);
    });
  }

  async updateTask(userId: string, id: string, dto: UpdateTaskDto) {
    const t = await this.task(userId, id);
    if (dto.epicId && dto.epicId !== t.epicId) {
      const target = await this.epic(userId, dto.epicId);
      if (target.closedAt) throw new BadRequestException('Esse épico está encerrado. Escolha outro.');
    }
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        epicId: dto.epicId,
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        priority: dto.priority,
        dueDate: parseDay(dto.dueDate),
        // Prazo mudou: o aviso de atraso pode valer de novo.
        overdueNotifiedAt: dto.dueDate !== undefined ? null : undefined,
      },
      include: { checklist: { select: { done: true } } },
    });
    return toTaskDto(updated);
  }

  async deleteTask(userId: string, id: string) {
    await this.task(userId, id);
    await this.prisma.$transaction(async tx => {
      await this.revokeAll(tx, userId, { tasks: [id] });
      await tx.task.delete({ where: { id } });
    });
  }

  async duplicateTask(userId: string, id: string) {
    const t = await this.task(userId, id);
    const epic = await this.epic(userId, t.epicId);
    if (epic.closedAt) throw new BadRequestException('Esse épico está encerrado. Reabra o épico para duplicar tarefas nele.');
    return this.prisma.$transaction(async tx => {
      const copy = await this.copyTask(tx, userId, id, t.epicId, t.title + COPY);
      await this.reopenInitiative(epic.initiativeId, tx);
      return toTaskDto(copy);
    });
  }

  private async copyTask(tx: Tx, userId: string, taskId: string, epicId: string, title: string) {
    const src = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: { checklist: { orderBy: { position: 'asc' } } } });
    return tx.task.create({
      data: {
        userId,
        epicId,
        title,
        description: src.description,
        priority: src.priority,
        dueDate: src.dueDate,
        status: 'backlog',
        checklist: { create: src.checklist.map((c, position) => ({ text: c.text, done: false, position })) },
        logs: { create: { text: 'Tarefa criada (cópia)' } },
      },
      include: { checklist: { select: { done: true } } },
    });
  }

  /**
   * Muda o status de uma tarefa (Backlog, A Fazer, Fazendo, Pronto):
   * - entrar no quadro liga a tarefa à sprint atual; voltar ao backlog desliga;
   * - "Pronto" marca a data de conclusão e rende XP; sair de "Pronto" tira o XP e
   *   reabre o épico e a iniciativa, se estavam encerrados (tirando o XP deles também);
   * - cada mudança fica no histórico da tarefa.
   */
  async moveTask(userId: string, id: string, status: TaskStatus) {
    const t = await this.task(userId, id);
    if (t.status === status) {
      const same = await this.prisma.task.findUniqueOrThrow({ where: { id }, include: { checklist: { select: { done: true } } } });
      return { task: toTaskDto(same), from: status, xp: await this.xp.change(this.prisma, userId, 0) };
    }
    return this.prisma.$transaction(async tx => {
      let gained = 0;
      const onBoard = status !== 'backlog';
      const sprint = onBoard ? await this.sprints.current(userId, tx) : null;
      const updated = await tx.task.update({
        where: { id },
        data: {
          status,
          doneAt: status === 'done' ? new Date() : null,
          archivedAt: null,
          sprintId: onBoard ? sprint!.id : null,
          logs: { create: { text: `Movida de ${STATUS_LABEL[t.status]} para ${STATUS_LABEL[status]}` } },
        },
        include: { checklist: { select: { done: true } } },
      });
      if (status === 'done') {
        gained += await this.xp.grant(tx, userId, 'task', id);
        await this.activity.add(tx, userId, 'checkSq', `Você concluiu “${t.title}”`, '/board');
      }
      if (t.status === 'done') {
        gained += await this.xp.revoke(tx, userId, 'task', id);
        const epic = await tx.epic.findUniqueOrThrow({ where: { id: t.epicId } });
        if (epic.closedAt) {
          await tx.epic.update({ where: { id: epic.id }, data: { closedAt: null } });
          gained += await this.xp.revoke(tx, userId, 'epic', epic.id);
        }
        gained += await this.reopenInitiative(epic.initiativeId, tx);
      }
      return { task: toTaskDto(updated), from: t.status, xp: await this.xp.change(tx, userId, gained) };
    });
  }
}
