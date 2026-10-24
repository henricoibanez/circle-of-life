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

/** Selo de cada área, como no protótipo: abaixo de 50% Atenção, abaixo de 70% Em evolução. */
export type AnalysisTag = 'atencao' | 'evolucao' | 'alinhado';
export const analysisTag = (pct: number): AnalysisTag => (pct < 50 ? 'atencao' : pct < 70 ? 'evolucao' : 'alinhado');
export const ANALYSIS_TAGS: Record<AnalysisTag, [string, string]> = {
  atencao: ['Atenção', '#ea8a0c'],
  evolucao: ['Em evolução', '#3b82f6'],
  alinhado: ['Alinhado', '#16a34a'],
};
export const alignmentLabel = (pct: number) => (pct < 50 ? 'Baixo alinhamento' : pct < 70 ? 'Médio alinhamento' : 'Bom alinhamento');

export type AnalysisArea = { area: AreaId; pct: number; texto: string };
export type AnalysisInsight = { icon: 'trend' | 'alert' | 'target'; titulo: string; texto: string };
/** Sugestão em forma de trilha: iniciativa → épicos → tarefas. */
export type AnalysisSuggestion = {
  iniciativa: { titulo: string; descricao: string; areas: AreaId[] };
  epicos: { titulo: string; area: AreaId; tarefas: string[] }[];
};

export type AnalysisContent = {
  geral: number;
  visao: string;
  areas: AnalysisArea[];
  insights: AnalysisInsight[];
  suggestions: AnalysisSuggestion[];
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
  mode: 'mock' | 'anthropic';
  /** Quando a pessoa pode gerar o próximo relatório (limite de frequência). */
  nextAllowedAt: string | null;
};

/** Itens escolhidos ao importar uma sugestão: para cada épico marcado, os índices das tarefas marcadas. */
export type AnalysisImportBody = { epicos: { index: number; tarefas: number[] }[] };
