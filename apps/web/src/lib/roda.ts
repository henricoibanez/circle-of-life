'use client';

import type { AreaId, RodaDto, XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useToast } from '@/components/toasts';
import { api, ApiError, type Me } from './api';

export const RODA_KEY = ['roda'];

export function useRoda() {
  return useQuery({ queryKey: RODA_KEY, queryFn: () => api<RodaDto>('/roda') });
}

/**
 * Mudar uma nota: a tela muda na hora e o envio à API espera o dedo parar
 * no controle deslizante (para não mandar um pedido a cada passo).
 */
export function useSetScore() {
  const qc = useQueryClient();
  const toast = useToast();
  const pending = useRef<Partial<Record<AreaId, number>>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (area: AreaId, score: number) => {
    qc.setQueryData<RodaDto>(RODA_KEY, r => r && { ...r, rated: true, scores: { ...r.scores, [area]: score } });
    pending.current[area] = score;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const scores = pending.current;
      pending.current = {};
      api<RodaDto>('/roda/scores', { method: 'PUT', body: { scores } }).catch(e => {
        toast(e instanceof ApiError ? e.message : 'Não foi possível salvar a nota.');
        qc.invalidateQueries({ queryKey: RODA_KEY });
      });
    }, 500);
  };
}

export function useSnapshot() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api<{ xp: XpChange }>('/roda/snapshots', { method: 'POST' }),
    onSuccess: r => {
      qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, disponivel: r.xp.disponivel } });
      qc.invalidateQueries({ queryKey: RODA_KEY });
      toast(r.xp.gained > 0 ? `Avaliação registrada, +${r.xp.gained} XP` : 'Avaliação registrada');
    },
    onError: e => toast(e instanceof ApiError ? e.message : 'Não foi possível registrar.'),
  });
}
