/**
 * ============================================================
 * Fikr Timer · Advanced Service Worker
 * Offline caching, background sync, push notifications,
 * and performance optimization for the PWA.
 * ============================================================
 *
 * Features:
 *  - Cache‑first strategy for static assets
 *  - Network‑first strategy for API calls (future)
 *  - Stale‑while‑revalidate for analytics data
 *  - Precaching during install
 *  - Runtime caching for dynamic content
 *  - Cache versioning and cleanup
 *  - Background sync for offline mutations
 *  - Push notification handling
 *  - Periodic background sync
 *  - Offline fallback page
 *  - Bypass cache for development
 *  - Automatic cache purging on new version
 *
 * Cache Strategies:
 *   Cache First    — Static assets (CSS, JS, icons)
 *   Network First  — API requests (future)
 *   Stale While Revalidate — JSON data, analytics
 */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    // Cache names (versioned for easy cleanup)
    CACHE_STATIC: 'fikr-static-v3',
    CACHE_DYNAMIC: 'fikr-dynamic-v3',
    CACHE_ANALYTICS: 'fikr-analytics-v3',
    CACHE_IMAGES: 'fikr-images-v3',
    CACHE_FONTS: 'fikr-fonts-v3',

    // Maximum items/age in caches
    MAX_DYNAMIC_ITEMS: 50,
    MAX_ANALYTICS_ITEMS: 100,
    MAX_IMAGE_ITEMS: 30,
    MAX_CACHE_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days

    // Development mode (bypass caching)
    DEBUG: false,

    // Offline page
    OFFLINE_PAGE: '/offline.html',
};

// ============================================================
// STATIC ASSETS TO PRECACHE
// ============================================================
const PRECACHE_ASSETS = [
    // Root
    '/',
    '/index.html',

    // CSS
    '/css/main.css',
    '/css/themes.css',
    '/css/animations.css',
    '/css/components.css',
    '/css/clock.css',

    // JavaScript
    '/js/config.js',
    '/js/storage.js',
    '/js/app.js',
    '/js/timer-engine.js',
    '/js/clock.js',
    '/js/sound-system.js',
    '/js/particles.js',
    '/js/profile.js',
    '/js/analytics.js',
    '/js/notifications.js',

    // Mode modules
    '/js/modes/pomodoro.js',
    '/js/modes/breathing.js',
    '/js/modes/workout.js',
    '/js/modes/exam.js',
    '/js/modes/deepwork.js',
    '/js/modes/custom.js',

    // Manifest
    '/manifest.json',

    // Icons (minimum required)
    '/assets/icons/icon-72.png',
    '/assets/icons/icon-96.png',
    '/assets/icons/icon-128.png',
    '/assets/icons/icon-144.png',
    '/assets/icons/icon-152.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-256.png',
    '/assets/icons/icon-384.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/icon-192-maskable.png',
    '/assets/icons/icon-512-maskable.png',

    // Offline fallback
    '/offline.html',
];

// ============================================================
// INSTALL EVENT — Precache critical assets
// ============================================================
self.addEventListener('install', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Installing...');

    event.waitUntil(
        caches.open(CONFIG.CACHE_STATIC)
            .then((cache) => {
                if (CONFIG.DEBUG) console.log('[SW] Precaching assets...');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                if (CONFIG.DEBUG) console.log('[SW] Precaching complete');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Precaching failed:', err);
            })
    );
});

// ============================================================
// ACTIVATE EVENT — Clean old caches & claim clients
// ============================================================
self.addEventListener('activate', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Activating...');

    const validCaches = [
        CONFIG.CACHE_STATIC,
        CONFIG.CACHE_DYNAMIC,
        CONFIG.CACHE_ANALYTICS,
        CONFIG.CACHE_IMAGES,
        CONFIG.CACHE_FONTS,
    ];

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Remove old versioned caches
                            return name.startsWith('fikr-') && !validCaches.includes(name);
                        })
                        .map((name) => {
                            if (CONFIG.DEBUG) console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                if (CONFIG.DEBUG) console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// ============================================================
// FETCH EVENT — Serve from cache with strategy per request
// ============================================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non‑GET requests
    if (request.method !== 'GET') return;

    // Skip chrome‑extension and other non‑http(s) requests
    if (!url.protocol.startsWith('http')) return;

    // Skip development/livereload requests
    if (url.hostname === 'localhost' && url.port !== '') {
        return; // Let development server handle it
    }

    // Determine cache strategy based on request type
    const strategy = getStrategy(url, request);

    switch (strategy) {
        case 'cache-first':
            event.respondWith(cacheFirst(request));
            break;

        case 'network-first':
            event.respondWith(networkFirst(request));
            break;

        case 'stale-while-revalidate':
            event.respondWith(staleWhileRevalidate(request));
            break;

        case 'cache-only':
            event.respondWith(cacheOnly(request));
            break;

        case 'network-only':
            // Let browser handle normally
            break;

        default:
            // Default: cache-first for same‑origin, network‑first for cross‑origin
            if (url.origin === self.location.origin) {
                event.respondWith(cacheFirst(request));
            }
            break;
    }
});

