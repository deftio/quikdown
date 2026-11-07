/**
 * List continuation lines (issue #36).
 *
 * A wrapped list item — a continuation line indented to the item's text
 * column — used to be read as an indented code block, which closed every
 * open list and left the next nested item as a bare <li>.  These tests
 * cover the regex parser, the AST parser, the AST HTML renderer, and the
 * bidirectional round trip.
 */
import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';
import quikdown_ast from '../dist/quikdown_ast.esm.js';
import quikdown_ast_html from '../dist/quikdown_ast_html.esm.js';
import quikdown_json from '../dist/quikdown_json.esm.js';
import quikdown_yaml from '../dist/quikdown_yaml.esm.js';

const ISSUE_36 = [
    '- **Docs that actually render**',
    '  - Mermaid, LaTeX, GeoJSON maps, Vega charts, STL models, all',
    '    bundled offline, no CDN.',
    '  - Writing a design doc? Sketch the architecture in a fence and it renders',
    '    in the same tab.',
    '',
    '- **Local-first by design**',
    '  - Bring your own key.',
].join('\n');

/** Count occurrences of a tag open or close in html. */
function count(html, re) {
    return (html.match(re) || []).length;
}

/** Assert that p/ul/ol/li open and close tags are balanced. */
function expectBalanced(html) {
    for (const tag of ['p', 'ul', 'ol', 'li']) {
        const opens = count(html, new RegExp(`<${tag}[\\s>]`, 'g'));
        const closes = count(html, new RegExp(`</${tag}>`, 'g'));
        expect({ tag, opens, closes }).toEqual({ tag, opens, closes: opens });
    }
}

/** Every <li> must sit directly inside a <ul> or <ol>, never in a <p>. */
function expectNoBareLi(html) {
    expect(html).not.toMatch(/<p>\s*<li/);
    expect(html).not.toMatch(/<\/(pre|p)>\s*<li/);
}

