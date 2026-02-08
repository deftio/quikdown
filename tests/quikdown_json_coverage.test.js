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
});
