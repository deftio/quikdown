#!/usr/bin/env node
// Comprehensive test of lexer-AST implementation using actual test suite

import quikdownLexer from '../dev/quikdown-lexer-ast.js';
import quikdownOriginal from '../dist/quikdown.esm.js';
import { readFileSync, writeFileSync } from 'fs';

// Test different categories
const categories = {
    'Basic Formatting': [
        ['**bold**', /<strong[^>]*>bold<\/strong>/],
        ['__bold__', /<strong[^>]*>bold<\/strong>/],
        ['*italic*', /<em[^>]*>italic<\/em>/],
        ['_italic_', /<em[^>]*>italic<\/em>/],
        ['~~strike~~', /<del[^>]*>strike<\/del>/],
        ['`code`', /<code[^>]*>code<\/code>/],
        ['**bold** and *italic*', /bold.*italic/],
    ],
    
    'Headings': [
        ['# H1', /<h1[^>]*>H1<\/h1>/],
        ['## H2', /<h2[^>]*>H2<\/h2>/],
        ['### H3', /<h3[^>]*>H3<\/h3>/],
        ['#### H4', /<h4[^>]*>H4<\/h4>/],
        ['##### H5', /<h5[^>]*>H5<\/h5>/],
        ['###### H6', /<h6[^>]*>H6<\/h6>/],
        ['# Heading #', /<h1[^>]*>Heading<\/h1>/], // trailing #
    ],
    
    'Code Blocks': [
        ['```\ncode\n```', /<pre[^>]*><code[^>]*>code<\/code><\/pre>/],
        ['```javascript\nconst x = 1;\n```', /<pre[^>]*><code[^>]*>const x = 1;<\/code><\/pre>/],
        ['~~~\ncode\n~~~', /<pre[^>]*><code[^>]*>code<\/code><\/pre>/],
        ['~~~~\ncode\n~~~~', /<pre[^>]*><code[^>]*>code<\/code><\/pre>/],
    ],
    
    'Lists': [
        ['- item 1\n- item 2', /<ul[^>]*>.*<li[^>]*>item 1<\/li>.*<li[^>]*>item 2<\/li>.*<\/ul>/s],
        ['* item 1\n* item 2', /<ul[^>]*>.*<li[^>]*>item 1<\/li>.*<li[^>]*>item 2<\/li>.*<\/ul>/s],
        ['+ item 1\n+ item 2', /<ul[^>]*>.*<li[^>]*>item 1<\/li>.*<li[^>]*>item 2<\/li>.*<\/ul>/s],
        ['1. first\n2. second', /<ol[^>]*>.*<li[^>]*>first<\/li>.*<li[^>]*>second<\/li>.*<\/ol>/s],
        ['- [ ] todo\n- [x] done', /checkbox.*todo.*checkbox.*checked.*done/s],
        ['- parent\n  - nested', /parent.*nested/s],
    ],
    
    'Blockquotes': [
        ['> quote', /<blockquote[^>]*>.*quote.*<\/blockquote>/s],
        ['> line 1\n> line 2', /<blockquote[^>]*>.*line 1.*line 2.*<\/blockquote>/s],
    ],
    
    'Tables': [
        ['| A | B |\n|---|---|\n| 1 | 2 |', /<table[^>]*>.*<th[^>]*>A<\/th>.*<th[^>]*>B<\/th>.*<td[^>]*>1<\/td>.*<td[^>]*>2<\/td>.*<\/table>/s],
        ['A | B\n---|---\n1 | 2', /<table[^>]*>.*A.*B.*1.*2.*<\/table>/s],
        ['| Left | Center | Right |\n|:---|:---:|---:|\n| L | C | R |', /text-align.*center.*text-align.*right/s],
    ],
    
    'Links & Images': [
        ['[link](http://example.com)', /<a[^>]*href="http:\/\/example\.com"[^>]*>link<\/a>/],
        ['![alt](image.jpg)', /<img[^>]*src="#"[^>]*alt="alt"/],
        ['http://auto.link', /<a[^>]*href="http:\/\/auto\.link"[^>]*>http:\/\/auto\.link<\/a>/],
    ],
    
    'Horizontal Rules': [
        ['---', /<hr[^>]*>/],
        ['***', /<hr[^>]*>/],
        ['___', /<hr[^>]*>/],
        ['- - -', /<hr[^>]*>/],
    ],
    
    'Edge Cases': [
        ['', ''],
        ['plain text', /<p>plain text<\/p>/],
        ['line 1\nline 2', /<p>line 1\nline 2<\/p>/],
        ['line 1\n\nline 2', /<p>line 1<\/p>.*<p>line 2<\/p>/s],
        ['<script>alert(1)</script>', /&lt;script&gt;/],
        ['[xss](javascript:alert(1))', /href="#"/],
    ],
};

