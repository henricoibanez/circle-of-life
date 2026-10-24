'use client';

import type { AreaId, BacklogDto, EpicDto, InitiativeDto, TaskDto, TaskStatus, XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toasts';
import { api, ApiError, type Me } from './api';

export const BACKLOG_KEY = ['backlog'];

/** Backlog completo (iniciativas, épicos e tarefas) da pessoa logada. */
export function useBacklog() {
  return useQuery({ queryKey: BACKLOG_KEY, queryFn: () => api<BacklogDto>('/backlog') });
}

// ---------- Seletores (iguais aos do protótipo) ----------

export const epicTasks = (b: BacklogDto, epicId: string) => b.tasks.filter(t => t.epicId === epicId);
export const initEpics = (b: BacklogDto, initiativeId: string) => b.epics.filter(e => e.initiativeId === initiativeId);
export const taskArea = (b: BacklogDto, t: TaskDto): AreaId | undefined => b.epics.find(e => e.id === t.epicId)?.area;
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
  const mutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: Body }) => api<any>(path, { method, body }),
    onSuccess: (data: { xp?: XpChange } | undefined) => {
      // Ações que mexem no XP devolvem os totais novos: o número aparece atualizado na hora.
      if (data?.xp) qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: data.xp!.total, disponivel: data.xp!.disponivel } });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      qc.invalidateQueries({ queryKey: ['sprints'] });
    },
    onError: e => {
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
    },
  });
  const run = (path: string, method = 'POST', body?: Body) => mutation.mutateAsync({ path, method, body });

  return {
    busy: mutation.isPending,
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
    moveTask: (id: string, status: TaskStatus) => {
      // Atualiza a tela na hora (sem esperar a API), para o arrastar ficar fluido.
      qc.setQueryData<BacklogDto>(BACKLOG_KEY, b =>
        b && { ...b, tasks: b.tasks.map(t => (t.id === id ? { ...t, status, archivedAt: null, doneAt: status === 'done' ? new Date().toISOString() : null } : t)) },
      );
      return (run(`/tasks/${id}/move`, 'POST', { status }) as Promise<{ task: TaskDto; from: TaskStatus; xp: XpChange }>).then(r => {
        if (r.xp.gained > 0) toast(`Tarefa concluída, +${r.xp.gained} XP`);
        return r;
      });
    },
  };
}
