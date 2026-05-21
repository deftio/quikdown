#!/usr/bin/env node

/**
 * Performance benchmark for quikdown markdown parser.
 * Tests both small and large markdown documents.
 */

import quikdown from '../dist/quikdown.esm.js';

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
console.log(' QuikDown Performance Benchmark');
console.log('='.repeat(80));

const smallDoc = generateSmallDoc();
const largeDoc = generateLargeDoc();

console.log(`\nSmall document size: ${smallDoc.length} characters`);
console.log(`Large document size: ${largeDoc.length} characters`);

// Small document benchmarks
console.log('\n' + '-'.repeat(80));
console.log(' SMALL DOCUMENT (1000 iterations)');
console.log('-'.repeat(80));

const smallResult = benchmark('quikdown', quikdown, smallDoc, 1000);

console.log(`\n${smallResult.name}:`);
console.log(`  Total time: ${smallResult.totalMs}ms`);
console.log(`  Average: ${smallResult.avgMs}ms per run`);
console.log(`  Throughput: ${smallResult.opsPerSec} ops/sec`);

// Large document benchmarks
console.log('\n' + '-'.repeat(80));
console.log(' LARGE DOCUMENT (100 iterations)');
console.log('-'.repeat(80));

const largeResult = benchmark('quikdown', quikdown, largeDoc, 100);

console.log(`\n${largeResult.name}:`);
console.log(`  Total time: ${largeResult.totalMs}ms`);
console.log(`  Average: ${largeResult.avgMs}ms per run`);
console.log(`  Throughput: ${largeResult.opsPerSec} ops/sec`);

// Memory usage test (optional)
if (process.argv.includes('--memory')) {
  console.log('\n' + '-'.repeat(80));
  console.log(' MEMORY USAGE TEST');
  console.log('-'.repeat(80));

  const memBefore = process.memoryUsage();

  for (let i = 0; i < 1000; i++) {
    quikdown(largeDoc);
  }

  const memAfter = process.memoryUsage();

  console.log('\nMemory usage (after 1000 iterations):');
  console.log(`  Heap used: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)} MB`);
}

console.log('\n' + '='.repeat(80));
