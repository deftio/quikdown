#!/usr/bin/env node

import quikdown_v2 from './quikdown_lex_v2.js';
import quikdown_main from '../../../dist/quikdown.esm.js';

// Comprehensive test cases covering all markdown features
const tests = [
  // Basic inline formatting
  ['**bold**', 'Bold with **'],
  ['__bold__', 'Bold with __'],
  ['*italic*', 'Italic with *'],
  ['_italic_', 'Italic with _'],
  ['~~strike~~', 'Strikethrough'],
  ['`code`', 'Inline code'],
  ['**bold** and *italic*', 'Mixed bold and italic'],
  ['**bold *italic* bold**', 'Nested formatting'],
  
  // Headings
  ['# H1', 'H1'],
  ['## H2', 'H2'],
  ['### H3', 'H3'],
  ['#### H4', 'H4'],
  ['##### H5', 'H5'],
  ['###### H6', 'H6'],
  ['### H3 ###', 'H3 with trailing hashes'],
  ['####### Not H7', 'Invalid heading level'],
  
  // Links and Images
  ['[text](url)', 'Simple link'],
  ['[text](http://example.com)', 'HTTP link'],
  ['![alt](img.jpg)', 'Image'],
  ['[![alt](img.jpg)](url)', 'Image link'],
  ['[link with *italic*](url)', 'Link with formatting'],
  
  // Code blocks
  ['```\ncode\n```', 'Code block'],
  ['```js\nconst x = 1;\n```', 'Code block with language'],
  ['~~~\ncode\n~~~', 'Code block with tildes'],
  ['~~~python\nprint("hi")\n~~~', 'Tilde block with language'],
  
  // Lists
  ['- item 1\n- item 2', 'Unordered list'],
  ['* item 1\n* item 2', 'Unordered with asterisk'],
  ['+ item 1\n+ item 2', 'Unordered with plus'],
  ['1. item 1\n2. item 2', 'Ordered list'],
  ['1. item\n   continued', 'List item continuation'],
  ['- [ ] unchecked\n- [x] checked', 'Task list'],
  
  // Nested lists
  ['- item 1\n  - nested\n- item 2', 'Nested list'],
  ['1. item 1\n   1. nested\n2. item 2', 'Nested ordered'],
  
  // Blockquotes
  ['> quote', 'Single blockquote'],
  ['> line 1\n> line 2', 'Multi-line blockquote'],
  ['> quote\n\npara', 'Quote then paragraph'],
  
  // Tables
  ['| A | B |\n|---|---|\n| 1 | 2 |', 'Simple table'],
  ['| Left | Center | Right |\n|:---|:---:|---:|\n| L | C | R |', 'Table with alignment'],
  
  // Horizontal rules
  ['---', 'HR with dashes'],
  ['-----', 'HR with more dashes'],
  
  // Paragraphs and line breaks
  ['text', 'Simple paragraph'],
  ['para 1\n\npara 2', 'Multiple paragraphs'],
  ['line 1  \nline 2', 'Line break with spaces'],
  ['para 1\npara 2', 'Single newline in paragraph'],
  
  // Mixed content
  ['text\n\n# heading\n\nmore text', 'Heading between paragraphs'],
  ['para\n> quote\npara', 'Quote in middle'],
  ['text\n\n- list\n\ntext', 'List between paragraphs'],
  
  // Edge cases
  ['\\*escaped\\*', 'Escaped asterisks'],
  ['\\[not a link\\]', 'Escaped brackets'],
  ['*not closed', 'Unclosed italic'],
  ['**not closed', 'Unclosed bold'],
  ['[link]()', 'Link with empty URL'],
  ['![](image.jpg)', 'Image with empty alt'],
  
  // Autolinks
  ['<http://example.com>', 'Autolink'],
  ['<https://example.com>', 'HTTPS autolink'],
  
  // Complex combinations
  ['# Heading\n\nPara with **bold** and *italic*.\n\n- List item 1\n- List item 2\n\n> Quote\n\n```\ncode\n```', 'Complex document'],
];

console.log('🧪 Testing parity with main version...\n');

let passed = 0;
let failed = 0;
const failures = [];

for (const [input, name] of tests) {
  const v2Result = quikdown_v2(input);
  const mainResult = quikdown_main(input);
  const match = v2Result === mainResult;
  
  if (match) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failures.push({ name, input, expected: mainResult, got: v2Result });
    failed++;
  }
}

console.log(`\n📊 Results: ${passed}/${tests.length} tests passed (${(passed/tests.length*100).toFixed(1)}% parity)`);

if (failures.length > 0) {
  console.log('\n❌ Failed tests:');
  for (const { name, input, expected, got } of failures) {
    console.log(`\n${name}:`);
    console.log(`  Input: ${JSON.stringify(input)}`);
    console.log(`  Expected: ${expected}`);
    console.log(`  Got:      ${got}`);
  }
}

process.exit(failed > 0 ? 1 : 0);