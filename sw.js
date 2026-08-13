const VERSION = 'rtc-v10.0.0';
const PRECACHE = [
  './',
  './index.html',
  './verify.html',
  './privacy.html',
  './terms.html',
  './manifest.json',
  './app.js?v=10.0.0',
  './js/config.js?v=10.0.0',
  './js/supabaseClient.js?v=10.0.0',
  './js/native.js?v=10.0.0',
  './js/motion.js?v=10.0.0',
  './js/security.js?v=10.0.0',
  './js/i18n.js?v=10.0.0',
  './js/ui.js?v=10.0.0',
  './js/api.js?v=10.0.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.ok && url.origin === location.origin) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
    }))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'مسار RTC', body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'مسار RTC', {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    dir: 'rtl',
    data: data.data || {}
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
