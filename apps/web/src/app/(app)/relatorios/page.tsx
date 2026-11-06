'use client';

import { AREA, AREAS, isLate, rodaAvg, type AreaId, type BacklogDto } from '@circle/shared';
import { useState } from 'react';
import { Donut, LineChart } from '@/components/charts';
import { Header } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { AreaIcon, Bar, Card, inputCls, Ring, Seg } from '@/components/primitives';
import { taskAreas, useBacklog } from '@/lib/backlog';
import { useRoda } from '@/lib/roda';
import { fmtDay, useSprints } from '@/lib/sprints';

type Tab = 'geral' | 'area' | 'evo' | 'entregas';
const DAY = 864e5;
const DC = ['rgb(var(--a))', '#e2668a', '#f5b942', '#8fbf6a'];
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Relatórios: visão geral, por área, evolução e entregas por período (como no protótipo, sem "sequência"). */
export default function RelatoriosPage() {
  const { data } = useBacklog();
  const { data: roda } = useRoda();
  const { data: sprints } = useSprints();
  const [tab, setTab] = useState<Tab>('geral');
  const [days, setDays] = useState(30);

  return (
    <>
      <Header title="Relatórios" sub="Acompanhe seu progresso e evolução" info="relatorios" />
      <div className="space-y-4 px-4 pb-8">
        <Seg
          tone="a"
          items={[
            { id: 'geral' as const, label: 'Geral', icon: 'pie' },
            { id: 'area' as const, label: 'Áreas', icon: 'layersArea' },
            { id: 'evo' as const, label: 'Evolução', icon: 'trend' },
            { id: 'entregas' as const, label: 'Entregas', icon: 'checkCircle' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {data && tab === 'geral' && <Geral data={data} days={days} setDays={setDays} setTab={setTab} />}
        {data && tab === 'area' && (
          <Card className="divide-y divide-line">
            {AREAS.map(a => {
              const all = data.tasks.filter(t => taskAreas(data, t).includes(a.id));
              const n = all.filter(t => t.status === 'done').length;
              return (
                <div key={a.id} className="flex items-center gap-3 p-3.5">
                  <AreaIcon id={a.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] font-semibold">{a.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1">
                        <Bar pct={all.length ? n / all.length : 0} color={a.color} />
                      </div>
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                        {n}/{all.length}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{roda?.scores[a.id] ?? 0}/10</p>
                    <p className="text-[0.6875rem] text-muted">na roda</p>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
        {data && tab === 'evo' && (
          <>
            <Card className="p-4">
              <p className="font-semibold">Média da Roda da Vida</p>
              <p className="mb-2 text-xs text-muted">Cada ponto é um registro</p>
              {roda && (
                <LineChart
                  color="rgb(var(--p))"
                  pts={[...roda.history]
                    .reverse()
                    .map(h => ({ v: rodaAvg(h.scores) / 10, label: fmtDay(h.createdAt) }))
                    .concat(roda.rated ? [{ v: rodaAvg(roda.scores) / 10, label: 'hoje' }] : [])}
                />
              )}
            </Card>
            <Card className="p-4">
              <p className="font-semibold">Tarefas concluídas por semana</p>
              <p className="mb-2 text-xs text-muted">Últimas 8 semanas</p>
              <LineChart
                pct={false}
                pts={Array.from({ length: 8 }, (_, i) => {
                  const end = Date.now() - (7 - i) * 7 * DAY;
                  const st = end - 7 * DAY;
                  return {
                    v: data.tasks.filter(t => t.doneAt && new Date(t.doneAt).getTime() > st && new Date(t.doneAt).getTime() <= end).length,
                    label: fmtDay(new Date(end)),
                  };
                })}
              />
            </Card>
            <Card className="p-4">
              <p className="mb-2 font-semibold">Sprints</p>
              <div className="divide-y divide-line">
                {(sprints?.history ?? []).map(h => (
                  <div key={h.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-20 font-semibold">Sprint {h.number}</span>
                    <div className="flex-1">
                      <Bar pct={h.totalCount ? (h.doneCount ?? 0) / h.totalCount : 0} color="rgb(var(--a))" />
                    </div>
                    <span className="w-10 text-right tabular-nums">
                      {h.doneCount}/{h.totalCount}
                    </span>
                  </div>
                ))}
                {sprints?.history.length === 0 && <p className="py-2 text-sm text-muted">Nenhuma sprint encerrada ainda.</p>}
              </div>
            </Card>
          </>
        )}
        {data && tab === 'entregas' && <Entregas data={data} />}
      </div>
    </>
  );
}

function Stat({ n, l, ic, c, d }: { n: number; l: string; ic: IconName; c: string; d?: string | null }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-surface p-3 text-center shadow-soft">
      <span className="inline-block" style={{ color: c }}>
        <Icon n={ic} className="h-7 w-7" />
      </span>
      <p className="mt-1 text-[1.75rem] font-semibold leading-tight" style={{ color: c }}>
        {n}
      </p>
      <p className="text-[0.75rem] text-muted">{l}</p>
      {d && <p className="mt-1 text-[0.625rem] text-muted">{d}</p>}
    </div>
  );
}

function Geral({ data, days, setDays, setTab }: { data: BacklogDto; days: number; setDays: (d: number) => void; setTab: (t: Tab) => void }) {
  const now = Date.now();
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;
  const at = (s: string | null) => (s ? new Date(s).getTime() : 0);
  const done = data.tasks.filter(t => t.doneAt && at(t.doneAt) >= from);
  const prevDone = data.tasks.filter(t => t.doneAt && at(t.doneAt) >= prevFrom && at(t.doneAt) < from).length;
  const doing = data.tasks.filter(t => t.status === 'todo' || t.status === 'doing').length;
  const late = data.tasks.filter(t => isLate(t)).length;
  const total = data.tasks.length;
  const rate = total ? data.tasks.filter(t => t.status === 'done').length / total : 0;
  const delta = prevDone ? Math.round(((done.length - prevDone) / prevDone) * 100) : null;
  const line = Array.from({ length: 9 }, (_, i) => {
    const t = from + ((now - from) * i) / 8;
    const n = data.tasks.filter(x => x.doneAt && at(x.doneAt) <= t).length;
    return { v: total ? n / total : 0, label: i % 2 === 0 ? fmtDay(new Date(t)) : '' };
  });
  const byArea = AREAS.map(a => ({ a, n: done.filter(t => taskAreas(data, t).includes(a.id)).length })).sort((x, y) => y.n - x.n);
  const pctA = (n: number) => (done.length ? Math.round((n / done.length) * 100) : 0);
  const iniOf = (epicId: string) => data.epics.find(e => e.id === epicId)?.initiativeId;
  const byIni = data.initiatives
    .map(i => ({ i, n: done.filter(t => iniOf(t.epicId) === i.id).length }))
    .filter(x => x.n)
    .sort((x, y) => y.n - x.n);
  const parts = [
    ...byIni.slice(0, 3).map((x, i) => ({ label: x.i.title, v: x.n, c: DC[i]! })),
    ...(byIni.length > 3 ? [{ label: 'Outras', v: byIni.slice(3).reduce((a, b) => a + b.n, 0), c: DC[3]! }] : []),
  ];
  const byDay = WD.map((_, i) => done.filter(t => new Date(t.doneAt!).getDay() === i).length);
  const maxD = Math.max(1, ...byDay);
  const topEp = data.epics
    .map(e => ({ e, n: done.filter(t => t.epicId === e.id).length }))
    .filter(x => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const least = [...byArea].reverse().slice(0, 3);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h2 className="text-[1.0625rem] font-semibold">Resumo geral</h2>
          <p className="text-[0.8125rem] text-muted">Visão geral do seu desenvolvimento</p>
        </div>
        <select aria-label="Período" value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium">
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Stat n={done.length} l="Concluídas" ic="checkCircle" c="#16a34a" d={delta === null ? null : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs período anterior`} />
        <Stat n={doing} l="Em andamento" ic="clock" c="#f59e0b" />
        <Stat n={late} l="Atrasadas" ic="xCircle" c="#e5484d" />
        <Stat n={total} l="Total de tarefas" ic="flag" c="rgb(var(--a))" />
      </div>
      <Card className="flex gap-3 p-4">
        <div className="flex w-[38%] shrink-0 flex-col items-center border-r border-line pr-3">
          <p className="mb-2 self-start text-sm font-semibold">Taxa de conclusão</p>
          <Ring pct={rate} size={112} stroke={14} color="rgb(var(--a))" track="rgb(var(--a) / .15)">
            <span>
              <span className="block text-2xl font-semibold text-accent">{Math.round(rate * 100)}%</span>
              <span className="block text-[0.5625rem] leading-tight text-muted">
                de tarefas
                <br />
                concluídas
              </span>
            </span>
          </Ring>
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
            <Icon n="sparkles" className="h-3.5 w-3.5" />
            {rate > 0.6 ? 'Muito bom! Continue assim.' : 'Cada tarefa conta.'}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold">Progresso geral</p>
          <LineChart pts={line} W={200} H={170} />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['Vidas mais utilizadas', byArea.slice(0, 5)],
            ['Vidas menos utilizadas', least],
          ] as const
        ).map(([t, list]) => (
          <Card key={t} className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold">
              <Icon n="chart" className="h-4 w-4 text-accent" />
              {t}
            </p>
            <div className="space-y-2">
              {list.map(({ a, n }, i) => (
                <div key={a.id} className="flex items-center gap-2 text-[0.75rem]">
                  <span className="w-3 text-muted">{i + 1}</span>
                  <AreaIcon id={a.id} size="w-6 h-6" icon="w-3.5 h-3.5" />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="tabular-nums">{pctA(n)}%</span>
                </div>
              ))}
            </div>
            <button onClick={() => setTab('area')} className="mt-3 w-full rounded-xl bg-accent/5 py-2 text-[0.75rem] font-semibold text-accent">
              Ver todas as áreas
            </button>
          </Card>
        ))}
      </div>
      {parts.length > 0 && (
        <Card className="flex items-center gap-3 p-4">
          <Donut parts={parts} size={96} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {parts.map(p => (
              <div key={p.label} className="flex items-center gap-2 text-[0.75rem]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.c }} />
                <span className="flex-1 truncate">{p.label}</span>
                <span className="tabular-nums">{Math.round((p.v / done.length) * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="w-[34%] shrink-0 rounded-2xl bg-accent/5 p-3">
            <p className="flex items-center gap-1 text-[0.75rem] font-semibold text-accent">
              <Icon n="sparkles" className="h-3.5 w-3.5" />
              Insight
            </p>
            <p className="mt-1 text-[0.6875rem] leading-snug text-ink/75">
              Suas entregas vieram mais de “{parts[0]!.label}”. Que tal olhar para {least[0]!.a.name.toLowerCase()}?
            </p>
          </div>
        </Card>
      )}
      <Card className="p-3">
        <p className="text-[0.8125rem] font-semibold">Desempenho por dia da semana</p>
        <p className="text-[0.6875rem] text-muted">Onde você mais se engaja</p>
        <div className="mt-2 flex h-24 items-end gap-1.5">
          {byDay.map((n, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t-md"
                style={{ height: `${Math.max(6, (n / maxD) * 100)}%`, background: n === maxD && n ? 'rgb(var(--a))' : 'rgb(var(--a) / .3)' }}
              />
              <span className="text-[0.625rem] text-muted">{WD[i]}</span>
            </div>
          ))}
        </div>
      </Card>
      {topEp.length > 0 && (
        <div className="rounded-2xl bg-accent/5 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Icon n="bolt" className="h-5 w-5 text-accent" />
            Épicos com mais entregas
          </p>
          <p className="text-xs text-muted">No período selecionado</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topEp.map(({ e, n }) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.75rem]">
                <span style={{ color: AREA[e.area].color }}>
                  <Icon n={AREA[e.area].icon} className="h-4 w-4" />
                </span>
                {e.title}
                <span className="font-semibold text-accent">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Entregas: tarefas concluídas entre duas datas, com data, área e épico. */
function Entregas({ data }: { data: BacklogDto }) {
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * DAY)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59`).getTime();
  const list = data.tasks
    .filter(t => t.doneAt && new Date(t.doneAt).getTime() >= start && new Date(t.doneAt).getTime() <= end)
    .filter(t => area === 'all' || taskAreas(data, t).includes(area))
    .sort((a, b) => new Date(b.doneAt!).getTime() - new Date(a.doneAt!).getTime());

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          De
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="text-xs text-muted">
          Até
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={inputCls + ' mt-1'} />
        </label>
      </div>
      <select aria-label="Área" value={area} onChange={e => setArea(e.target.value as AreaId | 'all')} className={inputCls}>
        <option value="all">Todas as áreas</option>
        {AREAS.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <p className="text-sm text-muted">
        {list.length} {list.length === 1 ? 'tarefa entregue' : 'tarefas entregues'} no período
      </p>
      <Card className="divide-y divide-line">
        {list.map(t => {
          const ep = data.epics.find(e => e.id === t.epicId);
          return (
            <div key={t.id} className="flex items-center gap-3 p-3">
              <AreaIcon id={ep?.area} size="w-9 h-9" icon="w-4 h-4" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium">{t.title}</p>
                <p className="truncate text-xs text-muted">{ep?.title}</p>
              </div>
              <span className="text-xs tabular-nums text-muted">{fmtDay(t.doneAt!)}</span>
            </div>
          );
        })}
        {!list.length && <p className="p-4 text-center text-sm text-muted">Nenhuma entrega nesse período.</p>}
      </Card>
    </>
  );
}
