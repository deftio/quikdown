/**
 * Direct unit tests for quikdown_classify.js
 * Tests the shared line-classification functions directly (not through editor).
 */

import { isHRLine, isDashHRLine, fenceOpen, isFenceClose, classifyLine, looksLikeTableRow } from '../src/quikdown_classify.js';

// ========================================================================
// isHRLine
// ========================================================================
describe('isHRLine', () => {
    describe('valid CommonMark HRs', () => {
        test.each([
            ['---',       'three dashes'],
            ['***',       'three asterisks'],
            ['___',       'three underscores'],
            ['----',      'four dashes'],
            ['*****',     'five asterisks'],
            ['______',    'six underscores'],
            ['- - -',     'spaced dashes'],
            ['* * *',     'spaced asterisks'],
            ['_ _ _',     'spaced underscores'],
            ['-  -  -',   'double-spaced dashes'],
            ['*  *  *',   'double-spaced asterisks'],
            ['_  _  _',   'double-spaced underscores'],
            ['- -  - -',  'mixed spacing dashes'],
            ['-\t-\t-',   'tab-separated dashes'],
        ])('returns true for "%s" (%s)', (line) => {
            expect(isHRLine(line)).toBe(true);
        });
    });

    describe('non-HR lines', () => {
        test.each([
            ['--',        'too few dashes'],
            ['**',        'too few asterisks'],
            ['__',        'too few underscores'],
            ['-',         'single dash'],
            ['',          'empty string'],
            ['   ',       'whitespace only'],
            ['-_*',       'mixed HR chars'],
            ['-*-',       'mixed dash and asterisk'],
            ['---text',   'dashes followed by text'],
            ['- text',    'list item'],
            ['abc',       'plain text'],
            ['##',        'too-short heading marker'],
        ])('returns false for "%s" (%s)', (line) => {
            expect(isHRLine(line)).toBe(false);
        });
    });

    describe('pathological inputs (ReDoS safety)', () => {
        test('1000 spaced dashes with trailing "x"', () => {
            const start = Date.now();
            const result = isHRLine('- '.repeat(1000) + 'x');
            expect(Date.now() - start).toBeLessThan(100);
            expect(result).toBe(false);
        });

        test('10000 dashes', () => {
            const start = Date.now();
            const result = isHRLine('-'.repeat(10000));
            expect(Date.now() - start).toBeLessThan(100);
            expect(result).toBe(true);
        });
    });
});

// ========================================================================
// isDashHRLine
// ========================================================================
describe('isDashHRLine', () => {
    describe('valid dash-only HRs', () => {
        test.each([
            ['---',     'three dashes'],
            ['----',    'four dashes'],
            ['------',  'six dashes'],
            ['---   ',  'trailing spaces'],
            ['---\t',   'trailing tab'],
        ])('returns true for "%s" (%s)', (line) => {
            expect(isDashHRLine(line)).toBe(true);
        });
    });

    describe('lines that are NOT dash-only HRs', () => {
        test.each([
            ['--',      'too few'],
            ['***',     'asterisks (not dashes)'],
            ['___',     'underscores (not dashes)'],
            ['- - -',   'spaced dashes (interspersed whitespace)'],
            ['---text',  'dashes followed by text'],
            [' ---',    'leading space'],
            ['',        'empty string'],
        ])('returns false for "%s" (%s)', (line) => {
            expect(isDashHRLine(line)).toBe(false);
        });
    });
});

// ========================================================================
// fenceOpen
// ========================================================================
describe('fenceOpen', () => {
    describe('valid fence openers', () => {
        test('3 backticks, no lang', () => {
            const r = fenceOpen('```');
            expect(r).toEqual({ char: '`', len: 3, lang: '' });
        });

        test('3 backticks with language', () => {
            const r = fenceOpen('```javascript');
            expect(r).toEqual({ char: '`', len: 3, lang: 'javascript' });
        });

        test('4 backticks with language and space', () => {
            const r = fenceOpen('```` python');
            expect(r).toEqual({ char: '`', len: 4, lang: 'python' });
        });

        test('3 tildes, no lang', () => {
            const r = fenceOpen('~~~');
            expect(r).toEqual({ char: '~', len: 3, lang: '' });
        });

        test('5 tildes with language', () => {
            const r = fenceOpen('~~~~~bash');
            expect(r).toEqual({ char: '~', len: 5, lang: 'bash' });
        });
    });

    describe('non-fence lines', () => {
        test.each([
            ['``',        'only 2 backticks'],
            ['~~',        'only 2 tildes'],
            ['abc',       'plain text'],
            ['',          'empty string'],
            ['# heading', 'heading'],
            ['`inline`',  'inline code (only 1 backtick)'],
        ])('returns null for "%s" (%s)', (line) => {
            expect(fenceOpen(line)).toBeNull();
        });
    });
});

