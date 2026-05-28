#!/usr/bin/env node
/**
 * buildAirgapZip.cjs — single-folder zip for air-gapped deployments.
 *
 * Run after build:all. Output: dist/quikdown-airgap-v{version}.zip
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const distDir = path.join(ROOT, 'dist');
const stagingDir = path.join(ROOT, 'tmp', 'airgap-staging');
const zipName = `quikdown-airgap-v${pkg.version}.zip`;
const zipPath = path.join(distDir, zipName);

const REQUIRED = [
  'dist/quikdown_edit_standalone.umd.min.js',
  'dist/quikdown_edit_standalone.esm.min.js',
  'dist/basemap_world_10m.topojson',
  'dist/quikdown.light.min.css',
  'dist/quikdown.dark.min.css',
];

const STAGED_NAMES = {
  'dist/quikdown_edit_standalone.umd.min.js': 'quikdown_edit_standalone.umd.min.js',
  'dist/quikdown_edit_standalone.esm.min.js': 'quikdown_edit_standalone.esm.min.js',
  'dist/basemap_world_10m.topojson': 'basemap_world_10m.topojson',
  'dist/quikdown.light.min.css': 'quikdown.light.min.css',
  'dist/quikdown.dark.min.css': 'quikdown.dark.min.css',
};

function copyFile(srcRel, destName) {
  const src = path.join(ROOT, srcRel);
  if (!fs.existsSync(src)) {
    console.error(`buildAirgapZip: missing ${srcRel}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(stagingDir, destName));
}

function main() {
  for (const rel of REQUIRED) {
    if (!fs.existsSync(path.join(ROOT, rel))) {
      console.error(`buildAirgapZip: run npm run build:all first (${rel} missing)`);
      process.exit(1);
    }
  }

  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  for (const [srcRel, destName] of Object.entries(STAGED_NAMES)) {
    copyFile(srcRel, destName);
  }
  fs.copyFileSync(path.join(__dirname, 'airgap', 'offline-demo.html'), path.join(stagingDir, 'offline-demo.html'));
  fs.copyFileSync(path.join(__dirname, 'airgap', 'README-airgap.txt'), path.join(stagingDir, 'README-airgap.txt'));

  fs.mkdirSync(distDir, { recursive: true });
  fs.rmSync(zipPath, { force: true });

  execSync(`cd "${stagingDir}" && zip -r -9 "${zipPath}" .`, { stdio: 'inherit' });
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(0);
  console.log(`buildAirgapZip OK: dist/${zipName} (${sizeKb} KB)`);
}

main();
