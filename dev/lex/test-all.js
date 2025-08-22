#!/usr/bin/env node

import quikdown_grammar1 from './grammar1/quikdown_lex.js';
import quikdown_trie from './quikdown_lex_trie.js';

const testCases = [
  { name: 'Heading', input: '# Hello World' },
  { name: 'Bold', input: '**bold**' },
  { name: 'Italic', input: '*italic*' },
  { name: 'Code fence', input: '```js\ncode\n```' },
  { name: 'List', input: '- Item 1\n- Item 2' },
  { name: 'Ordered list', input: '1. First\n2. Second' },
  { name: 'Link', input: '[text](url)' },
  { name: 'Image', input: '![alt](img.png)' },
  { name: 'Blockquote', input: '> Quote' },
  { name: 'HR', input: '---' },
  { name: 'Table', input: '| A | B |\n|---|---|\n| 1 | 2 |' },
  { name: 'Task list', input: '- [ ] Todo\n- [x] Done' },
  { name: 'Strikethrough', input: '~~strike~~' },
  { name: 'Inline code', input: 'Use `code` here' },
  { name: 'Escaped chars', input: 'Escape \\* and \\[' },
  { name: 'Paragraph', input: 'This is a paragraph.' },
  { name: 'Line breaks', input: 'Line 1  \nLine 2' },
  { name: 'Mixed inline', input: 'Text with **bold** and *italic*.' }
];

console.log('🧪 Testing All Lexer Implementations\n');

// Test each implementation
const implementations = [
  { name: 'Grammar1', fn: quikdown_grammar1 },
  { name: 'Trie', fn: quikdown_trie }
];

for (const impl of implementations) {
  console.log(`\n📋 Testing ${impl.name}:`);
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      const result = impl.fn(test.input);
      const expected = quikdown_grammar1(test.input); // Use Grammar1 as reference
      
      if (result === expected) {
        console.log(`  ✅ ${test.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${test.name}`);
        if (impl.name !== 'Grammar1') {
          console.log(`     Got: ${result.slice(0, 50)}...`);
          console.log(`     Exp: ${expected.slice(0, 50)}...`);
        }
        failed++;
      }
    } catch (e) {
      console.log(`  💥 ${test.name}: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`  📊 Results: ${passed}/${testCases.length} passed`);
}

// Size comparison
console.log('\n📏 Size Comparison:');
const sizes = {
  'Grammar1': '9.0KB',
  'Trie': '9.2KB'
};

for (const [name, size] of Object.entries(sizes)) {
  console.log(`  ${name}: ${size}`);
}