let totalPassed = 0;
let totalFailed = 0;
const results = {};

console.log('=== COMPREHENSIVE LEXER-AST TESTING ===\n');

for (const [category, tests] of Object.entries(categories)) {
    console.log(`\n${category}:`);
    let catPassed = 0;
    let catFailed = 0;
    const catFailures = [];
    
    for (const [input, pattern] of tests) {
        try {
            const lexerResult = quikdownLexer(input);
            const originalResult = quikdownOriginal(input);
            
            const lexerMatches = pattern instanceof RegExp ? pattern.test(lexerResult) : lexerResult === pattern;
            const originalMatches = pattern instanceof RegExp ? pattern.test(originalResult) : originalResult === pattern;
            
            if (lexerMatches) {
                catPassed++;
                process.stdout.write('✓');
            } else {
                catFailed++;
                process.stdout.write('✗');
                catFailures.push({
                    input: input.substring(0, 40).replace(/\n/g, '\\n'),
                    pattern: pattern.toString(),
                    lexer: lexerResult.substring(0, 100),
                    original: originalResult.substring(0, 100),
                    originalPasses: originalMatches
                });
            }
        } catch (error) {
            catFailed++;
            process.stdout.write('E');
            catFailures.push({
                input: input.substring(0, 40).replace(/\n/g, '\\n'),
                error: error.message
            });
        }
    }
    
    console.log(` [${catPassed}/${tests.length}]`);
    totalPassed += catPassed;
    totalFailed += catFailed;
    
    results[category] = {
        passed: catPassed,
        total: tests.length,
        failures: catFailures
    };
}

console.log('\n=== SUMMARY ===');
console.log(`Total Passed: ${totalPassed}/${totalPassed + totalFailed} (${((totalPassed/(totalPassed+totalFailed))*100).toFixed(1)}%)`);
console.log(`Total Failed: ${totalFailed}/${totalPassed + totalFailed}`);

// Show failures
console.log('\n=== FAILURES BY CATEGORY ===');
for (const [category, data] of Object.entries(results)) {
    if (data.failures.length > 0) {
        console.log(`\n${category}:`);
        for (const fail of data.failures) {
            console.log(`  ✗ "${fail.input}"`);
            if (fail.error) {
                console.log(`    Error: ${fail.error}`);
            } else {
                console.log(`    Original passes: ${fail.originalPasses}`);
                if (!fail.originalPasses) {
                    console.log(`    Pattern might be wrong: ${fail.pattern.substring(0, 50)}`);
                }
            }
        }
    }
}

// Performance test
console.log('\n=== PERFORMANCE TEST ===');
const largeMd = `# Large Document\n\n${'This is a paragraph with **bold** and *italic* text.\n\n'.repeat(100)}`;

console.time('Lexer-AST');
for (let i = 0; i < 100; i++) {
    quikdownLexer(largeMd);
}
console.timeEnd('Lexer-AST');

console.time('Original');
for (let i = 0; i < 100; i++) {
    quikdownOriginal(largeMd);
}
console.timeEnd('Original');

// Size analysis
console.log('\n=== SIZE ANALYSIS ===');
const lexerSrc = readFileSync('./dev/quikdown-lexer-ast.js', 'utf-8');
const originalSrc = readFileSync('./src/quikdown.js', 'utf-8');

console.log(`Lexer-AST: ${lexerSrc.length} bytes (${(lexerSrc.length/1024).toFixed(1)}KB)`);
console.log(`Original: ${originalSrc.length} bytes (${(originalSrc.length/1024).toFixed(1)}KB)`);
console.log(`Difference: ${(lexerSrc.length - originalSrc.length)} bytes`);

// Minification potential
import terser from '@rollup/plugin-terser';
async function minifyEstimate(code) {
    try {
        const result = await terser.minify(code, {
            mangle: true,
            compress: true
        });
        return result.code?.length || code.length;
    } catch {
        return code.length;
    }
}

const lexerMin = await minifyEstimate(lexerSrc);
const originalMin = await minifyEstimate(originalSrc);

console.log(`\nEstimated minified sizes:`);
console.log(`Lexer-AST: ~${lexerMin} bytes`);
console.log(`Original: ~${originalMin} bytes`);