import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { DevTools } from '@vitejs/devtools';

const workerImportMetaUrlRE =
  /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g;
const apiDocsDirectory = resolve(fileURLToPath(new URL('./docs/api/', import.meta.url)));
const apiDocsFallback = fileURLToPath(new URL('./docs/api-fallback.html', import.meta.url));

const contentTypes: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

/** Serves generated TypeDoc locally, with a useful guide before it exists. */
function localApiDocs(): Plugin {
  return {
    name: 'local-api-docs',
    configureServer(server) {
      server.middlewares.use('/docs/api', (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const candidate = resolve(apiDocsDirectory, relativePath);
        const insideDocs = candidate.startsWith(`${apiDocsDirectory}${sep}`);
        const documentPath =
          insideDocs && existsSync(candidate) && statSync(candidate).isFile()
            ? candidate
            : relativePath === 'index.html'
              ? apiDocsFallback
              : undefined;
        if (!documentPath) return next();

        response.statusCode = 200;
        response.setHeader(
          'Content-Type',
          contentTypes[extname(documentPath)] ?? 'application/octet-stream',
        );
        response.end(readFileSync(documentPath));
      });
    },
  };
}

export default defineConfig(async ({ command }) => {
  const plugins =
    command === 'serve'
      ? [...(await DevTools({ embeddedVisibility: 'passive' })), localApiDocs()]
      : [];

  return {
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
  };
});
