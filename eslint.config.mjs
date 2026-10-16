import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
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
      // typescript-eslint v8 removed no-throw-literal; only-throw-error is its replacement (already 'error' in strictTypeChecked)
      '@typescript-eslint/only-throw-error': 'error',
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
    // tests/fixtures/v1.3-cheap2: planted fixture projects (inputs of the batch-2 cheap proxies, with deliberate
    // anti-patterns and their own ambient typings), not code of this repository. tests/fixtures/v1.3-devset-b: the same
    // for the devset-b reference variants (copies of the reference projects plus planted variants).
    // tests/fixtures/v1.3-dynamic-imports: planted require()/import() edges (R03 of the 2026-10-16 review).
    // tests/fixtures/v1.3-judge-steering: single unit files of CHECK-2 copies (judge steering-comment variants), whose
    // imports resolve only inside their CHECK-2 project.
    // src/cypher-interp/generated: ANTLR output (scripts/v1.3/gen-cypher-parser.sh), not hand-written.
    // tests/fixtures/loop-acceptance: plain-JS demo services the acceptance runner starts (not TypeScript of this repo).
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.cjs', '*.mjs', 'tests/fixtures/v1.3-cheap2/**', 'tests/fixtures/v1.3-devset-b/**', 'tests/fixtures/v1.3-dynamic-imports/**', 'tests/fixtures/v1.3-judge-steering/**', 'tests/fixtures/loop-acceptance/**', 'src/cypher-interp/generated/**'],
  },
);
