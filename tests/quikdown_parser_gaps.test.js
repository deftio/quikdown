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

// ════════════════════════════════════════════════════════════════════
//  Inline code line boundary + backslash escape tests
// ════════════════════════════════════════════════════════════════════

describe('inline code must not cross newlines', () => {
  test('same-line pair still works', () => {
    const result = quikdown('`code here`');
    expect(result).toContain('<code');
    expect(result).toContain('code here');
  });

  test('cross-line pair produces no code', () => {
    const result = quikdown('`code\nnewline`');
    expect(result).not.toContain('<code');
  });

  test('lone backtick does not poison next paragraph', () => {
    const result = quikdown('a ` here\n\n`real` code');
    expect(result).toContain('<code');
    expect(result).toContain('real');
  });

  test('lone backtick in table cell — table intact', () => {
    const input = '| Name | Symbol | Desc |\n|------|--------|------|\n| backtick | ` | used for code |';
    const result = quikdown(input);
    expect(result).toContain('<table');
    const tdCount = (result.match(/<td/g) || []).length;
    expect(tdCount).toBeGreaterThanOrEqual(3);
    // Should not have a runaway <code> spanning cells
    expect(result).not.toMatch(/<code[^>]*>.*used for code/);
  });

  test('two tables, first has lone backtick — second renders', () => {
    const input = '| A | B |\n|---|---|\n| ` | x |\n\n| C | D |\n|---|---|\n| y | z |';
    const result = quikdown(input);
    const tableCount = (result.match(/<table/g) || []).length;
    expect(tableCount).toBe(2);
  });

  test('xelp scenario — full row with backtick cell', () => {
    const input = '| Symbol | Name | Description |\n|--------|------|-------------|\n| `X` | ` (backtick) | used in code |';
    const result = quikdown(input);
    expect(result).toContain('<table');
    expect(result).toContain('(backtick)');
    const trCount = (result.match(/<tr/g) || []).length;
    expect(trCount).toBeGreaterThanOrEqual(2);
  });

  test('backtick in blockquote stays per-line', () => {
    const result = quikdown('> `start\n> end`');
    expect(result).not.toMatch(/<code[^>]*>start[\s\S]*end<\/code>/);
  });
});

describe('backslash escapes', () => {
  test('\\* prevents italic', () => {
    const result = quikdown('\\*not italic\\*');
    expect(result).not.toContain('<em');
    expect(result).toContain('*not italic*');
  });

  test('\\_ prevents italic', () => {
    const result = quikdown('\\_not italic\\_');
    expect(result).not.toContain('<em');
  });

  test('\\*\\* prevents bold', () => {
    const result = quikdown('\\*\\*not bold\\*\\*');
    expect(result).not.toContain('<strong');
  });

  test('\\` prevents code', () => {
    const result = quikdown('\\`not code\\`');
    expect(result).not.toContain('<code');
  });

  test('\\~~ prevents strikethrough', () => {
    const result = quikdown('\\~~not del\\~~');
    expect(result).not.toContain('<del');
  });

  test('\\[ prevents link', () => {
    const result = quikdown('\\[text\\](url)');
    expect(result).not.toContain('<a');
  });

  test('\\\\ produces single backslash', () => {
    const result = quikdown('\\\\');
    expect(result).toContain('\\');
  });

  test('\\# not a heading', () => {
    const result = quikdown('\\# not heading');
    expect(result).not.toContain('<h1');
  });

  test('escapes in fenced code preserved literally', () => {
    const result = quikdown('```\n\\*text\\*\n```');
    expect(result).toContain('\\*text\\*');
  });

  test('escapes in inline code preserved literally', () => {
    const result = quikdown('`\\*text\\*`');
    expect(result).toContain('\\*text\\*');
  });

  test('non-escapable char — backslash kept', () => {
    const result = quikdown('\\a');
    expect(result).toContain('\\a');
  });

  test('mixed escaped and unescaped', () => {
    const result = quikdown('\\*literal\\* and *italic*');
    expect(result).not.toMatch(/<em[^>]*>\s*literal/);
    expect(result).toContain('<em');
    expect(result).toContain('italic');
  });
});

describe('inline code + backslash escape integration', () => {
  test('table cell with escaped backtick', () => {
    const input = '| A | B |\n|---|---|\n| \\` | val |';
    const result = quikdown(input);
    expect(result).toContain('<table');
    expect(result).toContain('`');
  });

  test('escaped backtick in paragraph near real code', () => {
    const result = quikdown('use \\` for escaping and `real code` here');
    const codeMatches = result.match(/<code/g) || [];
    expect(codeMatches.length).toBe(1);
    expect(result).toContain('real code');
    expect(result).toContain('`');
  });
});
