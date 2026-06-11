# CI Pipeline

This setup adds automated project checks to the GitHub Actions pipeline. The pipeline validates formatting, linting, tests, build output, dependency changes, and coverage reports before code is merged into the main project branches.

The goal is to catch problems early and make sure pull requests stay stable before they are reviewed or merged.

---

## Overview

The CI pipeline runs automatically when code is pushed or when a pull request is opened or updated.

```text
Developer opens or updates PR
        ↓
GitHub Actions starts project checks
        ↓
Formatting, linting, tests, coverage, and build are checked
        ↓
Dependency changes are reviewed
        ↓
PR shows whether all checks passed
        ↓
Team can safely review and merge
```

The pipeline is split into multiple jobs so every check is clear and easy to debug.

---

## Core files

| File                                      | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `.github/workflows/project-checks.yml`    | Main CI workflow for formatting, linting, tests, coverage, and build.   |
| `.github/workflows/database-runner.yml`   | Reusable workflow for jobs that need PostgreSQL and a test environment. |
| `.github/workflows/dependency-review.yml` | Checks dependency changes in pull requests.                             |
| `.env.test`                               | Test environment file used by the CI database runner.                   |

---

## Project checks workflow

The main workflow is defined in:

```text
.github/workflows/project-checks.yml
```

This workflow is called **Project checks**.

It runs on:

```yaml
on:
  pull_request:
    branches:
      - develop
      - master
  push:
    branches:
      - develop
      - master
  workflow_dispatch:
```

| Trigger             | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `pull_request`      | Runs when a PR targets `develop` or `master`.                |
| `push`              | Runs after code is pushed or merged into `develop`/`master`. |
| `workflow_dispatch` | Allows the workflow to be started manually from GitHub.      |

The pull request trigger is the most important one because it checks code before it gets merged.

---

## Project check jobs

The workflow contains separate jobs for each check.

| Job                        | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `Check formatting`         | Verifies that the code follows the Prettier formatting rules. |
| `Run lint`                 | Runs ESLint to catch code style and quality issues.           |
| `Run tests`                | Runs the project test suite with a PostgreSQL database.       |
| `Generate coverage report` | Generates LCOV and HTML coverage reports.                     |
| `Run build`                | Verifies that the server, client, and host build correctly.   |

Splitting the checks into separate jobs makes it easier to see what failed. For example, if only formatting fails, the reviewer immediately knows the problem is not related to tests or build output.

---

## Node.js setup

The workflow uses a shared Node.js version:

```yaml
env:
  NODE_VERSION: 22
```

Each job uses this value when setting up Node:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: npm
    cache-dependency-path: package-lock.json
```

This keeps the CI environment close to the project setup and avoids repeating the Node version in multiple places.

Dependency installation is done with:

```bash
npm ci --prefer-offline --no-audit --progress=false
```

This is suitable for CI because it installs dependencies from `package-lock.json` in a clean and predictable way.

---

## Formatting check

The formatting job runs:

```bash
npm run format:check
```

This checks whether files follow the configured Prettier format.

It does not change files automatically. This is important because CI should only verify the code, not edit it.

---

## Lint check

The lint job runs:

```bash
npm run lint
```

This checks the source code and tests with ESLint.

The lint job helps catch issues such as invalid code style, unused variables, unsafe patterns, or rules defined by the project.

---

## Build check

The build job runs:

```bash
npm run build
```

This verifies that the complete project can be built successfully.

The build script includes the server, client, and host builds. This means the CI pipeline checks that the project still compiles after a change.

---

## Database runner workflow

Some jobs need a running PostgreSQL database. Instead of copying the same database setup into every job, this setup uses a reusable workflow:

```text
.github/workflows/database-runner.yml
```

The reusable workflow is called by `project-checks.yml` for:

* `Run tests`
* `Generate coverage report`

This avoids duplicated database configuration and keeps the main workflow cleaner.

```text
project-checks.yml
        ↓
calls database-runner.yml
        ↓
starts PostgreSQL
        ↓
copies .env.test to .env
        ↓
runs test or coverage command
```

---

## Reusable workflow inputs

The database runner uses `workflow_call`, which allows it to be called from another workflow.

```yaml
on:
  workflow_call:
    inputs:
      job-name:
        required: true
        type: string
      node-version:
        required: false
        type: string
        default: '22'
      run-command:
        required: true
        type: string
      upload-coverage:
        required: false
        type: boolean
        default: false
```

| Input             | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `job-name`        | Display name for the job in GitHub Actions.              |
| `node-version`    | Node.js version used by the job.                         |
| `run-command`     | Command that should run after the database is ready.     |
| `upload-coverage` | Enables coverage tooling and uploads coverage artifacts. |

This makes the same workflow usable for both tests and coverage.

---

## Running tests with PostgreSQL

The test job calls the reusable database runner:

```yaml
tests:
  name: Run tests
  uses: ./.github/workflows/database-runner.yml
  with:
    job-name: Run tests
    node-version: '22'
    run-command: npm run test:project-checks
    upload-coverage: false
```

The database runner starts a PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ci_test_password
      POSTGRES_DB: ci_test_postgres
```

The health check waits until PostgreSQL is ready:

```yaml
options: >-
  --health-cmd="pg_isready -U postgres -d ci_test_postgres"
  --health-interval=10s
  --health-timeout=5s
  --health-retries=5
```

