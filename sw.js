/* Masar RTC v100 service worker — app shell + privacy-safe offline behavior. */
const VERSION = 'rtc-v100.0.0';
const APP_SHELL = [
  './', './index.html', './verify.html', './privacy.html', './terms.html', './404.html', './manifest.json',
  './css/app.css?v=100.0.0',
  './app.js?v=100.0.0',
  './js/config.js?v=100.0.0', './js/supabaseClient.js?v=100.0.0',
  './js/native.js?v=100.0.0', './js/motion.js?v=100.0.0',
  './js/security.js?v=100.0.0', './js/i18n.js?v=100.0.0',
  './js/content.js?v=100.0.0', './js/ui.js?v=100.0.0',
  './js/api.js?v=100.0.0', './js/pwa.js?v=100.0.0', './js/ambient.js?v=100.0.0',
  './js/verify.js?v=100.0.0', './assets/static/legal.css?v=100.0.0',
  './assets/vendor/supabase.js?v=100.0.0',
  './assets/vendor/secure-storage.min.js?v=100.0.0',
  './assets/vendor/barcode-scanner.min.js?v=100.0.0',
  './assets/vendor/qrcode.min.js?v=100.0.0',
  './assets/vendor/jspdf.umd.min.js?v=100.0.0',
  './assets/vendor/fonts/fonts.css?v=100.0.0',
  './assets/vendor/fonts/files/ibm-plex-sans-arabic-arabic-300-normal.woff2',
  './assets/vendor/fonts/files/ibm-plex-sans-arabic-arabic-400-normal.woff2',
  './assets/vendor/fonts/files/ibm-plex-sans-arabic-arabic-500-normal.woff2',
  './assets/vendor/fonts/files/ibm-plex-sans-arabic-arabic-600-normal.woff2',
  './assets/vendor/fonts/files/ibm-plex-sans-arabic-arabic-700-normal.woff2',
  './assets/vendor/fonts/files/inter-latin-600-normal.woff2',
  './assets/vendor/fonts/files/inter-latin-800-normal.woff2',
  './assets/vendor/phosphor/regular/style.css?v=100.0.0',
  './assets/vendor/phosphor/regular/Phosphor.woff2',
  './assets/vendor/phosphor/bold/Phosphor-Bold.woff2',
  './assets/vendor/phosphor/fill/Phosphor-Fill.woff2',
  './assets/vendor/phosphor/duotone/Phosphor-Duotone.woff2',
  './assets/vendor/phosphor/bold/style.css?v=100.0.0',
  './assets/vendor/phosphor/fill/style.css?v=100.0.0',
  './assets/vendor/phosphor/duotone/style.css?v=100.0.0',
  './assets/illustrations/learning-community.webp',
  './rtc_app_logo.png', './icon-192.png', './icon-512.png',
  './icon-maskable-192.png', './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function navigationResponse(request) {
  return fetch(request).then((response) => response.ok ? response : Promise.reject(new Error('navigation failed')))
    .catch(async () => {
      const exact = await caches.match(request, { ignoreSearch: true });
      return exact || caches.match('./index.html', { ignoreSearch: true });
    });
}

function staticResponse(request) {
  return caches.match(request, { ignoreSearch: true }).then((cached) => {
    const update = fetch(request).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => cached);
    return cached || update;
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;
  /* Auth/API data is never written to Cache Storage. Supabase remains network-only. */
  if (url.hostname.endsWith('.supabase.co') || url.hostname === 'accounts.google.com') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(navigationResponse(event.request));
    return;
  }
  if (url.origin === self.location.origin) event.respondWith(staticResponse(event.request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'مسار RTC', body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'مسار RTC', {
    body: data.body || '', icon: './icon-192.png', badge: './icon-192.png',
    dir: 'rtl', lang: 'ar', tag: data.tag || 'rtc-notification',
    renotify: Boolean(data.renotify), data: data.data || {}
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const screen = event.notification.data && event.notification.data.screen;
  const target = './' + (screen ? '?screen=' + encodeURIComponent(screen) : '');
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) {
        client.postMessage({ type: 'OPEN_SCREEN', screen });
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
