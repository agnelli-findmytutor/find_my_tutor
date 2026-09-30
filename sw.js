// FindMyTutor - Service Worker
const CACHE_NAME = 'fmt-cache-v2.0';
const STATIC_ASSETS = [
    './',
    './index.html',
    './login.html',
    './prenota.html',
    './dashboard.html',
    './appuntamenti.html',
    './diventa_tutor.html',
    './progetto.html',
    './style.css',
    './css/login.css',
    './css/prenota.css',
    './css/dashboard.css',
    './css/mobile-app.css',
    './css/responsive.css',
    './js/api_config.js',
    './js/gestione_utente.js',
    './js/mobile-nav.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('SW: Precache parziale:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((k) => {
                    if (k !== CACHE_NAME) {
                        return caches.delete(k);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Non intercettare le chiamate API backend (/api/*)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Per risorse statiche: Network First con Cache Fallback
    e.respondWith(
        fetch(e.request)
            .then((networkRes) => {
                if (networkRes && networkRes.status === 200 && e.request.method === 'GET') {
                    const resClone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, resClone);
                    });
                }
                return networkRes;
            })
            .catch(() => {
                return caches.match(e.request);
            })
    );
});
