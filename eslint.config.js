import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const SRC_FILES = ['src/**/*.{ts,tsx}'];
const STORY_FILES = ['src/**/*.stories.{ts,tsx}'];

export default [
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      'storybook-static',
      'src-tauri',
      'codex-acp',
      'public',
      'docs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  {
    files: SRC_FILES,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/prop-types': 'off',
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'warn',
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-role': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
    },
  },
  {
    files: STORY_FILES,
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-useless-escape': 'off',
    },
  },
  prettier,
];
