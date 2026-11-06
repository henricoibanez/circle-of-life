'use client';

import { REACTIONS, type ReactionCounts, type ReactionKind } from '@circle/shared';

/**
 * Reações (curtir, não curtir, coração): tocar escolhe; tocar de novo na mesma tira.
 * `counts` mostra quantas de cada (quando a pessoa pode ver).
 */
export function ReactionBar({
  mine,
  counts,
  onPick,
  tone = 'light',
  size = 'sm',
}: {
  mine: ReactionKind | null;
  counts?: ReactionCounts | null;
  onPick: (kind: ReactionKind | null) => void;
  tone?: 'light' | 'dark';
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Reações">
      {REACTIONS.map(r => {
        const on = mine === r.id;
        const n = counts?.[r.id] ?? 0;
        const pad = size === 'lg' ? 'px-3 py-2 text-[1.375rem]' : 'px-2 py-0.5 text-[0.9375rem]';
        const look = on
          ? tone === 'dark'
            ? 'bg-white/30 ring-1 ring-white/60'
            : 'bg-primary/15 ring-1 ring-primary/40'
          : tone === 'dark'
            ? 'bg-black/20 opacity-80'
            : 'opacity-60 hover:opacity-100';
        return (
          <button
            key={r.id}
            type="button"
            aria-label={r.label}
            aria-pressed={on}
            onClick={() => onPick(on ? null : r.id)}
            className={`inline-flex items-center gap-1 rounded-full transition ${pad} ${look}`}
          >
            <span aria-hidden>{r.emoji}</span>
            {n > 0 && <span className={`text-[0.75rem] font-semibold ${tone === 'dark' ? 'text-white' : 'text-ink/80'}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
