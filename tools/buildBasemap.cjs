#!/usr/bin/env node
/**
 * buildBasemap.cjs — Pre-builds the Natural Earth 10m vector basemap.
 *
 * Writes compact TopoJSON to dist/ as a separate asset (NOT inlined in the
 * standalone JS bundle). Inlining — even via JSON.parse('…') — still blows
 * up Terser once MathJax/Vega are bundled alongside (~18 MB input).
 *
 * The standalone editor loads this file at runtime via fetch() from the same
 * directory as quikdown_edit_standalone.*.js
 *
 * Reads:  node_modules/world-atlas/countries-10m.json
 * Writes: dist/basemap_world_10m.topojson
 *         dist/basemap_world_10m.topojson.gz
 *
 * Usage: node tools/buildBasemap.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const INPUT = path.join(__dirname, '..', 'node_modules', 'world-atlas', 'countries-10m.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT = path.join(DIST_DIR, 'basemap_world_10m.topojson');
const OUTPUT_GZ = `${OUTPUT}.gz`;

if (!fs.existsSync(INPUT)) {
    console.error(`Missing: ${INPUT}`);
    console.error('Run "npm install" first to ensure world-atlas is installed.');
    process.exit(1);
}

if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

const worldTopo = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// Truncate arc coordinates to 4 decimal places (~11 m) — enough for display.
for (const arc of worldTopo.arcs) {
    for (const point of arc) {
        for (let i = 0; i < point.length; i++) {
            point[i] = Math.round(point[i] * 10000) / 10000;
        }
    }
}

const json = JSON.stringify(worldTopo);
fs.writeFileSync(OUTPUT, json, 'utf8');
fs.writeFileSync(OUTPUT_GZ, zlib.gzipSync(json, { level: 9 }));

const sizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
const gzKB = (fs.statSync(OUTPUT_GZ).size / 1024).toFixed(0);
console.log(`Generated ${OUTPUT} (${sizeKB} KB)`);
console.log(`Generated ${OUTPUT_GZ} (${gzKB} KB gzipped)`);
