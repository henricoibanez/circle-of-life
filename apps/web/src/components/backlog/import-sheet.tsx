'use client';

import type { BacklogImportResult, BacklogRow } from '@circle/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { BACKLOG_KEY } from '@/lib/backlog';
import { importBacklogRows, readBacklogSpreadsheet } from '@/lib/backlog-io';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Importar tarefas de uma planilha (modelo do app antigo).
 * Passos: escolher o arquivo → prévia do que vai entrar → importar → o que falta completar.
 */
export function ImportSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<BacklogRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<BacklogImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const r = await readBacklogSpreadsheet(file);
      setRows(r);
      setFileName(file.name);
      setResult(await importBacklogRows(r, false));
    } catch (e) {
      setRows(null);
      setResult(null);
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível ler a planilha.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const r = await importBacklogRows(rows, true);
      setResult(r);
      await qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      toast('Planilha importada para o backlog');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível importar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const nothingNew = result && !result.iniciativas.novas && !result.epicos.novos && !result.tarefas.novas;
  const done = result?.applied;

  return (
    <Sheet
      title={done ? 'Importação concluída' : 'Importar tarefas'}
      icon={
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon n={done ? 'checkCircle' : 'download'} />
        </span>
      }
      onClose={onClose}
      footer={
        done || nothingNew ? (
          <Button className="flex-1" onClick={onClose}>
            {done ? 'Ver no backlog' : 'Fechar'}
          </Button>
        ) : (
          result && (
            <>
              <Button variant="line" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={busy} onClick={apply}>
                {busy ? 'Importando…' : 'Importar'}
              </Button>
            </>
          )
        )
      }
    >
      <div className="space-y-4">
        {!result && (
          <>
            <p className="text-sm text-muted">
              Use uma planilha no modelo do app antigo, com as colunas: área da vida, iniciativa, descrição da iniciativa, épico, descrição do épico, tarefa, descrição da tarefa e previsão de
              entrega. Status, prioridade e objetivo master são opcionais.
            </p>
            <p className="text-sm text-muted">O que já existe no seu backlog com o mesmo nome fica como está: só entra o que é novo.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-muted hover:border-primary/40">
              <Icon n="download" className="h-8 w-8 text-primary" />
              {busy ? 'Lendo a planilha…' : 'Escolher planilha (.xlsx)'}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={busy}
                onChange={e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) choose(f);
                }}
              />
            </label>
          </>
        )}
        {error && <p className="rounded-xl bg-red-500/5 px-4 py-2.5 text-sm text-red-700">{error}</p>}

        {result && (
          <>
            <div className="rounded-2xl bg-sunk p-4">
              <p className="text-xs text-muted">{done ? 'Entrou no seu backlog' : `Prévia de “${fileName}”`}</p>
              {nothingNew ? (
                <p className="mt-1 font-semibold">Tudo dessa planilha já está no seu backlog. Nada novo para importar.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-[0.9375rem]">
                  <li>
                    <b>{plural(result.iniciativas.novas, 'iniciativa nova', 'iniciativas novas')}</b>
                    {result.iniciativas.existentes > 0 && <span className="text-muted"> ({result.iniciativas.existentes} já existiam)</span>}
                  </li>
                  <li>
                    <b>{plural(result.epicos.novos, 'épico novo', 'épicos novos')}</b>
                    {result.epicos.existentes > 0 && <span className="text-muted"> ({result.epicos.existentes} já existiam)</span>}
                  </li>
                  <li>
                    <b>{plural(result.tarefas.novas, 'tarefa nova', 'tarefas novas')}</b>
                    {result.tarefas.existentes > 0 && <span className="text-muted"> ({result.tarefas.existentes} já existiam ou ficaram de fora)</span>}
                  </li>
                </ul>
              )}
            </div>

            {!nothingNew && <Missing r={result} done={Boolean(done)} />}

            {result.problemas.length > 0 && (
              <details className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-amber-700">
                  {plural(result.problemas.length, 'aviso', 'avisos')} sobre a planilha
                </summary>
                <ul className="mt-2 space-y-1 text-ink/80">
                  {result.problemas.slice(0, 50).map((p, i) => (
                    <li key={i}>
                      <span className="text-muted">Linha {p.linha}:</span> {p.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {!done && !nothingNew && (
              <button className="text-sm font-semibold text-primary" onClick={() => (setResult(null), setRows(null))}>
                Escolher outra planilha
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** O que a planilha não trouxe e a pessoa completa no app. */
function Missing({ r, done }: { r: BacklogImportResult; done: boolean }) {
  const f = r.faltando;
  const items: string[] = [];
  if (f.tarefasSemStatus) items.push(`${plural(f.tarefasSemStatus, 'tarefa entra', 'tarefas entram')} no Backlog: marque como Pronto as que você já fez e puxe para a sprint as da vez.`);
  if (f.tarefasSemPrioridade) items.push(`${plural(f.tarefasSemPrioridade, 'tarefa fica', 'tarefas ficam')} com prioridade Média: ajuste as que forem Alta ou Baixa.`);
  if (f.semObjetivoMaster) items.push('Nenhuma iniciativa é Objetivo Master: marque a principal.');
  if (f.iniciativasSemEpico.length) items.push(`Iniciativas sem épicos: ${f.iniciativasSemEpico.map(t => `“${t}”`).join(', ')}.`);
  if (f.epicosSemTarefa.length) items.push(`Épicos sem tarefas: ${f.epicosSemTarefa.map(t => `“${t}”`).join(', ')}.`);
  if (f.tarefasSemPrazo) items.push(`${plural(f.tarefasSemPrazo, 'tarefa está', 'tarefas estão')} sem prazo (opcional).`);
  if (f.tarefasSemDescricao) items.push(`${plural(f.tarefasSemDescricao, 'tarefa está', 'tarefas estão')} sem descrição (opcional).`);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-semibold text-primary">
        <Icon n="checkSq" className="h-5 w-5" />
        {done ? 'Para completar no app' : 'Depois de importar, falta completar'}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
        {items.map(t => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
