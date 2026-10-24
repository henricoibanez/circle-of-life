'use client';

import type { TrilhaDetailDto, TrilhaDto, XpChange } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from './api';
import { BACKLOG_KEY } from './backlog';

export const TRILHAS_KEY = ['trilhas'];

export function useTrilhas() {
  return useQuery({ queryKey: TRILHAS_KEY, queryFn: () => api<TrilhaDto[]>('/trilhas') });
}

export function useTrilha(id: string) {
  return useQuery({ queryKey: ['trilha', id], queryFn: () => api<TrilhaDetailDto>(`/trilhas/${id}`) });
}

export function useTrilhaActions() {
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    qc.invalidateQueries({ queryKey: TRILHAS_KEY });
    if (id) qc.invalidateQueries({ queryKey: ['trilha', id] });
  };
  return {
    favorite: (id: string, on: boolean) => api(`/trilhas/${id}/favorite`, { method: on ? 'PUT' : 'DELETE' }).then(() => refresh(id)),
    approve: (id: string) => api(`/trilhas/${id}/approve`, { method: 'POST' }).then(() => refresh(id)),
    reject: (id: string, reason: string) => api(`/trilhas/${id}/reject`, { method: 'POST', body: { reason } }).then(() => refresh(id)),
    unpublish: (id: string) => api(`/trilhas/${id}/unpublish`, { method: 'POST' }).then(() => refresh(id)),
    import: async (id: string) => {
      const r = await api<{ initiativeId: string; paid: number; xp: XpChange }>(`/trilhas/${id}/import`, { method: 'POST' });
      qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, disponivel: r.xp.disponivel } });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      refresh(id);
      return r;
    },
    publish: async (initiativeId: string, body: Record<string, unknown>) => {
      const r = await api<TrilhaDetailDto>(`/initiatives/${initiativeId}/publish`, { method: 'POST', body });
      refresh();
      return r;
    },
  };
}

/** "12,4k" (como no protótipo). */
export const kfmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k' : String(n));
