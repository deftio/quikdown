#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create wrapper that imports v2 as quikdown
const testWrapper = `
import quikdown_lex from '${path.join(__dirname, 'quikdown_lex_v2.js')}';

// Make v2 available globally as quikdown  
global.quikdown = quikdown_lex;

// Run the actual test file
import '../../../tests/quikdown.test.js';
`;

// Write wrapper
fs.writeFileSync(path.join(__dirname, 'test-wrapper.mjs'), testWrapper);

console.log('🧪 Running main test suite against v2...\n');

try {
  // Run tests
  execSync('NODE_NO_WARNINGS=1 npx jest test-wrapper.mjs --verbose', {
    cwd: __dirname,
    stdio: 'inherit'
  });
} catch (error) {
  // Jest exits with error code if tests fail
  process.exit(1);
} finally {
  // Clean up
  fs.unlinkSync(path.join(__dirname, 'test-wrapper.mjs'));
}