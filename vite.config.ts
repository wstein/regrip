import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { DevTools } from '@vitejs/devtools';

const workerImportMetaUrlRE =
  /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g;

export default defineConfig(async ({ command }) => ({
  // GitHub Pages serves the built site below the repository name; Vite's
  // development server should remain available at localhost:5173/.
  base: command === 'serve' ? '/' : '/smartcube-example/',
  // Passive keeps the dock out of the demo until the developer invokes it
  // (Shift+Option+D on macOS); it is omitted entirely from Pages builds.
  plugins: command === 'serve' ? await DevTools({ embeddedVisibility: 'passive' }) : [],
  resolve: {
    alias: {
      'smartcube-web-bluetooth': fileURLToPath(
        new URL('./node_modules/smartcube-web-bluetooth/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    chunkSizeWarningLimit: 2048,
  },
  optimizeDeps: {
    exclude: ['cubing'],
  },
  worker: {
    format: 'es',
    plugins: () => [
      {
        name: 'disable-nested-workers',
        enforce: 'pre',
        transform(code, id) {
          if (
            code.includes('new Worker') &&
            code.includes('new URL') &&
            code.includes('import.meta.url')
          ) {
            const result = code.replace(
              workerImportMetaUrlRE,
              `((() => { throw new Error('Nested workers are disabled') })()`,
            );
            return result;
          }
        },
      },
    ],
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/worker/[name]-[hash].js',
        assetFileNames: 'assets/worker/[name]-[hash].js',
      },
    },
  },
}));
