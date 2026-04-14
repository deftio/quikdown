#!/usr/bin/env node
/**
 * buildSite.js
 *
 * Static site builder for the quikdown website. Reads HTML templates from
 * pages/templates/, substitutes placeholders, and writes plain .html files
 * into the pages/ directory.
 *
 * No template engine. No framework. Just file copy + string replace.
 *
 * Placeholders:
 *   {{NAV_HTML}}        — contents of pages/components/nav.html
 *   {{FOOTER_HTML}}     — contents of pages/components/footer.html
 *   {{VERSION}}         — package.json version
 *   {{COVERAGE}}        — coverage percentage from coverage-summary.json
 *   {{SIZE_CORE}}       — minified bundle size in KB for quikdown
 *   {{SIZE_BD}}         — minified bundle size for quikdown_bd
 *   {{SIZE_EDIT}}       — minified bundle size for quikdown_edit
 *   {{YEAR}}            — current year
 *   {{ROOT}}            — relative path to repo root (computed per page)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// ----- Page mapping -----
// Each entry: { template: source HTML, output: destination path }
const PAGES = [
    { template: 'landing.html',      output: 'pages/index.html' },
    { template: 'edit.html',         output: 'pages/edit/index.html' },
    { template: 'examples-hub.html', output: 'pages/examples/index.html' },
    { template: 'docs.html',         output: 'pages/docs/index.html' },
    { template: 'changelog.html',    output: 'pages/changelog/index.html' },
    { template: 'downloads.html',   output: 'pages/downloads/index.html' },
    { template: 'frameworks.html',  output: 'pages/frameworks/index.html' },
];

// ----- Read shared partials -----
function readPartial(name) {
    const p = path.join(root, 'pages', 'components', name);
    if (!fs.existsSync(p)) {
        console.warn(`buildSite: partial not found: ${name}`);
        return '';
    }
    return fs.readFileSync(p, 'utf-8');
}

// ----- Read placeholder values -----
function getPlaceholders() {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    // Bundle sizes
    const sizes = {};
    const sizeFiles = {
        SIZE_CORE: 'dist/quikdown.umd.min.js',
        SIZE_BD:   'dist/quikdown_bd.umd.min.js',
        SIZE_EDIT: 'dist/quikdown_edit.umd.min.js',
    };
    for (const [key, file] of Object.entries(sizeFiles)) {
        const fp = path.join(root, file);
        if (fs.existsSync(fp)) {
            const bytes = fs.statSync(fp).size;
            sizes[key] = (bytes / 1024).toFixed(1);
        } else {
            sizes[key] = '?';
        }
    }

    // Coverage (weighted average of flagship parser files)
    let coverage = '?';
    const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
    if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        const flagshipFiles = [
            'dist/quikdown.esm.js',
            'dist/quikdown_bd.esm.js',
            'dist/quikdown_ast.esm.js',
            'dist/quikdown_json.esm.js',
            'dist/quikdown_yaml.esm.js',
            'dist/quikdown_ast_html.esm.js',
        ];
        let totalCovered = 0;
        let totalLines = 0;
        for (const f of flagshipFiles) {
            const abs = path.resolve(root, f);
            const entry = summary[abs];
            if (entry) {
                totalCovered += entry.lines.covered;
                totalLines += entry.lines.total;
            }
        }
        if (totalLines > 0) {
            coverage = ((totalCovered / totalLines) * 100).toFixed(1);
        }
    }

    return {
        NAV_HTML:    readPartial('nav.html'),
        FOOTER_HTML: readPartial('footer.html'),
        VERSION:     pkg.version,
        COVERAGE:    coverage,
        SIZE_CORE:   sizes.SIZE_CORE,
        SIZE_BD:     sizes.SIZE_BD,
        SIZE_EDIT:   sizes.SIZE_EDIT,
        YEAR:        String(new Date().getFullYear()),
    };
}

// ----- Substitute placeholders -----
function substitute(template, placeholders, warnOnUnknown = false) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (key in placeholders) return placeholders[key];
        if (warnOnUnknown) console.warn(`buildSite: unknown placeholder {{${key}}}`);
        return match;
    });
}

// ----- Build a single page -----
function buildPage(entry, placeholders) {
    const tmplPath = path.join(root, 'pages', 'templates', entry.template);
    if (!fs.existsSync(tmplPath)) {
        console.warn(`buildSite: template missing: ${entry.template} (skipping)`);
        return false;
    }
    const template = fs.readFileSync(tmplPath, 'utf-8');
    // Compute ROOT relative path based on output depth.
    // pages/index.html (depth 1) → ROOT = ".."
    // pages/edit/index.html (depth 2) → ROOT = "../.."
    const depth = entry.output.split('/').length - 1;
    const ROOT = Array(depth).fill('..').join('/');
    const pagePlaceholders = { ...placeholders, ROOT };
    // Substitute twice so placeholders inside injected partials (e.g.
    // {{VERSION}} inside nav.html) get resolved on the second pass.
    let html = substitute(template, pagePlaceholders, false);
    html = substitute(html, pagePlaceholders, true);
    const outPath = path.join(root, entry.output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`  ✓ ${entry.template.padEnd(28)} → ${entry.output}`);
    return true;
}

// ----- Sitemap generation -----
function buildSitemap(builtPages) {
    const baseUrl = 'https://deftio.github.io/quikdown';
    const today = new Date().toISOString().split('T')[0];
    const urls = builtPages.map(p => {
        let urlPath = '/' + p.output.replace(/index\.html$/, '');
        if (urlPath === '/') urlPath = '/';
        return `  <url>
    <loc>${baseUrl}${urlPath}</loc>
    <lastmod>${today}</lastmod>
  </url>`;
    }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
    fs.writeFileSync(path.join(root, 'pages', 'sitemap.xml'), xml);
    console.log('  ✓ pages/sitemap.xml');
}

// ----- Robots.txt -----
function buildRobots() {
    const txt = `User-agent: *
Allow: /

Sitemap: https://deftio.github.io/quikdown/pages/sitemap.xml
`;
    fs.writeFileSync(path.join(root, 'pages', 'robots.txt'), txt);
    console.log('  ✓ pages/robots.txt');
}

// ----- version.json artifact -----
// Pages that can't go through buildSite substitution (the bare example pages
// that fetch nav/footer at runtime) read this file to get the current version.
// Eliminates hardcoded version strings that go stale.
function buildVersionJson(placeholders) {
    const out = {
        version:   placeholders.VERSION,
        coverage:  placeholders.COVERAGE,
        sizeCore:  placeholders.SIZE_CORE,
        sizeBd:    placeholders.SIZE_BD,
        sizeEdit:  placeholders.SIZE_EDIT,
        generated: new Date().toISOString(),
    };
    fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'pages', 'version.json'),
        JSON.stringify(out, null, 2) + '\n'
    );
    console.log('  ✓ pages/version.json');
}

// ----- downloads.json artifact -----
// Emits a JSON file with sizes, gzip sizes, and SRI hashes for every dist file.
// The downloads page fetches this at runtime — no handwritten sizes or SRIs.
function buildDownloadsJson() {
    const distDir = path.join(root, 'dist');
    if (!fs.existsSync(distDir)) return;
    const allFiles = fs.readdirSync(distDir)
        .filter(f => f.endsWith('.js') || f.endsWith('.d.ts'))
        .sort();
    const entries = [];
    let gzCount = 0;
    for (const file of allFiles) {
        const fp = path.join(distDir, file);
        const content = fs.readFileSync(fp);
        const entry = { file, size: content.length };
        if (file.endsWith('.d.ts')) {
            entry.type = 'types';
        } else {
            entry.format = file.includes('.esm.') ? 'ESM' : 'UMD';
            entry.minified = file.includes('.min.');
            if (entry.minified) {
                // SRI for CDN <script integrity="...">
                const hash = crypto.createHash('sha384').update(content).digest('base64');
                entry.sri = `sha384-${hash}`;
                // Build .gz file and record its size
                const gz = zlib.gzipSync(content, { level: 9 });
                const gzPath = fp + '.gz';
                fs.writeFileSync(gzPath, gz);
                entry.gzFile = file + '.gz';
                entry.gzSize = gz.length;
                gzCount++;
            }
        }
        entries.push(entry);
    }
    fs.writeFileSync(
        path.join(root, 'pages', 'downloads.json'),
        JSON.stringify(entries, null, 2) + '\n'
    );
    console.log(`  ✓ pages/downloads.json (${gzCount} .gz files built)`);
}

// ----- Main -----
function main() {
    console.log('\n=== buildSite ===');
    const placeholders = getPlaceholders();
    console.log(`  version=${placeholders.VERSION}, coverage=${placeholders.COVERAGE}%, sizes=core:${placeholders.SIZE_CORE}KB bd:${placeholders.SIZE_BD}KB edit:${placeholders.SIZE_EDIT}KB`);
    console.log('');

    const built = [];
    for (const entry of PAGES) {
        if (buildPage(entry, placeholders)) {
            built.push(entry);
        }
    }

    if (built.length > 0) {
        buildSitemap(built);
        buildRobots();
        buildVersionJson(placeholders);
        buildDownloadsJson();
    }

    console.log(`\n  Done. Built ${built.length} pages.`);
}

main();
