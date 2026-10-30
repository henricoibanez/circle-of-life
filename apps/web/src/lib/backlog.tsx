'use client';

import type { AreaId, BacklogDto, EpicDto, InitiativeDto, TaskDto, TaskStatus, XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SharePrompt } from '@/components/feed/post-form';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { api, ApiError, type Me } from './api';

export const BACKLOG_KEY = ['backlog'];

/** Backlog completo (iniciativas, épicos e tarefas) da pessoa logada. */
export function useBacklog() {
  return useQuery({ queryKey: BACKLOG_KEY, queryFn: () => api<BacklogDto>('/backlog') });
}

// ---------- Seletores (iguais aos do protótipo) ----------

/** Ordem salva (quando a pessoa arrastou) ou, se ninguém reordenou, ordem alfabética. */
export function sortByOrder<T extends { position: number; title: string }>(items: T[]): T[] {
  const custom = items.some(i => i.position > 0);
  const key = (p: number) => (p > 0 ? p : Infinity); // itens novos (0) vão para o fim da ordem manual
  return [...items].sort((a, b) => (custom ? key(a.position) - key(b.position) : 0) || a.title.localeCompare(b.title, 'pt-BR'));
}

export const epicTasks = (b: BacklogDto, epicId: string) => sortByOrder(b.tasks.filter(t => t.epicId === epicId));
export const initEpics = (b: BacklogDto, initiativeId: string) => sortByOrder(b.epics.filter(e => e.initiativeId === initiativeId));
/** Áreas da tarefa: as próprias (até 3) ou, se nenhuma foi escolhida, a área do épico. */
export const taskAreas = (b: BacklogDto, t: TaskDto): AreaId[] => {
  if (t.areas.length) return t.areas;
  const a = b.epics.find(e => e.id === t.epicId)?.area;
  return a ? [a] : [];
};
/** Área principal da tarefa (a primeira), para quando só cabe uma cor/ícone. */
export const taskArea = (b: BacklogDto, t: TaskDto): AreaId | undefined => taskAreas(b, t)[0];
export const progress = (list: TaskDto[]) => {
  const done = list.filter(t => t.status === 'done').length;
  return { done, total: list.length, pct: list.length ? done / list.length : 0 };
};

// ---------- Ações ----------

type Body = Record<string, unknown>;

/**
 * Todas as ações do backlog. Depois de cada uma, os dados são recarregados
 * (backlog, quadro…) e erros da API aparecem como aviso na tela.
 */
export function useBacklogActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const { openSheet } = useSheets();
  const mutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: Body }) => api<any>(path, { method, body }),
    onSuccess: (data: { xp?: XpChange } | undefined) => {
      // Ações que mexem no XP devolvem os totais novos: o número aparece atualizado na hora.
      if (data?.xp) qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: data.xp!.total, disponivel: data.xp!.disponivel } });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      qc.invalidateQueries({ queryKey: ['sprints'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
    onError: e => {
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
    },
  });
  const run = (path: string, method = 'POST', body?: Body) => mutation.mutateAsync({ path, method, body });

  /** Salva a ordem (arrastar) ou volta pra A–Z (reset). Atualiza a tela na hora. */
  const reorder = (type: 'initiative' | 'epic' | 'task', ids: string[], reset = false) => {
    qc.setQueryData<BacklogDto>(BACKLOG_KEY, b => {
      if (!b) return b;
      const pos = new Map(ids.map((id, i) => [id, reset ? 0 : i + 1]));
      const fix = <T extends { id: string; position: number }>(x: T) => (pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x);
      return type === 'initiative'
        ? { ...b, initiatives: b.initiatives.map(fix) }
        : type === 'epic'
          ? { ...b, epics: b.epics.map(fix) }
          : { ...b, tasks: b.tasks.map(fix) };
    });
    return run('/backlog/order', 'PUT', { type, ids, reset });
  };

  return {
    busy: mutation.isPending,
    reorder,
    createInitiative: (b: Body) => run('/initiatives', 'POST', b) as Promise<InitiativeDto>,
    updateInitiative: (id: string, b: Body) => run(`/initiatives/${id}`, 'PATCH', b) as Promise<InitiativeDto>,
    deleteInitiative: (id: string) => run(`/initiatives/${id}`, 'DELETE'),
    duplicateInitiative: (id: string) => run(`/initiatives/${id}/duplicate`) as Promise<InitiativeDto>,
    completeInitiative: (id: string) => run(`/initiatives/${id}/complete`) as Promise<{ initiative: InitiativeDto; doneTasks: number; xp: XpChange }>,
    reopenInitiative: (id: string) => run(`/initiatives/${id}/reopen`),

    createEpic: (b: Body) => run('/epics', 'POST', b) as Promise<EpicDto>,
    updateEpic: (id: string, b: Body) => run(`/epics/${id}`, 'PATCH', b) as Promise<EpicDto>,
    deleteEpic: (id: string) => run(`/epics/${id}`, 'DELETE'),
    duplicateEpic: (id: string) => run(`/epics/${id}/duplicate`) as Promise<EpicDto>,
    closeEpic: (id: string) => run(`/epics/${id}/close`) as Promise<{ epic: EpicDto; doneTasks: number; xp: XpChange }>,
    reopenEpic: (id: string) => run(`/epics/${id}/reopen`),

    createTask: (b: Body) => run('/tasks', 'POST', b) as Promise<TaskDto>,
    updateTask: (id: string, b: Body) => run(`/tasks/${id}`, 'PATCH', b) as Promise<TaskDto>,
    deleteTask: (id: string) => run(`/tasks/${id}`, 'DELETE'),
    duplicateTask: (id: string) => run(`/tasks/${id}/duplicate`) as Promise<TaskDto>,
    addToCalendar: (id: string) => run(`/tasks/${id}/calendar`, 'POST') as Promise<TaskDto>,
    removeFromCalendar: (id: string) => run(`/tasks/${id}/calendar`, 'DELETE') as Promise<TaskDto>,
    moveTask: (id: string, status: TaskStatus) => {
      // Atualiza a tela na hora (sem esperar a API), para o arrastar ficar fluido.
      qc.setQueryData<BacklogDto>(BACKLOG_KEY, b =>
        b && { ...b, tasks: b.tasks.map(t => (t.id === id ? { ...t, status, archivedAt: null, doneAt: status === 'done' ? new Date().toISOString() : null } : t)) },
      );
      return (run(`/tasks/${id}/move`, 'POST', { status }) as Promise<{ task: TaskDto; from: TaskStatus; xp: XpChange }>).then(r => {
        if (status === 'done' && r.from !== 'done') {
          // Sempre pergunta se quer compartilhar a conclusão (decisão do dono do projeto).
          const b = qc.getQueryData<BacklogDto>(BACKLOG_KEY);
          const area = (r.task.areas[0] ?? (b && b.epics.find(e => e.id === r.task.epicId)?.area)) ?? null;
          openSheet(close => <SharePrompt draft={{ title: r.task.title, text: '', area, refType: 'task', refId: r.task.id }} xp={r.xp.gained} onClose={close} />);
        } else if (r.xp.gained > 0) toast(`Tarefa concluída, +${r.xp.gained} XP`);
        return r;
      });
    },
  };
}
