import { AREA_IDS, type AreaId } from './areas';

/** Notas da Roda da Vida (0 a 10) por área. */
export type RodaScores = Record<AreaId, number>;

export type RodaDto = {
  scores: RodaScores;
  /** Se a pessoa já deu alguma nota (senão a roda está "em branco"). */
  rated: boolean;
  history: { id: string; scores: RodaScores; createdAt: string }[];
};

/** Equilíbrio geral: média das 10 notas (0 a 10). */
export const rodaAvg = (s: RodaScores) => AREA_IDS.reduce((x, a) => x + (s[a] ?? 0), 0) / AREA_IDS.length;

export const emptyScores = (): RodaScores => Object.fromEntries(AREA_IDS.map(a => [a, 0])) as RodaScores;

/** Máximo de sonhos abertos no Quadro de visualização. */
export const MAX_OPEN_DREAMS = 10;

export type DreamDto = { id: string; text: string; area: AreaId; imageUrl: string | null; imageFileId: string | null; doneAt: string | null; createdAt: string };

/** Minhas conquistas: épicos encerrados e iniciativas concluídas, por área da vida. */
export type ConquistasDto = {
  /** `journey` = 1 quando a Jornada foi concluída (a conquista vale para todas as áreas). */
  areas: { area: AreaId; epics: number; initiatives: number; journey: number }[];
  /** Conquista "Jornada concluída": quando foi (null = ainda não). */
  journeyDoneAt: string | null;
  /** Tarefas concluídas / total (anel do topo da tela). */
  tasks: { done: number; total: number };
};
export type AreaConquistasDto = {
  epics: { id: string; title: string; closedAt: string }[];
  initiatives: { id: string; title: string; completedAt: string }[];
  /** Conquista "Jornada concluída" (aparece em todas as áreas). */
  journeyDoneAt: string | null;
};
