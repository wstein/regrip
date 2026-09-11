import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/**/*.ts', 'packages/core/src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { import: importPlugin },
    rules: {
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
                './src/session',
              ],
            },
            {
              target: './packages/core/src/session',
              from: ['./src/app', './src/adapters', './src/session'],
            },
            {
              target: './packages/core/src/bindings',
              from: ['./packages/core/src/domain', './packages/core/src/session', './src'],
            },
            // Transitional lab boundaries. The portable domain/session now
            // live above; these rules preserve the app's local integration split.
            { target: './src/domain', from: './src/session' },
            { target: './src/domain', from: './src/adapters' },
            { target: './src/domain', from: './src/app' },
            { target: './src/session', from: './src/adapters' },
            { target: './src/session', from: './src/app' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/{adapters,bindings,session}/**/*.ts', 'packages/core/src/**/*.ts'],
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
  // Keep ESLint focused on correctness and architecture, not presentation.
  prettierConfig,
];
