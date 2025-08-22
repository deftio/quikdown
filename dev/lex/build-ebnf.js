#!/usr/bin/env node

/**
 * Build script for EBNF-based QuikDown Lexer
 * 
 * Process:
 * 1. Compile EBNF grammar to state machine
 * 2. Minify the output
 * 3. Compare with grammar1 version
 */

import { minify } from 'terser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileEBNFGrammar } from './quikdown_lex_ebnf_compiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('🔨 Building EBNF-based quikdown_lex...');
  
  try {
    // Step 1: Compile EBNF grammar
    console.log('  📝 Compiling EBNF grammar...');
    const grammarPath = path.join(__dirname, 'quikdown_lex.ebnf');
    const compiledCode = compileEBNFGrammar(grammarPath);
    
    // Step 2: Add version from package.json
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    );
    const versionedCode = compiledCode.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
    
    // Step 3: Write full version
    console.log('  💾 Writing full EBNF version...');
    const outputPath = path.join(__dirname, 'quikdown_lex_ebnf.js');
    fs.writeFileSync(outputPath, versionedCode);
    
    // Step 4: Minify
    console.log('  🗜️  Minifying EBNF version...');
    const minified = await minify(versionedCode, {
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
    
    const minPath = path.join(__dirname, 'quikdown_lex_ebnf.min.js');
    fs.writeFileSync(minPath, minified.code);
    
    // Step 5: Compare sizes
    console.log('\n📊 Size Comparison:');
    
    // EBNF version sizes
    const ebnfSize = (versionedCode.length / 1024).toFixed(1);
    const ebnfMinSize = (minified.code.length / 1024).toFixed(1);
    
    // Grammar1 version sizes (current working version)
    let grammar1Size = 'N/A';
    let grammar1MinSize = 'N/A';
    
    const grammar1Path = path.join(__dirname, 'grammar1/quikdown_lex.js');
    const grammar1MinPath = path.join(__dirname, 'grammar1/quikdown_lex.min.js');
    
    if (fs.existsSync(grammar1Path)) {
      grammar1Size = (fs.statSync(grammar1Path).size / 1024).toFixed(1);
    }
    if (fs.existsSync(grammar1MinPath)) {
      grammar1MinSize = (fs.statSync(grammar1MinPath).size / 1024).toFixed(1);
    }
    
    // Original scanner version
    let scannerSize = 'N/A';
    const scannerPath = path.join(__dirname, 'quikdown_lex_scanner.js');
    if (fs.existsSync(scannerPath)) {
      scannerSize = (fs.statSync(scannerPath).size / 1024).toFixed(1);
    }
    
    console.log('  EBNF Grammar Version:');
    console.log(`    Source: ${ebnfSize}KB`);
    console.log(`    Minified: ${ebnfMinSize}KB`);
    console.log('');
    console.log('  Grammar1 Version (JavaScript regex):');
    console.log(`    Source: ${grammar1Size}KB`);
    console.log(`    Minified: ${grammar1MinSize}KB`);
    console.log('');
    console.log('  Original Scanner (monolithic):');
    console.log(`    Source: ${scannerSize}KB`);
    console.log(`    Minified: 9.0KB`);
    
    if (grammar1MinSize !== 'N/A' && ebnfMinSize !== 'N/A') {
      const diff = ((parseFloat(ebnfMinSize) - parseFloat(grammar1MinSize)) / parseFloat(grammar1MinSize) * 100).toFixed(1);
      console.log(`\n  EBNF vs Grammar1: ${diff > 0 ? '+' : ''}${diff}%`);
    }
    
    console.log('\n✅ EBNF build complete!');
    
    // Step 6: Test the build
    console.log('\n🧪 Running basic test...');
    await testBuild();
    
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

async function testBuild() {
  try {
    // Dynamically import the built module
    const { default: quikdown_lex } = await import('./quikdown_lex_ebnf.js');
    
    // Test basic markdown
    const testCases = [
      { 
        input: '# Hello World', 
        expected: '<h1'
      },
      {
        input: '**bold** and *italic*',
        expected: '<strong'
      },
      {
        input: '```js\ncode\n```',
        expected: '<pre'
      }
    ];
    
    let passed = 0;
    for (const test of testCases) {
      const result = quikdown_lex(test.input);
      if (result.includes(test.expected)) {
        passed++;
        console.log(`  ✅ Test passed: ${test.input.slice(0, 20)}...`);
      } else {
        console.log(`  ❌ Test failed: ${test.input.slice(0, 20)}...`);
        console.log(`     Expected to contain: ${test.expected}`);
        console.log(`     Got: ${result.slice(0, 100)}...`);
      }
    }
    
    console.log(`\n  Tests: ${passed}/${testCases.length} passed`);
    
    if (passed === testCases.length) {
      console.log('  🎉 All tests passed!');
    } else {
      console.log('  ⚠️  Some tests failed');
    }
    
  } catch (error) {
    console.error('  ❌ Test error:', error.message);
  }
}

// Run the build
build().catch(console.error);