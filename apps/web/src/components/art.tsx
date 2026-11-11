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
  'M40.89 14.25L40.36 13.38L39.78 12.54L39.16 11.74L38.5 10.96L37.8 10.22L37.06 9.52L36.29 8.86L35.48 8.24L34.65 7.66L33.78 7.13L32.89 6.64L31.97 6.2L31.03 5.81L30.07 5.47L29.09 5.18L28.11 4.94L27.11 4.75L26.1 4.61L25.08 4.53L24.07 4.5L23.05 4.52L22.03 4.6L21.02 4.73L20.02 4.91L19.03 5.14L18.06 5.43L17.1 5.76L16.15 6.15L15.23 6.58L14.34 7.06L13.47 7.59L12.62 8.16L11.81 8.78L11.04 9.43L10.29 10.13L9.59 10.86L8.92 11.63L8.3 12.44L7.72 13.27L7.18 14.14L6.69 15.03L6.24 15.94L5.85 16.88L5.5 17.84L5.2 18.81L4.96 19.8L4.76 20.8L4.62 21.8L4.54 22.82L4.5 23.83L4.52 24.85L4.59 25.87L4.71 26.88L4.89 27.88L5.12 28.87L5.4 29.85L5.73 30.81L6.11 31.76L6.54 32.68L7.01 33.58L7.54 34.45L8.1 35.3L8.72 36.11L9.37 36.88L10.11 37.59L10.88 38.25L11.67 38.87L12.5 39.45L13.36 39.98L14.23 40.46L15.13 40.9L16.05 41.28L16.99 41.62L17.93 41.9L18.89 42.14L19.86 42.32L20.83 42.46L21.8 42.54L22.78 42.57L23.75 42.55L24.71 42.48L25.67 42.36L26.62 42.19L27.55 41.97L28.47 41.7L29.37 41.39L30.25 41.03L31.11 40.63L31.94 40.18L32.74 39.69L33.52 39.17L34.26 38.6L34.97 38L35.65 37.36L36.29 36.69L36.89 36L37.46 35.27L37.98 34.52L38.46 33.74L38.9 32.94L39.29 32.12L39.64 31.29L39.95 30.44L39.58 30.29L39.17 31.07L38.73 31.83L38.25 32.55L37.74 33.25L37.19 33.92L36.61 34.56L36 35.16L35.36 35.73L34.69 36.26L34 36.76L33.29 37.21L32.56 37.63L31.81 38.01L31.04 38.34L30.26 38.64L29.46 38.89L28.66 39.1L27.85 39.26L27.04 39.39L26.23 39.47L25.41 39.5L24.6 39.5L23.79 39.45L22.99 39.36L22.2 39.22L21.41 39.05L20.65 38.84L19.89 38.59L19.16 38.3L18.44 37.97L17.74 37.61L17.07 37.21L16.42 36.78L15.79 36.32L15.2 35.83L14.63 35.31L14.09 34.76L13.59 34.19L13.11 33.59L12.63 33L12.18 32.4L11.76 31.77L11.37 31.12L11.02 30.45L10.7 29.77L10.41 29.07L10.17 28.35L9.96 27.62L9.79 26.88L9.66 26.14L9.57 25.39L9.51 24.63L9.5 23.88L9.53 23.12L9.59 22.37L9.7 21.62L9.84 20.87L10.02 20.14L10.24 19.42L10.5 18.71L10.8 18.01L11.13 17.33L11.49 16.67L11.89 16.02L12.32 15.4L12.79 14.8L13.28 14.23L13.81 13.69L14.36 13.17L14.94 12.68L15.54 12.22L16.17 11.8L16.81 11.41L17.48 11.05L18.17 10.73L18.87 10.44L19.58 10.19L20.31 9.98L21.04 9.8L21.79 9.67L22.54 9.57L23.29 9.52L24.05 9.5L24.81 9.52L25.56 9.58L26.31 9.69L27.05 9.83L27.79 10L28.51 10.22L29.23 10.47L29.92 10.77L30.61 11.09L31.27 11.45L31.92 11.85L32.54 12.28L33.14 12.74L33.71 13.23L34.26 13.76L34.78 14.3L35.27 14.88L35.73 15.48L36.16 16.1L36.56 16.75Z';

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
          <circle cx="39.05" cy="14.41" r="0.6" fill="#000" />
        </mask>
      </defs>
      <g fill="rgb(var(--p))" mask={`url(#${id})`}>
        <path d={SNAKE_BODY} />
        <circle cx="38.72" cy="15.5" r="2.5" />
        <circle cx="39.76" cy="30.37" r="0.2" />
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
