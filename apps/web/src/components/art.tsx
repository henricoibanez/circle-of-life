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

/**
 * Corpo da serpente do logo: um "C" que fica grosso quase todo o caminho e afina só no fim (o rabo).
 * Gerado a partir de um arco de raio 17 em volta do centro (24, 24); o mesmo desenho está em public/icons/icon.svg.
 */
const SNAKE_BODY =
  'M42.74 18.63L42.44 17.65L42.08 16.7L41.67 15.76L41.22 14.85L40.71 13.96L40.17 13.1L39.57 12.26L38.94 11.47L38.26 10.7L37.55 9.97L36.79 9.28L36.01 8.63L35.18 8.03L34.33 7.46L33.45 6.94L32.55 6.47L31.62 6.05L30.67 5.68L29.7 5.35L28.72 5.08L27.72 4.86L26.71 4.69L25.7 4.57L24.68 4.51L23.66 4.5L22.64 4.55L21.62 4.65L20.61 4.8L19.61 5L18.63 5.26L17.65 5.56L16.7 5.92L15.76 6.33L14.85 6.78L13.96 7.29L13.1 7.83L12.26 8.43L11.47 9.06L10.7 9.74L9.97 10.45L9.28 11.21L8.63 11.99L8.03 12.82L7.46 13.67L6.94 14.55L6.47 15.45L6.05 16.38L5.68 17.33L5.35 18.3L5.08 19.28L4.86 20.28L4.69 21.29L4.57 22.3L4.51 23.32L4.5 24.34L4.55 25.36L4.65 26.38L4.8 27.39L5 28.39L5.26 29.37L5.56 30.35L5.92 31.3L6.33 32.24L6.78 33.15L7.29 34.04L7.83 34.9L8.43 35.74L9.06 36.53L9.74 37.3L10.48 38.01L11.26 38.65L12.08 39.26L12.93 39.82L13.8 40.33L14.69 40.79L15.61 41.21L16.54 41.57L17.49 41.89L18.45 42.15L19.42 42.37L20.4 42.53L21.38 42.64L22.36 42.7L23.35 42.7L24.33 42.66L25.3 42.56L26.26 42.41L27.21 42.22L28.15 41.97L29.07 41.68L29.97 41.34L30.85 40.95L31.7 40.52L32.53 40.05L33.33 39.53L34.1 38.98L34.84 38.38L35.54 37.76L36.21 37.09L36.84 36.4L37.43 35.67L37.98 34.92L38.49 34.14L38.95 33.34L39.37 32.52L39.75 31.68L40.08 30.83L40.37 29.96L40.6 29.08L40.79 28.19L40.94 27.29L41.03 26.39L40.64 26.34L40.44 27.2L40.2 28.04L39.91 28.86L39.58 29.67L39.22 30.46L38.81 31.22L38.36 31.96L37.88 32.67L37.36 33.36L36.81 34.01L36.23 34.63L35.62 35.22L34.98 35.77L34.31 36.29L33.62 36.77L32.91 37.21L32.18 37.61L31.43 37.97L30.67 38.3L29.89 38.57L29.1 38.81L28.3 39.01L27.5 39.16L26.69 39.27L25.88 39.33L25.07 39.36L24.27 39.34L23.47 39.28L22.67 39.17L21.89 39.03L21.11 38.85L20.35 38.62L19.61 38.36L18.88 38.06L18.17 37.72L17.49 37.35L16.82 36.94L16.19 36.51L15.57 36.04L14.99 35.54L14.43 35.01L13.91 34.45L13.4 33.89L12.89 33.32L12.42 32.73L11.98 32.11L11.57 31.47L11.2 30.81L10.86 30.13L10.56 29.43L10.29 28.72L10.06 28L9.87 27.26L9.72 26.52L9.61 25.77L9.54 25.01L9.5 24.25L9.51 23.49L9.56 22.74L9.64 21.98L9.77 21.23L9.93 20.49L10.13 19.76L10.37 19.04L10.65 18.33L10.97 17.64L11.32 16.97L11.7 16.32L12.12 15.68L12.57 15.07L13.06 14.49L13.57 13.93L14.11 13.4L14.68 12.89L15.27 12.42L15.89 11.98L16.53 11.57L17.19 11.2L17.87 10.86L18.57 10.56L19.28 10.29L20 10.06L20.74 9.87L21.48 9.72L22.23 9.61L22.99 9.54L23.75 9.5L24.51 9.51L25.26 9.56L26.02 9.64L26.77 9.77L27.51 9.93L28.24 10.13L28.96 10.37L29.67 10.65L30.36 10.97L31.03 11.32L31.68 11.7L32.32 12.12L32.93 12.57L33.51 13.06L34.07 13.57L34.6 14.11L35.11 14.68L35.58 15.27L36.02 15.89L36.43 16.53L36.8 17.19L37.14 17.87L37.44 18.57L37.71 19.28L37.94 20Z';

/**
 * Logo do Circle of Life: uma serpente em "C" (o ouroboros, a vida em ciclos) com um quadro no meio
 * (A Fazer, Fazendo, Pronto). Segue a cor do tema; o olho é um furo, então mostra o fundo da tela.
 */
export function Logo({ className = 'w-9 h-9' }: { className?: string }) {
  const id = 'lg' + useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <mask id={id}>
          <rect width="48" height="48" fill="#fff" />
          <circle cx="40.93" cy="18.34" r="0.6" fill="#000" />
        </mask>
      </defs>
      <g fill="rgb(var(--p))" mask={`url(#${id})`}>
        <path d={SNAKE_BODY} />
        <circle cx="40.34" cy="19.31" r="2.5" />
        <circle cx="40.83" cy="26.37" r="0.2" />
      </g>
      <g fill="rgb(var(--p))">
        <g fillOpacity=".45">
          <rect x="13.5" y="19.4" width="5" height="1.8" rx=".9" />
          <rect x="13.5" y="22.1" width="5" height="1.8" rx=".9" />
          <rect x="13.5" y="24.8" width="5" height="1.8" rx=".9" />
          <rect x="21.5" y="20.75" width="5" height="1.8" rx=".9" />
          <rect x="21.5" y="23.45" width="5" height="1.8" rx=".9" />
        </g>
        <rect x="29.5" y="22.1" width="5" height="1.8" rx=".9" />
      </g>
      <path d="M20 18.2V28.4M28 18.2V28.4" stroke="rgb(var(--p))" strokeOpacity=".3" strokeWidth=".6" />
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
