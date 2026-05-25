/**
 * Parser gap fixes: link titles, indented code, ragged tables,
 * heading slugs, nested blockquotes, autolink punctuation,
 * table column normalization, blockquote lazy continuation,
 * GFM alert blocks.
 */
import quikdown from '../dist/quikdown.esm.js';
import quikdown_ast from '../dist/quikdown_ast.esm.js';
import quikdown_ast_html from '../dist/quikdown_ast_html.esm.js';

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

// ════════════════════════════════════════════════════════════════════
//  Fix 1: Autolink trailing punctuation
// ════════════════════════════════════════════════════════════════════

describe('autolink trailing punctuation', () => {
    test('trailing period stripped from URL', () => {
        const html = quikdown('Visit https://example.com.');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('>https://example.com</a>.');
    });

    test('trailing comma stripped', () => {
        const html = quikdown('See https://example.com, then continue');
        expect(html).toContain('href="https://example.com"');
        expect(html).toMatch(/<\/a>,/);
    });

    test('trailing semicolon stripped', () => {
        const html = quikdown('Link https://example.com;');
        expect(html).toContain('href="https://example.com"');
    });

    test('trailing colon stripped', () => {
        const html = quikdown('Go to https://example.com:');
        expect(html).toContain('href="https://example.com"');
    });

    test('trailing exclamation stripped', () => {
        const html = quikdown('Wow https://example.com!');
        expect(html).toContain('href="https://example.com"');
    });

    test('trailing question mark stripped', () => {
        const html = quikdown('Is it https://example.com?');
        expect(html).toContain('href="https://example.com"');
    });

    test('multiple trailing chars stripped', () => {
        const html = quikdown('https://example.com...');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('>https://example.com</a>...');
    });

    test('trailing slash NOT stripped', () => {
        const html = quikdown('https://example.com/');
        expect(html).toContain('href="https://example.com/"');
    });

    test('trailing hash NOT stripped', () => {
        const html = quikdown('https://example.com/page#section');
        expect(html).toContain('href="https://example.com/page#section"');
    });

    test('trailing = and & NOT stripped', () => {
        const html = quikdown('https://example.com?q=1&b=2');
        expect(html).toContain('href="https://example.com?q=1&amp;b=2"');
    });

    test('balanced parens in Wikipedia URL preserved', () => {
        const html = quikdown('https://en.wikipedia.org/wiki/Foo_(bar)');
        expect(html).toContain('href="https://en.wikipedia.org/wiki/Foo_(bar)"');
    });

    test('unbalanced trailing paren stripped', () => {
        const html = quikdown('(see https://example.com)');
        expect(html).toContain('href="https://example.com"');
        expect(html).toMatch(/<\/a>\)/);
    });

    test('query string + trailing period', () => {
        const html = quikdown('https://example.com?q=hello.');
        expect(html).toContain('href="https://example.com?q=hello"');
    });

    test('clean URL unchanged', () => {
        const html = quikdown('https://example.com/path');
        expect(html).toContain('href="https://example.com/path"');
    });

    test('AST parser also strips trailing punctuation', () => {
        const ast = quikdown_ast('Visit https://example.com.');
        const links = findNodes(ast, 'link');
        expect(links.length).toBe(1);
        expect(links[0].url).toBe('https://example.com');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Fix 3: Table column count normalization
// ════════════════════════════════════════════════════════════════════

describe('table column count normalization', () => {
    test('short body row padded with empty cells', () => {
        const md = '| A | B | C |\n|---|---|---|\n| 1 |';
        const html = quikdown(md);
        const tdCount = (html.match(/<td/g) || []).length;
        expect(tdCount).toBe(3);
    });

    test('long body row trimmed to header count', () => {
        const md = '| A | B |\n|---|---|\n| 1 | 2 | 3 | 4 |';
        const html = quikdown(md);
        const tdCount = (html.match(/<td/g) || []).length;
        expect(tdCount).toBe(2);
    });

    test('alignment preserved on padded cells', () => {
        const md = '| A | B | C |\n|:---|:---:|---:|\n| 1 |';
        const html = quikdown(md);
        // Third column should still have right alignment
        expect(html).toContain('text-align:right');
    });

    test('equal column counts unchanged', () => {
        const md = '| A | B |\n|---|---|\n| 1 | 2 |';
        const html = quikdown(md);
        const thCount = (html.match(/<th[\s>]/g) || []).length;
        const tdCount = (html.match(/<td[\s>]/g) || []).length;
        expect(thCount).toBe(2);
        expect(tdCount).toBe(2);
    });

    test('AST parser normalizes columns', () => {
        const ast = quikdown_ast('| A | B | C |\n|---|---|---|\n| 1 |');
        const table = findNodes(ast, 'table')[0];
        expect(table.rows[0].length).toBe(3);
    });

    test('AST HTML renderer normalizes columns', () => {
        const ast = {
            type: 'table',
            headers: [[{ type: 'text', value: 'A' }]],
            rows: [[[{ type: 'text', value: '1' }]]],
            alignments: ['left', 'left', 'left']
        };
        const html = quikdown_ast_html({ type: 'document', children: [ast] });
        const thCount = (html.match(/<th[\s>]/g) || []).length;
        const tdCount = (html.match(/<td[\s>]/g) || []).length;
        expect(thCount).toBe(3);
        expect(tdCount).toBe(3);
    });

    test('no-separator table normalizes to header count', () => {
        const md = '| A | B | C |\n| 1 |';
        const html = quikdown(md);
        const tdCount = (html.match(/<td/g) || []).length;
        expect(tdCount).toBe(3);
    });
});

// ════════════════════════════════════════════════════════════════════
//  Fix 2: Blockquote lazy continuation
// ════════════════════════════════════════════════════════════════════

describe('blockquote lazy continuation', () => {
    test('continuation line included in blockquote', () => {
        const html = quikdown('> line 1\nline 2');
        expect(html.match(/<blockquote/g).length).toBe(1);
        expect(html).toContain('line 1');
        expect(html).toContain('line 2');
    });

    test('blank line ends blockquote', () => {
        const html = quikdown('> line 1\n\nline 2');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<p>line 2</p>');
    });

    test('heading breaks lazy continuation', () => {
        const html = quikdown('> quote\n# Heading');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<h1');
    });

    test('list item breaks lazy continuation', () => {
        const html = quikdown('> quote\n- item');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<li');
    });

    test('HR breaks lazy continuation', () => {
        const html = quikdown('> quote\n---');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<hr');
    });

    test('table row breaks lazy continuation', () => {
        const html = quikdown('> quote\n| A | B |');
        expect(html).toContain('<blockquote');
        // The | line should not be inside blockquote
        expect(html).not.toMatch(/<blockquote[^>]*>[^<]*A \| B/);
    });

    test('code block placeholder breaks lazy continuation', () => {
        const html = quikdown('> quote\n```\ncode\n```');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<pre');
    });

    test('multiple continuation lines', () => {
        const html = quikdown('> start\ncont1\ncont2');
        expect(html.match(/<blockquote/g).length).toBe(1);
        expect(html).toContain('cont1');
        expect(html).toContain('cont2');
    });

    test('lazy after explicit > lines', () => {
        const html = quikdown('> line a\n> line b\nlazy c');
        expect(html.match(/<blockquote/g).length).toBe(1);
        expect(html).toContain('lazy c');
    });

    test('all lines in single blockquote', () => {
        const html = quikdown('> start\ncontinuation');
        const bqCount = (html.match(/<blockquote/g) || []).length;
        expect(bqCount).toBe(1);
    });

    test('AST parser supports lazy continuation', () => {
        const ast = quikdown_ast('> line 1\nline 2');
        const bqs = findNodes(ast, 'blockquote');
        expect(bqs.length).toBe(1);
        // Should contain text from both lines
        const text = JSON.stringify(bqs[0]);
        expect(text).toContain('line 1');
        expect(text).toContain('line 2');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Fix 4: GFM alert blocks
// ════════════════════════════════════════════════════════════════════

describe('GFM alert blocks', () => {
    test('[!NOTE] renders as alert', () => {
        const html = quikdown('> [!NOTE]\n> This is a note');
        expect(html).toContain('Note');
        expect(html).toContain('This is a note');
        expect(html).not.toContain('[!NOTE]');
    });

    test('[!TIP] renders as alert', () => {
        const html = quikdown('> [!TIP]\n> A helpful tip');
        expect(html).toContain('Tip');
        expect(html).toContain('A helpful tip');
    });

    test('[!IMPORTANT] renders as alert', () => {
        const html = quikdown('> [!IMPORTANT]\n> Critical info');
        expect(html).toContain('Important');
    });

    test('[!WARNING] renders as alert', () => {
        const html = quikdown('> [!WARNING]\n> Be careful');
        expect(html).toContain('Warning');
    });

    test('[!CAUTION] renders as alert', () => {
        const html = quikdown('> [!CAUTION]\n> Danger ahead');
        expect(html).toContain('Caution');
    });

    test('inline_styles mode renders alert with styles', () => {
        const html = quikdown('> [!NOTE]\n> styled note', { inline_styles: true });
        expect(html).toContain('style=');
        expect(html).toContain('border-left');
        expect(html).toContain('Note');
    });

    test('class mode renders alert with classes', () => {
        const html = quikdown('> [!WARNING]\n> classy warning');
        expect(html).toContain('quikdown-alert');
        expect(html).toContain('quikdown-alert-warning');
        expect(html).toContain('quikdown-alert-title');
    });

    test('case insensitive type', () => {
        const html = quikdown('> [!note]\n> lowercase');
        expect(html).toContain('Note');
        expect(html).not.toContain('[!note]');
    });

    test('regular blockquote unchanged', () => {
        const html = quikdown('> just a quote');
        expect(html).toContain('<blockquote');
        expect(html).not.toContain('alert');
    });

    test('multi-line alert content', () => {
        const html = quikdown('> [!NOTE]\n> line 1\n> line 2');
        expect(html).toContain('line 1');
        expect(html).toContain('line 2');
        expect(html).toContain('Note');
    });

    test('alert followed by paragraph', () => {
        const html = quikdown('> [!TIP]\n> tip text\n\nParagraph after');
        expect(html).toContain('Tip');
        expect(html).toContain('Paragraph after');
    });

    test('emitStyles() includes alert CSS', () => {
        const css = quikdown.emitStyles();
        expect(css).toContain('quikdown-alert');
        expect(css).toContain('quikdown-alert-title');
        expect(css).toContain('quikdown-alert-note');
        expect(css).toContain('quikdown-alert-tip');
        expect(css).toContain('quikdown-alert-important');
        expect(css).toContain('quikdown-alert-warning');
        expect(css).toContain('quikdown-alert-caution');
    });

    test('dark theme CSS includes alert overrides', () => {
        const css = quikdown.emitStyles('quikdown-', 'dark');
        expect(css).toContain('quikdown-alert');
        // Dark theme should have different background colors
        expect(css).toContain('#162d50');
        expect(css).toContain('#16351d');
    });

    test('invalid alert type renders as normal blockquote', () => {
        const html = quikdown('> [!INVALID]\n> text');
        expect(html).toContain('<blockquote');
        expect(html).toContain('[!INVALID]');
    });

    test('[!NOTE] not on first line renders as normal blockquote', () => {
        const html = quikdown('> first line\n> [!NOTE]\n> text');
        expect(html).toContain('<blockquote');
        expect(html).toContain('[!NOTE]');
    });

    test('alert with lazy continuation', () => {
        const html = quikdown('> [!NOTE]\n> note text\nlazy line');
        expect(html).toContain('Note');
        expect(html).toContain('lazy line');
    });

    test('AST parser produces alert node', () => {
        const ast = quikdown_ast('> [!NOTE]\n> Some note text');
        const alerts = findNodes(ast, 'alert');
        expect(alerts.length).toBe(1);
        expect(alerts[0].alertType).toBe('note');
    });

    test('AST HTML renders alert node', () => {
        const html = quikdown_ast_html('> [!WARNING]\n> Be careful');
        expect(html).toContain('Warning');
        expect(html).toContain('quikdown-alert');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Coverage boost: specific branch coverage
// ════════════════════════════════════════════════════════════════════

describe('lazy continuation breaker coverage', () => {
    test('ordered list breaks lazy continuation', () => {
        const html = quikdown('> quote\n1. item');
        expect(html).toContain('<blockquote');
        expect(html).toContain('<li');
    });

    test('new blockquote (&gt;) breaks lazy continuation', () => {
        const html = quikdown('> first quote\n\n> second quote');
        const bqCount = (html.match(/<blockquote/g) || []).length;
        expect(bqCount).toBe(2);
    });
});

describe('alert inline_styles coverage', () => {
    test('all 5 alert types with inline_styles', () => {
        const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
        for (const t of types) {
            const html = quikdown(`> [!${t}]\n> content`, { inline_styles: true });
            expect(html).toContain('style=');
            expect(html).not.toContain(`[!${t}]`);
        }
    });

    test('CAUTION inline_styles has red border-left-color', () => {
        const html = quikdown('> [!CAUTION]\n> danger', { inline_styles: true });
        expect(html).toContain('#cf222e');
    });

    test('TIP inline_styles has green border-left-color', () => {
        const html = quikdown('> [!TIP]\n> tip', { inline_styles: true });
        expect(html).toContain('#1a7f37');
    });

    test('nested blockquote inside alert', () => {
        const html = quikdown('> [!NOTE]\n>> nested inside');
        expect(html).toContain('Note');
        expect(html).toContain('nested inside');
    });
});

describe('autolink balanced parens coverage', () => {
    test('URL with balanced parens followed by period', () => {
        const html = quikdown('https://en.wikipedia.org/wiki/Foo_(bar).');
        expect(html).toContain('href="https://en.wikipedia.org/wiki/Foo_(bar)"');
        expect(html).toContain('>https://en.wikipedia.org/wiki/Foo_(bar)</a>.');
    });
});

// ── Helper: recursively find AST nodes by type ──
function findNodes(node, type) {
    const results = [];
    if (!node) return results;
    if (node.type === type) results.push(node);
    if (node.children) {
        const children = Array.isArray(node.children) ? node.children : [node.children];
        for (const child of children) {
            results.push(...findNodes(child, type));
        }
    }
    if (node.items) {
        for (const item of node.items) {
            results.push(...findNodes(item, type));
        }
    }
    return results;
}
