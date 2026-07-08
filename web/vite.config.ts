import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The web app imports the phase-1/2 TypeScript sources directly from ../src
// (no build step for the library): '@model' and '@core' alias the two
// index modules, and fs.allow lets the dev server read outside web/.
export default defineConfig({
  resolve: {
    alias: {
      '@model': fileURLToPath(new URL('../src/model/index.ts', import.meta.url)),
      '@core': fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
  },
});
