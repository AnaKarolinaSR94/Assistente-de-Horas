/* Service worker: guarda os arquivos do app no aparelho para funcionar sem internet.
   Dica: ao publicar uma atualização, troque o número da VERSION para o aparelho baixar tudo de novo. */
var VERSION = 'banco-de-horas-1.1.0';
var ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'logic.js', 'report.js',
  'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION)
      .then(function (cache) {
        return cache.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Responde na hora com o que está guardado e atualiza o guardado em segundo plano.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined);
      });
      event.waitUntil(network.catch(function () {}));
      return cached || network;
    })
  );
});