describe('issue #36: wrapped list items (regex parser)', () => {
    test('issue input renders nested lists with no code block and no bare <li>', () => {
        const html = quikdown(ISSUE_36);
        expect(html).not.toContain('<pre');
        expect(html).toContain('<li class="quikdown-li">Mermaid, LaTeX, GeoJSON maps, Vega charts, STL models, all bundled offline, no CDN.</li>');
        expect(html).toContain('<li class="quikdown-li">Writing a design doc? Sketch the architecture in a fence and it renders in the same tab.</li>');
        expect(html).toContain('<li class="quikdown-li">Bring your own key.</li>');
        expectNoBareLi(html);
        expectBalanced(html);
    });

    test('a list that starts at indent 2 is a top-level list, not an orphan', () => {
        const html = quikdown('  - a\n  - b');
        expect(html).toMatch(/^<ul class="quikdown-ul">/);
        expect(html).toContain('<li class="quikdown-li">a</li>');
        expect(html).toContain('<li class="quikdown-li">b</li>');
        expect(html).not.toContain('<p>');
        expectBalanced(html);
    });

    test('4-space continuation under a nested bullet folds into the item', () => {
        const html = quikdown('- top\n  - nested one two\n    three four.\n  - next');
        expect(html).not.toContain('<pre');
        expect(html).toContain('<li class="quikdown-li">nested one two three four.</li>');
        expect(html).toContain('<li class="quikdown-li">next</li>');
        expectNoBareLi(html);
        expectBalanced(html);
    });

    test('2-space continuation under a top-level bullet folds into the item', () => {
        const html = quikdown('- item\n  wrapped text');
        expect(html).toBe('<ul class="quikdown-ul">\n<li class="quikdown-li">item wrapped text</li>\n</ul>');
    });

    test('ordered item wrapped to its text column stays one list with closed tags', () => {
        const html = quikdown('1. one\n   wrapped.\n2. two');
        expect(count(html, /<ol[\s>]/g)).toBe(1);
        expect(html).toContain('<li class="quikdown-li">one wrapped.</li>');
        expect(html).toContain('<li class="quikdown-li">two</li>');
        expect(html).not.toContain('<p>');
        expectBalanced(html);
    });

    test('several continuation lines fold in order', () => {
        const html = quikdown('- one\n  two\n  three\n- four');
        expect(html).toContain('<li class="quikdown-li">one two three</li>');
        expect(html).toContain('<li class="quikdown-li">four</li>');
    });

    test('tab-indented continuation folds into the item', () => {
        const html = quikdown('- a\n\tb');
        expect(html).toContain('<li class="quikdown-li">a b</li>');
        expect(html).not.toContain('<pre');
    });

    test('continuation of a nested item does not leak into the parent', () => {
        const html = quikdown('- a\n  - b\n    wrapped b\n- c');
        expect(html).toContain('<li class="quikdown-li">a</li>');
        expect(html).toContain('<li class="quikdown-li">b wrapped b</li>');
        expect(html).toContain('<li class="quikdown-li">c</li>');
        expectBalanced(html);
    });

    test('inline formatting spans the fold', () => {
        const html = quikdown('- **bold\n  text**');
        expect(html).toContain('<strong class="quikdown-strong">bold text</strong>');
    });

    test('task list items accept continuation lines', () => {
        const html = quikdown('- [ ] task\n  more');
        expect(html).toContain('disabled> task more</li>');
        const checked = quikdown('- [x] done\n  item');
        expect(checked).toContain('checked disabled> done item</li>');
    });

    test('two trailing spaces before a continuation keep a hard break', () => {
        const html = quikdown('- line one  \n  line two');
        expect(html).toContain('<li class="quikdown-li">line one<br class="quikdown-br">line two</li>');
    });

    test('trailing backslash before a continuation keeps a hard break', () => {
        const html = quikdown('- one\\\n  two');
        expect(html).toContain('<li class="quikdown-li">one<br class="quikdown-br">two</li>');
    });

    test('indent jump opens the intermediate level instead of flattening', () => {
        const html = quikdown('- a\n    - deep\n- b');
        expect(count(html, /<ul[\s>]/g)).toBe(3);
        expect(html).toContain('<li class="quikdown-li">deep</li>');
        expect(html).toContain('<li class="quikdown-li">b</li>');
        expectNoBareLi(html);
        expectBalanced(html);
    });

    test('indent jump to a different list type opens that type', () => {
        const html = quikdown('- a\n    1. deep');
        expect(html).toContain('<ol class="quikdown-ol">');
        expect(html).toContain('<li class="quikdown-li">deep</li>');
        expectBalanced(html);
    });

    test('item less indented than the base is clamped to the top level', () => {
        const html = quikdown('  - a\n- b');
        expect(count(html, /<ul[\s>]/g)).toBe(1);
        expect(html).toContain('<li class="quikdown-li">a</li>');
        expect(html).toContain('<li class="quikdown-li">b</li>');
        expectBalanced(html);
    });

    test('blank line ends the item, so indented code after a list is still code', () => {
        const html = quikdown('- item\n\n    code');
        expect(html).toContain('<li class="quikdown-li">item</li>');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>code<\/code><\/pre>/);
    });

    test('blank line ends the item, so a following indented line is a paragraph', () => {
        const html = quikdown('- a\n\n  not a continuation');
        expect(html).toContain('<li class="quikdown-li">a</li>');
        expect(html).toContain('<p>  not a continuation</p>');
    });

    test('indented code with no list above is unchanged', () => {
        const html = quikdown('para\n\n    code');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>code<\/code><\/pre>/);
    });

    test('indented list items are still nested lists, not code', () => {
        const html = quikdown('- outer\n    - nested');
        expect(html).not.toContain('<pre');
        expect(html).toContain('<li class="quikdown-li">nested</li>');
    });

    test('indented block constructs under an item are not folded', () => {
        // These keep their previous rendering rather than being swallowed
        // into the list item text.
        expect(quikdown('- a\n  > quoted')).toContain('<li class="quikdown-li">a</li>');
        expect(quikdown('- a\n  > quoted')).not.toContain('a &gt; quoted');
        expect(quikdown('- a\n  ```js')).toContain('<li class="quikdown-li">a</li>');
        expect(quikdown('- a\n  ~~~')).toContain('<li class="quikdown-li">a</li>');
        expect(quikdown('- a\n  # heading')).toContain('<li class="quikdown-li">a</li>');
        expect(quikdown('- a\n  ---')).toContain('<li class="quikdown-li">a</li>');
        expect(quikdown('- a\n  ***')).toContain('<li class="quikdown-li">a</li>');
        expect(quikdown('- a\n  | x | y |\n  |---|---|')).toContain('<li class="quikdown-li">a</li>');
    });

    test('text after a list without indent still ends the list', () => {
        const html = quikdown('- a\nparagraph');
        expect(html).toContain('<li class="quikdown-li">a</li>');
        expect(html).toContain('</ul>\n<p>paragraph</p>');
    });

    test('existing nested list rendering is unchanged', () => {
        const html = quikdown('- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2');
        expect(html).toBe([
            '<ul class="quikdown-ul">',
            '<li class="quikdown-li">Item 1</li>',
            '<ul class="quikdown-ul">',
            '<li class="quikdown-li">Nested 1</li>',
            '<li class="quikdown-li">Nested 2</li>',
            '</ul>',
            '<li class="quikdown-li">Item 2</li>',
            '</ul>',
        ].join('\n'));
    });

    test('inline_styles mode folds continuation lines too', () => {
        const html = quikdown('- a\n  b', { inline_styles: true });
        expect(html).toMatch(/<li style="[^"]*">a b<\/li>/);
    });

    test('lazy_linefeeds mode folds with a space, not a <br>', () => {
        const html = quikdown('- a\n  b', { lazy_linefeeds: true });
        expect(html).toContain('<li class="quikdown-li">a b</li>');
        expect(html).not.toContain('<br');
    });

    test('bidirectional mode keeps data-qd markers on folded items', () => {
        const html = quikdown('1. one\n   wrapped.\n2. two', { bidirectional: true });
        expect(html).toContain('<li class="quikdown-li" data-qd="1.">one wrapped.</li>');
        expect(html).toContain('<li class="quikdown-li" data-qd="2.">two</li>');
        expect(html).not.toContain('<p>');
    });
});

