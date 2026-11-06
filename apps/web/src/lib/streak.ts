'use client';

import type { StreakDto } from '@circle/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const STREAK_KEY = ['streak'];

/** Ofensiva e acessos do mês (perfil e modal da ofensiva). */
export function useStreak() {
  return useQuery({ queryKey: STREAK_KEY, queryFn: () => api<StreakDto>('/me/streak') });
}
