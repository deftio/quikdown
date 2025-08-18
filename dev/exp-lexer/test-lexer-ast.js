// Test harness to run the existing test suite against the lexer-AST implementation
import quikdownLexer from '../dev/quikdown-lexer-ast.js';
import quikdownOriginal from '../dist/quikdown.esm.js';

// Basic comparison tests
const testCases = [
    // Basic formatting
    ['**bold**', '<p><strong class="quikdown-strong">bold</strong></p>'],
    ['*italic*', '<p><em class="quikdown-em">italic</em></p>'],
    ['~~strike~~', '<p><del class="quikdown-del">strike</del></p>'],
    ['`code`', '<p><code class="quikdown-code">code</code></p>'],
    
    // Headings
    ['# H1', '<h1 class="quikdown-h1">H1</h1>'],
    ['## H2', '<h2 class="quikdown-h2">H2</h2>'],
    ['### H3', '<h3 class="quikdown-h3">H3</h3>'],
    
    // Lists
    ['- item 1\n- item 2', '<ul class="quikdown-ul"><li class="quikdown-li">item 1</li><li class="quikdown-li">item 2</li></ul>'],
    ['1. first\n2. second', '<ol class="quikdown-ol"><li class="quikdown-li">first</li><li class="quikdown-li">second</li></ol>'],
    
    // Code blocks
    ['```\ncode\n```', '<pre class="quikdown-pre"><code>code</code></pre>'],
    ['```js\nconst x = 1;\n```', '<pre class="quikdown-pre"><code class="language-js">const x = 1;</code></pre>'],
    
    // Blockquotes
    ['> quote', '<blockquote class="quikdown-blockquote">quote</blockquote>'],
    
    // Tables
    ['| A | B |\n|---|---|\n| 1 | 2 |', /table.*th.*A.*B.*td.*1.*2/],
    
    // Links and images
    ['[link](url)', '<p><a class="quikdown-a" href="#" rel="noopener noreferrer">link</a></p>'],
    ['![alt](image.jpg)', '<p><img class="quikdown-img" src="#" alt="alt"></p>'],
    
    // Task lists
    ['- [ ] unchecked\n- [x] checked', /checkbox.*unchecked.*checkbox.*checked.*checked/],
    
    // Horizontal rule
    ['---', '<hr class="quikdown-hr">'],
    
    // Complex nested
    ['# Title\n\nParagraph with **bold** and *italic*.\n\n- List item\n  - Nested item', /h1.*Title.*p.*strong.*bold.*em.*italic.*ul.*li.*List item.*ul.*li.*Nested item/],
];

let passed = 0;
let failed = 0;
const failures = [];

console.log('Testing quikdown-lexer-ast.js implementation...\n');

for (const [input, expected] of testCases) {
    try {
        const result = quikdownLexer(input);
        const original = quikdownOriginal(input);
        
        let testPassed = false;
        let testName = input.substring(0, 50).replace(/\n/g, '\\n');
        
        if (expected instanceof RegExp) {
            // Regex test - check if pattern matches
            testPassed = expected.test(result);
            if (!testPassed) {
                failures.push({
                    input: testName,
                    expected: expected.toString(),
                    gotLexer: result,
                    gotOriginal: original
                });
            }
        } else {
            // Exact match test
            testPassed = result === expected;
            if (!testPassed) {
                // Also check against original to see if test expectation is wrong
                const originalMatches = original === expected;
                failures.push({
                    input: testName,
                    expected,
                    gotLexer: result,
                    gotOriginal: original,
                    originalMatches
                });
            }
        }
        
        if (testPassed) {
            passed++;
            process.stdout.write('.');
        } else {
            failed++;
            process.stdout.write('F');
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

console.log('\n\n=== RESULTS ===');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const failure of failures) {
        console.log(`\nInput: "${failure.input}"`);
        if (failure.error) {
            console.log(`Error: ${failure.error}`);
        } else {
            console.log(`Expected: ${failure.expected}`);
            console.log(`Got (lexer): ${failure.gotLexer}`);
            console.log(`Got (original): ${failure.gotOriginal}`);
            if (failure.originalMatches !== undefined) {
                console.log(`Original matches expected: ${failure.originalMatches}`);
            }
        }
    }
}

// Size comparison
console.log('\n=== SIZE COMPARISON ===');
import { readFileSync } from 'fs';
const lexerSize = readFileSync('./dev/quikdown-lexer-ast.js', 'utf-8').length;
const originalSize = readFileSync('./src/quikdown.js', 'utf-8').length;
console.log(`Lexer-AST source: ${lexerSize} bytes`);
console.log(`Original source: ${originalSize} bytes`);
console.log(`Difference: ${lexerSize - originalSize} bytes (${((lexerSize/originalSize - 1) * 100).toFixed(1)}%)`);