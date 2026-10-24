'use client';

import { useQuery } from '@tanstack/react-query';
import { api, ApiError, logout, type Me } from './api';

/** Dados da pessoa logada (cache compartilhado por todas as telas). */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/me');
      } catch (e) {
        // Sessão expirada ou inválida: apaga o cookie e volta para o login.
        if (e instanceof ApiError && e.status === 401) await logout();
        throw e;
      }
    },
    staleTime: 60_000,
  });
}
