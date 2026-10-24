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
