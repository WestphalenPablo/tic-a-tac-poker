/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL of the room server (wss://...). Unset in production until the server is deployed. */
  readonly VITE_SERVER_URL?: string;
}
