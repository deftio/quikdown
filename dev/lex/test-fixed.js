#!/usr/bin/env node

import quikdown_grammar1 from './grammar1/quikdown_lex.js';
import quikdown_trie_fix from './quikdown_lex_trie_fix.js';

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
  { name: 'Mixed inline', input: 'Text with **bold** and *italic*.' },
  { name: 'Nested list', input: '1. First\n2. Second\n   - Nested' },
  { name: 'Complex', input: '# Title\n\nParagraph with **bold**.\n\n- List item\n- Another\n\n```\ncode\n```' }
];

console.log('🧪 Testing Fixed Trie Lexer\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  try {
    const result = quikdown_trie_fix(test.input);
    const expected = quikdown_grammar1(test.input);
    
    if (result === expected) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Input: ${test.input.replace(/\n/g, '\\n').slice(0, 50)}`);
      console.log(`   Got:   ${result.slice(0, 60).replace(/\n/g, '\\n')}`);
      console.log(`   Exp:   ${expected.slice(0, 60).replace(/\n/g, '\\n')}`);
      failed++;
    }
  } catch (e) {
    console.log(`💥 ${test.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed}/${testCases.length} passed`);

if (failed === 0) {
  console.log('🎉 All tests passed! 100% parity achieved!');
  
  // Minify and check size
  console.log('\n📏 Checking size...');
  import('terser').then(async ({ minify }) => {
    const code = await import('fs').then(fs => 
      fs.promises.readFile('./quikdown_lex_trie_fix.js', 'utf8')
    );
    
    const minified = await minify(code, {
      module: true,
      compress: {
        passes: 2,
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
      },
      mangle: true
    });
    
    console.log(`  Source: ${(code.length / 1024).toFixed(1)}KB`);
    console.log(`  Minified: ${(minified.code.length / 1024).toFixed(1)}KB`);
  });
} else {
  console.log(`⚠️  ${failed} tests failed.`);
}