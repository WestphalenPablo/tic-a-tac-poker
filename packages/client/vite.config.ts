import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// One id per build. Baked into the bundle and written to version.json so a running tab can tell it is stale.
const BUILD_ID = String(Date.now());

const versionFile = (): Plugin => ({
  name: 'tatp-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
  },
});

export default defineConfig({
  base: '/tic-a-tac-poker/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss(), versionFile()],
});
