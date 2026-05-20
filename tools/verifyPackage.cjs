#!/usr/bin/env node
/**
 * verifyPackage.cjs — pre-publish / CI gate for npm package completeness.
 *
 * Validates that what package.json *claims* to ship actually exists on disk
 * after `npm run build`. Catches missing .d.ts, broken exports, and (when
 * implemented) tarball gaps that Jest coverage cannot see.
 *
 * Usage:
 *   npm run build && npm run verify:package
 *
 * Integrate into:
 *   - .github/workflows/ci.yml      (after build, before test)
 *   - .github/workflows/publish.yml (before npm publish)
 *   - tools/release.sh              (after build preflight)
 *
 * Full spec and roadmap: dev/1.2.14-issues.md
 *   → "Release process hardening"
 *   → "QA strategy"
 *   → "Contract testing guide"
 *
 * Exit 0 = all implemented checks pass.
 * Exit 1 = one or more checks failed (prints actionable errors).
 */
'use strict';

const fs = require('fs');
const path = require('path');
// const { execSync } = require('child_process'); // TODO: npm pack dry-run

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));

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

// ── Implemented checks ─────────────────────────────────────────────────────

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

    for (const [condition, target] of Object.entries(conditions)) {
      if (typeof target !== 'string') continue;
      fileMustExist(target, `${label}.${condition}`);
    }
  }
}

/** Minimum dist JS bundles CI already checks — keep in sync with ci.yml */
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

/** All .d.ts files referenced by exports — the check that caught the 1.2.14 gap */
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

// ── TODO: implement in follow-up PRs (see dev/1.2.14-issues.md) ─────────────

function checkNpmPackContents() {
  console.log(`\n${DIM}── npm pack dry-run (not implemented) ──${RESET}`);
  warn('TODO: run `npm pack --dry-run` and assert .d.ts + all export targets appear in tarball');
  warn('TODO: see dev/1.2.14-issues.md → Release process hardening → verifyPackage');
  /*
  const out = execSync('npm pack --dry-run', { cwd: ROOT, encoding: 'utf8' });
  for (const required of REQUIRED_PACK_PATHS) {
    if (!out.includes(required)) fail(`npm pack missing: ${required}`);
  }
  */
}

function checkTypeScriptConsumer() {
  console.log(`\n${DIM}── TypeScript consumer fixture (not implemented) ──${RESET}`);
  warn('TODO: add tests/fixtures/ts-consumer/ and run tsc --noEmit');
  warn('TODO: wire as npm run verify:types (separate from this script)');
  /*
  execSync('npx tsc --noEmit -p tests/fixtures/ts-consumer/tsconfig.json', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  */
}

function checkDistFreshness() {
  console.log(`\n${DIM}── dist vs src staleness (not implemented) ──${RESET}`);
  warn('TODO: tools/checkDistFresh.cjs — fail if src/*.js mtime > dist/*.esm.js');
  warn('TODO: or enforce build-before-test in CI (preferred)');
}

function checkStandaloneBundle() {
  console.log(`\n${DIM}── standalone editor bundle (optional) ──${RESET}`);
  const standalone = 'dist/quikdown_edit_standalone.esm.min.js';
  if (!fs.existsSync(resolvePath(standalone))) {
    warn(`Optional: ${standalone} not found (run npm run build:standalone for offline editor)`);
  } else {
    ok(`standalone: ${standalone}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log(`${GREEN}quikdown verify:package${RESET} (v${pkg.version})`);
  console.log(`${DIM}Spec: dev/1.2.14-issues.md${RESET}`);

  checkMainEntrypoints();
  checkExportsMap();
  checkCoreDistBundles();
  checkTypeScriptDefinitions();
  checkStandaloneBundle();

  // Stubs — log TODOs without failing the run (flip to hard failures when ready)
  checkNpmPackContents();
  checkTypeScriptConsumer();
  checkDistFreshness();

  // ── Summary ──
  console.log('\n── Summary ──');
  console.log(`${GREEN}${passed.length} passed${RESET}`);
  if (warnings.length) {
    console.log(`${YELLOW}${warnings.length} warnings (TODO / optional)${RESET}`);
    for (const w of warnings) console.log(`  ${YELLOW}⚠${RESET}  ${w}`);
  }
  if (errors.length) {
    console.log(`${RED}${errors.length} failed${RESET}`);
    for (const e of errors) console.log(`  ${RED}✗${RESET}  ${e}`);
    console.log(`\n${RED}verify:package FAILED${RESET}`);
    console.log(`${DIM}Fix missing artifacts (usually: restore dist/*.d.ts, then npm run build)${RESET}`);
    console.log(`${DIM}See dev/1.2.14-issues.md → P0 → Restore TypeScript definitions${RESET}\n`);
    process.exit(1);
  }

  console.log(`\n${GREEN}verify:package OK${RESET}\n`);
  process.exit(0);
}

main();
