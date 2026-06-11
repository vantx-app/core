const CACHE_NAME = "vantx-cache-v1";
const OFFLINE_URL = "/offline";

const ASSETS_TO_CACHE = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-32x32.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cachear el manifest, iconos y la página offline
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  // Forzar que el SW entrante sea activo de inmediato
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            // Eliminar versiones viejas de caché
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  // Tomar control de todos los clientes de inmediato
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Solo interceptar peticiones GET del mismo origen
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  // Interceptar navegación de documentos (páginas principales)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      }),
    );
    return;
  }

  // Estrategia Stale-While-Revalidate para recursos estáticos del Next.js y locales
  const isStaticAsset =
    event.request.url.includes("/_next/static/") ||
    event.request.url.includes("/icons/") ||
    event.request.url.includes("/favicon.ico") ||
    event.request.url.includes("/manifest.json");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Ignorar silenciosamente fallos de red en actualizaciones secundarias
          });
        return cachedResponse || fetchPromise;
      }),
    );
  }
});
