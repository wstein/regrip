import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const typedFiles = ['src/**/*.ts', 'packages/core/src/**/*.ts', 'packages/core/src/**/*.mts'];
const testFiles = ['**/*.test.ts', '**/*.e2e.test.ts'];

export default [
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typedFiles,
    ignores: testFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    plugins: { import: importPlugin, '@typescript-eslint': tseslint.plugin },
    rules: {
      // Interface-conforming async methods and callback-style event APIs are
      // common in the transport/replay seams; no-floating-promises still
      // catches discarded work without making those signatures noisy.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // The portable core must never reach up into the lab UI or its
            // renderer integrations.
            {
              target: './packages/core/src/domain',
              from: [
                './packages/core/src/session',
                './packages/core/src/bindings',
                './src/app',
                './src/adapters',
                './src/integration',
              ],
            },
            {
              target: './packages/core/src/session',
              from: ['./src/app', './src/adapters', './src/integration'],
            },
            {
              target: './packages/core/src/bindings',
              from: ['./packages/core/src/domain', './packages/core/src/session', './src'],
            },
            // Lab integration cannot reach the presentation layer.
            { target: './src/integration', from: './src/app' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/{adapters,bindings,integration}/**/*.ts', 'packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@preact/signals-core',
              message:
                'Signals are an app-only presentation concern; use src/app/sessionSignals.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              message:
                'Three.js objects belong in src/adapters/three; expose plain data to the app.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/session/**/*.ts'],
    ignores: testFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@preact/signals-core',
              message:
                'Signals are an app-only presentation concern; use src/app/sessionSignals.ts.',
            },
            {
              name: 'smartcube-web-bluetooth',
              message:
                'Import transport types through packages/core/src/bindings/smartCubeTransport.',
            },
          ],
        },
      ],
    },
  },
  // Keep ESLint focused on correctness and architecture, not presentation.
  prettierConfig,
];
