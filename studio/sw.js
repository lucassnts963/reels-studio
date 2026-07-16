// studio/sw.js — service worker do Studio unificado (desktop + celular).
// Estratégia NETWORK-FIRST para o app-shell: conectado, sempre pega o arquivo
// fresco (ferramenta de dev que muda toda hora — mudanças refletem no próximo
// carregamento, sem fechar tudo); offline, cai no cache (o app abre em qualquer
// lugar). API, player, content e assets NUNCA passam pelo cache — sempre rede
// (o offline deles é tratado pelo IndexedDB do app).

const CACHE = 'reels-studio-studio-v20';
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
  // network-first: rede na frente (sempre fresco quando online), cache no fallback.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const clone = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, clone)); }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