describe('issue #36: bidirectional round trip', () => {
    test('wrapped ordered items round-trip to single-line items and are stable', () => {
        const html = quikdown_bd('1. one\n   wrapped.\n2. two');
        expect(html).not.toContain('<p>');
        const md = quikdown_bd.toMarkdown(html);
        expect(md).toBe('1. one wrapped.\n2. two');
        expect(quikdown_bd.toMarkdown(quikdown_bd(md))).toBe(md);
    });

    test('wrapped unordered item round-trips with its marker', () => {
        const html = quikdown_bd('- item\n  wrapped text\n- next');
        expect(quikdown_bd.toMarkdown(html)).toBe('- item wrapped text\n- next');
    });

    test('wrapped nested items round-trip as nested single-line items', () => {
        const md = quikdown_bd.toMarkdown(quikdown_bd('- top\n  - nested one two\n    three four.\n  - next'));
        expect(md).toBe('- top\n  - nested one two three four.\n  - next');
    });

    test('issue input round-trips without code blocks and keeps nesting', () => {
        const html = quikdown_bd(ISSUE_36);
        expect(html).not.toContain('<pre');
        expectNoBareLi(html);
        expectBalanced(html);
        const md = quikdown_bd.toMarkdown(html);
        expect(md).not.toContain('```');
        expect(md).toContain('- **Docs that actually render**\n  - Mermaid, LaTeX, GeoJSON maps, Vega charts, STL models, all bundled offline, no CDN.\n  - Writing a design doc? Sketch the architecture in a fence and it renders in the same tab.');
        expect(md).toContain('- **Local-first by design**\n  - Bring your own key.');
        expect(quikdown_bd.toMarkdown(quikdown_bd(md))).toBe(md);
    });
});

