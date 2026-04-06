#!/usr/bin/env node
/**
 * clean.cjs — remove generated build artifacts, coverage, test results, and logs.
 *
 * IMPORTANT: Preserves hand-maintained files in dist/ (*.d.ts).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

// Extensions / suffixes to delete inside dist/
// (everything EXCEPT *.d.ts which is hand-maintained)
const DIST_DELETE_PATTERNS = [
  /\.js$/,
  /\.cjs$/,
  /\.mjs$/,
  /\.map$/,
  /\.css$/,
];

// Top-level dirs to delete entirely
const DELETE_DIRS = [
  'coverage',
  'test-results',
  'playwright-report',
  '.nyc_output',
];

// Top-level files to delete
const DELETE_FILES = [
  'RELEASE_NOTES.md',
  'changelog.md',
];

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  removed dir: ${path.relative(root, dir)}/`);
    return 1;
  }
  return 0;
}

function rmFile(file) {
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
    return 1;
  }
  return 0;
}

let removed = 0;

console.log('Cleaning quikdown build artifacts...\n');

// 1. Clean dist/ selectively (preserve .d.ts)
if (fs.existsSync(distDir)) {
  const entries = fs.readdirSync(distDir);
  let distCount = 0;
  for (const entry of entries) {
    // Never delete .d.ts — hand-maintained type definitions
    if (entry.endsWith('.d.ts')) continue;

    const full = path.join(distDir, entry);
    const stat = fs.statSync(full);

    if (stat.isFile()) {
      if (DIST_DELETE_PATTERNS.some((re) => re.test(entry))) {
        fs.rmSync(full, { force: true });
        distCount++;
      }
    } else if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
      distCount++;
    }
  }
  if (distCount > 0) {
    console.log(`  removed ${distCount} files from dist/ (preserved *.d.ts)`);
    removed += distCount;
  }
}

// 2. Clean top-level generated directories
for (const dir of DELETE_DIRS) {
  removed += rmDir(path.join(root, dir));
}

// 3. Clean top-level generated files
for (const file of DELETE_FILES) {
  if (rmFile(path.join(root, file))) {
    console.log(`  removed file: ${file}`);
    removed++;
  }
}

// 4. Clean the e2e server log if it exists
rmFile('/tmp/quikdown-e2e-server.log');

if (removed === 0) {
  console.log('Nothing to clean.');
} else {
  console.log(`\nDone. Removed ${removed} items.`);
}