// ========================================================================
// isFenceClose
// ========================================================================
describe('isFenceClose', () => {
    test('exact match: 3 backticks closes 3 backticks', () => {
        expect(isFenceClose('```', '`', 3)).toBe(true);
    });

    test('longer close: 4 backticks closes 3 backticks', () => {
        expect(isFenceClose('````', '`', 3)).toBe(true);
    });

    test('shorter close: 2 backticks does NOT close 3', () => {
        expect(isFenceClose('``', '`', 3)).toBe(false);
    });

    test('wrong char: tildes do NOT close backtick fence', () => {
        expect(isFenceClose('~~~', '`', 3)).toBe(false);
    });

    test('trailing whitespace allowed', () => {
        expect(isFenceClose('```   ', '`', 3)).toBe(true);
    });

    test('trailing text NOT allowed', () => {
        expect(isFenceClose('```js', '`', 3)).toBe(false);
    });

    test('tilde close matches tilde open', () => {
        expect(isFenceClose('~~~', '~', 3)).toBe(true);
    });

    test('5 tildes closes 4 tildes', () => {
        expect(isFenceClose('~~~~~', '~', 4)).toBe(true);
    });
});

// ========================================================================
// classifyLine
// ========================================================================
describe('classifyLine', () => {
    describe('headings', () => {
        test.each([
            ['# H1',       'heading'],
            ['## H2',      'heading'],
            ['### H3',     'heading'],
            ['#### H4',    'heading'],
            ['##### H5',   'heading'],
            ['###### H6',  'heading'],
        ])('classifies "%s" as %s', (line, expected) => {
            expect(classifyLine(line)).toBe(expected);
        });

        test('#no-space is not a heading (no space after #)', () => {
            expect(classifyLine('#nospace')).not.toBe('heading');
        });

        test('####### (7 hashes) is not a heading', () => {
            expect(classifyLine('####### seven')).not.toBe('heading');
        });
    });

    describe('horizontal rules', () => {
        test.each([
            ['---', 'hr'],
            ['***', 'hr'],
            ['___', 'hr'],
            ['- - -', 'hr'],
        ])('classifies "%s" as %s', (line, expected) => {
            expect(classifyLine(line)).toBe(expected);
        });
    });

    describe('ordered lists', () => {
        test.each([
            ['1. item',   'list-ol'],
            ['99. item',  'list-ol'],
            ['0. item',   'list-ol'],
        ])('classifies "%s" as list-ol', (line) => {
            expect(classifyLine(line)).toBe('list-ol');
        });
    });

    describe('unordered lists', () => {
        test.each([
            ['- item',  'list-ul'],
            ['* item',  'list-ul'],
            ['+ item',  'list-ul'],
        ])('classifies "%s" as list-ul', (line) => {
            expect(classifyLine(line)).toBe('list-ul');
        });
    });

    describe('blockquotes', () => {
        test.each([
            ['> text',   'blockquote'],
            ['>text',    'blockquote'],
            ['> ',       'blockquote'],
        ])('classifies "%s" as blockquote', (line) => {
            expect(classifyLine(line)).toBe('blockquote');
        });
    });

    describe('tables', () => {
        test('classifies "| cell |" as table', () => {
            expect(classifyLine('| cell |')).toBe('table');
        });
    });

    describe('paragraph fallback', () => {
        test.each([
            ['plain text', 'paragraph'],
            ['12345',      'paragraph'],
            ['',           'paragraph'],
        ])('classifies "%s" as paragraph', (line) => {
            expect(classifyLine(line)).toBe('paragraph');
        });
    });

    describe('priority: HR before list-ul', () => {
        test('"- - -" is HR, not list-ul', () => {
            expect(classifyLine('- - -')).toBe('hr');
        });
    });
});

// ========================================================================
// looksLikeTableRow
// ========================================================================
describe('looksLikeTableRow', () => {
    test('returns true for pipe-containing line', () => {
        expect(looksLikeTableRow('| A | B |')).toBe(true);
    });

    test('returns true for mid-line pipe', () => {
        expect(looksLikeTableRow('A | B')).toBe(true);
    });

    test('returns false for line without pipes', () => {
        expect(looksLikeTableRow('no pipes here')).toBe(false);
    });

    test('returns false for empty string', () => {
        expect(looksLikeTableRow('')).toBe(false);
    });
});
