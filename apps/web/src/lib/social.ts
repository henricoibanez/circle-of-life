'use client';

import type { AreaId, FriendsDto, GroupDetailDto, GroupInviteSearchDto, GroupListDto, MiniProfileDto } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const FRIENDS_KEY = ['friends'];
export const GROUPS_KEY = ['groups'];

export function useFriends() {
  return useQuery({ queryKey: FRIENDS_KEY, queryFn: () => api<FriendsDto>('/friends') });
}

export function useGroups() {
  return useQuery({ queryKey: GROUPS_KEY, queryFn: () => api<GroupListDto>('/groups') });
}

export function useGroup(id: string) {
  return useQuery({ queryKey: ['group', id], queryFn: () => api<GroupDetailDto>(`/groups/${id}`), retry: false });
}

export type GroupInput = { name: string; description: string; area: AreaId; coverFileId?: string | null; private?: boolean };

/** Gestor: busca pessoas do app para convidar ao grupo. */
export function useInviteSearch(groupId: string, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['group-invite-search', groupId, term],
    queryFn: () => api<GroupInviteSearchDto[]>(`/groups/${groupId}/invite-search?q=${encodeURIComponent(term)}`),
    enabled: term.replace(/^@/, '').length >= 2,
  });
}

export function useSocialActions() {
  const qc = useQueryClient();
  const friends = () => qc.invalidateQueries({ queryKey: FRIENDS_KEY });
  const groups = (g?: GroupDetailDto) => {
    if (g) qc.setQueryData(['group', g.id], g);
    qc.invalidateQueries({ queryKey: GROUPS_KEY });
    return g;
  };
  return {
    request: (who: string) => api<{ status: 'enviado' | 'amigos' }>('/friends/requests', { method: 'POST', body: { who } }).finally(friends),
    accept: (id: string) => api(`/friends/requests/${id}/accept`, { method: 'POST' }).finally(friends),
    dismiss: (id: string) => api(`/friends/requests/${id}`, { method: 'DELETE' }).finally(friends),
    unfriend: (userId: string) => api(`/friends/${userId}`, { method: 'DELETE' }).finally(friends),

    create: (body: GroupInput) => api<GroupDetailDto>('/groups', { method: 'POST', body }).then(groups),
    update: (id: string, body: Partial<GroupInput>) => api<GroupDetailDto>(`/groups/${id}`, { method: 'PATCH', body }).then(groups),
    remove: (id: string) =>
      api(`/groups/${id}`, { method: 'DELETE' }).then(() => {
        qc.removeQueries({ queryKey: ['group', id] });
        return groups();
      }),
    join: (id: string) => api<GroupDetailDto>(`/groups/${id}/join`, { method: 'POST' }).then(groups),
    leave: (id: string) =>
      api(`/groups/${id}/membership`, { method: 'DELETE' }).then(() => {
        qc.invalidateQueries({ queryKey: ['group', id] });
        return groups();
      }),
    addTrilha: (id: string, trilhaId: string) => api<GroupDetailDto>(`/groups/${id}/trilhas`, { method: 'POST', body: { trilhaId } }).then(groups),
    removeTrilha: (id: string, trilhaId: string) => api<GroupDetailDto>(`/groups/${id}/trilhas/${trilhaId}`, { method: 'DELETE' }).then(groups),
    /** Tornar gestor (role "admin") ou membro comum. */
    setRole: (id: string, userId: string, role: 'admin' | 'member') => api<GroupDetailDto>(`/groups/${id}/members/${userId}/role`, { method: 'PUT', body: { role } }).then(groups),
    removeMember: (id: string, userId: string) => api<GroupDetailDto>(`/groups/${id}/members/${userId}`, { method: 'DELETE' }).then(groups),
    banMember: (id: string, userId: string) => api<GroupDetailDto>(`/groups/${id}/members/${userId}/ban`, { method: 'POST' }).then(groups),
    unban: (id: string, userId: string) => api<GroupDetailDto>(`/groups/${id}/bans/${userId}`, { method: 'DELETE' }).then(groups),
    /** Cancelar o meu pedido para entrar ou recusar o convite que recebi. */
    cancelRequest: (id: string) => api<GroupDetailDto>(`/groups/${id}/request`, { method: 'DELETE' }).then(groups),
    approve: (id: string, userId: string) => api<GroupDetailDto>(`/groups/${id}/requests/${userId}/approve`, { method: 'POST' }).then(groups),
    reject: (id: string, userId: string, reason?: string) => api<GroupDetailDto>(`/groups/${id}/requests/${userId}/reject`, { method: 'POST', body: { reason } }).then(groups),
    invite: (id: string, userId: string) =>
      api<GroupDetailDto>(`/groups/${id}/invites`, { method: 'POST', body: { userId } }).then(g => {
        qc.invalidateQueries({ queryKey: ['group-invite-search', id] });
        return groups(g);
      }),
    cancelInvite: (id: string, userId: string) => api<GroupDetailDto>(`/groups/${id}/invites/${userId}`, { method: 'DELETE' }).then(groups),

    /** Bloquear/desbloquear: o bloqueio mexe em feed, stories, busca e amizade. */
    block: (id: string) => api<MiniProfileDto>(`/people/${id}/block`, { method: 'POST' }).then(afterBlock),
    unblock: (id: string) => api<MiniProfileDto>(`/people/${id}/block`, { method: 'DELETE' }).then(afterBlock),
  };
  function afterBlock(p: MiniProfileDto) {
    qc.setQueryData(['profile', p.id], p);
    friends();
    qc.invalidateQueries({ queryKey: GROUPS_KEY });
    qc.invalidateQueries({ queryKey: ['feed'] });
    qc.invalidateQueries({ queryKey: ['stories'] });
    return p;
  }
}

/** Mini-perfil (modal ao tocar na foto). */
export function useProfile(id: string | null) {
  return useQuery({ queryKey: ['profile', id], queryFn: () => api<MiniProfileDto>(`/people/${id}`), enabled: Boolean(id) });
}
