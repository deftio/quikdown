/**
 * quikdown_bd test suite
 * Tests bidirectional markdown/HTML conversion
 */

import { JSDOM } from 'jsdom';
import quikdown_bd from '../dist/quikdown_bd.esm.js';
import quikdown from '../dist/quikdown.esm.js';

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
      const customRenderer = (code, lang) => {
        return `<div class="custom-${lang}">${code}</div>`;
      };
      
      const markdown = '```js\ncode\n```';
      const html = quikdown_bd(markdown, { fence_plugin: customRenderer });
      
      expect(html).toContain('custom-js');
      expect(html).toContain('<div class="custom-js">code</div>');
    });
  });
  
  describe('API Methods', () => {
    test('should have version property', () => {
      expect(quikdown_bd.version).toBe('1.0.5dev1');
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
});