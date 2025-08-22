#!/usr/bin/env node

/**
 * Grammar-based build process for QuikDown Lexer
 * 
 * Build steps:
 * 1. Compile grammar to optimized data structures
 * 2. Inline compiled grammar into parser
 * 3. Minify for production
 */

import { minify } from 'terser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileGrammar } from './quikdown_lex_compiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to serialize regex and functions
function serializeGrammar(obj) {
  return JSON.stringify(obj, (key, val) => {
    if (val instanceof RegExp) {
      return `__REGEX__${val.toString()}__REGEX__`;
    }
    if (typeof val === 'function') {
      // For inline functions, we need to preserve them as strings
      return `__FUNCTION__${val.toString()}__FUNCTION__`;
    }
    return val;
  }, 2).replace(
    /"__REGEX__(.*?)__REGEX__"/g, 
    (match, regex) => regex
  ).replace(
    /"__FUNCTION__(.*?)__FUNCTION__"/g,
    (match, func) => func.replace(/\\n/g, '\n').replace(/\\"/g, '"')
  );
}

async function build() {
  console.log('🔨 Building grammar-driven quikdown_lex...');
  
  // Step 1: Compile grammar
  console.log('  📝 Compiling grammar...');
  const compiledGrammar = compileGrammar();
  
  // Step 2: Read parser template
  console.log('  📖 Reading parser template...');
  let parserSource = fs.readFileSync(path.join(__dirname, 'quikdown_lex_parser.js'), 'utf8');
  
  // Step 3: Inline the compiled grammar
  console.log('  🔗 Inlining compiled grammar...');
  
  // Remove import statement and replace grammar compilation
  parserSource = parserSource
    .replace(/import \{ compileGrammar \} from '\.\/quikdown_lex_compiler\.js';/, '')
    .replace(/this\.grammar = grammar \|\| compileGrammar\(\);/, 
             `this.grammar = grammar || ${serializeGrammar(compiledGrammar)};`);
  
  // Step 4: Add version
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'));
  parserSource = parserSource.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
  
  // Step 5: Write full version
  console.log('  💾 Writing full version...');
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex.js'), parserSource);
  
  // Step 6: Minify
  console.log('  🗜️  Minifying...');
  const minified = await minify(parserSource, {
    module: true,
    compress: {
      passes: 2,
      pure_getters: true,
      unsafe: true,
      unsafe_comps: true,
    },
    mangle: {
      properties: {
        regex: /^_/
      }
    }
  });
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex.min.js'), minified.code);
  
  // Report sizes
  const sourceSize = (parserSource.length / 1024).toFixed(1);
  const minSize = (minified.code.length / 1024).toFixed(1);
  const oldSize = fs.existsSync('quikdown_lex_scanner.js') 
    ? (fs.statSync('quikdown_lex_scanner.js').size / 1024).toFixed(1)
    : 'N/A';
  
  console.log('\n📊 Size Comparison:');
  console.log(`  Grammar-driven Source: ${sourceSize}KB`);
  console.log(`  Grammar-driven Min:    ${minSize}KB`);
  console.log(`  Old Scanner:          ${oldSize}KB`);
  console.log(`  Difference:           ${oldSize !== 'N/A' ? ((minSize - oldSize) / oldSize * 100).toFixed(1) + '%' : 'N/A'}`);
  
  console.log('\n✅ Build complete!');
}

build().catch(console.error);