'use client';

import type { AreaId, StoryGroupDto, StoryViewerDto, Visibility, XpChange , ReactionKind } from '@circle/shared';
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
      qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, gems: r.xp.gems } });
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
    /** Reagir ao story (curtir, não curtir, coração); `null` tira a reação. */
    react: (id: string, kind: ReactionKind | null, prev: ReactionKind | null) => {
      patch(id, s => ({ ...s, liked: Boolean(kind), myReaction: kind }));
      return api(`/stories/${id}/like`, kind ? { method: 'PUT', body: { kind } } : { method: 'DELETE' }).catch(e => {
        patch(id, s => ({ ...s, liked: Boolean(prev), myReaction: prev }));
        throw e;
      });
    },
    /** Ao fechar o visualizador, a fileira volta para a ordem certa (não vistos primeiro). */
    refresh: () => qc.invalidateQueries({ queryKey: STORIES_KEY }),
  };
}
