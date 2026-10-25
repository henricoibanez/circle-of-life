'use client';

import { AREA, type AreaId } from '@circle/shared';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { tint } from '@/lib/color';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icon';

/** Peças pequenas de interface do protótipo (AreaIcon, Ring, Bar, Tag, Card, Avatar…). */

export function AreaIcon({ id, size = 'w-11 h-11', icon = 'w-5 h-5', color }: { id?: AreaId | null; size?: string; icon?: string; color?: string }) {
  const a = id ? AREA[id] : undefined;
  const c = color || a?.color || '#888888';
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full`} style={{ background: tint(c, 0.12), color: c }}>
      <Icon n={a?.icon || 'circle'} className={icon} />
    </span>
  );
}

/** Anel de progresso circular. `pct` de 0 a 1. */
export function Ring({
  pct,
  size = 120,
  stroke = 10,
  color = 'rgb(var(--p))',
  track = 'rgb(var(--line))',
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size / 16 + 'rem', height: size / 16 + 'rem' }}>
      <svg viewBox={'0 0 ' + size + ' ' + size} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(1, Math.max(0, pct)))}
          style={{ transition: 'stroke-dashoffset .5s' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Barra de progresso. `pct` de 0 a 1. */
export function Bar({ pct, color, className = 'h-1.5', track = 'bg-sunk' }: { pct: number; color?: string; className?: string; track?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-full ${track} ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%`, background: color || 'rgb(var(--p))' }}
      />
    </div>
  );
}

export const PRIO = { alta: ['Alta', '#dc2626'], media: ['Média', '#d97706'], baixa: ['Baixa', '#16a34a'] } as const;
export type Priority = keyof typeof PRIO;

export function Prio({ p, long }: { p: Priority; long?: boolean }) {
  const [label, c] = PRIO[p];
  return (
    <span className="rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold" style={{ color: c, background: tint(c, 0.1) }}>
      {label}
      {long ? ' prioridade' : ''}
    </span>
  );
}

export function Tag({ children, c = 'rgb(var(--p))', className = '' }: { children: ReactNode; c?: string; className?: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold ${className}`}
      style={{ color: c, background: c.startsWith('#') ? tint(c, 0.12) : 'rgb(var(--p) / .12)' }}
    >
      {children}
    </span>
  );
}

export function IconBtn({ n, label, className = '', box, ...p }: { n: IconName; label: string; box?: boolean } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...p}
      className={cn(
        'grid place-items-center rounded-xl text-ink/80 hover:bg-sunk disabled:pointer-events-none disabled:opacity-25',
        box ? 'h-11 w-11 border border-line bg-surface shadow-soft' : 'h-10 w-10',
        className,
      )}
    >
      <Icon n={n} />
    </button>
  );
}

export function Card({ className = '', ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cn('rounded-2xl border border-line/80 bg-surface shadow-soft', className)} />;
}

export function Avatar({
  name = '?',
  color,
  photo,
  size = 'w-10 h-10 text-sm',
  ring,
}: {
  name?: string;
  color?: string;
  photo?: string | null;
  size?: string;
  ring?: boolean;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={`${size} inline-flex shrink-0 rounded-full ${ring ? 'p-[0.1875rem] ring-2 ring-primary/60 ring-offset-2 ring-offset-bg' : ''}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-full font-bold text-white" style={{ background: color || 'rgb(var(--p))' }}>
          {initials}
        </span>
      )}
    </span>
  );
}

export type ChipItem = { id: string; label: string; icon?: IconName; color?: string };

/** Fileira de filtros que rola para o lado. */
export function Chips({ items, value, onChange, className = '' }: { items: ChipItem[]; value: string; onChange: (id: string) => void; className?: string }) {
  return (
    <div className={`no-bar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${className}`}>
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
            value === it.id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-line bg-surface text-ink/80 hover:bg-sunk'
          }`}
        >
          {it.icon && <Icon n={it.icon} className="h-4 w-4" />}
          {it.color && !it.icon && <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Seletor segmentado (abas em "pílula"). */
export function Seg<T extends string>({
  items,
  value,
  onChange,
  tone = 'p',
}: {
  items: { id: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (id: T) => void;
  tone?: 'p' | 'a';
}) {
  return (
    <div className="flex rounded-2xl bg-sunk p-1" role="tablist">
      {items.map(it => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
            value === it.id ? `bg-surface shadow-soft ${tone === 'a' ? 'text-accent' : 'text-primary'}` : 'text-muted'
          }`}
        >
          {it.icon && <Icon n={it.icon} className="h-4 w-4" />}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

/** Classe dos campos de texto do protótipo. */
export const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[0.9375rem] placeholder:text-muted/70 focus:border-primary focus:outline-none';

/** Estado vazio simples, com mensagem e ação opcional. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="mb-3 text-muted">{children}</p>
      {action}
    </div>
  );
}

export const styleVars = (vars: Record<string, string>) => vars as CSSProperties;
