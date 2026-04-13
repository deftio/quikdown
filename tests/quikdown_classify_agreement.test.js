/**
 * @jest-environment jsdom
 */

/**
 * Agreement tests for quikdown_classify shared utilities.
 *
 * Verifies:
 *   1. isHRLine — unit tests including former ReDoS vectors
 *   2. Fence detection — fenceOpen / isFenceClose
 *   3. Parser vs editor HR agreement
 *   4. Lazy linefeed idempotency
 *   5. Full document integration tests
 */

const fs = require('fs');
const path = require('path');

// ── Load shared classify module (ESM source → transpiled via dist) ──
// The classify functions are bundled into the dist builds, so we test
// them indirectly through the editor and parser.  For direct unit tests,
// we load the source via a simple require-compatible approach.
//
// Since the source is ESM, we eval the UMD bundles which inline the
// classify functions.

// Load quikdown core
let quikdown;
try {
    quikdown = require('../dist/quikdown.cjs');
    if (quikdown.default) quikdown = quikdown.default;
} catch (e) {
    const src = fs.readFileSync(path.join(__dirname, '../dist/quikdown.umd.js'), 'utf8');
    eval(src);
    quikdown = window.quikdown;
}

// Load quikdown_bd (dependency for editor)
const bdSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown_bd.umd.js'), 'utf8');
eval(bdSource);

// Load QuikdownEditor
const editorSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown_edit.umd.js'), 'utf8');
eval(editorSource);

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
// SECTION 1: isHRLine unit tests (via removeHRFromMarkdown)
// ========================================================================
describe('isHRLine — HR detection via removeHR', () => {
    const removesHR = (line) => {
        const result = QuikdownEditor.removeHRFromMarkdown(`before\n\n${line}\n\nafter`);
        return !result.includes(line.trim());
    };

    describe('valid CommonMark HR variants', () => {
        test.each([
            ['---',     'three dashes'],
            ['***',     'three asterisks'],
            ['___',     'three underscores'],
            ['----',    'four dashes'],
            ['*****',   'five asterisks'],
            ['_____',   'five underscores'],
            ['- - -',   'spaced dashes'],
            ['* * *',   'spaced asterisks'],
            ['_ _ _',   'spaced underscores'],
            ['-  -  -', 'double-spaced dashes'],
            ['*  *  *', 'double-spaced asterisks'],
            ['_  _  _', 'double-spaced underscores'],
            [' ---',    'leading space + dashes'],
            ['  ***',   'two leading spaces + asterisks'],
        ])('removes "%s" (%s)', (hr) => {
            expect(removesHR(hr)).toBe(true);
        });
    });

    describe('non-HR lines (should NOT be removed)', () => {
        test.each([
            ['--',        'too few dashes'],
            ['**',        'too few asterisks'],
            ['__',        'too few underscores'],
            ['- text',    'dash followed by text (list item)'],
            ['---text',   'dashes followed by text (no space)'],
            ['',          'empty string'],
            ['   ',       'whitespace only'],
            ['-_*',       'mixed HR chars'],
            ['-*-',       'mixed chars (dash asterisk dash)'],
            ['abc',       'plain text'],
        ])('keeps "%s" (%s)', (line) => {
            expect(removesHR(line)).toBe(false);
        });
    });

    describe('pathological inputs (former ReDoS vectors)', () => {
        test('handles "- " repeated 1000 times + "x" without hanging', () => {
            const adversarial = '- '.repeat(1000) + 'x';
            const start = Date.now();
            QuikdownEditor.removeHRFromMarkdown(adversarial);
            const elapsed = Date.now() - start;
            // Should complete in well under 1 second (linear scan)
            expect(elapsed).toBeLessThan(1000);
        });

        test('handles 10000 dashes', () => {
            const longDashes = '-'.repeat(10000);
            const result = QuikdownEditor.removeHRFromMarkdown(`before\n\n${longDashes}\n\nafter`);
            expect(result).not.toContain(longDashes);
        });

        test('handles "_ " repeated 5000 times', () => {
            const adversarial = '_ '.repeat(5000);
            const start = Date.now();
            QuikdownEditor.removeHRFromMarkdown(adversarial);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(1000);
        });
    });
});

