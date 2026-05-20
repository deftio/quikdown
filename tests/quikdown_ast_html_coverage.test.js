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

    describe('Empty and null input', () => {
        test('should return empty HTML for null input', () => {
            const result = quikdown_ast_html(null);
            expect(result).toBe('');
        });

        test('should return empty HTML for empty string', () => {
            const result = quikdown_ast_html('');
            expect(result).toBe('');
        });

        test('should return empty HTML for undefined input', () => {
            const result = quikdown_ast_html(undefined);
            expect(result).toBe('');
        });
    });

    describe('YAML input parsing', () => {
        test('should parse YAML with empty array value', () => {
            const yaml = 'type: document\nchildren: []';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should parse YAML with empty object value', () => {
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    attrs: {}';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should parse YAML array with scalar items', () => {
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value: hello';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('hello');
        });

        test('should parse YAML with object items in array having multiline values', () => {
            const yaml = 'type: document\nchildren:\n  - type: heading\n    level: 1\n    children:\n      - type: text\n        value: Title';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('Title');
            expect(result).toContain('<h1');
        });

        test('should parse YAML with empty lines between items', () => {
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value: one\n\n  - type: paragraph\n    children:\n      - type: text\n        value: two';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('one');
            expect(result).toContain('two');
        });

        test('should handle YAML with non-colon lines in object (skip invalid keys)', () => {
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value: test\n        invalidline';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('test');
        });

        test('should handle YAML indent less than minimum returns null', () => {
            const yaml = 'type: paragraph\nchildren:\n  - type: text\n    value: hi\ntype: paragraph';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should handle YAML with scalar-only array items', () => {
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    classes:\n      - bold\n      - large\n    children:\n      - type: text\n        value: styled';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('styled');
        });

        test('should parse YAML with array item having empty value (multiline)', () => {
            // Triggers line 748-752: value === '' in array item object
            const yaml = 'type: document\nchildren:\n  - type: list\n    items:\n      - type: list_item\n        children:\n          - type: text\n            value: item one';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('item one');
        });

        test('should handle YAML array with continuation lines', () => {
            // Triggers lines 732-733: indent > baseIndent continuation
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value: first\n  - type: paragraph\n    children:\n      - type: text\n        value: second';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('first');
            expect(result).toContain('second');
        });

        test('should handle YAML with scalar value at top level of parseYamlNode', () => {
            // Triggers line 709: scalar fallback
            const yaml = 'type: document\nchildren:\n  - type: text\n    value: just a scalar';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('just a scalar');
        });

        test('should handle YAML past end of lines', () => {
            // Triggers line 670: startLine >= lines.length
            const yaml = 'type: document\nchildren:\n  - type: text\n    value: end';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('end');
        });

        test('should handle YAML object with non-key lines', () => {
            // Triggers lines 820-821: colonIdx <= 0 in parseYamlObject
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value: test\n        notakey';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('test');
        });

        test('should handle YAML with array items that are plain scalars (not objects)', () => {
            // Triggers lines 791-792: items without colon
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    tags:\n      - simple\n      - values\n    children:\n      - type: text\n        value: tagged';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('tagged');
        });

        test('should handle YAML with empty lines inside array parsing', () => {
            // Triggers lines 724-725: empty line skip in array
            const yaml = 'type: document\nchildren:\n\n  - type: paragraph\n    children:\n      - type: text\n        value: after empty';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('after empty');
        });

        test('should handle YAML with [] literal for empty children', () => {
            // Triggers line 694: empty array literal
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children: []\n    value: empty kids';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should handle YAML with {} literal for empty attrs', () => {
            // Triggers line 699: empty object literal
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    meta: {}\n    children:\n      - type: text\n        value: with meta';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('with meta');
        });

        test('should handle YAML key with empty value at end of input', () => {
            // Triggers line 670: startLine >= lines.length
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value:';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should handle YAML with indent backtrack', () => {
            // Triggers line 684: indent < minIndent
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n    children:\n      - type: text\n        value: deep\noutside: value';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('deep');
        });

        test('should handle YAML array item with key whose value is on next lines', () => {
            // Triggers lines 750-752: value === '' in array item parsing
            const yaml = 'type: document\nchildren:\n  - type: list\n    items:\n      - content:\n          type: text\n          value: nested val';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should handle YAML with continuation of previous array item', () => {
            // Triggers lines 732-733: indent > baseIndent continuation in array
            const yaml = 'type: document\nchildren:\n  - type: paragraph\n      extra: indented\n    children:\n      - type: text\n        value: cont';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should handle YAML object lines without colons', () => {
            // Triggers lines 820-821: colonIdx <= 0 in parseYamlObject
            const yaml = 'type: document\nchildren:\n  - type: text\n    value: hello\n    noColonHere';
            const result = quikdown_ast_html(yaml);
            expect(result).toBeDefined();
        });

        test('should handle YAML scalar node', () => {
            // Triggers line 709: scalar fallback in parseYamlNode
            const yaml = 'type: document\nchildren:\n  - type: text\n    value: plainscalar';
            const result = quikdown_ast_html(yaml);
            expect(result).toContain('plainscalar');
        });
    });

    describe('Table and inline edge cases for ast_html', () => {
        test('should reject table with invalid separator', () => {
            const md = '| Header |\n| no dashes |';
            const result = quikdown_ast_html(md);
            expect(result).not.toContain('<table');
        });

        test('should handle hard line break with backslash', () => {
            const md = 'line one\\\nline two';
            const result = quikdown_ast_html(md);
            expect(result).toContain('<br');
        });

        test('should handle nested list creating children on parent item', () => {
            const md = '- parent\n  - child';
            const result = quikdown_ast_html(md);
            expect(result).toContain('parent');
            expect(result).toContain('child');
        });
    });

    // ── Coverage gap: line 29 — non-string/empty input ──
    describe('Non-string input guard (line 29)', () => {
        test('null input returns empty document', () => {
            const result = quikdown_ast_html(null);
            expect(result).toBe('');
        });

        test('undefined input returns empty document', () => {
            const result = quikdown_ast_html(undefined);
            expect(result).toBe('');
        });

        test('numeric input returns empty document', () => {
            const result = quikdown_ast_html(42);
            expect(result).toBe('');
        });

        test('empty string returns empty document', () => {
            const result = quikdown_ast_html('');
            expect(result).toBe('');
        });
    });

    // ── Coverage gap: line 593 — hex entity decoding in sanitizeUrl ──
    describe('URL hex entity decoding (line 593)', () => {
        test('hex-encoded javascript: in link is blocked', () => {
            const md = '[click](&#x6A;avascript:alert(1))';
            const result = quikdown_ast_html(md);
            expect(result).not.toContain('href="&#x6A;avascript:');
        });

        test('hex-encoded vbscript: in link is blocked', () => {
            const md = '[click](&#x76;bscript:alert(1))';
            const result = quikdown_ast_html(md);
            expect(result).not.toContain('href="&#x76;bscript:');
        });

        test('normal hex entities in URLs are fine', () => {
            const md = '[click](https://example.com/path&#x2F;file)';
            const result = quikdown_ast_html(md);
            expect(result).toContain('href=');
        });
    });

    // ── Coverage gap: lines 702, 712, 717, 727 — YAML edge cases ──
    describe('YAML frontmatter parsing edge cases', () => {
        test('YAML with indent less than minIndent returns null (line 702)', () => {
            // parseYamlNode is called with minIndent>0 but encounters a line with less indent
            // When value is on next lines (line 847 calls parseYamlNode with indent+2),
            // but next line has less indent than expected
            const yaml = 'type: document\nchildren:\nvalue: hello';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });

        test('YAML with empty array [] on own line (line 712)', () => {
            // [] must be on its own indented line to hit parseYamlNode line 711
            const yaml = 'type: document\nchildren:\n  []';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });

        test('YAML with empty object {} on own line (line 717)', () => {
            // {} must be on its own indented line to hit parseYamlNode line 716
            const yaml = 'type: document\nchildren:\n  {}';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });

        test('YAML with plain scalar on own line (line 727)', () => {
            // A line that is not array item, not [], not {}, and has no colon
            // This triggers the scalar fallback in parseYamlNode
            const yaml = 'type: text\nvalue:\n  justascalar';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });
    });

    // ── Coverage gap: lines 742-743, 750-751 — YAML array edge cases ──
    describe('YAML array parsing edge cases', () => {
        test('YAML array with blank lines between scalar items (lines 742-743)', () => {
            // Simple scalar items with blank line — blank line processed by parseYamlArray directly
            const yaml = 'type: document\nchildren:\n  - first\n\n  - second';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });

        test('YAML array with continuation indented lines after scalar (lines 750-751)', () => {
            // After a scalar array item, a more-indented non-item line triggers continuation skip
            const yaml = 'type: document\nchildren:\n  - scalar1\n    continuation\n  - scalar2';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });
    });

    // ── Coverage gap: lines 838-839 — YAML object non-key line ──
    describe('YAML object parsing edge cases', () => {
        test('YAML object with non-key-value line is skipped (lines 838-839)', () => {
            // A line inside a YAML object that has no colon — colonIdx returns -1 (<=0)
            const yaml = 'type: document\nchildren:\n  - type: text\n    value: hello\n    notakey';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });

        test('YAML object with line starting with colon is skipped (colonIdx=0)', () => {
            // colonIdx === 0 also triggers the skip
            const yaml = 'type: text\nvalue: hello\n:orphan';
            const result = quikdown_ast_html(yaml);
            expect(typeof result).toBe('string');
        });
    });

    // ── Coverage gap: lines 288, 290 — list children edge cases ──
    describe('AST list children edge cases', () => {
        test('deeply nested list creates children array on item (line 288)', () => {
            const md = '- item1\n  - nested1\n    - deep nested';
            const result = quikdown_ast_html(md);
            expect(result).toContain('item1');
            expect(result).toContain('nested1');
            expect(result).toContain('deep nested');
        });

        test('list with paragraph and nested sub-list', () => {
            const md = '- first item\n\n  paragraph continuation\n\n  - sub item';
            const result = quikdown_ast_html(md);
            expect(result).toContain('first item');
        });
    });
});