describe('bidirectional: nested lists emitted as <ul>/<ol> siblings', () => {
    // The parser places a nested list after its parent <li>, as a sibling.
    // toMarkdown used to skip those and drop every nested item.
    test.each([
        '- a\n  - b\n- c',
        '- Level 1\n  - Level 2\n    - Level 3\n      - Level 4\n        - Level 5',
        '- a\n  1. b\n  2. c\n- d',
        '1. a\n  - b\n2. c',
        '- [ ] task\n  - sub\n- [x] done',
        '- a  \n  b\n  - c',
        '- **x**\n  - [l](https://example.com)\n\n- y',
    ])('round-trips exactly: %j', (md) => {
        const out = quikdown_bd.toMarkdown(quikdown_bd(md));
        expect(out).toBe(md);
    });

    test('ordered nesting normalizes to 2-space indent and is then stable', () => {
        const once = quikdown_bd.toMarkdown(quikdown_bd('1. a\n   1. b\n   2. c\n2. d'));
        expect(once).toBe('1. a\n  1. b\n  2. c\n2. d');
        expect(quikdown_bd.toMarkdown(quikdown_bd(once))).toBe(once);
    });

    test('nested list placed inside the <li> still works', () => {
        const html = '<ul><li data-qd="-">Item 1\n  <ul><li data-qd="-">Nested 1</li><li data-qd="-">Nested 2</li></ul>\n</li><li data-qd="-">Item 2</li></ul>';
        expect(quikdown_bd.toMarkdown(html)).toBe('- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2');
    });

    test('hard break inside a task item indents the continuation', () => {
        const md = '- [ ] one  \n      two';
        expect(quikdown_bd.toMarkdown(quikdown_bd(md))).toBe(md);
    });
});

describe('issue #36: AST parser', () => {
    test('continuation line is appended to the list item, not emitted as a paragraph', () => {
        const ast = quikdown_ast('- top\n  - nested one two\n    three four.\n  - next');
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0].type).toBe('list');
        const top = ast.children[0].items[0];
        // Nested list is attached to the first item
        const nested = top.children.find(c => c.type === 'list');
        expect(nested).toBeDefined();
        expect(nested.items).toHaveLength(2);
        const text = nested.items[0].children.map(n => n.value).join('');
        expect(text).toBe('nested one two three four.');
        expect(nested.items[1].children[0].value).toBe('next');
    });

    test('issue input yields two lists and no paragraphs', () => {
        const ast = quikdown_ast(ISSUE_36);
        expect(ast.children.map(c => c.type)).toEqual(['list', 'list']);
    });

    test('top-level continuation line', () => {
        const ast = quikdown_ast('- item\n  wrapped');
        expect(ast.children[0].items[0].children[0].value).toBe('item wrapped');
    });

    test('ordered list continuation', () => {
        const ast = quikdown_ast('1. one\n   wrapped.\n2. two');
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0].ordered).toBe(true);
        expect(ast.children[0].items).toHaveLength(2);
        expect(ast.children[0].items[0].children[0].value).toBe('one wrapped.');
    });

    test('task list continuation keeps the checked state', () => {
        const ast = quikdown_ast('- [x] done\n  item');
        const item = ast.children[0].items[0];
        expect(item.checked).toBe(true);
        expect(item.children[0].value).toBe('done item');
    });

    test('hard break before a continuation becomes a br node', () => {
        const spaces = quikdown_ast('- one  \n  two');
        expect(spaces.children[0].items[0].children.map(n => n.type)).toEqual(['text', 'br', 'text']);
        const backslash = quikdown_ast('- one\\\n  two');
        expect(backslash.children[0].items[0].children.map(n => n.type)).toEqual(['text', 'br', 'text']);
    });

    test('inline formatting spans the fold', () => {
        const ast = quikdown_ast('- **bold\n  text**');
        const strong = ast.children[0].items[0].children[0];
        expect(strong.type).toBe('strong');
        expect(strong.children[0].value).toBe('bold text');
    });

    test('continuation after a nested list belongs to the nested item', () => {
        const ast = quikdown_ast('- a\n  - b\n    wrapped b\n- c');
        const list = ast.children[0];
        expect(list.items).toHaveLength(2);
        const nested = list.items[0].children.find(c => c.type === 'list');
        expect(nested.items[0].children[0].value).toBe('b wrapped b');
        expect(list.items[1].children[0].value).toBe('c');
    });

    test('blank line still ends the list', () => {
        const ast = quikdown_ast('- a\n\n  not a continuation');
        expect(ast.children.map(c => c.type)).toEqual(['list', 'paragraph']);
    });

    test('indented block constructs are not folded', () => {
        expect(quikdown_ast('- a\n  > quoted').children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(quikdown_ast('- a\n  ```js').children[0].items[0].children[0].value).toBe('a');
        expect(quikdown_ast('- a\n  # h').children[0].items[0].children[0].value).toBe('a');
        expect(quikdown_ast('- a\n  ---').children[0].items[0].children[0].value).toBe('a');
        expect(quikdown_ast('- a\n  | x |').children[0].items[0].children[0].value).toBe('a');
    });

    test('continuation less indented than the list base is not folded', () => {
        const ast = quikdown_ast('  - a\n b');
        expect(ast.children.map(c => c.type)).toEqual(['list', 'paragraph']);
    });

    test('AST HTML renderer matches the regex parser on the issue input', () => {
        const html = quikdown_ast_html(ISSUE_36);
        expect(html).not.toContain('<pre');
        expect(html).not.toContain('<p>');
        expect(html).toContain('<li class="quikdown-li">Mermaid, LaTeX, GeoJSON maps, Vega charts, STL models, all bundled offline, no CDN.</li>');
        expect(html).toContain('<li class="quikdown-li">Writing a design doc? Sketch the architecture in a fence and it renders in the same tab.</li>');
    });

    test('AST HTML renderer keeps hard breaks inside wrapped items', () => {
        expect(quikdown_ast_html('- one  \n  two')).toContain('<li class="quikdown-li">one<br>two</li>');
    });
});

