#!/usr/bin/env node
/**
 * checkStandalone.cjs — gate for offline editor deliverables.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Minified JS bundle band (MathJax + Vega + Mermaid, no basemap inlined). */
const MIN_MINIFIED_BYTES = 6_000_000;
const MAX_MINIFIED_BYTES = 9_000_000;

/** JS min + both basemap TopoJSON files (uncompressed) — airgap "app core". */
const MAX_OFFLINE_CORE_BYTES = 9_000_000;

const ARTIFACTS = [
  'dist/quikdown_edit_standalone.esm.js',
  'dist/quikdown_edit_standalone.esm.min.js',
  'dist/quikdown_edit_standalone.umd.js',
  'dist/quikdown_edit_standalone.umd.min.js',
  'dist/basemap_countries_110m.topojson',
  'dist/basemap_admin1_lines.topojson',
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

function checkOfflineCoreSize() {
  const js = path.join(ROOT, 'dist/quikdown_edit_standalone.esm.min.js');
  const c1 = path.join(ROOT, 'dist/basemap_countries_110m.topojson');
  const c2 = path.join(ROOT, 'dist/basemap_admin1_lines.topojson');
  if (!fs.existsSync(js) || !fs.existsSync(c1) || !fs.existsSync(c2)) return;

  const total = fs.statSync(js).size + fs.statSync(c1).size + fs.statSync(c2).size;
  if (total > MAX_OFFLINE_CORE_BYTES) {
    fail(
      `offline core too large (${total} bytes; JS + basemap must stay ≤ ${MAX_OFFLINE_CORE_BYTES} — tighten buildBasemap simplification or shrink JS bundle)`
    );
  }
}

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
  checkOfflineCoreSize();
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
