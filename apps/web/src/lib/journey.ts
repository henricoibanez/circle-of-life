'use client';

import { MINHA_VIDA_PHASES, type JourneyDto, type SocialStatus, type XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Me } from './api';
import { useMe } from './me';

export const JOURNEY_KEY = ['journey'];

/** Progresso da Jornada de primeiro acesso (recarrega ao abrir cada tela que usa). Com `enabled = false`, não busca. */
export function useJourney(enabled = true) {
  return useQuery({ queryKey: JOURNEY_KEY, queryFn: () => api<JourneyDto>('/journey'), enabled });
}

/** Minha vida (as 4 primeiras fases) completa: o quadro destranca. */
export const minhaVidaDone = (j: JourneyDto) => !j.active || MINHA_VIDA_PHASES.every(id => j.phases.find(p => p.id === id)?.done);

/** Quadro trancado: a pessoa está na Jornada e ainda não completou Minha vida. Null enquanto carrega. */
export function useBoardLocked() {
  const { data: me } = useMe();
  const { data: j } = useJourney();
  if (!me) return null;
  if (!me.journey || me.journeyFinished) return false;
  return j ? !minhaVidaDone(j) : null;
}

/** A pessoa ainda está na Jornada (a aba Jornada fica no lugar do Feed até liberar tudo). */
export const journeyActive = (me: Me | undefined) => Boolean(me?.journey && !me.social.open);

/** A pessoa está fazendo as etapas da Jornada (ainda não apertou "Concluir minha jornada"). */
export const inJourney = (me: Me | undefined) => Boolean(me?.journey && !me.journeyFinished);

/** Rede social, amigos, grupos e a loja completa ainda trancados. */
export const socialLocked = (me: Me | undefined) => Boolean(me && !me.social.open);

/** O XP aparece só depois de "Concluir minha jornada" (antes disso a pessoa ainda não sabe o que é). */
export const xpVisible = (me: Me | undefined) => Boolean(me && (!me.journey || me.journeyFinished));

/** Já passou o prazo de 7 dias: dá para concluir a Jornada de graça. */
export const freeNow = (s: Pick<SocialStatus, 'freeAt'>) => Boolean(s.freeAt && new Date(s.freeAt) <= new Date());

/** Dias que faltam para liberar de graça (mínimo 1 enquanto não chegou). */
export const daysLeft = (freeAt: string) => Math.max(1, Math.ceil((new Date(freeAt).getTime() - Date.now()) / 86_400_000));

function useJourneyMutation<R>(fn: () => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: JOURNEY_KEY });
    },
  });
}

/** "Concluir minha jornada": prêmio de XP e começa a contar os 7 dias. Atualiza o XP na hora (o pop-up mostra os números). */
export function useFinishJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ xp: XpChange; social: SocialStatus }>('/journey/finish', { method: 'POST' }),
    onSuccess: r => {
      qc.setQueryData<Me>(['me'], m => m && { ...m, journeyFinished: true, social: r.social, xp: { total: r.xp.total, gems: r.xp.gems } });
      qc.invalidateQueries({ queryKey: JOURNEY_KEY });
    },
  });
}

/** Liberar tudo: por 500 XP, ou de graça depois dos 7 dias. */
export const useUnlockSocial = () => useJourneyMutation(() => api<{ paid: number; xp: XpChange }>('/journey/social/unlock', { method: 'POST' }));

export function useJourneySeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phase: number) => api('/journey/seen', { method: 'POST', body: { phase } }),
    onMutate: phase => qc.setQueryData<JourneyDto>(JOURNEY_KEY, j => j && { ...j, phaseSeen: Math.max(j.phaseSeen, phase) }),
  });
}

export function useJourneyWelcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/journey/welcome', { method: 'POST' }),
    onSuccess: () => qc.setQueryData<JourneyDto>(JOURNEY_KEY, j => j && { ...j, welcomed: true }),
  });
}
