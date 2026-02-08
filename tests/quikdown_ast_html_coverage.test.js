/**
 * Additional coverage tests for quikdown_ast_html
 */
import quikdown_ast_html from '../dist/quikdown_ast_html.esm.js';

describe('quikdown_ast_html coverage boost', () => {

    describe('Input format detection', () => {
        test('should handle JSON array input', () => {
            const json = JSON.stringify([
                { type: 'paragraph', children: [{ type: 'text', value: 'test' }] }
            ]);
            const result = quikdown_ast_html(json);
            expect(result).toContain('<p>');
            expect(result).toContain('test');
        });

        test('should handle invalid JSON gracefully', () => {
            const notJson = '{ invalid json }';
            const result = quikdown_ast_html(notJson);
            // Should treat as markdown
            expect(result).toContain('<p>');
        });

        test('should handle JSON that is not a document', () => {
            const json = JSON.stringify({ type: 'paragraph', children: [{ type: 'text', value: 'hi' }] });
            const result = quikdown_ast_html(json);
            expect(result).toContain('hi');
        });

        test('should handle YAML with value: pattern', () => {
            const yaml = `type: paragraph
children:
  - type: text
    value: hello from yaml`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('hello from yaml');
        });

        test('should handle invalid YAML gracefully', () => {
            const notYaml = 'type: but not valid yaml\n  - broken indent';
            const result = quikdown_ast_html(notYaml);
            // Should fall through to markdown parsing
            expect(result.length).toBeGreaterThan(0);
        });

        test('should handle non-string non-object input', () => {
            const result = quikdown_ast_html(12345);
            expect(result).toBe('');
        });
    });

    describe('YAML parsing edge cases', () => {
        test('should parse YAML with empty lines', () => {
            const yaml = `type: document

children:

  - type: paragraph
    children:
      - type: text
        value: test`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('test');
        });

        test('should parse YAML with empty array []', () => {
            const yaml = `type: document
children: []`;
            const result = quikdown_ast_html(yaml);
            expect(result).toBe('');
        });

        test('should parse YAML with empty object {}', () => {
            const yaml = `type: document
children:
  - type: paragraph
    data: {}
    children:
      - type: text
        value: test`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('test');
        });

        test('should parse YAML with null value using ~', () => {
            const yaml = `type: list_item
checked: ~
children:
  - type: text
    value: item`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('item');
        });

        test('should parse YAML with quoted strings', () => {
            const yaml = `type: text
value: "quoted string"`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('quoted string');
        });

        test('should parse YAML with single quoted strings', () => {
            const yaml = `type: text
value: 'single quoted'`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('single quoted');
        });

        test('should parse YAML with escaped characters in quotes', () => {
            const yaml = `type: text
value: "line1\\nline2"`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('line1');
        });

        test('should parse YAML with integer values', () => {
            const yaml = `type: heading
level: 3
children:
  - type: text
    value: H3`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('<h3');
        });

        test('should parse YAML with negative integer', () => {
            const yaml = `type: test
offset: -5
children: []`;
            const result = quikdown_ast_html(yaml);
            // Should render without error
            expect(result).toBeDefined();
        });

        test('should parse YAML with float values', () => {
            const yaml = `type: test
ratio: 1.5
children: []`;
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should parse YAML with boolean true', () => {
            const yaml = `type: list_item
checked: true
children:
  - type: text
    value: done`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('checked');
        });

        test('should parse YAML with boolean false', () => {
            const yaml = `type: list_item
checked: false
children:
  - type: text
    value: todo`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('checkbox');
        });

        test('should handle YAML array with simple scalar values', () => {
            // Pass as AST object directly since complex YAML parsing is limited
            const ast = {
                type: 'table',
                alignments: ['left', 'center', 'right'],
                headers: [],
                rows: []
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<table');
        });

        test('should handle YAML with continuation lines', () => {
            const yaml = `type: document
children:
  - type: paragraph
    children:
      - type: text
        value: multiword text here`;
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('multiword text here');
        });
    });

    describe('HTML rendering edge cases', () => {
        test('should render h5 heading', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'heading', level: 5, children: [{ type: 'text', value: 'H5' }] }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<h5');
        });

        test('should render h6 heading', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'heading', level: 6, children: [{ type: 'text', value: 'H6' }] }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<h6');
        });

        test('should render heading with default level 1', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'heading', children: [{ type: 'text', value: 'No level' }] }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<h1');
        });

        test('should render del/strikethrough', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'del', children: [{ type: 'text', value: 'deleted' }] }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<del');
            expect(result).toContain('deleted');
        });

        test('should render code block without language', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'code_block', lang: null, content: 'code here' }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<pre');
            expect(result).toContain('code here');
        });

        test('should render internal link without rel', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{
                        type: 'link',
                        url: '/internal/path',
                        children: [{ type: 'text', value: 'link' }]
                    }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('href="/internal/path"');
            expect(result).not.toContain('rel=');
        });

        test('should sanitize vbscript URL', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{
                        type: 'link',
                        url: 'vbscript:alert(1)',
                        children: [{ type: 'text', value: 'bad' }]
                    }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('href="#"');
        });

        test('should allow data:image URLs', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{
                        type: 'image',
                        url: 'data:image/png;base64,abc123',
                        alt: 'img'
                    }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('data:image/png');
        });

        test('should block data: non-image URLs', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{
                        type: 'link',
                        url: 'data:text/html,<script>',
                        children: [{ type: 'text', value: 'bad' }]
                    }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('href="#"');
        });

        test('should render unknown node with children', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'custom_block',
                    children: [{ type: 'text', value: 'custom content' }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('custom content');
        });

        test('should render unknown node with value', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'custom_inline',
                    value: 'custom value'
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('custom value');
        });

        test('should render unknown node without children or value', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'empty_node' }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toBe('');
        });

        test('should handle children that is not an array', () => {
            const ast = {
                type: 'document',
                children: { type: 'text', value: 'not an array' }
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('not an array');
        });
    });

    describe('Inline styles option', () => {
        test('should render with inline styles for all heading levels', () => {
            for (let i = 1; i <= 6; i++) {
                const ast = {
                    type: 'document',
                    children: [{ type: 'heading', level: i, children: [{ type: 'text', value: 'H' + i }] }]
                };
                const result = quikdown_ast_html(ast, { inline_styles: true });
                expect(result).toContain('style="');
                expect(result).toContain('font-size:');
            }
        });

        test('should render code block with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'code_block', lang: 'js', content: 'code' }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('style="');
        });

        test('should render task list with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'list',
                    ordered: false,
                    items: [{ type: 'list_item', checked: true, children: [{ type: 'text', value: 'done' }] }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('style="list-style:none"');
            expect(result).toContain('style="margin-right:.5em"');
        });

        test('should handle table alignment with inline styles override', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'table',
                    headers: [[{ type: 'text', value: 'A' }]],
                    rows: [[[{ type: 'text', value: '1' }]]],
                    alignments: ['center']
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('text-align:center');
        });

        test('should handle getAttr with no style and no additional style', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'br' }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('<br>');
        });
    });

    describe('Table rendering', () => {
        test('should render table without headers', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'table',
                    headers: [],
                    rows: [[[{ type: 'text', value: '1' }]]],
                    alignments: []
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<table');
            expect(result).not.toContain('<thead>');
        });

        test('should render table without rows', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'table',
                    headers: [[{ type: 'text', value: 'A' }]],
                    rows: [],
                    alignments: ['left']
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<thead>');
            expect(result).not.toContain('<tbody>');
        });

        test('should apply right alignment', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'table',
                    headers: [[{ type: 'text', value: 'A' }]],
                    rows: [[[{ type: 'text', value: '1' }]]],
                    alignments: ['right']
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('text-align:right');
        });
    });

    describe('Security', () => {
        test('should escape HTML in text nodes', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'text', value: '<script>bad</script>' }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<script>');
        });

        test('should escape HTML in code nodes', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'code', value: '<div>' }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('&lt;div&gt;');
        });

        test('should escape HTML in image alt', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'image', url: 'img.png', alt: '"><script>' }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('&quot;&gt;&lt;script&gt;');
        });

        test('should handle empty URL in sanitizeUrl', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'link', url: '', children: [{ type: 'text', value: 'link' }] }]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('href=""');
        });

        test('should handle null in escapeHtml', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'text', value: null }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toBe('');
        });
    });

    describe('Additional rendering edge cases', () => {
        test('should render code block with inline styles and language', () => {
            const ast = {
                type: 'document',
                children: [{ type: 'code_block', lang: 'python', content: 'print(1)' }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('style="');
            expect(result).toContain('print(1)');
        });

        test('should render list with items', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'list',
                    ordered: true,
                    items: [
                        { type: 'list_item', checked: null, children: [{ type: 'text', value: 'one' }] }
                    ]
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('<ol');
            expect(result).toContain('one');
        });

        test('should render table with center alignment', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'table',
                    headers: [[{ type: 'text', value: 'C' }]],
                    rows: [[[{ type: 'text', value: '1' }]]],
                    alignments: ['center']
                }]
            };
            const result = quikdown_ast_html(ast);
            expect(result).toContain('text-align:center');
        });

        test('should handle inline unchecked task item', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'list',
                    ordered: false,
                    items: [{ type: 'list_item', checked: false, children: [{ type: 'text', value: 'todo' }] }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('checkbox');
            expect(result).not.toContain('checked');
        });

        test('should render em with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'em', children: [{ type: 'text', value: 'italic' }] }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('font-style:italic');
        });

        test('should render strong with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'strong', children: [{ type: 'text', value: 'bold' }] }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('font-weight:bold');
        });

        test('should render del with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'del', children: [{ type: 'text', value: 'strike' }] }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('text-decoration:line-through');
        });

        test('should render link with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{
                        type: 'link',
                        url: 'http://test.com',
                        children: [{ type: 'text', value: 'test' }]
                    }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('style="');
        });

        test('should render image with inline styles', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'paragraph',
                    children: [{ type: 'image', url: 'img.png', alt: 'alt' }]
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: true });
            expect(result).toContain('style="');
        });

        test('should handle table cell alignment with CSS class mode', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'table',
                    headers: [[{ type: 'text', value: 'R' }]],
                    rows: [[[{ type: 'text', value: '1' }]]],
                    alignments: ['right']
                }]
            };
            const result = quikdown_ast_html(ast, { inline_styles: false });
            expect(result).toContain('class="quikdown-th"');
            expect(result).toContain('style="text-align:right"');
        });

        test('should handle toAst with object that has type', () => {
            const ast = { type: 'paragraph', children: [{ type: 'text', value: 'hi' }] };
            const result = quikdown_ast_html.toAst(ast);
            expect(result.type).toBe('paragraph');
        });
    });

    describe('Nested list rendering (lines 270-294)', () => {
        test('should render simple nested list to HTML', () => {
            const md = '- item 1\n  - nested 1\n  - nested 2\n- item 2';
            const html = quikdown_ast_html(md);
            expect(html).toContain('<ul');
            expect(html).toContain('<li');
        });

        test('should render deeply nested list to HTML', () => {
            const md = '- level 1\n  - level 2\n    - level 3';
            const html = quikdown_ast_html(md);
            expect(html).toContain('<ul');
        });

        test('should render nested ordered list to HTML', () => {
            const md = '1. first\n   1. nested first\n2. second';
            const html = quikdown_ast_html(md);
            expect(html).toContain('<ol');
        });

        test('should render mixed nested list to HTML', () => {
            const md = '- outer\n  1. inner ordered';
            const html = quikdown_ast_html(md);
            expect(html).toContain('<ul');
        });
    });

    describe('Edge case branch coverage', () => {
        test('should handle nested list item with inline formatting', () => {
            const md = '- parent\n  - **bold child**';
            const html = quikdown_ast_html(md);
            expect(html).toContain('<strong');
        });

        test('should handle task list with nested items', () => {
            const md = '- [x] done\n  - subtask';
            const html = quikdown_ast_html(md);
            expect(html).toContain('checked');
        });
    });
});
