'use client';

import { BACKLOG_COLUMNS, type BacklogImportResult, type BacklogRow, normalize } from '@circle/shared';
import { api } from './api';

/** Chaves do BacklogRow na ordem das colunas da planilha. */
const KEYS: (keyof BacklogRow)[] = [
  'area',
  'iniciativa',
  'iniciativaDescricao',
  'epico',
  'epicoDescricao',
  'tarefa',
  'tarefaDescricao',
  'previsao',
  'status',
  'prioridade',
  'master',
];

const two = (n: number) => String(n).padStart(2, '0');

/** Valor de uma célula como texto. Datas viram dd/mm/aaaa. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${two(v.getUTCDate())}/${two(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  return String(v).trim();
}

/**
 * Lê a planilha (.xlsx) no navegador e devolve as linhas no formato da API.
 * As colunas são achadas pelo título do cabeçalho (sem ligar para acento e maiúsculas);
 * as 3 colunas do app novo são opcionais.
 */
export async function readBacklogSpreadsheet(file: File): Promise<BacklogRow[]> {
  const { readSheet } = await import('read-excel-file/browser');
  const data = await readSheet(file);
  const [header, ...body] = data;
  if (!header) throw new Error('A planilha está vazia.');
  const titles = header.map(h => normalize(cellText(h)));
  const index = KEYS.map((_, i) => titles.indexOf(BACKLOG_COLUMNS[i]!));
  const missing = BACKLOG_COLUMNS.slice(0, 8).filter((_, i) => index[i] === -1);
  if (missing.length) throw new Error(`A planilha não está no modelo: faltam as colunas ${missing.map(m => `“${m}”`).join(', ')}.`);
  return body
    .map(r => Object.fromEntries(KEYS.map((k, i) => [k, index[i]! >= 0 ? cellText(r[index[i]!]) : ''])) as BacklogRow)
    .filter(r => KEYS.some(k => r[k]));
}

/** Baixa o backlog inteiro em Excel, no modelo do app antigo + status, prioridade e Objetivo Master. */
export async function downloadBacklogSpreadsheet() {
  const rows = await api<BacklogRow[]>('/backlog/export');
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const head = BACKLOG_COLUMNS.map(t => ({ value: t, fontWeight: 'bold' as const }));
  const data = [head, ...rows.map(r => KEYS.map(k => ({ value: r[k] })))];
  const d = new Date();
  await writeXlsxFile(data, {
    sheet: 'Tarefas',
    columns: [18, 30, 40, 34, 40, 40, 40, 16, 12, 12, 14].map(width => ({ width })),
    stickyRowsCount: 1,
  }).toFile(`tarefas-circle-of-life-${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}.xlsx`);
  return rows.length;
}

export const importBacklogRows = (rows: BacklogRow[], apply: boolean) => api<BacklogImportResult>('/backlog/import', { method: 'POST', body: { rows, apply } });
