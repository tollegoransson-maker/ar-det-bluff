// Service worker for "Är det bluff?". deploy-build.cjs fills in the version and writes it as sw.js.
// It keeps a copy of the page so that it opens without a connection. Only this site's own files pass through it,
// so it never sees what anyone pastes; the counter and the screenshot reader go straight to the network.
var VERSION = '7cd631fd';
var CACHE = 'bluff-' + VERSION;
var CORE = ['./', 'app.js?v=f365f5dd', 'fonts/atkinson-hyperlegible-next-latin.woff2', 'fonts/atkinson-hyperlegible-next-italic-latin.woff2',
  'fonts/newsreader-latin.woff2', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', function (e) {
  // no-cache: every file is checked with the server, so the saved copies are the ones just published.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE.map(function (u) { return new Request(u, { cache: 'no-cache' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  // Older versions are removed, so the page and its app.js always come from the same build.
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('bluff-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' && /\/(?:index\.html)?$/.test(url.pathname)) {
    // The page itself: network first, so a new version shows as soon as the network answers.
    // The saved copy is used offline, or when the network has not answered in four seconds.
    e.respondWith(new Promise(function (resolve) {
      var settled = false;
      function cached() { return caches.open(CACHE).then(function (c) { return c.match('./'); }); }
      function finish(res) { if (!settled && res) { settled = true; resolve(res); } }
      var timer = setTimeout(function () { cached().then(finish); }, 4000);
      fetch(req).then(function (res) { clearTimeout(timer); finish(res); }, function () {
        clearTimeout(timer);
        cached().then(function (res) { finish(res || Response.error()); });
      });
    }));
    return;
  }
  // Everything else on the site: the saved copy if there is one, otherwise the network.
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (hit) { return hit || fetch(req); });
  }));
});
