import { useId } from 'react';

/**
 * Símbolo dos Círculos, a moeda do app (decisão do dono de 06/11/2026): um anelzinho de ouro.
 * O tamanho vem da classe (ex.: "h-5 w-5"); as cores são fixas (ouro), não seguem o tema.
 */
export function CoinIcon({ className = 'h-5 w-5', title }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-ouro`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.45" stopColor="#f5b301" />
          <stop offset="1" stopColor="#b7791f" />
        </linearGradient>
      </defs>
      {/* Anel: aro grosso dourado, com um brilho no alto à esquerda. */}
      <circle cx="12" cy="12" r="7.6" fill="none" stroke={`url(#${id}-ouro)`} strokeWidth="4.2" />
      <circle cx="12" cy="12" r="9.7" fill="none" stroke="#b7791f" strokeOpacity=".55" strokeWidth=".6" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#b7791f" strokeOpacity=".55" strokeWidth=".6" />
      <path d="M6.6 8.4a6.4 6.4 0 0 1 3.4-2.7" fill="none" stroke="#fffbeb" strokeOpacity=".9" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
