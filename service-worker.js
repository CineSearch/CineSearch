const CACHE_NAME = "cinesearch-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./api.js",
  "./cors.js",
  "./preferiti.js",
  "./continua-visione.js",
  "./card.js",
  "./categorie.js",
  "./film-serie.js",
  "./ricerca.js",
  "./player.js"
];

// Install → cache iniziale
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch → usa cache se offline
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Activate → pulizia vecchie versioni
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});
