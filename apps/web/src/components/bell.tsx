'use client';

import Link from 'next/link';
import { useUnreadCount } from '@/lib/notifications';
import { Icon } from './icon';

/** Sino com o número de notificações não lidas. */
export function Bell({ className = '' }: { className?: string }) {
  const { data: count = 0 } = useUnreadCount();
  return (
    <Link
      href="/notificacoes"
      aria-label={count ? `Notificações: ${count} não lidas` : 'Notificações'}
      className={`relative grid h-10 w-10 place-items-center text-ink/80 ${className}`}
    >
      <Icon n="bell" className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-onprimary">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
