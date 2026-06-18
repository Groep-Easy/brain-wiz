# Git & GitHub Workflow

We use a monorepo at [Groep-Easy/brain-wiz](https://github.com/Groep-Easy/brain-wiz).
All production code lives in **`master`**, all integration work in **`develop`**.
Direct pushes to either branch are **strictly prohibited**.

---

## 1. Project Management

| Tool | Purpose |
|------|---------|
| [Scrumboard](https://github.com/orgs/Groep-Easy/projects/2) | Active sprints, tasks, progress |
| [Issues](https://github.com/Groep-Easy/brain-wiz/issues) | Bug reports & feature definitions |
| [Pull Requests](https://github.com/Groep-Easy/brain-wiz/pulls) | All merge proposals |

**Claim an issue before you start work.** Assign it to yourself.

---

## 2. Branch Strategy

```
master          ← production only (protected, requires PR + review)
  └─ develop    ← integration branch (protected, requires PR + review)
       ├─ feat/your-feature
       ├─ fix/your-bug
       └─ chore/your-task
```

### Branch naming

| Prefix | When to use | Example |
|--------|-------------|---------|
| `feat/` | New functionality | `feat/round-timer` |
| `fix/` | Bug fixes | `fix/ws-reconnect` |
| `chore/` | Docs, config, tooling | `chore/update-deps` |
| `refactor/` | Code restructuring, no behaviour change | `refactor/socket-handler` |
| `err/` | CI/pipeline error repairs | `err/lint-strict` |

---

## 3. Starting New Work (the daily routine)

```bash
# 1. Make sure you are on develop and it is up to date
git switch develop
git pull --rebase origin develop

# 2. Create your feature branch from develop
git checkout -b feat/my-feature

# 3. Work, commit often with descriptive messages
git add .
git commit -m "feat(host): add countdown overlay to question screen"

# 4. Stay current with develop to avoid painful conflicts later
#    Do this at least once per day if the branch lives long
git fetch origin
git rebase origin/develop
```

---

## 4. Full Rebuild & Validation Gate

Before opening any Pull Request you **must** run the full validation locally.
CI runs exactly the same commands — if it fails locally it will fail in CI.

```bash
# Install / sync all workspace dependencies
npm install

# Run linter across all workspaces + tests/ directory
npm run lint

# Run type-checker across all workspaces
npm run typecheck        # (if available) or: npx tsc --noEmit

# Run the complete validation gate (lint + typecheck + unit tests)
npm run validate
```

> **Rule:** If `npm run validate` fails, **do not open a Pull Request**.
> Fix all errors first, then push.

### Common lint errors and how to fix them

| Error | Cause | Fix |
|-------|-------|-----|
| `no-unnecessary-type-assertion` | `as unknown as T` when `data` is already `unknown` or `Record<string, unknown>` | Remove the intermediate `as unknown`; cast directly: `data as T` |
| `@typescript-eslint/no-explicit-any` | Using `any` type | Use the specific type or `unknown` with a guard |
| `no-console` outside allowed files | `console.log` in production code | Remove or wrap with a `// eslint-disable-next-line no-console` + comment justification |
| `no-alert` | Native `alert()`/`confirm()` | Add `// eslint-disable-next-line no-alert -- intentional native dialog` on the line above |

Run lint with auto-fix for safe fixable issues:

```bash
npm run lint -- --fix
```

---

## 5. Merging develop into your branch (sync before PR)

Always rebase your branch on top of `develop` before requesting a review.
This keeps history linear and avoids merge commits on feature branches.

```bash
# While on your feature branch:
git fetch origin
git rebase origin/develop

# If there are conflicts, resolve them file-by-file:
#   1. Edit the conflicting file, remove conflict markers
#   2. git add <resolved-file>
#   3. git rebase --continue
# To abort and start over: git rebase --abort

# Force-push the rebased branch (safe on feature branches only!)
git push --force-with-lease origin feat/my-feature
```

> ⚠️ **Never force-push `develop` or `master`.**

---

## 6. Full Merge: develop → your branch → PR → develop

This is the canonical flow to bring your work into `develop`.

```bash
# Step 1: Sync develop locally
git switch develop
git pull --rebase origin develop

# Step 2: Switch back to your branch and rebase onto develop
git switch feat/my-feature
git rebase origin/develop

# Step 3: Run the full validation gate
npm install           # Ensure deps are consistent after rebase
npm run validate      # Must pass with 0 errors

# Step 4: Push your branch
git push --force-with-lease origin feat/my-feature

# Step 5: Open a Pull Request on GitHub
#   Base: develop
#   Compare: feat/my-feature
#   Link to issue: "Closes #<issue-number>"
#   Request review from at least one squad member
```

---

## 7. Full Merge: develop → master (release)

Only a tech lead or designated reviewer may merge `develop` into `master`.

```bash
# Never do this locally. Use a PR:
#   Base: master
#   Compare: develop
#   Squash-and-merge is preferred to keep history clean
```

---

## 8. Pull Request Checklist

Before clicking **Create Pull Request**:

- [ ] Branch is rebased on top of `develop` (no stale conflicts)
- [ ] `npm run validate` passes locally with **0 errors, 0 warnings** (or only allowed warnings)
- [ ] All new code has types — no `any`, no `as unknown as T` chains
- [ ] PR description links to the relevant issue (`Closes #XX`)
- [ ] PR is **small and focused** — one feature/fix per PR
- [ ] Reviewer is assigned

---

## 9. After Merge

```bash
# Switch back to develop and pull the freshly merged work
git switch develop
git pull --rebase origin develop

# Delete your local feature branch
git branch -d feat/my-feature

# Prune stale remote-tracking references
git fetch --all --prune
```

---

## 10. Keeping your local clone clean

```bash
# See what remote branches were deleted
git remote prune origin --dry-run

# Actually prune them
git fetch --all --prune

# Delete all local branches that are fully merged into develop
git branch --merged develop | grep -v '^\*\|develop\|master' | xargs git branch -d
```

---

## 11. Quick Reference

```bash
# Start new work
git switch develop && git pull --rebase origin develop
git checkout -b feat/<name>

# Stay up to date
git fetch origin && git rebase origin/develop

# Validate before pushing
npm run validate

# Push and open PR
git push --force-with-lease origin feat/<name>
# → GitHub → New pull request → Base: develop

# After PR merged: clean up
git switch develop && git pull --rebase origin develop
git branch -d feat/<name> && git fetch --all --prune
```
