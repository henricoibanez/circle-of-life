'use client';

import type { BacklogDto, SprintDto, SprintOverviewDto, XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toasts';
import { api, ApiError, type Me } from './api';
import { BACKLOG_KEY } from './backlog';

export const SPRINTS_KEY = ['sprints'];

/** Sprint atual (iniciada ou em planejamento) e histórico. */
export function useSprints() {
  return useQuery({ queryKey: SPRINTS_KEY, queryFn: () => api<SprintOverviewDto>('/sprints') });
}

/** Tarefas que estão no quadro: A Fazer, Fazendo e Pronto, ainda não arquivadas. */
export const boardTasks = (b: BacklogDto) => b.tasks.filter(t => (t.status === 'todo' || t.status === 'doing' || t.status === 'done') && !t.archivedAt);

export type SprintEdit = { name?: string; description?: string; length?: number };
export type CloseSprintResult = { closed: SprintDto; next: SprintDto; done: number; open: number; full: boolean; xp: XpChange };

function useSprintMutation<A, R>(fn: (a: A) => Promise<R>, fail: string, done?: (r: R) => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: r => {
      done?.(r);
      qc.invalidateQueries({ queryKey: SPRINTS_KEY });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
    },
    onError: e => toast(e instanceof ApiError ? e.message : fail),
  });
}

/** Nome, descrição e duração da sprint atual. */
export function useUpdateSprint() {
  return useSprintMutation((b: SprintEdit) => api<SprintDto>('/sprints/current', { method: 'PATCH', body: b }), 'Não foi possível salvar a sprint.');
}

/** "Iniciar sprint". */
export function useStartSprint() {
  const qc = useQueryClient();
  return useSprintMutation(
    (b: SprintEdit) => api<{ sprint: SprintDto; removed: number }>('/sprints/current/start', { method: 'POST', body: b }),
    'Não foi possível iniciar a sprint.',
    () => qc.invalidateQueries({ queryKey: ['journey'] }),
  );
}

export function useCloseSprint() {
  const qc = useQueryClient();
  return useSprintMutation(
    () => api<CloseSprintResult>('/sprints/current/close', { method: 'POST' }),
    'Não foi possível encerrar a sprint.',
    r => qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, disponivel: r.xp.disponivel } }),
  );
}

/** "23 out" */
export const fmtShort = (d: string | Date) =>
  new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ');
/** "23/10" */
export const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Período da sprint para mostrar: "23 out a 5 nov", "desde 23 out · sem prazo" ou "Ainda não começou". */
export const sprintPeriod = (s: SprintDto) =>
  !s.startAt ? 'Ainda não começou' : s.plannedEnd ? `${fmtShort(s.startAt)} a ${fmtShort(s.plannedEnd)}` : `desde ${fmtShort(s.startAt)} · sem prazo`;
