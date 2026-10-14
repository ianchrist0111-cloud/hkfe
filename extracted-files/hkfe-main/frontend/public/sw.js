/* ============================================================
   HKFES Professional PWA Service Worker
   Offline Cache • Web Push Engine • App Badging • Deep Linking
   ============================================================ */

const CACHE_NAME = 'hkfes-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline',
];

// ── 1. Installation: Precache core shell ──────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset fetch skipped in dev:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── 2. Activation: Clean up stale caches ──────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ── 3. Fetch: Dynamic routing & offline fallback ───────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Exclude non-GET, API calls, WebSockets, and external analytics
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.protocol.startsWith('ws') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Static Assets (Cache-First)
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation Requests: Network-First with Offline Page Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/offline').then((offlineRes) => {
          return offlineRes || caches.match('/index.html') || caches.match('/');
        });
      })
    );
    return;
  }

  // Default Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ── 4. Web Push: Financial Alert & Action Handlers ─────────
self.addEventListener('push', (event) => {
  let payload = {
    title: 'HKFES Notification',
    body: 'New financial activity detected.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'hkfes-notification',
    url: '/dashboard',
    vibrate: [150, 50, 150, 50, 200],
    actions: [],
    unreadCount: 1,
    requireInteraction: false,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch (err) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  // Configure action buttons if not already provided
  const actions = payload.actions && payload.actions.length > 0 ? payload.actions : [
    { action: 'open', title: 'View Details' },
    { action: 'dismiss', title: 'Dismiss' },
  ];

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag,
    data: {
      url: payload.url || '/dashboard',
      timestamp: Date.now(),
    },
    vibrate: payload.vibrate || [200, 100, 200],
    actions,
    requireInteraction: payload.requireInteraction || false,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, notificationOptions),
      // Synchronize App Badge if supported (iOS 16.4+ standalone & Android)
      'setAppBadge' in navigator && payload.unreadCount != null
        ? navigator.setAppBadge(payload.unreadCount)
        : Promise.resolve(),
    ])
  );
});

// ── 5. Notification Click: Client Focus & Deep Linking ─────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If an HKFES tab is already open, focus and navigate it
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // If no window is currently open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ── 6. Message Listener: App Badges & Sync ─────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SET_BADGE') {
    const count = event.data.count || 0;
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }

  if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
