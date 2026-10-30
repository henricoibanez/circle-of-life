import type { EpicDto, InitiativeDto, TaskDto } from '@circle/shared';
import type { ChecklistItem, Epic, Initiative, Task } from '../generated/prisma/client';

/** Converte as linhas do banco no formato que o site recebe. */

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export const toInitiativeDto = (i: Initiative): InitiativeDto => ({
  id: i.id,
  title: i.title,
  description: i.description,
  areas: i.areas,
  isMaster: i.isMaster,
  position: i.position,
  source: i.source,
  completedAt: iso(i.completedAt),
  createdAt: i.createdAt.toISOString(),
});

export const toEpicDto = (e: Epic): EpicDto => ({
  id: e.id,
  initiativeId: e.initiativeId,
  title: e.title,
  description: e.description,
  area: e.area,
  position: e.position,
  closedAt: iso(e.closedAt),
  createdAt: e.createdAt.toISOString(),
});

export const toTaskDto = (t: Task & { checklist?: Pick<ChecklistItem, 'done'>[] }): TaskDto => ({
  id: t.id,
  epicId: t.epicId,
  title: t.title,
  description: t.description,
  areas: t.areas,
  status: t.status,
  priority: t.priority,
  dueDate: day(t.dueDate),
  doneAt: iso(t.doneAt),
  archivedAt: iso(t.archivedAt),
  sprintId: t.sprintId,
  position: t.position,
  createdAt: t.createdAt.toISOString(),
  checklist: { done: t.checklist?.filter(c => c.done).length ?? 0, total: t.checklist?.length ?? 0 },
  inCalendar: t.calendarEventId != null,
});

/** "AAAA-MM-DD" vira uma data (meio-dia UTC, para não mudar de dia por causa do fuso). */
export const parseDay = (v: string | null | undefined) => (v ? new Date(`${v}T12:00:00Z`) : v === null ? null : undefined);
