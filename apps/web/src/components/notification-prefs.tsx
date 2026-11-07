'use client';

import {
  CATEGORY_INFO,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_VOLUMES,
  type NotificationCategory,
  type NotificationPrefsDto,
  type NotificationVolume,
} from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, inputCls, Seg } from './primitives';
import { useToast } from './toasts';
import { api } from '@/lib/api';

const KEY = ['notifications', 'prefs'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const VOLUMES = (Object.keys(NOTIFICATION_VOLUMES) as NotificationVolume[]).map(id => ({ id, label: NOTIFICATION_VOLUMES[id].label }));

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`h-6 w-10 shrink-0 rounded-full p-0.5 transition disabled:opacity-40 ${on ? 'bg-primary' : 'bg-line'}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

/** Preferências de notificação: quantos lembretes, horário de silêncio e o que receber no sino e no celular. */
export function NotificationPrefsCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: p } = useQuery({ queryKey: KEY, queryFn: () => api<NotificationPrefsDto>('/notifications/prefs') });
  if (!p) return null;

  const save = async (patch: Partial<NotificationPrefsDto>) => {
    const next = { ...p, ...patch };
    qc.setQueryData(KEY, next);
    try {
      qc.setQueryData(KEY, await api<NotificationPrefsDto>('/notifications/prefs', { method: 'PUT', body: patch }));
    } catch (e) {
      qc.setQueryData(KEY, p);
      toast(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };
  const toggle = (list: 'offBell' | 'offPush', c: NotificationCategory) =>
    save({ [list]: p[list].includes(c) ? p[list].filter(x => x !== c) : [...p[list], c] });
  const v = NOTIFICATION_VOLUMES[p.volume];

  return (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">Avisos</h2>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Quantos lembretes do app</p>
        <Seg items={VOLUMES} value={p.volume} onChange={volume => save({ volume })} />
        <p className="text-xs text-muted">
          Até {v.perDay} por dia e {v.perWeek} por semana (dicas, no máximo uma por dia). Avisos de pessoas, novidades e pesquisas não contam.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Horário de silêncio</p>
        <div className="flex items-center gap-2 text-sm">
          Das
          <select aria-label="Início do silêncio" className={`${inputCls} w-auto`} value={p.quietStart} onChange={e => save({ quietStart: Number(e.target.value) })}>
            {HOURS.map(h => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
          às
          <select aria-label="Fim do silêncio" className={`${inputCls} w-auto`} value={p.quietEnd} onChange={e => save({ quietEnd: Number(e.target.value) })}>
            {HOURS.map(h => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted">Nesse horário nada vai para o celular. O sino continua recebendo.</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-3 text-xs font-semibold text-muted">
          <span className="flex-1">O que receber</span>
          <span className="w-10 text-center">Sino</span>
          <span className="w-10 text-center">Celular</span>
        </div>
        {NOTIFICATION_CATEGORIES.map(c => {
          const bell = !p.offBell.includes(c);
          return (
            <div key={c} className="flex items-center gap-3 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{CATEGORY_INFO[c].label}</p>
                <p className="text-xs text-muted">{CATEGORY_INFO[c].hint}</p>
              </div>
              <Switch on={bell} label={`${CATEGORY_INFO[c].label} no sino`} onChange={() => toggle('offBell', c)} />
              <Switch on={bell && !p.offPush.includes(c)} disabled={!bell} label={`${CATEGORY_INFO[c].label} no celular`} onChange={() => toggle('offPush', c)} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
