#!/usr/bin/env node
import quikdownLex from '../dist/quikdown-lex.esm.js';
import quikdownOrig from '../dist/quikdown.esm.js';

const tests = [
  // Lists
  ['- item 1\n- item 2', 'unordered list'],
  ['1. item 1\n2. item 2', 'ordered list'],
  ['* item\n+ item\n- item', 'mixed markers'],
  ['- parent\n  - nested', 'nested list'],
  
  // Blockquotes
  ['> quote', 'simple blockquote'],
  ['> line 1\n> line 2', 'multi-line blockquote'],
  
  // Tables
  ['| A | B |\n|---|---|\n| 1 | 2 |', 'table with header'],
  ['| A | B |\n| 1 | 2 |', 'table without separator'],
  
  // Paragraphs
  ['para 1\n\npara 2', 'multiple paragraphs'],
];

console.log('=== LEXER DEBUG ===\n');

for (const [input, desc] of tests) {
  const lex = quikdownLex(input);
  const orig = quikdownOrig(input);
  const match = lex === orig;
  
  console.log(`${match ? '✓' : '✗'} ${desc}`);
  if (!match) {
    console.log('  Input:', JSON.stringify(input));
    console.log('  Lexer:', lex.substring(0, 100));
    console.log('  Original:', orig.substring(0, 100));
    console.log('');
  }
}

// Specific failing case
console.log('\n=== SPECIFIC TEST ===');
const testCase = '- item 1\n- item 2';
console.log('Input:', JSON.stringify(testCase));
console.log('Lexer output:', quikdownLex(testCase));
console.log('Original output:', quikdownOrig(testCase));