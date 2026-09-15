import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { DevTools } from '@vitejs/devtools';
import IstanbulPlugin from 'vite-plugin-istanbul';

const workerImportMetaUrlRE =
  /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g;
const releaseTagRE = /^(?:core|regrip)-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function sourceCommitSha(): string {
  const configuredSha = process.env.VITE_REGRIP_GIT_SHA?.trim();
  if (configuredSha && /^[0-9a-f]{7,40}$/i.test(configuredSha)) return configuredSha;

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function sourceReleaseTag(sha: string): string {
  const configuredTag = process.env.VITE_REGRIP_RELEASE_TAG?.trim();
  if (configuredTag && releaseTagRE.test(configuredTag)) return configuredTag;

  try {
    const tags = execFileSync('git', ['tag', '--points-at', sha], { encoding: 'utf8' })
      .split('\n')
      .map((tag) => tag.trim())
      .filter((tag) => releaseTagRE.test(tag));
    return (
      tags.find((tag) => tag.startsWith('regrip-v')) ??
      tags.find((tag) => tag.startsWith('core-v')) ??
      ''
    );
  } catch {
    return '';
  }
}

export default defineConfig(async ({ command }) => {
  const buildSha = sourceCommitSha();
  const buildReleaseTag = sourceReleaseTag(buildSha);
  const plugins: Plugin[] = [];
  if (command === 'serve') plugins.push(await DevTools({ embeddedVisibility: 'passive' }));
  if (process.env.VITE_COVERAGE === 'true') {
    plugins.push(
      IstanbulPlugin({
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
        extension: ['.ts'],
        requireEnv: true,
      }),
    );
  }

  return {
    define: {
      __REGRIP_BUILD_SHA__: JSON.stringify(buildSha),
      __REGRIP_BUILD_RELEASE_TAG__: JSON.stringify(buildReleaseTag),
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
      sourcemap: process.env.VITE_COVERAGE === 'true',
      chunkSizeWarningLimit: 2048,
      rollupOptions: {
        input: {
          home: fileURLToPath(new URL('./index.html', import.meta.url)),
          console: fileURLToPath(new URL('./console/index.html', import.meta.url)),
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
