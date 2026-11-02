import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', 'reference/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '18.3' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // CLAUDE.md rule 9: UI copy lives in i18n, never in JSX.
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
      // CLAUDE.md rule 8: env.ts is the only reader of import.meta.env.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
          message: 'Read environment variables through src/config/env.ts.',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/config/env.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['apps/web/src/**/*.test.{ts,tsx}'],
    rules: { 'react/jsx-no-literals': 'off' },
  },
  prettier,
);
