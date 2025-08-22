#!/usr/bin/env node

/**
 * Test EBNF lexer vs Grammar1 lexer
 */

import quikdown_ebnf from './quikdown_lex_ebnf.js';
import quikdown_grammar1 from './grammar1/quikdown_lex.js';

const testCases = [
  { 
    name: 'Heading',
    input: '# Hello World',
  },
  {
    name: 'Bold and Italic',
    input: '**bold** and *italic* and __also bold__ and _also italic_',
  },
  {
    name: 'Code fence',
    input: '```js\nconst x = 1;\n```',
  },
  {
    name: 'List',
    input: '- Item 1\n- Item 2\n  - Nested',
  },
  {
    name: 'Table',
    input: '| Col1 | Col2 |\n|------|------|\n| A    | B    |',
  },
  {
    name: 'Links and Images',
    input: '[link](http://example.com) and ![image](img.png)',
  },
  {
    name: 'Blockquote',
    input: '> This is a quote',
  },
  {
    name: 'Task list',
    input: '- [ ] Todo\n- [x] Done',
  },
  {
    name: 'Strikethrough',
    input: '~~strikethrough~~',
  },
  {
    name: 'Inline code',
    input: 'Use `code` inline',
  },
  {
    name: 'HR',
    input: '---',
  },
  {
    name: 'Paragraph with line breaks',
    input: 'Line 1  \nLine 2',
  },
  {
    name: 'Nested list',
    input: '1. First\n2. Second\n   1. Nested ordered\n   2. Another nested',
  },
  {
    name: 'Complex paragraph',
    input: 'This has **bold** and *italic* and `code` and [links](url) all mixed.',
  },
  {
    name: 'Escaped characters',
    input: 'Escape \\* and \\[ and \\`',
  }
];

console.log('🧪 Testing EBNF Lexer vs Grammar1 Lexer\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const ebnfResult = quikdown_ebnf(test.input);
  const grammar1Result = quikdown_grammar1(test.input);
  
  if (ebnfResult === grammar1Result) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Input: ${test.input.replace(/\n/g, '\\n')}`);
    console.log(`   EBNF:     ${ebnfResult.slice(0, 100)}`);
    console.log(`   Grammar1: ${grammar1Result.slice(0, 100)}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed}/${testCases.length} passed`);

if (failed === 0) {
  console.log('🎉 All tests passed! EBNF lexer has parity with Grammar1.');
} else {
  console.log(`⚠️  ${failed} tests failed. Need to fix parity issues.`);
}

// Performance comparison
console.log('\n⏱️  Performance Comparison:');

const perfInput = testCases.map(t => t.input).join('\n\n');
const iterations = 1000;

console.time('EBNF Lexer');
for (let i = 0; i < iterations; i++) {
  quikdown_ebnf(perfInput);
}
console.timeEnd('EBNF Lexer');

console.time('Grammar1 Lexer');
for (let i = 0; i < iterations; i++) {
  quikdown_grammar1(perfInput);
}
console.timeEnd('Grammar1 Lexer');