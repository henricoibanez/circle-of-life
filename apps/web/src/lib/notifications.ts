'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  actorName: string | null;
  read: boolean;
  createdAt: string;
};

export const NOTIF_KEY = ['notifications'];
export const UNREAD_KEY = ['notifications', 'unread'];

/** Número do sino. Atualiza a cada minuto e ao voltar para o app. */
export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => api<{ count: number }>('/notifications/unread-count').then(r => r.count),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications() {
  return useQuery({ queryKey: NOTIF_KEY, queryFn: () => api<NotificationItem[]>('/notifications'), refetchOnWindowFocus: true });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: NOTIF_KEY });
  return {
    read: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }).then(refresh),
    unread: (id: string) => api(`/notifications/${id}/unread`, { method: 'POST' }).then(refresh),
    readAll: () => api('/notifications/read-all', { method: 'POST' }).then(refresh),
    remove: (id: string) => api(`/notifications/${id}`, { method: 'DELETE' }).then(refresh),
    clear: () => api('/notifications', { method: 'DELETE' }).then(refresh),
  };
}

// ---------- Notificações no celular (Web Push) ----------

const toBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

/** Este aparelho já está recebendo notificações? */
export async function pushActive() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return Boolean(await reg?.pushManager.getSubscription());
}

/** Liga as notificações neste aparelho (pede permissão ao navegador). */
export async function enablePush() {
  const { key } = await api<{ key: string | null }>('/push/public-key');
  if (!key) throw new Error('As notificações no celular ainda não estão configuradas neste ambiente.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Você não permitiu notificações. Dá para mudar isso nas configurações do navegador.');
  const reg = await registration();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
  const json = sub.toJSON();
  await api('/push/subscriptions', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/push/subscriptions/remove', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => undefined);
  await sub.unsubscribe();
}
