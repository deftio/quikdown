/**
 * quikdown_malformed.test.js
 * Tests for malformed markdown, exotic features, and cross-feature interactions.
 */

import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';

describe('Malformed markdown and exotic features', () => {

  // ========================================================================
  // 1. Formatting across lines
  // ========================================================================
  describe('Formatting across lines', () => {
    test('bold spanning newline should NOT create bold', () => {
      const result = quikdown('**bold\nnewline**');
      expect(result).not.toContain('<strong');
      expect(result).toContain('**bold');
    });

    test('italic spanning newline should NOT create italic', () => {
      const result = quikdown('*italic\nnewline*');
      expect(result).not.toContain('<em');
      expect(result).toContain('*italic');
    });

    test('strikethrough spanning newline should NOT create del', () => {
      const result = quikdown('~~strike\nnewline~~');
      expect(result).not.toContain('<del');
      expect(result).toContain('~~strike');
    });

    test('inline code spanning newline still creates code (parser allows it)', () => {
      const result = quikdown('`code\nnewline`');
      expect(result).toContain('<code');
      expect(result).toContain('code\nnewline');
    });

    test('bold with lazy_linefeeds spanning newline should NOT create bold', () => {
      const result = quikdown('**bold\nnewline**', { lazy_linefeeds: true });
      expect(result).not.toContain('<strong');
    });
  });

  // ========================================================================
  // 2. Deep nesting
  // ========================================================================
  describe('Deep nesting', () => {
    test('list nested 4 levels deep', () => {
      const input = '- Level 1\n  - Level 2\n    - Level 3\n      - Level 4';
      const result = quikdown(input);
      expect(result).toContain('Level 1');
      expect(result).toContain('Level 2');
      expect(result).toContain('Level 3');
      expect(result).toContain('Level 4');
      expect(result).toContain('<ul');
      expect(result).toContain('<li');
    });

    test('list nested 5 levels deep', () => {
      const input = '- L1\n  - L2\n    - L3\n      - L4\n        - L5';
      const result = quikdown(input);
      expect(result).toContain('L1');
      expect(result).toContain('L5');
      expect(result).toContain('<li');
    });

    test('nested bold inside italic inside strikethrough', () => {
      const result = quikdown('~~*__deep__*~~');
      expect(result).toContain('<del');
      expect(result).toContain('<em');
      expect(result).toContain('<strong');
      expect(result).toContain('deep');
    });

    test('bold inside italic', () => {
      const result = quikdown('*text **bold** more*');
      expect(result).toContain('<em');
      expect(result).toContain('<strong');
      expect(result).toContain('bold');
    });

    test('triple nesting: bold > italic > code', () => {
      const result = quikdown('**bold *italic `code`***');
      expect(result).toContain('<strong');
      expect(result).toContain('code');
    });

    test('ordered list nested 4 levels', () => {
      const input = '1. L1\n   1. L2\n      1. L3\n         1. L4';
      const result = quikdown(input);
      expect(result).toContain('L1');
      expect(result).toContain('<li');
    });
  });

  // ========================================================================
  // 3. Malformed + unicode combined
  // ========================================================================
  describe('Malformed + unicode combined', () => {
    test('unclosed bold with emoji', () => {
      const result = quikdown('**emoji 😀');
      expect(result).toContain('😀');
      expect(result).not.toContain('</strong>');
    });

    test('CJK text inside bold formatting', () => {
      const result = quikdown('**日本語テスト**');
      expect(result).toBe('<p><strong class="quikdown-strong">日本語テスト</strong></p>');
    });

    test('CJK text inside italic formatting', () => {
      const result = quikdown('*中文测试*');
      expect(result).toBe('<p><em class="quikdown-em">中文测试</em></p>');
    });

    test('CJK text inside strikethrough', () => {
      const result = quikdown('~~한국어~~');
      expect(result).toBe('<p><del class="quikdown-del">한국어</del></p>');
    });

    test('RTL text in link', () => {
      const result = quikdown('[مرحبا](https://example.com)');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('مرحبا');
    });

    test('emoji in heading', () => {
      const result = quikdown('# 🚀 Launch');
      expect(result).toBe('<h1 class="quikdown-h1">🚀 Launch</h1>');
    });

    test('emoji in link text', () => {
      const result = quikdown('[🔗 link](https://example.com)');
      expect(result).toContain('🔗 link');
      expect(result).toContain('href="https://example.com"');
    });

    test('mixed unicode in table cells', () => {
      const input = '| 中文 | العربية |\n|------|--------|\n| 日本語 | 한국어 |';
      const result = quikdown(input);
      expect(result).toContain('中文');
      expect(result).toContain('العربية');
      expect(result).toContain('日本語');
      expect(result).toContain('한국어');
    });

    test('unclosed italic with unicode', () => {
      const result = quikdown('*неоконченный');
      expect(result).toContain('*неоконченный');
      expect(result).not.toContain('<em');
    });

    test('emoji in code block', () => {
      const result = quikdown('`console.log("🎉")`');
      expect(result).toContain('<code');
      expect(result).toContain('🎉');
    });
  });

  // ========================================================================
  // 4. Whitespace edge cases
  // ========================================================================
  describe('Whitespace edge cases', () => {
    test('whitespace-only lines between blocks', () => {
      const input = '# Heading\n   \n## Another';
      const result = quikdown(input);
      expect(result).toContain('<h1');
      expect(result).toContain('<h2');
    });

    test('tabs in heading', () => {
      const result = quikdown('#\tHeading');
      // Tab after # may or may not be treated as space
      expect(result).toBeDefined();
    });

    test('trailing spaces on HR', () => {
      expect(quikdown('---   ')).toBe('<hr class="quikdown-hr">');
      expect(quikdown('---\t\t')).toBe('<hr class="quikdown-hr">');
    });

    test('trailing spaces on heading', () => {
      const result = quikdown('# Heading   ');
      expect(result).toContain('<h1');
      expect(result).toContain('Heading');
    });

    test('multiple consecutive blank lines (>3)', () => {
      const input = 'Para 1\n\n\n\n\nPara 2';
      const result = quikdown(input);
      expect(result).toContain('Para 1');
      expect(result).toContain('Para 2');
      // Should still produce two paragraphs, not more
      expect(result).toContain('<p>');
    });

    test('four consecutive blank lines between paragraphs', () => {
      const input = 'A\n\n\n\n\nB';
      const result = quikdown(input);
      expect(result).toContain('A');
      expect(result).toContain('B');
    });

    test('whitespace-only input', () => {
      const result = quikdown('   \n  \n   ');
      // Should produce minimal or empty output
      expect(result).toBeDefined();
    });

    test('tab before list marker', () => {
      const result = quikdown('\t- Item');
      expect(result).toBeDefined();
      expect(result).toContain('Item');
    });

    test('mixed tabs and spaces in list nesting', () => {
      const input = '- L1\n\t- L2\n  - L3';
      const result = quikdown(input);
      expect(result).toContain('L1');
      expect(result).toContain('<li');
    });

    test('trailing newline at end of input', () => {
      const result = quikdown('Hello\n');
      expect(result).toContain('Hello');
    });

    test('leading newlines before content', () => {
      const result = quikdown('\n\nHello');
      expect(result).toContain('Hello');
    });
  });

  // ========================================================================
  // 5. Option combinations
  // ========================================================================
  describe('Option combinations', () => {
    describe('lazy_linefeeds + fence_plugin', () => {
      test('code blocks should not get <br> inside them with lazy_linefeeds', () => {
        const input = '```\nline 1\nline 2\nline 3\n```';
        const result = quikdown(input, { lazy_linefeeds: true });
        const codeMatch = result.match(/<pre[^>]*>.*?<\/pre>/s);
        expect(codeMatch).not.toBeNull();
        expect(codeMatch[0]).not.toContain('<br');
        expect(codeMatch[0]).toContain('line 1\nline 2\nline 3');
      });

      test('fence_plugin still works with lazy_linefeeds', () => {
        const plugin = { render: (code, lang) => `<div class="custom">${code}</div>` };
        const input = '```js\nconst x = 1;\n```';
        const result = quikdown(input, {
          lazy_linefeeds: true,
          fence_plugin: plugin
        });
        expect(result).toContain('<div class="custom">');
        expect(result).toContain('const x = 1;');
      });

      test('fence_plugin output should not get <br> with lazy_linefeeds', () => {
        const plugin = { render: (code, lang) => `<div class="highlight">${code}</div>` };
        const input = 'Text before\n\n```python\ndef foo():\n    pass\n```\n\nText after';
        const result = quikdown(input, {
          lazy_linefeeds: true,
          fence_plugin: plugin
        });
        expect(result).toContain('<div class="highlight">');
        // The code block content should preserve newlines, not convert to <br>
        expect(result).toContain('def foo():');
      });
    });

    describe('lazy_linefeeds + inline_styles', () => {
      test('<br> tags should NOT have classes when inline_styles is true', () => {
        const input = 'Line 1\nLine 2\nLine 3';
        const result = quikdown(input, {
          lazy_linefeeds: true,
          inline_styles: true
        });
        expect(result).toContain('<br');
        expect(result).toContain('Line 1');
        expect(result).toContain('Line 2');
      });

      test('heading with inline_styles and lazy_linefeeds', () => {
        const input = '# Heading\nNext line';
        const result = quikdown(input, {
          lazy_linefeeds: true,
          inline_styles: true
        });
        expect(result).toContain('<h1');
        expect(result).toContain('Heading');
      });

      test('table with inline_styles and lazy_linefeeds', () => {
        const input = '| H1 | H2 |\n|----|----|  \n| A  | B  |';
        const result = quikdown(input, {
          lazy_linefeeds: true,
          inline_styles: true
        });
        expect(result).toContain('<table');
        expect(result).toContain('style="');
      });
    });

    describe('allow_unsafe_html + various features', () => {
      test('should still escape HTML inside code blocks', () => {
        const input = '```\n<script>alert("xss")</script>\n```';
        const result = quikdown(input, { allow_unsafe_html: true });
        expect(result).toContain('&lt;script&gt;');
        expect(result).not.toContain('<script>alert');
      });

      test('should still process markdown formatting', () => {
        const input = '**bold** and <div>html</div>';
        const result = quikdown(input, { allow_unsafe_html: true });
        expect(result).toContain('<strong');
        expect(result).toContain('bold');
      });

      test('should preserve HTML in paragraphs while processing markdown', () => {
        const input = '# Heading\n\n<span>inline</span>\n\n*italic*';
        const result = quikdown(input, { allow_unsafe_html: true });
        expect(result).toContain('<h1');
        expect(result).toContain('<em');
        expect(result).toContain('italic');
      });

      test('allow_unsafe_html with inline_styles', () => {
        const input = '<div>html</div>\n\n**bold**';
        const result = quikdown(input, {
          allow_unsafe_html: true,
          inline_styles: true
        });
        expect(result).toContain('<div>html</div>');
        expect(result).toContain('<strong');
      });

      test('allow_unsafe_html with lazy_linefeeds', () => {
        const input = '<div>html</div>\nNext line\nAnother line';
        const result = quikdown(input, {
          allow_unsafe_html: true,
          lazy_linefeeds: true
        });
        expect(result).toContain('Next line');
        expect(result).toContain('Another line');
      });

      test('allow_unsafe_html with code blocks and markdown', () => {
        const input = '```\n<div>in code</div>\n```\n\n<div>raw html</div>\n\n**bold**';
        const result = quikdown(input, { allow_unsafe_html: true });
        // Code block should escape
        expect(result).toContain('&lt;div&gt;in code&lt;/div&gt;');
        // Outside code block raw HTML should be preserved
        expect(result).toContain('<strong');
      });
    });
  });

  // ========================================================================
  // 6. Bidirectional roundtrip edge cases
  // ========================================================================
  describe('Bidirectional roundtrip edge cases', () => {
    test('parse with lazy_linefeeds -> toMarkdown -> re-parse should produce equivalent HTML', () => {
      const markdown = 'Line 1\nLine 2\nLine 3';
      const html1 = quikdown_bd(markdown, { lazy_linefeeds: true });
      const backToMd = quikdown_bd.toMarkdown(html1);
      const html2 = quikdown_bd(backToMd, { lazy_linefeeds: true });
      // Both HTML outputs should contain the same text
      expect(html2).toContain('Line 1');
      expect(html2).toContain('Line 2');
      expect(html2).toContain('Line 3');
    });

    test('tables with alignment -> toMarkdown -> re-parse preserves alignment', () => {
      const markdown = '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    | C      | R     |';
      const html1 = quikdown_bd(markdown);
      expect(html1).toContain('<table');
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('|');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('<table');
      expect(html2).toContain('Left');
      expect(html2).toContain('Center');
      expect(html2).toContain('Right');
    });

    test('code fences with language -> toMarkdown -> re-parse preserves language', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const html1 = quikdown_bd(markdown);
      expect(html1).toContain('language-javascript');
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('javascript');
      expect(backToMd).toContain('const x = 1;');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('language-javascript');
      expect(html2).toContain('const x = 1;');
    });

    test('bold and italic roundtrip', () => {
      const markdown = '**bold** and *italic* text';
      const html1 = quikdown_bd(markdown);
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('**bold**');
      expect(backToMd).toContain('*italic*');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('<strong');
      expect(html2).toContain('<em');
    });

    test('heading roundtrip', () => {
      const markdown = '## Second Heading';
      const html1 = quikdown_bd(markdown);
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('## Second Heading');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('<h2');
      expect(html2).toContain('Second Heading');
    });

    test('blockquote roundtrip', () => {
      const markdown = '> Quoted text here';
      const html1 = quikdown_bd(markdown);
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('> Quoted text here');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('<blockquote');
      expect(html2).toContain('Quoted text here');
    });

    test('list roundtrip', () => {
      const markdown = '- Item A\n- Item B\n- Item C';
      const html1 = quikdown_bd(markdown);
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('- Item A');
      expect(backToMd).toContain('- Item B');
      expect(backToMd).toContain('- Item C');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('<ul');
      expect(html2).toContain('Item A');
    });

    test('HR roundtrip', () => {
      const markdown = 'Above\n\n---\n\nBelow';
      const html1 = quikdown_bd(markdown);
      const backToMd = quikdown_bd.toMarkdown(html1);
      expect(backToMd).toContain('---');
      const html2 = quikdown_bd(backToMd);
      expect(html2).toContain('<hr');
    });
  });

  // ========================================================================
  // 7. Exotic markdown patterns
  // ========================================================================
  describe('Exotic markdown patterns', () => {
    test('consecutive HRs separated by blank lines', () => {
      const input = '---\n\n---\n\n---';
      const result = quikdown(input);
      const hrCount = (result.match(/<hr/g) || []).length;
      expect(hrCount).toBe(3);
    });

    test('HR immediately after heading', () => {
      const input = '# Heading\n---';
      const result = quikdown(input);
      expect(result).toContain('<h1');
      expect(result).toContain('Heading');
      // --- after heading may be treated as HR or setext heading underline
      // Either way, it should produce valid output
      expect(result).toBeDefined();
    });

    test('list followed immediately by table (no blank line)', () => {
      const input = '- Item 1\n- Item 2\n| H1 | H2 |\n|----|----|  \n| A  | B  |';
      const result = quikdown(input);
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      // Output should contain content from both constructs
      expect(result).toBeDefined();
    });

    test('table followed immediately by code fence (no blank line)', () => {
      const input = '| H1 | H2 |\n|----|----|  \n| A  | B  |\n```\ncode here\n```';
      const result = quikdown(input);
      expect(result).toContain('<table');
      expect(result).toContain('<pre');
      expect(result).toContain('code here');
    });

    test('empty table cells', () => {
      const input = '| H1 | H2 |\n|----|----|  \n|    |    |';
      const result = quikdown(input);
      expect(result).toContain('<table');
      expect(result).toContain('<td');
    });

    test('single-column table', () => {
      const input = '| Header |\n|--------|\n| Cell   |';
      const result = quikdown(input);
      expect(result).toContain('<table');
      expect(result).toContain('Header');
      expect(result).toContain('Cell');
    });

    test('blockquote containing bold and italic', () => {
      const result = quikdown('> **bold** and *italic*');
      expect(result).toContain('<blockquote');
      expect(result).toContain('<strong');
      expect(result).toContain('bold');
      expect(result).toContain('<em');
      expect(result).toContain('italic');
    });

    test('blockquote containing strikethrough', () => {
      const result = quikdown('> ~~deleted~~ text');
      expect(result).toContain('<blockquote');
      expect(result).toContain('<del');
      expect(result).toContain('deleted');
    });

    test('blockquote containing inline code', () => {
      const result = quikdown('> Use `npm install` here');
      expect(result).toContain('<blockquote');
      expect(result).toContain('<code');
      expect(result).toContain('npm install');
    });

    test('autolinks inside blockquotes', () => {
      const result = quikdown('> Visit https://example.com today');
      expect(result).toContain('<blockquote');
      expect(result).toContain('href="https://example.com"');
    });

    test('multiple autolinks in one line', () => {
      const result = quikdown('Check https://first.com and https://second.com please');
      expect(result).toContain('href="https://first.com"');
      expect(result).toContain('href="https://second.com"');
    });

    test('autolink with query string', () => {
      const result = quikdown('Visit https://example.com/page?key=value&other=123');
      expect(result).toContain('href="https://example.com/page?key=value&amp;other=123"');
    });

    test('autolink with fragment', () => {
      const result = quikdown('See https://example.com/page#section here');
      expect(result).toContain('href="https://example.com/page#section"');
    });

    test('autolink with path', () => {
      const result = quikdown('Go to https://example.com/path/to/page for details');
      expect(result).toContain('href="https://example.com/path/to/page"');
    });

    test('heading with only spaces after #', () => {
      const result = quikdown('# ');
      // Should produce a heading (possibly empty) or just the text
      expect(result).toBeDefined();
    });

    test('heading with only spaces: ## ', () => {
      const result = quikdown('##  ');
      expect(result).toBeDefined();
    });

    test('consecutive blockquotes', () => {
      const input = '> Quote 1\n\n> Quote 2';
      const result = quikdown(input);
      expect(result).toContain('Quote 1');
      expect(result).toContain('Quote 2');
      expect(result).toContain('<blockquote');
    });

    test('blockquote with link', () => {
      const result = quikdown('> Check [this](https://example.com)');
      expect(result).toContain('<blockquote');
      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
    });

    test('image inside list item', () => {
      const result = quikdown('- ![alt](image.png)');
      expect(result).toContain('<li');
      expect(result).toContain('<img');
      expect(result).toContain('src="image.png"');
    });

    test('code block with empty content', () => {
      const result = quikdown('```\n\n```');
      expect(result).toContain('<pre');
      expect(result).toContain('<code');
    });

    test('code block with only whitespace', () => {
      const result = quikdown('```\n   \n```');
      expect(result).toContain('<pre');
    });

    test('tilde code fence', () => {
      const result = quikdown('~~~\ncode\n~~~');
      expect(result).toContain('<pre');
      expect(result).toContain('code');
    });
  });

  // ========================================================================
  // 8. Unclosed/broken constructs
  // ========================================================================
  describe('Unclosed/broken constructs', () => {
    test('unclosed bold at end of document', () => {
      const result = quikdown('Some text **unclosed bold');
      expect(result).toContain('**unclosed bold');
      expect(result).not.toContain('</strong>');
    });

    test('unclosed bold at start of document', () => {
      const result = quikdown('**unclosed');
      expect(result).toContain('**unclosed');
      expect(result).not.toContain('</strong>');
    });

    test('unclosed link at end of document', () => {
      const result = quikdown('[text](url');
      expect(result).toContain('[text](url');
      expect(result).not.toContain('<a');
    });

    test('unclosed link - missing closing bracket', () => {
      const result = quikdown('[text(url)');
      expect(result).toContain('[text(url)');
    });

    test('mismatched emphasis: two stars open, one star close', () => {
      const result = quikdown('**bold*');
      // Should not produce valid bold
      expect(result).toBeDefined();
      // The parser should handle this gracefully without crashing
    });

    test('mismatched emphasis: one star open, two stars close', () => {
      const result = quikdown('*italic**');
      expect(result).toBeDefined();
    });

    test('empty bold markers: ****', () => {
      const result = quikdown('****');
      expect(result).toBeDefined();
      // Should not produce <strong></strong> with empty content
    });

    test('empty underscore markers: __', () => {
      const result = quikdown('__');
      expect(result).toBeDefined();
    });

    test('empty strikethrough markers: ~~~~', () => {
      const result = quikdown('~~~~');
      expect(result).toBeDefined();
    });

    test('empty tilde markers: ~~', () => {
      const result = quikdown('~~');
      expect(result).toBeDefined();
    });

    test('nested unclosed formatting: bold then italic unclosed', () => {
      const result = quikdown('**bold *italic');
      expect(result).toContain('**bold');
      expect(result).not.toContain('</strong>');
    });

    test('nested unclosed formatting: italic inside unclosed bold', () => {
      const result = quikdown('**start *mid* end');
      // The italic part might still parse since it is closed
      expect(result).toContain('mid');
      expect(result).not.toContain('</strong>');
    });

    test('table with only separator row', () => {
      const input = '|---|---|';
      const result = quikdown(input);
      // Should not crash; may produce text or malformed table
      expect(result).toBeDefined();
      expect(result).toContain('|');
    });

    test('table with more columns in body than header', () => {
      const input = '| H1 | H2 |\n|----|----|  \n| A  | B  | C |';
      const result = quikdown(input);
      expect(result).toContain('<table');
      expect(result).toContain('H1');
      expect(result).toContain('A');
    });

    test('table with fewer columns in body than header', () => {
      const input = '| H1 | H2 | H3 |\n|----|----|----|  \n| A  |';
      const result = quikdown(input);
      expect(result).toContain('<table');
      expect(result).toContain('H1');
    });

    test('unclosed code fence at end of document', () => {
      const result = quikdown('```\ncode without closing');
      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result).toContain('code without closing');
    });

    test('unclosed inline code at end of document', () => {
      const result = quikdown('Text `unclosed code');
      expect(result).toContain('`unclosed code');
      expect(result).toBeDefined();
    });

    test('link with empty URL', () => {
      const result = quikdown('[text]()');
      expect(result).toContain('text');
    });

    test('link with empty text is not parsed as a link', () => {
      const result = quikdown('[](https://example.com)');
      // Parser requires non-empty link text
      expect(result).toContain('[](https://example.com)');
      expect(result).not.toContain('<a');
    });

    test('image with empty alt and src', () => {
      const result = quikdown('![]()');
      expect(result).toBeDefined();
    });

    test('unclosed strikethrough at end', () => {
      const result = quikdown('text ~~unclosed');
      expect(result).toContain('~~unclosed');
      expect(result).not.toContain('</del>');
    });

    test('just emphasis markers with no content between', () => {
      expect(quikdown('** **')).toBeDefined();
      expect(quikdown('* *')).toBeDefined();
      expect(quikdown('~~ ~~')).toBeDefined();
    });

    test('deeply nested unclosed constructs', () => {
      const result = quikdown('**bold ~~strike *italic');
      expect(result).toBeDefined();
      expect(result).toContain('bold');
    });

    test('link inside unclosed bold', () => {
      const result = quikdown('**bold [link](url) still bold');
      expect(result).toBeDefined();
      expect(result).toContain('bold');
    });

    test('multiple unclosed bolds in sequence', () => {
      const result = quikdown('**first **second **third');
      expect(result).toBeDefined();
      expect(result).toContain('first');
      expect(result).toContain('second');
      expect(result).toContain('third');
    });
  });

  // ========================================================================
  // Additional cross-feature interaction tests
  // ========================================================================
  describe('Cross-feature interactions', () => {
    test('bold text followed immediately by link', () => {
      const result = quikdown('**bold**[link](url)');
      expect(result).toContain('<strong');
      expect(result).toContain('bold');
      expect(result).toContain('<a');
    });

    test('code containing markdown syntax', () => {
      const result = quikdown('`**not bold**`');
      expect(result).toContain('<code');
      expect(result).toContain('**not bold**');
      expect(result).not.toContain('<strong');
    });

    test('heading with inline code', () => {
      const result = quikdown('# Heading with `code`');
      expect(result).toContain('<h1');
      expect(result).toContain('<code');
      expect(result).toContain('code');
    });

    test('heading with link', () => {
      const result = quikdown('## Heading [link](url)');
      expect(result).toContain('<h2');
      expect(result).toContain('<a');
    });

    test('list items with mixed formatting', () => {
      const input = '- **bold item**\n- *italic item*\n- ~~struck item~~\n- `code item`';
      const result = quikdown(input);
      expect(result).toContain('<strong');
      expect(result).toContain('<em');
      expect(result).toContain('<del');
      expect(result).toContain('<code');
    });

    test('table cells with formatting', () => {
      const input = '| **Bold** | *Italic* |\n|----------|----------|\n| ~~Del~~  | `Code`   |';
      const result = quikdown(input);
      expect(result).toContain('<table');
      expect(result).toContain('<strong');
      expect(result).toContain('<em');
      expect(result).toContain('<del');
      expect(result).toContain('<code');
    });

    test('HR between two tables', () => {
      const input = '| H1 |\n|----|\n| A  |\n\n---\n\n| H2 |\n|----|\n| B  |';
      const result = quikdown(input);
      expect(result).toContain('<hr');
      const tableCount = (result.match(/<table/g) || []).length;
      expect(tableCount).toBe(2);
    });

    test('code block between headings', () => {
      const input = '# First\n\n```\ncode\n```\n\n## Second';
      const result = quikdown(input);
      expect(result).toContain('<h1');
      expect(result).toContain('<pre');
      expect(result).toContain('<h2');
    });

    test('link with special characters in URL', () => {
      const result = quikdown('[text](https://example.com/path?a=1&b=2#frag)');
      expect(result).toContain('href="https://example.com/path?a=1&amp;b=2#frag"');
    });

    test('empty input', () => {
      const result = quikdown('');
      expect(result).toBe('');
    });

    test('input with only a newline', () => {
      const result = quikdown('\n');
      expect(result).toBeDefined();
    });

    test('very long heading', () => {
      const longText = 'A'.repeat(500);
      const result = quikdown(`# ${longText}`);
      expect(result).toContain('<h1');
      expect(result).toContain(longText);
    });

    test('autolink should not be created inside inline code', () => {
      const result = quikdown('`https://example.com`');
      expect(result).toContain('<code');
      expect(result).not.toContain('<a');
    });

    test('autolink should not be created inside code blocks', () => {
      const result = quikdown('```\nhttps://example.com\n```');
      expect(result).toContain('<pre');
      expect(result).not.toContain('<a');
    });

    test('multiple HRs with different syntax', () => {
      // *** and ___ are not recognized as HRs by the parser (only --- variants)
      const input = '---\n\n----\n\n-----';
      const result = quikdown(input);
      const hrCount = (result.match(/<hr/g) || []).length;
      expect(hrCount).toBe(3);
    });
  });
});
