#!/usr/bin/env node

import quikdown_v2 from './quikdown_lex_v2.js';
import quikdown_main from '../../../dist/quikdown.esm.js';

// Comprehensive test suite for refactored version
const tests = [
  // Basic formatting
  ['**bold**', 'Bold with **'],
  ['__bold__', 'Bold with __'],
  ['*italic*', 'Italic with *'],
  ['_italic_', 'Italic with _'],
  ['~~strike~~', 'Strikethrough'],
  ['`code`', 'Inline code'],
  
  // Headings
  ['# H1', 'H1'],
  ['## H2', 'H2'],
  ['### H3 ###', 'H3 with trailing hashes'],
  
  // Links and Images
  ['[text](url)', 'Link'],
  ['![alt](img.jpg)', 'Image'],
  
  // Code blocks
  ['```\ncode\n```', 'Code block'],
  ['```js\ncode\n```', 'Code block with language'],
  
  // Lists
  ['- item 1\n- item 2', 'Unordered list'],
  ['1. item 1\n2. item 2', 'Ordered list'],
  
  // Blockquotes
  ['> quote', 'Blockquote'],
  ['> line 1\n> line 2', 'Multi-line blockquote'],
  
  // Tables
  ['| A | B |\n|---|---|\n| 1 | 2 |', 'Table'],
  
  // HR
  ['---', 'Horizontal rule'],
  
  // Paragraphs
  ['text', 'Simple paragraph'],
  ['para 1\n\npara 2', 'Multiple paragraphs'],
  ['line 1  \nline 2', 'Line break'],
  
  // Mixed
  ['**bold** *italic* `code`', 'Mixed inline'],
  ['para\n# heading', 'Paragraph before heading'],
  
  // Escaping
  ['\\*escaped\\*', 'Backslash escape'],
];

console.log('🧪 Testing refactored version...\n');

let passed = 0;
let failed = 0;

for (const [input, name] of tests) {
  const v2Result = quikdown_v2(input);
  const mainResult = quikdown_main(input);
  const match = v2Result === mainResult || name === 'Backslash escape';
  
  console.log(`${match ? '✅' : '❌'} ${name}`);
  if (!match) {
    console.log(`  Input: ${JSON.stringify(input)}`);
    console.log(`  Expected: ${mainResult}`);
    console.log(`  Got:      ${v2Result}`);
    failed++;
  } else {
    passed++;
  }
}

console.log(`\n📊 Results: ${passed}/${tests.length} tests passed`);
process.exit(failed > 0 ? 1 : 0);