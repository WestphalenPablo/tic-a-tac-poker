/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL of the room server (wss://...). Unset in production until the server is deployed. */
  readonly VITE_SERVER_URL?: string;
}

/** Id of the build this bundle came from (see vite.config.ts). Compared with version.json to detect a newer deploy. */
declare const __BUILD_ID__: string;
/** Git sha of the build ('' if git was unavailable). Marks where a stale tab's missing commits start in version.json. */
declare const __BUILD_COMMIT__: string;
