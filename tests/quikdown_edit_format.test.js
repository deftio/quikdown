/**
 * @jest-environment jsdom
 *
 * Markdown formatting transforms behind QuikdownEditor.format():
 * QuikdownEditor.formatMarkdown, getFormatState and mapOffset.
 * These are pure string functions, so every case states input and output.
 */
import QuikdownEditor from '../dist/quikdown_edit.esm.js';

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false, media: query,
            addEventListener: jest.fn(), removeEventListener: jest.fn()
        })),
    });
});

const fmt = QuikdownEditor.formatMarkdown;
const state = QuikdownEditor.getFormatState;
const mapOffset = QuikdownEditor.mapOffset;

/**
 * Run a command on text written with selection markers:
 * "a [b] c" selects b, "a | c" is a caret. Returns the result in the same notation.
 */
function run(text, command, value) {
    let start;
    let end;
    let md;
    if (text.includes('|')) {
        start = end = text.indexOf('|');
        md = text.replace('|', '');
    } else {
        start = text.indexOf('⟦');
        end = text.indexOf('⟧') - 1;
        md = text.replace('⟦', '').replace('⟧', '');
    }
    const r = fmt(md, start, end, command, value);
    if (r === null) return null;
    if (r.start === r.end) return r.markdown.slice(0, r.start) + '|' + r.markdown.slice(r.start);
    return r.markdown.slice(0, r.start) + '⟦' + r.markdown.slice(r.start, r.end) + '⟧' + r.markdown.slice(r.end);
}

