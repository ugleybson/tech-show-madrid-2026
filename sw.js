/* Service worker – guarda a app para funcionar sem rede no recinto (IFEMA) */
const CACHE = 'tsm2026-v6';
const FICHEIROS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data/programa.js',
  './data/expositores.js',
  './manifest.webmanifest',
  './icon.svg',
  // Credenciais (bilhetes de entrada) disponíveis sem rede
  './AcreditacionMTS26_MADRID_X12706597_Pedro+Duarte+Oliveira+Monteiro.pdf',
  './AcreditacionMTS26_MADRID_J13849432_F%C3%A1bio+Miguel+Mendes+Ferreira.pdf',
  './AcreditacionMTS26_MADRID_P13827748_Gleibson+Silva.pdf',
  './AcreditacionMTS26_MADRID_L13788720_Marco+Nunes.pdf',
  './AcreditacionMTS26_MADRID_A14052857_Celestino+Oliveira.pdf',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHEIROS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (para receber actualizações); sem rede, usa a cópia guardada
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // no-cache: confirma sempre com o servidor (evita servir uma versão antiga da cache HTTP)
    fetch(e.request, new URL(e.request.url).origin === location.origin ? { cache: 'no-cache' } : {})
      .then(r => {
        if (r.ok && new URL(e.request.url).origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
