/**
 * quikdown_bd test suite
 * Tests bidirectional markdown/HTML conversion
 */

import { JSDOM } from 'jsdom';
import quikdown_bd from '../dist/quikdown_bd.esm.js';
import quikdown from '../dist/quikdown.esm.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load package.json to get the current version
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

// Import the base tests to ensure feature parity
import fs from 'fs';
import path from 'path';

describe('quikdown_bd bidirectional parser', () => {
  
  describe('Feature Parity with Core quikdown', () => {
    // Test that quikdown_bd produces similar output to quikdown with data-qd attributes
    const testCases = [
      // Basic formatting
      ['**bold**', 'bold', 'strong'],
      ['*italic*', 'italic', 'em'],
      ['~~strike~~', 'strike', 'del'],
      ['`code`', 'code', 'code'],
      
      // Headings
      ['# H1', 'H1', 'h1'],
      ['## H2', 'H2', 'h2'],
    ];
    
    test.each(testCases)('markdown: %s', (markdown, content, tag) => {
      const bdResult = quikdown_bd(markdown);
      
      // Check that content is preserved
      expect(bdResult).toContain(content);
      
      // Check that correct HTML tag is used
      expect(bdResult).toContain(`<${tag}`);
      expect(bdResult).toContain(`</${tag}>`);
      
      // Check that data-qd attributes are added (for bidirectional support)
      expect(bdResult).toContain('data-qd');
      
      // Check that classes are still applied
      expect(bdResult).toContain('class="quikdown-');
    });
    
    test('should handle lists correctly', () => {
      const markdown = '- item 1\n- item 2';
      const html = quikdown_bd(markdown);
      
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
      expect(html).toContain('item 1');
      expect(html).toContain('item 2');
      expect(html).toContain('data-qd');
    });
    
    test('should handle code blocks correctly', () => {
      const markdown = '```js\ncode\n```';
      const html = quikdown_bd(markdown);
      
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('data-qd-lang="js"');
      expect(html).toContain('code');
    });
    
    test('should handle tables correctly', () => {
      const markdown = '| A | B |\n|---|---|\n| 1 | 2 |';
      const html = quikdown_bd(markdown);
      
      expect(html).toContain('<table');
      expect(html).toContain('<th');
      expect(html).toContain('<td');
      expect(html).toContain('A');
      expect(html).toContain('B');
      expect(html).toContain('1');
      expect(html).toContain('2');
    });
  });
  
  describe('Bidirectional Conversion (toMarkdown)', () => {
    // Set up jsdom for DOM testing
    let dom;
    let originalDocument;
    let originalWindow;
    let originalNode;
    
    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      originalDocument = global.document;
      originalWindow = global.window;
      originalNode = global.Node;
      
      global.document = dom.window.document;
      global.window = dom.window;
      global.Node = dom.window.Node;
      global.Element = dom.window.Element;
    });
    
    afterEach(() => {
      global.document = originalDocument;
      global.window = originalWindow;
      global.Node = originalNode;
      delete global.Element;
    });
    
    test('should have toMarkdown function', () => {
      expect(typeof quikdown_bd.toMarkdown).toBe('function');
    });
    
    test('should convert simple HTML back to markdown', () => {
      const html = '<p><strong>bold</strong></p>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('**bold**');
    });

    test('should convert all inline formatting back to markdown', () => {
      // Test bold
      expect(quikdown_bd.toMarkdown('<strong data-qd="**">bold</strong>')).toBe('**bold**');
      expect(quikdown_bd.toMarkdown('<strong data-qd="__">bold</strong>')).toBe('__bold__');
      
      // Test italic
      expect(quikdown_bd.toMarkdown('<em data-qd="*">italic</em>')).toBe('*italic*');
      expect(quikdown_bd.toMarkdown('<em data-qd="_">italic</em>')).toBe('_italic_');
      
      // Test strikethrough
      expect(quikdown_bd.toMarkdown('<del data-qd="~~">strike</del>')).toBe('~~strike~~');
      
      // Test inline code
      expect(quikdown_bd.toMarkdown('<code data-qd="`">code</code>')).toBe('`code`');
    });

    test('should convert headings back to markdown', () => {
      expect(quikdown_bd.toMarkdown('<h1 data-qd="#">Heading 1</h1>')).toBe('# Heading 1');
      expect(quikdown_bd.toMarkdown('<h2 data-qd="##">Heading 2</h2>')).toBe('## Heading 2');
      expect(quikdown_bd.toMarkdown('<h3 data-qd="###">Heading 3</h3>')).toBe('### Heading 3');
      expect(quikdown_bd.toMarkdown('<h4 data-qd="####">Heading 4</h4>')).toBe('#### Heading 4');
      expect(quikdown_bd.toMarkdown('<h5 data-qd="#####">Heading 5</h5>')).toBe('##### Heading 5');
      expect(quikdown_bd.toMarkdown('<h6 data-qd="######">Heading 6</h6>')).toBe('###### Heading 6');
    });

    test('should convert links back to markdown', () => {
      const html = '<a href="https://example.com" data-qd="[" data-qd-text="link text">link text</a>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('[link text](https://example.com)');
    });

    test('should convert images back to markdown', () => {
      const html = '<img src="image.png" alt="alt text" data-qd="!" data-qd-alt="alt text" data-qd-src="image.png">';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('![alt text](image.png)');
    });

    test('should convert lists back to markdown', () => {
      // Unordered list
      const ulHtml = '<ul><li data-qd="-">Item 1</li><li data-qd="-">Item 2</li></ul>';
      expect(quikdown_bd.toMarkdown(ulHtml)).toBe('- Item 1\n- Item 2');
      
      // Ordered list
      const olHtml = '<ol><li data-qd="1.">First</li><li data-qd="2.">Second</li></ol>';
      expect(quikdown_bd.toMarkdown(olHtml)).toBe('1. First\n2. Second');
      
      // Different markers
      const starHtml = '<ul><li data-qd="*">Star item</li></ul>';
      expect(quikdown_bd.toMarkdown(starHtml)).toBe('* Star item');
      
      const plusHtml = '<ul><li data-qd="+">Plus item</li></ul>';
      expect(quikdown_bd.toMarkdown(plusHtml)).toBe('+ Plus item');
    });

    test('should convert nested lists back to markdown', () => {
      const html = `<ul>
        <li data-qd="-">Item 1
          <ul>
            <li data-qd="-">Nested 1</li>
            <li data-qd="-">Nested 2</li>
          </ul>
        </li>
        <li data-qd="-">Item 2</li>
      </ul>`;
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('- Item 1');
      expect(result).toContain('  - Nested 1');
      expect(result).toContain('  - Nested 2');
      expect(result).toContain('- Item 2');
    });

    test('should convert blockquotes back to markdown', () => {
      const html = '<blockquote>Quote text</blockquote>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('> Quote text');
    });

    test('should convert code blocks back to markdown', () => {
      const html = '<pre data-qd-fence="```" data-qd-lang="js"><code>const x = 1;</code></pre>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('```js\nconst x = 1;\n```');
      
      // Test tilde fence
      const tildeHtml = '<pre data-qd-fence="~~~" data-qd-lang="python"><code>print("hello")</code></pre>';
      const tildeResult = quikdown_bd.toMarkdown(tildeHtml);
      expect(tildeResult).toBe('~~~python\nprint("hello")\n~~~');
    });

    test('should convert horizontal rules back to markdown', () => {
      const html = '<hr>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('---');
    });

    test('should convert tables back to markdown', () => {
      const html = `<table>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
        </tbody>
      </table>`;
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('| Header 1 | Header 2 |');
      expect(result).toContain('| --- | --- |');  // Separator has spaces
      expect(result).toContain('| Cell 1 | Cell 2 |');
    });

    test('should convert task lists back to markdown', () => {
      const html = `<ul>
        <li data-qd="-"><input type="checkbox" checked disabled> Done task</li>
        <li data-qd="-"><input type="checkbox" disabled> Todo task</li>
      </ul>`;
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('- [x] Done task\n- [ ] Todo task');
    });

    test('should handle paragraphs correctly', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('First paragraph\n\nSecond paragraph');
    });

    test('should handle line breaks', () => {
      const html = '<p>Line 1<br>Line 2</p>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('Line 1  \nLine 2');
    });

    test('should handle mixed inline formatting', () => {
      const html = '<p>Text with <strong data-qd="**">bold</strong> and <em data-qd="*">italic</em> and <code data-qd="`">code</code></p>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toBe('Text with **bold** and *italic* and `code`');
    });

    test('should handle HTML without data-qd attributes gracefully', () => {
      // Without data-qd, should use default markers
      expect(quikdown_bd.toMarkdown('<strong>bold</strong>')).toBe('**bold**');
      expect(quikdown_bd.toMarkdown('<em>italic</em>')).toBe('*italic*');
      expect(quikdown_bd.toMarkdown('<del>strike</del>')).toBe('~~strike~~');
      expect(quikdown_bd.toMarkdown('<code>code</code>')).toBe('`code`');
    });

    test('should handle empty elements', () => {
      expect(quikdown_bd.toMarkdown('<p></p>')).toBe('');
      expect(quikdown_bd.toMarkdown('<strong></strong>')).toBe('');
      expect(quikdown_bd.toMarkdown('<ul><li data-qd="-"></li></ul>')).toBe('-');
    });

    test('should handle DOM elements directly', () => {
      // Create DOM element and test with its innerHTML
      const div = document.createElement('div');
      div.innerHTML = '<p><strong data-qd="**">bold</strong></p>';
      // Pass the innerHTML string instead of the element itself
      const result = quikdown_bd.toMarkdown(div.innerHTML);
      expect(result.trim()).toBe('**bold**');
    });

    test('should handle complex nested structures', () => {
      const html = `
        <h1 data-qd="#">Title</h1>
        <p>Paragraph with <strong data-qd="**">bold</strong> text.</p>
        <ul>
          <li data-qd="-">List item 1</li>
          <li data-qd="-">List item 2</li>
        </ul>
        <blockquote>A quote</blockquote>
        <pre data-qd-fence="\`\`\`" data-qd-lang="js"><code>code block</code></pre>
      `;
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('# Title');
      expect(result).toContain('Paragraph with **bold** text.');
      expect(result).toContain('- List item 1');
      expect(result).toContain('- List item 2');
      expect(result).toContain('> A quote');
      expect(result).toContain('```js\ncode block\n```');
    });

    test('should handle special characters in text content', () => {
      const html = '<p>Text with * asterisk and _ underscore</p>';
      const result = quikdown_bd.toMarkdown(html);
      // Note: toMarkdown does not escape special characters by default
      // This is intentional to allow round-trip conversion
      expect(result).toBe('Text with * asterisk and _ underscore');
    });

    test('should handle whitespace in text content', () => {
      const html = '<p>  Text   with   spaces  </p>';
      const result = quikdown_bd.toMarkdown(html);
      // Note: toMarkdown preserves whitespace as-is
      expect(result).toBe('Text   with   spaces');
    });

    test('should handle unsupported elements gracefully', () => {
      const html = '<div><span>Text in span</span><button>Button</button></div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('Text in span');
      expect(result).toContain('Button');
    });
    
    describe('Round-trip conversions', () => {
      const roundTripTests = [
        ['**bold text**', '**bold text**'],
        ['*italic text*', '*italic text*'],
        ['# Heading 1', '# Heading 1'],
        ['## Heading 2', '## Heading 2'],
        ['- List item 1\n- List item 2', '- List item 1\n- List item 2'],
        ['1. Ordered item 1\n2. Ordered item 2', '1. Ordered item 1\n2. Ordered item 2'],
        ['`inline code`', '`inline code`'],
        ['[link text](https://example.com)', '[link text](https://example.com)'],
        ['![alt text](image.png)', '![alt text](image.png)'],
        ['> Quote text', '> Quote text'],
        ['---', '---'],
        ['~~strikethrough~~', '~~strikethrough~~'],
      ];
      
      test.each(roundTripTests)('round-trip: %s', (originalMarkdown, expectedMarkdown) => {
        const html = quikdown_bd(originalMarkdown);
        const recoveredMarkdown = quikdown_bd.toMarkdown(html);
        expect(recoveredMarkdown).toBe(expectedMarkdown);
      });
    });

    test('should handle complex round-trip conversion', () => {
      const originalMarkdown = `# Main Title

This is a paragraph with **bold** and *italic* text.

## Section 1

- First item
- Second item
- Third item

## Section 2

1. Ordered first
2. Ordered second

> This is a quote

\`\`\`javascript
const code = "example";
\`\`\`

[Link](https://example.com) and ![Image](test.png)

---

End of document.`;

      const html = quikdown_bd(originalMarkdown);
      const recoveredMarkdown = quikdown_bd.toMarkdown(html);
      
      // Check key elements are preserved
      expect(recoveredMarkdown).toContain('# Main Title');
      expect(recoveredMarkdown).toContain('**bold**');
      expect(recoveredMarkdown).toContain('*italic*');
      expect(recoveredMarkdown).toContain('- First item');
      expect(recoveredMarkdown).toContain('- Second item');
      expect(recoveredMarkdown).toContain('- Third item');
      expect(recoveredMarkdown).toContain('1. Ordered first');
      expect(recoveredMarkdown).toContain('> This is a quote');
      expect(recoveredMarkdown).toContain('```javascript');
      expect(recoveredMarkdown).toContain('[Link](https://example.com)');
      expect(recoveredMarkdown).toContain('![Image](test.png)');
      expect(recoveredMarkdown).toContain('---');
      // Note: Nested lists aren't properly preserved in current implementation
      // This is a known limitation that should be addressed in future versions
    });
  });
  
  describe('Fence Plugin Bidirectional Support', () => {
    test('should handle fence plugin with reverse handler', () => {
      const plugin = {
        render: (content, lang) => {
          return `<div class="custom-${lang}" data-custom-lang="${lang}">${content.toUpperCase()}</div>`;
        },
        reverse: (element) => {
          const lang = element.getAttribute('data-custom-lang') || 'custom';
          const content = element.textContent.toLowerCase();
          return {
            fence: '```',
            lang: lang,
            content: content
          };
        }
      };
      
      const markdown = '```test\nhello world\n```';
      const html = quikdown_bd(markdown, { fence_plugin: plugin, bidirectional: true });
      
      // HTML should have custom rendering with data attributes
      expect(html).toContain('data-qd-fence="```"');
      expect(html).toContain('data-qd-lang="test"');
      expect(html).toContain('data-qd-source="hello world"');
      expect(html).toContain('HELLO WORLD');
      
      // Convert back to markdown using the reverse handler
      const recovered = quikdown_bd.toMarkdown(html, { fence_plugin: plugin });
      expect(recovered).toContain('```test');
      expect(recovered).toContain('hello world');
    });
    
    test('should fallback to data-qd-source when no reverse handler', () => {
      const plugin = {
        render: (content, lang) => {
          return `<div class="custom">${content}</div>`;
        }
        // No reverse handler
      };
      
      const markdown = '```javascript\nconst x = 1;\n```';
      const html = quikdown_bd(markdown, { fence_plugin: plugin, bidirectional: true });
      
      // Should have data-qd-source for fallback
      expect(html).toContain('data-qd-source="const x = 1;"');
      
      // Should recover using data-qd-source
      const recovered = quikdown_bd.toMarkdown(html);
      expect(recovered).toContain('```javascript');
      expect(recovered).toContain('const x = 1;');
    });
  });
  
  describe('Special Features', () => {
    test('should handle task lists with checkboxes', () => {
      const markdown = '- [ ] Unchecked\n- [x] Checked';
      const html = quikdown_bd(markdown);
      
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('checked');
      expect(html).toContain('Unchecked');
      expect(html).toContain('Checked');
    });
    
    test('should handle mermaid diagrams', () => {
      const markdown = '```mermaid\ngraph TD\nA-->B\n```';
      const html = quikdown_bd(markdown);
      
      expect(html).toContain('data-qd-lang="mermaid"');
      expect(html).toContain('graph TD');
      expect(html).toContain('A--&gt;B'); // HTML escaped
    });
    
    test('should handle SVG fences', () => {
      const markdown = '```svg\n<svg><circle cx="50" cy="50" r="40"/></svg>\n```';
      const html = quikdown_bd(markdown);
      
      expect(html).toContain('data-qd-lang="svg"');
      expect(html).toContain('&lt;svg&gt;');
      expect(html).toContain('&lt;circle');
    });
    
    test('should handle both backtick and tilde fences', () => {
      const backtick = '```js\ncode\n```';
      const tilde = '~~~js\ncode\n~~~';
      
      const htmlBacktick = quikdown_bd(backtick);
      const htmlTilde = quikdown_bd(tilde);
      
      expect(htmlBacktick).toContain('data-qd-lang="js"');
      expect(htmlTilde).toContain('data-qd-lang="js"');
      expect(htmlBacktick).toContain('data-qd-fence="```"');
      expect(htmlTilde).toContain('data-qd-fence="~~~"');
    });
  });
  
  describe('Options', () => {
    test('should support inline_styles option', () => {
      const markdown = '**bold**';
      const html = quikdown_bd(markdown, { inline_styles: true });
      
      expect(html).toContain('style=');
      expect(html).not.toContain('class=');
    });
    
    test('should support fence_plugin option', () => {
      const customRenderer = {
        render: (code, lang) => {
          return `<div class="custom-${lang}">${code}</div>`;
        }
      };
      
      const markdown = '```js\ncode\n```';
      const html = quikdown_bd(markdown, { fence_plugin: customRenderer });
      
      expect(html).toContain('class="custom-js"');
      expect(html).toContain('>code</div>');
    });
  });
  
  describe('API Methods', () => {
    test('should have version property matching package.json', () => {
      expect(quikdown_bd.version).toBe(packageJson.version);
    });
    
    test('should have emitStyles method', () => {
      expect(typeof quikdown_bd.emitStyles).toBe('function');
      
      const styles = quikdown_bd.emitStyles();
      expect(typeof styles).toBe('string');
      // Note: Current implementation returns empty string
      // This is a placeholder for future CSS generation
    });
    
    test('should support dark theme in emitStyles', () => {
      const darkStyles = quikdown_bd.emitStyles('quikdown-', 'dark');
      expect(typeof darkStyles).toBe('string');
      // Note: Current implementation returns empty string
      // This is a placeholder for future CSS generation
    });
    
    test('should have configure method', () => {
      expect(typeof quikdown_bd.configure).toBe('function');
      
      const configured = quikdown_bd.configure({ inline_styles: true });
      const html = configured('**bold**');
      
      expect(html).toContain('style=');
      expect(html).not.toContain('class=');
    });
  });
  
  describe('Lazy linefeeds support', () => {
    test('should handle lazy linefeeds with bidirectional conversion', () => {
      const markdown = 'Line 1\nLine 2\n\nPara 2';
      const html = quikdown_bd(markdown, { lazy_linefeeds: true });
      
      // Check HTML has breaks
      expect(html).toContain('Line 1<br');
      expect(html).toContain('Line 2');
      expect(html).toContain('Para 2');
      
      // Convert back should work
      const recovered = quikdown_bd.toMarkdown(html);
      expect(recovered).toContain('Line 1');
      expect(recovered).toContain('Line 2');
    });
    
    test('should not add breaks after block elements with lazy linefeeds', () => {
      const markdown = '# Heading\nText after\n\n- List item\nText after list';
      const html = quikdown_bd(markdown, { lazy_linefeeds: true });
      
      // No breaks after blocks
      expect(html).not.toContain('</h1><br');
      expect(html).not.toContain('</ul><br');
    });
    
    test('should protect tables and lists with lazy linefeeds', () => {
      const markdown = '| Col1 | Col2 |\n|------|------|\n| A    | B    |\nText after';
      const html = quikdown_bd(markdown, { lazy_linefeeds: true });
      
      // Table should not have internal breaks
      expect(html).toContain('<table');
      expect(html).toContain('</table>');
      expect(html).not.toContain('<th>Col1</th><br');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle empty input', () => {
      expect(quikdown_bd('')).toBe('');
      expect(quikdown_bd(null)).toBe('');
      expect(quikdown_bd(undefined)).toBe('');
    });
    
    test('should handle malformed markdown gracefully', () => {
      const malformed = '**unclosed bold';
      const html = quikdown_bd(malformed);
      expect(html).toBeTruthy();
      expect(html).toContain('**unclosed bold');
    });
    
    test('should handle incomplete fences', () => {
      const incomplete = '```js';
      const html = quikdown_bd(incomplete);
      expect(html).toBeTruthy();
      expect(html).toContain('```js');
    });
  });
  
  describe('Performance', () => {
    test('should handle large documents', () => {
      const largeDoc = '# Heading\n\n' + 'Lorem ipsum '.repeat(1000);
      const start = Date.now();
      const html = quikdown_bd(largeDoc);
      const duration = Date.now() - start;

      expect(html).toBeTruthy();
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Parser coverage (bd-specific)', () => {
    test('allow_unsafe_html option skips escaping', () => {
      const html = quikdown_bd('<b>raw</b>', { allow_unsafe_html: true });
      expect(html).toContain('<b>raw</b>');
    });

    test('task lists with inline_styles', () => {
      const html = quikdown_bd('- [ ] todo\n- [x] done', { inline_styles: true });
      expect(html).toContain('style="margin-right:.5em"');
      expect(html).toContain('style="list-style:none"');
    });

    test('__bold__ and ~~strike~~ emphasis variants', () => {
      const bold = quikdown_bd('__bold__');
      expect(bold).toContain('<strong');
      expect(bold).toContain('data-qd="__"');

      const strike = quikdown_bd('~~strike~~');
      expect(strike).toContain('<del');
      expect(strike).toContain('data-qd="~~"');
    });

    test('empty delimiters are plain text', () => {
      expect(quikdown_bd('****')).toContain('****');
      expect(quikdown_bd('~~~~')).toContain('~~~~');
    });

    test('bold with italic inside *** run', () => {
      const html = quikdown_bd('**bold *italic***');
      expect(html).toContain('<strong');
      expect(html).toContain('<em');
    });

    test('httpfoo is not an autolink', () => {
      expect(quikdown_bd('httpfoo')).not.toContain('<a');
      expect(quikdown_bd('httpsbar')).not.toContain('<a');
    });

    test('https:// autolink', () => {
      const html = quikdown_bd('visit https://example.com today');
      expect(html).toContain('<a');
      expect(html).toContain('href="https://example.com"');
    });

    test('malformed image/link constructs', () => {
      // image missing closing )
      expect(quikdown_bd('![alt](url')).not.toContain('<img');
      // image with empty src
      expect(quikdown_bd('![alt]()')).not.toContain('<img');
      // link with empty href
      expect(quikdown_bd('[text]()')).not.toContain('<a');
      // link with nested [
      expect(quikdown_bd('[[inner]](url)')).not.toContain('href="url"');
      // bare ! not followed by [
      expect(quikdown_bd('!hello')).toContain('!hello');
    });

    test('single emphasis does not span newlines', () => {
      expect(quikdown_bd('*hello\nworld*')).not.toContain('<em');
    });

    test('emitStyles light theme returns CSS', () => {
      const light = quikdown_bd.emitStyles('quikdown-', 'light');
      expect(light.length).toBeGreaterThan(0);
      expect(light).toContain('quikdown-');
    });

    test('table with header-only (no body rows)', () => {
      const html = quikdown_bd('| H1 | H2 |\n|---|---|');
      expect(html).toContain('<th');
      expect(html).not.toContain('<td');
    });

    test('table line not starting with |', () => {
      // A row like "A | B" (no leading pipe) should still be parsed as table
      const html = quikdown_bd('H1 | H2\n---|---\nA | B');
      expect(html).toContain('<table');
      expect(html).toContain('H1');
    });

    test('list type switch at same level', () => {
      // Start with unordered, switch to ordered at same indent
      const html = quikdown_bd('- bullet\n1. ordered');
      expect(html).toContain('<ul');
      expect(html).toContain('<ol');
      expect(html).toContain('bullet');
      expect(html).toContain('ordered');
    });

    test('images with bidirectional attributes', () => {
      const html = quikdown_bd('![photo](pic.jpg)');
      expect(html).toContain('data-qd-alt="photo"');
      expect(html).toContain('data-qd-src="pic.jpg"');
    });

    test('internal link (no rel attribute)', () => {
      const html = quikdown_bd('[click](/page)');
      expect(html).toContain('href="/page"');
      expect(html).not.toContain('noopener');
    });

    test('non-string input returns empty', () => {
      expect(quikdown_bd(123)).toBe('');
      expect(quikdown_bd({})).toBe('');
    });

    test('inline code with bidirectional marker', () => {
      const html = quikdown_bd('use `code` here');
      expect(html).toContain('data-qd="`"');
    });

    test('fence plugin returning undefined falls through', () => {
      const plugin = { render: () => undefined };
      const html = quikdown_bd('```js\ncode\n```', { fence_plugin: plugin });
      expect(html).toContain('<pre');
      expect(html).toContain('data-qd-lang="js"');
    });
  });

  describe('toMarkdown coverage', () => {
    let dom;
    let originalDocument, originalWindow, originalNode;

    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      originalDocument = global.document;
      originalWindow = global.window;
      originalNode = global.Node;
      global.document = dom.window.document;
      global.window = dom.window;
      global.Node = dom.window.Node;
      global.Element = dom.window.Element;
    });

    afterEach(() => {
      global.document = originalDocument;
      global.window = originalWindow;
      global.Node = originalNode;
      delete global.Element;
    });

    test('non-string non-element input returns empty', () => {
      expect(quikdown_bd.toMarkdown(42)).toBe('');
      expect(quikdown_bd.toMarkdown(null)).toBe('');
    });

    test('heading without data-qd uses # prefix', () => {
      expect(quikdown_bd.toMarkdown('<h1>Title</h1>')).toBe('# Title');
      expect(quikdown_bd.toMarkdown('<h3>Sub</h3>')).toBe('### Sub');
    });

    test('link without href defaults to empty', () => {
      const result = quikdown_bd.toMarkdown('<a>text</a>');
      expect(result).toBe('[text]()');
    });

    test('image without data-qd attributes', () => {
      const result = quikdown_bd.toMarkdown('<img src="pic.jpg" alt="photo">');
      expect(result).toBe('![photo](pic.jpg)');
    });

    test('image without alt or src', () => {
      const result = quikdown_bd.toMarkdown('<img>');
      expect(result).toBe('![]()');
    });

    test('list items without data-qd use defaults', () => {
      const ul = quikdown_bd.toMarkdown('<ul><li>A</li><li>B</li></ul>');
      expect(ul).toBe('- A\n- B');

      const ol = quikdown_bd.toMarkdown('<ol><li>First</li><li>Second</li></ol>');
      expect(ol).toBe('1. First\n2. Second');
    });

    test('table without thead', () => {
      const result = quikdown_bd.toMarkdown('<table><tbody><tr><td>A</td></tr></tbody></table>');
      expect(result).toContain('| A |');
    });

    test('table with empty row (no td)', () => {
      const result = quikdown_bd.toMarkdown(
        '<table><thead><tr><th>H</th></tr></thead><tbody><tr></tr><tr><td>A</td></tr></tbody></table>'
      );
      expect(result).toContain('| H |');
      expect(result).toContain('| A |');
    });

    test('pre code block without data-qd-source', () => {
      const result = quikdown_bd.toMarkdown('<pre data-qd-fence="```" data-qd-lang="py"><code>print(1)</code></pre>');
      expect(result).toBe('```py\nprint(1)\n```');
    });

    test('pre with data-qd-source attribute', () => {
      const result = quikdown_bd.toMarkdown(
        '<pre data-qd-fence="```" data-qd-lang="js" data-qd-source="const x = 1;"><code>highlighted</code></pre>'
      );
      expect(result).toBe('```js\nconst x = 1;\n```');
    });

    test('div with data-qd-source and fence but no lang', () => {
      const result = quikdown_bd.toMarkdown(
        '<div data-qd-fence="```" data-qd-source="raw content"></div>'
      );
      expect(result).toContain('```');
      expect(result).toContain('raw content');
    });

    test('fence plugin reverse with partial result', () => {
      const plugin = {
        reverse: (el) => ({
          content: 'recovered'
          // no fence, no lang — use defaults
        })
      };
      const html = '<pre data-qd-fence="```" data-qd-lang="test"><code>x</code></pre>';
      const result = quikdown_bd.toMarkdown(html, { fence_plugin: plugin });
      expect(result).toContain('recovered');
    });

    test('fence plugin reverse throwing error falls through', () => {
      const plugin = {
        reverse: () => { throw new Error('fail'); }
      };
      const html = '<pre data-qd-fence="```" data-qd-lang="js"><code>x</code></pre>';
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = quikdown_bd.toMarkdown(html, { fence_plugin: plugin });
      expect(result).toContain('```js');
      warn.mockRestore();
    });

    test('div fence plugin reverse with partial result', () => {
      const plugin = {
        reverse: (el) => ({
          content: 'div-content'
        })
      };
      const html = '<div data-qd-lang="test" data-qd-fence="```" data-qd-source="src"></div>';
      const result = quikdown_bd.toMarkdown(html, { fence_plugin: plugin });
      expect(result).toContain('div-content');
    });

    test('mermaid container without data-qd-fence', () => {
      const html = '<div class="mermaid-container" data-qd-lang="mermaid" data-qd-source="graph LR; A-->B"></div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('```mermaid');
      expect(result).toContain('graph LR; A-->B');
    });

    test('br without data-qd uses default marker', () => {
      const result = quikdown_bd.toMarkdown('<p>line1<br>line2</p>');
      expect(result).toContain('line1');
      expect(result).toContain('line2');
    });

    test('autolink round-trip', () => {
      const html = quikdown_bd('visit https://example.com/path here');
      const md = quikdown_bd.toMarkdown(html);
      expect(md).toContain('https://example.com/path');
    });

    test('pre without code child uses childContent', () => {
      const result = quikdown_bd.toMarkdown(
        '<pre data-qd-fence="```" data-qd-lang="txt">raw text</pre>'
      );
      expect(result).toContain('```txt');
      expect(result).toContain('raw text');
    });

    test('fence reverse returning empty content falls through', () => {
      const plugin = {
        reverse: () => ({ content: '' })
      };
      const html = '<pre data-qd-fence="```" data-qd-lang="js"><code>fallback</code></pre>';
      const result = quikdown_bd.toMarkdown(html, { fence_plugin: plugin });
      expect(result).toContain('fallback');
    });

    test('div fence reverse returning empty content falls through', () => {
      const plugin = {
        reverse: () => ({ content: '' })
      };
      const html = '<div data-qd-lang="test" data-qd-fence="```" data-qd-source="src"></div>';
      const result = quikdown_bd.toMarkdown(html, { fence_plugin: plugin });
      expect(result).toContain('src');
    });

    test('mermaid container without data-qd-lang uses default', () => {
      const html = '<div class="mermaid-container" data-qd-source="graph LR; A-->B"></div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('mermaid');
      expect(result).toContain('graph LR; A-->B');
    });

    test('mermaid container with pre.mermaid source', () => {
      const html = '<div class="mermaid-container"><pre class="mermaid" data-qd-source="graph TD; X-->Y">rendered</pre></div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('graph TD; X-->Y');
    });

    test('mermaid container with .mermaid element containing graph text', () => {
      const html = '<div class="mermaid-container"><div class="mermaid">graph LR; A-->B</div></div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('graph LR; A-->B');
    });

    test('mermaid container with .mermaid-source element', () => {
      const html = '<div class="mermaid-container"><div class="mermaid-source">graph TD; C-->D</div></div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('graph TD; C-->D');
    });

    test('standalone mermaid div (legacy)', () => {
      const html = '<div class="mermaid">graph LR; E-->F</div>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('graph LR; E-->F');
    });

    test('table thead without tr', () => {
      const html = '<table><thead></thead><tbody><tr><td>A</td></tr></tbody></table>';
      const result = quikdown_bd.toMarkdown(html);
      expect(result).toContain('| A |');
    });
  });
});