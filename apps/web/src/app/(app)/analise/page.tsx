'use client';

import {
  ANALYSIS_SOURCES,
  ANALYSIS_TAGS,
  AREA,
  type AnalysisLatestDto,
  type AnalysisReportDto,
  type AnalysisSource,
  type AnalysisSuggestion,
  alignmentLabel,
  analysisTag,
} from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Header, InfoSheet } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { AreaIcon, Ring, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { BACKLOG_KEY } from '@/lib/backlog';

const KEY = ['analysis'];
const INSIGHT_ICON: Record<string, [IconName, string]> = { trend: ['trend', '#7c4dde'], alert: ['alert', '#ea8a0c'], target: ['target', '#16a34a'] };
const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Análise inteligente (como no protótipo): a pessoa escolhe as fontes e a IA sugere trilhas. */
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

  if (!data) return <Header title="Análise inteligente da sua vida" sub="Nossa IA cruzou dados de várias fontes para gerar um relatório completo sobre você." info="analise" />;
  const a = data.report;
  const sel = chosen ?? [];
  const toggle = (s: AnalysisSource) => setChosen(sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s]);

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const report = await api<AnalysisReportDto>('/analysis', { method: 'POST', body: { sources: sel } });
      qc.setQueryData<AnalysisLatestDto>(KEY, d => d && { ...d, report });
      qc.invalidateQueries({ queryKey: KEY });
      toast('Relatório atualizado');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Não foi possível gerar o relatório agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header title="Análise inteligente da sua vida" sub="Nossa IA cruzou dados de várias fontes para gerar um relatório completo sobre você." info="analise" />
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
              <p className="font-semibold text-accent">{busy ? 'Analisando seus dados…' : a.example ? 'Exemplo de relatório' : 'Análise concluída pela IA'}</p>
              <p className="text-xs text-muted">{a.example ? 'Gere o seu relatório para ver a análise com os seus dados.' : `Última atualização: ${fmtWhen(a.createdAt)}`}</p>
            </div>
            <button
              onClick={() => openSheet(close => <InfoSheet k="analise" onClose={close} />)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium"
            >
              Entenda como funciona
              <Icon n="info" className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <h2 className="text-lg font-semibold">Relatório da sua vida</h2>
            <div className="mt-2 flex gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-accent">Visão geral</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink/80">{a.visao}</p>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <Ring pct={a.geral / 100} size={96} stroke={8} color="rgb(var(--a))" track="rgb(var(--a) / .15)">
                  <span className="text-2xl font-semibold text-accent">{a.geral}%</span>
                </Ring>
                <p className="mt-1.5 text-center text-[0.6875rem] leading-tight text-muted">
                  Índice de alinhamento
                  <br />
                  geral
                </p>
              </div>
            </div>

            <p className="mb-2 mt-5 text-[0.9375rem] font-semibold text-accent">Análise por área da vida</p>
            <div className="divide-y divide-line rounded-2xl border border-line">
              {a.areas.map(x => {
                const tg = ANALYSIS_TAGS[analysisTag(x.pct)];
                const rc = x.pct < 50 ? '#ea8a0c' : x.pct < 70 ? '#3b82f6' : '#16a34a';
                return (
                  <div key={x.area} className="flex items-start gap-3 p-3">
                    <AreaIcon id={x.area} size="w-9 h-9" icon="w-4 h-4" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.875rem] font-semibold">{AREA[x.area].name}</span>
                        <Tag c={tg[1]}>{tg[0]}</Tag>
                      </p>
                      <p className="mt-1 text-[0.7813rem] leading-snug text-ink/75">{x.texto}</p>
                    </div>
                    <div className="flex w-[4.5rem] shrink-0 flex-col items-center">
                      <Ring pct={x.pct / 100} size={50} stroke={4} color={rc}>
                        <span className="text-[0.8125rem] font-semibold" style={{ color: rc }}>
                          {x.pct}%
                        </span>
                      </Ring>
                      <span className="mt-1 text-center text-[0.625rem] leading-tight text-muted">{alignmentLabel(x.pct)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mb-2 mt-5 flex items-center gap-2 text-[0.9375rem] font-semibold text-accent">
              <Icon n="sparkles" className="h-4 w-4" />
              Principais insights da IA
            </p>
            <div className="grid grid-cols-3 gap-2">
              {a.insights.map((x, i) => {
                const [ic, c] = INSIGHT_ICON[x.icon] ?? ['sparkles', '#7c4dde'];
                return (
                  <div key={i} className="rounded-2xl border border-line p-2.5">
                    <span style={{ color: c }}>
                      <Icon n={ic} className="h-6 w-6" />
                    </span>
                    <p className="mt-1.5 text-[0.75rem] font-semibold leading-snug">{x.titulo}</p>
                    <p className="mt-1 text-[0.6875rem] leading-snug text-muted">{x.texto}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="font-semibold text-accent">Sugestões da IA para você</p>
            <p className="text-xs text-muted">Trilhas prontas para trazer mais equilíbrio. Desmarque o que não quiser e importe para o backlog.</p>
            <div className="mt-4 space-y-4">
              {a.suggestions.map((s, i) => (
                <SuggestionCard key={`${a.id}-${i}`} s={s} reportId={a.id} index={i} imported={a.imported.includes(i)} />
              ))}
            </div>
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {data.nextAllowedAt && !busy && new Date(data.nextAllowedAt) > new Date() && (
          <p className="text-center text-xs text-muted">Um novo relatório pode ser gerado a partir de {fmtWhen(data.nextAllowedAt).split(' às ')[1]}.</p>
        )}
        <button
          disabled={busy || !sel.length}
          onClick={run}
          className="w-full rounded-[1.375rem] py-4 text-center text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg, #7c4dde, #9d6bf0)' }}
        >
          <span className="flex items-center justify-center gap-2 text-[1.0625rem] font-semibold">
            <Icon n="sparkles" />
            {busy ? 'Gerando relatório…' : 'Gerar novo relatório'}
          </span>
          <span className="mt-0.5 block text-xs opacity-85">
            {busy ? 'Isso costuma levar de 20 segundos a um minuto' : sel.length ? 'A IA irá analisar novamente com os dados mais recentes' : 'Escolha pelo menos uma fonte'}
          </span>
        </button>
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
    <span className={`grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-full border-2 ${on ? 'border-primary bg-primary text-onprimary' : 'border-line'}`}>
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
          <p className="mt-0.5 text-[0.7813rem] text-muted">{s.iniciativa.descricao}</p>
          <div className="mt-1.5 flex gap-1">
            {s.iniciativa.areas.map(ar => (
              <AreaIcon key={ar} id={ar} size="w-6 h-6" icon="w-3.5 h-3.5" />
            ))}
          </div>
        </div>
      </div>
      <div className="divide-y divide-line border-t border-line">
        {s.epicos.map((e, i) => (
          <div key={i} className="px-3 py-2">
            <button className="flex w-full items-center gap-2.5 py-1 text-left text-[0.8438rem] font-semibold" onClick={() => setEpic(i, !marks[i]!.on)} aria-pressed={marks[i]!.on}>
              <Box on={marks[i]!.on} />
              <span className="flex-1">{e.titulo}</span>
              <Tag c={AREA[e.area].color}>Épico</Tag>
            </button>
            <ul className="ml-[1.625rem]">
              {e.tarefas.map((t, k) => (
                <li key={k}>
                  <button className="flex w-full items-center gap-2.5 py-1.5 text-left text-[0.8125rem]" onClick={() => setTask(i, k)} aria-pressed={marks[i]!.tasks[k]}>
                    <Box on={marks[i]!.tasks[k]!} />
                    <span className={marks[i]!.tasks[k] ? '' : 'text-muted line-through'}>{t}</span>
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
          {!reportId ? 'Gere seu relatório para importar' : imported ? 'Importar de novo' : 'Importar para o backlog'}
        </Button>
      </div>
    </div>
  );
}
