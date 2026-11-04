/** Room server URL. Online play is hidden when this is undefined (e.g. production before Render is set up). */
export const SERVER_URL: string | undefined =
  import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'ws://localhost:8787' : undefined);
