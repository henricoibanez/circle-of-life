'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConfirmSheet } from './confirm';
import { Icon, type IconName } from './icon';
import { Empty, IconBtn } from './primitives';
import { Sheet, useSheets } from './sheet';
import { Button } from './ui/button';
import { UNREAD_KEY, useNotificationActions, useNotifications, type NotificationItem } from '@/lib/notifications';
import { since } from '@/lib/time';

const ICONS: Record<string, [IconName, string]> = {
  amizade_pedido: ['userPlus', '#14b8a6'],
  amizade_aceita: ['users', '#14b8a6'],
  curtida: ['heart', '#ef4444'],
  curtida_story: ['heart', '#ef4444'],
  comentario: ['msg', '#3b82f6'],
  tarefa_atrasada: ['alert', '#dc2626'],
  trilha_baixada: ['download', '#7c4dde'],
  trilha_aprovada: ['checkCircle', '#16a34a'],
  trilha_recusada: ['xCircle', '#dc2626'],
  trilha_pendente: ['bag', '#f59e0b'],
  grupo_entrada: ['users', '#14b8a6'],
  grupo_trilha: ['bag', '#7c4dde'],
  grupo_trilha_sugerida: ['bag', '#f59e0b'],
  grupo_gestor: ['verified', '#7c4dde'],
  grupo_topico: ['msg', '#7c4dde'],
  grupo_resposta: ['msg', '#7c4dde'],
};

/** Notificações do sino, numa folha (no computador, janela central): ler, marcar, apagar e limpar. */
export function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useNotifications();
  const actions = useNotificationActions();
  const { openActions, openSheet } = useSheets();
  const unread = (data ?? []).filter(n => !n.read).length;

  // O número do sino acompanha o que está na tela.
  useEffect(() => {
    if (data) qc.setQueryData(UNREAD_KEY, unread);
  }, [data, unread, qc]);

  const open = async (n: NotificationItem) => {
    if (!n.read) await actions.read(n.id);
    onClose();
    router.push(n.link);
  };
  const menu = (n: NotificationItem) =>
    openActions(n.title, [
      n.read ? { icon: 'bell', label: 'Marcar como não lida', run: () => actions.unread(n.id) } : { icon: 'check', label: 'Marcar como lida', run: () => actions.read(n.id) },
      { icon: 'trash', label: 'Apagar', danger: true, run: () => actions.remove(n.id) },
    ]);
  const options = () =>
    openActions('Notificações', [
      { icon: 'checkCircle', label: 'Marcar todas como lidas', run: () => actions.readAll() },
      {
        icon: 'trash',
        label: 'Limpar todas',
        danger: true,
        run: () =>
          openSheet(close => (
            <ConfirmSheet title="Limpar notificações" confirm="Limpar" danger onClose={close} onConfirm={() => actions.clear()}>
              Todas as notificações serão apagadas.
            </ConfirmSheet>
          )),
      },
    ]);

  return (
    <Sheet
      title={
        <span className="block">
          Notificações
          <span className="block text-sm font-normal text-muted">{unread ? `${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'}</span>
        </span>
      }
      onClose={onClose}
    >
      <div className="space-y-3">
        {data && data.length > 0 && (
          <div className="flex gap-2">
            {unread > 0 && (
              <Button variant="soft" className="flex-1" onClick={() => actions.readAll()}>
                <Icon n="checkCircle" className="h-4 w-4" />
                Marcar todas como lidas
              </Button>
            )}
            <IconBtn n="more" label="Opções das notificações" box className="ml-auto" onClick={options} />
          </div>
        )}
        {data && data.length > 0 && (
          <div className="-mx-5 divide-y divide-line border-y border-line">
            {data.map(n => {
              const [icon, color] = ICONS[n.type] ?? ['bell', 'rgb(var(--p))'];
              return (
                <div key={n.id} className={`flex items-start gap-3 px-5 py-3 ${n.read ? '' : 'bg-primary/5'}`}>
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `${color}1f`, color }}>
                    <Icon n={icon} />
                  </span>
                  <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                    <p className={`text-[0.9375rem] leading-snug ${n.read ? '' : 'font-semibold'}`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[0.8125rem] text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted">{since(n.createdAt)}</p>
                  </button>
                  {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                  <IconBtn n="moreV" label="Opções da notificação" className="-mr-1 h-8 w-8 text-muted" onClick={() => menu(n)} />
                </div>
              );
            })}
          </div>
        )}
        {data?.length === 0 && <Empty>Nenhuma notificação por aqui.</Empty>}
      </div>
    </Sheet>
  );
}
