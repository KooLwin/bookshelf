// sw.js - Firebase Cloud Messaging Support
const CACHE_NAME = 'kreative-bookshelf-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
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
// 2. FETCH (Offline support)
// ============================================================
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request)
            .then(c => c || fetch(e.request))
            .catch(() => new Response('Offline', { status: 503 }))
    );
});

// ============================================================
// 3. FIREBASE CLOUD MESSAGING
// ============================================================

// Firebase Config (VAPID Key လိုအပ်ပါတယ်)
const firebaseConfig = {
    apiKey: "AIzaSyBl6MK40r4rrVQ3w3RTzEgioxYoOJIb4RA",
    authDomain: "k-reader-cde45.firebaseapp.com",
    projectId: "k-reader-cde45",
    storageBucket: "k-reader-cde45.firebasestorage.app",
    messagingSenderId: "732905849808",
    appId: "1:732905849808:web:edf0f30a07b2c57ea1afd5",
    measurementId: "G-JC8RSEZ5L3"
};

// VAPID Key ကို Firebase Console > Project Settings > Cloud Messaging မှာယူပါ
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

// Push Subscription ကို သိမ်းဆည်းမယ်
let pushSubscription = null;

// Push လက်ခံရရှိခြင်း
self.addEventListener('push', function(event) {
    console.log('📨 Push notification received:', event);
    
    let notificationData = {
        title: '📚 Kreative Bookshelf',
        body: 'New update available!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
            url: '/'
        }
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData.title = data.title || notificationData.title;
            notificationData.body = data.body || notificationData.body;
            notificationData.icon = data.icon || notificationData.icon;
            notificationData.data.url = data.click_action || notificationData.data.url;
            notificationData.data.bookId = data.bookId || null;
        } catch (e) {
            // Plain text fallback
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

// Push Notification Click Event
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    const url = event.notification.data?.url || '/';
    const bookId = event.notification.data?.bookId || null;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Already open window ရှိရင် focus လုပ်
                for (let client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // မရှိရင်အသစ်ဖွင့်
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
            .then(() => {
                // Book ID ပါရင် open book page ကိုသွား
                if (bookId) {
                    // Client ကို message ပို့ပြီး book ဖွင့်ခိုင်း
                    clients.matchAll({ type: 'window', includeUncontrolled: true })
                        .then(clients => {
                            clients.forEach(client => {
                                client.postMessage({
                                    type: 'OPEN_BOOK',
                                    bookId: bookId
                                });
                            });
                        });
                }
            })
    );
});

// ============================================================
// 4. PUSH SUBSCRIPTION MANAGEMENT
// ============================================================

// Subscription ကို server မှာ save လုပ်ဖို့
async function saveSubscription(subscription) {
    try {
        // Option 1: Send to your backend server
        // await fetch('/api/save-subscription', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ subscription })
        // });
        
        // Option 2: Save in localStorage (temporary)
        localStorage.setItem('push_subscription', JSON.stringify(subscription));
        
        console.log('✅ Push subscription saved');
    } catch (error) {
        console.error('❌ Failed to save subscription:', error);
    }
}

// Subscribe to Push Notifications
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
        event.waitUntil(subscribeToPush());
    }
});

async function subscribeToPush() {
    try {
        // Check if already subscribed
        const existingSubscription = await self.registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('✅ Already subscribed to push notifications');
            await saveSubscription(existingSubscription);
            return existingSubscription;
        }
        
        // Subscribe new
        const subscription = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_KEY
        });
        
        console.log('✅ Subscribed to push notifications');
        await saveSubscription(subscription);
        return subscription;
    } catch (error) {
        console.error('❌ Failed to subscribe to push:', error);
        return null;
    }
}

// ============================================================
// 5. BACKGROUND SYNC (for offline data)
// ============================================================
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    try {
        // Get pending data from IndexedDB
        const pendingData = await getPendingData();
        if (pendingData.length === 0) return;
        
        // Send to server
        for (const data of pendingData) {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        // Clear pending data
        await clearPendingData();
        console.log('✅ Background sync completed');
    } catch (error) {
        console.error('❌ Background sync failed:', error);
    }
}

// IndexedDB helper functions (simplified)
async function getPendingData() {
    return new Promise((resolve) => {
        const request = indexedDB.open('kreative_sync', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction(['pending'], 'readonly');
            const store = transaction.objectStore('pending');
            const getAll = store.getAll();
            getAll.onsuccess = function() {
                resolve(getAll.result || []);
            };
            getAll.onerror = function() {
                resolve([]);
            };
        };
        request.onerror = function() {
            resolve([]);
        };
    });
}

async function clearPendingData() {
    return new Promise((resolve) => {
        const request = indexedDB.open('kreative_sync', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            store.clear();
            resolve();
        };
        request.onerror = function() {
            resolve();
        };
    });
}