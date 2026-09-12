import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { DevTools } from '@vitejs/devtools';

const workerImportMetaUrlRE =
  /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g;

function sourceCommitSha(): string {
  const configuredSha = process.env.VITE_REGRIP_GIT_SHA?.trim();
  if (configuredSha && /^[0-9a-f]{7,40}$/i.test(configuredSha)) return configuredSha;

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(async ({ command }) => {
  const plugins = command === 'serve' ? [await DevTools({ embeddedVisibility: 'passive' })] : [];

  return {
    define: {
      __REGRIP_BUILD_SHA__: JSON.stringify(sourceCommitSha()),
    },
    // GitHub Pages serves the built site below the repository name; Vite's
    // development server should remain available at localhost:5173/.
    base: command === 'serve' ? '/' : '/regrip/',
    // Passive keeps the dock out of the demo until the developer invokes it
    // (Shift+Option+D on macOS); dev-only plugins never enter Pages builds.
    plugins,
    resolve: {
      alias: {
        'smartcube-web-bluetooth': fileURLToPath(
          new URL('./node_modules/smartcube-web-bluetooth/src/index.ts', import.meta.url),
        ),
      },
    },
    build: {
      target: 'es2022',
      manifest: true,
      chunkSizeWarningLimit: 2048,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
        },
      },
    },
    optimizeDeps: {
      exclude: ['cubing'],
    },
    // This Git dependency is deliberately aliased to its TypeScript source so
    // Regrip can type-check its transport boundary. Vite normally ignores all
    // of node_modules while watching, which leaves a running dev server on a
    // stale protocol revision after an npm/Bun Git-SHA update.
    server: {
      watch: {
        ignored: (path) =>
          path.includes('/node_modules/') &&
          !path.includes('/node_modules/smartcube-web-bluetooth/'),
      },
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
  };
});