// ========================================================================
// SECTION 2: Fence detection unit tests
// ========================================================================
describe('fence detection via removeHR and convertLazy', () => {
    describe('backtick fences', () => {
        test('3-backtick fence protects content', () => {
            const input = '```\n---\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('4-backtick fence protects content including 3-backtick lines', () => {
            const input = '````\n```\n---\n```\n````';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('fence with language tag', () => {
            const input = '```python\n---\ndef foo(): pass\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('inline backticks are not fences', () => {
            const input = '`inline` code\n---\nmore text';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // The --- is NOT inside a fence, so it should be removed
            expect(result).not.toMatch(/^---$/m);
        });
    });

    describe('tilde fences', () => {
        test('3-tilde fence protects content', () => {
            const input = '~~~\n---\n~~~';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('4-tilde fence protects 3-tilde lines inside', () => {
            const input = '~~~~\n~~~\n---\n~~~\n~~~~';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });
    });

    describe('fence close must match char and length', () => {
        test('backtick fence not closed by tildes', () => {
            const input = '```\n---\n~~~\nstill in fence\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
            expect(result).toContain('still in fence');
        });

        test('shorter fence does not close longer fence', () => {
            const input = '````\n```\n---\n```\n````';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // ``` inside ```` is body content, not a close
            expect(result).toContain('---');
        });

        test('longer fence DOES close shorter fence (CommonMark)', () => {
            // ```` closes ``` because close needs >= opening length
            const input = '```\n---\n````\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // First --- is inside fence (protected)
            // ```` closes the ``` fence
            // Second --- is outside fence (removed)
            expect(result).toContain('```\n---\n````');
            // The trailing --- should be removed
            const lines = result.split('\n');
            expect(lines[lines.length - 1].trim()).not.toBe('---');
        });

        test('5-backtick fence protects 3 and 4 backtick markers inside', () => {
            const input = '`````\n```\n---\n````\n***\n`````';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Everything inside 5-backtick fence is protected
            expect(result).toContain('---');
            expect(result).toContain('***');
        });

        test('tilde length matching works the same way', () => {
            const input = '~~~~\n~~~\n---\n~~~\n~~~~';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });
    });

    describe('fence with language tag vs bare fence', () => {
        test('fence opener with lang opens fence', () => {
            const input = '```yaml\n---\nkey: value\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
        });

        test('fence close cannot have language tag', () => {
            // A "closing" line like "```js" is not a valid close
            const input = '```\ncode\n```js\n---\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // ```js is NOT a close, so --- is still inside the fence
            expect(result).toContain('---');
        });
    });
});

// ========================================================================
// SECTION 3: Parser vs editor HR agreement
// ========================================================================
describe('parser vs editor HR agreement', () => {
    describe('known semantic gap: main parser only does dash HRs', () => {
        // The main parser only recognizes --- as HR.
        // The editor's removeHR recognizes ---, ***, ___, etc.
        // This is intentional — documented in the plan.
        test('parser renders --- as <hr>', () => {
            const html = quikdown('---');
            expect(html).toContain('<hr');
        });

        test('parser does NOT render *** as <hr>', () => {
            const html = quikdown('***');
            expect(html).not.toContain('<hr');
        });

        test('parser does NOT render ___ as <hr>', () => {
            const html = quikdown('___');
            expect(html).not.toContain('<hr');
        });

        test('editor removes --- as HR', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('before\n\n---\n\nafter');
            expect(result).not.toMatch(/^---$/m);
        });

        test('editor removes *** as HR', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('before\n\n***\n\nafter');
            expect(result).not.toMatch(/^\*\*\*$/m);
        });

        test('editor removes ___ as HR', () => {
            const result = QuikdownEditor.removeHRFromMarkdown('before\n\n___\n\nafter');
            expect(result).not.toMatch(/^___$/m);
        });
    });

    describe('both agree on fence protection', () => {
        const fencedDoc = '```\n---\n***\n___\n```';

        test('parser does not treat fenced --- as HR', () => {
            const html = quikdown(fencedDoc);
            // The --- should be inside <pre><code>, not an <hr>
            expect(html).toContain('<pre');
            // Count <hr> tags — should be 0
            expect((html.match(/<hr/g) || []).length).toBe(0);
        });

        test('editor does not remove fenced HRs', () => {
            const result = QuikdownEditor.removeHRFromMarkdown(fencedDoc);
            expect(result).toContain('---');
            expect(result).toContain('***');
            expect(result).toContain('___');
        });
    });

    describe('both agree on table protection', () => {
        const tableDoc = '| H1 | H2 |\n| --- | --- |\n| a | b |';

        test('parser renders table (not HR)', () => {
            const html = quikdown(tableDoc);
            expect(html).toContain('<table');
            expect((html.match(/<hr/g) || []).length).toBe(0);
        });

        test('editor does not remove table separator', () => {
            const result = QuikdownEditor.removeHRFromMarkdown(tableDoc);
            expect(result).toContain('| --- | --- |');
        });
    });

    describe('dash HR variants both agree on', () => {
        test.each([
            '---',
            '----',
            '------',
        ])('both agree "%s" is an HR', (hr) => {
            const html = quikdown(hr);
            expect(html).toContain('<hr');

            const result = QuikdownEditor.removeHRFromMarkdown(`before\n\n${hr}\n\nafter`);
            expect(result).not.toContain(hr);
        });
    });
});

// ========================================================================
// SECTION 4: Lazy linefeed agreement & idempotency
// ========================================================================
describe('convertLazyLinefeeds — idempotency and correctness', () => {
    const testDocs = [
        {
            name: 'headings and paragraphs',
            input: '# Title\nSome text\n## Subtitle\nMore text'
        },
        {
            name: 'lists',
            input: '- item 1\n- item 2\n- item 3\n\n1. ordered 1\n2. ordered 2'
        },
        {
            name: 'blockquotes',
            input: '> line 1\n> line 2\n> line 3\n\nParagraph after'
        },
        {
            name: 'tables',
            input: '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |'
        },
        {
            name: 'fences',
            input: '```python\ndef foo():\n    return 42\n```\n\n~~~\nother code\n~~~'
        },
        {
            name: 'mixed everything',
            input: '# Heading\nParagraph\n---\n- list\n- items\n```\ncode\n```\n| A |\n|---|\n| 1 |\n> quote'
        },
        {
            name: 'already formatted',
            input: '# Title\n\nParagraph one\n\nParagraph two\n\n- item 1\n- item 2'
        },
        {
            name: 'nested lists',
            input: '- item 1\n  - nested a\n  - nested b\n- item 2\n  - nested c'
        },
        {
            name: 'multiple fences with content between',
            input: '```\nblock1\n```\nparagraph\n~~~\nblock2\n~~~\nend'
        },
        {
            name: 'empty and whitespace lines',
            input: 'first\n   \n\n\nsecond\n\nthird'
        },
    ];

    describe('idempotency on all test documents', () => {
        test.each(testDocs)('idempotent: $name', ({ input }) => {
            const once = QuikdownEditor.convertLazyLinefeeds(input);
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            expect(twice).toBe(once);
        });
    });

    describe('fence content is never modified', () => {
        test('backtick fence content preserved exactly', () => {
            const input = '```\nline1\nline2\nline3\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('line1\nline2\nline3');
        });

        test('tilde fence content preserved exactly', () => {
            const input = '~~~\nalpha\nbeta\ngamma\n~~~';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('alpha\nbeta\ngamma');
        });

        test('fence with YAML frontmatter preserved', () => {
            const input = '```yaml\n---\nkey: value\nanother: thing\n---\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('---\nkey: value\nanother: thing\n---');
        });

        test('4-backtick fence containing 3-backtick markers as content', () => {
            const input = '````\n```\nline1\nline2\n```\n````\nparagraph after';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // Inner ``` lines are body content — no blank lines inserted
            expect(result).toContain('```\nline1\nline2\n```');
        });

        test('4-tilde fence containing 3-tilde markers as content', () => {
            const input = '~~~~\n~~~\nalpha\nbeta\n~~~\n~~~~';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('~~~\nalpha\nbeta\n~~~');
        });

        test('3-backtick fence: 4-backtick line closes it (CommonMark)', () => {
            // Per CommonMark, a closing fence needs >= the opening length
            // So ```` closes ```, meaning content after ```` is outside the fence
            const input = '```\nfenced\n````\noutside';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // "fenced" stays adjacent to fence markers (inside fence)
            expect(result).toContain('fenced\n````');
            // "outside" is a separate paragraph, gets blank-line separation
            expect(result).toContain('````\n\noutside');
        });

        test('backtick fence not closed by tildes', () => {
            const input = '```\nline1\nline2\n~~~\nline3\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // ~~~ is just body content inside a backtick fence
            expect(result).toContain('line1\nline2\n~~~\nline3');
        });

        test('adjacent fences separated correctly', () => {
            const input = '```\ncode1\n```\n```\ncode2\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // First fence closes, second opens — should get blank line between
            expect(result).toContain('```\n\n```');
            // But content inside each fence stays untouched
            expect(result).toContain('code1\n```');
            expect(result).toContain('```\ncode2');
        });

        test('5-backtick fence containing 3 and 4 backtick markers', () => {
            const input = '`````\n```\n````\ncontent\n````\n```\n`````';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // Everything between ````` markers is body
            expect(result).toContain('```\n````\ncontent\n````\n```');
        });
    });

    describe('lists, tables, blockquotes stay together', () => {
        test('unordered list items stay adjacent', () => {
            const input = '- item 1\n- item 2\n- item 3';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('ordered list items stay adjacent', () => {
            const input = '1. first\n2. second\n3. third';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('table rows stay adjacent', () => {
            const input = '| A | B |\n|---|---|\n| 1 | 2 |';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });

        test('blockquote lines stay adjacent', () => {
            const input = '> line 1\n> line 2\n> line 3';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe(input);
        });
    });

    describe('classifyLine categories used by convertLazy', () => {
        test('HR lines get blank-line separation from paragraphs', () => {
            const input = 'text\n---\nmore text';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('text\n\n---\n\nmore text');
        });

        test('heading gets blank-line separation from paragraph', () => {
            const input = '# Title\ntext';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('# Title\n\ntext');
        });

        test('spaced HR (- - -) is classified as HR, not list', () => {
            const input = 'text\n- - -\nmore text';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // - - - should be classified as HR, not as a list item
            // so it gets blank line separation (not treated as same block)
            expect(result).toContain('text\n\n- - -\n\nmore text');
        });
    });
});

// ========================================================================
// SECTION 5: Full document integration tests
// ========================================================================
describe('full document integration', () => {
    const documents = [
        {
            name: 'blog post with all features',
            md: [
                '# My Blog Post',
                '',
                'An intro paragraph with **bold** and *italic*.',
                '',
                '---',
                '',
                '## Section One',
                '',
                '| Feature | Status |',
                '|---------|--------|',
                '| Alpha   | Done   |',
                '| Beta    | WIP    |',
                '',
                '```js',
                'function hello() {',
                '  return "---";',
                '}',
                '```',
                '',
                '- item 1',
                '- item 2',
                '  - nested',
                '',
                '> A wise quote.',
                '',
                '***',
                '',
                'The end.'
            ].join('\n')
        },
        {
            name: 'code-heavy document',
            md: [
                '# Code Examples',
                '',
                '```python',
                '---',
                'def foo():',
                '    return 42',
                '---',
                '```',
                '',
                '~~~bash',
                '# comment with ---',
                'echo "hello"',
                '~~~',
                '',
                '---',
                '',
                'Done.'
            ].join('\n')
        },
        {
            name: 'tables and HRs mixed',
            md: [
                '---',
                '',
                '| A | B | C |',
                '|:--|:--:|--:|',
                '| 1 | 2  | 3 |',
                '',
                '---',
                '',
                '| X |',
                '|---|',
                '| y |',
                '',
                '***'
            ].join('\n')
        },
        {
            name: 'nested fences',
            md: [
                '````',
                '```',
                '---',
                '```',
                '````',
                '',
                '---',
                '',
                'Text after.'
            ].join('\n')
        },
        {
            name: 'lazy linefeeds everywhere',
            md: '# Title\nParagraph one\nParagraph two\n- list\n- items\n```\ncode\n```\nFinal'
        },
    ];

    describe('parser produces valid HTML', () => {
        test.each(documents)('$name', ({ md }) => {
            const html = quikdown(md);
            expect(html).toBeTruthy();
            // Should not contain raw markdown HR patterns outside of code
            // (they should be rendered as <hr> or inside <pre>)
        });
    });

    describe('removeHR preserves non-HR content', () => {
        test.each(documents)('$name', ({ md }) => {
            const result = QuikdownEditor.removeHRFromMarkdown(md);
            // Fenced content should always be preserved
            if (md.includes('```')) {
                // Find content between first ``` pair
                const fenceStart = md.indexOf('```');
                const afterOpen = md.indexOf('\n', fenceStart) + 1;
                const fenceEnd = md.indexOf('```', afterOpen);
                if (fenceEnd > afterOpen) {
                    const fenceBody = md.substring(afterOpen, fenceEnd - 1);
                    // At least some of the fence body should remain
                    const firstLine = fenceBody.split('\n')[0];
                    if (firstLine && firstLine.trim()) {
                        expect(result).toContain(firstLine);
                    }
                }
            }
        });
    });

    describe('convertLazyLinefeeds is idempotent on all docs', () => {
        test.each(documents)('$name', ({ md }) => {
            const once = QuikdownEditor.convertLazyLinefeeds(md);
            const twice = QuikdownEditor.convertLazyLinefeeds(once);
            expect(twice).toBe(once);
        });
    });

    describe('full pipeline: removeHR → convertLazy → parse', () => {
        test.each(documents)('$name', ({ md }) => {
            const noHR = QuikdownEditor.removeHRFromMarkdown(md);
            const fixed = QuikdownEditor.convertLazyLinefeeds(noHR);
            const fixedAgain = QuikdownEditor.convertLazyLinefeeds(fixed);
            expect(fixedAgain).toBe(fixed); // idempotent

            const html = quikdown(fixed);
            expect(html).toBeTruthy();
        });
    });
});
