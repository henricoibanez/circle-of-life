import type { CSSProperties } from 'react';
import { ICON_PATHS, type IconName } from './icon-paths';

export type { IconName };

/** Ícone do protótipo: <Icon n="home" className="w-6 h-6" />. */
export function Icon({
  n,
  className = 'w-5 h-5',
  sw = 1.8,
  fill = 'none',
  style,
}: {
  n: IconName | string;
  className?: string;
  sw?: number;
  fill?: string;
  style?: CSSProperties;
}) {
  const d = ICON_PATHS[n as IconName] ?? ICON_PATHS.circle;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
