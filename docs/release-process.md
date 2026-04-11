# Release Process

## Overview

Releases are automated. When a commit lands on `main` with a new version in `package.json`, CI creates the git tag, publishes to npm, and creates a GitHub Release. You just need to bump the version, get the PR merged, and CI does the rest.

## Steps

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

# Build and test (also runs on commit via husky pre-commit hook)
npm run build
npm test
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
1. Runs tests again
2. Reads the version from `package.json`
3. Checks if that git tag already exists
4. If new: creates and pushes the `vX.Y.Z` tag
5. Publishes to npm (OIDC trusted publisher, no token needed)
6. Creates a GitHub Release with dist files attached

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

- **On PR:** runs the `build` job only (test + build verification)
- **On push to main:** runs `build`, then `publish` (conditional — only if the version tag is new)
- **Manual dispatch:** `publish.yml` can be triggered manually for retrying failed publishes

## Branch protection

- `main` requires the `build` status check to pass before merge
- Direct pushes to `main` are discouraged — use PRs
- `v*` tags are created by CI, not manually