// ============================================================
// CACHE STRATEGIES
// ============================================================

/**
 * Cache First — Return from cache, fallback to network.
 * Best for: static assets that rarely change.
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);

    if (cached) {
        if (CONFIG.DEBUG) console.log('[SW] Cache hit:', request.url);
        return cached;
    }

    try {
        const response = await fetch(request);
        if (isValidResponse(response)) {
            await putInCache(CONFIG.CACHE_STATIC, request, response.clone());
        }
        return response;
    } catch (err) {
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
            return caches.match(CONFIG.OFFLINE_PAGE);
        }
        throw err;
    }
}

/**
 * Network First — Try network, fallback to cache.
 * Best for: API requests that need fresh data.
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (isValidResponse(response)) {
            await putInCache(CONFIG.CACHE_DYNAMIC, request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) {
            if (CONFIG.DEBUG) console.log('[SW] Network unavailable, serving cache:', request.url);
            return cached;
        }

        // Fallback for navigation
        if (request.mode === 'navigate') {
            return caches.match(CONFIG.OFFLINE_PAGE);
        }

        throw err;
    }
}

/**
 * Stale While Revalidate — Return cache, update from network in background.
 * Best for: data that can be slightly stale (analytics, preferences).
 */
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const fetchPromise = fetch(request)
        .then((response) => {
            if (isValidResponse(response)) {
                putInCache(CONFIG.CACHE_ANALYTICS, request, response.clone());
            }
            return response;
        })
        .catch((err) => {
            console.warn('[SW] Background fetch failed:', err);
        });

    return cached || fetchPromise;
}

/**
 * Cache Only — Return from cache or fail.
 * Best for: precached assets that must be available offline.
 */
async function cacheOnly(request) {
    const cached = await caches.match(request);
    if (!cached) throw new Error('Not in cache');
    return cached;
}

// ============================================================
// HELPER: Determine strategy based on request
// ============================================================
function getStrategy(url, request) {
    // Navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        return 'network-first';
    }

    // Static assets
    if (
        url.pathname.match(/\.(css|js|json|xml|txt)$/) ||
        url.pathname.includes('/manifest.json')
    ) {
        return 'cache-first';
    }

    // Images and icons
    if (
        url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/) ||
        url.pathname.includes('/assets/icons/')
    ) {
        return 'cache-first';
    }

    // Fonts
    if (url.pathname.match(/\.(woff|woff2|ttf|eot|otf)$/)) {
        return 'cache-first';
    }

    // API calls (future)
    if (url.pathname.includes('/api/')) {
        return 'network-first';
    }

    // Analytics data (JSON files)
    if (url.pathname.includes('/data/')) {
        return 'stale-while-revalidate';
    }

    // Default
    return 'cache-first';
}

// ============================================================
// HELPER: Validate response
// ============================================================
function isValidResponse(response) {
    return (
        response &&
        response.status === 200 &&
        response.type === 'basic' || response.type === 'cors'
    );
}

// ============================================================
// HELPER: Put in cache with size management
// ============================================================
async function putInCache(cacheName, request, response) {
    try {
        const cache = await caches.open(cacheName);
        await cache.put(request, response);

        // Trim cache if needed
        trimCache(cacheName);
    } catch (err) {
        console.warn('[SW] Failed to cache:', request.url, err);
    }
}

/**
 * Trim cache to prevent exceeding storage limits.
 */
async function trimCache(cacheName) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const maxItems = getMaxItems(cacheName);

    if (keys.length > maxItems) {
        const deleteCount = keys.length - maxItems;
        for (let i = 0; i < deleteCount; i++) {
            await cache.delete(keys[i]);
        }
        if (CONFIG.DEBUG) console.log(`[SW] Trimmed ${deleteCount} items from ${cacheName}`);
    }
}

