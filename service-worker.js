self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open('klinge-lite-v4').then(cache=> cache.addAll([
    './','./index.html','./app.js','./manifest.webmanifest',
    'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    './icons/icon-192.png','./icons/icon-512.png'
  ])));
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});