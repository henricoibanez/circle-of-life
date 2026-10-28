'use client';

import type { AreaId, FriendsDto, GroupDetailDto, GroupDto } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const FRIENDS_KEY = ['friends'];
export const GROUPS_KEY = ['groups'];

export function useFriends() {
  return useQuery({ queryKey: FRIENDS_KEY, queryFn: () => api<FriendsDto>('/friends') });
}

export function useGroups() {
  return useQuery({ queryKey: GROUPS_KEY, queryFn: () => api<{ mine: GroupDto[]; suggested: GroupDto[] }>('/groups') });
}

export function useGroup(id: string) {
  return useQuery({ queryKey: ['group', id], queryFn: () => api<GroupDetailDto>(`/groups/${id}`), retry: false });
}

export type GroupInput = { name: string; description: string; area: AreaId; coverFileId?: string | null };

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
  };
}
