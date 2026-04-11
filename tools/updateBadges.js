#!/usr/bin/env node
/**
 * updateBadges.js
 *
 * Rewrites README.md badges with current hard numbers from the build:
 *   - Bundle size     (from dist/quikdown.umd.min.js)
 *   - Code coverage   (from coverage/coverage-summary.json, emitted by Jest)
 *
 * Run after `npm test` (or as part of `npm test` itself) so the badge
 * always reflects the latest run. No external services.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, '..');
const readmePath = path.join(root, 'README.md');

if (!fs.existsSync(readmePath)) {
    console.error('README.md not found');
    process.exit(1);
}

let readme = fs.readFileSync(readmePath, 'utf-8');
const changes = [];

// ---------- Bundle size badge ----------
const distPath = path.join(root, 'dist', 'quikdown.umd.min.js');
if (fs.existsSync(distPath)) {
    const stats = fs.statSync(distPath);
    const sizeInKB = (stats.size / 1024).toFixed(1);

    // Match any existing bundle size badge format: minified-{number}KB-{color}
    const bundleBadgeRe = /\[!\[Bundle Size\]\(https:\/\/img\.shields\.io\/badge\/minified-[\d.]+KB-[a-z]+(?:\.svg)?\)\]\([^)]*\)/;
    const newBundleBadge = `[![Bundle Size](https://img.shields.io/badge/minified-${sizeInKB}KB-green.svg)](https://bundlephobia.com/package/quikdown)`;

    if (bundleBadgeRe.test(readme)) {
        readme = readme.replace(bundleBadgeRe, newBundleBadge);
        changes.push(`bundle size → ${sizeInKB}KB`);
    } else {
        // Fallback: match the older static shields.io/bundlephobia variants
        const altRe = /\[!\[Bundle Size\]\([^)]*\)\]\([^)]*\)/;
        if (altRe.test(readme)) {
            readme = readme.replace(altRe, newBundleBadge);
            changes.push(`bundle size → ${sizeInKB}KB (replaced non-static badge)`);
        }
    }
} else {
    console.warn('dist/quikdown.umd.min.js not found — skipping bundle badge');
}

// ---------- Coverage badge (from Jest coverage-summary.json) ----------
const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

    // Pick coverage numbers for the flagship files.
    // We want the README badge to reflect the parser stack, not the DOM-heavy
    // editor that's covered separately via Playwright.
    const flagshipFiles = [
        'dist/quikdown.esm.js',
        'dist/quikdown_bd.esm.js',
        'dist/quikdown_ast.esm.js',
        'dist/quikdown_json.esm.js',
        'dist/quikdown_yaml.esm.js',
        'dist/quikdown_ast_html.esm.js',
    ];

    // Resolve absolute paths since coverage-summary.json keys are absolute.
    const flagshipAbs = flagshipFiles.map((f) => path.resolve(root, f));

    let totalCovered = 0;
    let totalLines = 0;
    const perFile = [];

    for (const abs of flagshipAbs) {
        const entry = summary[abs];
        if (!entry) continue;
        const { lines } = entry;
        totalCovered += lines.covered;
        totalLines += lines.total;
        perFile.push({
            name: path.basename(abs),
            pct: lines.pct,
            covered: lines.covered,
            total: lines.total,
        });
    }

    if (totalLines > 0) {
        const pct = (totalCovered / totalLines) * 100;
        const rounded = Math.round(pct * 10) / 10; // one decimal
        const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);

        // Color tier
        let color = 'red';
        if (rounded >= 95) color = 'brightgreen';
        else if (rounded >= 90) color = 'green';
        else if (rounded >= 80) color = 'yellowgreen';
        else if (rounded >= 70) color = 'yellow';
        else if (rounded >= 60) color = 'orange';

        const label = encodeURIComponent('coverage');
        const value = encodeURIComponent(`${display}%`);
        const badgeUrl = `https://img.shields.io/badge/${label}-${value}-${color}`;
        const newCoverageBadge = `[![Coverage](${badgeUrl})](https://github.com/deftio/quikdown)`;

        // Match any existing coverage badge (codecov, shields.io, static)
        const coverageBadgeRe = /\[!\[(?:Coverage(?: Status)?|Codecov)\]\([^)]*\)\]\([^)]*\)/;

        if (coverageBadgeRe.test(readme)) {
            readme = readme.replace(coverageBadgeRe, newCoverageBadge);
            changes.push(`coverage → ${display}% (${color})`);
        } else {
            console.warn('Coverage badge pattern not found in README.md');
        }

        console.log('\nFlagship files coverage:');
        for (const f of perFile) {
            const marker = f.pct === 100 ? '✓' : ' ';
            console.log(`  ${marker} ${f.name.padEnd(28)} ${f.pct.toFixed(2)}%  (${f.covered}/${f.total})`);
        }
        console.log(`  ${' '.repeat(2)}${'weighted total'.padEnd(28)} ${display}%  (${totalCovered}/${totalLines})`);
    }
} else {
    console.log('coverage/coverage-summary.json not found — run `npm test` first.');
}

// ---------- Write back ----------
if (changes.length > 0) {
    fs.writeFileSync(readmePath, readme);
    console.log(`\nUpdated README.md: ${changes.join(', ')}`);
} else {
    console.log('\nNo badge changes needed.');
}
