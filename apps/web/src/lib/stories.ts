'use client';

import type { AreaId, StoryGroupDto, StoryViewerDto, Visibility, XpChange } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from './api';

export const STORIES_KEY = ['stories'];

export function useStories() {
  return useQuery({ queryKey: STORIES_KEY, queryFn: () => api<StoryGroupDto[]>('/stories'), refetchInterval: 5 * 60_000 });
}

export function useStoryViewers(id: string) {
  return useQuery({ queryKey: ['story-viewers', id], queryFn: () => api<StoryViewerDto[]>(`/stories/${id}/viewers`) });
}

export function useStoryActions() {
  const qc = useQueryClient();
  const patch = (id: string, fn: (s: StoryGroupDto['stories'][number]) => StoryGroupDto['stories'][number]) =>
    qc.setQueryData<StoryGroupDto[]>(STORIES_KEY, gs =>
      gs?.map(g => {
        const stories = g.stories.map(s => (s.id === id ? fn(s) : s));
        return { ...g, stories, allSeen: stories.every(s => s.seen) };
      }),
    );
  return {
    create: async (body: { fileId: string; areas: AreaId[]; caption: string; visibility: Visibility }) => {
      const r = await api<{ id: string; xp: XpChange }>('/stories', { method: 'POST', body });
      qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, disponivel: r.xp.disponivel } });
      await qc.invalidateQueries({ queryKey: STORIES_KEY });
      return r;
    },
    remove: async (id: string) => {
      await api(`/stories/${id}`, { method: 'DELETE' });
      qc.setQueryData<StoryGroupDto[]>(STORIES_KEY, gs => gs?.map(g => ({ ...g, stories: g.stories.filter(s => s.id !== id) })).filter(g => g.stories.length));
    },
    /** Marca como visto (só na tela na hora; a API registra para o "Visto por"). */
    view: (id: string) => {
      patch(id, s => ({ ...s, seen: true }));
      return api(`/stories/${id}/view`, { method: 'POST' }).catch(() => undefined);
    },
    like: (id: string, on: boolean) => {
      patch(id, s => ({ ...s, liked: on }));
      return api(`/stories/${id}/like`, { method: on ? 'PUT' : 'DELETE' }).catch(e => {
        patch(id, s => ({ ...s, liked: !on }));
        throw e;
      });
    },
    /** Ao fechar o visualizador, a fileira volta para a ordem certa (não vistos primeiro). */
    refresh: () => qc.invalidateQueries({ queryKey: STORIES_KEY }),
  };
}
