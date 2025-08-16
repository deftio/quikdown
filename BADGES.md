# Badge Options for quikdown

Here are various badge options you can use in the README. Choose the ones that best fit your needs.

## Current Badges (Static)

```markdown
[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage Status](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)](https://github.com/deftio/quikdown)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/badge/minified-8.7KB-green.svg)](https://github.com/deftio/quikdown/tree/main/dist)
```

## Alternative Dynamic Badges (shields.io)

### NPM Related
```markdown
<!-- NPM version -->
[![npm](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)

<!-- NPM downloads -->
[![npm downloads](https://img.shields.io/npm/dm/quikdown.svg)](https://www.npmjs.com/package/quikdown)

<!-- NPM license -->
[![NPM License](https://img.shields.io/npm/l/quikdown.svg)](https://www.npmjs.com/package/quikdown)
```

### GitHub Related
```markdown
<!-- GitHub stars -->
[![GitHub stars](https://img.shields.io/github/stars/deftio/quikdown.svg?style=social)](https://github.com/deftio/quikdown)

<!-- GitHub issues -->
[![GitHub issues](https://img.shields.io/github/issues/deftio/quikdown.svg)](https://github.com/deftio/quikdown/issues)

<!-- GitHub last commit -->
[![GitHub last commit](https://img.shields.io/github/last-commit/deftio/quikdown.svg)](https://github.com/deftio/quikdown)
```

### Code Quality
```markdown
<!-- Codecov -->
[![codecov](https://codecov.io/gh/deftio/quikdown/branch/main/graph/badge.svg)](https://codecov.io/gh/deftio/quikdown)

<!-- Code Climate maintainability -->
[![Maintainability](https://api.codeclimate.com/v1/badges/YOUR_BADGE_ID/maintainability)](https://codeclimate.com/github/deftio/quikdown/maintainability)
```

### Bundle Size (Dynamic)
```markdown
<!-- Bundlephobia -->
[![Bundle Size](https://img.shields.io/bundlephobia/min/quikdown)](https://bundlephobia.com/package/quikdown)
[![Bundle Size (gzip)](https://img.shields.io/bundlephobia/minzip/quikdown)](https://bundlephobia.com/package/quikdown)
```

### Build Status
```markdown
<!-- GitHub Actions -->
[![Build Status](https://github.com/deftio/quikdown/workflows/CI/badge.svg)](https://github.com/deftio/quikdown/actions)

<!-- With branch -->
[![Build Status](https://github.com/deftio/quikdown/workflows/CI/badge.svg?branch=main)](https://github.com/deftio/quikdown/actions)
```

## Minimal Set (Recommended)

```markdown
[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)](https://github.com/deftio/quikdown)
[![License](https://img.shields.io/npm/l/quikdown.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/quikdown)](https://bundlephobia.com/package/quikdown)
```

## Notes

- The CI badge will show real-time build status once the GitHub Actions workflow runs
- NPM badges will work after the package is published to NPM
- Codecov badge requires setting up Codecov integration
- Bundlephobia badges will show accurate size after NPM publication
- shields.io badges update automatically based on the source data