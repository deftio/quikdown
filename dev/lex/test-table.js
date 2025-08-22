#!/usr/bin/env node

import quikdown_table from './quikdown_lex_table.js';
import quikdown_grammar1 from './grammar1/quikdown_lex.js';

const testCases = [
  { name: 'Heading', input: '# Hello' },
  { name: 'Bold', input: '**bold**' },
  { name: 'Code', input: '```js\ncode\n```' },
  { name: 'List', input: '- Item 1\n- Item 2' },
  { name: 'Link', input: '[text](url)' },
];

console.log('🧪 Testing Table-Driven Parser\n');

for (const test of testCases) {
  try {
    const tableResult = quikdown_table(test.input);
    const grammar1Result = quikdown_grammar1(test.input);
    
    if (tableResult === grammar1Result) {
      console.log(`✅ ${test.name}`);
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Table: ${tableResult.slice(0, 50)}`);
      console.log(`   Gram1: ${grammar1Result.slice(0, 50)}`);
    }
  } catch (e) {
    console.log(`💥 ${test.name}: ${e.message}`);
  }
}