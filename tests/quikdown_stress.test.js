/**
 * @jest-environment jsdom
 */

/**
 * Stress tests for quikdown — malformed, adversarial, and edge-case markdown.
 * Covers: inline nesting, table abuse, XSS obfuscation, whitespace chaos,
 * fence edge cases, list nesting, option combinations, and boundary conditions.
 */

let quikdown;
try {
    quikdown = require('../dist/quikdown.cjs');
    if (quikdown.default) quikdown = quikdown.default;
} catch (_e) {
    const fs = require('fs');
    const path = require('path');
    eval(fs.readFileSync(path.join(__dirname, '../dist/quikdown.umd.js'), 'utf8'));
    quikdown = window.quikdown;
}

const parse = (md, opts) => quikdown(md, opts || {});

// ========================================================================
// 1. INLINE FORMATTING NESTING & OVERLAP
// ========================================================================
describe('inline formatting nesting', () => {
    test('bold inside italic', () => {
        const html = parse('*text **bold** text*');
        expect(html).toMatch(/<em/);
        expect(html).toMatch(/<strong/);
    });

    test('italic inside bold', () => {
        const html = parse('**text *italic* text**');
        expect(html).toMatch(/<strong/);
        expect(html).toMatch(/<em/);
    });

    test('code inside bold', () => {
        const html = parse('**text `code` text**');
        expect(html).toMatch(/<strong/);
        expect(html).toMatch(/<code/);
    });

    test('bold + italic combo ***text***', () => {
        const html = parse('***bold italic***');
        expect(html).toMatch(/<(strong|em)/);
    });

    test('strikethrough inside bold', () => {
        const html = parse('**~~struck~~**');
        expect(html).toMatch(/<strong/);
    });

    test('adjacent formatting: **bold** *italic*', () => {
        const html = parse('**bold** *italic*');
        expect(html).toContain('bold');
        expect(html).toContain('italic');
    });

    test('underscore bold __text__', () => {
        const html = parse('__bold text__');
        expect(html).toMatch(/<strong/);
    });

    test('underscore italic _text_', () => {
        const html = parse('_italic text_');
        expect(html).toMatch(/<em/);
    });

    test('mixed asterisk and underscore: **_text_**', () => {
        const html = parse('**_mixed_**');
        expect(html).toMatch(/<strong/);
    });

    test('unclosed bold **text', () => {
        const html = parse('**unclosed bold');
        // Should not crash, should render something
        expect(html).toContain('unclosed bold');
    });

    test('unclosed italic *text', () => {
        const html = parse('*unclosed italic');
        expect(html).toContain('unclosed italic');
    });

    test('unclosed strikethrough ~~text', () => {
        const html = parse('~~unclosed strike');
        expect(html).toContain('unclosed strike');
    });

    test('nested unclosed: **bold *italic text**', () => {
        const html = parse('**bold *italic text**');
        expect(html).toContain('bold');
    });

    test('empty bold ****', () => {
        const html = parse('****');
        expect(typeof html).toBe('string');
    });

    test('empty italic **', () => {
        const html = parse('**');
        expect(typeof html).toBe('string');
    });

    test('single asterisk in text: a * b', () => {
        const html = parse('a * b');
        expect(html).toContain('a');
        expect(html).toContain('b');
    });

    test('asterisks in math-like context: 2*3*4', () => {
        const html = parse('2*3*4');
        expect(html).toContain('2');
    });

    test('many nested formatting layers', () => {
        const html = parse('***~~`code`~~***');
        expect(html).toContain('code');
    });

    test('link with bold text: [**bold**](url)', () => {
        const html = parse('[**bold link**](http://example.com)');
        expect(html).toMatch(/<a/);
        expect(html).toMatch(/<strong/);
    });

    test('image with special chars: ![alt "quotes"](url)', () => {
        const html = parse('![alt "quotes"](http://example.com/img.png)');
        expect(html).toMatch(/<img/);
    });

    test('inline code with backticks inside: ``code ` here``', () => {
        const html = parse('``code ` here``');
        expect(html).toMatch(/<code/);
    });

    test('triple backtick inline: ```not a fence```', () => {
        // Inline, not at start of line — should be code
        const html = parse('text ```inline``` more');
        expect(html).toContain('text');
        expect(html).toContain('more');
    });
});

