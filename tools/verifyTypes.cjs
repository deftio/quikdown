#!/usr/bin/env node
/**
 * verifyTypes.cjs — type-check and smoke-run quikdown the way a consumer gets it.
 *
 * Packs the real npm tarball (`npm pack`), unpacks it into a throwaway project's
 * node_modules, then:
 *   1. compiles tests/fixtures/ts-consumer/index.ts  (ESM)  under bundler,
 *      preserve+bundler and nodenext resolution
 *   2. compiles tests/fixtures/ts-consumer/index.cts (CJS)  under nodenext
 *   3. runs `import` and `require` of every entry point in Node
 *
 * This tests the shipped artifact and the package.json "exports" map — not
 * relative paths into dist/. Requires a prior `npm run build`.
 *
 * Usage: npm run verify:types
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'ts-consumer');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const pkg = require(path.join(ROOT, 'package.json'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quikdown-verify-types-'));
let failed = 0;

function run(label, cmd, args) {
    try {
        execFileSync(cmd, args, { cwd: tmp, stdio: 'pipe', encoding: 'utf8' });
        console.log(`  ✓ ${label}`);
    } catch (err) {
        failed++;
        console.log(`  ✗ ${label}\n${(err.stdout || '') + (err.stderr || '')}`);
    }
}

try {
    // 1. Pack and unpack the real tarball
    const tarball = execFileSync('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', tmp], {
        cwd: ROOT, encoding: 'utf8',
    }).trim().split('\n').pop();
    execFileSync('tar', ['-xzf', path.join(tmp, tarball), '-C', tmp]);
    fs.mkdirSync(path.join(tmp, 'node_modules'));
    fs.renameSync(path.join(tmp, 'package'), path.join(tmp, 'node_modules', 'quikdown'));

    // 2. Consumer project (ESM package, like most modern apps)
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"consumer","private":true,"type":"module"}\n');
    fs.copyFileSync(path.join(FIXTURES, 'index.ts'), path.join(tmp, 'esm.ts'));
    fs.copyFileSync(path.join(FIXTURES, 'index.cts'), path.join(tmp, 'cjs.cts'));

    console.log(`verify:types — quikdown@${pkg.version} from ${tarball}`);
    const base = ['--noEmit', '--strict', '--target', 'es2020', '--lib', 'es2020,dom'];
    const matrix = [
        ['TS  ESM  module=esnext   resolution=bundler ', ['--module', 'esnext', '--moduleResolution', 'bundler', 'esm.ts']],
        ['TS  ESM  module=preserve resolution=bundler ', ['--module', 'preserve', '--moduleResolution', 'bundler', 'esm.ts']],
        ['TS  ESM  module=nodenext resolution=nodenext', ['--module', 'nodenext', '--moduleResolution', 'nodenext', 'esm.ts']],
        ['TS  CJS  module=nodenext resolution=nodenext', ['--module', 'nodenext', '--moduleResolution', 'nodenext', 'cjs.cts']],
    ];
    for (const [label, args] of matrix) run(label, process.execPath, [TSC, ...base, ...args]);

    // 3. Runtime: every entry point loads via import and via require
    const subpaths = Object.keys(pkg.exports).filter(k => k !== './package.json')
        .map(k => 'quikdown' + k.slice(1));
    fs.writeFileSync(path.join(tmp, 'run.mjs'),
        subpaths.map((s, i) => `import m${i} from '${s}';\nif (typeof m${i} !== 'function') throw new Error('${s}: default export is ' + typeof m${i});`).join('\n') +
        `\nif (!m0('**x**').includes('<strong')) throw new Error('render failed');\n`);
    fs.writeFileSync(path.join(tmp, 'run.cjs'),
        subpaths.map(s => `{ const m = require('${s}'); const f = '${s}' === 'quikdown/mcp' ? m.createMcpServer : m;\n  if (typeof f !== 'function') throw new Error('${s}: require() gave ' + typeof f); }`).join('\n') +
        `\nif (!require('quikdown')('**x**').includes('<strong')) throw new Error('render failed');\n`);
    run('Node ESM  import  (all entry points)', process.execPath, ['run.mjs']);
    run('Node CJS  require (all entry points)', process.execPath, ['run.cjs']);
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed) {
    console.log(`\nverify:types FAILED (${failed})`);
    process.exit(1);
}
console.log('\nverify:types OK');
