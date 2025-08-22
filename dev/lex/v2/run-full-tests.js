#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Copy test file and modify imports
const testContent = fs.readFileSync(path.join(__dirname, '../../../tests/quikdown.test.js'), 'utf8');
const modifiedTest = testContent.replace(
  "import quikdown from '../dist/quikdown.esm.js';",
  `import quikdown from '${path.join(__dirname, 'quikdown_lex_v2.js')}';`
);

fs.writeFileSync(path.join(__dirname, 'quikdown-v2.test.mjs'), modifiedTest);

console.log('🧪 Running tests against v2...\n');

try {
  execSync('NODE_NO_WARNINGS=1 npx jest quikdown-v2.test.mjs --verbose', {
    cwd: __dirname,
    stdio: 'inherit'
  });
} catch (error) {
  // Jest exits with error if tests fail
  console.log('\n❌ Some tests failed');
} finally {
  fs.unlinkSync(path.join(__dirname, 'quikdown-v2.test.mjs'));
}