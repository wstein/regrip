import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Vitest's `root` defaults to `process.cwd()`, not this config file's own
  // directory. `npm test` invokes this config with `--config` from the repo
  // root, so without an explicit root the `include` globs below silently
  // resolved against the lab's `src/`, not this package's — running the lab
  // suite twice while never running `packages/core`'s own tests.
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      'smartcube-web-bluetooth': fileURLToPath(
        new URL('../../node_modules/smartcube-web-bluetooth/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*_test.res.mjs', 'src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'dist/**'],
    environment: 'node',
  },
});
