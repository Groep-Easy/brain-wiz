# Brain Wis

## Goal

This repository uses strict formatting, linting, and editor settings to minimize Git conflicts and keep a stable, shared workspace for all contributors.

## Prerequisites

- Node.js `>= 20.0.0`
- npm `>= 10.0.0`
- Visual Studio Code
- Git configured with your name and email

## Recommended VS Code extensions

Install the recommended extensions from `.vscode/extensions.json` or manually install:

- `esbenp.prettier-vscode`
- `dbaeumer.vscode-eslint`
- `editorconfig.editorconfig`
- `eamodio.gitlens`
- `christian-kohler.path-intellisense`
- `streetsidesoftware.code-spell-checker`
- `gruntfuggly.todo-tree`

## Setup

1. Clone the repository.
2. Open the repository folder in VS Code.
3. Install extensions when prompted.
4. Run:
   ```bash
   npm install --package-lock-only
   npm ci
   ```

## Workspace configuration

This repository includes strict, shared settings so everyone uses the same formatting and Git behavior:

- `.editorconfig` for whitespace, tabs/spaces, and final newline rules
- `.prettierrc` for consistent code formatting
- `.eslintrc.json` for linting rules and quality enforcement
- `.vscode/settings.json` for editor behavior in VS Code
- `.gitattributes` to force LF line endings and prevent cross-platform Git conflicts

## Daily workflow

Use these commands before opening a PR:

- `npm run lint` — check for lint issues
- `npm run format:check` — verify formatting
- `npm run test` — run tests
- `npm run validate` — run lint, formatting check, and tests

If you need to fix issues automatically:

- `npm run lint:fix`
- `npm run format`

## Git habits to avoid conflicts

- Always run `git pull --rebase` before starting work.
- Keep feature branches small and focused.
- Rebase or merge main frequently when your branch is open for more than a day.
- Do not commit generated or build artifacts.

## VS Code best practice

1. Use the workspace settings from `.vscode/settings.json`.
2. Keep `Editor: Format On Save` enabled.
3. Make sure Prettier is the default formatter for supported file types.
4. Accept recommended extensions and use them consistently.

## Important notes

- Do not change workspace settings just for your local environment unless absolutely necessary.
- If you modify lint/format rules, document the change in this README and in the config files.

## Validation

Run this before a PR or merge:

```bash
npm run validate
```

This small, consistent workflow helps all 12 contributors stay aligned and prevents unnecessary Git conflicts. If you want, I can also add a pre-commit hook with Husky and lint-staged next.