This makes sure database-dependent tests do not start before the database is available.

---

## CI environment file

The database runner creates a `.env` file during the workflow run by copying the committed test environment file:

```yaml
- name: Create .env
  run: cp .env.test .env
```

The `.env.test` file contains the environment values needed for the test/CI environment.

This keeps the CI workflow cleaner because the test environment configuration is stored in one place instead of being written directly inside the workflow.

The PostgreSQL service values are still defined inside `database-runner.yml`, because GitHub Actions needs them to start the database container before the workflow steps run.

The CI database values are separate from local development values:

| Variable         | CI value           |
| ---------------- | ------------------ |
| `NODE_ENV`       | `test`             |
| `DB_HOST`        | `127.0.0.1`        |
| `DB_USERNAME`    | `postgres`         |
| `DB_PASSWORD`    | `ci_test_password` |
| `DB_NAME`        | `ci_test_postgres` |
| `DB_SYNCHRONIZE` | `true`             |
| `DB_DROP_SCHEMA` | `false`            |

---

## Test environment file

The test environment file is defined in:

```text
.env.test
```

This file is committed to the repository because it does not contain real production secrets. It only contains values for the CI test environment.

Example values:

```env
PORT=3000
NODE_ENV=test
BASE_URL=http://localhost:3000
ADMIN_API_KEY=ci-test-key

POSTGRES_USER=postgres
POSTGRES_PASSWORD=ci_test_password
POSTGRES_DB=ci_test_postgres

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=ci_test_password
DB_NAME=ci_test_postgres
```

The normal `.env` file is still ignored by Git and should not be committed.

---

## Coverage report

The coverage job also uses the database runner:

```yaml
coverage:
  name: Generate coverage report
  needs: tests
  uses: ./.github/workflows/database-runner.yml
  with:
    job-name: Generate coverage report
    node-version: '22'
    run-command: npm run test:coverage
    upload-coverage: true
```

The coverage job only starts after the normal test job has passed:

```yaml
needs: tests
```

This avoids generating a coverage report when the test suite is already failing.

---

## Coverage artifacts

When `upload-coverage` is enabled, the database runner installs coverage tooling and uploads two artifacts:

| Artifact name          | Purpose                                |
| ---------------------- | -------------------------------------- |
| `coverage-lcov-report` | Machine-readable LCOV coverage report. |
| `coverage-html-report` | Human-readable HTML coverage report.   |

The HTML report is generated from the LCOV file:

```yaml
- name: Generate HTML coverage report
  run: |
    cd dist
    genhtml ../coverage/lcov.info --output-directory ../coverage/html
```

The reports are uploaded with `actions/upload-artifact`:

```yaml
- name: Upload HTML coverage report
  uses: actions/upload-artifact@v4
  with:
    name: coverage-html-report
    path: coverage/html
    if-no-files-found: error
```

After the workflow finishes, the coverage reports can be downloaded from the GitHub Actions run page.

```text
GitHub → Actions → Project checks → Workflow run → Artifacts
```

To read the HTML report, download `coverage-html-report` and open:

```text
index.html
```

---

## Dependency review workflow

Dependency review is handled in a separate workflow:

```text
.github/workflows/dependency-review.yml
```

This workflow checks dependency changes in pull requests.

It runs on:

```yaml
on:
  pull_request:
    branches:
      - develop
      - master
```

The workflow uses:

```yaml
uses: actions/dependency-review-action@v4
```

This checks whether a pull request introduces risky dependency changes. For example, it can fail the PR if a new dependency introduces a high-severity vulnerability.

The repository Dependency Graph must be enabled for this check to work.

---

## Why dependency review is separate

Dependency review is separate from `project-checks.yml` because it has a different purpose.

| Workflow                | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `project-checks.yml`    | Checks code quality, tests, build, coverage. |
| `dependency-review.yml` | Checks dependency changes in pull requests.  |
| `database-runner.yml`   | Shared workflow for database-backed jobs.    |

Keeping dependency review separate makes the CI setup easier to understand and keeps security checks independent from normal project checks.

---

## Pull request checks

After the workflows run, a pull request can show checks such as:

```text
Project checks / Check formatting
Project checks / Run lint
Project checks / Run tests / Run tests
Project checks / Generate coverage report / Generate coverage report
Project checks / Run build
Dependency review / Review dependency changes
```

The repeated names for tests and coverage are expected because those jobs use a reusable workflow. GitHub shows both the caller job name and the reusable workflow job name.

---

## Manual workflow runs

The project checks workflow includes:

```yaml
workflow_dispatch:
```

This allows the workflow to be started manually from GitHub.

```text
GitHub → Actions → Project checks → Run workflow
```

This is useful when the team wants to rerun the CI pipeline without pushing a new commit.

---

## Final result

The project now has a CI setup that automatically checks important quality gates before code is merged.

The pipeline now provides:

* automated formatting checks;
* automated lint checks;
* automated database-backed tests;
* automated build checks;
* reusable PostgreSQL setup for test-related jobs;
* `.env.test` support for the CI test environment;
* LCOV and HTML coverage report artifacts;
* dependency review for pull requests;
* manual workflow execution through GitHub Actions.

```text
PR opened
   ↓
Project checks run
   ↓
Dependency review runs
   ↓
Coverage report is generated
   ↓
Reviewers can see whether the branch is safe to merge
```

This makes the project more reliable and gives the team faster feedback when something breaks.
