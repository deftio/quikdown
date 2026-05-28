#!/usr/bin/env node
/**
 * buildBasemap.cjs — Offline vector basemap assets (separate from JS bundle).
 *
 * Produces two TopoJSON siblings in dist/:
 *   basemap_countries_110m.topojson  — Natural Earth 110m country fills (~0.1 MB)
 *   basemap_admin1_lines.topojson    — Simplified 10m state/province lines (auto-tuned)
 *
 * Loaded at runtime by the standalone editor (fetch, not Rollup/Terser).
 * Total basemap size is auto-tuned so JS min + both files stay ≤ 9 MB offline core.
 *
 * Admin-1 source: Natural Earth 10m internal boundary lines (global).
 * Cached under tools/data/ on first download (~21 MB GeoJSON).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'tools', 'data');

const COUNTRIES_IN = path.join(ROOT, 'node_modules', 'world-atlas', 'countries-110m.json');
const STANDALONE_JS = path.join(DIST, 'quikdown_edit_standalone.esm.min.js');
const ADMIN1_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces_lines.geojson';
const ADMIN1_CACHE = path.join(DATA_DIR, 'ne_10m_admin_1_states_provinces_lines.geojson');

const OUT_COUNTRIES = path.join(DIST, 'basemap_countries_110m.topojson');
const OUT_ADMIN1 = path.join(DIST, 'basemap_admin1_lines.topojson');

/** Offline "app core" cap — must match tools/checkStandalone.cjs */
const MAX_OFFLINE_CORE_BYTES = 9_000_000;

// ── helpers ─────────────────────────────────────────────────────────

function truncateArcs(topo, decimals) {
  const factor = Math.pow(10, decimals);
  for (const arc of topo.arcs) {
    for (const point of arc) {
      for (let i = 0; i < point.length; i++) {
        point[i] = Math.round(point[i] * factor) / factor;
      }
    }
  }
  return topo;
}

function writeGz(jsonPath) {
  const raw = fs.readFileSync(jsonPath);
  fs.writeFileSync(jsonPath + '.gz', zlib.gzipSync(raw, { level: 9 }));
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed (${res.statusCode}): ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function truncateCoord(n, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function simplifyLineCoords(coords, decimals) {
  if (typeof coords[0] === 'number') {
    return [truncateCoord(coords[0], decimals), truncateCoord(coords[1], decimals)];
  }
  return coords.map(c => simplifyLineCoords(c, decimals));
}

function buildAdmin1Topojson(geojson, { scalerankMax, decimals, quantization }) {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  const topojsonServer = require('topojson-server');

  const features = [];
  for (const f of geojson.features) {
    const t = f.geometry && f.geometry.type;
    if (t !== 'LineString' && t !== 'MultiLineString') continue;
    const sr = f.properties && (f.properties.SCALERANK ?? f.properties.scalerank ?? f.properties.scaleRank);
    if (sr != null && sr > scalerankMax) continue;
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: f.geometry.type,
        coordinates: simplifyLineCoords(f.geometry.coordinates, decimals)
      }
    });
  }

  const collection = { type: 'FeatureCollection', features };
  return topojsonServer.topology({ admin1_lines: collection }, quantization);
}

function admin1Bytes(geojson, params) {
  return Buffer.byteLength(JSON.stringify(buildAdmin1Topojson(geojson, params)));
}

/** Pick admin-1 params: finest quantization (least grid artifact) that fits budget. */
function pickAdmin1Params(geojson, budgetBytes) {
  const quantSteps = [10000, 8000, 6000, 5000, 4000, 3500, 3000, 2800, 2600, 2400, 2200, 2000, 1800, 1600, 1400, 1200, 1000, 800, 600, 500, 400, 350, 300, 250, 200, 150, 100];
  let best = null;

  for (let scalerankMax = 6; scalerankMax >= 0; scalerankMax--) {
    for (const decimals of [3, 2, 1]) {
      for (const quantization of quantSteps) {
        const params = { scalerankMax, decimals, quantization };
        const size = admin1Bytes(geojson, params);
        if (size > budgetBytes) continue;
        if (
          !best
          || params.quantization > best.params.quantization
          || (params.quantization === best.params.quantization && params.scalerankMax > best.params.scalerankMax)
          || (params.quantization === best.params.quantization && params.scalerankMax === best.params.scalerankMax && params.decimals > best.params.decimals)
        ) {
          best = { params, size };
        }
      }
    }
  }

  if (!best) {
    const params = { scalerankMax: 0, decimals: 1, quantization: 100 };
    return { params, size: admin1Bytes(geojson, params) };
  }
  return best;
}

