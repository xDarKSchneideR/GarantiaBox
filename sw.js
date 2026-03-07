// ============================================
// SERVICE WORKER - GARANTÍABOX
// ============================================

const CACHE_NAME = 'garantia-box-v1';
const OFFLINE_URL = './offline.html';

// Archivos para cachear inmediatamente
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html'
];

// ============================================
// INSTALACIÓN - Cachear archivos estáticos
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando archivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error en instalación:', error);
      })
  );
});

// ============================================
// ACTIVACIÓN - Limpiar caches antiguas
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Eliminando cache antigua:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completada');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH - Estrategia de caché
// ============================================
self.addEventListener('fetch', (event) => {
  // Ignorar solicitudes que no sean GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar solicitudes externas (APIs, analytics, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Devolver desde caché si existe
          console.log('[SW] Sirviendo desde caché:', event.request.url);
          return cachedResponse;
        }
        
        // Si no está en caché, intentar fetch de red
        return fetch(event.request)
          .then((networkResponse) => {
            // Verificar que la respuesta sea válida
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clonar la respuesta para guardar en caché
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('[SW] Guardando en caché:', event.request.url);
              });
            
            return networkResponse;
          })
          .catch((error) => {
            // Si falla la red y no hay caché, mostrar offline
            console.error('[SW] Error en fetch:', error);
            
            // Para navegación, mostrar página offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            // Para otros recursos, devolver error
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// ============================================
// MENSAJES - Comunicación con la app
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Mensaje para limpiar caché manualmente
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
  
  // Mensaje para obtener estado del cache
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.keys().then((cacheNames) => {
      event.ports[0].postMessage({ 
        caches: cacheNames,
        version: CACHE_NAME
      });
    });
  }
});

// ============================================
// PUSH NOTIFICATIONS (Opcional - Futuro)
// ============================================
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('GarantíaBox', options)
  );
});

// ============================================
// NOTIFICATION CLICK
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('./index.html')
    );
  }
});

console.log('[SW] Service Worker cargado correctamente');