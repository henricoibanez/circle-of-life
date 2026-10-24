'use client';

import { MASLOW, MASLOW_ITEM_KEYS, maslowCurrentLevel, maslowItemKey, maslowLevelPct, type MaslowDto, type MaslowLevelId } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PyramidHill } from '@/components/art';
import { useBacklogSheets } from '@/components/backlog/use-backlog-sheets';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { ICON_PATHS } from '@/components/icon-paths';
import { Card, IconBtn, Ring, Tag } from '@/components/primitives';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { mix, tint } from '@/lib/color';
import { since } from '@/lib/time';

const KEY = ['maslow'];

/** A pirâmide desenhada em 5 faixas clicáveis (topo: autorrealização), como no protótipo. */
function PyramidLevels({ onSel }: { onSel: (id: MaslowLevelId) => void }) {
  const W = 220;
  const H = 170;
  const band = H / 5;
  const hw = (y: number) => (W / 2) * (y / H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pirâmide de Maslow">
      {[...MASLOW].reverse().map((m, i) => {
        const yb = H - i * band;
        const yt = yb - band + 3;
        const pts = [
          [W / 2 - hw(yb), yb],
          [W / 2 + hw(yb), yb],
          [W / 2 + hw(yt), yt],
          [W / 2 - hw(yt), yt],
        ]
          .map(p => p.join(','))
          .join(' ');
        return (
          <g key={m.id} onClick={() => onSel(m.id)} className="cursor-pointer">
            <polygon points={pts} fill={mix(m.color, '#ffffff', 0.1)} />
            <g transform={`translate(${W / 2 - 8} ${yb - band / 2 - 7}) scale(.66)`}>
              <path d={ICON_PATHS[m.icon as keyof typeof ICON_PATHS]} fill="#fff" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Pirâmide de Maslow: itens atendidos por nível, nível atual e reflexões. */
export default function MaslowPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const sheets = useBacklogSheets();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<MaslowDto>('/maslow') });
  const [open, setOpen] = useState<MaslowLevelId | null>('fis');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: (fn: () => Promise<MaslowDto>) => fn(),
    onSuccess: d => qc.setQueryData(KEY, d),
    onError: e => toast(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
  });

  const header = <Header title="Pirâmide de Maslow" sub="Seu progresso em direção à autorrealização" info="maslow" />;
  if (!data) return header;

  const checks = new Set(data.checks);
  const total = checks.size / MASLOW_ITEM_KEYS.length;
  const current = maslowCurrentLevel(checks);
  const toggle = (key: string) => {
    const checked = !checks.has(key);
    qc.setQueryData<MaslowDto>(KEY, d => d && { ...d, checks: checked ? [...d.checks, key] : d.checks.filter(k => k !== key) });
    save.mutate(() => api<MaslowDto>(`/maslow/checks/${key}`, { method: 'PUT', body: { checked } }));
  };

  return (
    <>
      {header}
      <div className="space-y-4 px-4 pb-8">
        <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-surface p-5 shadow-soft">
          <PyramidHill className="absolute -bottom-3 -right-6 w-32 opacity-70" />
          <div className="relative flex items-center gap-4">
            <div>
              <p className="mb-2 text-sm font-medium">Progresso geral</p>
              <Ring pct={total} size={112} stroke={9}>
                <span className="text-[28px] font-semibold">{Math.round(total * 100)}%</span>
              </Ring>
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <p className="text-[17px] font-semibold">Você está no caminho certo!</p>
              <p className="mt-1 text-sm text-muted">
                Nível atual: <strong style={{ color: current.color }}>{current.short ?? current.name}</strong> · {checks.size} de {MASLOW_ITEM_KEYS.length} itens
              </p>
              <Button variant="pline" className="mt-3 rounded-full bg-surface/80 px-3 py-1.5" asChild>
                <Link href="/analise">
                  <Icon n="chart" className="h-4 w-4" />
                  Ver insights
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <Card className="flex items-center gap-3 rounded-3xl p-4">
          <div className="w-[40%] shrink-0">
            <PyramidLevels onSel={setOpen} />
          </div>
          <div className="min-w-0 flex-1 divide-y divide-line rounded-2xl border border-line">
            {MASLOW.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setOpen(m.id);
                  document.getElementById('lv-' + m.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="flex w-full items-center gap-2 px-2.5 py-3 text-left"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} />
                <span className="flex-1 truncate text-[12.5px]">{m.short ?? m.name}</span>
                <span className="text-[12.5px] tabular-nums">{Math.round(maslowLevelPct(checks, m.id) * 100)}%</span>
              </button>
            ))}
          </div>
        </Card>

        {[...MASLOW].reverse().map(m => {
          const isOpen = open === m.id;
          const pct = maslowLevelPct(checks, m.id);
          const notes = data.notes.filter(n => n.level === m.id);
          return (
            <div
              key={m.id}
              id={'lv-' + m.id}
              className="scroll-mt-24 overflow-hidden rounded-3xl border"
              style={{ borderColor: tint(m.color, 0.25), background: isOpen ? tint(m.color, 0.05) : 'rgb(var(--surface))' }}
            >
              <button onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: tint(m.color, 0.12), color: m.color }}>
                  <Icon n={m.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{m.name}</span>
                  {isOpen && <span className="block text-sm text-muted">{m.desc}</span>}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: m.color }}>
                  {Math.round(pct * 100)}%
                </span>
                <Icon n={isOpen ? 'chevU' : 'chevD'} className="h-5 w-5 text-muted" />
              </button>
              {isOpen && (
                <div className="mx-3 mb-3 rounded-2xl border border-line/70 bg-surface px-3 py-1">
                  {[false, true].map(work => {
                    const items = m.items.map((x, i) => ({ x, i })).filter(({ x }) => x[2] === work);
                    if (!items.length) return null;
                    return (
                      <div key={String(work)}>
                        <p className="pb-1 pt-3 text-xs font-semibold text-muted">{work ? 'No trabalho' : 'Fora do trabalho'}</p>
                        <div className="divide-y divide-line">
                          {items.map(({ x, i }) => {
                            const key = maslowItemKey(m.id, i);
                            const on = checks.has(key);
                            return (
                              <label key={key} className="flex cursor-pointer items-center gap-3 py-3">
                                <span
                                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-primary bg-primary text-onprimary' : 'border-muted/40'}`}
                                >
                                  {on && <Icon n="check" className="h-3.5 w-3.5" sw={3} />}
                                </span>
                                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(key)} />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[15px] font-medium">{x[0]}</span>
                                  <span className="block text-[13px] text-muted">{x[1]}</span>
                                </span>
                                <Tag c={on ? '#16a34a' : '#dc2626'}>{on ? 'Conquistado' : 'Em desenvolvimento'}</Tag>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {notes.length > 0 && (
                    <div className="space-y-2 pt-3">
                      {notes.map(n => (
                        <div key={n.id} className="flex gap-2 rounded-xl bg-sunk px-3 py-2.5">
                          <p className="flex-1 text-sm">
                            {n.text}
                            <span className="mt-0.5 block text-xs text-muted">{since(n.createdAt)}</span>
                          </p>
                          <IconBtn
                            n="x"
                            label="Apagar reflexão"
                            className="h-7 w-7 text-muted"
                            onClick={() =>
                              save.mutate(async () => {
                                await api(`/maslow/notes/${n.id}`, { method: 'DELETE' });
                                return api<MaslowDto>('/maslow');
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (!note.trim()) return;
                      save.mutate(() => api<MaslowDto>('/maslow/notes', { method: 'POST', body: { level: m.id, text: note.trim() } }));
                      setNote('');
                    }}
                    className="my-3 flex items-center gap-2 rounded-2xl px-3 py-1"
                    style={{ background: tint(m.color, 0.08) }}
                  >
                    <Icon n="checkSq" className="h-5 w-5" />
                    <input
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Adicionar reflexão sobre esta área"
                      maxLength={1000}
                      className="flex-1 bg-transparent py-2.5 text-[15px] placeholder:text-ink/60 focus:outline-none"
                    />
                    <button type="submit" aria-label="Adicionar reflexão" className="grid h-8 w-8 place-items-center" style={{ color: m.color }}>
                      <Icon n="plus" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}

        <Card className="flex items-center gap-3 p-4">
          <p className="flex-1 text-sm">Encontrou algo na base para cuidar?</p>
          <Button variant="soft" className="px-3 py-2" onClick={() => sheets.openInitiative()}>
            Criar iniciativa
          </Button>
        </Card>
      </div>
    </>
  );
}
