/**
 * Comprehensive Markdown Test Fixtures
 *
 * Each fixture has:
 * - name: Test description
 * - markdown: Input markdown string
 * - expected: Expected output (can be string or regex/function for flexible matching)
 * - options: Optional quikdown options
 * - notes: Optional notes about edge cases or expected behavior
 */

export const fixtures = {
    // ============================================
    // HEADINGS
    // ============================================
    headings: [
        {
            name: 'basic h1-h6',
            markdown: '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6',
            shouldContain: ['<h1', '<h2', '<h3', '<h4', '<h5', '<h6', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
        },
        {
            name: 'heading with trailing hashes',
            markdown: '# Heading ###',
            shouldContain: ['<h1', 'Heading'],
            shouldNotContain: ['###']
        },
        {
            name: 'heading without space after hash - should NOT be heading',
            markdown: '#NoSpace',
            expected: '<p>#NoSpace</p>',
            notes: 'CommonMark requires space after #'
        },
        {
            name: 'heading with many trailing hashes',
            markdown: '## Title ######',
            shouldContain: ['<h2', 'Title'],
            shouldNotContain: ['######']
        },
        {
            name: 'heading with inline formatting',
            markdown: '# **Bold** and *italic* heading',
            shouldContain: ['<h1', '<strong', 'Bold', '<em', 'italic']
        },
        {
            name: 'heading with code',
            markdown: '## Using `code` in heading',
            shouldContain: ['<h2', '<code', 'code']
        },
        {
            name: 'multiple # signs mid-word - not headings',
            markdown: 'C# is a language\n\nF## is not real',
            shouldContain: ['C#', 'F##'],
            shouldNotContain: ['<h1', '<h2']
        },
        {
            name: 'heading at end of document',
            markdown: 'Some text\n\n# Final Heading',
            shouldContain: ['<p>Some text</p>', '<h1', 'Final Heading']
        }
    ],

    // ============================================
    // TABLES
    // ============================================
    tables: [
        {
            name: 'basic table',
            markdown: '| Col1 | Col2 |\n|------|------|\n| A    | B    |',
            shouldContain: ['<table', '<thead', '<tbody', '<th', '<td', 'Col1', 'Col2', 'A', 'B']
        },
        {
            name: 'table with alignment',
            markdown: '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    | C      | R     |',
            shouldContain: ['<table', 'Left', 'Center', 'Right', 'L', 'C', 'R']
        },
        {
            name: 'table without outer pipes',
            markdown: 'Col1 | Col2\n-----|-----\nA    | B',
            shouldContain: ['<table', 'Col1', 'Col2', 'A', 'B'],
            notes: 'Pipes at start/end should be optional'
        },
        {
            name: 'table with only header (no body rows)',
            markdown: '| Header1 | Header2 |\n|---------|---------|',
            shouldContain: ['<table', '<thead', 'Header1', 'Header2'],
            notes: 'Valid table with just header row'
        },
        {
            name: 'table with many rows',
            markdown: '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |',
            shouldContain: ['<table', '1', '2', '3', '4', '5', '6']
        },
        {
            name: 'table with inline formatting in cells',
            markdown: '| Format | Example |\n|--------|----------|\n| Bold | **text** |\n| Italic | *text* |\n| Code | `code` |',
            shouldContain: ['<table', '<strong', '<em', '<code']
        },
        {
            name: 'table with links in cells',
            markdown: '| Site | URL |\n|------|-----|\n| Google | [Google](https://google.com) |',
            shouldContain: ['<table', '<a', 'href', 'google.com']
        },
        {
            name: 'table with uneven columns - extra cells',
            markdown: '| A | B |\n|---|---|\n| 1 | 2 | 3 |',
            shouldContain: ['<table', 'A', 'B', '1', '2'],
            notes: 'Extra cells might be ignored or handled gracefully'
        },
        {
            name: 'table with uneven columns - missing cells',
            markdown: '| A | B | C |\n|---|---|---|\n| 1 |',
            shouldContain: ['<table', 'A', 'B', 'C', '1'],
            notes: 'Missing cells should result in empty cells'
        },
        {
            name: 'table with escaped pipes',
            markdown: '| A | B |\n|---|---|\n| a\\|b | c |',
            shouldContain: ['<table'],
            notes: 'Escaped pipes should be treated as literal'
        },
        {
            name: 'table with empty cells',
            markdown: '| A | B |\n|---|---|\n|   |   |',
            shouldContain: ['<table', '<td']
        },
        {
            name: 'NOT a table - missing separator',
            markdown: '| A | B |\n| 1 | 2 |',
            shouldNotContain: ['<table'],
            notes: 'Without separator row, this is not a table'
        },
        {
            name: 'NOT a table - invalid separator',
            markdown: '| A | B |\n| x | y |\n| 1 | 2 |',
            shouldNotContain: ['<table'],
            notes: 'Separator must have dashes'
        },
        {
            name: 'table followed by paragraph',
            markdown: '| A | B |\n|---|---|\n| 1 | 2 |\n\nSome text after.',
            shouldContain: ['<table', '</table>', '<p>Some text after.</p>']
        },
        {
            name: 'paragraph followed by table',
            markdown: 'Some text before.\n\n| A | B |\n|---|---|\n| 1 | 2 |',
            shouldContain: ['<p>Some text before.</p>', '<table']
        },
        {
            name: 'table with single column',
            markdown: '| Only |\n|------|\n| one  |',
            shouldContain: ['<table', 'Only', 'one']
        },
        {
            name: 'table with wide separator',
            markdown: '| A | B |\n|----------|----------|\n| 1 | 2 |',
            shouldContain: ['<table', 'A', 'B', '1', '2']
        },
        {
            name: 'table with minimal separator',
            markdown: '| A | B |\n|-|-|\n| 1 | 2 |',
            shouldContain: ['<table', 'A', 'B', '1', '2'],
            notes: 'Single dash per column should work'
        }
    ],

    // ============================================
    // LINE BREAKS
    // ============================================
    lineBreaks: [
        {
            name: 'two trailing spaces creates br',
            markdown: 'Line 1  \nLine 2',
            shouldContain: ['<br', 'Line 1', 'Line 2'],
            notes: 'Standard markdown line break with two spaces'
        },
        {
            name: 'single newline - no br (strict)',
            markdown: 'Line 1\nLine 2',
            shouldNotContain: ['<br'],
            shouldContain: ['Line 1', 'Line 2'],
            notes: 'Single newlines should not create br by default'
        },
        {
            name: 'three trailing spaces - edge case',
            markdown: 'Line 1   \nLine 2',
            notes: 'Three spaces - behavior depends on implementation',
            shouldContain: ['Line 1', 'Line 2']
        },
        {
            name: 'one trailing space - no br',
            markdown: 'Line 1 \nLine 2',
            shouldNotContain: ['<br'],
            shouldContain: ['Line 1', 'Line 2']
        },
        {
            name: 'double newline creates paragraphs',
            markdown: 'Para 1\n\nPara 2',
            shouldContain: ['<p>Para 1</p>', '<p>Para 2</p>']
        },
        {
            name: 'multiple line breaks in sequence',
            markdown: 'Line 1  \nLine 2  \nLine 3',
            shouldContain: ['<br', 'Line 1', 'Line 2', 'Line 3'],
            notes: 'Multiple line breaks should all be converted'
        },
        {
            name: 'line break at end of paragraph before new paragraph',
            markdown: 'Para 1  \n\nPara 2',
            shouldContain: ['Para 1', 'Para 2'],
            notes: 'Trailing br before paragraph break'
        },
        {
            name: 'lazy linefeeds mode - single newline creates br',
            markdown: 'Line 1\nLine 2',
            options: { lazy_linefeeds: true },
            shouldContain: ['<br', 'Line 1', 'Line 2']
        },
        {
            name: 'lazy linefeeds - double newline still creates paragraphs',
            markdown: 'Para 1\n\nPara 2',
            options: { lazy_linefeeds: true },
            shouldContain: ['<p>', '</p>']
        },
        {
            name: 'lazy linefeeds - no br after block elements',
            markdown: '# Heading\nParagraph',
            options: { lazy_linefeeds: true },
            shouldContain: ['<h1', 'Heading', 'Paragraph'],
            notes: 'Single newline after heading should not create br'
        }
    ],

    // ============================================
    // CODE BLOCKS
    // ============================================
    codeBlocks: [
        {
            name: 'basic fenced code block',
            markdown: '```\ncode here\n```',
            shouldContain: ['<pre', '<code', 'code here']
        },
        {
            name: 'code block with language',
            markdown: '```javascript\nconst x = 1;\n```',
            shouldContain: ['<pre', '<code', 'language-javascript', 'const x = 1;']
        },
        {
            name: 'code block with tilde fence',
            markdown: '~~~\ncode here\n~~~',
            shouldContain: ['<pre', '<code', 'code here']
        },
        {
            name: 'code block with tilde fence and language',
            markdown: '~~~python\nprint("hello")\n~~~',
            shouldContain: ['<pre', '<code', 'language-python', 'print']
        },
        {
            name: 'code block preserves markdown syntax',
            markdown: '```\n**not bold** *not italic* [not a link](url)\n```',
            shouldContain: ['**not bold**', '*not italic*', '[not a link]'],
            shouldNotContain: ['<strong', '<em', '<a']
        },
        {
            name: 'code block escapes HTML',
            markdown: '```\n<script>alert("xss")</script>\n```',
            shouldContain: ['&lt;script&gt;', '&lt;/script&gt;'],
            shouldNotContain: ['<script>']
        },
        {
            name: 'code block with multiple lines',
            markdown: '```\nline 1\nline 2\nline 3\n```',
            shouldContain: ['line 1', 'line 2', 'line 3']
        },
        {
            name: 'code block with blank lines',
            markdown: '```\nline 1\n\nline 3\n```',
            shouldContain: ['line 1', 'line 3']
        },
        {
            name: 'multiple code blocks',
            markdown: '```\nfirst\n```\n\n```\nsecond\n```',
            shouldContain: ['first', 'second', '<pre']
        },
        {
            name: 'code block with special characters',
            markdown: '```\n$var = "value";\narray[0] = {key: "value"};\n```',
            shouldContain: ['$var', 'array[0]', '{key:']
        },
        {
            name: 'inline code basic',
            markdown: 'Use `npm install` to install',
            shouldContain: ['<code', 'npm install']
        },
        {
            name: 'inline code with special chars',
            markdown: 'The `<div>` element',
            shouldContain: ['<code', '&lt;div&gt;']
        },
        {
            name: 'multiple inline codes',
            markdown: 'Use `git add` then `git commit`',
            shouldContain: ['git add', 'git commit']
        },
        {
            name: 'inline code in heading',
            markdown: '## The `main()` function',
            shouldContain: ['<h2', '<code', 'main()']
        },
        {
            name: 'empty code block',
            markdown: '```\n```',
            shouldContain: ['<pre', '<code']
        },
        {
            name: 'code block with only whitespace',
            markdown: '```\n   \n```',
            shouldContain: ['<pre', '<code']
        }
    ],

    // ============================================
    // LISTS
    // ============================================
    lists: [
        {
            name: 'unordered list with dash',
            markdown: '- Item 1\n- Item 2\n- Item 3',
            shouldContain: ['<ul', '<li', 'Item 1', 'Item 2', 'Item 3']
        },
        {
            name: 'unordered list with asterisk',
            markdown: '* Item 1\n* Item 2',
            shouldContain: ['<ul', '<li', 'Item 1', 'Item 2']
        },
        {
            name: 'unordered list with plus',
            markdown: '+ Item 1\n+ Item 2',
            shouldContain: ['<ul', '<li', 'Item 1', 'Item 2']
        },
        {
            name: 'ordered list',
            markdown: '1. First\n2. Second\n3. Third',
            shouldContain: ['<ol', '<li', 'First', 'Second', 'Third']
        },
        {
            name: 'ordered list starting at different number',
            markdown: '5. Fifth\n6. Sixth',
            shouldContain: ['<ol', '<li', 'Fifth', 'Sixth'],
            notes: 'HTML ol might not preserve start number'
        },
        {
            name: 'nested unordered list',
            markdown: '- Parent\n  - Child 1\n  - Child 2\n- Another parent',
            shouldContain: ['<ul', '<li', 'Parent', 'Child 1', 'Child 2', 'Another parent']
        },
        {
            name: 'nested ordered list',
            markdown: '1. First\n  1. Sub first\n  2. Sub second\n2. Second',
            shouldContain: ['<ol', '<li', 'First', 'Sub first', 'Second']
        },
        {
            name: 'mixed nested lists',
            markdown: '- Unordered\n  1. Ordered child\n  2. Another\n- Back to unordered',
            shouldContain: ['<ul', '<ol', '<li']
        },
        {
            name: 'list with inline formatting',
            markdown: '- **Bold item**\n- *Italic item*\n- `Code item`',
            shouldContain: ['<ul', '<li', '<strong', '<em', '<code']
        },
        {
            name: 'list with links',
            markdown: '- [Link 1](url1)\n- [Link 2](url2)',
            shouldContain: ['<ul', '<li', '<a', 'href']
        },
        {
            name: 'task list unchecked',
            markdown: '- [ ] Todo item',
            shouldContain: ['<ul', '<li', '<input', 'checkbox'],
            shouldNotContain: ['checked']
        },
        {
            name: 'task list checked',
            markdown: '- [x] Done item',
            shouldContain: ['<ul', '<li', '<input', 'checkbox', 'checked']
        },
        {
            name: 'task list mixed',
            markdown: '- [ ] Todo\n- [x] Done\n- [ ] Another todo',
            shouldContain: ['<ul', 'checkbox']
        },
        {
            name: 'deeply nested list (3 levels)',
            markdown: '- Level 1\n  - Level 2\n    - Level 3',
            shouldContain: ['Level 1', 'Level 2', 'Level 3']
        },
        {
            name: 'list followed by paragraph',
            markdown: '- Item 1\n- Item 2\n\nParagraph after',
            shouldContain: ['<ul', '</ul>', '<p>Paragraph after</p>']
        },
        {
            name: 'paragraph followed by list',
            markdown: 'Paragraph before\n\n- Item 1\n- Item 2',
            shouldContain: ['<p>Paragraph before</p>', '<ul']
        },
        {
            name: 'single item list',
            markdown: '- Only one',
            shouldContain: ['<ul', '<li', 'Only one']
        },
        {
            name: 'list with empty item text',
            markdown: '- \n- Second',
            shouldContain: ['<ul', '<li', 'Second'],
            notes: 'Empty list items should be handled gracefully'
        }
    ],

    // ============================================
    // INLINE FORMATTING
    // ============================================
    inlineFormatting: [
        {
            name: 'bold with asterisks',
            markdown: '**bold text**',
            shouldContain: ['<strong', 'bold text', '</strong>']
        },
        {
            name: 'bold with underscores',
            markdown: '__bold text__',
            shouldContain: ['<strong', 'bold text']
        },
        {
            name: 'italic with asterisk',
            markdown: '*italic text*',
            shouldContain: ['<em', 'italic text', '</em>']
        },
        {
            name: 'italic with underscore',
            markdown: '_italic text_',
            shouldContain: ['<em', 'italic text']
        },
        {
            name: 'strikethrough',
            markdown: '~~strikethrough~~',
            shouldContain: ['<del', 'strikethrough', '</del>']
        },
        {
            name: 'bold and italic combined',
            markdown: '***bold and italic***',
            shouldContain: ['<strong', '<em'],
            notes: 'Order of tags may vary'
        },
        {
            name: 'nested bold in italic',
            markdown: '*italic **bold** italic*',
            shouldContain: ['<em', '<strong', 'bold', 'italic']
        },
        {
            name: 'nested italic in bold',
            markdown: '**bold *italic* bold**',
            shouldContain: ['<strong', '<em', 'bold', 'italic']
        },
        {
            name: 'strikethrough with bold',
            markdown: '~~**bold strikethrough**~~',
            shouldContain: ['<del', '<strong', 'bold strikethrough']
        },
        {
            name: 'multiple formatting in paragraph',
            markdown: 'This has **bold**, *italic*, and `code`.',
            shouldContain: ['<strong', '<em', '<code', 'bold', 'italic', 'code']
        },
        {
            name: 'unmatched asterisk - not formatting',
            markdown: 'This is not *italic',
            shouldContain: ['not *italic'],
            shouldNotContain: ['<em']
        },
        {
            name: 'asterisk in middle of word',
            markdown: 'file*name*here',
            notes: 'Mid-word asterisks behavior varies by implementation'
        },
        {
            name: 'underscore in middle of word',
            markdown: 'file_name_here',
            notes: 'Mid-word underscores often should not format'
        },
        {
            name: 'empty bold',
            markdown: '****',
            notes: 'Empty formatting markers'
        },
        {
            name: 'bold across lines - should not work',
            markdown: '**bold\nstill bold**',
            notes: 'Inline formatting should not span lines'
        },
        {
            name: 'multiple words bold',
            markdown: '**multiple bold words here**',
            shouldContain: ['<strong', 'multiple bold words here']
        },
        {
            name: 'formatting at start of line',
            markdown: '**Bold start** and normal',
            shouldContain: ['<strong', 'Bold start']
        },
        {
            name: 'formatting at end of line',
            markdown: 'Normal and **bold end**',
            shouldContain: ['<strong', 'bold end']
        }
    ],

    // ============================================
    // LINKS AND IMAGES
    // ============================================
    linksAndImages: [
        {
            name: 'basic link',
            markdown: '[text](https://example.com)',
            shouldContain: ['<a', 'href="https://example.com"', 'text', '</a>']
        },
        {
            name: 'link with relative url',
            markdown: '[local](/page)',
            shouldContain: ['<a', 'href="/page"', 'local']
        },
        {
            name: 'link with special characters in text',
            markdown: '[Click & Go!](url)',
            shouldContain: ['<a', 'Click', 'Go']
        },
        {
            name: 'link with formatting in text',
            markdown: '[**Bold link**](url)',
            shouldContain: ['<a', '<strong', 'Bold link']
        },
        {
            name: 'multiple links',
            markdown: '[First](url1) and [Second](url2)',
            shouldContain: ['<a', 'First', 'Second', 'url1', 'url2']
        },
        {
            name: 'autolink http',
            markdown: 'Visit https://example.com today',
            shouldContain: ['<a', 'https://example.com']
        },
        {
            name: 'autolink in sentence',
            markdown: 'Check out https://example.com/path?query=1 for more',
            shouldContain: ['<a', 'https://example.com/path?query=1']
        },
        {
            name: 'basic image',
            markdown: '![alt text](image.jpg)',
            shouldContain: ['<img', 'src="image.jpg"', 'alt="alt text"']
        },
        {
            name: 'image with empty alt',
            markdown: '![](image.jpg)',
            shouldContain: ['<img', 'src="image.jpg"', 'alt=""']
        },
        {
            name: 'image with url',
            markdown: '![Logo](https://example.com/logo.png)',
            shouldContain: ['<img', 'https://example.com/logo.png']
        },
        {
            name: 'javascript url blocked',
            markdown: '[click](javascript:alert(1))',
            shouldContain: ['<a', 'href="#"'],
            shouldNotContain: ['javascript:']
        },
        {
            name: 'data url blocked (non-image)',
            markdown: '[click](data:text/html,<script>)',
            shouldContain: ['<a', 'href="#"'],
            shouldNotContain: ['data:text']
        },
        {
            name: 'data:image url allowed',
            markdown: '![img](data:image/png;base64,abc)',
            shouldContain: ['<img', 'data:image/png']
        },
        {
            name: 'link and image together',
            markdown: '[![alt](img.jpg)](url)',
            notes: 'Image inside link - clickable image'
        },
        {
            name: 'link with parentheses in url',
            markdown: '[Wiki](https://en.wikipedia.org/wiki/Markdown_(markup))',
            notes: 'Parentheses in URL are tricky to parse'
        },
        {
            name: 'link at end of sentence',
            markdown: 'Visit [our site](https://example.com).',
            shouldContain: ['<a', 'our site', 'example.com']
        },
        {
            name: 'consecutive links',
            markdown: '[A](a)[B](b)[C](c)',
            shouldContain: ['<a', 'A', 'B', 'C']
        }
    ],

    // ============================================
    // BLOCKQUOTES
    // ============================================
    blockquotes: [
        {
            name: 'basic blockquote',
            markdown: '> This is a quote',
            shouldContain: ['<blockquote', 'This is a quote', '</blockquote>']
        },
        {
            name: 'multi-line blockquote',
            markdown: '> Line 1\n> Line 2',
            shouldContain: ['<blockquote', 'Line 1', 'Line 2']
        },
        {
            name: 'blockquote with formatting',
            markdown: '> **Bold** and *italic* in quote',
            shouldContain: ['<blockquote', '<strong', '<em']
        },
        {
            name: 'blockquote with code',
            markdown: '> Use `code` in quote',
            shouldContain: ['<blockquote', '<code', 'code']
        },
        {
            name: 'multiple separate blockquotes',
            markdown: '> Quote 1\n\n> Quote 2',
            shouldContain: ['<blockquote', 'Quote 1', 'Quote 2'],
            notes: 'Separated by blank line should be two blockquotes'
        },
        {
            name: 'blockquote followed by paragraph',
            markdown: '> Quote here\n\nNormal paragraph',
            shouldContain: ['<blockquote', '</blockquote>', '<p>Normal paragraph</p>']
        },
        {
            name: 'paragraph followed by blockquote',
            markdown: 'Normal paragraph\n\n> Quote here',
            shouldContain: ['<p>Normal paragraph</p>', '<blockquote']
        },
        {
            name: 'empty blockquote marker',
            markdown: '>\n> Text',
            shouldContain: ['<blockquote', 'Text']
        },
        {
            name: 'nested blockquote',
            markdown: '> Level 1\n> > Level 2',
            notes: 'Nested blockquotes may or may not be supported'
        },
        {
            name: 'blockquote with link',
            markdown: '> Check [this](url) out',
            shouldContain: ['<blockquote', '<a', 'this']
        }
    ],

    // ============================================
    // HORIZONTAL RULES
    // ============================================
    horizontalRules: [
        {
            name: 'three dashes',
            markdown: '---',
            shouldContain: ['<hr']
        },
        {
            name: 'many dashes',
            markdown: '----------',
            shouldContain: ['<hr']
        },
        {
            name: 'dashes with trailing space',
            markdown: '--- ',
            shouldContain: ['<hr']
        },
        {
            name: 'between paragraphs',
            markdown: 'Above\n\n---\n\nBelow',
            shouldContain: ['Above', '<hr', 'Below'],
            notes: 'HR extraction from paragraph context - current behavior may vary'
        },
        {
            name: 'NOT a rule - only two dashes',
            markdown: '--',
            shouldNotContain: ['<hr'],
            shouldContain: ['--']
        },
        {
            name: 'NOT a rule - dashes with text',
            markdown: '--- text',
            shouldNotContain: ['<hr']
        },
        {
            name: 'multiple horizontal rules',
            markdown: '---\n\n---\n\n---',
            shouldContain: ['<hr']
        }
    ],

    // ============================================
    // COMPLEX COMBINATIONS
    // ============================================
    complexCombinations: [
        {
            name: 'heading followed by list',
            markdown: '# Title\n\n- Item 1\n- Item 2',
            shouldContain: ['<h1', 'Title', '<ul', '<li', 'Item 1']
        },
        {
            name: 'list followed by code block',
            markdown: '- Item\n\n```\ncode\n```',
            shouldContain: ['<ul', '<li', 'Item', '<pre', '<code', 'code']
        },
        {
            name: 'table followed by list',
            markdown: '| A | B |\n|---|---|\n| 1 | 2 |\n\n- Item',
            shouldContain: ['<table', '<ul', '<li']
        },
        {
            name: 'blockquote with list inside',
            markdown: '> Before list:\n> - Item 1\n> - Item 2',
            notes: 'Lists inside blockquotes may not be supported'
        },
        {
            name: 'all elements combined',
            markdown: `# Heading

Paragraph with **bold** and *italic*.

- List item 1
- List item 2

| Col1 | Col2 |
|------|------|
| A    | B    |

> Quote here

\`\`\`
code block
\`\`\`

---

Final paragraph.`,
            shouldContain: ['<h1', '<strong', '<em', '<ul', '<table', '<blockquote', '<pre', '<hr', '<p>']
        },
        {
            name: 'nested formatting in list in table',
            markdown: '| List |\n|------|\n| - **bold** item |',
            notes: 'Lists inside table cells - may not be supported'
        },
        {
            name: 'code block between paragraphs',
            markdown: 'Before\n\n```\ncode\n```\n\nAfter',
            shouldContain: ['<p>Before</p>', '<pre', '<p>After</p>']
        },
        {
            name: 'inline code next to formatting',
            markdown: '**bold** `code` *italic*',
            shouldContain: ['<strong', 'bold', '<code', 'code', '<em', 'italic']
        },
        {
            name: 'link in heading',
            markdown: '# [Title Link](url)',
            shouldContain: ['<h1', '<a', 'Title Link', 'url']
        },
        {
            name: 'image in paragraph',
            markdown: 'Text before ![alt](img.jpg) text after.',
            shouldContain: ['<p', 'Text before', '<img', 'text after']
        }
    ],

    // ============================================
    // EDGE CASES AND POTENTIAL ISSUES
    // ============================================
    edgeCases: [
        {
            name: 'empty input',
            markdown: '',
            expected: ''
        },
        {
            name: 'only whitespace',
            markdown: '   \n   \n   ',
            notes: 'Only whitespace input'
        },
        {
            name: 'only newlines',
            markdown: '\n\n\n',
            notes: 'Only newlines'
        },
        {
            name: 'very long line',
            markdown: 'a'.repeat(1000),
            shouldContain: ['<p', 'a']
        },
        {
            name: 'special characters not markdown',
            markdown: 'Hello! @#$%^&(){}[]|\\:";\'<>,.?/',
            shouldContain: ['Hello']
        },
        {
            name: 'Unicode text',
            markdown: '# 你好世界\n\n日本語テキスト\n\n🎉 emoji!',
            shouldContain: ['<h1', '你好世界', '日本語テキスト', '🎉']
        },
        {
            name: 'mixed line endings',
            markdown: 'Line 1\r\nLine 2\nLine 3\rLine 4',
            notes: 'Different line ending styles'
        },
        {
            name: 'tab characters',
            markdown: '# Heading\n\n\tIndented with tab',
            shouldContain: ['<h1', 'Heading']
        },
        {
            name: 'null bytes',
            markdown: 'Text with \0 null byte',
            notes: 'Null bytes should be handled'
        },
        {
            name: 'unclosed formatting at EOF',
            markdown: '**unclosed bold',
            shouldContain: ['**unclosed bold'],
            shouldNotContain: ['<strong']
        },
        {
            name: 'unclosed code block at EOF',
            markdown: '```\nunclosed code',
            notes: 'Unclosed fence at end of file'
        },
        {
            name: 'mismatched fences',
            markdown: '```\ncode\n~~~',
            notes: 'Different opening and closing fences'
        },
        {
            name: 'backslash escapes',
            markdown: '\\*not italic\\* \\**not bold\\**',
            notes: 'Backslash escapes for literal characters'
        },
        {
            name: 'HTML entities in text',
            markdown: '&amp; &lt; &gt; already escaped',
            shouldContain: ['&amp;amp;'],
            notes: 'Already-escaped entities get double-escaped'
        },
        {
            name: 'multiple blank lines',
            markdown: 'Para 1\n\n\n\n\nPara 2',
            shouldContain: ['<p>Para 1</p>', '<p>Para 2</p>']
        },
        {
            name: 'leading whitespace in paragraph',
            markdown: '   Leading spaces',
            shouldContain: ['Leading spaces']
        },
        {
            name: 'trailing whitespace in paragraph',
            markdown: 'Trailing spaces   ',
            shouldContain: ['Trailing spaces']
        },
        {
            name: 'only a heading',
            markdown: '# Just a heading',
            shouldContain: ['<h1', 'Just a heading']
        },
        {
            name: 'only a list',
            markdown: '- Only a list',
            shouldContain: ['<ul', '<li', 'Only a list']
        },
        {
            name: 'script tag in text (XSS test)',
            markdown: '<script>alert("xss")</script>',
            shouldContain: ['&lt;script&gt;'],
            shouldNotContain: ['<script>']
        },
        {
            name: 'onerror attribute (XSS test)',
            markdown: '<img onerror="alert(1)" src=x>',
            shouldContain: ['&lt;img'],
            shouldNotContain: ['<img '],
            notes: 'Raw HTML is escaped - onerror becomes harmless text'
        },
        {
            name: 'iframe tag (XSS test)',
            markdown: '<iframe src="evil.com"></iframe>',
            shouldContain: ['&lt;iframe'],
            shouldNotContain: ['<iframe']
        }
    ],

    // ============================================
    // STRICTNESS AND FORGIVENESS TESTS
    // ============================================
    strictness: [
        {
            name: 'strict: exactly 2 spaces for line break',
            markdown: 'Line 1  \nLine 2',
            shouldContain: ['<br'],
            notes: 'Current behavior: exactly 2 trailing spaces required'
        },
        {
            name: 'forgiveness: 3+ spaces should also work',
            markdown: 'Line 1   \nLine 2',
            shouldContain: ['<br'],
            notes: 'Would be more forgiving to allow 2+ spaces'
        },
        {
            name: 'strict: space required after heading #',
            markdown: '#heading\n# heading',
            shouldNotContain: ['<h1>#heading'],
            notes: 'First should not be heading, second should'
        },
        {
            name: 'strict: table needs proper separator',
            markdown: '| A | B |\n| C | D |',
            shouldNotContain: ['<table'],
            notes: 'Without separator row, not recognized as table'
        },
        {
            name: 'forgiveness: table with loose separator formatting',
            markdown: '| A | B |\n| --- | --- |\n| 1 | 2 |',
            shouldContain: ['<table'],
            notes: 'Various separator formats should work'
        },
        {
            name: 'forgiveness: table with no outer pipes',
            markdown: 'A | B\n---|---\n1 | 2',
            shouldContain: ['<table'],
            notes: 'Pipes at start/end should be optional'
        },
        {
            name: 'strict: code fence must close with same marker',
            markdown: '```\ncode\n~~~',
            shouldNotContain: ['</code>'],
            notes: 'Mismatched fences - code block not closed properly'
        },
        {
            name: 'forgiveness: list with varying indentation',
            markdown: '- Item\n - Sub (1 space)\n  - Sub (2 spaces)',
            shouldContain: ['<ul', '<li'],
            notes: 'Various indentation levels for nesting'
        },
        {
            name: 'forgiveness: ordered list non-sequential numbers',
            markdown: '1. First\n5. Still second\n3. Still third',
            shouldContain: ['<ol', 'First', 'Still second', 'Still third']
        },
        {
            name: 'strict: blockquote needs space after >',
            markdown: '>no space\n> with space',
            notes: 'First might not be recognized as blockquote'
        },
        {
            name: 'forgiveness: link with spaces around url',
            markdown: '[text]( url )',
            shouldContain: ['<a'],
            notes: 'Spaces inside parentheses should be trimmed'
        },
        {
            name: 'strict: inline code single backtick',
            markdown: '`code`',
            shouldContain: ['<code', 'code']
        },
        {
            name: 'forgiveness: Windows line endings (CRLF)',
            markdown: 'Line 1\r\nLine 2\r\n\r\nPara 2',
            shouldContain: ['Line 1', 'Line 2', 'Para 2'],
            notes: 'Should handle CRLF gracefully'
        },
        {
            name: 'forgiveness: mixed line endings',
            markdown: 'Line 1\nLine 2\r\nLine 3\rLine 4',
            shouldContain: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
            notes: 'Mix of LF, CRLF, CR should work'
        },
        {
            name: 'forgiveness: extra blank lines between elements',
            markdown: '# Heading\n\n\n\nParagraph',
            shouldContain: ['<h1', 'Heading', '<p', 'Paragraph']
        },
        {
            name: 'forgiveness: trailing newlines at EOF',
            markdown: 'Text\n\n\n',
            shouldContain: ['Text']
        },
        {
            name: 'forgiveness: leading whitespace on lines',
            markdown: '  Indented text\n  More indented',
            shouldContain: ['Indented text', 'More indented']
        }
    ],

    // ============================================
    // BIDIRECTIONAL MODE TESTS
    // ============================================
    bidirectional: [
        {
            name: 'bidirectional: adds data-qd attributes',
            markdown: '# Heading',
            options: { bidirectional: true },
            shouldContain: ['data-qd']
        },
        {
            name: 'bidirectional: bold has data-qd',
            markdown: '**bold**',
            options: { bidirectional: true },
            shouldContain: ['<strong', 'data-qd']
        },
        {
            name: 'bidirectional: code block has data-qd',
            markdown: '```js\ncode\n```',
            options: { bidirectional: true },
            shouldContain: ['<pre', 'data-qd']
        }
    ],

    // ============================================
    // INLINE STYLES MODE
    // ============================================
    inlineStyles: [
        {
            name: 'paragraph with inline styles',
            markdown: 'Text',
            options: { inline_styles: true },
            shouldContain: ['<p>', 'Text'],
            shouldNotContain: ['class=']
        },
        {
            name: 'heading with inline styles',
            markdown: '# Heading',
            options: { inline_styles: true },
            shouldContain: ['<h1', 'style=', 'Heading'],
            shouldNotContain: ['class=']
        },
        {
            name: 'bold with inline styles',
            markdown: '**bold**',
            options: { inline_styles: true },
            shouldContain: ['<strong', 'style=', 'bold']
        },
        {
            name: 'table with inline styles',
            markdown: '| A | B |\n|---|---|\n| 1 | 2 |',
            options: { inline_styles: true },
            shouldContain: ['<table', 'style=']
        }
    ]
};

// Helper to run a single fixture test
export function runFixture(quikdown, fixture) {
    const result = quikdown(fixture.markdown, fixture.options || {});
    const errors = [];

    // Check exact match if expected is provided
    if (fixture.expected !== undefined) {
        if (result !== fixture.expected) {
            errors.push(`Expected exact match.\nExpected: ${fixture.expected}\nGot: ${result}`);
        }
    }

    // Check shouldContain
    if (fixture.shouldContain) {
        for (const text of fixture.shouldContain) {
            if (!result.includes(text)) {
                errors.push(`Should contain "${text}" but doesn't.\nResult: ${result}`);
            }
        }
    }

    // Check shouldNotContain
    if (fixture.shouldNotContain) {
        for (const text of fixture.shouldNotContain) {
            if (result.includes(text)) {
                errors.push(`Should NOT contain "${text}" but does.\nResult: ${result}`);
            }
        }
    }

    return {
        name: fixture.name,
        passed: errors.length === 0,
        errors,
        result,
        notes: fixture.notes
    };
}

// Get all fixtures as a flat array with category info
export function getAllFixtures() {
    const all = [];
    for (const [category, tests] of Object.entries(fixtures)) {
        for (const fixture of tests) {
            all.push({ ...fixture, category });
        }
    }
    return all;
}
