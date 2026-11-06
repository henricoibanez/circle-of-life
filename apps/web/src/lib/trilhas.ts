'use client';

import type { AreaId, TrilhaDetailDto, TrilhaDto, TrilhaImportInput, XpChange } from '@circle/shared';
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
    // Aprovar, recusar ou tirar do ar também muda a página do grupo.
    qc.invalidateQueries({ queryKey: ['group'] });
    if (id) qc.invalidateQueries({ queryKey: ['trilha', id] });
  };
  return {
    favorite: (id: string, on: boolean) => api(`/trilhas/${id}/favorite`, { method: on ? 'PUT' : 'DELETE' }).then(() => refresh(id)),
    approve: (id: string) => api(`/trilhas/${id}/approve`, { method: 'POST' }).then(() => refresh(id)),
    reject: (id: string, reason: string) => api(`/trilhas/${id}/reject`, { method: 'POST', body: { reason } }).then(() => refresh(id)),
    unpublish: (id: string) => api(`/trilhas/${id}/unpublish`, { method: 'POST' }).then(() => refresh(id)),
    /** Importa o épico para uma iniciativa sua ou para uma nova. */
    import: async (id: string, target: TrilhaImportInput) => {
      const r = await api<{ initiativeId: string; epicId: string; paid: number; xp: XpChange }>(`/trilhas/${id}/import`, { method: 'POST', body: target });
      qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, gems: r.xp.gems } });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      refresh(id);
      return r;
    },
    /** Publica um épico na loja ou, com groupId, no grupo. */
    publish: async (epicId: string, body: Record<string, unknown>) => {
      const r = await api<TrilhaDetailDto>(`/epics/${epicId}/publish`, { method: 'POST', body });
      refresh();
      if (r.groupId) qc.invalidateQueries({ queryKey: ['group', r.groupId] });
      return r;
    },
    /** Gestor edita uma trilha do grupo. */
    edit: async (id: string, body: { title?: string; description?: string; area?: AreaId; tasks?: string[] }) => {
      const r = await api<TrilhaDetailDto>(`/trilhas/${id}`, { method: 'PATCH', body });
      qc.setQueryData(['trilha', id], r);
      if (r.groupId) qc.invalidateQueries({ queryKey: ['group', r.groupId] });
      return r;
    },
  };
}

/** "12,4k" (como no protótipo). */
export const kfmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k' : String(n));