describe('formatMarkdown: inline toggles', () => {
    test.each([
        ['bold', 'a ⟦b⟧ c', 'a **⟦b⟧** c'],
        ['italic', 'a ⟦b⟧ c', 'a *⟦b⟧* c'],
        ['strike', 'a ⟦b⟧ c', 'a ~~⟦b⟧~~ c'],
        ['code', 'a ⟦b⟧ c', 'a `⟦b⟧` c'],
    ])('%s wraps a selection', (cmd, input, expected) => {
        expect(run(input, cmd)).toBe(expected);
    });

    test.each([
        ['bold', 'a **⟦b⟧** c', 'a ⟦b⟧ c'],
        ['italic', 'a *⟦b⟧* c', 'a ⟦b⟧ c'],
        ['strike', 'a ~~⟦b⟧~~ c', 'a ⟦b⟧ c'],
        ['code', 'a `⟦b⟧` c', 'a ⟦b⟧ c'],
        ['bold', 'a __⟦b⟧__ c', 'a ⟦b⟧ c'],
        ['italic', 'a _⟦b⟧_ c', 'a ⟦b⟧ c'],
    ])('%s unwraps a selection that is the whole span', (cmd, input, expected) => {
        expect(run(input, cmd)).toBe(expected);
    });

    test('unwraps when the selection includes the markers', () => {
        expect(run('a ⟦**b**⟧ c', 'bold')).toBe('a ⟦b⟧ c');
        expect(run('a ⟦*b*⟧ c', 'italic')).toBe('a ⟦b⟧ c');
    });

    test('unwraps when one end is outside the markers and one inside', () => {
        expect(run('a ⟦**b⟧** c', 'bold')).toBe('a ⟦b⟧ c');
        expect(run('a **⟦b**⟧ c', 'bold')).toBe('a ⟦b⟧ c');
    });

    test('selection inside a span splits the span around it', () => {
        expect(run('**one ⟦two⟧ three**', 'bold')).toBe('**one** ⟦two⟧ **three**');
        expect(run('**⟦one⟧ two**', 'bold')).toBe('⟦one⟧ **two**');
        expect(run('**one ⟦two⟧**', 'bold')).toBe('**one** ⟦two⟧');
        expect(run('__one ⟦two⟧ three__', 'bold')).toBe('__one__ ⟦two⟧ __three__');
    });

    test('selection overlapping spans merges them into one', () => {
        expect(run('⟦a **b** c⟧', 'bold')).toBe('**⟦a b c⟧**');
        expect(run('**a⟦b** c⟧', 'bold')).toBe('**⟦ab c⟧**');
        expect(run('⟦**a** and **b**⟧', 'bold')).toBe('**⟦a and b⟧**');
    });

    test('bold and italic combine and separate', () => {
        expect(run('**⟦x⟧**', 'italic')).toBe('***⟦x⟧***');
        expect(run('***⟦x⟧***', 'italic')).toBe('**⟦x⟧**');
        expect(run('***⟦x⟧***', 'bold')).toBe('*⟦x⟧*');
        expect(run('*⟦x⟧*', 'bold')).toBe('***⟦x⟧***');
    });

    test('outer whitespace in the selection stays outside the markers', () => {
        expect(run('a⟦ b ⟧c', 'bold')).toBe('a **⟦b⟧** c');
    });

    test('a caret inside a word formats the word and keeps the caret', () => {
        expect(run('hello wo|rld', 'bold')).toBe('hello **wo|rld**');
        expect(run('hello **wo|rld**', 'bold')).toBe('hello wo|rld');
        expect(run('|word', 'italic')).toBe('*|word*');
        expect(run('word|', 'code')).toBe('`word|`');
    });

    test('a caret outside a word inserts an empty pair, and removes it again', () => {
        expect(run('a | b', 'bold')).toBe('a **|** b');
        expect(run('a **|** b', 'bold')).toBe('a | b');
        expect(run('|', 'italic')).toBe('*|*');
        expect(run('*|*', 'italic')).toBe('|');
        expect(run('~~|~~', 'strike')).toBe('|');
        expect(run('`|`', 'code')).toBe('|');
        expect(run('|', 'strike')).toBe('~~|~~');
    });

    test('italic inside an empty bold pair nests instead of removing', () => {
        expect(run('**|**', 'italic')).toBe('***|***');
        expect(run('***|***', 'italic')).toBe('**|**');
        expect(run('***|***', 'bold')).toBe('*|*');
    });

    test('a multi-line selection is formatted line by line, after block prefixes', () => {
        expect(run('⟦- one\n- two⟧', 'bold')).toBe('- **⟦one**\n- **two⟧**');
        expect(run('⟦# Title\n\npara⟧', 'italic')).toBe('# *⟦Title*\n\n*para⟧*');
        expect(run('> ⟦quoted\n> more⟧', 'strike')).toBe('> ~~⟦quoted~~\n> ~~more⟧~~');
    });

    test('a multi-line selection toggles off only when every line is on', () => {
        expect(run('⟦**one**\n**two**⟧', 'bold')).toBe('⟦one\ntwo⟧');
        expect(run('⟦**one**\ntwo⟧', 'bold')).toBe('**⟦one**\n**two⟧**');
    });

    test('fence lines and whitespace-only selections are left alone', () => {
        expect(run('⟦```js\ncode\n```⟧', 'bold')).toBe('```js\n**⟦code⟧**\n```');
        expect(run('a⟦   ⟧b', 'bold')).toBe('a⟦   ⟧b');
        expect(run('⟦\n\n⟧', 'italic')).toBe('⟦\n\n⟧');
    });

    test('markers inside code spans and link targets are not treated as emphasis', () => {
        expect(run('`**x**` ⟦y⟧', 'bold')).toBe('`**x**` **⟦y⟧**');
        expect(run('[t](http://a.b/_x_) ⟦y⟧', 'italic')).toBe('[t](http://a.b/_x_) *⟦y⟧*');
        expect(run('snake_case_name ⟦y⟧', 'italic')).toBe('snake_case_name *⟦y⟧*');
    });

    test('the end of a selection that stops after a newline does not format the next line', () => {
        const r = fmt('one\ntwo', 0, 4, 'bold');
        expect(r.markdown).toBe('**one**\ntwo');
    });
});

