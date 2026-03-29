import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Enforce explicit return types on public methods
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      // Enforce Result<T> pattern — no throwing untyped errors in domain code
      '@typescript-eslint/no-throw-literal': 'error',
      // Prefer readonly for immutable value objects
      '@typescript-eslint/prefer-readonly': 'error',
      // No any
      '@typescript-eslint/no-explicit-any': 'error',
      // Console only in CLI module
      'no-console': 'warn',
    },
  },
  {
    // Relax rules for test files
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  },
  {
    // Console allowed in CLI module
    files: ['src/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.cjs', '*.mjs'],
  },
);
