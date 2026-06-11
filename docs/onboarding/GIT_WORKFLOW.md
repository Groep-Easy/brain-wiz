# Git & GitHub Workflow

We use a single organization with one repository. Strict workflow rules apply to keep the codebase stable and prevent merge conflicts.

## 1. Project Management

All tasks, bugs, and features are tracked using GitHub's built-in tools.

- **Scrumboard**: [Groep-Easy Projects/2](https://github.com/orgs/Groep-Easy/projects/2) — Track active sprints, tasks, and progress here.
- **Issues**: [Groep-Easy/brain-wiz/issues](https://github.com/Groep-Easy/brain-wiz/issues) — Report bugs and define feature requirements here. Claim an issue before starting work!

## 2. Branching Strategy

1. **Never commit directly to `master` or `develop`.**
2. Always create a new branch from `develop` for your work.
   - **Prefix your branches correctly:**
     - `feat/` for new features (e.g. `feat/add-timer`)
     - `fix/` for bug fixes (e.g. `fix/db-connection`)
     - `chore/` for maintenance, config, or docs (e.g. `chore/docs`)
     - **Example:** `git checkout -b feat/add-timer`
3. Keep your branches focused and small.
4. Run `git pull --rebase origin develop` frequently on your branch to stay up to date and avoid painful merge conflicts later.
5. Run `git push` from working branch and then ask for merge request. [GitHub Pull Requests](https://github.com/Groep-Easy/brain-wiz/pulls). `develop` <- `current branch`
6. To keep your own local repo clean `git fetch --all --prune` and `git remote prune origin --dry-run` to see what would be pruned.
7. Back to develop with: `git switch develop` after merging your branch into develop.

## 3. Commits & Validations

1. Write descriptive commit messages matching your branch prefix (e.g. `feat(server): implement answer validation`).
2. Before you push, **you must run the validation gate locally**:
   ```bash
   npm run validate
   ```
   This will run the linter, format checker, and all unit tests. **If this fails, do not open a Pull Request.**

## 4. Pull Requests (Merge Requests)

Code is **only** merged into `master` via Pull Requests. Direct pushes to `master` are strictly prohibited.

### How to ask for a Merge Request

1. **Push your branch** to GitHub:
   ```bash
   git push origin <your-branch-name>
   ```
2. Navigate to the repository on GitHub and click **Compare & pull request**.
3. **Fill out the PR Template**: Link the PR to the relevant issue (e.g., "Fixes #12").
4. **Code Review**: You must request a review from at least one squad member. Wait for their approval.
5. **Merge**: Once approved and all tests pass, click **Squash and Merge**. This squashes all your branch's commits into a single clean commit on `master`.
6. **Clean up**: Delete your branch after merging.
