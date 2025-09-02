const CACHE_NAME = 'klinge-lite-v4';
const ASSETS = [
  './','./index.html','./app.js','./manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  './icons/icon-192.png','./icons/icon-512.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=> cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=> Promise.all(keys.filter(k=> k!==CACHE_NAME).map(k=> caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for app shell to pick up updates quickly
self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if(req.method !== 'GET'){ return; }
  if(/\.(?:html|js|css)$/.test(new URL(req.url).pathname)){
    event.respondWith(
      fetch(req).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c=> c.put(req, copy)).catch(()=>{});
        return resp;
      }).catch(()=> caches.match(req))
    );
  }else{
    event.respondWith(caches.match(req).then(r=> r || fetch(req)));
  }
});
