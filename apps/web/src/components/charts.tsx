import { useId } from 'react';

/** Gráfico de linha simples do protótipo. `pct` mostra o eixo em %, senão em números. */
export function LineChart({
  pts,
  color = 'rgb(var(--a))',
  pct = true,
  W = 300,
  H = 140,
}: {
  pts: { v: number; label?: string }[];
  color?: string;
  pct?: boolean;
  W?: number;
  H?: number;
}) {
  const id = 'lc' + useId().replace(/:/g, '');
  const L = 30;
  const B = 22;
  const T = 8;
  const max = pct ? 1 : Math.max(1, ...pts.map(p => p.v));
  const x = (i: number) => L + (W - L - 6) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de linha">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(g => (
        <g key={g}>
          <line x1={L} x2={W - 4} y1={y(g * max)} y2={y(g * max)} stroke="rgb(var(--line))" />
          <text x={L - 4} y={y(g * max) + 3} fontSize="8" textAnchor="end" fill="rgb(var(--muted))">
            {pct ? `${g * 100}%` : Math.round(g * max)}
          </text>
        </g>
      ))}
      {pts.length > 0 && <polygon points={`${x(0)},${y(0)} ${line} ${x(pts.length - 1)},${y(0)}`} fill={`url(#${id})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.v)} r="2.6" fill={color} />
      ))}
      {pts.map(
        (p, i) =>
          p.label && (
            <text key={'l' + i} x={x(i)} y={H - 6} fontSize="8" textAnchor="middle" fill="rgb(var(--muted))">
              {p.label}
            </text>
          ),
      )}
    </svg>
  );
}

/** Rosca (donut) com fatias coloridas. */
export function Donut({ parts, size = 110 }: { parts: { v: number; c: string }[]; size?: number }) {
  const r = 40;
  const C = 2 * Math.PI * r;
  const tot = parts.reduce((x, p) => x + p.v, 0) || 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      {parts.map((p, i) => {
        const len = (C * p.v) / tot;
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={p.c} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
        acc += len;
        return el;
      })}
    </svg>
  );
}
