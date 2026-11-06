'use client';

import type { AreaId, CommentDto, FeedFilter, FeedPageDto, PostDto, PostRefType, Visibility, XpChange , ReactionKind } from '@circle/shared';
import { type InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from './api';

export const FEED_KEY = ['feed'];

export type FeedParams = { filter?: FeedFilter; area?: AreaId; author?: string; group?: string };

export function useFeed(p: FeedParams) {
  return useInfiniteQuery({
    queryKey: [...FEED_KEY, p],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams(Object.entries({ ...p, cursor: pageParam }).filter((e): e is [string, string] => Boolean(e[1])));
      return api<FeedPageDto>(`/feed?${q}`);
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function usePost(id: string | null) {
  return useQuery({ queryKey: ['post', id], queryFn: () => api<PostDto>(`/posts/${id}`), enabled: Boolean(id), retry: false });
}

export function useComments(id: string) {
  return useQuery({ queryKey: ['comments', id], queryFn: () => api<CommentDto[]>(`/posts/${id}/comments`) });
}

export type PostBody = {
  title?: string;
  text?: string;
  areas?: AreaId[];
  groupIds?: string[];
  visibility?: Visibility;
  tags?: string[];
  mediaIds?: string[];
  refType?: PostRefType;
  refId?: string;
};

export function useFeedActions() {
  const qc = useQueryClient();

  /** Muda um post em todas as listas do feed já carregadas (para curtir e salvar na hora). */
  const patch = (id: string, fn: (p: PostDto) => PostDto) => {
    qc.setQueriesData<InfiniteData<FeedPageDto>>({ queryKey: FEED_KEY }, d => d && { ...d, pages: d.pages.map(pg => ({ ...pg, posts: pg.posts.map(p => (p.id === id ? fn(p) : p)) })) });
    qc.setQueryData<PostDto>(['post', id], p => p && fn(p));
  };
  const setXp = (xp: XpChange) => qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: xp.total, gems: xp.gems } });
  const refresh = () => qc.invalidateQueries({ queryKey: FEED_KEY });

  return {
    create: async (body: PostBody) => {
      const r = await api<{ post: PostDto; xp: XpChange }>('/posts', { method: 'POST', body });
      setXp(r.xp);
      refresh();
      return r;
    },
    update: async (id: string, body: Partial<PostBody>) => {
      const p = await api<PostDto>(`/posts/${id}`, { method: 'PATCH', body });
      patch(id, () => p);
      return p;
    },
    remove: async (id: string) => {
      await api(`/posts/${id}`, { method: 'DELETE' });
      qc.setQueriesData<InfiniteData<FeedPageDto>>({ queryKey: FEED_KEY }, d => d && { ...d, pages: d.pages.map(pg => ({ ...pg, posts: pg.posts.filter(p => p.id !== id) })) });
      qc.removeQueries({ queryKey: ['post', id] });
    },
    like: (p: PostDto) => {
      const on = !p.liked;
      patch(p.id, x => ({ ...x, liked: on, likes: x.likes + (on ? 1 : -1) }));
      return api(`/posts/${p.id}/like`, { method: on ? 'PUT' : 'DELETE' }).catch(e => {
        patch(p.id, x => ({ ...x, liked: !on, likes: x.likes + (on ? -1 : 1) }));
        throw e;
      });
    },
    save: (p: PostDto) => {
      const on = !p.saved;
      patch(p.id, x => ({ ...x, saved: on }));
      return api(`/posts/${p.id}/save`, { method: on ? 'PUT' : 'DELETE' }).then(
        () => {
          if (!on) qc.invalidateQueries({ queryKey: [...FEED_KEY, { filter: 'salvos' }] });
          return on;
        },
        e => {
          patch(p.id, x => ({ ...x, saved: !on }));
          throw e;
        },
      );
    },
    comment: async (id: string, text: string) => {
      const r = await api<{ comments: CommentDto[]; xp: XpChange }>(`/posts/${id}/comments`, { method: 'POST', body: { text } });
      qc.setQueryData(['comments', id], r.comments);
      patch(id, x => ({ ...x, comments: r.comments.length }));
      setXp(r.xp);
      return r;
    },
    /** Reagir a um comentário (curtir, não curtir, coração); `null` tira a reação. */
    reactComment: async (id: string, commentId: string, kind: ReactionKind | null) => {
      const list = await api<CommentDto[]>(`/posts/${id}/comments/${commentId}/reaction`, kind ? { method: 'PUT', body: { kind } } : { method: 'DELETE' });
      qc.setQueryData<CommentDto[]>(['comments', id], list);
    },
    removeComment: async (id: string, commentId: string) => {
      await api(`/posts/${id}/comments/${commentId}`, { method: 'DELETE' });
      const list = qc.setQueryData<CommentDto[]>(['comments', id], c => c?.filter(x => x.id !== commentId));
      patch(id, x => ({ ...x, comments: list?.length ?? x.comments - 1 }));
    },
  };
}

/** Texto para copiar ao "compartilhar" um post (como no protótipo). */
export const postText = (p: Pick<PostDto, 'title' | 'text'>) => [p.title, p.text].filter(Boolean).join('\n');
