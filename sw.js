const CACHE_NAME = 'kreative-bookshelf-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/covers/book1.png',
  '/covers/book2.png',
  '/covers/book3.png',
  '/covers/book4.png',
  '/covers/book5.png',
  '/covers/book6.png',
  '/covers/book7.png',
  '/covers/book8.png',
  '/covers/book9.png',
  '/covers/book10.png',
  '/covers/book11.png',
  '/covers/book12.png',
  '/covers/book13.png',
  '/covers/book14.png'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching core assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handle all requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // For book HTML files and sub-resources
  if (url.pathname.startsWith('/books/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            console.log('Serving from cache:', url.pathname);
            return cached;
          }
          
          // If not in cache, fetch from network and cache
          return fetch(event.request)
            .then(response => {
              // Only cache successful responses
              if (response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, clone);
                  console.log('Cached:', url.pathname);
                });
              }
              return response;
            })
            .catch(() => {
              // If offline and not cached, return a fallback
              return new Response('စာအုပ်မတွေ့ပါ - အင်တာနက်မရှိပါ', { 
                status: 503,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            });
        })
    );
    return;
  }
  
  // For covers and other assets
  if (url.pathname.startsWith('/covers/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clone);
              });
              return response;
            });
        })
    );
    return;
  }
  
  // For everything else: cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // If offline and not cached
            if (event.request.mode === 'navigate') {
              // For HTML navigation, return offline page
              return caches.match('/index.html');
            }
            return new Response('အော့ဖ်လိုင်းဖြစ်နေပါသည်', { 
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          });
      })
  );
});