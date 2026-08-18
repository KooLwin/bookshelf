// sw.js - Updated for Kreative Bookshelf
const CACHE_NAME = 'kreative-bookshelf-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/free.html',
    '/premium.html',
    '/manifest.json',
    '/course_files.js',
    '/course_files.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// ============================================================
// 1. INSTALL & ACTIVATE
// ============================================================
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ============================================================
// 2. FETCH (Offline support with course files)
// ============================================================
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request)
            .then(cached => {
                if (cached) return cached;
                
                // Try network
                return fetch(e.request)
                    .then(response => {
                        // Cache course files dynamically
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(e.request, clone);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return offline page for HTML requests
                        if (e.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// ============================================================
// 3. FIREBASE CLOUD MESSAGING
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyBl6MK40r4rrVQ3w3RTzEgioxYoOJIb4RA",
    authDomain: "k-reader-cde45.firebaseapp.com",
    projectId: "k-reader-cde45",
    storageBucket: "k-reader-cde45.firebasestorage.app",
    messagingSenderId: "732905849808",
    appId: "1:732905849808:web:edf0f30a07b2c57ea1afd5",
    measurementId: "G-JC8RSEZ5L3"
};

const VAPID_KEY = 'YBASjJdEoZ9nrhkMvAcYM8NtN_Qrj5jlHMacm-pkj7BzcofRnY01jqTdXAeggVKSfj89QP3NpdozLQTQpbjoxcCw';

// Push Notification
self.addEventListener('push', function(event) {
    let notificationData = {
        title: '📚 Kreative Bookshelf',
        body: 'New book available!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: '/' }
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData.title = data.title || notificationData.title;
            notificationData.body = data.body || notificationData.body;
            notificationData.data.url = data.click_action || notificationData.data.url;
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            data: notificationData.data,
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: '📖 Open App' },
                { action: 'dismiss', title: '❌ Dismiss' }
            ]
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'dismiss') return;
    
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// ============================================================
// 4. SUBSCRIBE TO PUSH
// ============================================================
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
        event.waitUntil(subscribeToPush());
    }
});

async function subscribeToPush() {
    try {
        const existingSubscription = await self.registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('✅ Already subscribed to push');
            return existingSubscription;
        }
        
        const subscription = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_KEY
        });
        
        console.log('✅ Subscribed to push');
        return subscription;
    } catch (error) {
        console.error('❌ Push subscription failed:', error);
        return null;
    }
}

// ============================================================
// 5. BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    try {
        // Your sync logic here
        console.log('✅ Background sync completed');
    } catch (error) {
        console.error('❌ Background sync failed:', error);
    }
}