/**
 * @file index.mjs
 * @description Shared ESLint flat-config pieces for all @brain-wiz/* packages.
 * Compose in each package's eslint.config.mjs, e.g.:
 *   import { ignores, base, node } from '@brain-wiz/eslint-config'
 *   export default [...ignores, ...base, ...node]
 */
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/** Strict TypeScript ruleset — applies to all .ts/.tsx (moved verbatim from the old root config). */
const STRICT_TS_RULES = {
  'no-console': 'warn',
  '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'error',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/no-empty-function': 'error',
  '@typescript-eslint/no-empty-interface': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-this-alias': 'error',
  '@typescript-eslint/no-var-requires': 'error',
  '@typescript-eslint/prefer-namespace-keyword': 'error',
  '@typescript-eslint/triple-slash-reference': 'error',
  '@typescript-eslint/no-use-before-define': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unnecessary-qualifier': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/no-unnecessary-type-constraint': 'error',
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false, checksConditionals: false }],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/promise-function-async': 'error',
  '@typescript-eslint/prefer-includes': 'error',
  '@typescript-eslint/prefer-string-starts-ends-with': 'error',
  '@typescript-eslint/prefer-for-of': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/prefer-regexp-exec': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  '@typescript-eslint/return-await': 'error',
  '@typescript-eslint/naming-convention': [
    'error',
    { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
    { selector: 'variable', types: ['boolean'], format: ['PascalCase'], prefix: ['is', 'should', 'has', 'can', 'did', 'will'] },
    { selector: 'variable', format: ['camelCase'], modifiers: ['unused'], prefix: ['_', '__'] },
  ],
  '@typescript-eslint/no-inferrable-types': 'error',
  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
  '@typescript-eslint/no-magic-numbers': ['warn', { ignore: [0, 1], ignoreArrayIndexes: true }],
  '@typescript-eslint/consistent-indexed-object-style': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-promise-executor-return': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/ban-ts-comment': ['error'],
  'no-implicit-coercion': 'warn',
  'no-alert': 'warn',
  'no-unused-expressions': 'error',
}

/** Ignore globs shared by every package. */
export const ignores = [{ ignores: ['**/dist/**', '**/node_modules/**'] }]

/** Core: recommended + prettier + strict TS rules, type-aware via projectService. */
export const base = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: STRICT_TS_RULES,
  },
]

/** Node environment globals (server, config). */
export const node = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { globals: { ...globals.node } },
  },
]

/** Browser environment globals (client, host, and the React-bearing libs). */
export const browser = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
  },
]

/** React overlay for .tsx: plugins + ceremony-rule relaxations. */
export const react = [
  {
    files: ['**/*.tsx'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // React components return inferred JSX — these ceremony rules fight idiomatic React:
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      // Idiomatic React files put the exported component first and its (hoisted) helper
      // components/functions/types below it. Function and type declarations are hoisted, so
      // this ordering is not a runtime bug — it just reads top-down. The rule fired ~24x across
      // these never-before-linted .tsx files; downgraded to warn for .tsx only (stays 'error'
      // for all non-component .ts files where ordering can mask real TDZ issues).
      '@typescript-eslint/no-use-before-define': 'warn',
      // The boolean is/has/should-prefix naming rule fired ~26x across never-before-linted .tsx
      // files, almost entirely on idiomatic React `useState` booleans (joined, joining, kicked,
      // visible, revealed, locked, …). Renaming each state var + its setter + every call site is
      // high-churn and not a bug. We re-declare naming-convention for .tsx WITHOUT the boolean
      // prefix selector, so booleans fall under the general camelCase rule. All other naming
      // checks stay 'error' on .tsx, and the full rule (boolean prefix included) stays 'error'
      // for non-component .ts files.
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase'], modifiers: ['unused'], prefix: ['_', '__'] },
      ],
    },
  },
]

/** Test-file relaxations (root config only — tests/ is not a workspace). */
export const tests = [
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      'no-console': 'off',
    },
  },
]