function basemapBudgetBytes(countriesBytes) {
  let jsBytes = 0;
  if (fs.existsSync(STANDALONE_JS)) {
    jsBytes = fs.statSync(STANDALONE_JS).size;
  } else {
    // Pre-standalone build: assume ~7.6 MB JS so basemap targets ~1 MB
    jsBytes = 7_600_000;
    console.log('  (standalone JS not built yet — using 7.6 MB estimate for basemap budget)');
  }
  const remaining = MAX_OFFLINE_CORE_BYTES - jsBytes - countriesBytes;
  if (remaining < 200_000) {
    console.warn(`Warning: only ${(remaining / 1024).toFixed(0)} KB left for admin-1 after JS + countries`);
  }
  return remaining;
}

// ── main ────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(COUNTRIES_IN)) {
    console.error(`Missing ${COUNTRIES_IN} — run npm install`);
    process.exit(1);
  }
  fs.mkdirSync(DIST, { recursive: true });

  // 1. Countries 110m (already TopoJSON — compact fills for offline budget)
  const countries = truncateArcs(JSON.parse(fs.readFileSync(COUNTRIES_IN, 'utf8')), 3);
  fs.writeFileSync(OUT_COUNTRIES, JSON.stringify(countries));
  writeGz(OUT_COUNTRIES);
  const countriesBytes = fs.statSync(OUT_COUNTRIES).size;
  const countriesKB = (countriesBytes / 1024).toFixed(0);
  console.log(`Generated ${OUT_COUNTRIES} (${countriesKB} KB)`);

  // 2. Admin-1 lines — download once, cache in tools/data/
  if (!fs.existsSync(ADMIN1_CACHE)) {
    console.log('Downloading admin-1 lines (one-time cache)…');
    await download(ADMIN1_URL, ADMIN1_CACHE);
  }
  const admin1Geo = JSON.parse(fs.readFileSync(ADMIN1_CACHE, 'utf8'));

  const admin1Budget = basemapBudgetBytes(countriesBytes);
  console.log(`Admin-1 budget: ${(admin1Budget / 1024).toFixed(0)} KB (9 MB core − JS − countries)`);

  const { params: used, size: admin1Size } = pickAdmin1Params(admin1Geo, admin1Budget);
  const admin1Topo = buildAdmin1Topojson(admin1Geo, used);

  fs.writeFileSync(OUT_ADMIN1, JSON.stringify(admin1Topo));
  writeGz(OUT_ADMIN1);

  const totalBasemap = countriesBytes + admin1Size;
  const admin1KB = (admin1Size / 1024).toFixed(0);
  console.log(
    `Generated ${OUT_ADMIN1} (${admin1KB} KB, scalerank<=${used.scalerankMax}, d=${used.decimals}, q=${used.quantization})`
  );
  console.log(`Basemap total: ${(totalBasemap / 1024).toFixed(0)} KB`);

  if (fs.existsSync(STANDALONE_JS)) {
    const coreTotal = fs.statSync(STANDALONE_JS).size + totalBasemap;
    console.log(`Offline core (JS + basemap): ${(coreTotal / 1024 / 1024).toFixed(2)} MB / ${(MAX_OFFLINE_CORE_BYTES / 1024 / 1024).toFixed(0)} MB`);
    if (coreTotal > MAX_OFFLINE_CORE_BYTES) {
      console.error('ERROR: offline core exceeds 9 MB — rebuild standalone with smaller JS or re-run after JS shrink');
      process.exit(1);
    }
  }

  // Remove legacy basemap files
  for (const legacy of [
    path.join(DIST, 'basemap_world_10m.topojson'),
    path.join(DIST, 'basemap_countries_50m.topojson'),
  ]) {
    for (const p of [legacy, legacy + '.gz']) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
