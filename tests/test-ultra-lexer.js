#!/usr/bin/env node
import quikdownUltra from '../dev/quikdown-ultra-lexer.js';
import quikdownOriginal from '../dist/quikdown.esm.js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const tests = [
    // Basic
    ['**bold**', /<strong.*>bold<\/strong>/],
    ['*italic*', /<em.*>italic<\/em>/],
    ['~~strike~~', /<del.*>strike<\/del>/],
    ['`code`', /<code.*>code<\/code>/],
    
    // Headings
    ['# H1', /<h1.*>H1<\/h1>/],
    ['## H2', /<h2.*>H2<\/h2>/],
    
    // Lists
    ['- item 1\n- item 2', /<ul.*>.*<li.*>item 1<\/li>.*<li.*>item 2<\/li>.*<\/ul>/s],
    ['1. first\n2. second', /<ol.*>.*<li.*>first<\/li>.*<li.*>second<\/li>.*<\/ol>/s],
    ['- [ ] todo\n- [x] done', /checkbox.*todo.*checkbox.*checked.*done/s],
    
    // Code blocks
    ['```\ncode\n```', /<pre.*><code.*>code<\/code><\/pre>/],
    ['```js\nconst x = 1;\n```', /<pre.*><code.*>const x = 1;<\/code><\/pre>/],
    
    // Blockquotes
    ['> quote', /<blockquote.*>.*quote.*<\/blockquote>/s],
    
    // Tables
    ['| A | B |\n|---|---|\n| 1 | 2 |', /<table.*>.*<th.*>A<\/th>.*<th.*>B<\/th>.*<td.*>1<\/td>.*<td.*>2<\/td>.*<\/table>/s],
    
    // Links
    ['[link](http://example.com)', /<a.*href="http:\/\/example\.com".*>link<\/a>/],
    ['![alt](image.jpg)', /<img.*src="image\.jpg".*alt="alt"/],
    
    // HR
    ['---', /<hr.*>/],
    
    // Paragraphs
    ['text', /<p>text<\/p>/],
    ['line 1\n\nline 2', /<p>line 1<\/p>.*<p>line 2<\/p>/s],
    
    // XSS
    ['<script>alert(1)</script>', /&lt;script&gt;/],
    ['[xss](javascript:alert(1))', /href="#"/],
    
    // Complex
    ['# Title\n\nParagraph with **bold** and *italic*.\n\n- List item', /h1.*Title.*p.*strong.*bold.*em.*italic.*ul.*li.*List item/s],
];

console.log('=== ULTRA-LEXER TESTING ===\n');

let passed = 0;
let failed = 0;
const failures = [];

for (const [input, pattern] of tests) {
    try {
        const result = quikdownUltra(input);
        const original = quikdownOriginal(input);
        
        if (pattern.test(result)) {
            passed++;
            process.stdout.write('✓');
        } else {
            failed++;
            process.stdout.write('✗');
            failures.push({
                input: input.substring(0, 50).replace(/\n/g, '\\n'),
                pattern: pattern.toString().substring(0, 50),
                result: result.substring(0, 100),
                original: original.substring(0, 100)
            });
        }
    } catch (error) {
        failed++;
        process.stdout.write('E');
        failures.push({
            input: input.substring(0, 50).replace(/\n/g, '\\n'),
            error: error.message
        });
    }
}

console.log(`\n\nPassed: ${passed}/${tests.length} (${(passed/tests.length*100).toFixed(1)}%)`);

if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => {
        console.log(`  "${f.input}"`);
        if (f.error) {
            console.log(`    Error: ${f.error}`);
        } else {
            console.log(`    Expected pattern: ${f.pattern}`);
            console.log(`    Got: ${f.result}`);
        }
    });
}

// Performance comparison
console.log('\n=== PERFORMANCE ===');
const largeMd = '# Test\n\n' + 'This is **bold** and *italic* text.\n\n'.repeat(100);

console.time('Ultra-Lexer');
for(let i = 0; i < 1000; i++) quikdownUltra(largeMd);
console.timeEnd('Ultra-Lexer');

console.time('Original');
for(let i = 0; i < 1000; i++) quikdownOriginal(largeMd);
console.timeEnd('Original');

// Size comparison
console.log('\n=== SIZE COMPARISON ===');
console.log('Source sizes:');
console.log(`  Ultra-Lexer: ${readFileSync('./dev/quikdown-ultra-lexer.js').length} bytes`);
console.log(`  Original: ${readFileSync('./src/quikdown.js').length} bytes`);

// Test minified version
console.log('\n=== MINIFIED SIZES ===');
const ultraMin = execSync('npx terser dev/quikdown-ultra-lexer.js -c -m | wc -c').toString().trim();
const origMin = execSync('npx terser src/quikdown.js -c -m | wc -c').toString().trim();
console.log(`Ultra-Lexer minified: ${ultraMin} bytes`);
console.log(`Original minified: ${origMin} bytes`);
console.log(`Savings: ${origMin - ultraMin} bytes`);