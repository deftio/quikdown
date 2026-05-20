#!/usr/bin/env node
/**
 * checkStandalone.cjs — gate for offline editor deliverables.
 *
 * Ensures quikdown_edit_standalone.* exists, is non-trivial size, and looks
 * like a self-contained browser bundle (no bare npm imports left by Rollup).
 * Run after `npm run build:standalone` or `npm run build:all`.
 *
 * Usage: npm run verify:standalone
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Minified bundles should stay in this band (~3.8 MB today). */
const MIN_MINIFIED_BYTES = 3_000_000;
const MAX_MINIFIED_BYTES = 5_500_000;

const ARTIFACTS = [
  'dist/quikdown_edit_standalone.esm.js',
  'dist/quikdown_edit_standalone.esm.min.js',
  'dist/quikdown_edit_standalone.umd.js',
  'dist/quikdown_edit_standalone.umd.min.js',
];

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function checkArtifacts() {
  for (const rel of ARTIFACTS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      fail(`missing ${rel}`);
      continue;
    }
    if (rel.includes('.min.')) {
      const size = fs.statSync(abs).size;
      if (size < MIN_MINIFIED_BYTES) {
        fail(`${rel} too small (${size} bytes; expected ${MIN_MINIFIED_BYTES}–${MAX_MINIFIED_BYTES})`);
      }
      if (size > MAX_MINIFIED_BYTES) {
        fail(`${rel} too large (${size} bytes; expected ${MIN_MINIFIED_BYTES}–${MAX_MINIFIED_BYTES})`);
      }
    }
  }
}

/** Rollup leaves bare `import … from "pkg"` when a dep is missing from node_modules. */
function checkNoBareImports() {
  const esmMin = path.join(ROOT, 'dist/quikdown_edit_standalone.esm.min.js');
  if (!fs.existsSync(esmMin)) return;

  const head = fs.readFileSync(esmMin, 'utf8').slice(0, 4096);
  if (/^import\s+.+\s+from\s+["'](?!\.|\/)/m.test(head)) {
    fail(
      'standalone ESM has unresolved bare npm imports at file head ' +
      '(ensure highlight.js and other fence deps are in devDependencies, then rebuild)'
    );
  }
}

function checkUmdGlobal() {
  const umdMin = path.join(ROOT, 'dist/quikdown_edit_standalone.umd.min.js');
  if (!fs.existsSync(umdMin)) return;

  const content = fs.readFileSync(umdMin, 'utf8');
  if (!content.includes('QuikdownEditor')) {
    fail('standalone UMD missing QuikdownEditor global name');
  }
}

function main() {
  checkArtifacts();
  checkNoBareImports();
  checkUmdGlobal();

  if (errors.length) {
    console.error('checkStandalone FAILED:');
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('\nRun: npm run build:standalone  (or npm run build:all)\n');
    process.exit(1);
  }

  console.log('checkStandalone OK');
}

main();
