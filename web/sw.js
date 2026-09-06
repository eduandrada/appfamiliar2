// ==============================================================================
// FAMILIA ANDRADA - SERVICE WORKER PARA NOTIFICACIONES EN SEGUNDO PLANO
// ==============================================================================

const CACHE_NAME = 'familia-andrada-v2026';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando Service Worker de Familia Andrada...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Service Worker activado.');
  event.waitUntil(self.clients.claim());
});

// Escuchar mensajes desde la aplicación web para disparar notificaciones locales
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SHOW_NOTIFICATION') {
    const title = data.title || '🚨 Familia Andrada - Alerta de Seguridad';
    const options = {
      body: data.body || 'Alerta de emergencia en el círculo familiar.',
      icon: '/img/icon-192.png',
      badge: '/img/icon-192.png',
      vibrate: [500, 200, 500, 200, 500],
      tag: 'family-safety-alert',
      renotify: true,
      data: {
        url: data.url || '/'
      },
      actions: [
        { action: 'open_app', title: 'Ver Ubicación' },
        { action: 'ack', title: 'Estoy en camino' }
      ]
    };

    self.registration.showNotification(title, options);
  }
});

// Manejo de clicks en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
