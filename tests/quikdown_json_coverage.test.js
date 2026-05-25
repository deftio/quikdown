/**
 * Additional coverage tests for quikdown_json
 */
import quikdown_json from '../dist/quikdown_json.esm.js';

describe('quikdown_json coverage boost', () => {

    describe('Indent options', () => {
        test('should use default indent of 2', () => {
            const result = quikdown_json('# Test');
            const lines = result.split('\n');
            // Second line should have 2-space indent
            expect(lines[1]).toMatch(/^  /);
        });

        test('should use custom indent of 4', () => {
            const result = quikdown_json('# Test', { indent: 4 });
            const lines = result.split('\n');
            expect(lines[1]).toMatch(/^    /);
        });

        test('should produce compact output with indent null', () => {
            const result = quikdown_json('# Test', { indent: null });
            expect(result).not.toMatch(/\n\s+/);
        });

        test('should handle indent: undefined as default', () => {
            const result = quikdown_json('# Test', { indent: undefined });
            expect(result).toContain('\n');
        });
    });

    describe('Complex markdown to JSON', () => {
        test('should convert nested lists correctly', () => {
            const md = `- item 1
  - nested 1
  - nested 2
- item 2`;
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children[0].type).toBe('list');
        });

        test('should convert table with alignments', () => {
            const md = '| L | C | R |\n|:--|:--:|--:|\n| 1 | 2 | 3 |';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children[0].alignments).toEqual(['left', 'center', 'right']);
        });

        test('should convert code block with language', () => {
            const md = '```typescript\nconst x: number = 1;\n```';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children[0].lang).toBe('typescript');
        });

        test('should convert all inline formatting types', () => {
            const md = '**bold** *italic* ~~strike~~ `code` [link](url) ![img](src)';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            const types = ast.children[0].children.map(c => c.type);
            expect(types).toContain('strong');
            expect(types).toContain('em');
            expect(types).toContain('del');
            expect(types).toContain('code');
            expect(types).toContain('link');
            expect(types).toContain('image');
        });

        test('should convert blockquote with nested content', () => {
            const md = '> **bold** in quote';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children[0].type).toBe('blockquote');
        });

        test('should convert task list', () => {
            const md = '- [x] done\n- [ ] pending';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children[0].items[0].checked).toBe(true);
            expect(ast.children[0].items[1].checked).toBe(false);
        });

        test('should convert horizontal rule', () => {
            const md = 'text\n\n---\n\nmore';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children.some(c => c.type === 'hr')).toBe(true);
        });

        test('should convert autolinks', () => {
            const md = 'Visit https://example.com for more';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            const link = ast.children[0].children.find(c => c.type === 'link');
            expect(link.url).toBe('https://example.com');
        });
    });

    describe('Edge cases', () => {
        test('should handle null input', () => {
            const result = quikdown_json(null);
            const ast = JSON.parse(result);
            expect(ast).toEqual({ type: 'document', children: [] });
        });

        test('should handle undefined input', () => {
            const result = quikdown_json(undefined);
            const ast = JSON.parse(result);
            expect(ast).toEqual({ type: 'document', children: [] });
        });

        test('should handle empty string', () => {
            const result = quikdown_json('');
            const ast = JSON.parse(result);
            expect(ast).toEqual({ type: 'document', children: [] });
        });

        test('should preserve special characters in content', () => {
            const md = 'Text with "quotes" and \\backslashes';
            const json = quikdown_json(md);
            expect(() => JSON.parse(json)).not.toThrow();
        });

        test('should handle unicode characters', () => {
            const md = '# Hello World';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children[0].children[0].value).toContain('Hello');
        });

        test('should handle Windows line endings', () => {
            const md = '# Title\r\n\r\nParagraph';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children.length).toBe(2);
        });

        test('should handle multiple consecutive blank lines', () => {
            const md = 'Para 1\n\n\n\n\nPara 2';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children.length).toBe(2);
        });

        test('should handle markdown with only whitespace', () => {
            const md = '   \n   \n   ';
            const json = quikdown_json(md);
            const ast = JSON.parse(json);
            expect(ast.children.length).toBe(0);
        });
    });

    describe('Parse method', () => {
        test('should expose parse method that returns AST', () => {
            const ast = quikdown_json.parse('# Hello');
            expect(ast.type).toBe('document');
            expect(ast.children[0].type).toBe('heading');
        });

        test('should parse method handle empty input', () => {
            const ast = quikdown_json.parse('');
            expect(ast).toEqual({ type: 'document', children: [] });
        });
    });

    describe('Table and inline edge cases', () => {
        test('should reject table with invalid separator in JSON output', () => {
            const md = '| Header |\n| no dashes |';
            const result = quikdown_json(md);
            expect(result).not.toContain('"type":"table"');
        });

        test('should handle hard line break with backslash in JSON output', () => {
            const md = 'line one\\\nline two';
            const result = quikdown_json(md);
            expect(result).toContain('"type": "br"');
        });

        test('should handle nested list items in JSON output', () => {
            const md = '- parent\n  - child';
            const result = quikdown_json(md);
            expect(result).toContain('"type": "list"');
            expect(result).toContain('child');
        });
    });

    describe('new parser features in JSON output', () => {
        test('blockquote lazy continuation', () => {
            const result = quikdown_json('> start\ncontinuation');
            expect(result).toContain('blockquote');
            expect(result).toContain('continuation');
        });

        test('GFM alert produces alert node', () => {
            const result = quikdown_json('> [!NOTE]\n> text');
            expect(result).toContain('"type": "alert"');
            expect(result).toContain('"alertType": "note"');
        });

        test('all 5 alert types', () => {
            for (const t of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
                const result = quikdown_json(`> [!${t}]\n> text`);
                expect(result).toContain('"type": "alert"');
            }
        });

        test('autolink trailing punctuation stripped', () => {
            const result = quikdown_json('https://example.com.');
            expect(result).toContain('"url": "https://example.com"');
        });

        test('autolink balanced parens preserved', () => {
            const result = quikdown_json('https://en.wikipedia.org/wiki/Foo_(bar)');
            expect(result).toContain('Foo_(bar)');
        });

        test('autolink unbalanced paren stripped', () => {
            const result = quikdown_json('(see https://example.com)');
            expect(result).toContain('"url": "https://example.com"');
        });

        test('table column normalization', () => {
            const result = quikdown_json('| A | B | C |\n|---|---|---|\n| 1 |');
            const parsed = JSON.parse(result);
            const table = parsed.children.find(c => c.type === 'table');
            expect(table.rows[0].length).toBe(3);
        });

        test('lazy continuation breakers', () => {
            // heading
            const r1 = quikdown_json('> quote\n# Heading');
            expect(r1).toContain('"type": "heading"');

            // HR
            const r2 = quikdown_json('> quote\n---');
            expect(r2).toContain('"type": "hr"');

            // list
            const r3 = quikdown_json('> quote\n- item');
            expect(r3).toContain('"type": "list"');

            // ordered list
            const r4 = quikdown_json('> quote\n1. item');
            expect(r4).toContain('"type": "list"');

            // table
            const r5 = quikdown_json('> quote\n| A | B |\n|---|---|\n| 1 | 2 |');
            expect(r5).toContain('"type": "table"');

            // code fence
            const r6 = quikdown_json('> quote\n```\ncode\n```');
            expect(r6).toContain('"type": "code_block"');

            // *** HR
            const r7 = quikdown_json('> quote\n***');
            expect(r7).toContain('"type": "hr"');

            // ___ HR
            const r8 = quikdown_json('> quote\n___');
            expect(r8).toContain('"type": "hr"');
        });
    });
});
