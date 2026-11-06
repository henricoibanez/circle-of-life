import { emptyReactions, type ReactionCounts, type ReactionKind } from '@circle/shared';

/** Conta quantas reações de cada tipo (curtir, não curtir, coração). */
export function countReactions(rows: { kind: ReactionKind }[]): ReactionCounts {
  const c = emptyReactions();
  for (const r of rows) c[r.kind]++;
  return c;
}