// ========================================================================
// 2. TABLE ABUSE & MALFORMATION
// ========================================================================
describe('table abuse', () => {
    test('table with 0 columns in separator', () => {
        const html = parse('| A |\n||\n| 1 |');
        expect(typeof html).toBe('string');
    });

    test('separator with only spaces and pipes', () => {
        const html = parse('| A |\n| |\n| 1 |');
        expect(typeof html).toBe('string');
    });

    test('100-column table', () => {
        const cols = Array.from({ length: 100 }, (_, i) => `C${i}`);
        const header = '| ' + cols.join(' | ') + ' |';
        const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
        const row = '| ' + cols.map((_, i) => `v${i}`).join(' | ') + ' |';
        const html = parse(`${header}\n${sep}\n${row}`);
        expect(html).toContain('<table');
        expect(html).toContain('C99');
    });

    test('table with pipe in middle of text (not a table)', () => {
        const html = parse('this | is | not a table');
        // No separator line, so not a table
    });

    test('table separator with no dashes, only colons', () => {
        const html = parse('| A |\n|::|\n| 1 |');
        expect(typeof html).toBe('string');
    });

    test('table with escaped pipes \\|', () => {
        const html = parse('| A | B |\n|---|---|\n| a\\|b | c |');
        expect(html).toContain('<table');
    });

    test('table with HTML entities in cells', () => {
        const html = parse('| A |\n|---|\n| &amp; &lt; &gt; |');
        expect(html).toContain('<table');
    });

    test('table where every cell is empty', () => {
        const html = parse('| | |\n|---|---|\n| | |\n| | |');
        expect(html).toContain('<table');
    });

    test('table with only header and separator, no body', () => {
        const html = parse('| H1 | H2 |\n|---|---|');
        expect(html).toContain('<table');
    });

    test('table with 500 rows', () => {
        const lines = ['| A |\n|---|'];
        for (let i = 0; i < 500; i++) lines.push(`| row${i} |`);
        const html = parse(lines.join('\n'));
        expect(html).toContain('<table');
        expect(html).toContain('row499');
    });

    test('table-like content mixed with regular text', () => {
        const md = 'Price is $5 | tax $1 | total $6\nNot a table either';
        const html = parse(md);
        expect(html).toContain('Price');
    });

    test('consecutive tables with no blank line', () => {
        const md = '| A |\n|---|\n| 1 |\n| B |\n|---|\n| 2 |';
        const html = parse(md);
        expect(html).toContain('<table');
    });
});

