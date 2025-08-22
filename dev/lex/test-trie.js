#!/usr/bin/env node

import quikdown_trie from './quikdown_lex_trie.js';
import quikdown_grammar1 from './grammar1/quikdown_lex.js';

const testCases = [
  { name: 'Heading', input: '# Hello World' },
  { name: 'Bold', input: '**bold**' },
  { name: 'Italic', input: '*italic*' },
  { name: 'Code', input: '```js\ncode\n```' },
  { name: 'List', input: '- Item 1\n- Item 2' },
  { name: 'Link', input: '[text](url)' },
  { name: 'Image', input: '![alt](img.png)' },
  { name: 'Blockquote', input: '> Quote' },
  { name: 'HR', input: '---' },
  { name: 'Table', input: '| A | B |\n|---|---|\n| 1 | 2 |' },
  { name: 'Paragraph', input: 'This is a paragraph.' },
  { name: 'Mixed', input: 'Text with **bold** and *italic*.' }
];

console.log('🧪 Testing Trie-Based Lexer\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  try {
    const trieResult = quikdown_trie(test.input);
    const grammar1Result = quikdown_grammar1(test.input);
    
    if (trieResult === grammar1Result) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Input: ${test.input.replace(/\n/g, '\\n')}`);
      console.log(`   Trie:  ${trieResult.slice(0, 60)}`);
      console.log(`   Gram1: ${grammar1Result.slice(0, 60)}`);
      failed++;
    }
  } catch (e) {
    console.log(`💥 ${test.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed}/${testCases.length} passed`);

if (failed === 0) {
  console.log('🎉 All tests passed! Trie lexer works correctly.');
} else {
  console.log(`⚠️  ${failed} tests failed.`);
}

// Performance test
if (passed > 0) {
  console.log('\n⏱️  Performance Test:');
  const perfInput = testCases.map(t => t.input).join('\n\n');
  const iterations = 1000;
  
  console.time('Trie Lexer');
  for (let i = 0; i < iterations; i++) {
    quikdown_trie(perfInput);
  }
  console.timeEnd('Trie Lexer');
  
  console.time('Grammar1 Lexer');
  for (let i = 0; i < iterations; i++) {
    quikdown_grammar1(perfInput);
  }
  console.timeEnd('Grammar1 Lexer');
}