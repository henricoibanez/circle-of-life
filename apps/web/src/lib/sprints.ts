'use client';

import type { SprintDto, SprintOverviewDto, XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toasts';
import { api, ApiError, type Me } from './api';
import { BACKLOG_KEY } from './backlog';

export const SPRINTS_KEY = ['sprints'];

/** Sprint atual e histórico. */
export function useSprints() {
  return useQuery({ queryKey: SPRINTS_KEY, queryFn: () => api<SprintOverviewDto>('/sprints') });
}

export type CloseSprintResult = { closed: SprintDto; next: SprintDto; done: number; open: number; full: boolean; xp: XpChange };

export function useCloseSprint() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api<CloseSprintResult>('/sprints/current/close', { method: 'POST' }),
    onSuccess: r => {
      qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, disponivel: r.xp.disponivel } });
      qc.invalidateQueries({ queryKey: SPRINTS_KEY });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
    },
    onError: e => toast(e instanceof ApiError ? e.message : 'Não foi possível encerrar a sprint.'),
  });
}

/** "23 out" */
export const fmtShort = (d: string | Date) =>
  new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ');
/** "23/10" */
export const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
