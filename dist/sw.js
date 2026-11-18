const VERSION='first-mix-v1';
const SHELL=[
  './','./index.html','./styles.css','./app.js','./audio.js','./core.js','./storage.js',
  './catalog.json','./manifest.webmanifest','./assets/inter.woff2',
  './assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png',
  './assets/after-hours.wav','./assets/open-water.wav',
  './assets/MUSIC-CREDITS.txt','./assets/licenses.json','./assets/INTER-LICENSE.txt'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('first-mix-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  // Cache only app paths; do not capture authentication responses from the host.
  const pathname=new URL(event.request.url).pathname;
  const appPath=pathname==='/'||/\/(index\.html|styles\.css|app\.js|audio\.js|core\.js|storage\.js|catalog\.json|manifest\.webmanifest)$/.test(pathname)||pathname.includes('/assets/');
  if(!appPath)return;
  event.respondWith(caches.open(VERSION).then(async cache=>{
    const cached=await cache.match(event.request,{ignoreSearch:false});
    if(cached)return cached;
    const response=await fetch(event.request);
    if(response.ok&&response.type==='basic'&&!event.request.headers.has('range')){
      // A catalog track is kept offline after the first successful load.
      try{await cache.put(event.request,response.clone());}catch{/* Storage pressure must not prevent playback. */}
    }
    return response;
  }));
});
