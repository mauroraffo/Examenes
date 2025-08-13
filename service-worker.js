const CACHE_NAME = 'klinge-lite-v6c';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icono_mineria_color_192.png',
  '/icons/icono_mineria_color_512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
  )));
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(r=>
      r || fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c=> c.put(e.request, copy));
        return res;
      }).catch(()=> caches.match('/index.html'))
    )
  );
});

