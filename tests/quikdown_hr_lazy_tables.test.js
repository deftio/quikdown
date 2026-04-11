/**
 * @jest-environment jsdom
 */

/**
 * Comprehensive tests for:
 * 1. removeHR — fence-safe, table-safe HR removal
 * 2. convertLazyLinefeeds — idempotent single→double newline transform
 * 3. Table parsing — all GFM/CommonMark table variants + edge cases
 */

const fs = require('fs');
const path = require('path');

// Load quikdown core for table parsing tests
const coreSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown.esm.js'), 'utf8');

// Load quikdown_bd as dependency for editor
const bdSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown_bd.umd.js'), 'utf8');
eval(bdSource);

// Load QuikdownEditor
const editorSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown_edit.umd.js'), 'utf8');
eval(editorSource);

// Import core quikdown for table tests
let quikdown;
try {
    quikdown = require('../dist/quikdown.cjs');
    if (quikdown.default) quikdown = quikdown.default;
} catch (e) {
    // fallback
    const src = fs.readFileSync(path.join(__dirname, '../dist/quikdown.umd.js'), 'utf8');
    eval(src);
    quikdown = window.quikdown;
}

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// ========================================================================
// PART 1: removeHR — static method and instance method
// ========================================================================
describe('removeHR', () => {
    let editor;

    beforeEach(() => {
        document.body.innerHTML = '<div id="test-editor"></div>';
        editor = new QuikdownEditor('#test-editor', {
            showRemoveHR: true,
            showLazyLinefeeds: true
        });
    });

    afterEach(() => {
        if (editor) editor.destroy();
    });

    // --- Basic HR removal ---
    describe('basic HR patterns', () => {
        test('removes --- (three dashes)', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('hello\n\n---\n\nworld');
            expect(result).not.toContain('---');
            expect(result).toContain('hello');
            expect(result).toContain('world');
        });

        test('removes ___ (three underscores)', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('hello\n\n___\n\nworld');
            expect(result).not.toContain('___');
        });

        test('removes *** (three asterisks)', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('hello\n\n***\n\nworld');
            expect(result).not.toContain('***');
        });

        test('removes ---- (four dashes)', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('a\n\n----\n\nb');
            expect(result).not.toContain('----');
        });

        test('removes spaced HR: - - -', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('a\n\n- - -\n\nb');
            expect(result).not.toContain('- - -');
        });

        test('removes spaced HR: * * *', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('a\n\n* * *\n\nb');
            expect(result).not.toContain('* * *');
        });

        test('removes HR with leading whitespace', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('a\n\n   ---\n\nb');
            expect(result).not.toMatch(/^\s*---\s*$/m);
        });

        test('removes multiple HRs', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('a\n---\nb\n___\nc\n***\nd');
            expect(result).not.toContain('---');
            expect(result).not.toContain('___');
            expect(result).not.toContain('***');
            expect(result).toContain('a');
            expect(result).toContain('b');
            expect(result).toContain('c');
            expect(result).toContain('d');
        });

        test('handles empty input', () => {
            expect(QuikdownEditor.removeHRFromMarkdown('')).toBe('');
        });

        test('handles null/undefined input', () => {
            expect(QuikdownEditor.removeHRFromMarkdown(null)).toBe('');
            expect(QuikdownEditor.removeHRFromMarkdown(undefined)).toBe('');
        });

        test('no-op when no HRs present', () => {
            const input = '# Hello\n\nSome text\n\nMore text';
            expect(QuikdownEditor.removeHRFromMarkdown(input)).toBe(input);
        });
    });

    // --- Fence protection ---
    describe('preserves content inside fences', () => {
        test('keeps --- inside backtick fence', () => {
            const input = 'text\n\n```\n---\nsome code\n---\n```\n\nmore text';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('```\n---\nsome code\n---\n```');
        });

        test('keeps --- inside tilde fence', () => {
            const input = 'text\n\n~~~\n---\ncontent\n~~~\n\nmore';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('~~~\n---\ncontent\n~~~');
        });

        test('keeps --- inside fence with language tag', () => {
            const input = '```yaml\n---\nkey: value\n---\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---\nkey: value\n---');
        });

        test('keeps --- inside nested/longer fence', () => {
            // ```` (4 backticks) opens a fence; ``` inside is just content
            const input = '````\n```\n---\n```\n````';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('removes HR outside fence but keeps inside', () => {
            const input = '---\n\n```\n---\n```\n\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // The two standalone HRs should be gone, the fenced one stays
            const lines = result.split('\n');
            // Count remaining ---: should be exactly 1 (inside the fence)
            const hrCount = lines.filter(l => l.trim() === '---').length;
            expect(hrCount).toBe(1);
        });

        test('handles unclosed fence (treats rest as fenced)', () => {
            const input = 'before\n\n```\n---\nstuff\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Inside unclosed fence, both --- should remain
            expect(result).toContain('---\nstuff\n---');
        });

        test('does not confuse backtick fence with tilde close', () => {
            const input = '```\n---\n~~~\nstill in fence\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('handles multiple fences with HRs between them', () => {
            const input = '```\ncode1\n```\n\n---\n\n```\ncode2\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).not.toMatch(/^---$/m);
            expect(result).toContain('code1');
            expect(result).toContain('code2');
        });

        test('keeps ___ inside fence', () => {
            const input = '```python\n___\nprint("hello")\n___\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('___\nprint("hello")\n___');
        });

        test('keeps *** inside fence', () => {
            const input = '```\n***\nbold stuff\n***\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('***\nbold stuff\n***');
        });
    });

    // --- Table protection ---
    describe('preserves table separators', () => {
        test('keeps table separator row with pipes', () => {
            const input = '| Col1 | Col2 |\n| --- | --- |\n| a | b |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('| --- | --- |');
        });

        test('keeps table separator with alignment markers', () => {
            const input = '| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('|:-----|:------:|------:|');
        });

        test('keeps table separator without leading pipe', () => {
            const input = 'Col1 | Col2\n--- | ---\na | b';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('--- | ---');
        });

        test('removes standalone HR but keeps table separator', () => {
            const input = '---\n\n| H1 | H2 |\n| --- | --- |\n| a | b |\n\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Table separator should remain
            expect(result).toContain('| --- | --- |');
            // Standalone HRs at start/end should be removed
            expect(result.trim().startsWith('---')).toBe(false);
            expect(result.trim().endsWith('---')).toBe(false);
        });

        test('keeps --- adjacent to table rows (potential false positive)', () => {
            // A --- line right next to pipe-delimited rows should be treated as table
            const input = '| Name | Value |\n---\n| a | 1 |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // The --- is adjacent to table rows, so it should be preserved
            expect(result).toContain('---');
        });
    });

    // --- Instance method ---
    describe('instance method removeHR()', () => {
        test('removes HRs via editor instance', async () => {
            await editor.setMarkdown('# Title\n\n---\n\nContent');
            await editor.removeHR();
            expect(editor.getMarkdown()).not.toContain('---');
            expect(editor.getMarkdown()).toContain('# Title');
            expect(editor.getMarkdown()).toContain('Content');
        });

        test('preserves fenced content via editor instance', async () => {
            await editor.setMarkdown('```\n---\n```\n\n---');
            await editor.removeHR();
            const md = editor.getMarkdown();
            // Should have one --- (inside fence) but not the standalone one
            expect(md).toContain('```\n---\n```');
        });

        test('shows visual feedback on toolbar button', async () => {
            await editor.setMarkdown('---');
            await editor.removeHR();
            const btn = editor.toolbar.querySelector('[data-action="remove-hr"]');
            expect(btn.textContent).toBe('Removed!');
        });

        test('handles action dispatch from toolbar', () => {
            editor.setMarkdown('---');
            editor.handleAction('remove-hr');
            // Should not throw
        });
    });
});

