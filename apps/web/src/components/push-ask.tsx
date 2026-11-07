'use client';

import { PUSH_ASK_AGAIN_DAYS } from '@circle/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Icon } from './icon';
import { Card } from './primitives';
import { useToast } from './toasts';
import { Button } from './ui/button';
import { api } from '@/lib/api';
import { enablePush, PREFS_KEY, pushActive, pushSupported, useNotificationPrefs } from '@/lib/notifications';

/**
 * Convite para ligar as notificações no celular: aparece depois da Jornada, só se este
 * aparelho aceita e ainda não ligou. "Agora não" esconde por PUSH_ASK_AGAIN_DAYS dias.
 */
export function PushAsk() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: prefs } = useNotificationPrefs();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!prefs?.askPush || !pushSupported() || Notification.permission === 'denied') return setShow(false);
    pushActive().then(on => setShow(!on));
  }, [prefs?.askPush]);
  if (!show) return null;

  const later = async () => {
    setShow(false);
    await api('/notifications/push-ask/dismiss', { method: 'POST' }).catch(() => undefined);
    qc.invalidateQueries({ queryKey: PREFS_KEY });
  };
  const enable = async () => {
    setBusy(true);
    try {
      await enablePush();
      setShow(false);
      toast('Notificações ligadas neste aparelho');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível ligar as notificações.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex items-start gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon n="bell" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold">Quer um lembrete da sua vida?</p>
          <p className="text-xs text-muted">Ligue as notificações no celular. O app avisa pouco, só o que importa, e nunca entre 22h e 8h.</p>
        </div>
        <div className="flex gap-2">
          <Button className="px-3 py-1.5 text-sm" disabled={busy} onClick={enable}>
            Ligar
          </Button>
          <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={later} title={`Pergunta de novo daqui a ${PUSH_ASK_AGAIN_DAYS} dias`}>
            Agora não
          </Button>
        </div>
      </div>
    </Card>
  );
}
