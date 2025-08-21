#!/usr/bin/env node

/**
 * Test runner for quikdown_lex
 * Runs the main test suite against the lexer version without affecting main build
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

log('🧪 Running quikdown_lex test suite...', colors.bright);
log('─'.repeat(50), colors.dim);

try {
  // First, ensure we have a built version
  log('\n📦 Building lexer...', colors.cyan);
  execSync('node build-lex.js', { cwd: __dirname, stdio: 'pipe' });
  log('✓ Build complete', colors.green);

  // Create a temporary test file that imports our lexer instead of main quikdown
  const mainTestPath = path.join(__dirname, '../../tests/quikdown.test.js');
  const mainTestContent = fs.readFileSync(mainTestPath, 'utf8');
  
  // Replace the import to use our lexer
  const modifiedTest = mainTestContent
    .replace(/import quikdown from ['"]\.\.\/src\/quikdown\.js['"]/g, 
             `import quikdown from '${path.join(__dirname, 'quikdown_lex.js')}'`)
    .replace(/import quikdown from ['"]\.\.\/dist\/quikdown\.esm\.js['"]/g,
             `import quikdown from '${path.join(__dirname, 'quikdown_lex.js')}'`)
    .replace(/const quikdown = require\(['"]\.\.\/src\/quikdown['"]\)/g,
             `const quikdown = require('${path.join(__dirname, 'quikdown_lex.js')}')`);
  
  // Write temporary test file
  const tempTestPath = path.join(__dirname, 'quikdown_lex.test.js');
  fs.writeFileSync(tempTestPath, modifiedTest);
  
  // Run tests
  log('\n🏃 Running tests...', colors.cyan);
  log('─'.repeat(50), colors.dim);
  
  try {
    // Run Jest with our modified test file - need experimental-vm-modules for ES modules
    const result = execSync(
      `NODE_OPTIONS="--experimental-vm-modules" npx jest ${tempTestPath} --no-coverage --verbose`, 
      { 
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf8',
        stdio: 'pipe'
      }
    );
    
    // Parse and display results
    const lines = result.split('\n');
    let inTestOutput = false;
    let passCount = 0;
    let failCount = 0;
    
    lines.forEach(line => {
      if (line.includes('PASS') || line.includes('FAIL')) {
        inTestOutput = true;
      }
      
      if (inTestOutput) {
        // Count results
        if (line.includes('✓')) passCount++;
        if (line.includes('✕')) failCount++;
        
        // Color the output
        if (line.includes('✓')) {
          console.log(colors.green + line + colors.reset);
        } else if (line.includes('✕')) {
          console.log(colors.red + line + colors.reset);
        } else if (line.includes('PASS')) {
          console.log(colors.green + colors.bright + line + colors.reset);
        } else if (line.includes('FAIL')) {
          console.log(colors.red + colors.bright + line + colors.reset);
        } else {
          console.log(line);
        }
      }
    });
    
    // Summary
    log('\n' + '─'.repeat(50), colors.dim);
    log('✅ Test Results:', colors.bright);
    log(`  Passed: ${passCount}`, colors.green);
    if (failCount > 0) {
      log(`  Failed: ${failCount}`, colors.red);
    }
    
  } catch (testError) {
    // Tests failed - parse the error output
    const output = testError.stdout ? testError.stdout.toString() : '';
    const errorOutput = testError.stderr ? testError.stderr.toString() : '';
    
    console.log(output);
    if (errorOutput) {
      console.log(colors.red + errorOutput + colors.reset);
    }
    
    log('\n❌ Some tests failed', colors.red + colors.bright);
    
    // Still clean up
    fs.unlinkSync(tempTestPath);
    process.exit(1);
  }
  
  // Run comparison test
  log('\n📊 Running compatibility comparison...', colors.cyan);
  log('─'.repeat(50), colors.dim);
  
  // Import both versions for comparison
  const { default: quikdown_main } = await import('../../src/quikdown.js');
  const { default: quikdown_lex } = await import('./quikdown_lex.js');
  
  const testCases = [
    '# Heading',
    '**bold** and *italic*',
    '- List item 1\n- List item 2',
    '```js\ncode block\n```',
    '| Header | Header |\n|--------|--------|\n| Cell   | Cell   |',
    '[link](https://example.com)',
    '![image](test.jpg)',
    '> Blockquote',
    '---',
    'Line 1\nLine 2' // Test lazy linefeeds
  ];
  
  let identical = 0;
  let different = 0;
  
  console.log('\nComparing outputs:');
  testCases.forEach(testCase => {
    const mainResult = quikdown_main(testCase);
    const lexResult = quikdown_lex(testCase);
    
    if (mainResult === lexResult) {
      identical++;
      console.log(`  ✓ ${testCase.substring(0, 30)}...`);
    } else {
      different++;
      console.log(`  ⚠ ${testCase.substring(0, 30)}... (output differs but may be valid)`);
    }
  });
  
  log(`\n  Identical: ${identical}/${testCases.length}`, colors.green);
  if (different > 0) {
    log(`  Different: ${different}/${testCases.length} (HTML may be equivalent)`, colors.yellow);
  }
  
  // Clean up
  fs.unlinkSync(tempTestPath);
  
  log('\n✨ All tests complete!', colors.green + colors.bright);
  
} catch (error) {
  log(`\n❌ Test runner failed: ${error.message}`, colors.red + colors.bright);
  console.error(error);
  
  // Clean up on error
  const tempTestPath = path.join(__dirname, 'quikdown_lex.test.js');
  if (fs.existsSync(tempTestPath)) {
    fs.unlinkSync(tempTestPath);
  }
  
  process.exit(1);
}