#!/usr/bin/env node

import { minify } from 'terser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('🔨 Building quikdown_lex v2...');
  
  // Read source
  const source = fs.readFileSync(path.join(__dirname, 'quikdown_lex_scanner.js'), 'utf8');
  
  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'));
  const withVersion = source.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
  
  // Write full version
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex_v2.js'), withVersion);
  
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
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex_v2.min.js'), minified.code);
  
  // Report sizes
  const sourceSize = (source.length / 1024).toFixed(1);
  const minSize = (minified.code.length / 1024).toFixed(1);
  const v1Size = fs.existsSync('../quikdown_lex.esm.min.js') 
    ? (fs.statSync('../quikdown_lex.esm.min.js').size / 1024).toFixed(1)
    : 'N/A';
  
  console.log('\n📊 Size Comparison:');
  console.log(`  v2 Source:   ${sourceSize}KB`);
  console.log(`  v2 Minified: ${minSize}KB`);
  console.log(`  v1 Minified: ${v1Size}KB`);
  console.log(`  Difference:  ${v1Size !== 'N/A' ? ((minSize - v1Size) / v1Size * 100).toFixed(1) + '%' : 'N/A'}`);
  
  console.log('\n✅ Build complete!');
}

build().catch(console.error);