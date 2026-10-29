/* Service Worker: macht die App offline nutzbar.
 * Bei jeder Änderung an Dateien oder Daten VERSION erhöhen, damit Geräte das Update erhalten. */
const VERSION = 'bauchgefuehl-v1.3.6';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/data-core.js',
  'js/ingredients.js',
  'js/config.js',
  'js/sync.js',
  'js/app.js',
  'datenschutz.html',
  'data/01-gemuese-kraeuter.js',
  'data/02-obst.js',
  'data/03-getreide-brot.js',
  'data/04-milch.js',
  'data/05-fleisch-vegi-nuesse.js',
  'data/06-snacks-suesses.js',
  'data/07-saucen-getraenke.js',
  'data/08-fertig-schweiz.js',
  'data/09-deutschland-oesterreich.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Cache zuerst (schnell & offline), Netzwerk als Fallback
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('index.html') : undefined));
    })
  );
});
