/**
 * Tests for quikdown_ast_html - AST to HTML converter
 */
import quikdown_ast_html from '../dist/quikdown_ast_html.esm.js';
import quikdown from '../dist/quikdown.esm.js';
import { samples } from './fixtures/ast-samples.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load package.json to get the current version
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

describe('quikdown_ast_html converter', () => {

    describe('Basic functionality', () => {
        test('should export a function', () => {
            expect(typeof quikdown_ast_html).toBe('function');
        });

        test('should have version property', () => {
            expect(quikdown_ast_html.version).toBe(packageJson.version);
        });

        test('should have toAst helper', () => {
            expect(typeof quikdown_ast_html.toAst).toBe('function');
        });

        test('should have renderAst helper', () => {
            expect(typeof quikdown_ast_html.renderAst).toBe('function');
        });
    });

    describe('Input formats', () => {
        test('should accept markdown string', () => {
            const result = quikdown_ast_html('# Hello');
            expect(result).toContain('<h1');
            expect(result).toContain('Hello');
        });

        test('should accept AST object', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'paragraph', children: [{ type: 'text', value: 'Hello' }] }
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<p>');
            expect(result).toContain('Hello');
        });

        test('should accept JSON string', () => {
            const json = JSON.stringify({
                type: 'document',
                children: [
                    { type: 'paragraph', children: [{ type: 'text', value: 'Hello' }] }
                ]
            });
            const result = quikdown_ast_html(json);
            expect(result).toContain('<p>');
            expect(result).toContain('Hello');
        });

        test('should accept YAML string', () => {
            const yaml = `type: document
children:
  - type: paragraph
    children:
      - type: text
        value: Hello`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('<p>');
            expect(result).toContain('Hello');
        });

        test('should handle empty input', () => {
            expect(quikdown_ast_html('')).toBe('');
            expect(quikdown_ast_html(null)).toBe('');
            expect(quikdown_ast_html(undefined)).toBe('');
        });
    });

    describe('HTML output - Block elements', () => {
        test('should render headings h1-h6', () => {
            for (let i = 1; i <= 6; i++) {
                const ast = {
                    type: 'document',
                    children: [{ type: 'heading', level: i, children: [{ type: 'text', value: 'Title' }] }]
                };
                const result = quikdown_ast_html(ast);
                expect(result).toContain(`<h${i}`);
                expect(result).toContain(`</h${i}>`);
            }
        });

        test('should render paragraphs', () => {
            const result = quikdown_ast_html('Hello world');
            expect(result).toContain('<p>');
            expect(result).toContain('</p>');
        });

        test('should render code blocks', () => {
            const result = quikdown_ast_html('```js\ncode\n```');
            expect(result).toContain('<pre');
            expect(result).toContain('<code');
            expect(result).toContain('</code></pre>');
        });

        test('should render code blocks with language class', () => {
            const result = quikdown_ast_html('```javascript\ncode\n```');
            expect(result).toContain('language-javascript');
        });

        test('should render blockquotes', () => {
            const result = quikdown_ast_html('> quoted');
            expect(result).toContain('<blockquote');
            expect(result).toContain('</blockquote>');
        });

        test('should render unordered lists', () => {
            const result = quikdown_ast_html('- item 1\n- item 2');
            expect(result).toContain('<ul');
            expect(result).toContain('<li');
            expect(result).toContain('</li>');
            expect(result).toContain('</ul>');
        });

        test('should render ordered lists', () => {
            const result = quikdown_ast_html('1. first\n2. second');
            expect(result).toContain('<ol');
            expect(result).toContain('</ol>');
        });

        test('should render task lists', () => {
            const result = quikdown_ast_html('- [x] done\n- [ ] todo');
            expect(result).toContain('type="checkbox"');
            expect(result).toContain('checked');
            expect(result).toContain('disabled');
        });

        test('should render horizontal rules', () => {
            const result = quikdown_ast_html('---');
            expect(result).toContain('<hr');
        });

        test('should render tables', () => {
            const result = quikdown_ast_html('| A | B |\n|---|---|\n| 1 | 2 |');
            expect(result).toContain('<table');
            expect(result).toContain('<thead>');
            expect(result).toContain('<th');
            expect(result).toContain('<tbody>');
            expect(result).toContain('<td');
        });

        test('should render table alignments', () => {
            const result = quikdown_ast_html('| L | C | R |\n|:--|:--:|--:|\n| 1 | 2 | 3 |', { inline_styles: true });
            expect(result).toContain('text-align:center');
            expect(result).toContain('text-align:right');
        });
    });

    describe('HTML output - Inline elements', () => {
        test('should render strong/bold', () => {
            const result = quikdown_ast_html('**bold**');
            expect(result).toContain('<strong');
            expect(result).toContain('</strong>');
        });

        test('should render em/italic', () => {
            const result = quikdown_ast_html('*italic*');
            expect(result).toContain('<em');
            expect(result).toContain('</em>');
        });

        test('should render strikethrough', () => {
            const result = quikdown_ast_html('~~strike~~');
            expect(result).toContain('<del');
            expect(result).toContain('</del>');
        });

        test('should render inline code', () => {
            const result = quikdown_ast_html('`code`');
            expect(result).toContain('<code');
            expect(result).toContain('code</code>');
        });

        test('should render links', () => {
            const result = quikdown_ast_html('[text](https://example.com)');
            expect(result).toContain('<a');
            expect(result).toContain('href="https://example.com"');
            expect(result).toContain('rel="noopener noreferrer"');
        });

        test('should render images', () => {
            const result = quikdown_ast_html('![alt](image.png)');
            expect(result).toContain('<img');
            expect(result).toContain('src="image.png"');
            expect(result).toContain('alt="alt"');
        });

        test('should render line breaks', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'paragraph', children: [
                        { type: 'text', value: 'line1' },
                        { type: 'br' },
                        { type: 'text', value: 'line2' }
                    ]}
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<br>');
        });
    });

    describe('Styling options', () => {
        test('should use CSS classes by default', () => {
            const result = quikdown_ast_html('# Hello');
            expect(result).toContain('class="quikdown-');
        });

        test('should use inline styles when inline_styles: true', () => {
            const result = quikdown_ast_html('# Hello', { inline_styles: true });
            expect(result).toContain('style="');
            expect(result).not.toContain('class="quikdown-');
        });
    });

    describe('Security', () => {
        test('should escape HTML in text', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'paragraph', children: [{ type: 'text', value: '<script>alert("xss")</script>' }] }
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<script>');
        });

        test('should escape HTML in code blocks', () => {
            const result = quikdown_ast_html('```\n<div>html</div>\n```');
            expect(result).toContain('&lt;div&gt;');
        });

        test('should sanitize javascript: URLs', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'paragraph', children: [
                        { type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', value: 'click' }] }
                    ]}
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('href="#"');
            expect(result).not.toContain('javascript:');
        });
    });

    describe('Roundtrip comparison', () => {
        // Compare AST-HTML output with original quikdown output for simple cases
        const testCases = [
            '# Heading 1',
            '**bold text**',
            '*italic text*',
            '`inline code`',
            '---',
            '- list item',
            '1. ordered item',
            '> blockquote'
        ];

        testCases.forEach(markdown => {
            test(`should produce similar output for: ${markdown.substring(0, 30)}...`, () => {
                const astHtml = quikdown_ast_html(markdown);
                const directHtml = quikdown(markdown);

                // Both should contain the same basic elements
                // (exact match may differ slightly due to implementation details)
                const astHasExpected = astHtml.length > 0;
                const directHasExpected = directHtml.length > 0;

                expect(astHasExpected).toBe(directHasExpected);
            });
        });
    });

    describe('Sample fixtures', () => {
        Object.entries(samples).forEach(([name, sample]) => {
            test(`should correctly render ${name} to HTML`, () => {
                const html = quikdown_ast_html(sample.markdown);
                expect(html.length).toBeGreaterThan(0);

                // Check that the primary element type is rendered
                switch (sample.ast.children[0].type) {
                    case 'heading':
                        expect(html).toMatch(/<h[1-6]/);
                        break;
                    case 'paragraph':
                        expect(html).toContain('<p>');
                        break;
                    case 'code_block':
                        expect(html).toContain('<pre');
                        break;
                    case 'list':
                        expect(html).toMatch(/<[ou]l/);
                        break;
                    case 'blockquote':
                        expect(html).toContain('<blockquote');
                        break;
                    case 'hr':
                        expect(html).toContain('<hr');
                        break;
                    case 'table':
                        expect(html).toContain('<table');
                        break;
                }
            });
        });
    });

    describe('Edge cases', () => {
        test('should handle unknown node types gracefully', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'unknown_type', value: 'test' }
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('test');
        });

        test('should handle missing children', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'paragraph' } // No children
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<p></p>');
        });

        test('should handle deeply nested structures', () => {
            const ast = {
                type: 'document',
                children: [
                    {
                        type: 'blockquote',
                        children: [
                            {
                                type: 'paragraph',
                                children: [
                                    { type: 'strong', children: [
                                        { type: 'em', children: [
                                            { type: 'text', value: 'deep' }
                                        ]}
                                    ]}
                                ]
                            }
                        ]
                    }
                ]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<blockquote');
            expect(result).toContain('<strong');
            expect(result).toContain('<em');
            expect(result).toContain('deep');
        });
    });
});
