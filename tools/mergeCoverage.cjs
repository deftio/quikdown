#!/usr/bin/env node
/**
 * mergeCoverage.cjs
 *
 * Merges Jest's Istanbul coverage (coverage/coverage-final.json) with
 * Playwright's Istanbul coverage (coverage/e2e-coverage.json) and
 * outputs:
 *   coverage/merged-coverage.json  — combined Istanbul JSON
 *   stdout                          — text-summary report
 *
 * Uses istanbul-lib-coverage and istanbul-reports (transitive deps of
 * Jest / babel-plugin-istanbul already in node_modules).
 *
 * Usage:
 *   node tools/mergeCoverage.cjs
 *   npm run coverage:merge
 */

const fs = require('fs');
const path = require('path');

const JEST_COV    = path.resolve(__dirname, '../coverage/coverage-final.json');
const E2E_COV     = path.resolve(__dirname, '../coverage/e2e-coverage.json');
const MERGED_OUT  = path.resolve(__dirname, '../coverage/merged-coverage.json');

// ── Load Istanbul libs ────────────────────────────────────────────────

let libCoverage, libReport, reports;
try {
  libCoverage = require('istanbul-lib-coverage');
  libReport   = require('istanbul-lib-report');
  reports     = require('istanbul-reports');
} catch (err) {
  console.error('Missing istanbul-lib-coverage / istanbul-lib-report / istanbul-reports.');
  console.error('These should be available as transitive deps of Jest.');
  console.error(err.message);
  process.exit(1);
}

// ── Read coverage files ───────────────────────────────────────────────

const map = libCoverage.createCoverageMap({});

let jestLoaded = false;
let e2eLoaded  = false;

if (fs.existsSync(JEST_COV)) {
  try {
    const jestData = JSON.parse(fs.readFileSync(JEST_COV, 'utf-8'));
    map.merge(jestData);
    jestLoaded = true;
    console.log(`✔ Loaded Jest coverage:       ${JEST_COV}`);
    console.log(`  Files: ${Object.keys(jestData).length}`);
  } catch (err) {
    console.warn(`⚠ Could not parse Jest coverage: ${err.message}`);
  }
} else {
  console.warn(`⚠ Jest coverage not found: ${JEST_COV}`);
  console.warn('  Run "npm test" first to generate Jest coverage.');
}

if (fs.existsSync(E2E_COV)) {
  try {
    const e2eData = JSON.parse(fs.readFileSync(E2E_COV, 'utf-8'));
    map.merge(e2eData);
    e2eLoaded = true;
    console.log(`✔ Loaded Playwright coverage: ${E2E_COV}`);
    console.log(`  Files: ${Object.keys(e2eData).length}`);
  } catch (err) {
    console.warn(`⚠ Could not parse Playwright coverage: ${err.message}`);
  }
} else {
  console.warn(`⚠ Playwright coverage not found: ${E2E_COV}`);
  console.warn('  Run "npm run test:e2e:coverage" first.');
}

if (!jestLoaded && !e2eLoaded) {
  console.error('\n✘ No coverage data found. Nothing to merge.');
  process.exit(1);
}

// ── Write merged JSON ─────────────────────────────────────────────────

fs.mkdirSync(path.dirname(MERGED_OUT), { recursive: true });
fs.writeFileSync(MERGED_OUT, JSON.stringify(map.toJSON(), null, 2));
console.log(`\n✔ Merged coverage written to: ${MERGED_OUT}`);
console.log(`  Total files: ${map.files().length}`);

// ── Print text summary ────────────────────────────────────────────────

console.log('\n─── Merged Coverage Summary ───\n');

const context = libReport.createContext({
  dir: path.resolve(__dirname, '../coverage'),
  coverageMap: map,
  defaultSummarizer: 'nested',
});

const summary = reports.create('text-summary', {});
summary.execute(context);

// Also generate the detailed per-file text report
console.log('\n─── Per-File Coverage ───\n');
const detail = reports.create('text', {});
detail.execute(context);
