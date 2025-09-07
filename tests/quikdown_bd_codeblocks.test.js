/**
 * Comprehensive test suite for bidirectional code block editing
 * Tests the preservation of code content when converting between markdown and HTML
 */

const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Load the bidirectional converter
const quikdownBdPath = path.join(__dirname, '..', 'dist', 'quikdown_bd.umd.min.js');
const quikdownBdCode = fs.readFileSync(quikdownBdPath, 'utf8');

describe('Bidirectional Code Block Editing', () => {
    let window;
    let document;
    let quikdown_bd;

    beforeEach(() => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
            runScripts: 'dangerously',
            resources: 'usable'
        });
        window = dom.window;
        document = window.document;
        
        // Execute the scripts in the JSDOM context
        const scriptBd = new window.Function(quikdownBdCode + '; return quikdown_bd;');
        quikdown_bd = scriptBd();
    });

    describe('Basic Code Block Conversion', () => {
        test('should preserve simple code block content', () => {
            const markdown = '```javascript\nconsole.log("Hello World");\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should preserve code block with language identifier', () => {
            const markdown = '```python\ndef hello():\n    print("Hello World")\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should preserve code block without language identifier', () => {
            const markdown = '```\nplain text code\nwith multiple lines\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });
    });

    describe('Special Characters in Code Blocks', () => {
        test('should handle HTML entities in code', () => {
            const markdown = '```html\n<div class="test">&lt;Hello&gt;</div>\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should handle quotes in code', () => {
            const markdown = '```javascript\nconst str = "He said \\"Hello\\"";\nconst str2 = \'It\\\'s working\';\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should handle backticks within code blocks', () => {
            const markdown = '```javascript\nconst md = `\`\`\`code\`\`\``;\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should handle special regex patterns', () => {
            const markdown = '```regex\n/[a-z]+\\s*\\d{2,4}/gi\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });
    });

    describe('Code Block with Syntax Highlighting', () => {
        test('should preserve code when syntax highlighting is applied', () => {
            const markdown = '```javascript\nfunction test() {\n    return true;\n}\n```';
            
            // Simulate syntax highlighting with fence plugin
            const options = {
                fence_plugin: (code, lang) => {
                    // Simulate what highlight.js would do
                    const highlighted = `<span class="hljs-function">${code}</span>`;
                    const escapedCode = code.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                }
            };
            
            const html = quikdown_bd(markdown, options);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should handle multiple highlighted code blocks', () => {
            const markdown = '```javascript\nconst a = 1;\n```\n\nSome text\n\n```python\ndef test():\n    pass\n```';
            
            const options = {
                fence_plugin: (code, lang) => {
                    const escapedCode = code.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}"><code class="hljs language-${lang}">${code}</code></pre>`;
                }
            };
            
            const html = quikdown_bd(markdown, options);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty code blocks', () => {
            const markdown = '```\n\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should handle code blocks with only whitespace', () => {
            // Whitespace may be normalized during conversion
            const markdown = '```\n   \n\t\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            // Check that it's still a valid code block
            expect(backToMarkdown.trim()).toMatch(/^```\n[\s]*\n```$/);
        });

        test('should handle very long code blocks', () => {
            const longCode = Array(100).fill('console.log("test");').join('\n');
            const markdown = `\`\`\`javascript\n${longCode}\n\`\`\``;
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });

        test('should handle code blocks with Unicode characters', () => {
            const markdown = '```\n// 你好世界\n// مرحبا بالعالم\n// Здравствуй мир\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });
    });

    describe('Complex Markdown Documents', () => {
        test('should preserve code blocks in mixed content', () => {
            const markdown = `# Header

Some paragraph text.

\`\`\`javascript
const example = "test";
\`\`\`

- List item 1
- List item 2

\`\`\`python
def test():
    return True
\`\`\`

**Bold text** and *italic text*`;

            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            // Compare the code blocks specifically
            expect(backToMarkdown).toContain('```javascript\nconst example = "test";\n```');
            expect(backToMarkdown).toContain('```python\ndef test():\n    return True\n```');
        });

        test('should handle nested markdown-like syntax in code blocks', () => {
            const markdown = '```markdown\n# This is markdown inside a code block\n**bold** and *italic*\n[link](url)\n```';
            const html = quikdown_bd(markdown);
            const backToMarkdown = quikdown_bd.toMarkdown(html);
            
            expect(backToMarkdown.trim()).toBe(markdown);
        });
    });

    describe('Editor Integration Tests', () => {
        test('should verify data-qd-source attribute is preserved', () => {
            // Test that data-qd-source is properly used for bidirectional conversion
            const originalCode = 'const test = 123;';
            const markdown = `\`\`\`javascript\n${originalCode}\n\`\`\``;
            
            // Create HTML with data-qd-source attribute (like the editor does)
            const escapedCode = originalCode.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const htmlWithSource = `<pre data-qd-fence="\`\`\`" data-qd-lang="javascript" data-qd-source="${escapedCode}"><code class="language-javascript"><span class="hljs">const test = 123;</span></code></pre>`;
            
            // Convert back to markdown - should use data-qd-source
            const backToMarkdown = quikdown_bd.toMarkdown(htmlWithSource);
            expect(backToMarkdown.trim()).toBe(markdown);
        });
    });

    describe('Performance Tests', () => {
        test('should handle rapid conversions', () => {
            const markdown = '```javascript\nconst perf = "test";\n```';
            
            // Perform multiple rapid conversions
            for (let i = 0; i < 100; i++) {
                const html = quikdown_bd(markdown);
                const backToMarkdown = quikdown_bd.toMarkdown(html);
                expect(backToMarkdown.trim()).toBe(markdown);
            }
        });
    });
});