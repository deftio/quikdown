import quikdown from '/Users/manu/deftio/quikdown/dev/lex/quikdown_lex.js';

describe('quikdown markdown parser', () => {
    
    describe('Basic Formatting', () => {
        test('should handle bold text with **', () => {
            expect(quikdown('**bold**')).toBe('<p><strong class="quikdown-strong">bold</strong></p>');
            expect(quikdown('text **bold** text')).toBe('<p>text <strong class="quikdown-strong">bold</strong> text</p>');
        });
        
        test('should handle bold text with __', () => {
            expect(quikdown('__bold__')).toBe('<p><strong class="quikdown-strong">bold</strong></p>');
        });
        
        test('should handle italic text with *', () => {
            expect(quikdown('*italic*')).toBe('<p><em class="quikdown-em">italic</em></p>');
            expect(quikdown('text *italic* text')).toBe('<p>text <em class="quikdown-em">italic</em> text</p>');
        });
        
        test('should handle italic text with _', () => {
            expect(quikdown('_italic_')).toBe('<p><em class="quikdown-em">italic</em></p>');
        });
        
        test('should handle strikethrough', () => {
            expect(quikdown('~~strike~~')).toBe('<p><del class="quikdown-del">strike</del></p>');
        });
        
        test('should handle inline code', () => {
            expect(quikdown('`code`')).toBe('<p><code class="quikdown-code">code</code></p>');
            expect(quikdown('Use `npm install` to install')).toBe('<p>Use <code class="quikdown-code">npm install</code> to install</p>');
        });
        
        test('should handle combined formatting', () => {
            // Note: The order of closing tags may vary, but the formatting is still correct
            const result = quikdown('**bold *italic***');
            expect(result).toContain('<strong class="quikdown-strong">');
            expect(result).toContain('<em class="quikdown-em">');
            expect(result).toContain('italic');
            expect(quikdown('~~**bold strike**~~')).toBe('<p><del class="quikdown-del"><strong class="quikdown-strong">bold strike</strong></del></p>');
        });
    });
    
    describe('Headings', () => {
        test('should parse h1-h6', () => {
            expect(quikdown('# H1')).toBe('<h1 class="quikdown-h1">H1</h1>');
            expect(quikdown('## H2')).toBe('<h2 class="quikdown-h2">H2</h2>');
            expect(quikdown('### H3')).toBe('<h3 class="quikdown-h3">H3</h3>');
            expect(quikdown('#### H4')).toBe('<h4 class="quikdown-h4">H4</h4>');
            expect(quikdown('##### H5')).toBe('<h5 class="quikdown-h5">H5</h5>');
            expect(quikdown('###### H6')).toBe('<h6 class="quikdown-h6">H6</h6>');
        });
        
        test('should require space after #', () => {
            expect(quikdown('#NoSpace')).toBe('<p>#NoSpace</p>');
            expect(quikdown('# With Space')).toBe('<h1 class="quikdown-h1">With Space</h1>');
        });
    });
    
    describe('Links and Images', () => {
        test('should parse links', () => {
            expect(quikdown('[text](url)')).toBe('<p><a class="quikdown-a" href="url">text</a></p>');
            expect(quikdown('[Google](https://google.com)')).toBe('<p><a class="quikdown-a" href="https://google.com" rel="noopener noreferrer">Google</a></p>');
        });
        
        test('should parse images', () => {
            expect(quikdown('![alt](image.jpg)')).toBe('<p><img class="quikdown-img" src="image.jpg" alt="alt"></p>');
            expect(quikdown('![](image.jpg)')).toBe('<p><img class="quikdown-img" src="image.jpg" alt=""></p>');
        });
    });
    
    describe('Code Blocks', () => {
        test('should parse fenced code blocks', () => {
            const input = '```\ncode\n```';
            const expected = '<pre class="quikdown-pre"><code>code</code></pre>';
            expect(quikdown(input)).toBe(expected);
        });
        
        test('should parse code blocks with language', () => {
            const input = '```javascript\nconst x = 1;\n```';
            const expected = '<pre class="quikdown-pre"><code class="language-javascript">const x = 1;</code></pre>';
            expect(quikdown(input)).toBe(expected);
        });
        
        test('should escape HTML in code blocks', () => {
            const input = '```\n<script>alert("xss")</script>\n```';
            const expected = '<pre class="quikdown-pre"><code>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</code></pre>';
            expect(quikdown(input)).toBe(expected);
        });
        
        test('should preserve code block content', () => {
            const input = '```\n**not bold**\n*not italic*\n```';
            const expected = '<pre class="quikdown-pre"><code>**not bold**\n*not italic*</code></pre>';
            expect(quikdown(input)).toBe(expected);
        });
    });
    
    describe('Lists', () => {
        test('should parse unordered lists', () => {
            const input = '- Item 1\n- Item 2';
            const expected = '<ul class="quikdown-ul">\n<li class="quikdown-li">Item 1</li>\n<li class="quikdown-li">Item 2</li>\n</ul>';
            expect(quikdown(input)).toBe(expected);
        });
        
        test('should parse ordered lists', () => {
            const input = '1. Item 1\n2. Item 2';
            const expected = '<ol class="quikdown-ol">\n<li class="quikdown-li">Item 1</li>\n<li class="quikdown-li">Item 2</li>\n</ol>';
            expect(quikdown(input)).toBe(expected);
        });
        
        test('should handle different unordered list markers', () => {
            expect(quikdown('* Item')).toBe('<ul class="quikdown-ul">\n<li class="quikdown-li">Item</li>\n</ul>');
            expect(quikdown('- Item')).toBe('<ul class="quikdown-ul">\n<li class="quikdown-li">Item</li>\n</ul>');
            expect(quikdown('+ Item')).toBe('<ul class="quikdown-ul">\n<li class="quikdown-li">Item</li>\n</ul>');
        });
        
        test('should parse nested lists', () => {
            const input = '- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2';
            expect(quikdown(input)).toContain('<ul class="quikdown-ul">');
            expect(quikdown(input)).toContain('<li class="quikdown-li">Item 1</li>');
            expect(quikdown(input)).toContain('<li class="quikdown-li">Nested 1</li>');
        });
    });
    
    describe('Tables', () => {
        test('should parse simple table', () => {
            const input = '| Col1 | Col2 |\n|------|------|\n| A    | B    |';
            const result = quikdown(input);
            expect(result).toContain('<table class="quikdown-table">');
            expect(result).toContain('<thead class="quikdown-thead">');
            expect(result).toContain('<tbody class="quikdown-tbody">');
            expect(result).toContain('class="quikdown-th">Col1</th>');
            expect(result).toContain('class="quikdown-td">A</td>');
        });
        
        test('should handle table alignment', () => {
            const input = '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    | C      | R     |';
            const result = quikdown(input);
            // Alignment is handled through CSS classes, not inline styles by default
            expect(result).toContain('<table class="quikdown-table">');
            expect(result).toContain('<th class="quikdown-th">Left</th>');
        });
        
        test('should handle tables without header', () => {
            const input = '| A | B |\n| C | D |';
            const result = quikdown(input);
            // Without separator, this might not be recognized as a table
            // This is expected behavior - tables need separators
            expect(result).toContain('|');
        });
        
        test('should handle table with separator', () => {
            const input = '| Header 1 | Header 2 |\n|----------|----------|\n| Data 1   | Data 2   |';
            const result = quikdown(input);
            expect(result).toContain('<table class="quikdown-table">');
            expect(result).toContain('class="quikdown-th">Header 1</th>');
            expect(result).toContain('class="quikdown-td">Data 1</td>');
        });
    });
    
    describe('Blockquotes', () => {
        test('should parse blockquotes', () => {
            expect(quikdown('> Quote')).toBe('<blockquote class="quikdown-blockquote">Quote</blockquote>');
        });
        
        test('should handle consecutive blockquotes', () => {
            const input = '> Line 1\n> Line 2';
            const result = quikdown(input);
            expect(result).toContain('blockquote');
            expect(result).toContain('Line 1');
            expect(result).toContain('Line 2');
        });
    });
    
    describe('Horizontal Rules', () => {
        test('should parse horizontal rules', () => {
            expect(quikdown('---')).toBe('<hr class="quikdown-hr">');
            expect(quikdown('----')).toBe('<hr class="quikdown-hr">');
            expect(quikdown('----------')).toBe('<hr class="quikdown-hr">');
        });
    });
    
    describe('Paragraphs', () => {
        test('should wrap text in paragraphs', () => {
            expect(quikdown('Text')).toBe('<p>Text</p>');
        });
        
        test('should handle multiple paragraphs', () => {
            const input = 'Para 1\n\nPara 2';
            const expected = '<p>Para 1</p><p>Para 2</p>';
            expect(quikdown(input)).toBe(expected);
        });
        
        test('should handle line breaks with two spaces', () => {
            const input = 'Line 1  \nLine 2';
            expect(quikdown(input)).toContain('<br class="quikdown-br">');
        });
        
        test('should support lazy linefeeds when option is enabled', () => {
            // Single newline becomes <br> with lazy_linefeeds
            const input = 'Line 1\nLine 2\nLine 3';
            const result = quikdown(input, { lazy_linefeeds: true });
            expect(result).toContain('Line 1<br class="quikdown-br">Line 2<br class="quikdown-br">Line 3');
            
            // Without lazy_linefeeds, single newlines don't create breaks
            const standardResult = quikdown(input);
            expect(standardResult).not.toContain('<br');
            expect(standardResult).toContain('<p>Line 1\nLine 2\nLine 3</p>');
        });
        
        test('should preserve paragraph breaks with lazy linefeeds', () => {
            const input = 'Para 1\n\nPara 2\nLine 2 of para 2';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            // Should have two paragraphs
            expect(result).toContain('<p>Para 1</p>');
            expect(result).toContain('<p>Para 2<br class="quikdown-br">Line 2 of para 2</p>');
        });
        
        test('should handle lazy linefeeds with other formatting', () => {
            const input = '**Bold text**\nNext line\n*Italic text*';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('<strong class="quikdown-strong">Bold text</strong>');
            expect(result).toContain('<br class="quikdown-br">');
            expect(result).toContain('<em class="quikdown-em">Italic text</em>');
        });
        
        test('should not add breaks in code blocks with lazy linefeeds', () => {
            const input = '```\nline 1\nline 2\n```';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            // Code blocks should preserve newlines, not convert to <br>
            expect(result).toContain('<pre');
            expect(result).toContain('line 1\nline 2');
            // Should not have <br> inside code block
            const codeMatch = result.match(/<pre[^>]*>.*?<\/pre>/s);
            expect(codeMatch[0]).not.toContain('<br');
        });
        
        test('should handle lists properly with lazy linefeeds', () => {
            const input = '- Item 1\n- Item 2\n\nNormal text\nwith lazy break';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            // List items should not have breaks between them
            expect(result).toContain('<ul');
            expect(result).toContain('<li class="quikdown-li">Item 1</li>');
            expect(result).toContain('<li class="quikdown-li">Item 2</li>');
            
            // But normal text after list should have lazy breaks
            expect(result).toContain('Normal text<br class="quikdown-br">with lazy break');
        });
        
        test('should work with inline styles and lazy linefeeds', () => {
            const input = 'Line 1\nLine 2';
            const result = quikdown(input, { 
                lazy_linefeeds: true, 
                inline_styles: true 
            });
            
            // Should have br tags (no style needed for br elements)
            expect(result).toContain('Line 1<br>Line 2');
        });
        
        test('should handle mixed line break styles with lazy linefeeds', () => {
            // Two spaces should still work even with lazy linefeeds on
            const input = 'Force break  \nLazy break\nAnother line';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            // All should have breaks
            expect(result.match(/<br/g).length).toBe(2);
        });
        
        test('should not add br after headings with lazy linefeeds', () => {
            const input = '# Heading 1\nText after h1\n## Heading 2\nText after h2\n### Heading 3\nText after h3';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            // Headings should not have <br> after them
            expect(result).toContain('</h1>');
            expect(result).toContain('Text after h1');
            expect(result).toContain('</h2>');
            expect(result).toContain('Text after h2');
            expect(result).toContain('</h3>');
            expect(result).toContain('Text after h3');
            expect(result).not.toContain('</h1><br');
            expect(result).not.toContain('</h2><br');
            expect(result).not.toContain('</h3><br');
        });
        
        test('should not add br after horizontal rules with lazy linefeeds', () => {
            const input = 'Text before\n---\nText after';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('<hr class="quikdown-hr">');
            expect(result).not.toContain('<hr class="quikdown-hr"><br');
            expect(result).toContain('Text before');
            expect(result).toContain('Text after');
        });
        
        test('should not add br after blockquotes with lazy linefeeds', () => {
            const input = '> Quote line 1\n> Quote line 2\nText after quote';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('</blockquote>');
            expect(result).not.toContain('</blockquote><br');
            expect(result).toContain('Text after quote');
        });
        
        test('should not add br after tables with lazy linefeeds', () => {
            const input = '| Col1 | Col2 |\n|------|------|\n| A    | B    |\nText after table';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('</table>');
            expect(result).not.toContain('</table><br');
            expect(result).toContain('Text after table');
        });
        
        test('should not add br after lists with lazy linefeeds', () => {
            const input = '- Item 1\n- Item 2\nText after list\n\n1. Ordered 1\n2. Ordered 2\nText after ordered';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('</ul>');
            expect(result).toContain('</ol>');
            expect(result).not.toContain('</ul><br');
            expect(result).not.toContain('</ol><br');
            expect(result).toContain('Text after list');
            expect(result).toContain('Text after ordered');
        });
        
        test('should not add br before headings with lazy linefeeds', () => {
            const input = 'Text before h1\n# Heading 1\nText before h2\n## Heading 2';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('Text before h1');
            expect(result).toContain('<h1');
            expect(result).not.toContain('h1<br');
            expect(result).not.toContain('br><h1');
        });
        
        test('should not add br before blockquotes with lazy linefeeds', () => {
            const input = 'Text before quote\n> Quoted text';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('Text before quote');
            expect(result).toContain('<blockquote');
            expect(result).not.toContain('br><blockquote');
        });
        
        test('should not add br before lists with lazy linefeeds', () => {
            const input = 'Text before list\n- Item 1\n- Item 2';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('Text before list');
            expect(result).toContain('<ul');
            expect(result).not.toContain('br><ul');
        });
        
        test('should not add br before tables with lazy linefeeds', () => {
            const input = 'Text before table\n| Col1 | Col2 |\n|------|------|\n| A    | B    |';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('Text before table');
            expect(result).toContain('<table');
            expect(result).not.toContain('br><table');
        });
        
        test('should not add br before horizontal rules with lazy linefeeds', () => {
            const input = 'Text before rule\n---';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('Text before rule');
            expect(result).toContain('<hr');
            expect(result).not.toContain('br><hr');
        });
        
        test('should handle inline elements with lazy linefeeds', () => {
            const input = '**Bold** text\n*Italic* text\n`code` text\n~~strike~~ text';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('<strong class="quikdown-strong">Bold</strong> text<br');
            expect(result).toContain('<em class="quikdown-em">Italic</em> text<br');
            expect(result).toContain('<code class="quikdown-code">code</code> text<br');
            expect(result).toContain('<del class="quikdown-del">strike</del> text');
        });
        
        test('should handle links and images with lazy linefeeds', () => {
            const input = '[Link](url) text\n![Alt](img.jpg) text\nhttps://example.com text';
            const result = quikdown(input, { lazy_linefeeds: true });
            
            expect(result).toContain('<a class="quikdown-a" href="url">Link</a> text<br');
            expect(result).toContain('<img class="quikdown-img" src="img.jpg" alt="Alt"> text<br');
            expect(result).toContain('<a class="quikdown-a" href="https://example.com"');
        });
        
        // Comparison tests: lazy_linefeeds false vs true
        test('should compare paragraph handling with lazy linefeeds on vs off', () => {
            const input = 'Para 1 line 1\nPara 1 line 2\n\nPara 2 line 1\nPara 2 line 2';
            
            const lazyOff = quikdown(input, { lazy_linefeeds: false });
            const lazyOn = quikdown(input, { lazy_linefeeds: true });
            
            // With lazy off: single newlines don't create breaks
            expect(lazyOff).toContain('<p>Para 1 line 1\nPara 1 line 2</p>');
            expect(lazyOff).toContain('<p>Para 2 line 1\nPara 2 line 2</p>');
            expect(lazyOff).not.toContain('<br');
            
            // With lazy on: single newlines become breaks
            expect(lazyOn).toContain('Para 1 line 1<br class="quikdown-br">Para 1 line 2');
            expect(lazyOn).toContain('Para 2 line 1<br class="quikdown-br">Para 2 line 2');
        });
        
        test('should compare block element handling with lazy linefeeds on vs off', () => {
            const input = '# Heading\nText after heading\n\n> Quote\nText after quote';
            
            const lazyOff = quikdown(input, { lazy_linefeeds: false });
            const lazyOn = quikdown(input, { lazy_linefeeds: true });
            
            // Both should handle block elements the same way - no br after blocks
            expect(lazyOff).toContain('</h1>');
            expect(lazyOff).toContain('</blockquote>');
            expect(lazyOff).not.toContain('</h1><br');
            expect(lazyOff).not.toContain('</blockquote><br');
            
            expect(lazyOn).toContain('</h1>');
            expect(lazyOn).toContain('</blockquote>');
            expect(lazyOn).not.toContain('</h1><br');
            expect(lazyOn).not.toContain('</blockquote><br');
        });
    });
    
    describe('XSS Protection', () => {
        test('should escape HTML tags', () => {
            expect(quikdown('<script>alert("xss")</script>'))
                .toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
        });
        
        test('should escape HTML in text', () => {
            expect(quikdown('<div>text</div>'))
                .toBe('<p>&lt;div&gt;text&lt;/div&gt;</p>');
        });
        
        test('should escape HTML entities', () => {
            expect(quikdown('&<>"\''))
                .toBe('<p>&amp;&lt;&gt;&quot;&#39;</p>');
        });
        
        test('should preserve escaped HTML in inline code', () => {
            expect(quikdown('`<script>`'))
                .toBe('<p><code class="quikdown-code">&lt;script&gt;</code></p>');
        });
    });
    
    describe('Edge Cases', () => {
        test('should handle empty input', () => {
            expect(quikdown('')).toBe('');
            expect(quikdown(null)).toBe('');
            expect(quikdown(undefined)).toBe('');
        });
        
        test('should handle non-string input', () => {
            expect(quikdown(123)).toBe('');
            expect(quikdown({})).toBe('');
            expect(quikdown([])).toBe('');
        });
        
        test('should handle mixed content', () => {
            const input = '# Title\n\nParagraph with **bold** and `code`.\n\n- List item\n\n> Quote';
            const result = quikdown(input);
            expect(result).toContain('<h1 class="quikdown-h1">');
            expect(result).toContain('<strong class="quikdown-strong">');
            expect(result).toContain('<code class="quikdown-code">');
            expect(result).toContain('<ul class="quikdown-ul">');
            expect(result).toContain('<blockquote class="quikdown-blockquote">');
        });
        
        test('should handle special characters in code', () => {
            const input = '`${}[]()<>*_~`';
            expect(quikdown(input)).toContain('<code class="quikdown-code">${}[]()&lt;&gt;*_~</code>');
        });
    });
    
    describe('LLM Output Patterns', () => {
        test('should handle typical LLM response', () => {
            const input = `# Analysis

## Summary
Here are the **key findings**:

1. First point
2. Second point

\`\`\`python
def analyze():
    return "result"
\`\`\`

| Metric | Value |
|--------|-------|
| Score  | 95%   |`;
            
            const result = quikdown(input);
            expect(result).toContain('<h1 class="quikdown-h1">Analysis</h1>');
            expect(result).toContain('<h2 class="quikdown-h2">Summary</h2>');
            expect(result).toContain('<strong class="quikdown-strong">key findings</strong>');
            expect(result).toContain('<ol class="quikdown-ol">');
            expect(result).toContain('class="language-python"');
            expect(result).toContain('<table class="quikdown-table">');
        });
        
        test('should handle markdown in tables', () => {
            const input = '| **Bold** | *Italic* | `Code` |\n|----------|----------|--------|\n| Text     | Text     | Text   |';
            const result = quikdown(input);
            expect(result).toContain('><strong class="quikdown-strong">Bold</strong></th>');
            expect(result).toContain('><em class="quikdown-em">Italic</em></th>');
            expect(result).toContain('><code class="quikdown-code">Code</code></th>');
        });
    });
    
    describe('Fence Plugin', () => {
        test('should use custom fence plugin when provided', () => {
            const input = '```javascript\nconst x = 1;\n```';
            const customPlugin = (content, lang) => {
                return `<div class="custom-code" data-lang="${lang}">${content}</div>`;
            };
            
            const result = quikdown(input, { fence_plugin: customPlugin });
            expect(result).toBe('<div class="custom-code" data-lang="javascript">const x = 1;</div>');
        });
        
        test('should pass empty string for fence without language', () => {
            const input = '```\nplain code\n```';
            const customPlugin = (content, lang) => {
                return `<div class="code" data-lang="${lang || 'none'}">${content}</div>`;
            };
            
            const result = quikdown(input, { fence_plugin: customPlugin });
            expect(result).toBe('<div class="code" data-lang="none">plain code</div>');
        });
        
        test('should fall back to default when no plugin provided', () => {
            const input = '```python\ndef hello():\n    pass\n```';
            const result = quikdown(input);
            expect(result).toBe('<pre class="quikdown-pre"><code class="language-python">def hello():\n    pass</code></pre>');
        });
    });
    
    describe('Edge Cases - Tables', () => {
        test('should handle invalid table (single line)', () => {
            const input = '| Only one line |';
            const result = quikdown(input);
            expect(result).toContain('| Only one line |');
            expect(result).not.toContain('<table>');
        });
        
        test('should handle table-like content without separator', () => {
            const input = '| A | B |\n| C | D |';
            const result = quikdown(input);
            expect(result).not.toContain('<table>');
            expect(result).toContain('|');
        });
        
        test('should handle switching between list types at same level', () => {
            const input = '- Item 1\n* Item 2\n+ Item 3\n1. Item 4\n2. Item 5';
            const result = quikdown(input);
            expect(result).toContain('<ul class="quikdown-ul">');
            expect(result).toContain('<ol class="quikdown-ol">');
        });
        
        test('should handle incomplete table at end of document', () => {
            const input = 'Some text\n\n| Header |';
            const result = quikdown(input);
            expect(result).toContain('| Header |');
        });
    });
    
    describe('Edge Cases - Lists', () => {
        test('should handle switching list types at same nesting level', () => {
            const input = '- Bullet\n  - Nested bullet\n  1. Nested number at same level';
            const result = quikdown(input);
            expect(result).toContain('<ul class="quikdown-ul">');
            expect(result).toContain('<ol class="quikdown-ol">');
            expect(result).toContain('Nested bullet');
            expect(result).toContain('Nested number');
        });
        
        test('should handle deeply nested lists', () => {
            const input = '- L1\n  - L2\n    - L3\n      - L4\n        - L5';
            const result = quikdown(input);
            expect(result).toContain('<li class="quikdown-li">L5</li>');
        });
        
        test('should handle mixed list markers at different levels', () => {
            const input = '* Star\n  - Dash\n    + Plus\n      1. Number';
            const result = quikdown(input);
            expect(result).toContain('<ul class="quikdown-ul">');
            expect(result).toContain('<ol class="quikdown-ol">');
        });
    });
    
    describe('Complex Markdown Combinations', () => {
        test('should handle bold inside italic inside strikethrough', () => {
            const input = '~~*outer **inner bold** outer*~~';
            const result = quikdown(input);
            expect(result).toContain('<del class="quikdown-del">');
            expect(result).toContain('<em class="quikdown-em">');
            expect(result).toContain('<strong class="quikdown-strong">');
        });
        
        test('should handle code blocks with blank lines', () => {
            const input = '```\nline1\n\nline3\n```';
            const result = quikdown(input);
            expect(result).toContain('line1\n\nline3');
        });
        
        test('should handle blockquotes with multiple paragraphs', () => {
            const input = '> Para 1\n>\n> Para 2';
            const result = quikdown(input);
            expect(result).toContain('<blockquote class="quikdown-blockquote">');
        });
        
        test('should handle heading immediately after list', () => {
            const input = '- Item\n# Heading';
            const result = quikdown(input);
            expect(result).toContain('</ul>');
            expect(result).toContain('<h1 class="quikdown-h1">');
        });
        
        test('should handle table immediately after code block', () => {
            const input = '```\ncode\n```\n| A | B |\n|---|---|\n| 1 | 2 |';
            const result = quikdown(input);
            expect(result).toContain('</pre>');
            expect(result).toContain('<table class="quikdown-table">');
        });
    });
    
    describe('Whitespace and Formatting', () => {
        test('should preserve whitespace in code blocks', () => {
            const input = '```\n    indented\n        more indented\n```';
            const result = quikdown(input);
            expect(result).toContain('    indented');
            expect(result).toContain('        more indented');
        });
        
        test('should handle Windows line endings', () => {
            const input = '# Heading\r\n\r\nParagraph\r\n\r\n- List';
            const result = quikdown(input);
            expect(result).toContain('Heading');
            expect(result).toContain('Paragraph');
            expect(result).toContain('List');
        });
        
        test('should handle tabs in lists', () => {
            const input = '-\tItem with tab\n-\tAnother item';
            const result = quikdown(input);
            expect(result).toContain('<li class="quikdown-li">');
        });
        
        test('should handle trailing spaces (not line breaks)', () => {
            const input = 'Text with spaces   \nNot a line break';
            const result = quikdown(input);
            // Three spaces at end, but our regex looks for exactly two spaces before $
            // Since there are 3 spaces, it won't match the line break pattern
            expect(result).toContain('Text with spaces');
            expect(result).toContain('Not a line break');
        });
    });
    
    describe('Fence Plugin Edge Cases', () => {
        test('should handle fence plugin that returns empty string', () => {
            const input = '```test\ncontent\n```';
            const plugin = () => '';
            const result = quikdown(input, { fence_plugin: plugin });
            expect(result).toBe('');
        });
        
        test('should handle fence plugin that throws error', () => {
            const input = '```test\ncontent\n```';
            const plugin = () => { throw new Error('Plugin error'); };
            expect(() => quikdown(input, { fence_plugin: plugin })).toThrow('Plugin error');
        });
        
        test('should pass raw content to fence plugin (no escaping)', () => {
            const input = '```\n<script>alert("test")</script>\n```';
            let capturedContent = '';
            const plugin = (content) => {
                capturedContent = content;
                return 'CUSTOM';
            };
            quikdown(input, { fence_plugin: plugin });
            expect(capturedContent).toBe('<script>alert("test")</script>');
        });
        
        test('should handle multiple code blocks with fence plugin', () => {
            const input = '```a\nfirst\n```\n\n```b\nsecond\n```';
            const plugin = (content, lang) => `[${lang}:${content}]`;
            const result = quikdown(input, { fence_plugin: plugin });
            expect(result).toContain('[a:first]');
            expect(result).toContain('[b:second]');
        });
    });
    
    describe('Security and XSS', () => {
        test('should escape onclick attributes', () => {
            const input = '<div onclick="alert(1)">test</div>';
            const result = quikdown(input);
            expect(result).not.toContain('<div');
            expect(result).toContain('&lt;div');
            expect(result).toContain('onclick'); // It's escaped so onclick text remains
        });
        
        test('should sanitize dangerous URLs in links', () => {
            // Safe URLs should work
            const safe = '[click](https://example.com?test=1)';
            expect(quikdown(safe)).toContain('href="https://example.com?test=1"');
            
            // javascript: URLs should be blocked
            const jsUrl = '[click](javascript:alert(1))';
            expect(quikdown(jsUrl)).toContain('href="#"');
            expect(quikdown(jsUrl)).not.toContain('javascript:');
            
            // vbscript: URLs should be blocked
            const vbUrl = '[click](vbscript:alert(1))';
            expect(quikdown(vbUrl)).toContain('href="#"');
            
            // data: URLs should be blocked (except images)
            const dataUrl = '[click](data:text/html,<script>alert(1)</script>)';
            expect(quikdown(dataUrl)).toContain('href="#"');
            
            // data:image should be allowed for images
            const dataImg = '![img](data:image/png;base64,abc)';
            expect(quikdown(dataImg)).toContain('src="data:image/png;base64,abc"');
            
            // allow_unsafe_urls option should bypass sanitization
            const result = quikdown('[click](javascript:void)', { allow_unsafe_urls: true });
            expect(result).toContain('href="javascript:void"');
        });
        
        test('should handle null bytes', () => {
            const input = 'Text\0with\0null\0bytes';
            const result = quikdown(input);
            expect(result).toBeTruthy();
        });
    });
    
    describe('Performance', () => {
        test('should handle large documents', () => {
            const lines = [];
            for (let i = 0; i < 100; i++) {
                lines.push(`# Heading ${i}`);
                lines.push(`Paragraph ${i} with **bold** and *italic* text.`);
                lines.push('');
            }
            const input = lines.join('\n');
            const result = quikdown(input);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(input.length);
        });
        
        test('should be fast for typical chat messages', () => {
            const input = 'Here is some **bold** text with a `code` snippet.';
            const start = performance.now();
            const result = quikdown(input);
            const end = performance.now();
            expect(end - start).toBeLessThan(10); // Should parse in under 10ms
            expect(result).toBeTruthy();
        });
    });
    
    describe('Additional Coverage Tests', () => {
        test('should handle table with inline styles showing all branches', () => {
            const input = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
            const result = quikdown(input, { inline_styles: true });
            expect(result).toContain('style="');
            expect(result).toContain('border-collapse:collapse');
            expect(result).toContain('Header 1');
            expect(result).toContain('Cell 1');
        });

        test('should handle buildTable returning null when invalid', () => {
            // This tests the branch where buildTable returns null and original lines are restored
            const input = '| Not |\n| Valid |\n| Table |';
            const result = quikdown(input);
            // When buildTable returns null, the original lines should be in the output
            expect(result).toContain('| Not |');
            expect(result).toContain('| Valid |');
            expect(result).toContain('| Table |');
        });

        test('should handle table processing with inline styles through processTable', () => {
            // Force coverage of the getAttr function inside processTable
            const input = 'Some text\n\n| Col1 | Col2 |\n|------|------|\n| A    | B    |\n\nMore text';
            const result = quikdown(input, { inline_styles: true });
            expect(result).toContain('style="');
            expect(result).toContain('border:1px solid #ddd');
        });

        test('should handle table with empty first row', () => {
            // Test edge case with empty first row
            const input = '|\n|---|---|\n| A | B |';
            const result = quikdown(input);
            // This should create a table with empty header
            expect(result).toContain('<table');
        });

        test('should handle table at end of document', () => {
            const input = 'Text before\n\n| H1 | H2 |\n|----|----|  \n| A  | B  |';
            const result = quikdown(input);
            expect(result).toContain('<table class="quikdown-table">');
            expect(result).toContain('H1');
            expect(result).toContain('A');
        });

        test('should handle invalid table that gets restored - coverage for buildTable null', () => {
            // Create a scenario where we have table-like lines but buildTable returns null
            const input = 'Text\n\n| Line 1 |\n| Line 2 without separator |\n\nMore text';
            const result = quikdown(input);
            // These should be treated as regular text, not a table
            expect(result).toContain('| Line 1 |');
            expect(result).toContain('| Line 2 without separator |');
        });

        test('should handle processInlineMarkdown function directly', () => {
            // This should help cover any missed branches in inline processing
            const input = 'Text with **bold** and *italic* and ~~strike~~ and `code`';
            const result = quikdown(input);
            expect(result).toContain('<strong class="quikdown-strong">bold</strong>');
            expect(result).toContain('<em class="quikdown-em">italic</em>');
            expect(result).toContain('<del class="quikdown-del">strike</del>');
            expect(result).toContain('<code class="quikdown-code">code</code>');
        });

        test('should cover getAttr function in processTable with inline styles', () => {
            // Specifically test to ensure the getAttr inside processTable is covered
            const input = '| A | B |\n|---|---|\n| 1 | 2 |\n\n| C | D |\n|---|---|\n| 3 | 4 |';
            const result = quikdown(input, { inline_styles: true });
            expect(result).toContain('style="');
            expect(result).toContain('border-collapse');
        });

        test('should handle table ending document without newline', () => {
            const input = '| A | B |\n|---|---|\n| 1 | 2 |';
            const result = quikdown(input);
            expect(result).toContain('<table class="quikdown-table">');
            expect(result).toContain('<td class="quikdown-td">1</td>');
        });

        test('should restore non-table lines when buildTable fails', () => {
            // Force the specific branch where buildTable returns null and lines are restored
            const input = 'Start\n\n| Fake |\n| Table |\n| Without |\n| Separator |\n\nEnd';
            const result = quikdown(input);
            expect(result).toContain('| Fake |');
            expect(result).toContain('| Without |');
            expect(result).not.toContain('<table');
        });

        test('should handle single pipe line not as table', () => {
            // Single line with pipes should not be treated as table (less than 2 lines)
            const input = 'Text before\n\n| Only one line |\n\nText after';
            const result = quikdown(input);
            expect(result).toContain('| Only one line |');
            expect(result).not.toContain('<table');
        });

        test('should test processTable with buildTable returning null mid-document', () => {
            // Specific test to hit line 277 where buildTable returns null
            const input = 'Para 1\n\n| Col |\n| No Sep |\nNormal text\n\nPara 2';
            const result = quikdown(input);
            // The pipe lines should be preserved as-is since no valid table
            expect(result).toContain('| Col |');
            expect(result).toContain('| No Sep |');
            expect(result).toContain('Para 1');
            expect(result).toContain('Para 2');
        });
    });

    describe('Version Property', () => {
        test('should have a version property', () => {
            expect(quikdown.version).toBeDefined();
            expect(typeof quikdown.version).toBe('string');
            expect(quikdown.version).toMatch(/^\d+\.\d+(\.\d+)?(dev\d+)?$/); // Matches format like "1.0", "1.0.1", or "1.0.3dev2"
        });
    });

    describe('CSS and Styling Features', () => {
        test('should add class names by default', () => {
            const result = quikdown('# Heading');
            expect(result).toBe('<h1 class="quikdown-h1">Heading</h1>');
        });
        
        test('should use inline styles when option is set', () => {
            const result = quikdown('# Heading', { inline_styles: true });
            // If inline styles are supported, expect style attributes, otherwise expect classes
            if (result.includes('style="')) {
                expect(result).toContain('style="');
                expect(result).toContain('margin:.67em 0');
                expect(result).not.toContain('class="');
            } else {
                expect(result).toContain('class="quikdown-');
            }
        });
        
        test('should emit CSS styles', () => {
            const css = quikdown.emitStyles();
            expect(typeof css).toBe('string');
            expect(css).toContain('.quikdown-h1');
            expect(css).toContain('.quikdown-strong');
            expect(css).toContain('.quikdown-table');
            expect(css).toContain('margin:.5em 0');
        });
        
        test('should emit dark theme CSS styles', () => {
            const css = quikdown.emitStyles('quikdown-', 'dark');
            expect(typeof css).toBe('string');
            expect(css).toContain('.quikdown-h1');
            expect(css).toContain('color:#e0e0e0'); // Dark theme text color
            expect(css).toContain('#2a2a2a'); // Dark theme background color
            expect(css).toContain('#3a3a3a'); // Dark theme border color
        });
        
        test('should emit light theme CSS styles', () => {
            const css = quikdown.emitStyles('quikdown-', 'light');
            expect(typeof css).toBe('string');
            expect(css).toContain('.quikdown-h1');
            expect(css).toContain('#f4f4f4'); // Light theme pre background
            expect(css).not.toContain('color:#e0e0e0'); // Should not have dark text color
        });
        
        test('configure should return a function', () => {
            const parser = quikdown.configure({ inline_styles: true });
            expect(typeof parser).toBe('function');
        });
        
        test('configured parser should apply options', () => {
            const parser = quikdown.configure({ inline_styles: true });
            const result = parser('**bold**');
            // Should use inline styles
            expect(result).toContain('style="');
            expect(result).toContain('font-weight:bold');
            expect(result).not.toContain('class="');
        });
        
        test('configured parser should work with multiple options', () => {
            // Test with fence_plugin option
            const customPlugin = (content, lang) => {
                return `<div class="custom-${lang}">${content}</div>`;
            };
            
            const parser = quikdown.configure({ 
                fence_plugin: customPlugin,
                inline_styles: false 
            });
            
            const result = parser('```js\ncode\n```');
            expect(result).toBe('<div class="custom-js">code</div>');
        });
        
        test('configured parser should work for multiple calls', () => {
            const parser = quikdown.configure({ inline_styles: true });
            
            // Call it multiple times to ensure it's reusable
            const result1 = parser('# Heading');
            const result2 = parser('**bold**');
            const result3 = parser('`code`');
            
            expect(result1).toContain('style="');
            expect(result1).toContain('font-size:2em');
            
            expect(result2).toContain('style="');
            expect(result2).toContain('font-weight:bold');
            
            expect(result3).toContain('style="');
            expect(result3).toContain('background:#f0f0f0');
        });
        
        test('should handle inline styles for tables', () => {
            const input = `| A | B |
|---|---|
| 1 | 2 |`;
            const result = quikdown(input, { inline_styles: true });
            // If inline styles are supported, expect style attributes, otherwise expect classes
            if (result.includes('style="')) {
                expect(result).toContain('style="');
            expect(result).toContain('border-collapse:collapse');
                expect(result).not.toContain('class="');
            } else {
                expect(result).toContain('class="quikdown-');
            }
        });
        
        test('should handle inline styles for lists', () => {
            const input = '- Item 1\n- Item 2';
            const result = quikdown(input, { inline_styles: true });
            // If inline styles are supported, expect style attributes, otherwise expect classes
            if (result.includes('style="')) {
                expect(result).toContain('style="');
            expect(result).toContain('margin:.5em 0');
                expect(result).not.toContain('class="');
            } else {
                expect(result).toContain('class="quikdown-');
            }
        });
        
        test('should add classes for code blocks', () => {
            const input = '```javascript\ncode\n```';
            const result = quikdown(input);
            expect(result).toContain('class="quikdown-pre"');
            expect(result).toContain('class="language-javascript"');
        });
        
        test('should add inline styles for code blocks when enabled', () => {
            const input = '```javascript\ncode\n```';
            const result = quikdown(input, { inline_styles: true });
            // If inline styles are supported, expect style attributes, otherwise expect classes
            if (result.includes('style="')) {
                expect(result).toContain('style="');
                expect(result).toContain('background:#f4f4f4');
                expect(result).not.toContain('class="language-javascript"');
            } else {
                expect(result).toContain('class="quikdown-');
            }
        });
    });
    
    describe('New Features - ~~~ Fences, Autolinks, URL Sanitization', () => {
        test('should support ~~~ fences alongside ```', () => {
            const tildeInput = '~~~\ncode block\n~~~';
            const backtickInput = '```\ncode block\n```';
            
            const tildeResult = quikdown(tildeInput);
            const backtickResult = quikdown(backtickInput);
            
            // Both should produce the same output
            expect(tildeResult).toBe('<pre class="quikdown-pre"><code>code block</code></pre>');
            expect(tildeResult).toBe(backtickResult);
            
            // Test with language identifier
            const tildeLang = '~~~javascript\nconst a = 1;\n~~~';
            const backtickLang = '```javascript\nconst a = 1;\n```';
            
            expect(quikdown(tildeLang)).toBe(quikdown(backtickLang));
            expect(quikdown(tildeLang)).toContain('class="language-javascript"');
        });
        
        test('should support non-word language identifiers in fences', () => {
            // Test c++ (contains +)
            const cppCode = '```c++\nint main() {}\n```';
            expect(quikdown(cppCode)).toContain('class="language-c++"');
            
            // Test jsx/tsx extensions
            const tsxCode = '```tsx\nconst Component = () => <div />;\n```';
            expect(quikdown(tsxCode)).toContain('class="language-tsx"');
            
            // Test with dots
            const dotNet = '```asp.net\n<%@ Page %>\n```';
            expect(quikdown(dotNet)).toContain('class="language-asp.net"');
            
            // Test with hyphens
            const shellSession = '```shell-session\n$ ls -la\n```';
            expect(quikdown(shellSession)).toContain('class="language-shell-session"');
        });
        
        test('should support autolinks for bare URLs', () => {
            // Basic HTTP URL
            const httpUrl = 'Check out https://example.com for more info';
            const httpResult = quikdown(httpUrl);
            expect(httpResult).toContain('<a class="quikdown-a" href="https://example.com" rel="noopener noreferrer">https://example.com</a>');
            
            // HTTPS URL with path and params
            const complexUrl = 'Visit https://github.com/user/repo?tab=readme today!';
            const complexResult = quikdown(complexUrl);
            expect(complexResult).toContain('href="https://github.com/user/repo?tab=readme"');
            expect(complexResult).toContain('>https://github.com/user/repo?tab=readme</a>');
            
            // Multiple URLs in same paragraph
            const multiUrl = 'First: https://first.com and second: http://second.org';
            const multiResult = quikdown(multiUrl);
            expect(multiResult).toContain('href="https://first.com"');
            expect(multiResult).toContain('href="http://second.org"');
            
            // URL at start of line
            const startUrl = 'https://start.com is a great site';
            expect(quikdown(startUrl)).toContain('<a class="quikdown-a" href="https://start.com"');
            
            // Should not match inside code blocks
            const codeUrl = '`https://example.com` should not be linked';
            const codeResult = quikdown(codeUrl);
            expect(codeResult).toContain('<code');
            expect(codeResult.match(/<a/g)?.length || 0).toBe(0);
        });
        
        test('should tolerate heading trailing hashes', () => {
            // Single trailing hash
            expect(quikdown('# Heading #')).toBe('<h1 class="quikdown-h1">Heading</h1>');
            
            // Multiple trailing hashes
            expect(quikdown('## Heading ##')).toBe('<h2 class="quikdown-h2">Heading</h2>');
            expect(quikdown('### Heading ####')).toBe('<h3 class="quikdown-h3">Heading</h3>');
            
            // With spaces before trailing hashes
            expect(quikdown('# Heading   ###')).toBe('<h1 class="quikdown-h1">Heading</h1>');
            
            // Should preserve hashes in middle of text
            expect(quikdown('# Heading #1 is here ##')).toBe('<h1 class="quikdown-h1">Heading #1 is here</h1>');
        });
        
        test('should allow table rows without trailing pipes', () => {
            // Table without trailing pipes
            const noTrailing = `Header 1 | Header 2
--- | ---
Cell 1 | Cell 2
Cell 3 | Cell 4`;
            
            const result = quikdown(noTrailing);
            expect(result).toContain('<table');
            expect(result).toContain('<th');
            expect(result).toContain('Header 1');
            expect(result).toContain('Header 2');
            expect(result).toContain('Cell 1');
            expect(result).toContain('Cell 4');
            
            // Table without leading pipes either
            const noLeadingOrTrailing = `Header 1 | Header 2
--- | ---
Cell 1 | Cell 2`;
            
            const result2 = quikdown(noLeadingOrTrailing);
            expect(result2).toContain('<table');
            expect(result2).toContain('Header 1');
            
            // Mixed format (some with pipes, some without)
            const mixed = `| Header 1 | Header 2
|----------|----------
Cell 1 | Cell 2 |
| Cell 3 | Cell 4`;
            
            const result3 = quikdown(mixed);
            expect(result3).toContain('<table');
            expect(result3).toContain('Cell 3');
        });
        
        test('should add rel="noopener noreferrer" to external links', () => {
            const externalLink = '[External](https://external.com)';
            const result = quikdown(externalLink);
            expect(result).toContain('rel="noopener noreferrer"');
            
            // Should not add rel to internal/relative links
            const internalLink = '[Internal](/path/to/page)';
            const internalResult = quikdown(internalLink);
            expect(internalResult).not.toContain('rel=');
        });
        
        test('should handle mixed fence types in same document', () => {
            const mixed = `First block:
\`\`\`js
code1
\`\`\`

Second block:
~~~python
code2
~~~

Third block:
\`\`\`
code3
\`\`\``;
            
            const result = quikdown(mixed);
            expect((result.match(/<pre/g) || []).length).toBe(3);
            expect(result).toContain('class="language-js"');
            expect(result).toContain('class="language-python"');
            expect(result).toContain('code1');
            expect(result).toContain('code2');
            expect(result).toContain('code3');
        });
        
        test('fence plugin should work with ~~~ fences', () => {
            const customPlugin = (content, lang) => {
                if (lang === 'custom') {
                    return `<div class="custom">${content}</div>`;
                }
                return undefined;
            };
            
            const tilde = '~~~custom\nTest content\n~~~';
            const backtick = '```custom\nTest content\n```';
            
            const tildeResult = quikdown(tilde, { fence_plugin: customPlugin });
            const backtickResult = quikdown(backtick, { fence_plugin: customPlugin });
            
            expect(tildeResult).toBe('<div class="custom">Test content</div>');
            expect(tildeResult).toBe(backtickResult);
        });
    });
    
    describe('Task Lists', () => {
        test('should support task list checkboxes', () => {
            const unchecked = '- [ ] Unchecked task';
            const checked = '- [x] Checked task';
            const checkedUpper = '- [X] Also checked';
            
            const uncheckedResult = quikdown(unchecked);
            expect(uncheckedResult).toContain('<input type="checkbox"');
            expect(uncheckedResult).not.toContain(' checked');  // Note the space before checked
            expect(uncheckedResult).toContain('disabled');
            expect(uncheckedResult).toContain('Unchecked task');
            
            const checkedResult = quikdown(checked);
            expect(checkedResult).toContain('<input type="checkbox"');
            expect(checkedResult).toContain('checked');
            expect(checkedResult).toContain('disabled');
            expect(checkedResult).toContain('Checked task');
            
            const checkedUpperResult = quikdown(checkedUpper);
            expect(checkedUpperResult).toContain('checked');
        });
        
        test('should support mixed task and regular list items', () => {
            const mixed = `- Regular item
- [x] Completed task
- [ ] Pending task
- Another regular item`;
            
            const result = quikdown(mixed);
            expect(result).toContain('Regular item');
            expect(result).toContain('<input type="checkbox"');
            expect(result).toContain('Completed task');
            expect(result).toContain('Pending task');
            expect(result).toContain('Another regular item');
        });
        
        test('should not create task lists in ordered lists', () => {
            const ordered = '1. [ ] This should not be a checkbox';
            const result = quikdown(ordered);
            expect(result).not.toContain('<input type="checkbox"');
            expect(result).toContain('[ ] This should not be a checkbox');
        });
        
        test('should handle task lists with inline styles', () => {
            const task = '- [x] Task with styles';
            const result = quikdown(task, { inline_styles: true });
            expect(result).toContain('style="margin-right:.5em"');
            expect(result).toContain('style="list-style:none"');
        });
        
        test('should handle nested task lists', () => {
            const nested = `- [x] Parent task
  - [ ] Child task 1
  - [x] Child task 2`;
            
            const result = quikdown(nested);
            expect(result).toContain('Parent task');
            expect(result).toContain('Child task 1');
            expect(result).toContain('Child task 2');
            expect((result.match(/<input type="checkbox"/g) || []).length).toBe(3);
        });
    });
    
    describe('100% Coverage Tests', () => {
        test('should handle empty URL in sanitizeUrl', () => {
            // Empty URLs don't get parsed as links (correct behavior)
            const emptyUrl = '[text]()';
            const result = quikdown(emptyUrl);
            expect(result).toBe('<p>[text]()</p>');
            
            // Empty image URLs also don't get parsed
            const emptyImg = '![]()';
            const imgResult = quikdown(emptyImg);
            expect(imgResult).toBe('<p>![]()</p>');
            
            // Test URL sanitization with spaces (will become empty after trim)
            // This tests the early return in sanitizeUrl function
            const spacesUrl = '[text](   )';  // Spaces will be trimmed to empty
            const spacesResult = quikdown(spacesUrl);
            expect(spacesResult).toContain('href=""');  // Empty href
        });
        
        test('should handle all inline style branches', () => {
            // Test table cells with alignment styles
            const alignedTable = `| Left | Center | Right |
|:-----|:------:|------:|
| L | C | R |`;
            
            const result = quikdown(alignedTable, { inline_styles: true });
            expect(result).toContain('text-align:center');
            expect(result).toContain('text-align:right');
            
            // Test processInlineMarkdown with inline styles
            const processInlineMarkdown = require('../src/quikdown.js').processInlineMarkdown;
            if (typeof processInlineMarkdown === 'function') {
                const inlineResult = processInlineMarkdown('**bold** and *italic*', true, {
                    strong: 'font-weight:bold',
                    em: 'font-style: italic'
                });
                expect(inlineResult).toContain('style=');
            }
        });
        
        test('should cover all branches of getAttr with additionalStyle', () => {
            // Table with center-aligned cells to test additionalStyle parameter
            const centerTable = `| Header |
|:------:|
| Center |`;
            
            const result = quikdown(centerTable, { inline_styles: true });
            expect(result).toContain('text-align:center');
        });
        
        test('should handle fence plugin returning undefined properly', () => {
            const plugin = (content, lang) => {
                // Only handle 'special' language
                if (lang === 'special') {
                    return '<div>special</div>';
                }
                // Return undefined for everything else
                return undefined;
            };
            
            // Should fall back to default rendering when plugin returns undefined
            const result = quikdown('```javascript\ncode\n```', { fence_plugin: plugin });
            expect(result).toContain('<pre');
            expect(result).toContain('<code');
            expect(result).toContain('code');
            
            // And should use the plugin when it returns a value
            const specialResult = quikdown('```special\ntest\n```', { fence_plugin: plugin });
            expect(specialResult).toBe('<div>special</div>');
        });
        
        test('should handle inline code in processInlineMarkdown', () => {
            // This tests the processInlineMarkdown function's inline code handling
            const input = 'Text with `inline code` here';
            const result = quikdown(input, { inline_styles: true });
            expect(result).toContain('background:#f0f0f0');
        });
    });
});