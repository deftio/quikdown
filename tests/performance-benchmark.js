#!/usr/bin/env node

/**
 * Performance benchmark comparing regex and lexer implementations
 * Tests both small and large markdown documents
 */

import quikdownRegex from '../dist/quikdown.esm.js';
import quikdownLex from '../dist/quikdown-lex.esm.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate test documents
const generateSmallDoc = () => `
# Small Document

This is a **small** document with *various* markdown elements.

## Lists
- Item 1
- Item 2
  - Nested item
- Item 3

## Code
\`\`\`javascript
function test() {
  return "hello";
}
\`\`\`

## Table
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

> This is a blockquote
> with multiple lines

[Link](https://example.com) and ![Image](image.jpg)
`;

const generateLargeDoc = () => {
  let doc = '# Large Document\n\n';
  
  // Add 100 sections
  for (let i = 0; i < 100; i++) {
    doc += `## Section ${i + 1}\n\n`;
    doc += `This is paragraph ${i + 1} with **bold** and *italic* text. `;
    doc += `Here's a [link ${i}](https://example.com/${i}) and some \`inline code\`.\n\n`;
    
    // Add a list every 5 sections
    if (i % 5 === 0) {
      doc += `### List ${i / 5 + 1}\n`;
      for (let j = 0; j < 10; j++) {
        doc += `- List item ${j + 1}\n`;
        if (j % 3 === 0) {
          doc += `  - Nested item ${j}\n`;
        }
      }
      doc += '\n';
    }
    
    // Add a table every 10 sections
    if (i % 10 === 0) {
      doc += `### Table ${i / 10 + 1}\n`;
      doc += '| Column A | Column B | Column C |\n';
      doc += '|----------|----------|----------|\n';
      for (let j = 0; j < 5; j++) {
        doc += `| A${j} | B${j} | C${j} |\n`;
      }
      doc += '\n';
    }
    
    // Add a code block every 7 sections
    if (i % 7 === 0) {
      doc += '```javascript\n';
      doc += `function section${i}() {\n`;
      doc += `  console.log("Section ${i}");\n`;
      doc += `  return ${i};\n`;
      doc += '}\n';
      doc += '```\n\n';
    }
    
    // Add a blockquote every 8 sections
    if (i % 8 === 0) {
      doc += `> Quote from section ${i}\n`;
      doc += `> with multiple lines\n`;
      doc += `> and **formatting**\n\n`;
    }
  }
  
  return doc;
};

// Benchmark function
const benchmark = (name, fn, input, iterations = 1000) => {
  // Warm up
  for (let i = 0; i < 10; i++) {
    fn(input);
  }
  
  // Actual benchmark
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn(input);
  }
  const end = process.hrtime.bigint();
  
  const totalMs = Number(end - start) / 1000000;
  const avgMs = totalMs / iterations;
  
  return {
    name,
    totalMs: totalMs.toFixed(2),
    avgMs: avgMs.toFixed(4),
    opsPerSec: Math.round(1000 / avgMs)
  };
};

// Run benchmarks
console.log('='.repeat(80));
console.log(' QuikDown Performance Benchmark - Regex vs Lexer Implementation');
console.log('='.repeat(80));

const smallDoc = generateSmallDoc();
const largeDoc = generateLargeDoc();

console.log(`\nSmall document size: ${smallDoc.length} characters`);
console.log(`Large document size: ${largeDoc.length} characters`);

// Small document benchmarks
console.log('\n' + '-'.repeat(80));
console.log(' SMALL DOCUMENT (1000 iterations)');
console.log('-'.repeat(80));

const smallRegex = benchmark('Regex Implementation', quikdownRegex, smallDoc, 1000);
const smallLex = benchmark('Lexer Implementation', quikdownLex, smallDoc, 1000);

console.log(`\n${smallRegex.name}:`);
console.log(`  Total time: ${smallRegex.totalMs}ms`);
console.log(`  Average: ${smallRegex.avgMs}ms per run`);
console.log(`  Throughput: ${smallRegex.opsPerSec} ops/sec`);

console.log(`\n${smallLex.name}:`);
console.log(`  Total time: ${smallLex.totalMs}ms`);
console.log(`  Average: ${smallLex.avgMs}ms per run`);
console.log(`  Throughput: ${smallLex.opsPerSec} ops/sec`);

const smallDiff = ((parseFloat(smallLex.avgMs) / parseFloat(smallRegex.avgMs) - 1) * 100).toFixed(1);
console.log(`\nDifference: Lexer is ${smallDiff > 0 ? '+' : ''}${smallDiff}% ${smallDiff > 0 ? 'slower' : 'faster'}`);

// Large document benchmarks
console.log('\n' + '-'.repeat(80));
console.log(' LARGE DOCUMENT (100 iterations)');
console.log('-'.repeat(80));

const largeRegex = benchmark('Regex Implementation', quikdownRegex, largeDoc, 100);
const largeLex = benchmark('Lexer Implementation', quikdownLex, largeDoc, 100);

console.log(`\n${largeRegex.name}:`);
console.log(`  Total time: ${largeRegex.totalMs}ms`);
console.log(`  Average: ${largeRegex.avgMs}ms per run`);
console.log(`  Throughput: ${largeRegex.opsPerSec} ops/sec`);

console.log(`\n${largeLex.name}:`);
console.log(`  Total time: ${largeLex.totalMs}ms`);
console.log(`  Average: ${largeLex.avgMs}ms per run`);
console.log(`  Throughput: ${largeLex.opsPerSec} ops/sec`);

const largeDiff = ((parseFloat(largeLex.avgMs) / parseFloat(largeRegex.avgMs) - 1) * 100).toFixed(1);
console.log(`\nDifference: Lexer is ${largeDiff > 0 ? '+' : ''}${largeDiff}% ${largeDiff > 0 ? 'slower' : 'faster'}`);

// Summary
console.log('\n' + '='.repeat(80));
console.log(' SUMMARY');
console.log('='.repeat(80));
console.log(`\nBundle sizes:`);
console.log(`  Regex: ~7.0KB minified`);
console.log(`  Lexer: ~7.9KB minified (+0.9KB)`);
console.log(`\nPerformance:`);
console.log(`  Small docs: Lexer is ${smallDiff > 0 ? '+' : ''}${smallDiff}% ${smallDiff > 0 ? 'slower' : 'faster'}`);
console.log(`  Large docs: Lexer is ${largeDiff > 0 ? '+' : ''}${largeDiff}% ${largeDiff > 0 ? 'slower' : 'faster'}`);

// Memory usage test (optional)
if (process.argv.includes('--memory')) {
  console.log('\n' + '-'.repeat(80));
  console.log(' MEMORY USAGE TEST');
  console.log('-'.repeat(80));
  
  const memBefore = process.memoryUsage();
  
  // Parse large doc 1000 times with both implementations
  for (let i = 0; i < 500; i++) {
    quikdownRegex(largeDoc);
    quikdownLex(largeDoc);
  }
  
  const memAfter = process.memoryUsage();
  
  console.log('\nMemory usage (after 500 iterations each):');
  console.log(`  Heap used: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)} MB`);
}

console.log('\n' + '='.repeat(80));