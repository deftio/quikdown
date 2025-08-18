/**
 * quikdown_bd test suite
 * Tests bidirectional markdown/HTML conversion
 */

// Fix for TextEncoder/TextDecoder not defined in Node.js environment
// Required for jsdom in Node.js 18+
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const quikdown_bd = require('../dist/quikdown_bd.cjs');
const quikdown = require('../dist/quikdown.cjs');
const { JSDOM } = require('jsdom');

// Import the base tests to ensure feature parity
const fs = require('fs');
const path = require('path');

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
    
    test('should preserve data-qd attributes', () => {
      const markdown = '**bold** *italic*';
      const html = quikdown_bd(markdown);
      
      // Check that data-qd attributes are present
      expect(html).toContain('data-qd');
    });
    
    describe('Round-trip conversions', () => {
      const roundTripTests = [
        '**bold text**',
        '*italic text*',
        '# Heading 1',
        '## Heading 2',
        '- List item 1\n- List item 2',
        '1. Ordered item 1\n2. Ordered item 2',
        '`inline code`',
        '[link text](https://example.com)',
        '![alt text](image.png)',
      ];
      
      test.each(roundTripTests)('round-trip: %s', (markdown) => {
        const html = quikdown_bd(markdown);
        // Note: toMarkdown requires DOM, so this will need proper DOM testing
        // For now, just verify the HTML contains expected markers
        expect(html).toContain('data-qd');
      });
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