#!/usr/bin/env node

/**
 * Minify theme CSS files for production use
 * Creates .min.css versions of the theme files
 */

import { promises as fs } from 'fs';
import path from 'path';
import CleanCSS from 'clean-css';

const distDir = path.join(process.cwd(), 'dist');

async function minifyCSS(inputFile, outputFile) {
  try {
    // Read the input CSS
    const input = await fs.readFile(inputFile, 'utf-8');
    
    // Minify with clean-css
    const options = {
      level: 2, // Advanced optimizations
      compatibility: 'ie11'
    };
    const output = new CleanCSS(options).minify(input);
    
    if (output.errors && output.errors.length > 0) {
      console.error(`Errors minifying ${inputFile}:`, output.errors);
      return false;
    }
    
    // Add minimal header
    const minified = `/* QuikDown Theme CSS (minified) */\n${output.styles}`;
    
    // Write minified output
    await fs.writeFile(outputFile, minified, 'utf-8');
    
    // Calculate size reduction
    const originalSize = Buffer.byteLength(input, 'utf-8');
    const minifiedSize = Buffer.byteLength(minified, 'utf-8');
    const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✓ ${path.basename(outputFile)}: ${(minifiedSize / 1024).toFixed(2)}KB (${reduction}% reduction)`);
    return true;
  } catch (error) {
    console.error(`Error processing ${inputFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Minifying QuikDown theme CSS files...\n');
  
  const files = [
    {
      input: path.join(distDir, 'quikdown.light.css'),
      output: path.join(distDir, 'quikdown.light.min.css')
    },
    {
      input: path.join(distDir, 'quikdown.dark.css'),
      output: path.join(distDir, 'quikdown.dark.min.css')
    }
  ];
  
  let success = true;
  for (const { input, output } of files) {
    const result = await minifyCSS(input, output);
    success = success && result;
  }
  
  if (success) {
    console.log('\n✅ All theme CSS files minified successfully!');
    console.log('\nUsage:');
    console.log('  Development: quikdown.light.css, quikdown.dark.css');
    console.log('  Production:  quikdown.light.min.css, quikdown.dark.min.css');
  } else {
    console.error('\n❌ Some files failed to minify');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});