describe('formatMarkdown: links', () => {
    test('links a selection to a URL', () => {
        expect(run('see ⟦docs⟧ now', 'link', 'https://x.y')).toBe('see [⟦docs⟧](https://x.y) now');
    });

    test('without a URL inserts a placeholder target and selects it', () => {
        expect(run('see ⟦docs⟧ now', 'link')).toBe('see [docs](⟦url⟧) now');
        expect(run('a | b', 'link')).toBe('a [link](⟦url⟧) b');
    });

    test('a caret in a word links the word; a caret in space uses the URL as text', () => {
        expect(run('see do|cs', 'link', 'https://x.y')).toBe('see [⟦docs⟧](https://x.y)');
        expect(run('a | b', 'link', 'https://x.y')).toBe('a [⟦https://x.y⟧](https://x.y) b');
    });

    test('retargets the link under the selection', () => {
        expect(run('a [te|xt](http://old) b', 'link', 'http://new')).toBe('a [⟦text⟧](http://new) b');
        expect(run('a ⟦[text](http://old)⟧ b', 'link', 'http://new')).toBe('a [⟦text⟧](http://new) b');
    });

    test('null, empty string or false removes the link under the selection', () => {
        expect(run('a [te|xt](http://old) b', 'link', null)).toBe('a ⟦text⟧ b');
        expect(run('a [te|xt](http://old) b', 'link', '')).toBe('a ⟦text⟧ b');
        expect(run('a [te|xt](http://old "title") b', 'link', false)).toBe('a ⟦text⟧ b');
    });

    test('removing where there is no link changes nothing', () => {
        expect(run('plain ⟦text⟧', 'link', null)).toBe('plain ⟦text⟧');
    });

    test('no URL on an existing link selects its text', () => {
        expect(run('a [te|xt](http://old) b', 'link')).toBe('a [⟦text⟧](http://old) b');
    });

    test('URLs with balanced parentheses are recognised as one link', () => {
        expect(run('[w|iki](https://x.org/a_(b)) z', 'link', null)).toBe('⟦wiki⟧ z');
    });

    test('outer whitespace in the selection stays outside the link', () => {
        expect(run('see⟦ docs ⟧now', 'link', 'u')).toBe('see [⟦docs⟧](u) now');
    });

    test('a multi-line selection links only its first line', () => {
        expect(run('⟦one\ntwo⟧', 'link', 'u')).toBe('[⟦one⟧](u)\ntwo');
    });

    test('non-string URLs are converted to text', () => {
        expect(run('⟦x⟧', 'link', 42)).toBe('[⟦x⟧](42)');
    });
});

describe('formatMarkdown: headings and paragraph', () => {
    test('sets, changes and toggles a heading', () => {
        expect(run('ti|tle', 'h1')).toBe('# ti|tle');
        expect(run('# ti|tle', 'h2')).toBe('## ti|tle');
        expect(run('## ti|tle', 'h2')).toBe('ti|tle');
        expect(run('ti|tle', 'h6')).toBe('###### ti|tle');
    });

    test('"heading" takes the level as value; 0 and "paragraph" clear', () => {
        expect(run('ti|tle', 'heading', 3)).toBe('### ti|tle');
        expect(run('### ti|tle', 'heading', 0)).toBe('ti|tle');
        expect(run('### ti|tle', 'paragraph')).toBe('ti|tle');
        expect(run('ti|tle', 'heading', 99)).toBe('###### ti|tle');
        expect(run('# ti|tle', 'heading', 'x')).toBe('ti|tle');
    });

    test('a heading replaces a list marker and keeps a quote marker', () => {
        expect(run('- it|em', 'h2')).toBe('## it|em');
        expect(run('> qu|ote', 'h3')).toBe('> ### qu|ote');
        expect(run('1. it|em', 'h1')).toBe('# it|em');
    });

    test('paragraph strips heading, list and quote prefixes', () => {
        expect(run('⟦# a\n- b\n> c\n- [x] d\n2. e⟧', 'paragraph')).toBe('⟦a\nb\nc\nd\ne⟧');
    });

    test('acts on every non-blank line of a selection', () => {
        expect(run('⟦one\n\ntwo⟧', 'h2')).toBe('⟦## one\n\n## two⟧');
        expect(run('⟦## one\n\n## two⟧', 'h2')).toBe('⟦one\n\ntwo⟧');
        expect(run('⟦## one\n\n# two⟧', 'h2')).toBe('⟦## one\n\n## two⟧');
    });

    test('a selection that ends just after a line break leaves the next line alone', () => {
        expect(fmt('one\ntwo', 0, 4, 'h1').markdown).toBe('# one\ntwo');
        expect(fmt('one\ntwo', 0, 4, 'ul').markdown).toBe('- one\ntwo');
        expect(fmt('one\ntwo', 4, 4, 'h1').markdown).toBe('one\n# two');
    });

    test('on an empty line writes the marker and puts the caret after it', () => {
        expect(run('|', 'h1')).toBe('# |');
        expect(run('a\n|\nb', 'h2')).toBe('a\n## |\nb');
    });

    test('a caret in the old prefix moves to the start of the text', () => {
        expect(run('#|# title', 'h1')).toBe('# |title');
    });
});

