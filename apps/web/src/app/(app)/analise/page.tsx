'use client';

import { ANALYSIS_SOURCES, AREA, type AnalysisLatestDto, type AnalysisReportDto, type AnalysisSource, type AnalysisSuggestion, alignmentLabel } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { Header, InfoSheet } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { AreaIcon, MANY_AREAS, Ring, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { BACKLOG_KEY } from '@/lib/backlog';

const KEY = ['analysis'];
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtWhen = (iso: string) => `${fmtDay(iso)} às ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

/** Título de uma seção do relatório, com ícone. */
function SectionTitle({ icon, color, children }: { icon: IconName; color: string; children: ReactNode }) {
  return (
    <p className="mb-2 mt-5 flex items-center gap-2 text-[0.9375rem] font-semibold" style={{ color }}>
      <Icon n={icon} className="h-4 w-4" />
      {children}
    </p>
  );
}

/** Lista de achados (título + texto) com uma barra colorida à esquerda. */
function Points({ items, color }: { items: { titulo: string; texto: string }[]; color: string }) {
  return (
    <div className="space-y-2">
      {items.map((p, i) => (
        <div key={i} className="rounded-xl border border-line border-l-4 p-3" style={{ borderLeftColor: color }}>
          <p className="text-[0.875rem] font-semibold leading-snug">{p.titulo}</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink/80">{p.texto}</p>
        </div>
      ))}
    </div>
  );
}

/** "Me analise": a pessoa escolhe as fontes e a IA devolve um retrato direto, gaps e trilhas sugeridas. */
export default function AnalisePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { openSheet } = useSheets();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<AnalysisLatestDto>('/analysis/latest') });
  const [chosen, setChosen] = useState<AnalysisSource[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Começa com as fontes do último relatório (ou todas as que têm dados).
  useEffect(() => {
    if (data && chosen === null) {
      const prev = data.report.example ? [] : data.report.sources.filter(s => data.available.includes(s));
      setChosen(prev.length ? prev : data.available);
    }
  }, [data, chosen]);

  const title = 'Me analise';
  const sub = 'A IA cruza o que você diz querer com o que você faz, e te mostra a verdade.';
  if (!data) return <Header title={title} sub={sub} info="analise" />;
  const a = data.report;
  const sel = chosen ?? [];
  const toggle = (s: AnalysisSource) => setChosen(sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s]);
  const waiting = data.nextAllowedAt && new Date(data.nextAllowedAt) > new Date() ? data.nextAllowedAt : null;

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const report = await api<AnalysisReportDto>('/analysis', { method: 'POST', body: { sources: sel } });
      qc.setQueryData<AnalysisLatestDto>(KEY, d => d && { ...d, report });
      qc.invalidateQueries({ queryKey: KEY });
      toast('Análise pronta');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Não foi possível gerar a análise agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  };

  const recs: [string, string[], IconName, string][] = [
    ['Manter', a.manter, 'check', '#16a34a'],
    ['Ajustar', a.ajustar, 'undo', '#3b82f6'],
    ['Pausar por enquanto', a.abandonar, 'flag', '#ea8a0c'],
  ];

  return (
    <>
      <Header title={title} sub={sub} info="analise" />
      <div className="space-y-4 px-4 pb-8">
        <div>
          <div className="grid grid-cols-5 gap-2">
            {ANALYSIS_SOURCES.map(s => {
              const ok = data.available.includes(s.id);
              const on = ok && sel.includes(s.id);
              return (
                <button
                  key={s.id}
                  disabled={!ok}
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border bg-surface px-1 py-3 text-center shadow-soft transition disabled:opacity-45 ${on ? 'border-primary/50' : 'border-line/80'}`}
                >
                  <span style={{ color: s.color }}>
                    <Icon n={s.icon} className="h-7 w-7" sw={1.7} />
                  </span>
                  <span className="flex min-h-[1.625rem] items-center text-[0.6875rem] font-medium leading-tight">{s.label}</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${on ? 'border-primary bg-primary text-onprimary' : 'border-line'}`}>
                    {on && <Icon n="check" className="h-3 w-3" sw={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Toque para escolher o que entra na análise. {data.available.length < ANALYSIS_SOURCES.length && 'Fontes apagadas ainda não têm dados.'}
          </p>
        </div>

        <div className="space-y-3 rounded-3xl border border-accent/10 bg-accent/[.05] p-3">
          <div className="flex flex-wrap items-center gap-3 px-1 pt-1">
            <Icon n="sparkles" className="h-7 w-7 text-accent" />
            <div className="min-w-[9.375rem] flex-1">
              <p className="font-semibold text-accent">{busy ? 'Analisando seus dados…' : a.example ? 'Exemplo de análise' : 'Sua análise'}</p>
              <p className="text-xs text-muted">{a.example ? 'Gere a sua para ver a análise com os seus dados.' : `Gerada em ${fmtWhen(a.createdAt)}`}</p>
            </div>
            <button
              onClick={() => openSheet(close => <InfoSheet k="analise" onClose={close} />)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium"
            >
              Entenda como funciona
              <Icon n="info" className="h-3.5 w-3.5" />
            </button>
          </div>

          {a.cuidado && (
            <div className="flex gap-3 rounded-2xl border border-rose-300/60 bg-rose-50 p-4 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
              <Icon n="heart" className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-[0.875rem] leading-relaxed">{a.cuidado}</p>
            </div>
          )}

          <div className="rounded-2xl bg-surface p-4">
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-accent">Quem você é hoje</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink/85">{a.retrato}</p>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <Ring pct={a.geral / 100} size={88} stroke={8} color="rgb(var(--a))" track="rgb(var(--a) / .15)">
                  <span className="text-[1.375rem] font-semibold text-accent">{a.geral}%</span>
                </Ring>
                <p className="mt-1.5 max-w-[5.5rem] text-center text-[0.6875rem] leading-tight text-muted">{alignmentLabel(a.geral)}</p>
              </div>
            </div>

            {a.padroes.length > 0 && (
              <>
                <SectionTitle icon="trend" color="rgb(var(--a))">
                  Seus padrões de evolução
                </SectionTitle>
                <Points items={a.padroes} color="rgb(var(--a))" />
              </>
            )}

            {a.gaps.length > 0 && (
              <>
                <SectionTitle icon="alert" color="#ea8a0c">
                  Onde o que você diz e o que você faz não batem
                </SectionTitle>
                <Points items={a.gaps} color="#ea8a0c" />
              </>
            )}

            {a.limitantes.length > 0 && (
              <>
                <SectionTitle icon="bolt" color="#dc2626">
                  O que está te limitando
                </SectionTitle>
                <Points items={a.limitantes.map(l => ({ titulo: l.nome, texto: l.texto }))} color="#dc2626" />
              </>
            )}

            {recs.some(([, list]) => list.length) && (
              <>
                <SectionTitle icon="target" color="#16a34a">
                  Recomendações
                </SectionTitle>
                <div className="space-y-2">
                  {recs
                    .filter(([, list]) => list.length)
                    .map(([label, list, icon, c]) => (
                      <div key={label} className="rounded-xl border border-line p-3">
                        <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold" style={{ color: c }}>
                          <Icon n={icon} className="h-4 w-4" />
                          {label}
                        </p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.8125rem] leading-snug text-ink/80">
                          {list.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </>
            )}

            {a.proximos7dias.length > 0 && (
              <>
                <SectionTitle icon="calendar" color="rgb(var(--p))">
                  Seus próximos 7 dias
                </SectionTitle>
                <ol className="space-y-2">
                  {a.proximos7dias.map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-onprimary">{i + 1}</span>
                      <span className="pt-0.5 text-[0.8438rem] leading-snug">{t}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {a.pergunta && (
              <blockquote className="mt-5 rounded-2xl bg-accent/[.07] px-4 py-3 font-serif text-[1.0625rem] italic leading-snug">
                <span className="mb-1 block font-sans text-[0.6875rem] font-semibold not-italic uppercase tracking-wide text-accent">Para você levar</span>
                {a.pergunta}
              </blockquote>
            )}
          </div>

          {a.sugestoes.length > 0 && (
            <div className="rounded-2xl bg-surface p-4">
              <p className="font-semibold text-accent">Sugestões para o seu backlog</p>
              <p className="text-xs text-muted">Marque só o que fizer sentido, tarefa por tarefa, e importe para o backlog.</p>
              <div className="mt-4 space-y-4">
                {a.sugestoes.map((s, i) => (
                  <SuggestionCard key={`${a.id}-${i}`} s={s} reportId={a.id} index={i} imported={a.imported.includes(i)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy || !sel.length || Boolean(waiting)}
          onClick={run}
          className="w-full rounded-[1.375rem] bg-accent py-4 text-center text-onprimary disabled:opacity-50"
        >
          <span className="flex items-center justify-center gap-2 text-[1.0625rem] font-semibold">
            <Icon n="sparkles" />
            {busy ? 'Gerando sua análise…' : a.example ? 'Gerar minha análise' : 'Gerar nova análise'}
          </span>
          <span className="mt-0.5 block text-xs opacity-85">
            {busy
              ? 'Isso costuma levar de 20 a 40 segundos'
              : waiting
                ? `Você pode gerar uma análise por mês. A próxima fica disponível em ${fmtDay(waiting)}.`
                : sel.length
                  ? 'Uma por mês: a IA analisa os dados mais recentes das fontes marcadas'
                  : 'Escolha pelo menos uma fonte'}
          </span>
        </button>
        {data.mode === 'afl' && <p className="text-center text-[0.6875rem] text-muted">Os dados das fontes marcadas são enviados para a IA do Agents for Life só para gerar a análise.</p>}
      </div>
    </>
  );
}

/** Uma sugestão em cascata (iniciativa → épicos → tarefas), com caixas para marcar o que importar. */
function SuggestionCard({ s, reportId, index, imported }: { s: AnalysisSuggestion; reportId: string | null; index: number; imported: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [marks, setMarks] = useState(() => s.epicos.map(e => ({ on: true, tasks: e.tarefas.map(() => true) })));
  const [busy, setBusy] = useState(false);
  const count = marks.filter(m => m.on).length;

  const setEpic = (i: number, on: boolean) => setMarks(m => m.map((x, j) => (j === i ? { on, tasks: x.tasks.map(() => on) } : x)));
  const setTask = (i: number, t: number) =>
    setMarks(m =>
      m.map((x, j) => {
        if (j !== i) return x;
        const tasks = x.tasks.map((v, k) => (k === t ? !v : v));
        return { on: tasks.some(Boolean) || (x.on && tasks.length === 0), tasks };
      }),
    );

  const importNow = async () => {
    if (!reportId) return;
    setBusy(true);
    try {
      const r = await api<{ epics: number; tasks: number }>(`/analysis/${reportId}/suggestions/${index}/import`, {
        method: 'POST',
        body: { epicos: marks.flatMap((m, i) => (m.on ? [{ index: i, tarefas: m.tasks.flatMap((v, k) => (v ? [k] : [])) }] : [])) },
      });
      toast(`Importado: ${r.epics} ${r.epics === 1 ? 'épico' : 'épicos'} e ${r.tasks} ${r.tasks === 1 ? 'tarefa' : 'tarefas'} no backlog`);
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível importar.');
    } finally {
      setBusy(false);
    }
  };

  const Box = ({ on }: { on: boolean }) => (
    <span className={`mt-0.5 grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-full border-2 ${on ? 'border-primary bg-primary text-onprimary' : 'border-line'}`}>
      {on && <Icon n="check" className="h-3 w-3" sw={3} />}
    </span>
  );

  return (
    <div className="rounded-2xl border border-line">
      <div className="flex items-start gap-3 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon n="target" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold leading-tight">
            {s.iniciativa.titulo}
            {imported && <Tag c="#16a34a">Importada</Tag>}
          </p>
          {s.iniciativa.descricao && <p className="mt-0.5 text-[0.7813rem] text-muted">{s.iniciativa.descricao}</p>}
          {s.iniciativa.porque && (
            <p className="mt-1.5 text-[0.7813rem] leading-snug">
              <span className="font-semibold">Por que é importante: </span>
              {s.iniciativa.porque}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {s.iniciativa.areas.length >= MANY_AREAS ? (
              <AreaIcon areas={s.iniciativa.areas} size="w-6 h-6" count={false} />
            ) : (
              s.iniciativa.areas.map(ar => <AreaIcon key={ar} id={ar} size="w-6 h-6" icon="w-3.5 h-3.5" />)
            )}
          </div>
        </div>
      </div>
      <div className="divide-y divide-line border-t border-line">
        {s.epicos.map((e, i) => (
          <div key={i} className="px-3 py-2">
            <button className="flex w-full items-start gap-2.5 py-1 text-left text-[0.8438rem] font-semibold" onClick={() => setEpic(i, !marks[i]!.on)} aria-pressed={marks[i]!.on}>
              <Box on={marks[i]!.on} />
              <span className="flex-1">{e.titulo}</span>
              <Tag c={AREA[e.areas[0]!]?.color ?? 'rgb(var(--p))'}>Épico</Tag>
            </button>
            <ul className="ml-[1.625rem]">
              {e.tarefas.map((t, k) => (
                <li key={k}>
                  <button className="flex w-full items-start gap-2.5 py-1.5 text-left" onClick={() => setTask(i, k)} aria-pressed={marks[i]!.tasks[k]}>
                    <Box on={marks[i]!.tasks[k]!} />
                    <span className={marks[i]!.tasks[k] ? '' : 'text-muted line-through'}>
                      <span className="block text-[0.8125rem]">{t.titulo}</span>
                      {t.descricao && <span className="block text-[0.7188rem] leading-snug text-muted">{t.descricao}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <Button variant={imported ? 'line' : 'accent'} className="w-full" disabled={busy || !reportId || !count} onClick={importNow}>
          <Icon n="download" className="h-4 w-4" />
          {!reportId ? 'Gere a sua análise para importar' : imported ? 'Importar de novo' : 'Importar para o backlog'}
        </Button>
      </div>
    </div>
  );
}
