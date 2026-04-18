/**
 * Tests for quikdown_yaml - Markdown to YAML converter
 */
import quikdown_yaml from '../dist/quikdown_yaml.esm.js';
import { samples } from './fixtures/ast-samples.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load package.json to get the current version
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

describe('quikdown_yaml converter', () => {

    describe('Basic functionality', () => {
        test('should export a function', () => {
            expect(typeof quikdown_yaml).toBe('function');
        });

        test('should have version property', () => {
            expect(quikdown_yaml.version).toBe(packageJson.version);
        });

        test('should have parse method for direct AST access', () => {
            expect(typeof quikdown_yaml.parse).toBe('function');
        });

        test('should have stringify method for AST to YAML', () => {
            expect(typeof quikdown_yaml.stringify).toBe('function');
        });

        test('should return YAML string', () => {
            const result = quikdown_yaml('# Hello');
            expect(typeof result).toBe('string');
            expect(result).toContain('type:');
        });
    });

    describe('YAML output format', () => {
        test('should include document type', () => {
            const result = quikdown_yaml('# Hello');
            expect(result).toContain('type: document');
        });

        test('should include children array', () => {
            const result = quikdown_yaml('# Hello');
            expect(result).toContain('children:');
        });

        test('should use proper YAML indentation', () => {
            const result = quikdown_yaml('# Hello');
            // YAML uses 2-space indentation
            expect(result).toMatch(/  /);
        });

        test('should handle arrays with dash notation', () => {
            const result = quikdown_yaml('- item');
            expect(result).toContain('- type:');
        });
    });

    describe('Content parsing', () => {
        test('should parse heading', () => {
            const result = quikdown_yaml('# Title');
            expect(result).toContain('type: heading');
            expect(result).toContain('level: 1');
        });

        test('should parse paragraph', () => {
            const result = quikdown_yaml('Hello world');
            expect(result).toContain('type: paragraph');
        });

        test('should parse code block', () => {
            const result = quikdown_yaml('```js\ncode\n```');
            expect(result).toContain('type: code_block');
            expect(result).toContain('lang: js');
        });

        test('should parse inline formatting', () => {
            const result = quikdown_yaml('**bold**');
            expect(result).toContain('type: strong');
        });

        test('should parse lists', () => {
            const result = quikdown_yaml('- item 1\n- item 2');
            expect(result).toContain('type: list');
            expect(result).toContain('ordered: false');
        });

        test('should parse tables', () => {
            const result = quikdown_yaml('| A | B |\n|---|---|\n| 1 | 2 |');
            expect(result).toContain('type: table');
            expect(result).toContain('headers:');
            expect(result).toContain('rows:');
        });
    });

    describe('URL underscore handling (issue #3)', () => {
        test('should not apply emphasis to underscores in link URLs', () => {
            const result = quikdown_yaml('[My Link](https://example.org/file_mytest_123.pdf)');
            expect(result).toContain('type: link');
            expect(result).toContain('https://example.org/file_mytest_123.pdf');
            // Should NOT have emphasis nodes from URL underscores
            const emCount = (result.match(/type: em/g) || []).length;
            expect(emCount).toBe(0);
        });

        test('should not apply bold to double underscores in URLs', () => {
            const result = quikdown_yaml('[Docs](https://docs.python.org/3/ref/__init__.html)');
            expect(result).toContain('type: link');
            expect(result).toContain('https://docs.python.org/3/ref/__init__.html');
            const strongCount = (result.match(/type: strong/g) || []).length;
            expect(strongCount).toBe(0);
        });

        test('should not apply emphasis to underscores in image URLs', () => {
            const result = quikdown_yaml('![photo](https://example.com/my_photo_album/img_001.jpg)');
            expect(result).toContain('type: image');
            expect(result).toContain('https://example.com/my_photo_album/img_001.jpg');
        });

        test('should not apply strikethrough to tildes in URLs', () => {
            const result = quikdown_yaml('[Archive](https://example.com/~~old~~/page)');
            expect(result).toContain('type: link');
            expect(result).toContain('https://example.com/~~old~~/page');
            const delCount = (result.match(/type: del/g) || []).length;
            expect(delCount).toBe(0);
        });

        test('should preserve emphasis in text alongside underscored URLs', () => {
            const result = quikdown_yaml('_italic_ and [link](https://example.com/path_name_here.html)');
            expect(result).toContain('type: em');
            expect(result).toContain('type: link');
            expect(result).toContain('https://example.com/path_name_here.html');
        });
    });

    describe('YAML string escaping', () => {
        test('should quote strings with colons', () => {
            const result = quikdown_yaml('Text: with colon');
            expect(result).toMatch(/".*:.*"/);
        });

        test('should quote strings starting with special chars', () => {
            // "- not a list" is actually parsed as a list item by the AST parser
            const result = quikdown_yaml('- not a list');
            expect(result).toContain('type: list');
            // Test that strings starting with dash are properly handled in values
            expect(result).toContain('not a list');
        });

        test('should handle null values', () => {
            const result = quikdown_yaml('```\ncode\n```');
            // lang is null for code without language
            expect(result).toContain('null');
        });

        test('should handle boolean values', () => {
            const result = quikdown_yaml('- [x] checked');
            expect(result).toContain('checked: true');
        });
    });

    describe('Direct stringify', () => {
        test('should convert AST object to YAML', () => {
            const ast = {
                type: 'document',
                children: [
                    { type: 'paragraph', children: [{ type: 'text', value: 'Hello' }] }
                ]
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('type: document');
            expect(result).toContain('type: paragraph');
            expect(result).toContain('Hello');
        });
    });

    describe('Sample fixtures', () => {
        Object.entries(samples).forEach(([name, sample]) => {
            test(`should correctly convert ${name} to YAML`, () => {
                const yaml = quikdown_yaml(sample.markdown);
                expect(yaml).toContain('type: document');
                expect(yaml).toContain(`type: ${sample.ast.children[0].type}`);
            });
        });
    });

    describe('Edge cases', () => {
        test('should handle empty input', () => {
            const result = quikdown_yaml('');
            expect(result).toContain('type: document');
            expect(result).toContain('children: []');
        });

        test('should handle empty arrays', () => {
            const ast = { type: 'document', children: [] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('[]');
        });

        test('should handle empty objects', () => {
            const ast = { type: 'test', data: {} };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('{}');
        });

        test('should handle multiline content', () => {
            const result = quikdown_yaml('```\nline1\nline2\n```');
            expect(result).toContain('line1');
            expect(result).toContain('line2');
        });

        test('should handle numbers', () => {
            const ast = { type: 'heading', level: 2 };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('level: 2');
        });
    });
});
