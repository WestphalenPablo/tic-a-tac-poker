/** Tiny path routing for `<base>/room/{id}`. No router library: there is one dynamic route. */

const base = import.meta.env.BASE_URL; // '/tic-a-tac-poker/' (see vite.config.ts)

export function getRoomId(): string | null {
  const p = window.location.pathname;
  if (!p.startsWith(base)) return null;
  return /^room\/([A-Za-z0-9_-]{4,32})\/?$/.exec(p.slice(base.length))?.[1] ?? null;
}

/** Shareable absolute link to a room. */
export const roomUrl = (id: string) => `${window.location.origin}${base}room/${id}`;

/** Reflect the room in the address bar so it can be shared from there too. replaceState keeps Back simple. */
export const showRoomInUrl = (id: string) => window.history.replaceState(null, '', `${base}room/${id}`);
export const showHomeInUrl = () => window.history.replaceState(null, '', base);
