import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
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
    files: ['src/{adapters,bindings,session}/**/*.ts'],
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
