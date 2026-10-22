// Authenticated records and API responses are never put in Cache Storage.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>LeadsNoble offline</title><body style="background:#f4f0e5;color:#11110f;font:20px Georgia;padding:40px"><h1>You’re offline.</h1><p>Reconnect to open your private lead studio. Your saved records are stored securely on the server.</p><a href="/">Try again</a>',{headers:{'Content-Type':'text/html'}})))});
