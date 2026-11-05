import type { AreaId } from './areas';

/** Fontes que a pessoa pode escolher para a análise (ícones no topo da tela). */
export const ANALYSIS_SOURCES = [
  { id: 'necrologio', label: 'Necrológio', icon: 'feather', color: '#7c4dde' },
  { id: 'roda', label: 'Roda da vida', icon: 'wheel', color: '#16a34a' },
  { id: 'maslow', label: 'Pirâmide', icon: 'triangle', color: '#f59e0b' },
  { id: 'quadro', label: 'Quadro de visualizações', icon: 'image', color: '#3b82f6' },
  { id: 'tarefas', label: 'Tarefas', icon: 'checkSq', color: '#ef4444' },
] as const;
export type AnalysisSource = (typeof ANALYSIS_SOURCES)[number]['id'];
export const ANALYSIS_SOURCE_IDS = ANALYSIS_SOURCES.map(s => s.id) as AnalysisSource[];

/** Intervalo padrão entre duas análises da mesma pessoa (decisão do dono de 05/11/2026: uma por mês). */
export const ANALYSIS_INTERVAL_DAYS = 30;

export const alignmentLabel = (pct: number) => (pct < 50 ? 'Baixo alinhamento' : pct < 70 ? 'Médio alinhamento' : 'Bom alinhamento');

/** Um achado com título e explicação (padrões de evolução e gaps). */
export type AnalysisPoint = { titulo: string; texto: string };
/** Padrão limitante: um nome curto e marcante, e a explicação. */
export type AnalysisLimit = { nome: string; texto: string };
export type AnalysisTask = { titulo: string; descricao: string };
/** Sugestão em forma de trilha: iniciativa → épicos → tarefas. */
export type AnalysisSuggestion = {
  iniciativa: { titulo: string; descricao: string; porque: string; areas: AreaId[] };
  epicos: { titulo: string; areas: AreaId[]; tarefas: AnalysisTask[] }[];
};

/**
 * Relatório do "Me analise" (formato de 05/11/2026, inspirado no app antigo).
 * É o mesmo formato que o agente da IA devolve; os nomes ficam em português por isso.
 */
export type AnalysisContent = {
  /** Quem a pessoa é hoje e o momento que vive. */
  retrato: string;
  /** Índice de alinhamento entre o que a pessoa diz querer e o que faz (0 a 100). */
  geral: number;
  padroes: AnalysisPoint[];
  gaps: AnalysisPoint[];
  manter: string[];
  ajustar: string[];
  /** O que pausar por enquanto. */
  abandonar: string[];
  proximos7dias: string[];
  limitantes: AnalysisLimit[];
  /** Uma pergunta forte para a pessoa levar consigo. */
  pergunta: string;
  /** Mensagem de cuidado (ex.: indicar o CVV) quando há sinais de sofrimento grave; vazio no resto. */
  cuidado: string;
  sugestoes: AnalysisSuggestion[];
};

export type AnalysisReportDto = AnalysisContent & {
  id: string | null;
  example: boolean;
  sources: AnalysisSource[];
  imported: number[];
  createdAt: string;
};

export type AnalysisLatestDto = {
  report: AnalysisReportDto;
  /** Fontes com dados (as outras aparecem desativadas). */
  available: AnalysisSource[];
  mode: 'mock' | 'afl';
  /** Quando a pessoa pode gerar a próxima análise (limite de frequência). */
  nextAllowedAt: string | null;
};

/** Itens escolhidos ao importar uma sugestão: para cada épico marcado, os índices das tarefas marcadas. */
export type AnalysisImportBody = { epicos: { index: number; tarefas: number[] }[] };
