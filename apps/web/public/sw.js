/*
 * Service worker do Circle of Life: um pequeno programa que o navegador
 * mantém rodando em segundo plano para receber notificações no celular
 * (Web Push), mesmo com o app fechado.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = { title: 'Circle of Life', body: '', link: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      lang: 'pt-BR',
      // Foto do "Lembra disso?" (o Android mostra; o iPhone ignora).
      ...(data.image ? { image: data.image } : {}),
      ...(data.tag ? { tag: data.tag } : {}),
      data: { link: data.link },
    }),
  );
});

// Tocar na notificação abre o app na tela certa (ou foca uma janela já aberta).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