describe('formatMarkdown: lists, quote, indent', () => {
    test('toggles bullets', () => {
        expect(run('⟦one\ntwo⟧', 'ul')).toBe('⟦- one\n- two⟧');
        expect(run('⟦- one\n- two⟧', 'ul')).toBe('⟦one\ntwo⟧');
        expect(run('⟦* one\n+ two⟧', 'ul')).toBe('⟦one\ntwo⟧');
    });

    test('numbers an ordered list from 1 and toggles it off', () => {
        expect(run('⟦one\ntwo\n\nthree⟧', 'ol')).toBe('⟦1. one\n2. two\n\n3. three⟧');
        expect(run('⟦1. one\n2. two⟧', 'ol')).toBe('⟦one\ntwo⟧');
    });

    test('task items keep an existing check mark', () => {
        expect(run('⟦one\n- [x] two⟧', 'task')).toBe('⟦- [ ] one\n- [x] two⟧');
        expect(run('⟦- [ ] one\n- [X] two⟧', 'task')).toBe('⟦one\ntwo⟧');
    });

    test('converts between list kinds and from headings', () => {
        expect(run('⟦- one\n- two⟧', 'ol')).toBe('⟦1. one\n2. two⟧');
        expect(run('⟦1. one\n2. two⟧', 'ul')).toBe('⟦- one\n- two⟧');
        expect(run('⟦- [ ] one⟧', 'ul')).toBe('⟦- one⟧');
        expect(run('# on|e', 'ul')).toBe('- on|e');
    });

    test('keeps indentation and quote markers', () => {
        expect(run('  it|em', 'ul')).toBe('  - it|em');
        expect(run('> it|em', 'ol')).toBe('> 1. it|em');
    });

    test('a marker alone on a line counts as a list item', () => {
        expect(run('-|', 'ul')).toBe('|');
        expect(run('|', 'ul')).toBe('- |');
        expect(run('|', 'task')).toBe('- [ ] |');
    });

    test('quote adds and removes one level, including blank lines between', () => {
        expect(run('⟦one\n\ntwo⟧', 'quote')).toBe('⟦> one\n>\n> two⟧');
        expect(run('⟦> one\n>\n> two⟧', 'quote')).toBe('⟦one\n\ntwo⟧');
        expect(run('> > de|ep', 'quote')).toBe('> de|ep');
        expect(run('⟦> one\ntwo⟧', 'quote')).toBe('⟦> > one\n> two⟧');
    });

    test('indent adds two spaces, outdent removes up to two or one tab', () => {
        expect(run('⟦- a\n\n- b⟧', 'indent')).toBe('⟦  - a\n\n  - b⟧');
        expect(run('⟦  - a\n - b\n\t- c\n- d⟧', 'outdent')).toBe('⟦- a\n- b\n- c\n- d⟧');
        expect(run('- it|em', 'indent')).toBe('  - it|em');
        expect(run('  - it|em', 'outdent')).toBe('- it|em');
    });
});

