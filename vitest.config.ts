import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*_test.res.mjs'],
    exclude: [...configDefaults.exclude, 'lib/**'],
    environment: 'node',
  },
});