describe('issue #36: JSON and YAML output (bundled AST parser)', () => {
    // quikdown_json and quikdown_yaml bundle their own copy of the AST
    // parser, so the continuation rules are exercised through them too.
    const CASES = [
        ['- top\n  - nested one two\n    three four.\n  - next', 'nested one two three four.'],
        ['- item\n  wrapped', 'item wrapped'],
        ['1. one\n   wrapped.\n2. two', 'one wrapped.'],
        ['- [x] done\n  item', 'done item'],
        ['- a\n  - b\n    wrapped b\n- c', 'b wrapped b'],
        ['- a\n\tb', 'a b'],
    ];

    test.each(CASES)('json: %j', (md, joined) => {
        const doc = JSON.parse(quikdown_json(md));
        expect(JSON.stringify(doc)).toContain(JSON.stringify(joined));
        expect(doc.children.every(c => c.type !== 'paragraph')).toBe(true);
    });

    test.each(CASES)('yaml: %j', (md, joined) => {
        const yaml = quikdown_yaml(md);
        expect(yaml).toContain(joined);
        expect(yaml).not.toContain('type: paragraph');
    });

    test('json: hard breaks before a continuation become br nodes', () => {
        for (const md of ['- one  \n  two', '- one\\\n  two']) {
            const doc = JSON.parse(quikdown_json(md));
            expect(doc.children[0].items[0].children.map(n => n.type)).toEqual(['text', 'br', 'text']);
        }
    });

    test('json/yaml: a plain line after a nested item ends the sublist and the list', () => {
        expect(JSON.parse(quikdown_json('- a\n  - b\ntext')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(quikdown_yaml('- a\n  - b\ntext')).toContain('type: paragraph');
    });

    test('ast_html: non-string input renders nothing', () => {
        expect(quikdown_ast_html(null)).toBe('');
        expect(quikdown_ast_html('')).toBe('');
    });

    test('json: block constructs and blank lines are not folded', () => {
        expect(JSON.parse(quikdown_json('- a\n  > quoted')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(JSON.parse(quikdown_json('- a\n  ```js')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(JSON.parse(quikdown_json('- a\n  # h')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(JSON.parse(quikdown_json('- a\n  ---')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(JSON.parse(quikdown_json('- a\n  | x |')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(JSON.parse(quikdown_json('- a\n\n  later')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
        expect(JSON.parse(quikdown_json('  - a\n b')).children.map(c => c.type)).toEqual(['list', 'paragraph']);
    });

    test('yaml: hard breaks and non-folded constructs', () => {
        expect(quikdown_yaml('- one  \n  two')).toContain('type: br');
        expect(quikdown_yaml('- a\n  > quoted')).toContain('type: paragraph');
        expect(quikdown_yaml('- a\n\n  later')).toContain('type: paragraph');
    });
});

describe('coverage: indented-code and blockquote paths reached through the list changes', () => {
    // The continuation rule now passes list items through before the
    // indented-code check, so these paths need direct coverage in both the
    // core bundle and the bidirectional bundle (which inlines the parser).
    const parsers = [['quikdown', quikdown], ['quikdown_bd', quikdown_bd]];

    test.each(parsers)('%s: 4-space indented list/quote/heading lines with no list above are not code', (_, parse) => {
        expect(parse('para\n\n    - item')).not.toContain('<pre');
        expect(parse('para\n\n    - item')).toContain('<li');
        expect(parse('para\n\n    1. item')).toContain('<li');
        // A 4-space indented `>` line is an indented code block (CommonMark);
        // the `>` has already been escaped to &gt; by this phase.
        expect(parse('para\n\n    > quote')).toContain('<pre');
        expect(parse('para\n\n    # heading')).not.toContain('<pre');
    });

    test.each(parsers)('%s: tab-indented code block strips one tab', (_, parse) => {
        const html = parse('\tcode here');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>code here<\/code><\/pre>/);
    });

    test.each(parsers)('%s: mixed space-and-tab indent strips one indent level', (_, parse) => {
        const html = parse('  \tcode here');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>code here<\/code><\/pre>/);
    });

    test.each(parsers)('%s: indented code ends at a blank line followed by text', (_, parse) => {
        const html = parse('    code\n\nafter');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>code<\/code><\/pre>/);
        expect(html).toContain('<p>after</p>');
    });

    test.each(parsers)('%s: indented code ends at a non-indented line', (_, parse) => {
        const html = parse('    code\nafter');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>code<\/code><\/pre>/);
        expect(html).toContain('after');
    });

    test.each(parsers)('%s: blank line inside indented code is kept', (_, parse) => {
        const html = parse('    one\n\n    two');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>one\n\ntwo<\/code><\/pre>/);
    });

    test.each(parsers)('%s: lazy_linefeeds does not inject <br> into indented code', (_, parse) => {
        const html = parse('    a\n    b', { lazy_linefeeds: true });
        expect(html).toMatch(/<pre[^>]*><code[^>]*>a\nb<\/code><\/pre>/);
        expect(html).not.toContain('<br');
    });

    test.each(parsers)('%s: trailing spaces or backslash on indented code lines are literal', (_, parse) => {
        const html = parse('    a  \n    b\\\n    c');
        expect(html).toMatch(/<pre[^>]*><code[^>]*>a  \nb\\\nc<\/code><\/pre>/);
        expect(html).not.toContain('<br');
    });

    test.each(parsers)('%s: nested blockquote closes back to the outer level', (_, parse) => {
        const html = parse('> outer\n>> inner\n> outer again');
        expect(count(html, /<blockquote[\s>]/g)).toBe(2);
        expect(count(html, /<\/blockquote>/g)).toBe(2);
    });
});

describe('coverage: angle-bracket link destinations in the AST family', () => {
    test('quikdown_ast parses [text](<url>)', () => {
        const ast = quikdown_ast('[docs](<https://example.com/a b>)');
        const link = ast.children[0].children.find(n => n.type === 'link');
        expect(link.url).toBe('https://example.com/a b');
    });

    test('quikdown_json and quikdown_yaml parse [text](<url>)', () => {
        expect(JSON.parse(quikdown_json('[d](<https://example.com/x>)')).children[0].children[0].url).toBe('https://example.com/x');
        expect(quikdown_yaml('[d](<https://example.com/x>)')).toContain('https://example.com/x');
    });

    test('quikdown_ast_html renders [text](<url>)', () => {
        expect(quikdown_ast_html('[d](<https://example.com/x>)')).toContain('href="https://example.com/x"');
    });
});
