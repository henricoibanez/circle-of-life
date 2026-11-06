'use client';

import { type CheckinDto, gemsLabel, type StreakDto } from '@circle/shared';
import { CoinIcon } from '@/components/coin';
import { Icon } from '@/components/icon';
import { Sheet, useSheets } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api, type Me } from '@/lib/api';
import { xpVisible } from '@/lib/journey';
import { useMe } from '@/lib/me';
import { STREAK_KEY, useStreak } from '@/lib/streak';

const WEEK = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Os 7 dias da semana atual (segunda a domingo): os dias com acesso ficam com a chama. */
export function WeekDots({ s }: { s: Pick<StreakDto, 'diasSemana'> }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center">
      {WEEK.map((d, i) => (
        <span
          key={i}
          className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-[0.75rem] font-semibold ${s.diasSemana[i] ? 'bg-orange-500 text-white' : 'bg-sunk text-muted'}`}
        >
          {s.diasSemana[i] ? <Icon n="flame" className="h-4 w-4" fill="currentColor" sw={1} /> : d}
        </span>
      ))}
    </div>
  );
}

/**
 * Modal da ofensiva: aparece no 1º acesso do dia (fora da Jornada), com parabéns,
 * os dias de ofensiva, os círculos ganhos hoje e a semana (decisão do dono de 06/11/2026).
 */
export function StreakSheet({ r, onClose }: { r: CheckinDto; onClose: () => void }) {
  const { data: s } = useStreak();
  const dias = r.ofensiva === 1 ? '1 dia' : `${r.ofensiva} dias`;
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="burst mx-auto grid h-24 w-24 place-items-center rounded-full bg-orange-500/10 text-orange-500">
          <Icon n="flame" className="h-12 w-12" fill="currentColor" sw={1} />
        </div>
        <h2 className="mt-4 text-2xl font-bold">{r.ofensiva > 1 ? 'Parabéns! Você voltou mais um dia' : 'Parabéns por estar aqui hoje!'}</h2>
        <p className="mt-1 text-muted">
          Você está com <strong className="text-ink">{dias} de ofensiva</strong>.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-lg font-bold text-amber-700">
          <CoinIcon className="h-5 w-5" />+{gemsLabel(r.gemsGained)}
        </p>
      </div>
      {s && (
        <div className="mt-4 rounded-2xl bg-sunk/60 p-4">
          <p className="mb-3 text-center text-sm font-semibold">Sua semana</p>
          <WeekDots s={s} />
          <p className="mt-3 text-center text-xs text-muted">
            Volte amanhã e ganhe <strong>+{gemsLabel(s.proximoPremio)}</strong>. Cada dia seguido na semana rende mais.
          </p>
        </div>
      )}
      <Button className="mt-5 w-full" onClick={onClose}>
        Continuar
      </Button>
    </Sheet>
  );
}

/**
 * Ao abrir o app (uma vez por carregamento), conta o acesso do dia. No 1º acesso do dia,
 * fora da Jornada, abre o modal da ofensiva com os círculos ganhos. Na Jornada não aparece nada.
 */
export function DailyCheckin() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { openSheet } = useSheets();
  const done = useRef(false);
  useEffect(() => {
    if (!me || done.current) return;
    done.current = true;
    api<CheckinDto>('/me/checkin', { method: 'POST' })
      .then(r => {
        qc.invalidateQueries({ queryKey: STREAK_KEY });
        if (!r.gemsGained) return;
        qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { ...m.xp, gems: m.xp.gems + r.gemsGained } });
        if (xpVisible(me)) openSheet(close => <StreakSheet r={r} onClose={close} />);
      })
      .catch(() => undefined);
  }, [me, qc, openSheet]);
  return null;
}
