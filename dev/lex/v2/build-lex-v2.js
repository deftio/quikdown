#!/usr/bin/env node
/**
 * Build script for quikdown_lex v2 (grammar-driven version)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function build() {
  console.log(`${colors.bold}🔨 Building quikdown_lex v2...${colors.reset}`);
  
  try {
    // Step 1: Compile grammar
    console.log(`${colors.cyan}\n📝 Compiling grammar...${colors.reset}`);
    await execAsync('node compile-grammar.js');
    
    // Step 2: Bundle the parser with compiled grammar
    console.log(`${colors.cyan}\n📦 Bundling parser...${colors.reset}`);
    await bundleParser();
    
    // Step 3: Minify
    console.log(`${colors.cyan}\n🗜️ Minifying...${colors.reset}`);
    await minifyBundle();
    
    // Step 4: Create UMD build
    console.log(`${colors.cyan}\n📦 Creating UMD build...${colors.reset}`);
    await createUMDBuild();
    
    // Report sizes
    await reportSizes();
    
    console.log(`${colors.green}${colors.bold}\n✅ Build complete!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.bold}❌ Build failed:${colors.reset}`, error);
    process.exit(1);
  }
}

async function bundleParser() {
  // Read the parser and compiled grammar
  const parserCode = fs.readFileSync('quikdown_lex_v2.js', 'utf8');
  const grammarCode = fs.readFileSync('compiled-grammar.js', 'utf8');
  
  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync('../../package.json', 'utf8'));
  const version = packageJson.version;
  
  // Inline the compiled grammar into the parser
  let bundled = parserCode;
  
  // Replace the import statement with inlined code
  bundled = bundled.replace(
    /import \{ .+ \} from '\.\/compiled-grammar\.js';/,
    grammarCode.replace(/export const/g, 'const').replace(/export \{[^}]+\};?/g, '')
  );
  
  // Replace version placeholder
  bundled = bundled.replace(/__QUIKDOWN_VERSION__/g, version);
  
  // Make it a proper ES module
  bundled = `/**
 * quikdown_lex v2 - Grammar-driven markdown parser
 * @version ${version}
 * @license BSD-2-Clause
 */

${bundled}

// CommonJS support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex_v2;
}

// Browser global
if (typeof window !== 'undefined') {
  window.quikdown_lex = quikdown_lex_v2;
}

export default quikdown_lex_v2;`;
  
  fs.writeFileSync('quikdown_lex.js', bundled);
}

async function minifyBundle() {
  const source = fs.readFileSync('quikdown_lex.js', 'utf8');
  
  // Minify for ES modules
  const esmResult = await minify(source, {
    module: true,
    compress: {
      passes: 2,
      pure_getters: true,
      unsafe: true,
      unsafe_comps: true,
      unsafe_math: true
    },
    mangle: {
      properties: {
        regex: /^_/
      }
    }
  });
  
  fs.writeFileSync('quikdown_lex.esm.min.js', esmResult.code);
}

async function createUMDBuild() {
  const source = fs.readFileSync('quikdown_lex.js', 'utf8');
  
  // Wrap in UMD
  const umdWrapper = `(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.quikdown_lex = factory());
})(this, (function () {
  'use strict';
  
  ${source.replace(/export default .+;/, 'return quikdown_lex_v2;')}
  
}));`;
  
  // Minify UMD
  const umdResult = await minify(umdWrapper, {
    compress: {
      passes: 2,
      pure_getters: true,
      unsafe: true
    },
    mangle: true
  });
  
  fs.writeFileSync('quikdown_lex.umd.min.js', umdResult.code);
}

async function reportSizes() {
  const getSize = (file) => {
    const stats = fs.statSync(file);
    return (stats.size / 1024).toFixed(1);
  };
  
  console.log(`${colors.bold}\n📊 Build Results:${colors.reset}`);
  console.log(`${colors.reset}────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.blue}Grammar:          ${getSize('grammar.js')}KB${colors.reset}`);
  console.log(`${colors.blue}Compiled Grammar: ${getSize('compiled-grammar.js')}KB${colors.reset}`);
  console.log(`${colors.blue}Parser:           ${getSize('quikdown_lex_v2.js')}KB${colors.reset}`);
  console.log(`${colors.green}Bundled:          ${getSize('quikdown_lex.js')}KB${colors.reset}`);
  console.log(`${colors.green}ESM Minified:     ${getSize('quikdown_lex.esm.min.js')}KB${colors.reset}`);
  console.log(`${colors.green}UMD Minified:     ${getSize('quikdown_lex.umd.min.js')}KB${colors.reset}`);
  
  // Compare with old version if it exists
  if (fs.existsSync('old/quikdown_lex_v1.js')) {
    const oldSize = getSize('old/quikdown_lex_v1.js');
    const newSize = getSize('quikdown_lex.js');
    const diff = ((newSize - oldSize) / oldSize * 100).toFixed(1);
    console.log(`${colors.bold}\n📈 Size Comparison:${colors.reset}`);
    console.log(`${colors.reset}────────────────────────────────────────${colors.reset}`);
    console.log(`${colors.yellow}Old version: ${oldSize}KB${colors.reset}`);
    console.log(`${colors.yellow}New version: ${newSize}KB${colors.reset}`);
    console.log(`${colors.yellow}Difference:  ${diff > 0 ? '+' : ''}${diff}%${colors.reset}`);
  }
}

// Run the build
build();