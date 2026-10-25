'use client';

import type { ArtVariant } from '@circle/shared';
import { useId } from 'react';
import { mix } from '@/lib/color';
import { ICON_PATHS } from './icon-paths';

/** Ilustrações em SVG do protótipo: paisagens (Art), folhas, logo, troféu etc. */

export function Art({ v = 'lake', c = '#5e873c', className = '' }: { v?: ArtVariant; c?: string; className?: string }) {
  const id = 'g' + useId().replace(/:/g, '');
  const L = (w: number) => mix(c, '#ffffff', w);
  const D = (w: number) => mix(c, '#000000', w);
  const night = v === 'night';
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? D(0.55) : v === 'sun' ? mix(c, '#fde68a', 0.55) : L(0.7)} />
          <stop offset="1" stopColor={night ? D(0.2) : v === 'sun' ? mix(c, '#fff7ed', 0.75) : L(0.92)} />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#${id})`} />
      {v === 'lake' && (
        <>
          <circle cx="120" cy="28" r="10" fill="#fff" opacity=".7" />
          <path d="M0 72 30 38l22 24 32-36 34 38 24-20 18 16v60H0z" fill={L(0.45)} />
          <path d="M0 84 26 62l26 18 30-24 30 26 26-18 22 16v40H0z" fill={L(0.2)} />
          <rect y="90" width="160" height="30" fill={L(0.55)} />
          <path d="M20 98h40M80 104h50M30 110h60" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
        </>
      )}
      {v === 'sun' && (
        <>
          <circle cx="80" cy="74" r="24" fill={mix('#fbbf24', '#ffffff', 0.25)} opacity=".95" />
          <path d="M0 80q40-18 80-2t80-6v48H0z" fill={D(0.1)} />
          <path d="M0 96q50-14 100 0t60-4v28H0z" fill={D(0.35)} />
        </>
      )}
      {v === 'forest' && (
        <>
          <path d="M0 90h160v30H0z" fill={D(0.25)} />
          {[[10, 44], [28, 30], [46, 52], [64, 26], [84, 40], [102, 22], [122, 46], [142, 30], [156, 50]].map(([x, h], i) => (
            <path key={i} d={`M${x} ${92 - h! * 1.2}l${12} ${h! * 1.2 + 4}h-24z`} fill={i % 2 ? D(0.15) : D(0.35)} />
          ))}
          <path d="M60 120 80 92l20 28z" fill={L(0.4)} opacity=".5" />
        </>
      )}
      {v === 'sea' && (
        <>
          <circle cx="110" cy="54" r="16" fill="#fff7d6" />
          <rect y="70" width="160" height="50" fill={D(0.15)} />
          <path d="M0 80q10-4 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0M0 94q10-4 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0" stroke="#fff" strokeOpacity=".5" fill="none" />
          <path d="M18 70c4-16 10-26 22-30M40 40c-6 0-12 2-16 6M40 40c-4 4-6 8-6 14M40 40c6 2 10 6 12 12" stroke={D(0.5)} strokeWidth="2" fill="none" />
        </>
      )}
      {v === 'night' && (
        <>
          {[[20, 18], [44, 30], [70, 14], [96, 26], [128, 16], [146, 34], [30, 44], [110, 44]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.5} fill="#fff" opacity=".85" />
          ))}
          <circle cx="124" cy="30" r="9" fill="#fef3c7" />
          <path d="M0 86 34 54l24 22 30-34 34 36 20-16 18 14v44H0z" fill={D(0.45)} />
          <path d="M0 98 30 80l30 14 34-20 34 22 32-10v34H0z" fill={D(0.65)} />
        </>
      )}
      {v === 'field' && (
        <>
          <path d="M0 78q40-12 80 0t80 0v42H0z" fill={L(0.25)} />
          <path d="M0 94q50-10 100 2t60-2v26H0z" fill={D(0.1)} />
          {[50, 80, 110].map((x, i) => (
            <g key={i}>
              <path d={`M${x} 96v-18`} stroke={D(0.35)} strokeWidth="2" />
              <path d={`M${x} 82c-8-2-12-8-12-14 8 0 12 6 12 14zM${x} 80c8-2 12-8 12-14-8 0-12 6-12 14z`} fill={D(0.2)} />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

/** Imagem enviada (src) ou, sem imagem, uma ilustração (art + cor). */
export type MediaItem = { src?: string | null; art?: ArtVariant; c?: string };
export function Media({ m, className = '' }: { m?: MediaItem; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (m?.src) return <img src={m.src} alt="" className={`object-cover ${className}`} />;
  return <Art v={m?.art} c={m?.c} className={className} />;
}

export function Leaves({ className = '', c = 'rgb(var(--p))' }: { className?: string; c?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <path d="M190 10C140 40 110 90 90 190" stroke={c} strokeOpacity=".35" strokeWidth="2" />
      {[[178, 22, -30], [160, 40, -10], [150, 62, -40], [132, 80, -15], [124, 104, -45], [108, 124, -20], [102, 150, -50]].map(([x, y, r], i) => (
        <path
          key={i}
          transform={`translate(${x} ${y}) rotate(${r! + (i % 2 ? 160 : 0)})`}
          d="M0 0c10-14 30-16 40-10-6 14-26 20-40 10z"
          fill={c}
          fillOpacity={i % 2 ? 0.16 : 0.24}
        />
      ))}
    </svg>
  );
}

export function Logo({ className = 'w-9 h-9' }: { className?: string }) {
  const id = 'lg' + useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--p))" />
          <stop offset="1" stopColor="rgb(var(--p) / .45)" />
        </linearGradient>
      </defs>
      <path d="M38 11A18 18 0 1 0 41.5 28" fill="none" stroke={`url(#${id})`} strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="10.5" fill="none" stroke="rgb(var(--p) / .25)" strokeWidth="1.5" />
    </svg>
  );
}

/** "Circle of Life" escrito como no protótipo. */
export function Wordmark({ className = 'text-[1.5rem]' }: { className?: string }) {
  return (
    <p className={`tracking-tight ${className}`}>
      <span className="font-semibold text-primary">Circle</span> <span className="font-normal text-muted">of</span>{' '}
      <span className="font-semibold text-primary">Life</span>
    </p>
  );
}

export function PyramidHill({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden="true">
      <ellipse cx="40" cy="44" rx="26" ry="9" fill="#fff" opacity=".7" />
      <ellipse cx="190" cy="66" rx="24" ry="8" fill="#fff" opacity=".7" />
      <path d="M118 6 40 140h156z" fill="rgb(var(--p) / .55)" />
      <path d="M118 6 118 140h78z" fill="rgb(var(--p) / .8)" />
      {[44, 74, 104].map(y => (
        <path key={y} d={`M${118 - (y - 6) * 0.58} ${y}H${118 + (y - 6) * 0.58}`} stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
      ))}
      <path d="M0 140q60-26 110-8t110-4v22H0z" fill="rgb(var(--p) / .25)" />
    </svg>
  );
}

export function Quill({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      <path d="M96 4C70 10 46 34 36 68l-6 14 14-6C78 66 98 40 106 8z" fill="rgb(var(--a) / .55)" />
      <path d="M100 8C80 28 58 52 32 84" stroke="rgb(var(--a))" strokeWidth="2" fill="none" />
      <path d="M58 84h40l-4 22H62z" fill="rgb(var(--a) / .85)" />
      <rect x="54" y="78" width="48" height="8" rx="3" fill="rgb(var(--a))" />
      <path d="M8 104c6-10 14-14 22-10" stroke="rgb(var(--a) / .4)" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function TrophyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      {[[14, 20], [104, 28], [22, 78], [98, 82]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y! - 5}l1.6 3.4 3.4 1.6-3.4 1.6L${x} ${y! + 5}l-1.6-3.4L${x! - 5} ${y}l3.4-1.6z`} fill="rgb(var(--a) / .6)" />
      ))}
      <path d="M36 14h48v26a24 24 0 0 1-48 0z" fill="rgb(var(--a))" />
      <path d="M36 22H22a14 14 0 0 0 16 16M84 22h14a14 14 0 0 1-16 16" stroke="rgb(var(--a))" strokeWidth="5" fill="none" />
      <path d="M60 24l3.5 7 7.5 1-5.5 5.4 1.3 7.6L60 41.4 53.2 45l1.3-7.6L49 32l7.5-1z" fill="#fff" opacity=".9" />
      <rect x="54" y="62" width="12" height="16" fill="rgb(var(--a) / .8)" />
      <rect x="40" y="78" width="40" height="12" rx="3" fill="rgb(var(--a))" />
    </svg>
  );
}

export function MountainFlag({ className, c = 'rgb(var(--a))' }: { className?: string; c?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden="true">
      <path d="M0 90 44 30l18 20 14-16 44 56z" fill={c} opacity=".18" />
      <path d="M44 30l18 20-6 8-12-10-12 6z" fill="#fff" opacity=".6" />
      <path d="M76 34V8" stroke={c} strokeWidth="2" />
      <path d="M76 8h16l-4 5 4 5H76z" fill={c} />
    </svg>
  );
}

export function StepsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden="true">
      <path d="M10 130 90 40l30 30 20-16 54 76z" fill="rgb(var(--a) / .16)" />
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={70 + i * 18} y={112 - i * 18} width="18" height={18 + i * 18} rx="2" fill="#fff" stroke="rgb(var(--a) / .25)" />
      ))}
      <path d="M134 58V22" stroke="rgb(var(--a))" strokeWidth="2.5" />
      <path d="M134 22h24l-6 7 6 7h-24z" fill="rgb(var(--a))" />
      <circle cx="56" cy="44" r="12" fill="#fff" />
      <path d="M56 37l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" fill="#f59e0b" />
      <circle cx="176" cy="40" r="12" fill="#fff" />
      <path d={ICON_PATHS.heart} transform="translate(169 33) scale(.6)" fill="#ef4444" />
      <circle cx="172" cy="104" r="12" fill="#22a35a" />
      <path d="M166 104l4 4 8-8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
