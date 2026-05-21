#!/usr/bin/env node
/**
 * verifyPackage.cjs — pre-publish / release gate for npm package completeness.
 *
 * Usage:
 *   npm run build && npm run verify:package          # core only (dev / PR CI)
 *   npm run build:all && npm run verify:release      # release: + standalone + npm pack
 *
 * Exit 0 = pass. Exit 1 = actionable failure.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const releaseMode = process.argv.includes('--release');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const errors = [];
const warnings = [];
const passed = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function ok(msg) {
  passed.push(msg);
}

function resolvePath(relativePath) {
  return path.join(ROOT, relativePath.replace(/^\.\//, ''));
}

function fileMustExist(relativePath, label) {
  const abs = resolvePath(relativePath);
  if (!fs.existsSync(abs)) {
    fail(`${label}: missing file ${relativePath}`);
    return false;
  }
  ok(`${label}: ${relativePath}`);
  return true;
}

function checkMainEntrypoints() {
  console.log('\n── Main entrypoints ──');
  if (pkg.main) fileMustExist(pkg.main, 'main');
  if (pkg.module) fileMustExist(pkg.module, 'module');
  if (pkg.types) fileMustExist(pkg.types, 'types (root)');
  if (pkg.browser) fileMustExist(pkg.browser, 'browser');
}

function checkExportsMap() {
  console.log('\n── package.json exports ──');
  const exportsMap = pkg.exports || {};

  for (const [subpath, conditions] of Object.entries(exportsMap)) {
    if (subpath === './package.json') continue;
    if (typeof conditions !== 'object' || conditions === null) continue;

    const label = `exports["${subpath}"]`;

    for (const [, target] of Object.entries(conditions)) {
      if (typeof target !== 'string') continue;
      fileMustExist(target, `${label}`);
    }
  }
}

function checkCoreDistBundles() {
  console.log('\n── Core dist bundles (smoke) ──');
  const bundles = [
    'dist/quikdown.esm.js',
    'dist/quikdown.cjs',
    'dist/quikdown_bd.esm.js',
    'dist/quikdown_edit.esm.js',
    'dist/quikdown_ast.esm.js',
    'dist/quikdown_json.esm.js',
    'dist/quikdown_yaml.esm.js',
    'dist/quikdown_ast_html.esm.js',
  ];
  for (const f of bundles) {
    fileMustExist(f, 'bundle');
  }
}

function checkTypeScriptDefinitions() {
  console.log('\n── TypeScript definitions ──');
  const expected = [
    'dist/quikdown.d.ts',
    'dist/quikdown_bd.d.ts',
    'dist/quikdown_edit.d.ts',
    'dist/quikdown_ast.d.ts',
    'dist/quikdown_json.d.ts',
    'dist/quikdown_yaml.d.ts',
    'dist/quikdown_ast_html.d.ts',
  ];
  for (const f of expected) {
    fileMustExist(f, 'types');
  }
}

function checkStandaloneBundle() {
  console.log('\n── Standalone editor bundle (offline / air-gapped) ──');
  const required = [
    'dist/quikdown_edit_standalone.esm.js',
    'dist/quikdown_edit_standalone.esm.min.js',
    'dist/quikdown_edit_standalone.umd.js',
    'dist/quikdown_edit_standalone.umd.min.js',
  ];
  for (const f of required) {
    fileMustExist(f, 'standalone');
  }
}

function collectExportTargets() {
  const targets = new Set(['package.json']);
  if (pkg.main) targets.add(pkg.main.replace(/^\.\//, ''));
  if (pkg.module) targets.add(pkg.module.replace(/^\.\//, ''));
  if (pkg.types) targets.add(pkg.types.replace(/^\.\//, ''));
  if (pkg.browser) targets.add(pkg.browser.replace(/^\.\//, ''));

  for (const conditions of Object.values(pkg.exports || {})) {
    if (typeof conditions !== 'object' || conditions === null) continue;
    for (const target of Object.values(conditions)) {
      if (typeof target === 'string') targets.add(target.replace(/^\.\//, ''));
    }
  }
  return [...targets];
}

function checkNpmPackContents() {
  console.log('\n── npm pack dry-run ──');

  let output;
  try {
    output = execSync('npm pack --dry-run --ignore-scripts 2>&1', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    fail(`npm pack --dry-run failed: ${err.message}`);
    return;
  }

  const packed = new Set();
  for (const line of output.split('\n')) {
    const match = line.match(/^npm notice\s+\S+\s+(dist\/\S+|package\.json)/);
    if (match) packed.add(match[1]);
  }

  if (!packed.size) {
    fail('npm pack dry-run produced no file list (unexpected npm output format)');
    return;
  }

  const required = collectExportTargets();
  if (releaseMode) {
    required.push(
      'dist/quikdown_edit_standalone.esm.min.js',
      'dist/quikdown_edit_standalone.umd.min.js'
    );
  }

  for (const rel of required) {
    if (packed.has(rel)) {
      ok(`npm pack includes ${rel}`);
    } else {
      fail(`npm pack tarball missing ${rel}`);
    }
  }
}

function checkTypeScriptConsumer() {
  console.log(`\n${DIM}── TypeScript consumer fixture (not implemented) ──${RESET}`);
  warn('TODO: add tests/fixtures/ts-consumer/ and run tsc --noEmit');
}

function checkDistFreshness() {
  console.log(`\n${DIM}── dist vs src staleness (not implemented) ──${RESET}`);
  warn('TODO: tools/checkDistFresh.cjs — fail if src/*.js mtime > dist/*.esm.js');
}

function main() {
  console.log(`${GREEN}quikdown verify:package${RESET} (v${pkg.version}${releaseMode ? ', release mode' : ''})`);

  checkMainEntrypoints();
  checkExportsMap();
  checkCoreDistBundles();
  checkTypeScriptDefinitions();
  if (releaseMode) {
    checkStandaloneBundle();
    checkNpmPackContents();
  } else {
    console.log(`\n${DIM}── Standalone + npm pack (skipped — use verify:release) ──${RESET}`);
  }

  if (!releaseMode) {
    checkTypeScriptConsumer();
    checkDistFreshness();
  }

  console.log('\n── Summary ──');
  console.log(`${GREEN}${passed.length} passed${RESET}`);
  if (warnings.length) {
    console.log(`${YELLOW}${warnings.length} warnings${RESET}`);
    for (const w of warnings) console.log(`  ${YELLOW}⚠${RESET}  ${w}`);
  }
  if (errors.length) {
    console.log(`${RED}${errors.length} failed${RESET}`);
    for (const e of errors) console.log(`  ${RED}✗${RESET}  ${e}`);
    console.log(`\n${RED}verify:package FAILED${RESET}\n`);
    process.exit(1);
  }

  console.log(`\n${GREEN}verify:package OK${RESET}\n`);
}

main();
