'use client';

import { GEMS, SURVEY_EVERY_DAYS, type SurveyResultDto } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { Bar, Card, inputCls } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

const KEY = ['admin', 'surveys'];
const date = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const two = (n: number) => String(n).padStart(2, '0');

/** Planilha com as respostas (sem nomes) e um resumo. */
async function exportSurvey(s: SurveyResultDto) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const bold = (value: string) => ({ value, fontWeight: 'bold' as const });
  const rows = [
    [bold('Pergunta'), { value: s.question }],
    [bold('Enviada para'), { value: s.sent }],
    [bold('Respostas'), { value: s.responses }],
    [bold('Média'), { value: s.average ?? '' }],
    ...[1, 2, 3, 4, 5].map(n => [bold(`Nota ${n}`), { value: s.counts[n - 1] ?? 0 }]),
    [],
    [bold('Nota'), bold('Comentário'), bold('Data')],
    ...s.comments.map(c => [{ value: c.score }, { value: c.comment }, { value: date(c.createdAt) }]),
  ];
  const d = new Date();
  await writeXlsxFile(rows, { sheet: 'Pesquisa', columns: [{ width: 14 }, { width: 70 }, { width: 14 }] }).toFile(
    `pesquisa-circle-of-life-${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}.xlsx`,
  );
}

/**
 * Só administradores: pesquisas rápidas (nota de 1 a 5). Ao publicar, vai para quem está fora da
 * Jornada e não recebeu outra pesquisa nos últimos 30 dias. Responder rende círculos.
 */
export default function PesquisasAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { openSheet } = useSheets();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<SurveyResultDto[]>('/admin/surveys') });
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      qc.invalidateQueries({ queryKey: KEY });
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Algo deu errado.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const confirm = (title: string, text: string, label: string, fn: () => Promise<unknown>, danger?: boolean) =>
    openSheet(close => (
      <ConfirmSheet title={title} confirm={label} danger={danger} onClose={close} onConfirm={() => run(fn)}>
        {text}
      </ConfirmSheet>
    ));

  return (
    <>
      <Header title="Pesquisas" sub="Perguntas rápidas, com nota de 1 a 5" />
      <div className="space-y-5 px-4 pb-8">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Nova pesquisa</h2>
          <input className={inputCls} maxLength={200} placeholder="O que está achando do app?" value={question} onChange={e => setQuestion(e.target.value)} />
          <p className="text-xs text-muted">
            Quem responder ganha {GEMS.pesquisa} círculos. Cada pessoa recebe no máximo uma pesquisa a cada {SURVEY_EVERY_DAYS} dias; quem está na Jornada não recebe.
          </p>
          <Button
            disabled={question.trim().length < 3 || busy}
            onClick={async () => {
              if (await run(() => api('/admin/surveys', { method: 'POST', body: { question } }), 'Rascunho criado.')) setQuestion('');
            }}
          >
            Criar rascunho
          </Button>
        </Card>

        <section className="space-y-3">
          {data?.length === 0 && <p className="px-1 text-sm text-muted">Nenhuma pesquisa ainda.</p>}
          {data?.map(s => {
            const status = !s.publishedAt ? 'Rascunho' : s.closedAt ? `Encerrada em ${date(s.closedAt)}` : `Aberta desde ${date(s.publishedAt)}`;
            const max = Math.max(1, ...s.counts);
            return (
              <Card key={s.id} className="space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-semibold">{s.question}</p>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold ${!s.publishedAt ? 'bg-amber-500/10 text-amber-700' : s.closedAt ? 'bg-sunk text-muted' : 'bg-primary/10 text-primary'}`}
                  >
                    {status}
                  </span>
                </div>
                {s.publishedAt && (
                  <>
                    <div className="flex gap-4 text-sm">
                      <span>
                        <b>{s.responses}</b> de {s.sent} {s.sent === 1 ? 'respondeu' : 'responderam'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon n="star" className="h-4 w-4 text-amber-500" fill="currentColor" />
                        <b>{s.average !== null ? s.average.toLocaleString('pt-BR') : '–'}</b> de média
                      </span>
                    </div>
                    <div className="space-y-1">
                      {[5, 4, 3, 2, 1].map(n => (
                        <div key={n} className="flex items-center gap-2 text-xs">
                          <span className="w-3 text-muted">{n}</span>
                          <Bar pct={((s.counts[n - 1] ?? 0) / max) * 100} color="#f59e0b" className="h-2 flex-1" />
                          <span className="w-6 text-right text-muted">{s.counts[n - 1] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                    {s.comments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted">Comentários</p>
                        {s.comments.map((c, i) => (
                          <p key={i} className="rounded-xl bg-sunk px-3 py-2 text-sm">
                            <span className="mr-1 font-semibold text-amber-600">{c.score}★</span>
                            {c.comment}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-3">
                  {!s.publishedAt && (
                    <>
                      <button
                        disabled={busy}
                        className="text-sm font-semibold text-primary disabled:opacity-40"
                        onClick={() =>
                          confirm('Publicar pesquisa', 'A pesquisa vai para o sino (e o celular) de quem está fora da Jornada e não recebeu outra pesquisa nos últimos 30 dias.', 'Publicar', async () => {
                            const r = await api<{ sent: number }>(`/admin/surveys/${s.id}/publish`, { method: 'POST' });
                            toast(`Publicada para ${r.sent} ${r.sent === 1 ? 'pessoa' : 'pessoas'}.`);
                          })
                        }
                      >
                        Publicar
                      </button>
                      <button
                        disabled={busy}
                        className="text-sm font-semibold text-red-600 disabled:opacity-40"
                        onClick={() => confirm('Apagar rascunho', 'O rascunho será apagado.', 'Apagar', () => api(`/admin/surveys/${s.id}`, { method: 'DELETE' }), true)}
                      >
                        Apagar
                      </button>
                    </>
                  )}
                  {s.publishedAt && !s.closedAt && (
                    <button
                      disabled={busy}
                      className="text-sm font-semibold disabled:opacity-40"
                      onClick={() => confirm('Encerrar pesquisa', 'Depois de encerrada, ninguém mais consegue responder.', 'Encerrar', () => api(`/admin/surveys/${s.id}/close`, { method: 'POST' }))}
                    >
                      Encerrar
                    </button>
                  )}
                  {s.publishedAt && (
                    <button className="text-sm font-semibold text-primary" onClick={() => exportSurvey(s).catch(() => toast('Não foi possível gerar a planilha.'))}>
                      Exportar Excel
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      </div>
    </>
  );
}
