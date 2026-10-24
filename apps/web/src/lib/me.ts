'use client';

import { useQuery } from '@tanstack/react-query';
import { api, ApiError, type Me } from './api';

/** Dados da pessoa logada (cache compartilhado por todas as telas). */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/me');
      } catch (e) {
        // Sessão expirada ou inválida: volta para o login.
        if (e instanceof ApiError && e.status === 401) window.location.href = '/login';
        throw e;
      }
    },
    staleTime: 60_000,
  });
}
