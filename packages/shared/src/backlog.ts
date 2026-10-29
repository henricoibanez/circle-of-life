import type { AreaId } from './areas';

/** Formatos que a API devolve para o backlog e o quadro (iguais no site e na API). */

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done';
export type Priority = 'alta' | 'media' | 'baixa';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  doing: 'Fazendo',
  done: 'Pronto',
};

/** Duração de uma sprint, em dias. */
export const SPRINT_DAYS = 14;

export type InitiativeDto = {
  id: string;
  title: string;
  description: string;
  areas: AreaId[];
  isMaster: boolean;
  source: 'manual' | 'trilha' | 'ia' | 'duplicada';
  position: number;
  completedAt: string | null;
  createdAt: string;
};

export type EpicDto = {
  id: string;
  initiativeId: string;
  title: string;
  description: string;
  area: AreaId;
  position: number;
  closedAt: string | null;
  createdAt: string;
};

export type TaskDto = {
  id: string;
  epicId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  /** "AAAA-MM-DD" ou null. */
  dueDate: string | null;
  doneAt: string | null;
  archivedAt: string | null;
  sprintId: string | null;
  position: number;
  createdAt: string;
  checklist: { done: number; total: number };
};

export type BacklogDto = { initiatives: InitiativeDto[]; epics: EpicDto[]; tasks: TaskDto[] };

/** Tarefa atrasada: tem prazo, o prazo já passou e ainda não está pronta. */
export function isLate(t: Pick<TaskDto, 'dueDate' | 'status'>, now = new Date()) {
  if (!t.dueDate || t.status === 'done') return false;
  return new Date(`${t.dueDate}T23:59:59`) < now;
}

export type SprintDto = {
  id: string;
  number: number;
  startAt: string;
  plannedEnd: string;
  closedAt: string | null;
  doneCount: number | null;
  totalCount: number | null;
};

export type SprintOverviewDto = { current: SprintDto; history: SprintDto[] };
