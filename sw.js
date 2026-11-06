const CACHE = 'ru-zh-cards-v1.4.1';
const ASSETS = [
  './', './index.html', './book.html', './unit.html', './plan.html', './sources.html', './texts.html',
  './styles.css', './unit.css', './plan.css', './sources.css', './texts.css', './changelog.css',
  './sidebar.css', './global-search.css', './version-update.css',
  './app.js', './sidebar.js', './unit.js', './plan.js', './sources.js', './texts.js', './global-search.js', './version-update.js',
  './pwa.js', './manifest.webmanifest', './favicon.svg', './favicon.ico',
  './icons/icon-192.png', './icons/icon-512.png',
  './data/versions.js', './data/deck.js', './data/lesson1.js', './data/lesson2.js', './data/lesson3.js', './data/lesson5.js',
  './data/decks-source.js', './data/sources.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(function (response) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      return response;
    }).catch(function () { return caches.match(event.request).then(function (hit) { return hit || caches.match('./index.html'); }); }));
    return;
  }
  if (/\.pdf$/i.test(url.pathname)) {
    event.respondWith(caches.match(event.request).then(function (hit) {
      if (hit) return hit;
      return fetch(event.request).then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      });
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then(function (hit) {
    if (hit) return hit;
    return fetch(event.request).then(function (response) {
      if (response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    });
  }));
});