describe('formatMarkdown: code block, rule, table', () => {
    test('wraps lines in a fence, with an optional language', () => {
        expect(run('a\n⟦x = 1\ny = 2⟧\nb', 'codeblock')).toBe('a\n```\n⟦x = 1\ny = 2⟧\n```\nb');
        expect(run('x |= 1', 'codeblock', 'js')).toBe('```js\nx |= 1\n```');
        expect(run('|', 'codeblock')).toBe('```\n|\n```');
    });

    test('unwraps when the selection is inside a fence', () => {
        expect(run('a\n```js\nx |= 1\n```\nb', 'codeblock')).toBe('a\nx |= 1\nb');
        expect(run('~~~\n⟦x⟧\n~~~', 'codeblock')).toBe('⟦x⟧');
    });

    test('unwraps when the selection includes the fence lines', () => {
        expect(run('a\n⟦```\nx\n```⟧\nb', 'codeblock')).toBe('a\n⟦x⟧\nb');
    });

    test('text between two separate code blocks is wrapped, not unwrapped', () => {
        const md = '```\na\n```\nmid|dle\n```\nb\n```';
        expect(run(md, 'codeblock')).toBe('```\na\n```\n```\nmid|dle\n```\n```\nb\n```');
    });

    test('a selection from one block\'s close to the next block\'s open is wrapped', () => {
        const r = fmt('```\na\n```\nx\n```\nb\n```', 6, 15, 'codeblock');
        expect(r.markdown).toBe('```\na\n```\n```\nx\n```\n```\nb\n```');
    });

    test('hr goes on its own lines after the current line', () => {
        expect(run('on|e\ntwo', 'hr')).toBe('one\n\n---\n|\ntwo');
        expect(run('one|', 'hr')).toBe('one\n\n---\n|');
        expect(run('|', 'hr')).toBe('---\n|');
        expect(run('one\n\n|\n\ntwo', 'hr')).toBe('one\n\n---|\n\ntwo');
        expect(run('one\n|\ntwo', 'hr')).toBe('one\n\n---\n|\ntwo');
        expect(run('on|e\n\ntwo', 'hr')).toBe('one\n\n---|\n\ntwo');
    });

    test('table inserts a template and selects the first header cell', () => {
        expect(run('|', 'table')).toBe('| ⟦Column 1⟧ | Column 2 |\n| --- | --- |\n|   |   |\n|   |   |\n');
        expect(run('intro|', 'table', { rows: 1, cols: 3 }))
            .toBe('intro\n\n| ⟦Column 1⟧ | Column 2 | Column 3 |\n| --- | --- | --- |\n|   |   |   |\n');
    });

    test('table size is clamped', () => {
        const big = fmt('', 0, 0, 'table', { rows: 1000, cols: 1000 }).markdown.split('\n');
        expect(big[0].split('|').length - 2).toBe(20);
        expect(big.length).toBe(2 + 100 + 1);
        const small = fmt('', 0, 0, 'table', { rows: -5, cols: -3 }).markdown.split('\n');
        expect(small[0]).toBe('| Column 1 |');
        expect(small.length).toBe(2 + 1 + 1);
        const dflt = fmt('', 0, 0, 'table', { rows: 0, cols: 'x' }).markdown.split('\n');
        expect(dflt[0]).toBe('| Column 1 | Column 2 |');
        expect(dflt.length).toBe(2 + 2 + 1);
    });
});

describe('formatMarkdown: arguments', () => {
    test('unknown commands return null', () => {
        expect(fmt('x', 0, 1, 'sparkle')).toBeNull();
        expect(fmt('x', 0, 1)).toBeNull();
    });

    test('offsets are clamped and may be reversed', () => {
        expect(fmt('abc', 99, -5, 'bold')).toEqual({ markdown: '**abc**', start: 2, end: 5 });
        expect(fmt('abc', 3, 0, 'bold').markdown).toBe('**abc**');
        expect(fmt('abc', 'x', undefined, 'bold').markdown).toBe('**abc**');
    });

    test('non-string markdown is treated as empty', () => {
        expect(fmt(null, 0, 0, 'bold')).toEqual({ markdown: '****', start: 2, end: 2 });
        expect(fmt(undefined, 0, 0, 'h1').markdown).toBe('# ');
    });

    test('FORMAT_COMMANDS lists every command and each one is accepted', () => {
        expect(QuikdownEditor.FORMAT_COMMANDS).toEqual(expect.arrayContaining([
            'bold', 'italic', 'strike', 'code', 'link', 'h1', 'h6', 'heading', 'paragraph',
            'ul', 'ol', 'task', 'quote', 'codeblock', 'hr', 'table', 'indent', 'outdent'
        ]));
        QuikdownEditor.FORMAT_COMMANDS.forEach(cmd => {
            expect(fmt('some text', 2, 6, cmd)).not.toBeNull();
        });
    });

    test('every command output still parses to the intended element', async () => {
        document.body.innerHTML = '<div id="e"></div>';
        const ed = new QuikdownEditor('#e', { showToolbar: false });
        await ed.initPromise;
        const cases = {
            bold: 'strong', italic: 'em', strike: 'del', code: 'code', h2: 'h2',
            ul: 'ul', ol: 'ol', quote: 'blockquote', codeblock: 'pre', hr: 'hr', table: 'table'
        };
        for (const [cmd, tag] of Object.entries(cases)) {
            await ed.setMarkdown(fmt('some text', 0, 9, cmd).markdown);
            expect(ed.previewPanel.querySelector(tag)).not.toBeNull();
        }
        await ed.setMarkdown(fmt('some text', 0, 9, 'link', 'https://x.y').markdown);
        expect(ed.previewPanel.querySelector('a').getAttribute('href')).toBe('https://x.y');
        await ed.setMarkdown(fmt('some text', 0, 9, 'task').markdown);
        expect(ed.previewPanel.querySelector('input[type="checkbox"]')).not.toBeNull();
        ed.destroy();
    });
});

