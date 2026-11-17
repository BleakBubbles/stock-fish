import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const fetchBan = {
  name: 'fetch',
  message: 'Market data goes through src/data/providers/ (CLAUDE.md rule 1).',
};

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'src/theme/generated'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Rule 1: no network calls outside providers.
      'no-restricted-globals': ['error', fetchBan],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: fetchBan.message },
        { object: 'globalThis', property: 'fetch', message: fetchBan.message },
      ],
      // Rule 3: only the theme module reads art/.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/art/**'], message: 'Read art/ through src/theme (CLAUDE.md rule 3).' },
          ],
        },
      ],
    },
  },
  {
    // Tests index into fixtures they just built; assertions are clearer than guards there.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['src/data/providers/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['src/theme/**', 'vite.config.ts', 'scripts/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Rule 6: the mood engine is pure.
    files: ['src/mood/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react/*',
                'pixi.js',
                'dexie',
                '**/data/**',
                '**/tank/**',
                '**/ui/**',
                '**/art/**',
              ],
              message: 'src/mood must stay pure (CLAUDE.md rule 6).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'scripts/**', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
);
