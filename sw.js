/* Aura — offline shell.
   Round 2's premise is that the internet is gone. So the deployed app
   caches itself on first visit and then serves entirely from cache:
   turn the wi-fi off, reload, and the journey still works. */

const CACHE = 'aura-v1';
const SHELL = [
  './', 'index.html', 'styles.css', 'data.js', 'engine.js', 'app.js',
  'manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache first. There is nothing here that needs to be fresher than the
   street lamps it describes. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('index.html'))
    )
  );
});