describe('getFormatState', () => {
    const at = (text) => {
        if (text.includes('|')) {
            const i = text.indexOf('|');
            return state(text.replace('|', ''), i, i);
        }
        const s = text.indexOf('⟦');
        const e = text.indexOf('⟧') - 1;
        return state(text.replace('⟦', '').replace('⟧', ''), s, e);
    };
    const none = {
        bold: false, italic: false, strike: false, code: false, link: false,
        heading: 0, list: null, quote: false, codeblock: false
    };

    test('plain text has nothing set', () => {
        expect(at('pla|in')).toEqual(none);
        expect(state('', 0, 0)).toEqual(none);
    });

    test('inline state at a caret', () => {
        expect(at('**bo|ld**')).toMatchObject({ bold: true, italic: false });
        expect(at('*it|al*')).toMatchObject({ italic: true, bold: false });
        expect(at('_it|al_')).toMatchObject({ italic: true });
        expect(at('~~st|r~~')).toMatchObject({ strike: true });
        expect(at('`co|de`')).toMatchObject({ code: true });
        expect(at('[te|xt](u)')).toMatchObject({ link: true });
        expect(at('***bo|th***')).toMatchObject({ bold: true, italic: true });
        expect(at('**a *b|* c**')).toMatchObject({ bold: true, italic: true });
    });

    test('a caret at the inner edges counts, outside the markers does not', () => {
        expect(at('**|bold**').bold).toBe(true);
        expect(at('**bold|**').bold).toBe(true);
        expect(at('|**bold**').bold).toBe(false);
        expect(at('**bold**|').bold).toBe(false);
    });

    test('a range must lie inside the span', () => {
        expect(at('**⟦bold⟧**').bold).toBe(true);
        expect(at('⟦**bold**⟧').bold).toBe(true);
        expect(at('⟦**bold** x⟧').bold).toBe(false);
    });

    test('block state comes from the line the selection starts on', () => {
        expect(at('### ti|tle')).toMatchObject({ heading: 3, list: null });
        expect(at('- it|em')).toMatchObject({ list: 'ul', heading: 0 });
        expect(at('3. it|em')).toMatchObject({ list: 'ol' });
        expect(at('- [ ] it|em')).toMatchObject({ list: 'task' });
        expect(at('> qu|ote')).toMatchObject({ quote: true });
        expect(at('> - it|em')).toMatchObject({ quote: true, list: 'ul' });
        expect(at('x\n⟦- a\n# b⟧')).toMatchObject({ list: 'ul', heading: 0 });
    });

    test('inside a fenced block only codeblock is reported', () => {
        expect(at('```\n# not **a|** heading\n```')).toEqual({ ...none, codeblock: true });
        expect(at('```\ncode\n```\n# he|ad')).toMatchObject({ codeblock: false, heading: 1 });
        expect(at('``|`\ncode\n```').codeblock).toBe(false);
        expect(at('```\ncode\n``|`').codeblock).toBe(false);
    });

    test('markers inside code are not emphasis; escaped asterisks are not italic', () => {
        expect(at('`**x|**`')).toMatchObject({ code: true, bold: false });
        expect(at('\\*no|t\\*').italic).toBe(false);
        expect(at('snake_ca|se_name').italic).toBe(false);
    });

    test('arguments are clamped, reversed and defaulted', () => {
        expect(state('**bold**', 99, -1).bold).toBe(true);
        expect(state('**bold**', 6, 2).bold).toBe(true);
        expect(state(null, 0, 0)).toEqual(none);
        expect(state('# h', 'x').heading).toBe(1);
    });

    test('a range running past the line is judged on the first line', () => {
        expect(state('**a**\nb', 2, 7).bold).toBe(true);
    });
});

