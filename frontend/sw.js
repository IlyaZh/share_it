const CACHE_NAME = 'secure-storage-cache-v1.0.11';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './manifest.json',
  './icon.png',
  './src/app.js',
  './src/api.js',
  './src/router.js',
  './src/locales/en.js',
  './src/locales/ru.js',
  './src/locales/i18n.js',
  './src/utils/toast.js',
  './src/utils/crypto.js',
  './src/utils/format.js',
  './src/utils/clipboard.js',
  './src/views/home.js',
  './src/views/login.js',
  './src/views/register.js',
  './src/views/auth-error.js',
  './src/views/create.js',
  './src/views/dashboard.js',
  './src/views/secret.js',
  './screenshot-desktop.png',
  './screenshot-mobile.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event (Clean old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Handle Web Share Target POST request
  if (event.request.method === 'POST' && event.request.url.includes('/share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';
          const url = formData.get('url') || '';
          const file = formData.get('file');

          await setSharedData({
            title,
            text,
            url,
            file: file instanceof File ? file : null
          });
        } catch (err) {
          console.error('[Service Worker] Failed to store shared target data:', err);
        }
        // Redirect directly to the secret creation page
        return Response.redirect('./#/create', 303);
      })()
    );
    return;
  }

  // Skip API, non-GET, and non-HTTP/HTTPS requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://'))
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache dynamically if it is a successful basic static file request
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

// Message Listener for PWA Auto-Updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Helper for IndexedDB storage of shared target payloads
const DB_NAME = 'ShareTargetDB';
const STORE_NAME = 'shared_store';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function setSharedData(data) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, 'shared-data');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}
