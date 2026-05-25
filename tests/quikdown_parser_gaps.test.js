/**
 * Parser gap fixes: link titles, indented code, ragged tables,
 * heading slugs, nested blockquotes.
 */
import quikdown from '../dist/quikdown.esm.js';

describe('parser gap fixes', () => {
    describe('link and image titles', () => {
        test('link with double-quoted title', () => {
            const html = quikdown('[docs](https://example.com/docs "Documentation")');
            expect(html).toContain('href="https://example.com/docs"');
            expect(html).toContain('title="Documentation"');
            expect(html).not.toMatch(/href="[^"]*Documentation/);
        });

        test('link with single-quoted title', () => {
            const html = quikdown("[home](/ 'Home page')");
            expect(html).toContain('href="/"');
            expect(html).toContain("title=\"Home page\"");
        });

        test('link without title unchanged', () => {
            const html = quikdown('[text](https://example.com/path?q=1)');
            expect(html).toContain('href="https://example.com/path?q=1"');
            expect(html).not.toContain('title=');
        });

        test('image with title', () => {
            const html = quikdown('![logo](logo.png "Site logo")');
            expect(html).toContain('src="logo.png"');
            expect(html).toContain('title="Site logo"');
            expect(html).not.toMatch(/src="[^"]*Site logo/);
        });

        test('angle-bracket destination', () => {
            const html = quikdown('[x](<https://example.com/a b>)');
            expect(html).toContain('href="https://example.com/a b"');
        });

        test('bidirectional preserves title metadata', () => {
            const html = quikdown('[t](https://x.com "tip")', { bidirectional: true });
            expect(html).toContain('data-qd-title="tip"');
            expect(html).toContain('title="tip"');
        });
    });

    describe('indented code blocks', () => {
        test('4-space indented lines become pre/code', () => {
            const md = '    const x = 1;\n    const y = 2;';
            const html = quikdown(md);
            expect(html).toMatch(/<pre[^>]*><code[^>]*>/);
            expect(html).toContain('const x = 1;');
            expect(html).toContain('const y = 2;');
            expect(html).not.toMatch(/^<p>    const/m);
        });

        test('tab-indented line becomes code block', () => {
            const html = quikdown('\tprint("hi")');
            expect(html).toMatch(/<pre[^>]*><code[^>]*>/);
            expect(html).toContain('print(');
            expect(html).toContain('hi');
        });

        test('blank line inside indented block is preserved', () => {
            const md = '    line1\n\n    line2';
            const html = quikdown(md);
            expect(html).toMatch(/<pre[^>]*><code[^>]*>/);
            expect(html).toContain('line1');
            expect(html).toContain('line2');
        });

        test('indented block ends at non-indented line', () => {
            const md = '    code\n\nparagraph';
            const html = quikdown(md);
            expect(html).toMatch(/<pre[^>]*>[\s\S]*code[\s\S]*<\/pre>/);
            expect(html).toContain('<p>paragraph</p>');
        });

        test('does not steal fenced code (fences take priority in phase 1)', () => {
            const md = '```js\ncode\n```';
            const html = quikdown(md);
            expect(html).toMatch(/<pre[^>]*><code/);
            expect(html).toContain('code');
        });

        test('does not treat indented list items as code blocks', () => {
            const md = '- outer\n    - nested';
            const html = quikdown(md);
            expect(html).toContain('<ul');
            expect(html).toContain('nested');
            expect(html).not.toMatch(/<pre[^>]*>[\s\S]*nested/);
        });
    });

    describe('ragged tables without separator row', () => {
        test('two-row pipe table without --- separator', () => {
            const md = '| A | B |\n| 1 | 2 |';
            const html = quikdown(md);
            expect(html).toContain('<table');
            expect(html).toContain('<th');
            expect(html).toContain('A');
            expect(html).toContain('B');
            expect(html).toContain('1');
            expect(html).toContain('2');
            expect(html).not.toMatch(/<p>\| A \| B \|/);
        });

        test('GFM style without outer pipes', () => {
            const md = 'Col1 | Col2\n1 | 2';
            const html = quikdown(md);
            expect(html).toContain('<table');
            expect(html).toContain('Col1');
            expect(html).toContain('2');
        });

        test('multi-row ragged table', () => {
            const md = '| Name | Role |\n| Alice | Dev |\n| Bob | QA |';
            const html = quikdown(md);
            expect(html).toContain('<thead');
            expect(html).toContain('<tbody');
            expect(html).toContain('Alice');
            expect(html).toContain('Bob');
        });

        test('single pipe row still not a table', () => {
            const html = quikdown('| only | one |');
            expect(html).not.toContain('<table');
        });

        test('tables with separator still work', () => {
            const md = '| A | B |\n|---|---|\n| 1 | 2 |';
            const html = quikdown(md);
            expect(html).toContain('<table');
            expect(html).toContain('1');
        });
    });

    describe('heading slugs (heading_ids)', () => {
        test('off by default — no id attributes', () => {
            const html = quikdown('# Install');
            expect(html).not.toContain('id=');
        });

        test('generates id from heading text', () => {
            const html = quikdown('# Installation Guide', { heading_ids: true });
            expect(html).toContain('id="installation-guide"');
        });

        test('strips inline markers from slug', () => {
            const html = quikdown('# **Quick** Start', { heading_ids: true });
            expect(html).toContain('id="quick-start"');
        });

        test('deduplicates repeated headings', () => {
            const md = '# Setup\n\n# Setup\n\n## Setup';
            const html = quikdown(md, { heading_ids: true });
            expect(html).toContain('id="setup"');
            expect(html).toContain('id="setup-1"');
            expect(html).toContain('id="setup-2"');
        });

        test('anchor link target works in output', () => {
            const md = '# Install\n\n[go](#install)';
            const html = quikdown(md, { heading_ids: true });
            expect(html).toContain('id="install"');
            expect(html).toContain('href="#install"');
        });
    });

    describe('nested blockquotes', () => {
        test('>> syntax nests blockquotes', () => {
            const html = quikdown('> outer\n>> inner');
            expect(html).toMatch(
                /<blockquote[^>]*>outer[\s\S]*<blockquote[^>]*>inner[\s\S]*<\/blockquote>[\s\S]*<\/blockquote>/
            );
        });

        test('> > syntax nests blockquotes', () => {
            const html = quikdown('> outer\n> > inner');
            expect(html).toMatch(
                /<blockquote[^>]*>outer[\s\S]*<blockquote[^>]*>inner/
            );
        });

        test('three levels deep', () => {
            const html = quikdown('> a\n>> b\n>>> c');
            expect(html.match(/<blockquote/g).length).toBe(3);
            expect(html).toContain('c');
        });

        test('consecutive same-level quotes stay in one block', () => {
            const html = quikdown('> line one\n> line two');
            expect(html.match(/<blockquote/g).length).toBe(1);
            expect(html).toContain('line one');
            expect(html).toContain('line two');
        });

        test('blank line ends blockquote run', () => {
            const html = quikdown('> first\n\n> second');
            expect(html.match(/<blockquote/g).length).toBe(2);
        });
    });
});
