const CACHE_NAME = 'sales-mgmt-v2';
const STATIC_ASSETS = [
    'app_fixed.html',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'icon-192.svg',
    'icon-512.svg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Network First للأصول الخارجية والمكتبات
    if (url.hostname !== location.hostname && url.hostname !== 'localhost') {
        e.respondWith(
            fetch(e.request).catch(() => new Response('', { status: 408 }))
        );
        return;
    }

    // Network First للملف الرئيسي
    if (url.pathname.includes('app_fixed.html')) {
        e.respondWith(
            fetch(e.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return response;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Cache First للملفات الثابتة
    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return response;
            });
        })
    );
});

self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (e.data === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage('CACHE_CLEARED'));
            });
        });
    }
});
