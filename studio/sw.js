// studio/sw.js — service worker do Studio unificado (desktop + celular).
// Estratégia stale-while-revalidate para o app-shell: responde do cache na
// hora (o app abre offline no celular, em qualquer lugar) e atualiza o cache
// em background quando há rede. API, player, content e assets NUNCA passam
// pelo cache — sempre rede (o offline deles é tratado pelo IndexedDB do app).

const CACHE = 'reels-studio-studio-v8';
const SHELL = [
  '/studio/',
  '/studio/index.html',
  '/studio/lib.jsx',
  '/studio/store.jsx',
  '/studio/components.jsx',
  '/studio/app.jsx',
  '/studio/db.js',
  '/studio/sync.js',
  '/studio/zip.js',
  '/studio/manifest.json',
  '/studio/icon.svg',
  '/engine/vendor/react.js',
  '/engine/vendor/react-dom.js',
  '/engine/vendor/babel.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !SHELL.includes(url.pathname)) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetching = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
