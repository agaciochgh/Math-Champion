// Offline support: fetch fresh files when online, fall back to the cached copy when offline.
const CACHE = 'math-champion-v2';
const SHELL = [
  './', 'index.html', 'styles.css', 'sync-config.js', 'icon.svg', 'manifest.webmanifest',
  'src/app.js', 'src/util.js', 'src/progress.js', 'src/store.js', 'src/sync.js', 'src/sound.js',
  'src/views/common.js', 'src/views/parent.js',
  'src/skills/index.js', 'src/skills/common.js', 'src/skills/multiplication.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('math-champion-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