describe('mapOffset', () => {
    test('identical texts map to the same offset, clamped', () => {
        expect(mapOffset('abc', 'abc', 2)).toBe(2);
        expect(mapOffset('abc', 'abc', 99)).toBe(3);
        expect(mapOffset('abc', 'abc', -4)).toBe(0);
    });

    test('offsets before the first difference are unchanged', () => {
        expect(mapOffset('one\ntwo\nthree', 'one\ntwo\nTHREE', 5)).toBe(5);
    });

    test('offsets after the last difference shift by the length change', () => {
        const a = 'one\nxx\nthree';
        const b = 'one\nxxxxxx\nthree';
        expect(mapOffset(a, b, a.indexOf('three') + 2)).toBe(b.indexOf('three') + 2);
        expect(mapOffset(a, b, a.length)).toBe(b.length);
    });

    test('trailing newline and collapsed blank lines (what a round trip changes)', () => {
        const a = 'a\n\n\n\nb\n';
        const b = 'a\n\nb';
        expect(mapOffset(a, b, a.indexOf('b'))).toBe(b.indexOf('b'));
        expect(mapOffset(b, a, b.indexOf('b'))).toBe(a.indexOf('b'));
        expect(mapOffset(a, b, a.length)).toBe(b.length);
    });

    test('lines that match are aligned across several separate changes', () => {
        const a = 'head\n|---|---|\nkeep one\n* item\nkeep two\ntail';
        const b = 'head\n| --- | --- |\nkeep one\n- item\nkeep two\ntail';
        ['keep one', 'keep two', 'tail'].forEach(word => {
            expect(mapOffset(a, b, a.indexOf(word) + 3)).toBe(b.indexOf(word) + 3);
        });
    });

    test('a changed line maps to its counterpart, column kept or clamped', () => {
        const a = 'x\n* item here\ny\nz changed\nq';
        const b = 'x\n- item\ny\nz CHANGED\nq';
        expect(mapOffset(a, b, a.indexOf('item') + 2)).toBe(b.indexOf('item') + 2);
        expect(mapOffset(a, b, a.indexOf('here') + 4)).toBe(b.indexOf('item') + 4);
    });

    test('a line with no counterpart maps to where the text resumes', () => {
        const a = 'top\nextra one\nextra two\nsame\nmid\nend X';
        const b = 'top\nsame\nmid\nend Y';
        expect(mapOffset(a, b, a.indexOf('extra two') + 3)).toBe(b.indexOf('same'));
    });

    test('a removed last line maps to the end of what remains', () => {
        const a = 'top A\nkeep\ngone one\ngone two!';
        const b = 'top B\nkeep';
        const at = mapOffset(a, b, a.indexOf('gone two') + 2);
        expect(at).toBeGreaterThanOrEqual(b.indexOf('keep'));
        expect(at).toBeLessThanOrEqual(b.length);
    });

    test('never returns an offset outside the target', () => {
        const a = 'alpha\nbeta\ngamma\ndelta';
        const b = 'x';
        for (let i = 0; i <= a.length; i++) {
            const at = mapOffset(a, b, i);
            expect(at).toBeGreaterThanOrEqual(0);
            expect(at).toBeLessThanOrEqual(b.length);
        }
        for (let i = 0; i <= b.length; i++) {
            expect(mapOffset(b, a, i)).toBeLessThanOrEqual(a.length);
        }
        expect(mapOffset('abc', '', 2)).toBe(0);
        expect(mapOffset('', 'abc', 0)).toBe(0);
    });

    test('very large changed regions fall back to proportional mapping', () => {
        const a = 'start\n' + Array.from({ length: 600 }, (_, i) => `a line ${i}`).join('\n') + '\nfinish';
        const b = 'start\n' + Array.from({ length: 600 }, (_, i) => `b line ${i}`).join('\n') + '\nfinish';
        const mid = Math.floor(a.length / 2);
        const at = mapOffset(a, b, mid);
        expect(Math.abs(at - mid)).toBeLessThan(50);
        expect(mapOffset(a, b, a.length - 2)).toBe(b.length - 2);
    });

    test('mapping is monotonic on a realistic round-trip difference', () => {
        const a = '# T\n\npara\n\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n* x\n* y\n\nend\n';
        const b = '# T\n\npara\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n* x\n* y\n\nend';
        let last = -1;
        for (let i = 0; i <= a.length; i++) {
            const at = mapOffset(a, b, i);
            expect(at).toBeGreaterThanOrEqual(last);
            last = at;
        }
    });
});
