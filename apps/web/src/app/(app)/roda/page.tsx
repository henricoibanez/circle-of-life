'use client';

import { AREAS, rodaAvg, type AreaId } from '@circle/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Radar } from '@/components/exercises/radar';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { AreaIcon, Bar, Card, Ring, styleVars } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { tint } from '@/lib/color';
import { useRoda, useSetScore, useSnapshot } from '@/lib/roda';

function Slider({ area, value, onChange, label }: { area: AreaId; value: number; onChange: (v: number) => void; label: string }) {
  const color = AREAS.find(a => a.id === area)!.color;
  return (
    <input
      type="range"
      min={0}
      max={10}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="slim mt-0.5"
      style={{ ...styleVars({ '--c': color, '--v': `${value * 10}%` }), accentColor: color }}
      aria-label={label}
    />
  );
}

/** Roda da Vida: nota de 0 a 10 por área, radar e registro da avaliação (como no protótipo). */
export default function RodaPage() {
  const { data } = useRoda();
  const setScore = useSetScore();
  const snapshot = useSnapshot();
  const { openSheet } = useSheets();
  if (!data) return <Header title="Roda da Vida" sub="Avalie cada área da sua vida de 0 a 10" info="roda" />;

  const sc = data.scores;
  const avg = rodaAvg(sc);
  const last = data.history[0];

  return (
    <>
      <Header title="Roda da Vida" sub="Avalie cada área da sua vida de 0 a 10" info="roda" />
      <div className="space-y-4 px-4 pb-8">
        <Card className="rounded-3xl p-4">
          <div className="flex items-center gap-2">
            <div className="flex w-[38%] shrink-0 flex-col items-start">
              <Ring pct={avg / 10} size={118} stroke={8}>
                <span>
                  <span className="block text-[28px] font-semibold leading-none">{Math.round(avg * 10)}%</span>
                  <span className="text-[11px] text-muted">Equilíbrio geral</span>
                </span>
              </Ring>
              <p className="mt-4 flex items-start gap-1.5 text-[15px] font-medium leading-snug">
                <Icon n="leaf" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {data.rated ? 'Você está no caminho certo!' : 'Dê uma nota para cada área.'}
              </p>
              <p className="mt-1 text-[13px] text-muted">{data.rated ? 'Continue evoluindo em cada área.' : 'Com honestidade, de 0 a 10.'}</p>
              <Button variant="soft" className="mt-4 px-3 py-2" asChild>
                <Link href="/analise">
                  <Icon n="chart" className="h-4 w-4" />
                  Ver insights
                </Link>
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <Radar scores={sc} />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl px-4 py-2">
          <div className="divide-y divide-line">
            {AREAS.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-3">
                <AreaIcon id={a.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{a.name}</p>
                  <p className="truncate text-[13px] text-muted">{a.q}</p>
                  <Slider area={a.id} value={sc[a.id]} onChange={v => setScore(a.id, v)} label={`Nota para ${a.name}`} />
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line text-lg font-semibold tabular-nums">{sc[a.id]}</span>
              </div>
            ))}
          </div>
          <button onClick={() => openSheet(close => <RodaHelp onClose={close} />)} className="my-3 flex w-full items-center gap-3 rounded-2xl bg-primary/5 p-4 text-left">
            <Icon n="sparkles" className="h-6 w-6 text-primary" />
            <span className="flex-1">
              <span className="block font-semibold">Me ajude</span>
              <span className="block text-[13px] text-muted">Me ajude a refletir e responder melhor cada área da minha Roda da Vida</span>
            </span>
            <Icon n="chevR" className="h-4 w-4 text-muted" />
          </button>
        </Card>

        <Button variant="pline" className="w-full py-3" disabled={snapshot.isPending || !data.rated} onClick={() => snapshot.mutate()}>
          Registrar avaliação de hoje
        </Button>
        {last && (
          <p className="text-center text-xs text-muted">
            Último registro em {new Date(last.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}. A evolução aparece em Relatórios.
          </p>
        )}
      </div>
    </>
  );
}

const LEGEND = ['0 – Precisa melhorar muito', '5 – Regular', '10 – Excelente'];

/** "Me ajude a refletir": passo a passo pelas 10 áreas, com as perguntas e a nota. */
function RodaHelp({ onClose }: { onClose: () => void }) {
  const { data } = useRoda();
  const setScore = useSetScore();
  const [i, setI] = useState(0);
  const a = AREAS[i]!;
  const score = data?.scores[a.id] ?? 0;
  return (
    <Sheet
      title="Me ajude a refletir"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" disabled={i === 0} onClick={() => setI(i - 1)}>
            Anterior
          </Button>
          <Button className="flex-1" onClick={() => (i < AREAS.length - 1 ? setI(i + 1) : onClose())}>
            {i < AREAS.length - 1 ? 'Próxima área' : 'Concluir'}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1">
          <Bar pct={(i + 1) / AREAS.length} />
        </div>
        <span className="whitespace-nowrap text-sm tabular-nums text-muted">
          {i + 1} de {AREAS.length}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <AreaIcon id={a.id} size="w-14 h-14" icon="w-7 h-7" />
        <p className="text-xl font-bold">{a.name}</p>
      </div>
      <p className="mt-4 text-sm text-muted">Responda para você mesmo, com honestidade:</p>
      <div className="mt-2 space-y-2">
        {[a.q, ...a.p].map(q => (
          <p key={q} className="rounded-2xl px-4 py-3 font-serif text-[18px] italic leading-snug" style={{ background: tint(a.color, 0.08) }}>
            {q}
          </p>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Como você avalia esta área hoje?</p>
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-line text-lg font-semibold tabular-nums">{score}</span>
        </div>
        <Slider area={a.id} value={score} onChange={v => setScore(a.id, v)} label={`Nota para ${a.name}`} />
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          {LEGEND.map(l => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
