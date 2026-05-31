const CACHE = 'bargut-v3';
const SHELL = [
  '/bargut-tasks/',
  '/bargut-tasks/manifest.json',
  '/bargut-tasks/icon-192.png',
  '/bargut-tasks/icon-512.png',
  '/bargut-tasks/js/vendor/vue.global.prod.js',
  '/bargut-tasks/js/vendor/vue-router.global.prod.js',
  '/bargut-tasks/js/vendor/supabase.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GitHub API и Supabase — только сеть, без кеша
  if (url.hostname === 'api.github.com' || url.hostname.includes('supabase')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('/bargut-tasks/');
        }
      });
    })
  );
});
