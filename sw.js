/* Service Worker — Баргут Эмчи */
const CACHE = 'bargut-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

/* Push-уведомление */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || 'Баргут Эмчи';
  const body  = data.body  || 'Новое сообщение';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/bargut-tasks/icon-192.png',
      badge:   '/bargut-tasks/icon-192.png',
      vibrate: [200, 100, 200],
      data:    { url: '/bargut-tasks/portal.html' },
      tag:     'bargut-msg',
      renotify: true,
    })
  );
});

/* Клик по уведомлению */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/bargut-tasks/portal.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('portal.html') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});
