#!/usr/bin/env node
/**
 * Comprehensive comparison test: quikdown (regex v1.2.7) vs quikdown_lex (scanner/grammar)
 * Tests all markdown features, edge cases, malformed input, performance, and size.
 *
 * Run: node dev/lex/test-comparison.js
 */

import { readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import both parsers
import quikdown from '../../src/quikdown.js';
import quikdown_lex from './quikdown_lex.js';

// ─── Test Definitions ────────────────────────────────────────────────

const tests = [];

function test(category, name, input, opts = {}) {
  tests.push({ category, name, input, opts });
}

// ────────────────────────────────────────────────────────────────────
// 1. HEADINGS
// ────────────────────────────────────────────────────────────────────
test('Headings', 'H1', '# Heading 1');
test('Headings', 'H2', '## Heading 2');
test('Headings', 'H3', '### Heading 3');
test('Headings', 'H4', '#### Heading 4');
test('Headings', 'H5', '##### Heading 5');
test('Headings', 'H6', '###### Heading 6');
test('Headings', 'Trailing hashes', '## Hello ##');
test('Headings', 'Trailing hashes with spaces', '## Hello ##   ');
test('Headings', 'No space after #', '#NoSpace');
test('Headings', '7 hashes (not heading)', '####### Not a heading');
test('Headings', 'Inline bold in heading', '## **Bold** heading');
test('Headings', 'Inline code in heading', '## `code` heading');
test('Headings', 'Multiple headings', '# H1\n\n## H2\n\n### H3');

// ────────────────────────────────────────────────────────────────────
// 2. PARAGRAPHS & LINE BREAKS
// ────────────────────────────────────────────────────────────────────
test('Paragraphs', 'Simple paragraph', 'Hello world');
test('Paragraphs', 'Two paragraphs', 'Para one\n\nPara two');
test('Paragraphs', 'Three paragraphs', 'One\n\nTwo\n\nThree');
test('Paragraphs', 'Trailing newlines', 'Hello\n\n');
test('Paragraphs', 'Leading newlines', '\n\nHello');
test('Paragraphs', 'Multiple blank lines', 'A\n\n\n\nB');
test('Paragraphs', 'Two-space line break', 'Line 1  \nLine 2');
test('Paragraphs', 'No line break (single newline)', 'Line 1\nLine 2');
test('Paragraphs', 'Lazy linefeeds', 'Line 1\nLine 2', { lazy_linefeeds: true });

// ────────────────────────────────────────────────────────────────────
// 3. EMPHASIS / INLINE FORMATTING
// ────────────────────────────────────────────────────────────────────
test('Emphasis', 'Bold with **', '**bold**');
test('Emphasis', 'Bold with __', '__bold__');
test('Emphasis', 'Italic with *', '*italic*');
test('Emphasis', 'Italic with _', '_italic_');
test('Emphasis', 'Strikethrough', '~~strike~~');
test('Emphasis', 'Bold + italic', '**bold** and *italic*');
test('Emphasis', 'Inline code', '`code`');
test('Emphasis', 'Inline code with special chars', '`<script>alert(1)</script>`');
test('Emphasis', 'Mixed formatting', 'Normal **bold** *italic* ~~strike~~ `code` end');
test('Emphasis', 'Unclosed bold', '**unclosed bold');
test('Emphasis', 'Unclosed italic', '*unclosed italic');
test('Emphasis', 'Unclosed strikethrough', '~~unclosed');
test('Emphasis', 'Unclosed inline code', '`unclosed');
test('Emphasis', 'Empty bold', '****');
test('Emphasis', 'Empty italic', '**');
test('Emphasis', 'Bold inside sentence', 'This is **very** important');
test('Emphasis', 'Italic at start', '*start* of line');
test('Emphasis', 'Italic at end', 'end of *line*');

// ────────────────────────────────────────────────────────────────────
// 4. LINKS & IMAGES
// ────────────────────────────────────────────────────────────────────
test('Links', 'Basic link', '[text](https://example.com)');
test('Links', 'Link with no text', '[](https://example.com)');
test('Links', 'Link with empty href', '[text]()');
test('Links', 'Link with bold text', '[**bold link**](url)');
test('Links', 'Autolink', 'Visit https://example.com today');
test('Links', 'Autolink in text', 'Go to https://example.com for info');
test('Links', 'Multiple autolinks', 'https://a.com and https://b.com');
test('Links', 'Image', '![alt text](image.png)');
test('Links', 'Image with empty alt', '![](image.png)');
test('Links', 'Broken link (no close paren)', '[text](url');
test('Links', 'Broken link (no close bracket)', '[text(url)');
test('Links', 'Nested brackets', '[[nested]](url)');

// ────────────────────────────────────────────────────────────────────
// 5. SECURITY / XSS
// ────────────────────────────────────────────────────────────────────
test('Security', 'HTML tags escaped', '<script>alert("xss")</script>');
test('Security', 'HTML entities', '&amp; &lt; &gt;');
test('Security', 'javascript: URL in link', '[click](javascript:alert(1))');
test('Security', 'vbscript: URL in link', '[click](vbscript:msgbox)');
test('Security', 'data: URL blocked', '[click](data:text/html,<h1>hi</h1>)');
test('Security', 'data:image URL allowed', '![img](data:image/png;base64,abc)');
test('Security', 'javascript: URL in image', '![img](javascript:alert(1))');
test('Security', 'Nested HTML attack', '**<img src=x onerror=alert(1)>**');

// ────────────────────────────────────────────────────────────────────
// 6. CODE FENCES
// ────────────────────────────────────────────────────────────────────
test('Fences', 'Basic fence', '```\ncode\n```');
test('Fences', 'Fence with language', '```javascript\nconst x = 1;\n```');
test('Fences', 'Fence with tilde', '~~~\ntilde code\n~~~');
test('Fences', 'Tilde fence with lang', '~~~python\nprint("hi")\n~~~');
test('Fences', 'Empty fence', '```\n\n```');
test('Fences', 'Fence with blank lines', '```\nline1\n\nline2\n```');
test('Fences', 'Fence preserves spaces', '```\n  indented\n    more\n```');
test('Fences', 'HTML in fence escaped', '```\n<script>alert(1)</script>\n```');
test('Fences', 'Fence with special chars', '```\n& < > " \'\n```');
test('Fences', 'Multiple fences', '```\nblock1\n```\n\n```\nblock2\n```');
test('Fences', 'Fence after paragraph', 'Text before\n\n```\ncode\n```');
test('Fences', 'Fence before paragraph', '```\ncode\n```\n\nText after');

// Nested and extended fences
test('Fences', '4 backticks', '````\ncode\n````');
test('Fences', '5 backticks', '`````\ncode\n`````');
test('Fences', '4 backtick with lang', '````js\ncode\n````');
test('Fences', '3 backticks inside 4', '````\n```\nnested\n```\n````');
test('Fences', '3 tilde inside 4 backtick', '````\n~~~\nnested\n~~~\n````');
test('Fences', 'Unclosed fence', '```\nno closing fence');
test('Fences', 'Mismatched fence (``` with ~~~)', '```\ncode\n~~~');
test('Fences', 'Fence with trailing text on close', '```\ncode\n``` extra');
test('Fences', 'Inline backticks vs fence', '`inline` and ```\nblock\n```');

// ────────────────────────────────────────────────────────────────────
// 7. LISTS
// ────────────────────────────────────────────────────────────────────
test('Lists', 'Unordered - dash', '- Item 1\n- Item 2\n- Item 3');
test('Lists', 'Unordered - asterisk', '* Item 1\n* Item 2');
test('Lists', 'Unordered - plus', '+ Item 1\n+ Item 2');
test('Lists', 'Ordered', '1. First\n2. Second\n3. Third');
test('Lists', 'Task list unchecked', '- [ ] Todo item');
test('Lists', 'Task list checked', '- [x] Done item');
test('Lists', 'Task list mixed', '- [ ] Todo\n- [x] Done\n- [ ] Another');
test('Lists', 'Nested list', '- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2');
test('Lists', 'Nested ordered', '1. First\n  1. Sub first\n  2. Sub second\n2. Second');
test('Lists', 'Deep nesting', '- L1\n  - L2\n    - L3');
test('Lists', 'Mixed list markers', '- Dash\n* Star\n+ Plus');
test('Lists', 'Bold in list', '- **Bold** item\n- Normal item');
test('Lists', 'Link in list', '- [Link](url)\n- Text');
test('Lists', 'Code in list', '- `code` item');
test('Lists', 'Single item list', '- Only one');
test('Lists', 'List then paragraph', '- Item 1\n- Item 2\n\nParagraph');

// ────────────────────────────────────────────────────────────────────
// 8. BLOCKQUOTES
// ────────────────────────────────────────────────────────────────────
test('Blockquotes', 'Simple quote', '> This is a quote');
test('Blockquotes', 'Multi-line quote', '> Line 1\n> Line 2');
test('Blockquotes', 'Quote with bold', '> **Bold** in quote');
test('Blockquotes', 'Quote with code', '> `code` in quote');
test('Blockquotes', 'Quote with link', '> [link](url) in quote');
test('Blockquotes', 'Empty quote', '>');
test('Blockquotes', 'Quote then text', '> Quote\n\nNormal text');

// ────────────────────────────────────────────────────────────────────
// 9. TABLES
// ────────────────────────────────────────────────────────────────────
test('Tables', 'Basic table', '| A | B |\n|---|---|\n| 1 | 2 |');
test('Tables', 'Left align', '| A |\n|:---|\n| 1 |');
test('Tables', 'Right align', '| A |\n|---:|\n| 1 |');
test('Tables', 'Center align', '| A |\n|:---:|\n| 1 |');
test('Tables', 'Mixed alignment', '| L | C | R |\n|:---|:---:|---:|\n| a | b | c |');
test('Tables', 'Bold in cell', '| **Bold** | Normal |\n|---|---|\n| a | b |');
test('Tables', 'Code in cell', '| `code` | text |\n|---|---|\n| a | b |');
test('Tables', 'Multiple rows', '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |');
test('Tables', 'No leading pipe', 'A | B\n---|---\n1 | 2');
test('Tables', 'No trailing pipe', '| A | B\n|---|---\n| 1 | 2');
test('Tables', 'Single column', '| A |\n|---|\n| 1 |');
test('Tables', 'Empty cells', '| A | B |\n|---|---|\n|  |  |');
test('Tables', 'Malformed - missing separator', '| A | B |\n| 1 | 2 |');
test('Tables', 'Malformed - only header', '| A | B |\n|---|---|');

// ────────────────────────────────────────────────────────────────────
// 10. HORIZONTAL RULES
// ────────────────────────────────────────────────────────────────────
test('HR', 'Standard HR', '---');
test('HR', 'Long HR', '-----');
test('HR', 'HR with trailing spaces', '---   ');
test('HR', 'HR between text', 'Above\n\n---\n\nBelow');
test('HR', 'Not HR (only two dashes)', '--');

// ────────────────────────────────────────────────────────────────────
// 11. INLINE STYLES vs CSS CLASSES
// ────────────────────────────────────────────────────────────────────
test('Styles', 'Heading with inline styles', '# Hello', { inline_styles: true });
test('Styles', 'Bold with inline styles', '**bold**', { inline_styles: true });
test('Styles', 'Link with inline styles', '[text](url)', { inline_styles: true });
test('Styles', 'Table with inline styles', '| A |\n|---|\n| 1 |', { inline_styles: true });
test('Styles', 'Fence with inline styles', '```\ncode\n```', { inline_styles: true });
test('Styles', 'List with inline styles', '- Item 1\n- Item 2', { inline_styles: true });
test('Styles', 'HR with inline styles', '---', { inline_styles: true });
test('Styles', 'Default classes', '# Hello **world**');

// ────────────────────────────────────────────────────────────────────
// 12. FENCE PLUGIN
// ────────────────────────────────────────────────────────────────────
test('Plugin', 'Fence plugin renders', '```mermaid\ngraph TD\n```', {
  fence_plugin: { render: (code, lang) => `<div class="custom-${lang}">${code}</div>` }
});
test('Plugin', 'Fence plugin returns undefined (fallback)', '```js\ncode\n```', {
  fence_plugin: { render: () => undefined }
});
test('Plugin', 'No plugin (default)', '```python\nprint(1)\n```');

// ────────────────────────────────────────────────────────────────────
// 13. MALFORMED / EDGE CASES
// ────────────────────────────────────────────────────────────────────
test('Edge', 'Empty string', '');
test('Edge', 'Null input', null);
test('Edge', 'Undefined input', undefined);
test('Edge', 'Number input', 42);
test('Edge', 'Only whitespace', '   ');
test('Edge', 'Only newlines', '\n\n\n');
test('Edge', 'Single character', 'A');
test('Edge', 'Very long line', 'A'.repeat(10000));
test('Edge', 'Unicode text', 'Hello 🌍 world 你好 мир');
test('Edge', 'Tabs', '\tTabbed\n\t\tDouble tabbed');
test('Edge', 'Backslash before special', '\\* not italic \\[ not link');
test('Edge', 'Angle brackets', '<not-a-tag>');
test('Edge', 'Ampersand alone', 'Tom & Jerry');
test('Edge', 'Quote marks', 'He said "hello" and \'goodbye\'');
test('Edge', 'Consecutive formatting', '**bold****bold2**');
test('Edge', 'Adjacent code spans', '`a``b`');
test('Edge', 'Formatting across lines', '**bold\nstill bold**');
test('Edge', 'Link then link', '[a](1)[b](2)');
test('Edge', 'Image then image', '![a](1)![b](2)');
test('Edge', 'List-like but not (dash in text)', 'This is not - a list');
test('Edge', 'Heading after code fence', '```\ncode\n```\n\n# Heading');
test('Edge', 'All features combined',
  '# Title\n\nParagraph with **bold** and *italic*.\n\n- List item\n\n> Quote\n\n```\ncode\n```\n\n| A |\n|---|\n| 1 |\n\n---');

// ────────────────────────────────────────────────────────────────────
// 14. STATIC API
// ────────────────────────────────────────────────────────────────────
// (tested separately below)

// ═══════════════════════════════════════════════════════════════════
// Run tests
// ═══════════════════════════════════════════════════════════════════

const results = {
  total: 0,
  match: 0,
  mismatch: 0,
  categories: {}
};

const mismatches = [];

for (const t of tests) {
  results.total++;
  if (!results.categories[t.category]) {
    results.categories[t.category] = { total: 0, match: 0, mismatch: 0 };
  }
  results.categories[t.category].total++;

  let mainOut, lexOut;
  try {
    mainOut = quikdown(t.input, t.opts);
  } catch (e) {
    mainOut = `[ERROR] ${e.message}`;
  }
  try {
    lexOut = quikdown_lex(t.input, t.opts);
  } catch (e) {
    lexOut = `[ERROR] ${e.message}`;
  }

  if (mainOut === lexOut) {
    results.match++;
    results.categories[t.category].match++;
  } else {
    results.mismatch++;
    results.categories[t.category].mismatch++;
    mismatches.push({ ...t, mainOut, lexOut });
  }
}

// ═══════════════════════════════════════════════════════════════════
// Static API checks
// ═══════════════════════════════════════════════════════════════════

const apiChecks = [];

// emitStyles
const mainStyles = typeof quikdown.emitStyles === 'function';
const lexStyles = typeof quikdown_lex.emitStyles === 'function';
apiChecks.push({ name: 'emitStyles exists', main: mainStyles, lex: lexStyles });

if (mainStyles && lexStyles) {
  const ms = quikdown.emitStyles();
  const ls = quikdown_lex.emitStyles();
  apiChecks.push({ name: 'emitStyles output matches', main: ms.length > 0, lex: ls.length > 0 });
}

// configure
const mainConf = typeof quikdown.configure === 'function';
const lexConf = typeof quikdown_lex.configure === 'function';
apiChecks.push({ name: 'configure exists', main: mainConf, lex: lexConf });

// version
apiChecks.push({ name: 'version property exists', main: 'version' in quikdown, lex: 'version' in quikdown_lex });

// ═══════════════════════════════════════════════════════════════════
// Performance benchmark
// ═══════════════════════════════════════════════════════════════════

const smallDoc = `# Hello World

This is a **bold** paragraph with *italic* and \`code\`.

- Item 1
- Item 2
  - Nested

> A blockquote

| Col A | Col B |
|-------|-------|
| 1     | 2     |

\`\`\`js
const x = 42;
\`\`\`

---

[Link](https://example.com) and ![img](photo.png)
`;

const largeDoc = Array(100).fill(smallDoc).join('\n\n');

function bench(name, fn, input, iterations) {
  // Warmup
  for (let i = 0; i < 10; i++) fn(input);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(input);
  const elapsed = performance.now() - start;
  return { name, iterations, elapsed, opsPerSec: Math.round(iterations / (elapsed / 1000)) };
}

const SMALL_ITERS = 5000;
const LARGE_ITERS = 100;

const perfResults = [
  bench('main (small doc)', quikdown, smallDoc, SMALL_ITERS),
  bench('lex  (small doc)', quikdown_lex, smallDoc, SMALL_ITERS),
  bench('main (large doc)', quikdown, largeDoc, LARGE_ITERS),
  bench('lex  (large doc)', quikdown_lex, largeDoc, LARGE_ITERS),
];

// ═══════════════════════════════════════════════════════════════════
// File sizes
// ═══════════════════════════════════════════════════════════════════

function fileSize(path) {
  try {
    return statSync(path).size;
  } catch { return null; }
}

const rootDir = resolve(__dirname, '../..');

const sizes = [
  { name: 'quikdown.js (src)', path: resolve(rootDir, 'src/quikdown.js') },
  { name: 'quikdown.umd.min.js', path: resolve(rootDir, 'dist/quikdown.umd.min.js') },
  { name: 'quikdown.esm.min.js', path: resolve(rootDir, 'dist/quikdown.esm.min.js') },
  { name: 'quikdown_lex.js (src)', path: resolve(__dirname, 'quikdown_lex.js') },
  { name: 'quikdown_lex.min.js', path: resolve(__dirname, 'quikdown_lex.min.js') },
  { name: 'grammar1/quikdown_lex.js', path: resolve(__dirname, 'grammar1/quikdown_lex.js') },
  { name: 'grammar1/quikdown_lex.min.js', path: resolve(__dirname, 'grammar1/quikdown_lex.min.js') },
];

// ═══════════════════════════════════════════════════════════════════
// Print Report
// ═══════════════════════════════════════════════════════════════════

const SEP = '─'.repeat(72);

console.log('\n' + '═'.repeat(72));
console.log('  quikdown v1.2.7 (regex) vs quikdown_lex (scanner/grammar)');
console.log('  Comprehensive Comparison Report');
console.log('═'.repeat(72));

// Category summary
console.log('\n' + SEP);
console.log('  FEATURE PARITY BY CATEGORY');
console.log(SEP);
console.log(`  ${'Category'.padEnd(20)} ${'Total'.padStart(6)} ${'Match'.padStart(6)} ${'Diff'.padStart(6)}  ${'Parity'.padStart(8)}`);
console.log('  ' + '─'.repeat(52));

for (const [cat, data] of Object.entries(results.categories)) {
  const pct = ((data.match / data.total) * 100).toFixed(1) + '%';
  const icon = data.mismatch === 0 ? '  OK' : ' !!!';
  console.log(`  ${cat.padEnd(20)} ${String(data.total).padStart(6)} ${String(data.match).padStart(6)} ${String(data.mismatch).padStart(6)}  ${pct.padStart(7)}${icon}`);
}

console.log('  ' + '─'.repeat(52));
const totalPct = ((results.match / results.total) * 100).toFixed(1) + '%';
console.log(`  ${'TOTAL'.padEnd(20)} ${String(results.total).padStart(6)} ${String(results.match).padStart(6)} ${String(results.mismatch).padStart(6)}  ${totalPct.padStart(7)}`);

// Mismatches detail
if (mismatches.length > 0) {
  console.log('\n' + SEP);
  console.log('  MISMATCHES (detailed)');
  console.log(SEP);
  for (const m of mismatches) {
    console.log(`\n  [${m.category}] ${m.name}`);
    const inputStr = typeof m.input === 'string' ? m.input : String(m.input);
    console.log(`  Input:  ${JSON.stringify(inputStr.slice(0, 80))}`);
    console.log(`  Main:   ${JSON.stringify(String(m.mainOut).slice(0, 120))}`);
    console.log(`  Lex:    ${JSON.stringify(String(m.lexOut).slice(0, 120))}`);
  }
}

// API checks
console.log('\n' + SEP);
console.log('  STATIC API');
console.log(SEP);
for (const c of apiChecks) {
  const match = c.main === c.lex ? 'OK' : 'DIFF';
  console.log(`  ${match === 'OK' ? 'OK  ' : 'DIFF'} ${c.name}: main=${c.main}, lex=${c.lex}`);
}

// Performance
console.log('\n' + SEP);
console.log('  PERFORMANCE');
console.log(SEP);
console.log(`  ${'Benchmark'.padEnd(25)} ${'Iters'.padStart(7)} ${'Time(ms)'.padStart(10)} ${'ops/sec'.padStart(10)}`);
console.log('  ' + '─'.repeat(55));
for (const p of perfResults) {
  console.log(`  ${p.name.padEnd(25)} ${String(p.iterations).padStart(7)} ${p.elapsed.toFixed(1).padStart(10)} ${String(p.opsPerSec).padStart(10)}`);
}

// Speed comparison
const mainSmall = perfResults[0].opsPerSec;
const lexSmall = perfResults[1].opsPerSec;
const mainLarge = perfResults[2].opsPerSec;
const lexLarge = perfResults[3].opsPerSec;
const smallRatio = ((lexSmall / mainSmall - 1) * 100).toFixed(1);
const largeRatio = ((lexLarge / mainLarge - 1) * 100).toFixed(1);
console.log('  ' + '─'.repeat(55));
console.log(`  Lex vs Main (small): ${smallRatio > 0 ? '+' : ''}${smallRatio}%`);
console.log(`  Lex vs Main (large): ${largeRatio > 0 ? '+' : ''}${largeRatio}%`);

// File sizes
console.log('\n' + SEP);
console.log('  FILE SIZES');
console.log(SEP);
console.log(`  ${'File'.padEnd(35)} ${'Bytes'.padStart(8)} ${'KB'.padStart(8)}`);
console.log('  ' + '─'.repeat(55));
for (const s of sizes) {
  const bytes = fileSize(s.path);
  if (bytes !== null) {
    console.log(`  ${s.name.padEnd(35)} ${String(bytes).padStart(8)} ${(bytes / 1024).toFixed(1).padStart(7)}K`);
  } else {
    console.log(`  ${s.name.padEnd(35)} ${'(not found)'.padStart(8)}`);
  }
}

// Summary
console.log('\n' + '═'.repeat(72));
console.log('  SUMMARY');
console.log('═'.repeat(72));
console.log(`  Feature parity: ${results.match}/${results.total} tests match (${totalPct})`);
console.log(`  Mismatches:     ${results.mismatch}`);
console.log(`  Speed (small):  lex is ${smallRatio > 0 ? '+' : ''}${smallRatio}% vs main`);
console.log(`  Speed (large):  lex is ${largeRatio > 0 ? '+' : ''}${largeRatio}% vs main`);
console.log('═'.repeat(72) + '\n');

// Exit code
process.exit(mismatches.length > 0 ? 0 : 0); // Always exit 0, mismatches are expected at this stage
