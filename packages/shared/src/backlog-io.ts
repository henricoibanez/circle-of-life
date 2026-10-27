import { AREAS, type AreaId } from './areas';
import { STATUS_LABEL, type Priority, type TaskStatus } from './backlog';

/**
 * Exportar e importar tarefas em planilha (Excel), no modelo do app antigo.
 * As 8 primeiras colunas são as do app antigo, na mesma ordem; as 3 últimas
 * são do app novo e são opcionais na importação.
 */
export const BACKLOG_COLUMNS = [
  'area da vida',
  'iniciativa',
  'descricao da iniciativa',
  'epico',
  'descricao do epico',
  'tarefa',
  'descricao da tarefa',
  'previsao de entrega',
  'status',
  'prioridade',
  'objetivo master',
] as const;

/** Uma linha da planilha. Datas no formato dd/mm/aaaa. Linhas sem épico/tarefa descrevem só a iniciativa/épico. */
export type BacklogRow = {
  area: string;
  iniciativa: string;
  iniciativaDescricao: string;
  epico: string;
  epicoDescricao: string;
  tarefa: string;
  tarefaDescricao: string;
  previsao: string;
  status: string;
  prioridade: string;
  master: string;
};

export const MAX_IMPORT_ROWS = 3000;

/** Texto sem acento, minúsculo e sem espaços sobrando (para comparar nomes e cabeçalhos). */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Nomes de área do app antigo que mudaram no app novo. */
const LEGACY_AREAS: Record<string, AreaId> = {
  intelecto: 'intelectual',
  amor_relacionamento: 'amor',
  saude_fisica: 'saude',
  fisica: 'saude',
  saude: 'saude',
  espiritual: 'espiritualidade',
  financeira: 'financas',
  carreira: 'profissional',
  familia_amigos: 'familia',
};

/** Reconhece uma área pelo id novo, pelo nome que aparece no app ou pelo código do app antigo. */
export function parseArea(raw: string): AreaId | null {
  const key = normalize(raw).replace(/^["'\[\s]+|["'\]\s]+$/g, '');
  if (!key) return null;
  const byId = AREAS.find(a => a.id === key);
  if (byId) return byId.id;
  const byName = AREAS.find(a => normalize(a.name) === key);
  if (byName) return byName.id;
  return LEGACY_AREAS[key.replace(/ /g, '_')] ?? null;
}

/** Uma célula pode ter várias áreas: ["saude_fisica","emocional"] ou "saude, emocional". */
export function parseAreas(raw: string): { areas: AreaId[]; unknown: string[] } {
  const parts = raw
    .replace(/[\[\]"']/g, '')
    .split(/[,;]/)
    .map(p => p.trim())
    .filter(Boolean);
  const areas: AreaId[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const a = parseArea(p);
    if (a) {
      if (!areas.includes(a)) areas.push(a);
    } else unknown.push(p);
  }
  return { areas, unknown };
}

export function parseStatus(raw: string): TaskStatus | null {
  const key = normalize(raw);
  if (!key) return null;
  const hit = (Object.entries(STATUS_LABEL) as [TaskStatus, string][]).find(([id, label]) => id === key || normalize(label) === key);
  if (hit) return hit[0];
  if (['feito', 'concluido', 'concluida', 'pronta', 'done'].includes(key)) return 'done';
  if (['a fazer', 'todo', 'para fazer'].includes(key)) return 'todo';
  if (['em andamento', 'fazendo', 'doing'].includes(key)) return 'doing';
  return null;
}

export const PRIORITY_LABEL: Record<Priority, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export function parsePriority(raw: string): Priority | null {
  const key = normalize(raw);
  return (['alta', 'media', 'baixa'] as const).find(p => p === key) ?? null;
}

/** "sim", "x", "1" ou "true" marcam a iniciativa como Objetivo Master. */
export const parseYes = (raw: string) => ['sim', 's', 'x', '1', 'true', 'yes'].includes(normalize(raw));

/** dd/mm/aaaa (ou aaaa-mm-dd) → aaaa-mm-dd. Devolve null se não for uma data válida. */
export function parseDateBr(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let d: number, m: number, y: number;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (br) [d, m, y] = [+br[1]!, +br[2]!, +br[3]!];
  else if (iso) [y, m, d] = [+iso[1]!, +iso[2]!, +iso[3]!];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Resumo de uma importação (ou da prévia, antes de confirmar). */
export type BacklogImportResult = {
  applied: boolean;
  iniciativas: { novas: number; existentes: number };
  epicos: { novos: number; existentes: number };
  tarefas: { novas: number; existentes: number };
  /** Linhas que não puderam entrar, com o número da linha na planilha. */
  problemas: { linha: number; motivo: string }[];
  /** O que o app novo tem e a planilha não trouxe: a pessoa completa depois. */
  faltando: {
    tarefasSemStatus: number;
    tarefasSemPrioridade: number;
    tarefasSemPrazo: number;
    tarefasSemDescricao: number;
    semObjetivoMaster: boolean;
    iniciativasSemEpico: string[];
    epicosSemTarefa: string[];
  };
};
