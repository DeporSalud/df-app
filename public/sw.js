// ============================================================================
// DANCE FACTORY • PWA SERVICE WORKER (v3)
// ============================================================================

const CACHE_NAME = 'df-pwa-v3';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Purge all legacy caches immediately
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. DO NOT intercept non-GET requests
  if (event.request.method !== 'GET') return;

  // 2. DO NOT intercept Next.js static assets, stylesheets, scripts or images
  // Let the browser fetch them directly to prevent broken CSS/JS on mobile
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // Pass through to native browser network
  }

  // 3. For page navigation, use Network-First with safe fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