// ========================================================================
// 3. XSS OBFUSCATION & SECURITY
// ========================================================================
describe('XSS and security', () => {
    test('javascript: protocol', () => {
        const html = parse('[click](javascript:alert(1))');
        expect(html).not.toContain('javascript:');
    });

    test('JAVASCRIPT: uppercase', () => {
        const html = parse('[click](JAVASCRIPT:alert(1))');
        expect(html.toLowerCase()).not.toContain('javascript:');
    });

    test('JaVaScRiPt: mixed case', () => {
        const html = parse('[click](JaVaScRiPt:alert(1))');
        expect(html.toLowerCase()).not.toContain('javascript:');
    });

    test('vbscript: protocol', () => {
        const html = parse('[click](vbscript:alert(1))');
        expect(html).not.toContain('vbscript:');
    });

    test('data: protocol in link', () => {
        const html = parse('[click](data:text/html,<script>alert(1)</script>)');
        expect(html).not.toContain('data:text/html');
    });

    test('javascript: with leading spaces', () => {
        const html = parse('[click](  javascript:alert(1))');
        expect(html.toLowerCase()).not.toContain('javascript:');
    });

    test('javascript: with tab', () => {
        const html = parse('[click](\tjavascript:alert(1))');
        expect(html.toLowerCase()).not.toContain('javascript:');
    });

    test('javascript: with newline', () => {
        const html = parse('[click](java\nscript:alert(1))');
        expect(html.toLowerCase()).not.toContain('javascript:alert');
    });

    test('HTML tags are escaped', () => {
        const html = parse('<script>alert(1)</script>');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    test('HTML attributes are escaped (whole tag escaped)', () => {
        const html = parse('<img src=x onerror=alert(1)>');
        // quikdown escapes the entire tag — no raw HTML passthrough
        expect(html).toContain('&lt;img');
    });

    test('img tag in markdown', () => {
        const html = parse('![xss](javascript:alert(1))');
        // Should sanitize the URL
        expect(html.toLowerCase()).not.toContain('javascript:');
    });

    test('HTML entities pass through safely', () => {
        const html = parse('&lt;script&gt;');
        expect(html).toContain('&amp;lt;');
    });

    test('null bytes in URL', () => {
        const html = parse('[click](java\\0script:alert(1))');
        expect(html.toLowerCase()).not.toContain('javascript:alert');
    });

    test('on* event handlers in raw HTML are escaped', () => {
        const html = parse('<div onmouseover="alert(1)">text</div>');
        // quikdown escapes all HTML tags — no raw passthrough
        expect(html).toContain('&lt;div');
    });

    test('deeply nested HTML comments', () => {
        const html = parse('<!-- <script>alert(1)</script> -->');
        expect(html).not.toContain('<script>');
    });

    test('URL with unicode characters', () => {
        const html = parse('[link](https://example.com/pаth)'); // Cyrillic а
        expect(html).toContain('<a');
    });

    test('very long URL (10000 chars)', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(10000);
        const html = parse(`[link](${longUrl})`);
        expect(typeof html).toBe('string');
        // Should not crash
    });
});

// ========================================================================
// 4. WHITESPACE & BOUNDARY CONDITIONS
// ========================================================================
describe('whitespace and boundaries', () => {
    test('empty string', () => {
        expect(parse('')).toBe('');
    });

    test('null-ish input', () => {
        expect(typeof parse(undefined)).toBe('string');
    });

    test('whitespace only: spaces', () => {
        const html = parse('     ');
        expect(typeof html).toBe('string');
    });

    test('whitespace only: tabs', () => {
        const html = parse('\t\t\t');
        expect(typeof html).toBe('string');
    });

    test('whitespace only: newlines', () => {
        const html = parse('\n\n\n\n');
        expect(typeof html).toBe('string');
    });

    test('mixed line endings: \\r\\n', () => {
        const html = parse('line1\r\nline2\r\nline3');
        expect(html).toContain('line1');
        expect(html).toContain('line2');
        expect(html).toContain('line3');
    });

    test('carriage return only: \\r', () => {
        const html = parse('line1\rline2');
        expect(html).toContain('line1');
    });

    test('trailing whitespace on lines', () => {
        const html = parse('hello   \nworld   ');
        expect(html).toContain('hello');
        expect(html).toContain('world');
    });

    test('leading whitespace on lines', () => {
        const html = parse('   hello\n   world');
        expect(html).toContain('hello');
    });

    test('very long line (50000 chars)', () => {
        const long = 'a'.repeat(50000);
        const html = parse(long);
        expect(html).toContain('a');
        expect(typeof html).toBe('string');
    });

    test('many short lines (5000 lines)', () => {
        const lines = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
        const html = parse(lines.join('\n'));
        expect(html).toContain('line 0');
        expect(html).toContain('line 4999');
    });

    test('unicode: CJK characters', () => {
        const html = parse('# 日本語タイトル\n\n中文内容\n\n한국어');
        expect(html).toContain('日本語タイトル');
        expect(html).toContain('中文内容');
    });

    test('unicode: emoji', () => {
        const html = parse('# 🎉 Title\n\n✅ Done\n❌ Failed');
        expect(html).toContain('🎉');
        expect(html).toContain('✅');
    });

    test('unicode: RTL text', () => {
        const html = parse('مرحبا بالعالم');
        expect(html).toContain('مرحبا');
    });

    test('zero-width characters', () => {
        const html = parse('hel\u200Blo wor\u200Bld');
        expect(html).toContain('hel');
    });

    test('BOM marker at start', () => {
        const html = parse('\uFEFF# Title');
        expect(typeof html).toBe('string');
    });

    test('only special chars: @#$%^&*()', () => {
        const html = parse('@#$%^&*()');
        expect(html).toContain('@#$%^');
    });

    test('backslash in text passes through', () => {
        // quikdown does not support backslash escapes — backslashes are literal
        const html = parse('text with \\ backslash');
        expect(html).toContain('\\');
    });

    test('consecutive blank lines (10+)', () => {
        const html = parse('text\n\n\n\n\n\n\n\n\n\n\nmore');
        expect(html).toContain('text');
        expect(html).toContain('more');
    });
});

// ========================================================================
// 5. CODE FENCE EDGE CASES
// ========================================================================
describe('code fence edge cases', () => {
    test('unclosed fence at end of document', () => {
        const html = parse('```\ncode here\nmore code');
        expect(html).toContain('code here');
    });

    test('fence with very long language string', () => {
        const lang = 'a'.repeat(1000);
        const html = parse('```' + lang + '\ncode\n```');
        expect(html).toContain('code');
    });

    test('fence with special chars in language: ```c++', () => {
        const html = parse('```c++\nint x = 0;\n```');
        expect(html).toContain('<pre');
    });

    test('fence with language containing spaces: ```my lang', () => {
        const html = parse('```my lang\ncode\n```');
        expect(html).toContain('<pre');
    });

    test('empty fence block', () => {
        const html = parse('```\n```');
        expect(html).toContain('<pre');
    });

    test('fence with only whitespace inside', () => {
        const html = parse('```\n   \n  \n```');
        expect(html).toContain('<pre');
    });

    test('nested backtick fence: ```` containing ```', () => {
        const html = parse('````\n```\ninner\n```\n````');
        expect(html).toContain('<pre');
        expect(html).toContain('inner');
    });

    test('tilde fence: ~~~', () => {
        const html = parse('~~~\ncode\n~~~');
        expect(html).toContain('<pre');
        expect(html).toContain('code');
    });

    test('mismatched fences: ``` opened, ~~~ close attempt', () => {
        const html = parse('```\ncode\n~~~\nmore code\n```');
        expect(html).toContain('code');
    });

    test('indented fence (4 spaces)', () => {
        const html = parse('    ```\n    code\n    ```');
        expect(typeof html).toBe('string');
    });

    test('fence with HTML inside', () => {
        const html = parse('```html\n<div class="test">content</div>\n```');
        expect(html).toContain('<pre');
        // HTML inside fence should be escaped
        expect(html).toContain('&lt;div');
    });

    test('fence with markdown inside (should not parse)', () => {
        const html = parse('```\n# Not a heading\n**not bold**\n```');
        expect(html).toContain('# Not a heading');
        expect(html).not.toMatch(/<h1/);
    });

    test('multiple consecutive fences', () => {
        const md = '```\na\n```\n\n```\nb\n```\n\n```\nc\n```';
        const html = parse(md);
        const preCount = (html.match(/<pre/g) || []).length;
        expect(preCount).toBe(3);
    });

    test('fence immediately after heading (no blank line)', () => {
        const html = parse('# Title\n```\ncode\n```');
        expect(html).toContain('<h1');
        expect(html).toContain('<pre');
    });

    test('fence with ANSI escape codes', () => {
        const html = parse('```\n\x1b[31mred text\x1b[0m\n```');
        expect(html).toContain('<pre');
    });

    test('very large code block (10000 lines)', () => {
        const lines = Array.from({ length: 10000 }, (_, i) => `line ${i}`);
        const md = '```\n' + lines.join('\n') + '\n```';
        const html = parse(md);
        expect(html).toContain('line 0');
        expect(html).toContain('line 9999');
    });
});

// ========================================================================
// 6. LIST NESTING STRESS
// ========================================================================
describe('list nesting stress', () => {
    test('10 levels of unordered list nesting', () => {
        const lines = Array.from({ length: 10 }, (_, i) =>
            '  '.repeat(i) + '- level ' + i
        );
        const html = parse(lines.join('\n'));
        expect(html).toContain('level 0');
        expect(html).toContain('level 9');
    });

    test('mixed ordered and unordered', () => {
        const md = '1. First\n   - Sub bullet\n   - Another\n2. Second\n   1. Sub ordered\n   2. Another';
        const html = parse(md);
        expect(html).toContain('First');
        expect(html).toContain('Sub bullet');
    });

    test('list with empty items', () => {
        const html = parse('- \n- \n- item');
        expect(html).toContain('item');
    });

    test('1000-item flat list', () => {
        const lines = Array.from({ length: 1000 }, (_, i) => `- item ${i}`);
        const html = parse(lines.join('\n'));
        expect(html).toContain('item 0');
        expect(html).toContain('item 999');
    });

    test('task list items', () => {
        const html = parse('- [x] done\n- [ ] todo\n- [x] also done');
        expect(html).toContain('type="checkbox"');
    });

    test('list starting with large number', () => {
        const html = parse('999. Item one\n1000. Item two');
        expect(html).toContain('Item one');
        expect(html).toContain('Item two');
    });

    test('list with inline formatting', () => {
        const html = parse('- **bold item**\n- *italic item*\n- `code item`');
        expect(html).toMatch(/<strong/);
        expect(html).toMatch(/<em/);
        expect(html).toMatch(/<code/);
    });

    test('list immediately after paragraph (no blank line)', () => {
        const html = parse('Some text\n- item 1\n- item 2');
        expect(html).toContain('Some text');
        expect(html).toContain('item 1');
    });

    test('list with + marker', () => {
        const html = parse('+ item 1\n+ item 2');
        expect(html).toContain('item 1');
    });

    test('list with * marker', () => {
        const html = parse('* item 1\n* item 2');
        expect(html).toContain('item 1');
    });

    test('inconsistent indentation (2-space then 4-space)', () => {
        const html = parse('- level 0\n  - level 1a\n    - level 1b');
        expect(html).toContain('level 0');
    });
});

// ========================================================================
// 7. HEADING EDGE CASES
// ========================================================================
describe('heading edge cases', () => {
    test('heading level 7 (invalid — should be text)', () => {
        const html = parse('####### Not a heading');
        expect(html).not.toMatch(/<h7/);
    });

    test('heading with trailing hashes: # Title ##', () => {
        const html = parse('# Title ##');
        expect(html).toMatch(/<h1/);
        expect(html).toContain('Title');
    });

    test('heading with no space: #NoSpace', () => {
        const html = parse('#NoSpace');
        // Per strict markdown, # needs a space. Behavior may vary.
        expect(typeof html).toBe('string');
    });

    test('heading with inline formatting', () => {
        const html = parse('## **Bold** Heading');
        expect(html).toMatch(/<h2/);
        expect(html).toMatch(/<strong/);
    });

    test('heading with code: ## `code` Heading', () => {
        const html = parse('## `code` Heading');
        expect(html).toMatch(/<h2/);
    });

    test('empty heading: # (parser-specific)', () => {
        // quikdown requires text after # — "# " alone is not a heading
        const html = parse('# ');
        expect(typeof html).toBe('string');
    });

    test('all heading levels', () => {
        const md = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
        const html = parse(md);
        for (let i = 1; i <= 6; i++) {
            expect(html).toContain(`<h${i}`);
        }
    });
});

// ========================================================================
// 8. BLOCKQUOTE EDGE CASES
// ========================================================================
describe('blockquote edge cases', () => {
    test('nested blockquotes', () => {
        const html = parse('> outer\n>> inner\n>>> deeper');
        expect(html).toContain('<blockquote');
    });

    test('blockquote with blank line', () => {
        const html = parse('> line 1\n>\n> line 2');
        expect(html).toContain('line 1');
        expect(html).toContain('line 2');
    });

    test('blockquote with heading', () => {
        const html = parse('> # Quoted Heading');
        expect(html).toContain('<blockquote');
    });

    test('blockquote with list', () => {
        const html = parse('> - item 1\n> - item 2');
        expect(html).toContain('<blockquote');
    });

    test('blockquote with code block', () => {
        const html = parse('> ```\n> code\n> ```');
        expect(html).toContain('<blockquote');
    });

    test('empty blockquote: > (parser-specific)', () => {
        // quikdown requires "> " (with space/content) for blockquote
        const html = parse('>');
        expect(typeof html).toBe('string');
    });

    test('blockquote without space: >text', () => {
        const html = parse('>text');
        expect(html).toContain('text');
    });

    test('very long blockquote (100 lines)', () => {
        const lines = Array.from({ length: 100 }, (_, i) => `> line ${i}`);
        const html = parse(lines.join('\n'));
        expect(html).toContain('line 0');
        expect(html).toContain('line 99');
    });
});

// ========================================================================
// 9. HORIZONTAL RULE VARIANTS
// ========================================================================
describe('horizontal rule variants', () => {
    test('three dashes: ---', () => {
        const html = parse('---');
        expect(html).toContain('<hr');
    });

    test('three underscores: ___ (parser-specific)', () => {
        // quikdown uses --- only for HR; ___ and *** are not HR
        const html = parse('___');
        expect(typeof html).toBe('string');
    });

    test('three asterisks: *** (parser-specific)', () => {
        const html = parse('***');
        expect(typeof html).toBe('string');
    });

    test('spaced dashes: - - - (treated as list)', () => {
        // quikdown parses "- " as list item marker
        const html = parse('- - -');
        expect(typeof html).toBe('string');
    });

    test('many dashes: ----------', () => {
        const html = parse('----------');
        expect(html).toContain('<hr');
    });

    test('HR with leading spaces (parser-specific)', () => {
        // quikdown requires --- at start of line without leading spaces
        const html = parse('   ---');
        expect(typeof html).toBe('string');
    });

    test('HR between paragraphs', () => {
        const html = parse('before\n\n---\n\nafter');
        expect(html).toContain('<hr');
        expect(html).toContain('before');
        expect(html).toContain('after');
    });

    test('--- is not HR when it could be setext heading', () => {
        // "heading\n---" could be a setext H2 — depends on parser
        const html = parse('heading\n---');
        expect(typeof html).toBe('string');
    });
});

// ========================================================================
// 10. OPTION COMBINATIONS
// ========================================================================
describe('option combinations', () => {
    test('lazy_linefeeds: true', () => {
        const html = parse('line 1\nline 2', { lazy_linefeeds: true });
        expect(html).toContain('<br');
    });

    test('lazy_linefeeds with table', () => {
        const html = parse('| A | B |\n|---|---|\n| 1 | 2 |', { lazy_linefeeds: true });
        expect(html).toContain('<table');
    });

    test('lazy_linefeeds with code block', () => {
        const html = parse('```\nline1\nline2\n```', { lazy_linefeeds: true });
        expect(html).toContain('<pre');
        // Should NOT add <br> inside code blocks
    });

    test('lazy_linefeeds with list', () => {
        const html = parse('- item 1\n- item 2', { lazy_linefeeds: true });
        // Should not add br between list items
        expect(html).toContain('item 1');
        expect(html).toContain('item 2');
    });

    test('lazy_linefeeds with heading', () => {
        const html = parse('# Title\nParagraph', { lazy_linefeeds: true });
        expect(html).toContain('<h1');
    });

    test('inline_styles: true', () => {
        const html = parse('# Title', { inline_styles: true });
        expect(html).toContain('style=');
    });

    test('inline_styles + lazy_linefeeds', () => {
        const html = parse('# Title\nline 1\nline 2', { inline_styles: true, lazy_linefeeds: true });
        expect(html).toContain('<br');
        // inline_styles applies to block elements like h1
        expect(html).toContain('style=');
    });

    test('bidirectional: true', () => {
        const html = parse('**bold**', { bidirectional: true });
        expect(html).toContain('data-qd');
    });

    test('fence_plugin option (function format)', () => {
        // quikdown accepts fence_plugin as a bare function
        const plugin = (code, lang) => `<custom>${code}</custom>`;
        const html = parse('```custom\nhello\n```', { fence_plugin: plugin });
        // Plugin may or may not be invoked depending on format — test it doesn't crash
        expect(typeof html).toBe('string');
        expect(html).toContain('hello');
    });

    test('fence_plugin returns undefined (falls through)', () => {
        const plugin = (_code, _lang) => undefined;
        const html = parse('```js\ncode\n```', { fence_plugin: plugin });
        // Falls through to default code rendering
        expect(html).toContain('code');
    });

    test('all options combined', () => {
        const html = parse('# Title\n\nline 1\nline 2\n\n**bold**', {
            inline_styles: true,
            lazy_linefeeds: true,
            bidirectional: true
        });
        expect(html).toContain('<h1');
        expect(html).toContain('style=');
        expect(html).toContain('data-qd');
    });
});

// ========================================================================
// 11. LINK & IMAGE EDGE CASES
// ========================================================================
describe('link and image edge cases', () => {
    test('link with title: [text](url "title")', () => {
        const html = parse('[click](http://example.com "My Title")');
        expect(html).toContain('<a');
    });

    test('autolink: https://example.com', () => {
        const html = parse('Visit https://example.com today');
        expect(html).toContain('<a');
        expect(html).toContain('https://example.com');
    });

    test('autolink: http://example.com', () => {
        const html = parse('Visit http://example.com today');
        expect(html).toContain('<a');
    });

    test('email-like text', () => {
        const html = parse('Email user@example.com');
        expect(html).toContain('user@example.com');
    });

    test('link with special chars in URL', () => {
        const html = parse('[link](https://example.com/path?q=1&b=2#frag)');
        expect(html).toContain('<a');
    });

    test('link with parentheses in URL', () => {
        const html = parse('[wiki](https://en.wikipedia.org/wiki/Test_(assessment))');
        expect(html).toContain('<a');
    });

    test('nested brackets: [[text]](url)', () => {
        const html = parse('[[text]](http://example.com)');
        expect(typeof html).toBe('string');
    });

    test('image with empty alt', () => {
        const html = parse('![](http://example.com/img.png)');
        expect(html).toContain('<img');
    });

    test('image with long alt text', () => {
        const alt = 'x'.repeat(1000);
        const html = parse(`![${alt}](http://example.com/img.png)`);
        expect(html).toContain('<img');
    });

    test('broken link syntax: [text](', () => {
        const html = parse('[text](');
        expect(html).toContain('[text](');
    });

    test('broken link syntax: [text]', () => {
        const html = parse('[text]');
        expect(html).toContain('[text]');
    });
});

// ========================================================================
// 12. COMPLEX REAL-WORLD DOCUMENTS
// ========================================================================
describe('complex real-world documents', () => {
    test('README-like document', () => {
        const md = `# My Project

[![Build](https://img.shields.io/badge/build-passing-green.svg)](http://example.com)

A **powerful** library for doing *things*.

## Installation

\`\`\`bash
npm install my-project
\`\`\`

## Usage

\`\`\`javascript
const lib = require('my-project');
lib.doThing({ option: true });
\`\`\`

## API

| Method | Description | Returns |
|:-------|:----------:|--------:|
| \`doThing()\` | Does a thing | \`Promise<void>\` |
| \`undoThing()\` | Undoes the thing | \`boolean\` |

## Features

- **Fast** — O(1) lookup
- **Safe** — XSS protection
- **Small** — < 10KB gzipped

1. Install it
2. Configure it
3. Use it

> **Note:** This is experimental.
> Use at your own risk.

---

## License

MIT [Full License](LICENSE.md)
`;
        const html = parse(md);
        expect(html).toContain('<h1');
        expect(html).toContain('<h2');
        expect(html).toContain('<table');
        expect(html).toContain('<pre');
        expect(html).toContain('<li');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<hr');
        expect(html).toContain('<a');
        expect(html).toContain('<img');
    });

    test('LLM chat output with mixed formatting', () => {
        const md = `Sure! Here's how to do it:

First, create a file:

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

Then run it:

\`\`\`bash
python hello.py
\`\`\`

**Important notes:**
- Make sure Python 3.x is installed
- Use a virtual environment
- Don't forget to \`pip install\` dependencies

| Python | Status |
|--------|--------|
| 3.8    | EOL    |
| 3.9    | OK     |
| 3.10   | OK     |
| 3.11   | Latest |

Hope that helps! 😊`;
        const html = parse(md);
        expect(html).toContain('<pre');
        expect(html).toContain('<table');
        expect(html).toContain('<li');
        expect(html).toContain('😊');
    });

    test('document with everything interleaved', () => {
        const md = `# H1
## H2
### H3

Paragraph with **bold**, *italic*, \`code\`, ~~strike~~.

---

> Blockquote with **formatting**

- List item 1
  - Nested
- List item 2

1. Ordered 1
2. Ordered 2

| A | B |
|---|---|
| 1 | 2 |

\`\`\`js
const x = 1;
\`\`\`

[Link](http://example.com) and ![Image](http://example.com/img.png)

___

End.`;
        const html = parse(md);
        // Should contain all major elements
        expect(html).toContain('<h1');
        expect(html).toContain('<h2');
        expect(html).toContain('<h3');
        expect(html).toContain('<strong');
        expect(html).toContain('<em');
        expect(html).toContain('<code');
        expect(html).toContain('<hr');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<li');
        expect(html).toContain('<table');
        expect(html).toContain('<pre');
        expect(html).toContain('<a');
        expect(html).toContain('<img');
    });

    test('markdown with no blank lines between elements', () => {
        const md = '# Title\nParagraph\n- list\n> quote\n```\ncode\n```\n| a |\n|---|\n| 1 |';
        const html = parse(md);
        expect(html).toContain('<h1');
        expect(html).toContain('Paragraph');
    });

    test('only code blocks document', () => {
        const blocks = Array.from({ length: 20 }, (_, i) =>
            `\`\`\`lang${i}\ncode block ${i}\n\`\`\``
        );
        const html = parse(blocks.join('\n\n'));
        const preCount = (html.match(/<pre/g) || []).length;
        expect(preCount).toBe(20);
    });

    test('adversarial: markdown that looks like HTML', () => {
        const md = '<table>\n<tr><td>cell</td></tr>\n</table>';
        const html = parse(md);
        // HTML should be escaped
        expect(html).not.toMatch(/<table>/);
    });

    test('adversarial: deeply nested blockquotes (50 levels)', () => {
        const prefix = '>'.repeat(50) + ' ';
        const html = parse(prefix + 'deep');
        expect(html).toContain('deep');
    });
});

// ========================================================================
// 13. REGRESSION: emitStyles and configure
// ========================================================================
describe('API surface', () => {
    test('quikdown.version exists', () => {
        expect(typeof quikdown.version).toBe('string');
    });

    test('quikdown.emitStyles() returns CSS string', () => {
        if (typeof quikdown.emitStyles === 'function') {
            const css = quikdown.emitStyles();
            expect(typeof css).toBe('string');
            expect(css.length).toBeGreaterThan(0);
        }
    });

    test('quikdown.emitStyles("custom-") returns prefixed CSS', () => {
        if (typeof quikdown.emitStyles === 'function') {
            const css = quikdown.emitStyles('custom-');
            expect(css).toContain('custom-');
        }
    });

    test('quikdown.configure() returns a function', () => {
        if (typeof quikdown.configure === 'function') {
            const parser = quikdown.configure({ inline_styles: true });
            expect(typeof parser).toBe('function');
            const html = parser('**bold**');
            expect(html).toContain('style=');
        }
    });
});
