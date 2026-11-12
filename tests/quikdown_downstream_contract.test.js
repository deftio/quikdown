/**
 * @file quikdown_downstream_contract.test.js — output that real consumers depend on
 *
 * Downstream applications assert on quikdown's exact HTML in their own test
 * suites and feed it straight into innerHTML / dangerouslySetInnerHTML. The
 * cases below pin the behaviour they rely on, so a change here is a breaking
 * change for users, not just a snapshot update:
 *
 *   - raw HTML is escaped, unsafe URL schemes are rewritten to "#"
 *   - class-mode output uses the stable `quikdown-<tag>` class names
 *   - URLs containing parentheses stay intact (common in LLM output)
 *   - `allow_images: false` never emits <img>
 *
 * The first block mirrors assertions found in a production consumer
 * (an Astro/React workspace that renders plans and LLM agent messages).
 */

import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';
import quikdown_ast from '../dist/quikdown_ast.esm.js';
import quikdown_ast_html from '../dist/quikdown_ast_html.esm.js';

describe('downstream contract: safe-by-default rendering', () => {
    const html = quikdown(
        '# Title\n\nParagraph <script>alert(1)</script> with [Site](https://example.dev) and [bad](javascript:alert(1))\n\n- one\n- two\n\n```\ncode\n```'
    );

    test('raw HTML in markdown is escaped', () => {
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<script');
    });

    test('safe links keep their href, unsafe schemes become "#"', () => {
        expect(html).toContain('href="https://example.dev"');
        expect(html).toContain('<a class="quikdown-a" href="#">bad</a>');
        expect(html).not.toContain('javascript:');
    });

    test('block structure tags are emitted', () => {
        expect(html).toContain('<h1');
        expect(html).toContain('<pre');
        expect(html).toContain('<li');
    });

    test('output is a plain string, including for empty input', () => {
        expect(typeof quikdown('')).toBe('string');
        expect(quikdown('')).toBe('');
        expect(typeof quikdown('text')).toBe('string');
    });
});

describe('downstream contract: consumer assertions, verbatim', () => {
    // The markdown shapes and expected fragments below are copied from a
    // consumer's test suite (workflow cards built from bold labels followed by
    // plain paragraphs). If one of these fails, that consumer's build breaks.
    const deviation = [
        '**Superseded requirement:**', 'Keep monolithic router',
        '**Replacement requirement:**', 'Split router into sub-modules',
        '**Reason:**', 'Improve testability',
        '*Approved at:* 2026-10-11T12:00:00Z',
    ].join('\n\n');

    const checkpoint = [
        '**Pair checkpoint 2.**',
        '**Summary**', 'Extracted database adapters.',
        '**Next increment:**', 'Wire migration tests.',
        '- src/adapters/db.ts exists',
    ].join('\n\n');

    test.each([
        [deviation, '<strong class="quikdown-strong">Superseded requirement:</strong>'],
        [deviation, '<strong class="quikdown-strong">Replacement requirement:</strong>'],
        [deviation, '<strong class="quikdown-strong">Reason:</strong>'],
        [deviation, '<p>Keep monolithic router</p>'],
        [deviation, '<p>Split router into sub-modules</p>'],
        [deviation, '<p>Improve testability</p>'],
        [checkpoint, '<strong class="quikdown-strong">Pair checkpoint 2.</strong>'],
        [checkpoint, '<strong class="quikdown-strong">Summary</strong>'],
        [checkpoint, '<strong class="quikdown-strong">Next increment:</strong>'],
        [checkpoint, '<p>Extracted database adapters.</p>'],
        [checkpoint, '<p>Wire migration tests.</p>'],
    ])('workflow card contains %#', (markdown, fragment) => {
        // The consumer trims the result before inserting it.
        expect(String(quikdown(markdown)).trim()).toContain(fragment);
    });

    test('renderMarkdown case: links render, unsafe input is escaped', () => {
        const html = String(quikdown(
            '# Title\n\nParagraph <script>alert(1)</script> with [RunWield](https://runwield.dev) and [bad](javascript:alert(1))\n\n- one\n- two\n\n```\ncode\n```'
        )).trim();
        expect(html).toContain('<h1');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('href="https://runwield.dev"');
        expect(html).toContain('href="#"');
        expect(html).toContain('<pre');
    });

    test('empty input renders to an empty string (consumer shows its own empty state)', () => {
        expect(String(quikdown('')).trim()).toBe('');
    });
});

describe('downstream contract: stable quikdown-* class names', () => {
    test.each([
        ['**Reason:** text', '<strong class="quikdown-strong">Reason:</strong>'],
        ['*em*', '<em class="quikdown-em">em</em>'],
        ['~~gone~~', '<del class="quikdown-del">gone</del>'],
        ['`code`', '<code class="quikdown-code">code</code>'],
        ['[a](https://x.dev)', '<a class="quikdown-a" href="https://x.dev" rel="noopener noreferrer">a</a>'],
        ['# H', '<h1 class="quikdown-h1">H</h1>'],
        ['## H', '<h2 class="quikdown-h2">H</h2>'],
        ['> q', '<blockquote class="quikdown-blockquote">q</blockquote>'],
        ['![alt](a.png)', '<img class="quikdown-img" src="a.png" alt="alt">'],
        ['text', '<p>text</p>'],
    ])('%s', (markdown, fragment) => {
        expect(quikdown(markdown)).toContain(fragment);
    });

    test('list, table and code block containers carry their class', () => {
        expect(quikdown('- a')).toContain('<ul class="quikdown-ul">');
        expect(quikdown('- a')).toContain('<li class="quikdown-li">');
        expect(quikdown('1. a')).toContain('<ol class="quikdown-ol">');
        expect(quikdown('| a |\n|---|\n| b |')).toContain('<table class="quikdown-table">');
        expect(quikdown('```\nx\n```')).toContain('<pre class="quikdown-pre">');
    });

    test('inline_styles: true emits style attributes instead of classes', () => {
        const styled = quikdown('**b**', { inline_styles: true });
        expect(styled).toContain('<strong style="');
        expect(styled).not.toContain('class="quikdown-');
    });
});

