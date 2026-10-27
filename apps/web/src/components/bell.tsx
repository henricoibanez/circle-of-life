'use client';

import { useUnreadCount } from '@/lib/notifications';
import { Icon } from './icon';
import { NotificationsSheet } from './notifications-sheet';
import { useSheets } from './sheet';

/** Sino com o número de notificações não lidas. Abre as notificações numa folha. */
export function Bell({ className = '' }: { className?: string }) {
  const { data: count = 0 } = useUnreadCount();
  const { openSheet } = useSheets();
  return (
    <button
      onClick={() => openSheet(close => <NotificationsSheet onClose={close} />)}
      aria-label={count ? `Notificações: ${count} não lidas` : 'Notificações'}
      className={`relative grid h-10 w-10 place-items-center text-ink/80 ${className}`}
    >
      <Icon n="bell" className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-onprimary">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