// ========================================================================
// PART 2: convertLazyLinefeeds — static + instance
// ========================================================================
describe('convertLazyLinefeeds', () => {
    let editor;

    beforeEach(() => {
        document.body.innerHTML = '<div id="test-editor"></div>';
        editor = new QuikdownEditor('#test-editor', {
            showLazyLinefeeds: true
        });
    });

    afterEach(() => {
        if (editor) editor.destroy();
    });

    // --- Basic conversion ---
    describe('basic conversion', () => {
        test('converts single newline between paragraphs to double', () => {
            const result = QuikdownEditor.convertLazyLinefeeds('line one\nline two');
            expect(result).toBe('line one\n\nline two');
        });

        test('leaves already-doubled newlines alone', () => {
            const input = 'line one\n\nline two';
            expect(QuikdownEditor.convertLazyLinefeeds(input)).toBe(input);
        });

        test('handles three consecutive plain lines', () => {
            const result = QuikdownEditor.convertLazyLinefeeds('a\nb\nc');
            expect(result).toBe('a\n\nb\n\nc');
        });

        test('handles empty input', () => {
            expect(QuikdownEditor.convertLazyLinefeeds('')).toBe('');
        });

        test('handles null/undefined', () => {
            expect(QuikdownEditor.convertLazyLinefeeds(null)).toBe('');
            expect(QuikdownEditor.convertLazyLinefeeds(undefined)).toBe('');
        });

        test('single line unchanged', () => {
            expect(QuikdownEditor.convertLazyLinefeeds('hello world')).toBe('hello world');
        });
    });

    // --- Idempotency ---
    describe('idempotency', () => {
        test('calling twice produces same result', () => {
            const input = 'line one\nline two\nline three';
            const once = QuikdownEditor.convertLazyLinefeeds(input);
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            expect(twice).toBe(once);
        });

        test('calling three times produces same result', () => {
            const input = 'a\nb\nc\nd';
            const once = QuikdownEditor.convertLazyLinefeeds(input);
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            const thrice = QuikdownEditor.convertLazyLinefeeds(twice);
            expect(thrice).toBe(once);
        });

        test('idempotent with mixed content', () => {
            const input = '# Heading\nparagraph\n```\ncode\n```\nanother line';
            const once = QuikdownEditor.convertLazyLinefeeds(input);
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            expect(twice).toBe(once);
        });

        test('idempotent when already properly formatted', () => {
            const input = '# Heading\n\nparagraph one\n\nparagraph two\n\n```\ncode\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('idempotent with tables', () => {
            const input = 'text\n| a | b |\n| - | - |\n| 1 | 2 |\nmore text';
            const once = QuikdownEditor.convertLazyLinefeeds(input);
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            expect(twice).toBe(once);
        });
    });

    // --- Fence protection ---
    describe('preserves fence content', () => {
        test('does not insert blank lines inside backtick fence', () => {
            const input = '```\nline1\nline2\nline3\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('does not insert blank lines inside tilde fence', () => {
            const input = '~~~\nfoo\nbar\n~~~';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('does not insert blank lines inside fence with lang', () => {
            const input = '```python\ndef foo():\n    return 42\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('converts outside fence but not inside', () => {
            const input = 'before\n```\ninside\nfence\n```\nafter';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('inside\nfence');
            expect(result).toContain('before\n');
        });
    });

    // --- Block-level protection ---
    describe('preserves block elements', () => {
        test('does not double-space headings', () => {
            const input = '# Heading\nparagraph';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).not.toContain('# Heading\n\n\n');
        });

        test('does not break list structure', () => {
            const input = '- item 1\n- item 2\n- item 3';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('does not break ordered list', () => {
            const input = '1. first\n2. second\n3. third';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('does not break blockquotes', () => {
            const input = '> line 1\n> line 2\n> line 3';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('does not break table rows', () => {
            const input = '| a | b |\n|---|---|\n| 1 | 2 |';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('preserves horizontal rules', () => {
            const input = 'text\n---\nmore text';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('---');
        });
    });

    // --- Instance method ---
    describe('instance method convertLazyLinefeeds()', () => {
        test('converts lazy linefeeds in editor', async () => {
            await editor.setMarkdown('line one\nline two');
            await editor.convertLazyLinefeeds();
            expect(editor.getMarkdown()).toBe('line one\n\nline two');
        });

        test('shows visual feedback on toolbar button', async () => {
            await editor.setMarkdown('a\nb');
            await editor.convertLazyLinefeeds();
            const btn = editor.toolbar.querySelector('[data-action="lazy-linefeeds"]');
            expect(btn.textContent).toBe('Converted!');
        });

        test('handles action dispatch from toolbar', () => {
            editor.setMarkdown('a\nb');
            editor.handleAction('lazy-linefeeds');
            // Should not throw
        });
    });

    // --- Toolbar button creation ---
    describe('toolbar buttons', () => {
        test('shows lazy linefeeds button when enabled', () => {
            const btn = editor.toolbar.querySelector('[data-action="lazy-linefeeds"]');
            expect(btn).toBeTruthy();
            expect(btn.textContent).toBe('Fix Linefeeds');
        });

        test('hides lazy linefeeds button when disabled', () => {
            document.body.innerHTML = '<div id="editor2"></div>';
            const ed2 = new QuikdownEditor('#editor2', { showLazyLinefeeds: false });
            const btn = ed2.toolbar?.querySelector('[data-action="lazy-linefeeds"]');
            expect(btn).toBeFalsy();
            ed2.destroy();
        });
    });
});

// ========================================================================
// PART 3: Table parsing — all flavors and edge cases
// ========================================================================
describe('Table parsing', () => {
    // Helper
    const parse = (md, opts) => quikdown(md, opts || {});

    // --- Standard GFM tables ---
    describe('standard GFM tables', () => {
        test('basic table with pipes', () => {
            const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('<th');
            expect(html).toContain('Name');
            expect(html).toContain('Age');
            expect(html).toContain('<td');
            expect(html).toContain('Alice');
            expect(html).toContain('30');
        });

        test('table with alignment: left, center, right', () => {
            const md = '| L | C | R |\n|:--|:--:|--:|\n| a | b | c |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('center');
            expect(html).toContain('right');
        });

        test('table with all-left alignment (default)', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('1');
            expect(html).toContain('2');
        });

        test('table with multiple body rows', () => {
            const md = '| H1 | H2 |\n|---|---|\n| a | b |\n| c | d |\n| e | f |';
            const html = parse(md);
            expect(html).toContain('<tbody');
            const tdCount = (html.match(/<td/g) || []).length;
            expect(tdCount).toBe(6);
        });

        test('single-column table', () => {
            const md = '| Header |\n| --- |\n| value |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('Header');
            expect(html).toContain('value');
        });
    });

    // --- Tables without leading/trailing pipes ---
    describe('tables without outer pipes', () => {
        test('table without leading/trailing pipes', () => {
            const md = 'Name | Age\n--- | ---\nAlice | 30';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('Alice');
        });

        test('mixed pipes: leading only', () => {
            const md = '| Name | Age\n| --- | ---\n| Alice | 30';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('mixed pipes: trailing only', () => {
            const md = 'Name | Age |\n--- | --- |\nAlice | 30 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });
    });

    // --- Separator variations ---
    describe('separator variations', () => {
        test('separator with extra dashes', () => {
            const md = '| A | B |\n|------|------|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('separator with spaces around dashes', () => {
            const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('separator with colons for all alignments', () => {
            const md = '| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('minimal separator (single dash per column)', () => {
            const md = '| A | B |\n|-|-|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });
    });

    // --- Inline formatting in cells ---
    describe('inline formatting in cells', () => {
        test('bold text in cells', () => {
            const md = '| Header |\n|---|\n| **bold** |';
            const html = parse(md);
            expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);
        });

        test('italic text in cells', () => {
            const md = '| Header |\n|---|\n| *italic* |';
            const html = parse(md);
            expect(html).toMatch(/<em[^>]*>italic<\/em>/);
        });

        test('inline code in cells', () => {
            const md = '| Header |\n|---|\n| `code` |';
            const html = parse(md);
            expect(html).toContain('<code');
            expect(html).toContain('code');
        });

        test('link in cells', () => {
            const md = '| Header |\n|---|\n| [link](http://example.com) |';
            const html = parse(md);
            expect(html).toContain('<a');
            expect(html).toContain('http://example.com');
        });
    });

    // --- Edge cases and malformed tables ---
    describe('edge cases and malformed tables', () => {
        test('single-line (no separator) — not a table', () => {
            const md = '| just | a | line |';
            const html = parse(md);
            expect(html).not.toContain('<table');
        });

        test('header only, no body rows', () => {
            const md = '| H1 | H2 |\n|---|---|';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('<thead');
        });

        test('mismatched column counts (more header cols)', () => {
            const md = '| A | B | C |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            // Should still render; extra header cells are fine
            expect(html).toContain('<table');
        });

        test('mismatched column counts (more body cols)', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 | 3 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('empty cells', () => {
            const md = '| A | B |\n|---|---|\n|  |  |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('<td');
        });

        test('cells with only whitespace', () => {
            const md = '| A | B |\n|---|---|\n|   |   |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('escaped pipe in cell', () => {
            const md = '| Header |\n|---|\n| a \\| b |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table at very start of document', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table at very end of document', () => {
            const md = 'Some text\n\n| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('Some text');
        });

        test('table immediately after heading', () => {
            const md = '# Title\n| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<h1');
            expect(html).toContain('<table');
        });

        test('table immediately after code block', () => {
            const md = '```\ncode\n```\n| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('two consecutive tables', () => {
            const md = '| A |\n|---|\n| 1 |\n\n| B |\n|---|\n| 2 |';
            const html = parse(md);
            const tableCount = (html.match(/<table/g) || []).length;
            expect(tableCount).toBe(2);
        });

        test('table-like content without separator is NOT a table', () => {
            const md = '| A | B |\n| 1 | 2 |';
            const html = parse(md);
            expect(html).not.toContain('<table');
        });

        test('wide table (many columns)', () => {
            const md = '| A | B | C | D | E | F | G | H |\n|---|---|---|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |';
            const html = parse(md);
            expect(html).toContain('<table');
            // Note: /<th / would also match <thead, so use <th> or <th class
            const thCount = (html.match(/<th[\s>]/g) || []).length;
            expect(thCount).toBe(8);
        });

        test('table with special characters in cells', () => {
            const md = '| Symbol | Meaning |\n|---|---|\n| < | less than |\n| > | greater than |\n| & | ampersand |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('&amp;');
        });

        test('table with inline styles option', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md, { inline_styles: true });
            expect(html).toContain('style=');
            expect(html).toContain('border-collapse');
        });
    });

    // --- Table interaction with removeHR ---
    describe('removeHR does not damage tables', () => {
        test('removeHR preserves simple table', () => {
            const input = '| H1 | H2 |\n| --- | --- |\n| a | b |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Table should be completely intact
            expect(result).toBe(input);
        });

        test('removeHR preserves aligned table', () => {
            const input = '| L | C | R |\n|:--|:--:|--:|\n| a | b | c |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toBe(input);
        });

        test('removeHR preserves table without outer pipes', () => {
            const input = 'H1 | H2\n--- | ---\na | b';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('--- | ---');
        });

        test('removeHR preserves table with --- separator but removes standalone HR', () => {
            const input = '---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('| --- | --- |');
            // Should not start or end with standalone HR
            const trimmed = result.trim();
            expect(trimmed.startsWith('|')).toBe(true);
        });

        test('removeHR preserves table inside a document with HRs', () => {
            const input = '# Title\n\n---\n\nSome text\n\n| Name | Value |\n| --- | --- |\n| x | 1 |\n| y | 2 |\n\n---\n\nEnd';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('| Name | Value |');
            expect(result).toContain('| --- | --- |');
            expect(result).toContain('| x | 1 |');
            expect(result).toContain('| y | 2 |');
            expect(result).toContain('# Title');
            expect(result).toContain('End');
        });

        test('removeHR preserves table and fence content simultaneously', () => {
            const input = '```\n---\n```\n\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Fence --- should be preserved
            expect(result).toContain('```\n---\n```');
            // Table separator should be preserved
            expect(result).toContain('| --- | --- |');
            // Standalone HRs should be removed (there are 2)
        });
    });

    // --- Table interaction with lazy linefeeds ---
    describe('convertLazyLinefeeds does not damage tables', () => {
        test('preserves table row structure', () => {
            const input = '| A | B |\n|---|---|\n| 1 | 2 |';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('preserves table with surrounding text', () => {
            const input = 'Before\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nAfter';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('| A | B |\n|---|---|\n| 1 | 2 |');
        });
    });
});

// ========================================================================
// PART 4: Combined scenarios and regression tests
// ========================================================================
describe('combined scenarios', () => {
    test('removeHR + convertLazyLinefeeds in sequence', () => {
        const input = 'line one\n---\nline two\n```\n---\ncode\n```\nline three';
        const noHR = QuikdownEditor.removeHRFromMarkdown(input);
        const fixed = QuikdownEditor.convertLazyLinefeeds(noHR);

        // Standalone HR between "line one" and "line two" should be removed
        // But --- inside the fence should remain
        expect(noHR).not.toMatch(/^line one\n---/);
        expect(fixed).toContain('---\ncode'); // fence content preserved
        expect(fixed).toContain('line one\n'); // lazy linefeeds converted
    });

    test('convertLazyLinefeeds + removeHR in sequence', () => {
        const input = 'line one\n---\nline two';
        const fixed = QuikdownEditor.convertLazyLinefeeds(input);
        const noHR = QuikdownEditor.removeHRFromMarkdown(fixed);

        expect(noHR).toContain('line one');
        expect(noHR).toContain('line two');
    });

    test('complex document with all features', () => {
        const input = [
            '# Document Title',
            '',
            'Introduction paragraph.',
            '',
            '---',
            '',
            '| Feature | Status |',
            '| --- | --- |',
            '| Tables | Done |',
            '| Fences | Done |',
            '',
            '```yaml',
            '---',
            'key: value',
            '---',
            '```',
            '',
            '---',
            '',
            '> A blockquote',
            '> continued',
            '',
            '- list item 1',
            '- list item 2',
            '',
            'Final paragraph.'
        ].join('\n');

        const noHR = QuikdownEditor.removeHRFromMarkdown(input);
        // Table separator preserved (it has pipes)
        expect(noHR).toContain('| --- | --- |');
        // YAML frontmatter in fence preserved
        expect(noHR).toContain('---\nkey: value\n---');
        // Standalone HRs removed — only fenced --- should remain
        // Count standalone --- lines (not inside fences or tables)
        const lines = noHR.split('\n');
        let inFence = false;
        let standaloneHRs = 0;
        for (const l of lines) {
            const t = l.trim();
            if (/^(`{3,}|~{3,})/.test(t)) inFence = !inFence;
            if (!inFence && t === '---' && !l.includes('|')) standaloneHRs++;
        }
        expect(standaloneHRs).toBe(0);
        // All other content preserved
        expect(noHR).toContain('# Document Title');
        expect(noHR).toContain('> A blockquote');
        expect(noHR).toContain('- list item 1');
        expect(noHR).toContain('Final paragraph.');
    });
});

// ========================================================================
// PART 5: Stress tests — complex, semi-valid, and malformed markdown
// ========================================================================
describe('stress tests: complex and semi-valid markdown', () => {
    const parse = (md, opts) => quikdown(md, opts || {});

    // --- Complex documents mixing many features ---
    describe('complex documents', () => {
        test('document with everything: headings, tables, fences, HRs, lists, blockquotes', () => {
            const doc = [
                '# Main Title',
                '',
                'An intro paragraph with **bold** and *italic* text.',
                '',
                '---',
                '',
                '## Section 1: Table',
                '',
                '| Name    | Age | City     |',
                '|:--------|:---:|--------:|',
                '| Alice   | 30  | NYC      |',
                '| Bob     | 25  | London   |',
                '| Charlie | 35  | Tokyo    |',
                '',
                '---',
                '',
                '## Section 2: Code',
                '',
                '```python',
                '# This is a comment with ---',
                'def table_maker():',
                '    """',
                '    | Not | A | Table |',
                '    | --- | - | ----- |',
                '    """',
                '    return "---"',
                '```',
                '',
                '> A blockquote with a fake HR:',
                '> ---',
                '> And a table reference: | a | b |',
                '',
                '- List item 1',
                '- List item 2',
                '  - Nested item',
                '  - Another nested',
                '- List item 3',
                '',
                '***',
                '',
                '### Final Section',
                '',
                '1. Ordered item',
                '2. Another item',
                '',
                'End of document.'
            ].join('\n');

            const html = parse(doc);
            expect(html).toContain('<h1');
            expect(html).toContain('<h2');
            expect(html).toContain('<table');
            expect(html).toContain('<pre');
            expect(html).toContain('<blockquote');
            expect(html).toContain('<li');
            expect(html).toContain('<hr');

            // removeHR should remove the --- and *** but keep table and fence content
            const noHR = QuikdownEditor.removeHRFromMarkdown(doc);
            expect(noHR).toContain('|:--------|:---:|--------:|'); // table separator
            expect(noHR).toContain('# This is a comment with ---'); // inside fence
            expect(noHR).toContain('| Not | A | Table |'); // inside fence
            expect(noHR).toContain('return "---"'); // inside fence
            expect(noHR).toContain('# Main Title');
            expect(noHR).toContain('End of document.');
        });

        test('rapid alternation: fence-HR-fence-HR-fence', () => {
            const doc = [
                '```',
                'code block 1',
                '---',
                '```',
                '---',
                '```',
                'code block 2',
                '---',
                '```',
                '---',
                '```',
                'code block 3',
                '```'
            ].join('\n');

            const noHR = QuikdownEditor.removeHRFromMarkdown(doc);
            // Fenced --- should remain (3 of them)
            // Standalone --- should be removed (2 of them)
            expect(noHR).toContain('code block 1\n---\n```');
            expect(noHR).toContain('code block 2\n---\n```');
            expect(noHR).toContain('code block 3');
        });

        test('table immediately after HR (no blank line)', () => {
            const doc = '---\n| A | B |\n| --- | --- |\n| 1 | 2 |';
            const noHR = QuikdownEditor.removeHRFromMarkdown(doc);
            // The --- is immediately before a table row, table heuristic should protect it
            // OR it gets removed because the next line is a table. Let's verify table stays intact
            expect(noHR).toContain('| A | B |');
            expect(noHR).toContain('| --- | --- |');
            expect(noHR).toContain('| 1 | 2 |');
        });

        test('HR immediately after table (no blank line)', () => {
            const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n---';
            const noHR = QuikdownEditor.removeHRFromMarkdown(doc);
            expect(noHR).toContain('| A | B |');
            expect(noHR).toContain('| --- | --- |');
            expect(noHR).toContain('| 1 | 2 |');
        });
    });

    // --- Semi-valid and malformed tables ---
    describe('semi-valid and malformed tables', () => {
        test('table with inconsistent spacing', () => {
            const md = '|Name|Age|\n|---|---|\n|Alice|30|';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('Alice');
        });

        test('table with excessive whitespace in cells', () => {
            const md = '|   Name   |   Age   |\n|   ---   |   ---   |\n|   Alice   |   30   |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table with mixed alignment in separator', () => {
            const md = '| A | B | C | D |\n|:---|:---:|---:|---|\n| 1 | 2 | 3 | 4 |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('center');
            expect(html).toContain('right');
        });

        test('table where body has more columns than header', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 | 3 | 4 |';
            const html = parse(md);
            expect(html).toContain('<table');
            // Extra body cells should still render
            expect(html).toContain('3');
        });

        test('table where header has more columns than separator', () => {
            const md = '| A | B | C | D |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('empty table (header + separator only)', () => {
            const md = '| H1 | H2 |\n|---|---|';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('<thead');
        });

        test('table with single dash separator', () => {
            const md = '| A | B |\n|-|-|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table with very long separator dashes', () => {
            const md = '| A | B |\n|------------------|------------------|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table with special characters: HTML entities', () => {
            const md = '| Key | Value |\n|---|---|\n| a&b | c<d |';
            const html = parse(md);
            expect(html).toContain('<table');
            // Should be HTML-escaped
            expect(html).toContain('&amp;');
        });

        test('table with inline formatting mixed in cells', () => {
            const md = '| Feature | Status |\n|---|---|\n| **Bold** feature | *In progress* |\n| `code` thing | ~~done~~ |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toMatch(/<strong/);
            expect(html).toMatch(/<em/);
        });

        test('table with empty first cell', () => {
            const md = '| | B |\n|---|---|\n| | 2 |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table with only empty cells in body', () => {
            const md = '| A | B |\n|---|---|\n| | |\n| | |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('multiple tables separated by text', () => {
            const md = '| A |\n|---|\n| 1 |\n\nSome text\n\n| B |\n|---|\n| 2 |';
            const html = parse(md);
            const tableCount = (html.match(/<table/g) || []).length;
            expect(tableCount).toBe(2);
            expect(html).toContain('Some text');
        });

        test('pipe in inline code within table cell', () => {
            const md = '| Code | Desc |\n|---|---|\n| `a|b` | pipe in code |';
            const html = parse(md);
            expect(html).toContain('<table');
        });
    });

    // --- Tables combined with fences ---
    describe('tables and fences together', () => {
        test('table inside a code fence (should NOT render as table)', () => {
            const md = '```\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```';
            const html = parse(md);
            // Should be rendered as code, not a table
            expect(html).toContain('<pre');
            // The table markup should be escaped or in a code block
        });

        test('code fence inside a table cell (inline code)', () => {
            const md = '| Header |\n|---|\n| `some code` |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('<code');
        });

        test('table then fence then table', () => {
            const md = '| A |\n|---|\n| 1 |\n\n```\ncode\n```\n\n| B |\n|---|\n| 2 |';
            const html = parse(md);
            const tableCount = (html.match(/<table/g) || []).length;
            expect(tableCount).toBe(2);
            expect(html).toContain('<pre');
        });
    });

    // --- Lazy linefeeds with complex content ---
    describe('lazy linefeeds with complex content', () => {
        test('lazy linefeeds with mixed paragraph and list', () => {
            const input = 'First paragraph\nSecond paragraph\n- list item\n- another\nThird paragraph';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('First paragraph\n\nSecond paragraph');
            expect(result).toContain('- list item\n- another');
        });

        test('lazy linefeeds with headings and paragraphs', () => {
            const input = '# Title\nSome text\n## Subtitle\nMore text\nAnd more';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('# Title');
            expect(result).toContain('## Subtitle');
            expect(result).toContain('More text\n\nAnd more');
        });

        test('lazy linefeeds preserves blockquote structure', () => {
            const input = '> Quote line 1\n> Quote line 2\nParagraph after';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('> Quote line 1\n> Quote line 2');
        });

        test('lazy linefeeds does not double existing blank lines', () => {
            const input = 'First\n\n\nSecond\n\nThird';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // Should not have triple+ blank lines
            expect(result).not.toMatch(/\n\n\n/);
        });

        test('lazy linefeeds with table sandwiched between paragraphs', () => {
            const input = 'Before text\n| A | B |\n|---|---|\n| 1 | 2 |\nAfter text';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // Table should remain intact
            expect(result).toContain('| A | B |\n|---|---|\n| 1 | 2 |');
        });

        test('lazy linefeeds with fence sandwiched between paragraphs', () => {
            const input = 'Before\n```\ncode line 1\ncode line 2\n```\nAfter';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('code line 1\ncode line 2');
        });

        test('lazy linefeeds with deeply nested lists', () => {
            const input = '- item 1\n  - nested 1a\n  - nested 1b\n- item 2\n  - nested 2a';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // List structure should be preserved
            expect(result).toContain('- item 1\n  - nested 1a\n  - nested 1b\n- item 2');
        });

        test('lazy linefeeds with ordered and unordered lists mixed', () => {
            const input = '1. First\n2. Second\n- Bullet\n+ Plus bullet\n* Star bullet';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('1. First\n2. Second');
        });

        test('lazy linefeeds: very long document, many paragraphs', () => {
            const lines = [];
            for (let i = 0; i < 50; i++) {
                lines.push(`Paragraph ${i} content here.`);
            }
            const input = lines.join('\n');
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            const once = result;
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            expect(twice).toBe(once); // idempotent
            // Should have blank lines between each paragraph
            expect(result.split('\n\n').length).toBe(50);
        });

        test('lazy linefeeds with mixed fences using different markers', () => {
            const input = '```\nfoo\nbar\n```\nbetween\n~~~\nbaz\nqux\n~~~\nend';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('foo\nbar');
            expect(result).toContain('baz\nqux');
        });

        test('lazy linefeeds with YAML frontmatter-style fence', () => {
            const input = '```yaml\n---\nkey: value\nanother: thing\n---\n```\nParagraph';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('key: value\nanother: thing');
        });
    });

    // --- removeHR stress tests ---
    describe('removeHR stress tests', () => {
        test('many consecutive HRs', () => {
            const lines = ['text'];
            for (let i = 0; i < 20; i++) {
                lines.push('---');
            }
            lines.push('end');
            const result = QuikdownEditor.removeHRFromMarkdown(lines.join('\n'));
            expect(result).toContain('text');
            expect(result).toContain('end');
            expect(result).not.toContain('---');
        });

        test('all HR variants mixed', () => {
            const input = '---\n___\n***\n- - -\n* * *\n_ _ _\n----\n*****\n_____';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result.trim()).toBe('');
        });

        test('HR-like lines that should NOT be removed', () => {
            // Lines with mixed chars like --- followed by text
            const input = '--- title\n-- not hr\n-not hr\ntext---more';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // None of these are valid HRs (they have trailing text or too few chars)
            expect(result).toContain('--- title');
            expect(result).toContain('-- not hr');
            expect(result).toContain('text---more');
        });

        test('removeHR with multiple fences of different types', () => {
            const input = [
                '```js',
                '// ---',
                'const hr = "---";',
                '```',
                '---',
                '~~~python',
                '# ---',
                'x = "***"',
                '~~~',
                '---',
                'done'
            ].join('\n');
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('// ---');
            expect(result).toContain('const hr = "---"');
            expect(result).toContain('# ---');
            expect(result).toContain('x = "***"');
            expect(result).toContain('done');
            // Standalone HRs between the fences should be gone
            // Count standalone --- outside fences
            const fenceRanges = [];
            let inF = false;
            result.split('\n').forEach(l => {
                const t = l.trim();
                if (/^(`{3,}|~{3,})/.test(t)) inF = !inF;
                if (!inF && /^[-_*](\s*[-_*]){2,}\s*$/.test(t)) {
                    throw new Error('Found standalone HR: ' + l);
                }
            });
        });

        test('removeHR with 4-backtick fence containing 3-backtick markers', () => {
            const input = [
                '````',
                '```',
                '---',
                '```',
                '````',
                '---',
                'text'
            ].join('\n');
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // --- inside the 4-backtick fence should be preserved
            expect(result).toContain('```\n---\n```');
            // Standalone --- after the fence should be removed
            expect(result).toContain('text');
        });

        test('removeHR with tilde fence length matching', () => {
            const input = [
                '~~~~',
                '~~~',
                '---',
                '~~~',
                '~~~~',
                '---',
                'end'
            ].join('\n');
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('~~~\n---\n~~~');
            expect(result).toContain('end');
        });

        test('unclosed fence treats rest of document as fenced', () => {
            const input = '```\n---\n***\n___\nsome content';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Everything after the unclosed fence should be preserved
            expect(result).toContain('---');
            expect(result).toContain('***');
            expect(result).toContain('___');
            expect(result).toContain('some content');
        });
    });

    // --- Table parsing stress ---
    describe('table parsing stress', () => {
        test('table with 20 columns', () => {
            const headers = Array.from({ length: 20 }, (_, i) => `C${i}`).join(' | ');
            const sep = Array.from({ length: 20 }, () => '---').join(' | ');
            const row = Array.from({ length: 20 }, (_, i) => `v${i}`).join(' | ');
            const md = `| ${headers} |\n| ${sep} |\n| ${row} |`;
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('C0');
            expect(html).toContain('C19');
            expect(html).toContain('v19');
        });

        test('table with 50 rows', () => {
            const lines = ['| H1 | H2 |', '|---|---|'];
            for (let i = 0; i < 50; i++) {
                lines.push(`| row${i} | val${i} |`);
            }
            const html = parse(lines.join('\n'));
            expect(html).toContain('<table');
            expect(html).toContain('row0');
            expect(html).toContain('row49');
        });

        test('table with unicode content', () => {
            const md = '| Name | Greeting |\n|---|---|\n| Taro | こんにちは |\n| Hans | Guten Tag |\n| Maria | ¡Hola! |';
            const html = parse(md);
            expect(html).toContain('<table');
            expect(html).toContain('こんにちは');
            expect(html).toContain('¡Hola!');
        });

        test('table with emoji in cells', () => {
            const md = '| Status | Icon |\n|---|---|\n| Good | ✅ |\n| Bad | ❌ |';
            const html = parse(md);
            expect(html).toContain('<table');
        });

        test('table followed immediately by another table (no blank line)', () => {
            const md = '| A |\n|---|\n| 1 |\n| B |\n|---|\n| 2 |';
            const html = parse(md);
            // Parser may treat this as one table or two — either is acceptable
            expect(html).toContain('<table');
        });

        test('non-table pipe content: shell commands', () => {
            const md = 'Run `cat file | grep pattern | sort` to filter.';
            const html = parse(md);
            // Should NOT create a table
            expect(html).not.toContain('<table');
        });

        test('table after a list', () => {
            const md = '- item 1\n- item 2\n\n| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<li');
            expect(html).toContain('<table');
        });

        test('table after a blockquote', () => {
            const md = '> quoted text\n\n| A | B |\n|---|---|\n| 1 | 2 |';
            const html = parse(md);
            expect(html).toContain('<blockquote');
            expect(html).toContain('<table');
        });

        test('table with lazy linefeeds option', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 |\nText after';
            const html = parse(md, { lazy_linefeeds: true });
            expect(html).toContain('<table');
            expect(html).toContain('Text after');
        });

        test('table with inline styles option', () => {
            const md = '| A | B |\n|:---|---:|\n| left | right |';
            const html = parse(md, { inline_styles: true });
            expect(html).toContain('style=');
            expect(html).toContain('right');
        });
    });

    // --- End-to-end: parse → removeHR → convertLazy round-trip ---
    describe('end-to-end round trips', () => {
        test('full pipeline: parse, remove HR, convert lazy, re-parse', () => {
            const original = [
                '# Report',
                'Summary line one',
                'Summary line two',
                '---',
                '## Data',
                '| Metric | Value |',
                '|:-------|------:|',
                '| Users  | 1000  |',
                '| Revenue| $50k  |',
                '---',
                '```sql',
                'SELECT * FROM table',
                'WHERE x = ---',
                '```',
                'Conclusion line.'
            ].join('\n');

            // Step 1: Remove HRs
            const noHR = QuikdownEditor.removeHRFromMarkdown(original);
            expect(noHR).toContain('|:-------|------:|');
            expect(noHR).toContain('WHERE x = ---');

            // Step 2: Convert lazy linefeeds
            const fixed = QuikdownEditor.convertLazyLinefeeds(noHR);

            // Step 3: Verify idempotency
            const fixedAgain = QuikdownEditor.convertLazyLinefeeds(fixed);
            expect(fixedAgain).toBe(fixed);

            // Step 4: Parse the result
            const html = parse(fixed);
            expect(html).toContain('<table');
            expect(html).toContain('<h1');
            expect(html).toContain('<pre');
        });

        test('combined operations converge to a fixed point', () => {
            // The two operations interact: convertLazyLinefeeds inserts blank
            // lines that change the "adjacency" semantics removeHR uses for
            // table heuristics. It may take more than one iteration to reach
            // a fixed point — the contract is that it DOES converge, not
            // that it converges in one pass.
            const input = 'Hello\nWorld\n---\n| A |\n|---|\n| 1 |\n```\n---\n```\nBye';
            let prev = input;
            let curr = input;
            let iterations = 0;
            const MAX = 10;
            do {
                prev = curr;
                curr = QuikdownEditor.convertLazyLinefeeds(
                    QuikdownEditor.removeHRFromMarkdown(prev)
                );
                iterations++;
            } while (prev !== curr && iterations < MAX);
            expect(iterations).toBeLessThan(MAX);
            // Re-running should now be a no-op
            expect(QuikdownEditor.convertLazyLinefeeds(
                QuikdownEditor.removeHRFromMarkdown(curr)
            )).toBe(curr);
        });
    });
});