describe('URLs containing parentheses', () => {
    test('link destination keeps one level of balanced parentheses', () => {
        expect(quikdown('[w](https://en.wikipedia.org/wiki/Foo_(bar))'))
            .toBe('<p><a class="quikdown-a" href="https://en.wikipedia.org/wiki/Foo_(bar)" rel="noopener noreferrer">w</a></p>');
        expect(quikdown('[a](f(x)(y))')).toContain('href="f(x)(y)"');
    });

    test('image destination keeps parentheses and still parses the title', () => {
        expect(quikdown('![i](https://x.org/a_(b).png "t")'))
            .toBe('<p><img class="quikdown-img" src="https://x.org/a_(b).png" alt="i" title="t"></p>');
    });

    test('unsafe URL with parentheses is fully neutralised (no stray text)', () => {
        expect(quikdown('[bad](javascript:alert(1))')).toBe('<p><a class="quikdown-a" href="#">bad</a></p>');
        expect(quikdown('![bad](javascript:alert(1))')).toBe('<p><img class="quikdown-img" src="#" alt="bad"></p>');
    });

    test('a link inside parenthesised prose is unaffected', () => {
        expect(quikdown('(see [a](http://x.y))'))
            .toBe('<p>(see <a class="quikdown-a" href="http://x.y" rel="noopener noreferrer">a</a>)</p>');
        expect(quikdown('[a](b) and (c)')).toBe('<p><a class="quikdown-a" href="b">a</a> and (c)</p>');
    });

    test('unbalanced destination is left as literal text', () => {
        expect(quikdown('[a](un(bal)')).toBe('<p>[a](un(bal)</p>');
    });

    test('AST parser agrees with the core parser', () => {
        const link = quikdown_ast('[w](https://en.wikipedia.org/wiki/Foo_(bar))').children[0].children[0];
        expect(link).toMatchObject({ type: 'link', url: 'https://en.wikipedia.org/wiki/Foo_(bar)' });
        const img = quikdown_ast('![i](https://x.org/a_(b).png "t")').children[0].children[0];
        expect(img).toMatchObject({ type: 'image', url: 'https://x.org/a_(b).png', title: 't' });
        expect(quikdown_ast_html('[w](https://x.org/a_(b))')).toContain('href="https://x.org/a_(b)"');
    });

    test('adversarial input stays fast (no catastrophic backtracking)', () => {
        const inputs = [
            '[a](' + '('.repeat(20000),
            '[a](' + '(x)'.repeat(20000),
            '[a]('.repeat(20000),
            '![a](' + 'x('.repeat(20000),
            '[a](' + 'x'.repeat(50000),
        ];
        const start = Date.now();
        for (const input of inputs) {
            quikdown(input);
            quikdown_ast(input);
        }
        expect(Date.now() - start).toBeLessThan(2000);
    });
});

describe('allow_images option', () => {
    const md = 'Before ![chart](https://tracker.example/p.png?d=secret "T") after';

    test('default renders <img>', () => {
        expect(quikdown(md)).toContain('<img class="quikdown-img" src="https://tracker.example/p.png?d=secret" alt="chart" title="T">');
        expect(quikdown(md, { allow_images: true })).toContain('<img');
    });

    test('allow_images: false renders a link and never an <img>', () => {
        const html = quikdown(md, { allow_images: false });
        expect(html).not.toContain('<img');
        expect(html).toBe('<p>Before <a class="quikdown-a" href="https://tracker.example/p.png?d=secret" rel="noopener noreferrer" title="T">chart</a> after</p>');
    });

    test('empty alt text falls back to the label "image"', () => {
        expect(quikdown('![](a.png)', { allow_images: false })).toBe('<p><a class="quikdown-a" href="a.png">image</a></p>');
    });

    test('the resulting link is still URL-sanitized', () => {
        const html = quikdown('![x](javascript:alert(1)) ![y](data:text/html,hi)', { allow_images: false });
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('data:text');
        expect(html).not.toContain('<img');
    });

    test('works with inline_styles, configure() and quikdown_bd', () => {
        expect(quikdown('![a](b.png)', { allow_images: false, inline_styles: true })).not.toContain('<img');
        expect(quikdown.configure({ allow_images: false })('![a](b.png)')).not.toContain('<img');
        expect(quikdown_bd('![a](b.png)', { allow_images: false })).not.toContain('<img');
        expect(quikdown_bd('![a](b.png)')).toContain('<img');
    });
});
