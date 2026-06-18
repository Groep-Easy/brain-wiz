import { ignores, base, browser, react } from '@brain-wiz/eslint-config'
export default [
  ...ignores,
  ...base,
  ...browser,
  ...react,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: false, project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },
    },
  },
]