function getMaxItems(cacheName) {
    switch (cacheName) {
        case CONFIG.CACHE_DYNAMIC: return CONFIG.MAX_DYNAMIC_ITEMS;
        case CONFIG.CACHE_ANALYTICS: return CONFIG.MAX_ANALYTICS_ITEMS;
        case CONFIG.CACHE_IMAGES: return CONFIG.MAX_IMAGE_ITEMS;
        default: return 100;
    }
}

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Background sync:', event.tag);

    switch (event.tag) {
        case 'sync-analytics':
            event.waitUntil(syncAnalytics());
            break;

        case 'sync-settings':
            event.waitUntil(syncSettings());
            break;

        case 'sync-sessions':
            event.waitUntil(syncSessions());
            break;

        default:
            if (CONFIG.DEBUG) console.log('[SW] Unknown sync tag:', event.tag);
    }
});

async function syncAnalytics() {
    // Placeholder for future cloud sync
    if (CONFIG.DEBUG) console.log('[SW] Syncing analytics...');
    return Promise.resolve();
}

async function syncSettings() {
    if (CONFIG.DEBUG) console.log('[SW] Syncing settings...');
    return Promise.resolve();
}

async function syncSessions() {
    if (CONFIG.DEBUG) console.log('[SW] Syncing sessions...');
    return Promise.resolve();
}

// ============================================================
// PERIODIC BACKGROUND SYNC
// ============================================================
self.addEventListener('periodicsync', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Periodic sync:', event.tag);

    switch (event.tag) {
        case 'update-content':
            event.waitUntil(updateCachedContent());
            break;

        case 'clean-caches':
            event.waitUntil(cleanOldCaches());
            break;

        default:
            break;
    }
});

async function updateCachedContent() {
    // Re‑fetch and update precached assets
    if (CONFIG.DEBUG) console.log('[SW] Updating cached content...');

    const cache = await caches.open(CONFIG.CACHE_STATIC);
    for (const asset of PRECACHE_ASSETS) {
        try {
            const response = await fetch(asset, { cache: 'no-cache' });
            if (isValidResponse(response)) {
                await cache.put(asset, response);
            }
        } catch (err) {
            console.warn('[SW] Failed to update:', asset);
        }
    }
}

async function cleanOldCaches() {
    const cacheNames = await caches.keys();
    const validCaches = [
        CONFIG.CACHE_STATIC,
        CONFIG.CACHE_DYNAMIC,
        CONFIG.CACHE_ANALYTICS,
        CONFIG.CACHE_IMAGES,
        CONFIG.CACHE_FONTS,
    ];

    for (const name of cacheNames) {
        if (name.startsWith('fikr-') && !validCaches.includes(name)) {
            await caches.delete(name);
        }
    }
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Push received:', event);

    let data = {
        title: 'Fikr Timer',
        body: 'Time to focus! 🎯',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-96.png',
        tag: 'fikr-reminder',
        data: {
            url: '/',
        },
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'start',
                title: 'Start Focus',
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
            },
        ],
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    if (event.action === 'start') {
        // Start focus session
        event.waitUntil(
            clients.openWindow(`${urlToOpen}?mode=pomodoro&quick=true`)
        );
    } else if (event.action === 'dismiss') {
        // Just close
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window' })
                .then((clientList) => {
                    // Focus existing window if available
                    for (const client of clientList) {
                        if (client.url.includes(urlToOpen) && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Open new window
                    return clients.openWindow(urlToOpen);
                })
        );
    }
});

// ============================================================
// MESSAGE EVENTS (from main thread)
// ============================================================
self.addEventListener('message', (event) => {
    if (CONFIG.DEBUG) console.log('[SW] Message received:', event.data);

    switch (event.data?.action) {
        case 'skipWaiting':
            self.skipWaiting();
            break;

        case 'clearCaches':
            event.waitUntil(clearAllCaches());
            break;

        case 'updateCache':
            event.waitUntil(
                updateCachedContent().then(() => {
                    // Notify client
                    event.ports?.[0]?.postMessage({ success: true });
                })
            );
            break;

        case 'getCacheStats':
            event.waitUntil(
                getCacheStats().then((stats) => {
                    event.ports?.[0]?.postMessage(stats);
                })
            );
            break;

        default:
            break;
    }
});

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
}

async function getCacheStats() {
    const cacheNames = await caches.keys();
    const stats = {};

    for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        stats[name] = keys.length;
    }

    return stats;
}

// ============================================================
// SERVICE WORKER LIFECYCLE LOGGING
// ============================================================
if (CONFIG.DEBUG) {
    console.log('[SW] Service Worker loaded');
    console.log('[SW] Scope:', self.registration.scope);
}