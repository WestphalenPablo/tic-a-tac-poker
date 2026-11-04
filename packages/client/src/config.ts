/** Room server URL. Online play is hidden when this is undefined (e.g. production before Render is set up). */
export const SERVER_URL: string | undefined =
  import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'ws://localhost:8787' : undefined);

const HEALTH_URL = SERVER_URL ? `${SERVER_URL.replace(/^ws/, 'http').replace(/\/+$/, '')}/health` : undefined;

let lastWake = 0;
/**
 * Free hosting puts the server to sleep when idle; any HTTP request wakes it. Fire one early (when the menu opens)
 * so it is usually up by the time a room is created. The response is never read, so no CORS is needed.
 */
export function wakeServer() {
  if (!HEALTH_URL || Date.now() - lastWake < 60_000) return;
  lastWake = Date.now();
  void fetch(HEALTH_URL, { mode: 'no-cors', cache: 'no-store' }).catch(() => { /* server asleep or down: the connection screen handles it */ });
}
