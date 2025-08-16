# Release Guide for quikdown

This guide explains how to create releases for quikdown.

## Quick Start

### Option 1: Full Automated Release (Recommended)

```bash
# Create release with current version
npm run release

# Or bump version and release
npm run release:patch  # 2.0.0 -> 2.0.1
npm run release:minor  # 2.0.0 -> 2.1.0  
npm run release:major  # 2.0.0 -> 3.0.0
```

This will:
1. Check for uncommitted changes
2. Bump version (if specified)
3. Build the project
4. Run tests
5. Create git tag
6. Push to GitHub
7. Create GitHub release (if `gh` CLI is installed)
8. Upload distribution files

### Option 2: Simple Tag Creation

```bash
# Just create a tag from current version
npm run tag
```

Then manually:
1. Push the tag: `git push origin v2.0.0`
2. Create release on GitHub: https://github.com/deftio/quikdown/releases/new

### Option 3: Manual Process

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Update version in source
npm run updateVersion

# 3. Build
npm run build

# 4. Test
npm test

# 5. Commit
git add -A
git commit -m "chore: bump version to 2.0.1"

# 6. Create tag
git tag -a v2.0.1 -m "Release v2.0.1"

# 7. Push
git push
git push origin v2.0.1

# 8. Create release on GitHub
# Visit: https://github.com/deftio/quikdown/releases/new
```

## Prerequisites

### Required
- Node.js 16+
- Git configured with push access to the repository
- Clean working directory (no uncommitted changes)

### Optional but Recommended
- [GitHub CLI](https://cli.github.com/) (`gh`) for automated releases
  ```bash
  # Install GitHub CLI
  brew install gh  # macOS
  # or
  npm install -g gh
  
  # Authenticate
  gh auth login
  ```

## Release Checklist

Before releasing, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Build works (`npm run build`)
- [ ] Bundle size is under 10KB
- [ ] README is up to date
- [ ] CHANGELOG is updated (if maintaining one)
- [ ] Version number makes sense (follow semver)

## Version Numbering (Semantic Versioning)

- **Patch** (2.0.0 → 2.0.1): Bug fixes, tiny improvements
- **Minor** (2.0.0 → 2.1.0): New features, backwards compatible
- **Major** (2.0.0 → 3.0.0): Breaking changes

## Publishing to NPM

After creating a GitHub release:

```bash
# Ensure you're logged in to NPM
npm login

# Publish
npm publish

# Or use the GitHub Action (automatic on release)
# Requires NPM_TOKEN secret in GitHub repository settings
```

## Troubleshooting

### Tag already exists
```bash
# Delete local tag
git tag -d v2.0.0

# Delete remote tag
git push --delete origin v2.0.0
```

### Uncommitted changes
```bash
# Stash changes
git stash

# Create release
npm run release

# Restore changes
git stash pop
```

### GitHub CLI not working
1. Install: `brew install gh` or `npm install -g gh`
2. Authenticate: `gh auth login`
3. Check status: `gh auth status`

## GitHub Actions

The following workflows are triggered automatically:

- **CI** (`ci.yml`): On every push and PR
- **NPM Publish** (`npm-publish.yml`): On release creation
- **Release** (`release.yml`): On version tags (v*)

## Files Included in Release

The release includes:
- `dist/quikdown.umd.min.js` - Browser build (minified)
- `dist/quikdown.esm.min.js` - ES Module build (minified)
- `dist/quikdown.cjs` - CommonJS build

## Release Notes Template

The automated script generates release notes with:
- Installation instructions
- Bundle sizes
- Recent commits
- Feature highlights

You can edit the release on GitHub after creation to add more details.

## Questions?

Open an issue: https://github.com/deftio/quikdown/issues