#!/usr/bin/env node

/**
 * Build script for quikdown_lex
 * Minifies the lexer version and reports sizes
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(1) + 'KB';
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

log('🔨 Building quikdown_lex...', colors.bright);

try {
  // Read version from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const version = packageJson.version;
  
  // Read source file
  const sourcePath = path.join(__dirname, 'quikdown_lex.js');
  let source = fs.readFileSync(sourcePath, 'utf8');
  
  // Inject version as a string literal
  source = source.replace(/__QUIKDOWN_VERSION__/g, `'${version}'`);
  
  // Write version-injected file
  const versionedPath = path.join(__dirname, 'quikdown_lex.versioned.js');
  fs.writeFileSync(versionedPath, source);
  
  // Minify with terser
  log('\n📦 Minifying...', colors.cyan);
  
  // ES Module version
  execSync(`npx terser ${versionedPath} -c -m --module -o quikdown_lex.esm.min.js`, { 
    cwd: __dirname,
    stdio: 'inherit' 
  });
  
  // UMD version (wrapped for browser compatibility)
  const umdWrapper = `(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.quikdown_lex = factory());
})(this, (function () {
    'use strict';
    ${source.replace(/export default quikdown_lex;?/g, 'return quikdown_lex;')}
}));`;
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex.umd.js'), umdWrapper);
  execSync(`npx terser quikdown_lex.umd.js -c -m -o quikdown_lex.umd.min.js`, { 
    cwd: __dirname,
    stdio: 'inherit' 
  });
  
  // Calculate sizes
  log('\n📊 Build Results:', colors.bright);
  log('─'.repeat(40));
  
  const files = [
    { name: 'Source', path: 'quikdown_lex.js' },
    { name: 'ESM Minified', path: 'quikdown_lex.esm.min.js' },
    { name: 'UMD Minified', path: 'quikdown_lex.umd.min.js' }
  ];
  
  files.forEach(file => {
    const filePath = path.join(__dirname, file.path);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      const size = content.length;
      const gzipped = zlib.gzipSync(content).length;
      
      log(
        `${file.name.padEnd(15)} ${formatBytes(size).padStart(8)} ` +
        `(${formatBytes(gzipped)} gzipped)`,
        file.name.includes('Minified') ? colors.green : colors.blue
      );
    }
  });
  
  // Compare with main version if available
  const mainMinPath = path.join(__dirname, '../../dist/quikdown.esm.min.js');
  if (fs.existsSync(mainMinPath)) {
    log('\n📈 Size Comparison:', colors.bright);
    log('─'.repeat(40));
    
    const mainSize = fs.readFileSync(mainMinPath).length;
    const lexSize = fs.readFileSync(path.join(__dirname, 'quikdown_lex.esm.min.js')).length;
    const diff = lexSize - mainSize;
    const percent = ((diff / mainSize) * 100).toFixed(1);
    
    log(`Main quikdown:  ${formatBytes(mainSize)}`, colors.yellow);
    log(`Lexer version:  ${formatBytes(lexSize)}`, colors.yellow);
    log(
      `Difference:     ${diff > 0 ? '+' : ''}${formatBytes(Math.abs(diff))} ` +
      `(${diff > 0 ? '+' : ''}${percent}%)`,
      diff > 0 ? colors.yellow : colors.green
    );
  }
  
  // Clean up temporary files
  fs.unlinkSync(versionedPath);
  fs.unlinkSync(path.join(__dirname, 'quikdown_lex.umd.js'));
  
  log('\n✅ Build complete!', colors.green + colors.bright);
  
  // Usage instructions
  log('\n📖 Usage:', colors.cyan);
  log('  ESM:  import quikdown_lex from "./quikdown_lex.esm.min.js"');
  log('  UMD:  <script src="quikdown_lex.umd.min.js"></script>');
  log('  CDN:  Both files can be served from a CDN');
  
} catch (error) {
  log(`\n❌ Build failed: ${error.message}`, colors.bright);
  process.exit(1);
}