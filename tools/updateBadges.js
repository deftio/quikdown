#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the actual file size
const distPath = path.join(__dirname, '..', 'dist', 'quikdown.umd.min.js');
const stats = fs.statSync(distPath);
const sizeInKB = (stats.size / 1024).toFixed(1);

console.log(`Current minified size: ${sizeInKB}KB`);

// Update README if needed
const readmePath = path.join(__dirname, '..', 'README.md');
let readme = fs.readFileSync(readmePath, 'utf-8');

// Update the bundle size badge
const oldBadgeRegex = /\[\!\[Bundle Size\]\(https:\/\/img\.shields\.io\/badge\/minified-[\d.]+KB-green\.svg\)\]/;
const newBadge = `[![Bundle Size](https://img.shields.io/badge/minified-${sizeInKB}KB-green.svg)]`;

if (oldBadgeRegex.test(readme)) {
    readme = readme.replace(oldBadgeRegex, newBadge);
    fs.writeFileSync(readmePath, readme);
    console.log(`Updated README.md bundle size badge to ${sizeInKB}KB`);
} else {
    console.log('Bundle size badge not found in README.md');
}