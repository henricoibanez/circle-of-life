import { AREAS, type RodaScores } from '@circle/shared';
import { tint } from '@/lib/color';
import { ICON_PATHS } from '../icon-paths';

/** Gráfico radar da Roda da Vida (10 áreas, notas de 0 a 10), como no protótipo. */
export function Radar({ scores, size = 260 }: { scores: RodaScores; size?: number }) {
  const c = size / 2;
  const R = size / 2 - 52;
  const pt = (i: number, v: number) => {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return [c + (Math.cos(a) * R * v) / 10, c + (Math.sin(a) * R * v) / 10] as const;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label="Gráfico da Roda da Vida">
      {[2, 4, 6, 8, 10].map(r => (
        <polygon key={r} points={AREAS.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="rgb(var(--line))" />
      ))}
      {[0, 2, 4, 6, 8, 10].map(r => (
        <text key={r} x={c + 3} y={c - (R * r) / 10 + 3} fontSize="7" fill="rgb(var(--muted))">
          {r}
        </text>
      ))}
      <polygon
        points={AREAS.map((a, i) => pt(i, scores[a.id]).join(',')).join(' ')}
        fill="rgb(var(--p) / .15)"
        stroke="rgb(var(--p))"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {AREAS.map((a, i) => {
        const [x, y] = pt(i, scores[a.id]);
        return <circle key={a.id} cx={x} cy={y} r="2.6" fill="rgb(var(--p))" />;
      })}
      {AREAS.map((a, i) => {
        const [x, y] = pt(i, 13.6);
        return (
          <g key={a.id}>
            <circle cx={x} cy={y - 7} r="11" fill={tint(a.color, 0.14)} />
            <g transform={`translate(${x - 6.5} ${y - 13.5}) scale(.54)`}>
              <path d={ICON_PATHS[a.icon as keyof typeof ICON_PATHS]} fill="none" stroke={a.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <text x={x} y={y + 12} textAnchor="middle" fontSize="7.4" fill="rgb(var(--ink) / .85)">
              {a.name.length > 14 ? a.name.split(' ')[0] : a.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
