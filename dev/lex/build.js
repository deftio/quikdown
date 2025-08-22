#!/usr/bin/env node

import { minify } from 'terser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('🔨 Building quikdown_lex...');
  
  // Read source
  const source = fs.readFileSync(path.join(__dirname, 'quikdown_lex_scanner.js'), 'utf8');
  
  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'));
  const withVersion = source.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
  
  // Write full version
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex.js'), withVersion);
  
  // Minify
  const minified = await minify(withVersion, {
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
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex.min.js'), minified.code);
  
  // Report sizes
  const sourceSize = (source.length / 1024).toFixed(1);
  const minSize = (minified.code.length / 1024).toFixed(1);
  const mainSize = fs.existsSync('../../dist/quikdown.esm.min.js') 
    ? (fs.statSync('../../dist/quikdown.esm.min.js').size / 1024).toFixed(1)
    : '14.0';
  
  console.log('\n📊 Size Comparison:');
  console.log(`  Lexer Source:   ${sourceSize}KB`);
  console.log(`  Lexer Minified: ${minSize}KB`);
  console.log(`  Main Minified:  ${mainSize}KB`);
  console.log(`  Difference:     ${((minSize - mainSize) / mainSize * 100).toFixed(1)}%`);
  
  console.log('\n✅ Build complete!');
}

build().catch(console.error);