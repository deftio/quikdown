# Release 1.2.4 — CI and badge fixes

## CI / Workflow
- [x] Merge tag+publish into single ci.yml workflow (fixes GITHUB_TOKEN tag limitation)
- [x] publish.yml now manual-only (retry failed publishes)
- [x] Branch protection on main (require build status check)
- [x] Upgrade CI to Node.js 22.x (fixes Node 20 deprecation warning)
- [ ] Tag protection for v* (requires GitHub Pro/Team — skipped)
- [ ] Verify ci.yml publish job works end-to-end on merge to main

## Badges (README.md)
- [x] Coverage badge — static shield updated by updateBadges.js on every `npm test`, now 95.3%
- [x] Bundle size badge — static shield updated by updateBadges.js, now 9.3KB
- [x] Bundlephobia link — works (https://bundlephobia.com/package/quikdown returns 200)
- [x] All badge URLs verified rendering correctly

## Actions version upgrades
- [x] actions/checkout@v4 — still works on Node 22 (no update needed yet, deadline June 2026)
- [x] actions/setup-node@v4 — same
- [x] softprops/action-gh-release@v2 — current

## README.md content
- [x] Fix features section — now describes regex-based parser, bidirectional, editor, fence plugins accurately
- [x] Fix zero-deps claim — scoped to parser/bd; editor notes lazy-loaded fence libs
- [x] Reorder features list for clarity
- [x] Add screenshot of split-view editor to README
- [x] Links updated: Try Editor, Examples, Frameworks, Downloads, Docs

## Version bump
- [x] Bump package.json to 1.2.4
- [ ] Update release-notes.md with 1.2.4 entry
- [x] Final test run — 1440 passed
- [ ] Merge to main → auto-publish
