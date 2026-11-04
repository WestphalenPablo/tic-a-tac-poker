import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// One id per build. Baked into the bundle and written to version.json so a running tab can tell it is stale.
const BUILD_ID = String(Date.now());

// Offline support. Emitted (not in public/) so the cache name carries the build id: every deploy changes sw.js
// byte-for-byte, which makes the browser install the new worker, and `activate` drops the previous build's cache.
// - navigations: network first, revalidated (bypasses the 10 min Pages HTTP cache), cached copy when offline
// - everything else same-origin under the scope (hashed /assets, sounds, icons): cache first, filled on demand
// - version.json is never intercepted, so the update banner always sees the live file
const swSource = `
const CACHE = 'tatp-${BUILD_ID}';
const SCOPE = new URL(self.registration.scope).pathname;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.endsWith('/version.json')) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put(SCOPE, res.clone());
        return res;
      } catch {
        return (await cache.match(SCOPE)) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
`;

const buildFiles = (): Plugin => ({
  name: 'tatp-build-files',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource });
  },
});

export default defineConfig({
  base: '/tic-a-tac-poker/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss(), buildFiles()],
});
