/* Dreamie Store Service Worker — Web Push Notifications */

// Keep service worker alive
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Heartbeat to keep service worker alive
setInterval(() => {
  // Do nothing, just keep the worker alive
}, 20000); // 20 seconds

self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Dreamie Store', body: event.data.text() }; }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if any client is focused
      const isFocused = clientList.some(client => client.focused);
      
      // If site is open and focused, send message to client
      // The in-app notification will handle it
      if (isFocused) {
        console.log('Site is focused, sending in-app notification');
        clientList.forEach(client => {
          if (client.focused) {
            client.postMessage({
              type: 'PUSH_NOTIFICATION',
              payload: data
            });
          }
        });
        return;
      }
      
      // Show push notification only when site is closed or not focused
      return self.registration.showNotification(data.title || 'Dreamie Store', {
        body: data.body || '',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: data.tag || 'dreamie-store',
        data: { url: data.url || '/' },
        requireInteraction: false,
        silent: false,
        renotify: true,
        actions: [
          {
            action: 'open',
            title: 'Open'
          }
        ]
      });
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
