import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'smartcube-web-bluetooth': fileURLToPath(
        new URL('./node_modules/smartcube-web-bluetooth/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: [
      'src/**/*_test.res.mjs',
      'packages/core/src/**/*_test.res.mjs',
      'src/**/*.test.ts',
      'test/**/*.test.ts',
    ],
    exclude: [...configDefaults.exclude, 'lib/**'],
    environment: 'node',
  },
});
