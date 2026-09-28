// Service worker per Magazzino: permette all'app di avviarsi anche senza connessione.
// I dati veri (prodotti, vendite...) li gestisce Firestore con la sua cache offline integrata.
const CACHE = 'magazzino-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch((err) => console.warn('Precache non riuscito:', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFirebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  // Le chiamate a Firestore (googleapis.com) NON vanno toccate: le gestisce l'SDK da solo.
  if (!sameOrigin && !isFirebaseSdk) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
