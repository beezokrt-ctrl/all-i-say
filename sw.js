// Bump SHELL_VERSION whenever a cached asset changes. See ADR-008.
const SHELL_VERSION = '2026-09-29.1';
const SHELL_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './data/schema.js',
  './js/app.js',
  './js/domain/artifact.js',
  './js/domain/constellation.js',
  './js/domain/ids.js',
  './js/domain/relation.js',
  './js/domain/transcription.js',
  './js/domain/utterance.js',
  './js/durability-controls.js',
  './js/services/archive.js',
  './js/services/artifacts.js',
  './js/services/between.js',
  './js/services/constellations.js',
  './js/services/durability.js',
  './js/services/export.js',
  './js/services/inspect.js',
  './js/services/library.js',
  './js/services/offline.js',
  './js/services/search.js',
  './js/storage/conflict.js',
  './js/storage/export.js',
  './js/storage/import.js',
  './js/storage/indexeddb.js',
  './js/storage/repository.js',
  './js/storage/upgrade-backup.js',
  './js/storage/migrations/legacy-temporal.js',
  './js/views.js',
  './js/views/durability.js',
  './js/views/inspect.js',
  './js/views/library.js',
  './js/views/places.js',
];
const CACHE_PREFIX = 'all-i-say-shell:' + encodeURIComponent(self.registration.scope) + ':';
const CACHE_NAME = CACHE_PREFIX + SHELL_VERSION;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const ROOT_URL = new URL('./', self.registration.scope).href;
const ASSET_URLS = new Set(SHELL_ASSETS.map(path=>new URL(path,self.registration.scope).href));

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      await cache.addAll([...ASSET_URLS].map(url=>new Request(url,{cache:'reload'})));
    }catch(error){
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Let an update wait until every old window closes. Never replace a
    // running editor or mix a new shell with old modules through skipWaiting.
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  url.search='';url.hash='';
  const canonical=url.href===ROOT_URL?INDEX_URL:url.href;
  if(!ASSET_URLS.has(canonical))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    return await cache.match(canonical)||fetch(event.request);
  })());
});
