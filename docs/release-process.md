# Release Process

## Overview

Releases are automated. When a commit lands on `main` with a new version in `package.json`, CI creates the git tag, publishes to npm, and creates a GitHub Release. You just need to bump the version, get it onto main, and CI does the rest.

There are two ways to release:

- **`npm run release`** — guided script that runs preflight checks, squash-merges your feature branch into main, and pushes. One command, fully automated. Best for solo maintainers.
- **Manual PR workflow** — push the branch, create a PR via `gh pr create`, wait for CI, merge via `gh pr merge`. Better for teams or when you want a review step.

Both end the same way: a push to main triggers CI which handles tagging and publishing.

## Option A: `npm run release`

From your feature branch with everything committed:

```bash
npm run release
```

The script will:
1. Verify you're on a feature branch (not main)
2. Check for clean working tree
3. Run **`build:all`** (core + **standalone offline editor**)
4. Run **`verify:release`** (npm pack + standalone size/import checks)
5. Run **`test:standalone:e2e`** (Playwright smoke on the bundled editor)
6. Build **`quikdown-airgap-vX.Y.Z.zip`**
7. Run unit tests (`npm test`)
8. Auto-commit any badge/dist drift (including standalone bundles)
9. Squash-merge into main and push

**Normal dev / pre-commit does not build standalone.** Husky runs `lint` + `npm test` only. The ~60s standalone Rollup step runs here, in publish CI, and when you explicitly run `build:standalone`.

CI takes over from there.

## Option B: Manual PR workflow

### 1. Create a feature branch

```bash
git checkout main
git pull
git checkout -b feature/your-change-name
```

### 2. Make changes, bump version

```bash
# Make your changes, then bump the version
npm version patch --no-git-tag-version   # or minor / major

# Day-to-day dev (no standalone build)
npm run build
npm test

# Before release (or let `npm run release` do it)
npm run build:all
npm run verify:release
npm run test:standalone:e2e
```

### 3. Commit

```bash
git add -A
git commit -m "v1.2.5: description of changes"
```

The pre-commit hook runs `npm run lint` and `npm test` automatically. If either fails, the commit is blocked — fix the issue and try again.

### 4. Push and create a PR

```bash
git push -u origin feature/your-change-name

gh pr create \
  --title "v1.2.5: short description" \
  --body "- change 1
- change 2
- change 3"
```

### 5. Wait for CI, then merge

CI runs the `build` job (lint, test, build verification). Branch protection requires this to pass.

```bash
# Check CI status
gh pr checks

# Merge when green
gh pr merge --squash
```

### 6. CI handles the rest

After merge to main, CI automatically:
1. Runs normal **`build`** + tests on the PR (no standalone — fast loop)
2. On version bump: tags and triggers **`publish.yml`**
3. **Publish workflow** runs **`build:all`**, **`verify:release`**, standalone Playwright smoke, unit tests, npm publish
4. **GitHub Release** attaches standalone `.min.js`, `.gz`, and **`quikdown-airgap-vX.Y.Z.zip`**

### 7. Verify

```bash
# Check the release appeared
gh release list --limit 3

# Check npm
npm view quikdown version
```

## If something goes wrong

### Publish job failed after tagging

The tag exists but npm/GitHub Release didn't happen. Use the manual fallback:

```bash
gh workflow run publish.yml -f tag=v1.2.5
```

### Pre-commit hook is too slow

The hook runs full lint + tests. This is intentional — it prevents broken commits. If you need to bypass it temporarily (not recommended):

```bash
git commit --no-verify -m "wip: temporary"
```

### Version already exists on npm

`tools/checkVersion.cjs` catches this before tagging. Bump to the next version and try again.

## What CI does (detail)

| When | What runs |
|------|-----------|
| **PR / push (ci.yml)** | `npm run build`, `npm test`, core dist smoke checks — **no standalone** |
| **Pre-commit (husky)** | `lint`, `npm test` — **no standalone** |
| **`npm run release` (local)** | `build:all`, `verify:release`, `test:standalone:e2e`, air-gap zip, `npm test` |
| **publish.yml** | Same release gates + npm publish + GitHub Release assets |

### Standalone (offline) editor

The **`quikdown_edit_standalone`** bundle (~3.8 MB) ships on every release for air-gapped deployments. It is **not** part of the normal debug cycle.

| Check | Command |
|-------|---------|
| Build | `npm run build:standalone` or `npm run build:all` |
| Verify (size, self-contained, npm pack) | `npm run verify:release` |
| Browser smoke | `npm run test:standalone:e2e` |
| Air-gap zip | `npm run build:airgap` |
| Docs | `docs/standalone-editor.md` |

## Branch protection

- `main` requires the `build` status check to pass before merge
- Direct pushes to `main` are discouraged — use PRs
- `v*` tags are created by CI, not manually
