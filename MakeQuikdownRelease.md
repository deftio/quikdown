# Release Guide for quikdown

## Release Flow Overview

```
npm run feature "my-feature"   →  creates feature branch, bumps version
  ... work, commit, repeat ...
npm run release                →  preflight, squash-merge to main, push
  CI auto-tags, publishes to npm, creates GitHub Release
```

## Starting a Feature

From `main`, create a feature branch with automatic version bump:

```bash
npm run feature "add-cool-thing"          # patch bump (default): 1.2.0 → 1.2.1
npm run feature "add-cool-thing" minor    # minor bump: 1.2.0 → 1.3.0
npm run feature "add-cool-thing" major    # major bump: 1.2.0 → 2.0.0
```

This will:
1. Pull latest `main` from origin
2. Create branch `feature/add-cool-thing`
3. Bump version in `package.json` and `src/quikdown_version.js`
4. Commit the version bump

Now work normally — commit as often as you like on the feature branch.

## Releasing

When ready, from your feature branch:

```bash
npm run release
```

This will:
1. Verify you're on a feature branch (not main)
2. Verify working tree is clean
3. Check version was bumped (compares against published npm version)
4. Run `npm test` (must pass)
5. Run `npm run build` (must succeed)
6. Show summary and ask for confirmation
7. Switch to `main`, pull latest, squash-merge your branch
8. Push `main` to origin

**After push, CI takes over:**
1. `ci.yml` runs tests + build on `main`
2. If green, CI creates git tag `vX.Y.Z`
3. Tag push triggers `publish.yml`
4. `publish.yml` publishes to npm with provenance + creates GitHub Release

## Manual / Legacy Options

### Tag-only (skip CI auto-tag)
```bash
npm run tag                # creates annotated tag from package.json version
git push origin v1.2.1     # push the tag — triggers publish.yml
```

### Legacy release script (pre-CI flow)
```bash
npm run release:legacy         # builds, tests, tags, pushes, creates GH release locally
npm run release:legacy patch   # bumps patch first
```

## Prerequisites

- Node.js 20+
- Git with push access to the repository
- Clean working directory
- For npm publish: `NPM_TOKEN` secret configured in GitHub repo settings
- Optional: [GitHub CLI](https://cli.github.com/) (`gh`) for the legacy release script

## CI/CD Pipeline

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Push to `main`, PRs | Test, build, verify dist files, upload coverage to Codecov, auto-tag |
| `publish.yml` | Tag push `v*` | Publish to npm with provenance, create GitHub Release with dist artifacts |

## Version Numbering (Semantic Versioning)

- **Patch** (1.2.0 → 1.2.1): Bug fixes, documentation
- **Minor** (1.2.0 → 1.3.0): New features, backwards compatible
- **Major** (1.2.0 → 2.0.0): Breaking changes

## Pre-commit Hooks

Husky runs `npm test` before every commit. If tests fail, the commit is blocked.

To bypass in an emergency: `git commit --no-verify` (not recommended).

## Troubleshooting

### Tag already exists
```bash
git tag -d v1.2.1                    # delete local
git push --delete origin v1.2.1     # delete remote
```

### Version check fails
The version in `package.json` matches what's already on npm. Use `npm run feature` to auto-bump, or manually:
```bash
npm version patch --no-git-tag-version
npm run updateVersion
```

### CI tag job didn't run
The `tag-version` job only runs on direct pushes to `main` (not PRs). Verify the push landed on `main`.

## Files Included in Releases

GitHub Release artifacts:
- `dist/quikdown.umd.min.js` — Browser build (minified)
- `dist/quikdown.esm.min.js` — ES Module build (minified)
- `dist/quikdown.cjs` — CommonJS build
- `dist/quikdown_bd.umd.min.js` — Bidirectional module
- `dist/quikdown_bd.esm.min.js`
- `dist/quikdown_edit.umd.min.js` — Editor module
- `dist/quikdown.light.min.css` — Light theme
- `dist/quikdown.dark.min.css` — Dark theme

npm package: everything in `dist/` (per `files` field in package.json).

## Questions?

Open an issue: https://github.com/deftio/quikdown/issues
