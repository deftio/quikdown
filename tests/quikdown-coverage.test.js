/**
 * Additional tests to improve code coverage for quikdown
 */

import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';

describe('quikdown edge cases and coverage', () => {
  
  describe('Bidirectional option coverage', () => {
    test('should add data-qd attributes when bidirectional is true', () => {
      // This uses the internal bidirectional option
      const html = quikdown('**bold**', { bidirectional: true });
      expect(html).toContain('data-qd="**"');
    });

    test('should handle all inline formats with bidirectional', () => {
      const html = quikdown('__underline__ and _italic_', { bidirectional: true });
      expect(html).toContain('data-qd="__"');
      expect(html).toContain('data-qd="_"');
    });

    test('should handle images with bidirectional attributes', () => {
      const html = quikdown('![alt text](image.png)', { bidirectional: true });
      expect(html).toContain('data-qd="!"');
      expect(html).toContain('data-qd-alt="alt text"');
      expect(html).toContain('data-qd-src="image.png"');
    });

    test('should handle links with bidirectional attributes', () => {
      const html = quikdown('[link text](https://example.com)', { bidirectional: true });
      expect(html).toContain('data-qd="["');
      expect(html).toContain('data-qd-text="link text"');
    });

    test('should handle code blocks with fence attributes', () => {
      const html = quikdown('```js\ncode\n```', { bidirectional: true });
      expect(html).toContain('data-qd-fence="```"');
      expect(html).toContain('data-qd-lang="js"');
    });

    test('should handle tilde fences', () => {
      const html = quikdown('~~~python\ncode\n~~~', { bidirectional: true });
      expect(html).toContain('data-qd-fence="~~~"');
      expect(html).toContain('data-qd-lang="python"');
    });

    test('should handle lists with data-qd', () => {
      const html = quikdown('- item 1\n* item 2\n+ item 3', { bidirectional: true });
      expect(html).toContain('data-qd="-"');
      expect(html).toContain('data-qd="*"');
      expect(html).toContain('data-qd="+"');
    });

    test('should handle ordered lists with data-qd', () => {
      const html = quikdown('1. first\n2. second', { bidirectional: true });
      expect(html).toContain('data-qd="1."');
      expect(html).toContain('data-qd="2."');
    });

    test('should handle headings with all levels', () => {
      const tests = [
        '# H1',
        '## H2', 
        '### H3',
        '#### H4',
        '##### H5',
        '###### H6'
      ];
      
      tests.forEach(md => {
        const html = quikdown(md, { bidirectional: true });
        const level = md.match(/^(#+)/)[1];
        expect(html).toContain(`data-qd="${level}"`);
      });
    });
  });

  describe('URL sanitization edge cases', () => {
    test('should handle empty URLs', () => {
      const html = quikdown('[text]()');
      // Empty URL in markdown doesn't create a link
      expect(html).toContain('[text]()')
    });

    test('should allow unsafe URLs when option is set', () => {
      // Note: URLs with parentheses get cut off at the first )
      const html = quikdown('[click](javascript:alert(1))', { allow_unsafe_urls: true });
      expect(html).toContain('href="javascript:alert(1"');
      
      // Test with URL without parentheses
      const html2 = quikdown('[click](javascript:void)', { allow_unsafe_urls: true });
      expect(html2).toContain('href="javascript:void"');
    });

    test('should allow data:image URLs', () => {
      const html = quikdown('![](data:image/png;base64,abc)');
      expect(html).toContain('src="data:image/png;base64,abc"');
    });
  });

  describe('Fence plugin edge cases', () => {
    test('should handle fence plugin returning undefined', () => {
      const plugin = {
        render: () => undefined
      };
      const html = quikdown('```js\ncode\n```', { fence_plugin: plugin });
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('code');
    });

    test('should handle fence plugin with bidirectional', () => {
      const plugin = {
        render: () => undefined
      };
      const html = quikdown('```js\ncode\n```', { 
        fence_plugin: plugin,
        bidirectional: true 
      });
      expect(html).toContain('data-qd-fence="```"');
    });

    test('should handle fence plugin returning HTML with bidirectional', () => {
      const plugin = {
        render: (code, lang) => `<div class="custom-${lang}">${code}</div>`
      };
      const html = quikdown('```js\nconst x = 1;\n```', { 
        fence_plugin: plugin,
        bidirectional: true 
      });
      expect(html).toContain('data-qd-fence="```"');
      expect(html).toContain('data-qd-lang="js"');
      expect(html).toContain('data-qd-source="const x = 1;"');
      expect(html).toContain('class="custom-js"');
    });
  });

  describe('Empty and null input handling', () => {
    test('should handle null input', () => {
      expect(quikdown(null)).toBe('');
      expect(quikdown_bd(null)).toBe('');
    });

    test('should handle undefined input', () => {
      expect(quikdown(undefined)).toBe('');
      expect(quikdown_bd(undefined)).toBe('');
    });

    test('should handle number input', () => {
      expect(quikdown(123)).toBe('');
      expect(quikdown_bd(456)).toBe('');
    });

    test('should handle empty string', () => {
      expect(quikdown('')).toBe('');
      expect(quikdown_bd('')).toBe('');
    });
  });

  describe('Inline styles with additional styles', () => {
    test('should handle table cells with alignment and inline styles', () => {
      const md = '| Left | Center | Right |\n|:---|:---:|---:|\n| A | B | C |';
      const html = quikdown(md, { inline_styles: true });
      expect(html).toContain('style=');
      expect(html).toContain('text-align:center');
      expect(html).toContain('text-align:right');
    });
  });

  describe('Code coverage for processInlineMarkdown', () => {
    test('should process inline markdown in table cells', () => {
      const md = '| **bold** | *italic* |\n|---|---|\n| `code` | ~~strike~~ |';
      const html = quikdown(md);
      expect(html).toContain('<strong');
      expect(html).toContain('<em');
      expect(html).toContain('<code');
      expect(html).toContain('<del');
    });
  });

  describe('Edge cases for escaping', () => {
    test('should escape HTML in alt text for images', () => {
      const html = quikdown('![<script>alert(1)</script>](image.png)', { bidirectional: true });
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    test('should escape HTML in link text', () => {
      const html = quikdown('[<b>text</b>](url)', { bidirectional: true });
      expect(html).toContain('&lt;b&gt;');
      expect(html).not.toContain('<b>text</b>');
    });
  });

  describe('Complex nested structures', () => {
    test('should handle deeply nested lists', () => {
      const md = '- Level 1\n  - Level 2\n    - Level 3\n      - Level 4';
      const html = quikdown(md);
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
    });

    test('should handle mixed list types', () => {
      const md = '- Unordered\n  1. Ordered nested\n  2. Another ordered\n- Back to unordered';
      const html = quikdown(md);
      expect(html).toContain('<ul');
      expect(html).toContain('<ol');
    });
  });

  describe('emitStyles coverage', () => {
    test('should emit styles for all elements', () => {
      const css = quikdown.emitStyles();
      expect(css).toContain('.quikdown-h1');
      expect(css).toContain('.quikdown-task-item');
      expect(css).toContain('.quikdown-task-checkbox');
    });

    test('should emit dark theme styles', () => {
      const css = quikdown.emitStyles('quikdown-', 'dark');
      expect(css).toContain('#2a2a2a'); // dark background
      expect(css).toContain('#e0e0e0'); // dark text color
    });

    test('should emit light theme styles', () => {
      const css = quikdown.emitStyles('quikdown-', 'light');
      expect(css).toContain('#333'); // light text color
    });
  });

  describe('configure function coverage', () => {
    test('should create configured instance', () => {
      const configured = quikdown.configure({ inline_styles: true });
      const html = configured('**bold**');
      expect(html).toContain('style=');
      expect(html).not.toContain('class=');
    });

    test('should create configured bd instance', () => {
      const configured = quikdown_bd.configure({ inline_styles: true });
      const html = configured('**bold**');
      expect(html).toContain('style=');
      expect(html).toContain('data-qd'); // bd always has bidirectional
    });
  });

  describe('Version property', () => {
    test('should have version property', () => {
      expect(quikdown.version).toBeDefined();
      expect(quikdown_bd.version).toBeDefined();
    });
  });

  describe('Additional coverage for edge cases', () => {
    test('should handle inline styles with custom additional styles', () => {
      // This tests the edge case where additionalStyle is provided but base style doesn't exist
      const customQuikdown = quikdown.configure({ inline_styles: true });
      const html = customQuikdown('| A | B |\n|:---|---:|\n| 1 | 2 |');
      expect(html).toContain('text-align:right');
    });

    test('should handle images with empty alt text and bidirectional', () => {
      const html = quikdown('![](image.png)', { bidirectional: true });
      expect(html).toContain('data-qd="!"');
      expect(html).not.toContain('data-qd-alt'); // Empty alt shouldn't add attribute
    });

    test('should handle various protocol sanitization', () => {
      // Test vbscript protocol
      const vbscript = quikdown('[click](vbscript:alert(1))');
      expect(vbscript).toContain('href="#"');
      
      // Test data: protocol (non-image)
      const dataUrl = quikdown('[click](data:text/html,<script>alert(1)</script>)');
      expect(dataUrl).toContain('href="#"');
    });

    test('should handle fence plugin that returns empty string', () => {
      const plugin = {
        render: () => ''
      };
      const html = quikdown('```js\ncode\n```', { fence_plugin: plugin });
      expect(html).toBe('');
    });

    test('should handle fence plugin that returns HTML', () => {
      const plugin = {
        render: (code, lang) => `<div class="highlight-${lang}">${code}</div>`
      };
      const html = quikdown('```js\ncode\n```', { fence_plugin: plugin });
      expect(html).toContain('<div class="highlight-js">code</div>');
    });

    test('should handle mixed nested list types extensively', () => {
      const md = `- Item 1
  1. Nested ordered 1
  2. Nested ordered 2
    - Double nested unordered
- Item 2`;
      const html = quikdown(md);
      expect(html).toContain('<ul');
      expect(html).toContain('<ol');
      expect(html).toContain('Item 1');
      expect(html).toContain('Nested ordered 1');
      expect(html).toContain('Double nested unordered');
    });

    test('should handle table with no body rows', () => {
      const md = '| Header 1 | Header 2 |\n|----------|----------|';
      const html = quikdown(md);
      expect(html).toContain('<table');
      expect(html).toContain('<thead');
      expect(html).toContain('Header 1');
      expect(html).not.toContain('<tbody');
    });

    test('should handle table with centered and right alignment', () => {
      const md = '| Left | Center | Right |\n|:-----|:------:|------:|\n| A | B | C |';
      const html = quikdown(md, { inline_styles: true });
      expect(html).toContain('text-align:center');
      expect(html).toContain('text-align:right');
    });

    test('should process inline markdown in processInlineMarkdown function', () => {
      // This tests the processInlineMarkdown function directly through table cells
      const md = '| **bold** _italic_ |\n|---|\n| ~~strike~~ `code` |';
      const html = quikdown(md);
      expect(html).toContain('<strong');
      expect(html).toContain('<em');
      expect(html).toContain('<del');
      expect(html).toContain('<code');
    });

    test('should handle malformed tables gracefully', () => {
      // Table with only one line (no separator)
      const md1 = '| Header 1 | Header 2 |';
      const html1 = quikdown(md1);
      expect(html1).not.toContain('<table');
      expect(html1).toContain('| Header 1 | Header 2 |');
      
      // Table with invalid separator
      const md2 = '| Header 1 | Header 2 |\n| not | separator |';
      const html2 = quikdown(md2);
      expect(html2).not.toContain('<table');
    });

    test('should handle configure with bidirectional for quikdown_bd', () => {
      const configured = quikdown_bd.configure({ inline_styles: false });
      const html = configured('**bold**');
      expect(html).toContain('data-qd="**"'); // Should still have bidirectional
      expect(html).toContain('class="quikdown-strong"');
    });

    test('should handle blocks at the end of content', () => {
      // Table at end
      const md1 = 'Text\n\n| A | B |\n|---|---|\n| 1 | 2 |';
      const html1 = quikdown(md1);
      expect(html1).toContain('<table');
      
      // List at end
      const md2 = 'Text\n\n- Item 1\n- Item 2';
      const html2 = quikdown(md2);
      expect(html2).toContain('<ul');
    });

    test('should handle empty inline code', () => {
      const html = quikdown('Empty code: ``');
      expect(html).toContain('Empty code: ``'); // Empty inline code doesn't match
    });

    test('should handle line breaks correctly', () => {
      const html = quikdown('Line 1  \nLine 2');
      expect(html).toContain('<br');
      expect(html).toContain('Line 1');
      expect(html).toContain('Line 2');
    });

    test('should handle mixed content with paragraphs', () => {
      const md = 'Paragraph 1\n\nParagraph 2\n\n# Heading\n\nParagraph 3';
      const html = quikdown(md);
      expect(html).toContain('<p>Paragraph 1</p>');
      expect(html).toContain('<p>Paragraph 2</p>');
      expect(html).toContain('<h1');
      expect(html).toContain('Paragraph 3</p>');
    });

    test('should handle autolinks', () => {
      const html = quikdown('Visit https://example.com for more info');
      expect(html).toContain('<a');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    test('should handle task lists with bidirectional', () => {
      const html = quikdown('- [x] Done\n- [ ] Todo', { bidirectional: true });
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('checked');
      expect(html).toContain('data-qd="-"');
    });

    test('should handle all heading levels with trailing hashes', () => {
      const tests = [
        '# H1 #',
        '## H2 ##',
        '### H3 ###',
        '#### H4 ####',
        '##### H5 #####',
        '###### H6 ######'
      ];
      
      tests.forEach((md, i) => {
        const html = quikdown(md);
        const level = i + 1;
        expect(html).toContain(`<h${level}`);
        expect(html).toContain(`H${level}`);
        expect(html).toContain(`</h${level}>`);
      });
    });

    test('should handle blockquotes with merging', () => {
      const md = '> Line 1\n> Line 2\n\nNot quote\n\n> Line 3';
      const html = quikdown(md);
      expect(html).toContain('<blockquote');
      expect(html).toContain('Line 1');
      expect(html).toContain('Line 2');
      expect(html).toContain('Not quote');
      expect(html).toContain('Line 3');
    });

    test('should handle horizontal rules', () => {
      const md = 'Text\n\n---\n\nMore text';
      const html = quikdown(md);
      expect(html).toContain('<hr');
      expect(html).toContain('Text');
      expect(html).toContain('More text');
    });

    test('should handle fence blocks with empty language', () => {
      const html = quikdown('```\ncode\n```');
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('code');
    });

    test('should handle tilde fences with language', () => {
      const html = quikdown('~~~ruby\nputs "hello"\n~~~');
      expect(html).toContain('<pre');
      expect(html).toContain('language-ruby');
      expect(html).toContain('puts &quot;hello&quot;');
    });

    test('should escape HTML in fenced code blocks', () => {
      const html = quikdown('```\n<script>alert(1)</script>\n```');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    test('should handle external vs internal links', () => {
      const external = quikdown('[external](https://example.com)');
      expect(external).toContain('rel="noopener noreferrer"');
      
      const internal = quikdown('[internal](/path/to/page)');
      expect(internal).not.toContain('rel=');
    });

    test('should handle all inline patterns with bidirectional', () => {
      const patterns = [
        ['**bold**', '**'],
        ['__underline__', '__'],
        ['*italic*', '*'],
        ['_emphasis_', '_'],
        ['~~strike~~', '~~']
      ];
      
      patterns.forEach(([md, marker]) => {
        const html = quikdown(md, { bidirectional: true });
        expect(html).toContain(`data-qd="${marker}"`);
      });
    });

    test('should handle deeply nested content', () => {
      const md = '- Level 1\n  - Level 2\n    - Level 3\n      - Level 4\n        - Level 5';
      const html = quikdown(md);
      expect(html).toContain('Level 1');
      expect(html).toContain('Level 5');
      // Should have multiple nested lists
      const ulCount = (html.match(/<ul/g) || []).length;
      expect(ulCount).toBeGreaterThanOrEqual(4);
    });

    test('should sanitize different URL protocols', () => {
      const tests = [
        ['[test](javascript:void(0))', 'href="#"'],
        ['[test](vbscript:msgbox)', 'href="#"'],
        ['[test](data:text/plain,hello)', 'href="#"'],
        ['![test](data:image/gif;base64,R0l)', 'src="data:image/gif;base64,R0l"'] // Image data URLs allowed
      ];
      
      tests.forEach(([md, expected]) => {
        const html = quikdown(md);
        expect(html).toContain(expected);
      });
    });

    test('should handle list switching between types', () => {
      const md = '- Unordered\n1. Now ordered\n2. Still ordered\n- Back to unordered';
      const html = quikdown(md);
      expect(html).toContain('<ul');
      expect(html).toContain('<ol');
      expect(html).toContain('Unordered');
      expect(html).toContain('Now ordered');
    });

    test('should handle emitStyles with auto theme', () => {
      // Test default behavior
      const defaultStyles = quikdown.emitStyles();
      expect(defaultStyles).toContain('.quikdown-h1');
      expect(defaultStyles).toContain('.quikdown-table');
    });

    test('should handle fence plugin with inline styles', () => {
      const plugin = {
        render: (code) => `<div>${code}</div>`
      };
      const html = quikdown('```\ntest\n```', { 
        fence_plugin: plugin,
        inline_styles: true 
      });
      expect(html).toContain('<div>test</div>');
    });

    test('should handle incomplete bold/italic patterns', () => {
      const tests = [
        '**unclosed bold',
        '__unclosed underline',
        '*unclosed italic',
        '_unclosed emphasis',
        '~~unclosed strike'
      ];
      
      tests.forEach(md => {
        const html = quikdown(md);
        expect(html).toBeTruthy();
        // Should contain the original text
        expect(html).toContain(md.replace(/[*_~]/g, m => m));
      });
    });
  });

  describe('quikdown_bd specific coverage', () => {
    test('should handle emitStyles for quikdown_bd', () => {
      const styles = quikdown_bd.emitStyles();
      expect(styles).toBeDefined();
      
      const darkStyles = quikdown_bd.emitStyles('quikdown-', 'dark');
      expect(darkStyles).toBeDefined();
    });

    test('should handle toMarkdown function', () => {
      // toMarkdown requires DOM, so test its existence
      expect(typeof quikdown_bd.toMarkdown).toBe('function');
    });

    test('should handle various markdown with bidirectional', () => {
      const tests = [
        '![image](test.png)',
        '[link](url)',
        '`code`',
        '# Heading',
        '- List item',
        '1. Ordered item'
      ];
      
      tests.forEach(md => {
        const html = quikdown_bd(md);
        expect(html).toContain('data-qd');
      });
    });
  });

  describe('Browser global coverage', () => {
    test('should handle module.exports condition', () => {
      // This is already tested by requiring the module
      expect(quikdown).toBeDefined();
    });
  });

  describe('Additional branch coverage', () => {
    test('should handle empty URL in sanitizeUrl', () => {
      const html = quikdown('![]()', { allow_unsafe_urls: false });
      // Empty URL in images doesn't create an img tag
      expect(html).toContain('![]()');
    });

    test('should handle fence with undefined plugin return and bidirectional', () => {
      const plugin = {
        render: () => undefined
      };
      const html = quikdown('```\ncode\n```', { 
        fence_plugin: plugin,
        bidirectional: true,
        inline_styles: true
      });
      expect(html).toContain('data-qd-fence');
      expect(html).toContain('style=');
    });

    test('should handle fence with undefined plugin return and language', () => {
      const plugin = {
        render: () => undefined
      };
      const html = quikdown('```javascript\ncode\n```', { 
        fence_plugin: plugin,
        bidirectional: true,
        inline_styles: false
      });
      expect(html).toContain('data-qd-lang="javascript"');
      expect(html).toContain('class="language-javascript"');
    });

    test('should handle non-bidirectional with inline styles in fence', () => {
      const html = quikdown('```js\ncode\n```', { 
        inline_styles: true,
        bidirectional: false
      });
      expect(html).toContain('style=');
      expect(html).not.toContain('data-qd');
    });

    test('should handle getAttr with no style and no additionalStyle', () => {
      // This tests the empty return case in getAttr
      const html = quikdown('| A |\n|---|\n| B |', { inline_styles: true });
      expect(html).toContain('<thead>'); // thead has no style
    });

    test('should test dataQd when not bidirectional', () => {
      const html = quikdown('**bold**', { bidirectional: false });
      expect(html).not.toContain('data-qd');
    });

    test('should handle image with empty alt in bidirectional', () => {
      const html = quikdown('![](img.png)', { bidirectional: true });
      expect(html).toContain('data-qd="!"');
      expect(html).toContain('data-qd-src="img.png"');
      expect(html).not.toContain('data-qd-alt=');
    });

    test('should handle link without external protocol', () => {
      const html = quikdown('[local](/path)');
      expect(html).toContain('href="/path"');
      expect(html).not.toContain('rel=');
    });

    test('should test emitStyles light theme text color', () => {
      const styles = quikdown.emitStyles('quikdown-', 'light');
      expect(styles).toContain('color:#333'); // Light theme text color
    });

    test('should test processLists dataQd when not bidirectional', () => {
      const html = quikdown('- item', { bidirectional: false });
      expect(html).not.toContain('data-qd');
      expect(html).toContain('<li');
    });

    test('should handle table without tbody', () => {
      const html = quikdown('| H1 | H2 |\n|----|----|');
      expect(html).toContain('<thead');
      expect(html).not.toContain('<tbody');
    });

    test('should handle table without thead edge case', () => {
      // When there's no valid header (starts with separator)
      const html = quikdown('|----|----|');
      expect(html).not.toContain('<table');
    });

    test('should handle different list depths', () => {
      const md = '- Level 0\n    - Level 2 (skipping level 1)';
      const html = quikdown(md);
      expect(html).toContain('Level 0');
      expect(html).toContain('Level 2');
    });

    test('should handle switching list types at same level', () => {
      const md = '- Unordered\n1. Switching to ordered at same level';
      const html = quikdown(md);
      expect(html).toContain('<ul');
      expect(html).toContain('<ol');
    });

    test('should test fence with bidirectional and no language', () => {
      const html = quikdown('```\ncode\n```', { bidirectional: true });
      expect(html).toContain('data-qd-fence');
      expect(html).not.toContain('data-qd-lang=');
    });

    test('should test image sanitization with allow_unsafe_urls', () => {
      // Parentheses in URL get cut off
      const html = quikdown('![test](javascript:alert(1))', { allow_unsafe_urls: true });
      expect(html).toContain('src="javascript:alert(1"');
      
      // Test without parentheses
      const html2 = quikdown('![test](javascript:void)', { allow_unsafe_urls: true });
      expect(html2).toContain('src="javascript:void"');
    });

    test('should test bidirectional link without data-qd-text', () => {
      const html = quikdown('[](url)', { bidirectional: true });
      // Empty link text
      expect(html).toContain('](url)'); // Not converted to link
    });
  });
});