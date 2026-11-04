import { createGameServer } from './server.js';

const DEFAULT_ORIGINS = 'https://westphalenpablo.github.io,http://localhost:5173';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(',').map((s) => s.trim()).filter(Boolean);
const port = Number(process.env.PORT ?? 8787);

createGameServer({ allowedOrigins }).listen(port, () => {
  console.log(`tatp server listening on :${port} (origins: ${allowedOrigins.join(', ')})`);
});
