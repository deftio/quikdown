/**
 * Tests for quikdown_json - Markdown to JSON converter
 */
import quikdown_json from '../dist/quikdown_json.esm.js';
import { samples } from './fixtures/ast-samples.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load package.json to get the current version
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

describe('quikdown_json converter', () => {

    describe('Basic functionality', () => {
        test('should export a function', () => {
            expect(typeof quikdown_json).toBe('function');
        });

        test('should have version property', () => {
            expect(quikdown_json.version).toBe(packageJson.version);
        });

        test('should have parse method for direct AST access', () => {
            expect(typeof quikdown_json.parse).toBe('function');
        });

        test('should return valid JSON string', () => {
            const result = quikdown_json('# Hello');
            expect(() => JSON.parse(result)).not.toThrow();
        });

        test('should return document type at root', () => {
            const result = JSON.parse(quikdown_json('# Hello'));
            expect(result.type).toBe('document');
        });
    });

    describe('JSON output format', () => {
        test('should pretty-print with 2 spaces by default', () => {
            const result = quikdown_json('# Hello');
            expect(result).toContain('\n');
            expect(result).toContain('  '); // 2-space indent
        });

        test('should respect custom indent option', () => {
            const result = quikdown_json('# Hello', { indent: 4 });
            expect(result).toContain('    '); // 4-space indent
        });

        test('should allow compact output with indent: 0', () => {
            const result = quikdown_json('# Hello', { indent: 0 });
            expect(result).not.toMatch(/\n\s+/); // No newlines with indentation
        });
    });

    describe('Content parsing', () => {
        test('should parse heading', () => {
            const result = JSON.parse(quikdown_json('# Title'));
            expect(result.children[0].type).toBe('heading');
            expect(result.children[0].level).toBe(1);
        });

        test('should parse paragraph', () => {
            const result = JSON.parse(quikdown_json('Hello world'));
            expect(result.children[0].type).toBe('paragraph');
        });

        test('should parse code block', () => {
            const result = JSON.parse(quikdown_json('```js\ncode\n```'));
            expect(result.children[0].type).toBe('code_block');
            expect(result.children[0].lang).toBe('js');
        });

        test('should parse inline formatting', () => {
            const result = JSON.parse(quikdown_json('**bold** and *italic*'));
            const children = result.children[0].children;
            expect(children.some(c => c.type === 'strong')).toBe(true);
            expect(children.some(c => c.type === 'em')).toBe(true);
        });

        test('should parse lists', () => {
            const result = JSON.parse(quikdown_json('- item 1\n- item 2'));
            expect(result.children[0].type).toBe('list');
            expect(result.children[0].ordered).toBe(false);
        });

        test('should parse tables', () => {
            const result = JSON.parse(quikdown_json('| A | B |\n|---|---|\n| 1 | 2 |'));
            expect(result.children[0].type).toBe('table');
        });
    });

    describe('Roundtrip', () => {
        test('should parse and stringify back to equivalent structure', () => {
            const markdown = '# Hello\n\nWorld';
            const json1 = quikdown_json(markdown);
            const ast = JSON.parse(json1);
            const json2 = JSON.stringify(ast, null, 2);
            expect(json1).toBe(json2);
        });
    });

    describe('Sample fixtures', () => {
        Object.entries(samples).forEach(([name, sample]) => {
            test(`should correctly convert ${name} to JSON`, () => {
                const json = quikdown_json(sample.markdown);
                expect(() => JSON.parse(json)).not.toThrow();

                const result = JSON.parse(json);
                expect(result.type).toBe('document');
                expect(result.children[0].type).toBe(sample.ast.children[0].type);
            });
        });
    });

    describe('Edge cases', () => {
        test('should handle empty input', () => {
            const result = JSON.parse(quikdown_json(''));
            expect(result).toEqual({ type: 'document', children: [] });
        });

        test('should handle special characters in content', () => {
            const result = quikdown_json('Text with "quotes" and \\backslash');
            expect(() => JSON.parse(result)).not.toThrow();
        });

        test('should handle unicode content', () => {
            const result = quikdown_json('# Hello');
            const ast = JSON.parse(result);
            expect(ast.children[0].children[0].value).toBe('Hello');
        });
    });
});
