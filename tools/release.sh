#!/usr/bin/env bash
#
# release.sh — preflight checks, merge feature branch to main, push.
# CI handles tagging and publishing automatically after push.
#
# Usage:
#   npm run release
#
# Run this from your feature branch when you're ready to ship.
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

die()  { echo -e "${RED}ERROR: $*${NC}" >&2; exit 1; }
info() { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }

# --- preflight ---------------------------------------------------------------

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Must NOT be on main (you release FROM a feature branch)
[ "$BRANCH" != "main" ] || die "Must be on a feature branch, not main.\n  The release script merges your feature branch into main."

# Clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Working tree is dirty. Commit or stash changes first."
fi

# --- read version ------------------------------------------------------------

VERSION=$(node -p "require('./package.json').version")
[ -n "$VERSION" ] || die "Could not read version from package.json"
TAG="v${VERSION}"

info "Branch:  $BRANCH"
info "Version: $VERSION"
info "Tag:     $TAG"
echo ""

# --- check version is new ----------------------------------------------------

info "=== Checking version ==="
node tools/checkVersion.cjs || die "Version check failed. Bump the version before releasing."
echo ""

# --- run quality gates -------------------------------------------------------

info "=== Running tests ==="
npm test || die "Tests failed. Fix failures before releasing."
echo ""

info "=== Running build ==="
npm run build || die "Build failed. Fix errors before releasing."
echo ""

# --- capture any badge/docs/dist drift and commit it before releasing -------
# `npm test` and `npm run build` regenerate README.md badges, dist files, and
# the root index.html (from buildDocs). If anything changed, commit it to the
# feature branch so the squash-merge includes it.

if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Build/test produced uncommitted changes (badges, docs, dist)."
  warn "Committing them to '$BRANCH' before squash-merging."
  git add -A
  git commit -m "chore: refresh badges, dist, and docs for ${TAG}" || die "Auto-commit of drift failed."
  echo ""
fi

# --- show summary ------------------------------------------------------------

COMMIT_COUNT=$(git rev-list --count main..HEAD 2>/dev/null || echo "?")
info "=== Preflight passed ==="
info "  Branch:  $BRANCH"
info "  Version: $VERSION ($TAG)"
info "  Commits: $COMMIT_COUNT since main"
echo ""

warn "This will:"
warn "  1. Push $BRANCH to origin"
warn "  2. Create a PR to main"
warn "  3. Auto-merge after CI passes (squash)"
warn "  4. CI will auto-tag $TAG and publish to npm"
echo ""

read -r -p "Proceed? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# --- push branch and create PR -----------------------------------------------

info "\nPushing $BRANCH to origin..."
git push -u origin "$BRANCH" || die "Push failed."

info "\nCreating PR..."
PR_URL=$(gh pr create \
  --title "release ${TAG}" \
  --body "Automated release from \`${BRANCH}\`.

## Changes
$(git log --oneline main..HEAD | sed 's/^/- /')" \
  2>&1) || die "PR creation failed: $PR_URL"

info "PR created: $PR_URL"

info "\nEnabling auto-merge (squash)..."
gh pr merge --squash --auto || warn "Auto-merge not available — merge manually after CI passes."

info "\n=== Release $TAG submitted ==="
info "CI will run on the PR. After merge, CI will:"
info "  1. Create tag $TAG"
info "  2. Publish to npm with provenance"
info "  3. Create GitHub Release"
echo ""
info "Monitor at:"
echo "  $PR_URL"
echo "  https://github.com/deftio/quikdown/actions"
