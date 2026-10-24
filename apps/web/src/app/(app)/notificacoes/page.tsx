'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { Header } from '@/components/header';
import { Icon, type IconName } from '@/components/icon';
import { Card, Empty, IconBtn } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { Button } from '@/components/ui/button';
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
};

/** Sino: lista de notificações com ler, marcar como não lida, apagar e limpar. */
export default function NotificacoesPage() {
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
    router.push(n.link);
  };
  const menu = (n: NotificationItem) =>
    openActions(n.title, [
      n.read ? { icon: 'bell', label: 'Marcar como não lida', run: () => actions.unread(n.id) } : { icon: 'check', label: 'Marcar como lida', run: () => actions.read(n.id) },
      { icon: 'trash', label: 'Apagar', danger: true, run: () => actions.remove(n.id) },
    ]);

  return (
    <>
      <Header
        title="Notificações"
        sub={unread ? `${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'}
        fallback="/feed"
        right={
          <IconBtn
            n="more"
            label="Opções"
            onClick={() =>
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
              ])
            }
          />
        }
      />
      <div className="space-y-3 px-4 pb-8">
        {unread > 0 && (
          <Button variant="soft" className="w-full" onClick={() => actions.readAll()}>
            <Icon n="checkCircle" className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
        {data && data.length > 0 && (
          <Card className="divide-y divide-line">
            {data.map(n => {
              const [icon, color] = ICONS[n.type] ?? ['bell', 'rgb(var(--p))'];
              return (
                <div key={n.id} className={`flex items-start gap-3 p-3.5 ${n.read ? '' : 'bg-primary/5'}`}>
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `${color}1f`, color }}>
                    <Icon n={icon} />
                  </span>
                  <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                    <p className={`text-[15px] leading-snug ${n.read ? '' : 'font-semibold'}`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted">{since(n.createdAt)}</p>
                  </button>
                  {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                  <IconBtn n="moreV" label="Opções da notificação" className="-mr-1 h-8 w-8 text-muted" onClick={() => menu(n)} />
                </div>
              );
            })}
          </Card>
        )}
        {data?.length === 0 && <Empty>Nenhuma notificação por aqui.</Empty>}
      </div>
    </>
  );
}
