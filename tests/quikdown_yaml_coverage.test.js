/**
 * Additional coverage tests for quikdown_yaml
 */
import quikdown_yaml from '../dist/quikdown_yaml.esm.js';

describe('quikdown_yaml coverage boost', () => {

    describe('YAML string formatting edge cases', () => {
        test('should quote empty string', () => {
            const ast = { type: 'text', value: '' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('""');
        });

        test('should quote string with colon', () => {
            const ast = { type: 'text', value: 'key: value' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"key: value"');
        });

        test('should quote string with hash', () => {
            const ast = { type: 'text', value: 'text # comment' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"text # comment"');
        });

        test('should quote string with single quote', () => {
            const ast = { type: 'text', value: "it's a test" };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"');
        });

        test('should quote string with double quote', () => {
            const ast = { type: 'text', value: 'say "hello"' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('\\"');
        });

        test('should quote string starting with space', () => {
            const ast = { type: 'text', value: ' leading space' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('" leading space"');
        });

        test('should quote string ending with space', () => {
            const ast = { type: 'text', value: 'trailing space ' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"trailing space "');
        });

        test('should quote string starting with dash', () => {
            const ast = { type: 'text', value: '- looks like list' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"- looks like list"');
        });

        test('should quote string starting with bracket', () => {
            const ast = { type: 'text', value: '[array]' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"[array]"');
        });

        test('should quote string starting with brace', () => {
            const ast = { type: 'text', value: '{object}' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"{object}"');
        });

        test('should quote "true" string', () => {
            const ast = { type: 'text', value: 'true' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"true"');
        });

        test('should quote "false" string', () => {
            const ast = { type: 'text', value: 'false' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"false"');
        });

        test('should quote "null" string', () => {
            const ast = { type: 'text', value: 'null' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"null"');
        });

        test('should quote "yes" string', () => {
            const ast = { type: 'text', value: 'yes' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"yes"');
        });

        test('should quote "no" string', () => {
            const ast = { type: 'text', value: 'no' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"no"');
        });

        test('should quote "on" string', () => {
            const ast = { type: 'text', value: 'on' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"on"');
        });

        test('should quote "off" string', () => {
            const ast = { type: 'text', value: 'off' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"off"');
        });

        test('should quote numeric string', () => {
            const ast = { type: 'text', value: '12345' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"12345"');
        });

        test('should quote float string', () => {
            const ast = { type: 'text', value: '3.14159' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('"3.14159"');
        });

        test('should handle multiline string with newlines', () => {
            const ast = { type: 'text', value: 'line1\nline2' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('\\n');
        });

        test('should handle backslash in string', () => {
            const ast = { type: 'text', value: 'path\\to\\file' };
            const result = quikdown_yaml.stringify(ast);
            // Backslashes don't need quoting in YAML unless combined with other special chars
            expect(result).toContain('path\\to\\file');
        });
    });

    describe('Value type handling', () => {
        test('should handle null value', () => {
            const ast = { type: 'test', value: null };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('null');
        });

        test('should handle undefined value', () => {
            const ast = { type: 'test', value: undefined };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('null');
        });

        test('should handle true boolean', () => {
            const ast = { type: 'list_item', checked: true };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('true');
        });

        test('should handle false boolean', () => {
            const ast = { type: 'list_item', checked: false };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('false');
        });

        test('should handle number', () => {
            const ast = { type: 'heading', level: 3 };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('3');
        });

        test('should handle empty array', () => {
            const ast = { type: 'document', children: [] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('[]');
        });

        test('should handle empty object', () => {
            const ast = { type: 'test', data: {} };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('{}');
        });

        test('should handle array with empty object', () => {
            const ast = { items: [{}] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('{}');
        });

        test('should handle nested empty arrays', () => {
            const ast = { type: 'test', rows: [[]] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('[]');
        });
    });

    describe('Complex structures', () => {
        test('should handle deeply nested object', () => {
            const ast = {
                type: 'document',
                children: [{
                    type: 'blockquote',
                    children: [{
                        type: 'paragraph',
                        children: [{ type: 'text', value: 'nested' }]
                    }]
                }]
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('type: blockquote');
            expect(result).toContain('type: paragraph');
        });

        test('should handle array of simple values', () => {
            const ast = { alignments: ['left', 'center', 'right'] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('- left');
            expect(result).toContain('- center');
            expect(result).toContain('- right');
        });

        test('should handle table structure', () => {
            const ast = {
                type: 'table',
                headers: [[{ type: 'text', value: 'A' }]],
                rows: [[[{ type: 'text', value: '1' }]]],
                alignments: ['left']
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('type: table');
            expect(result).toContain('headers:');
            expect(result).toContain('rows:');
        });

        test('should handle object with nested array of objects', () => {
            const ast = {
                type: 'list',
                items: [
                    { type: 'list_item', children: [{ type: 'text', value: 'item1' }] },
                    { type: 'list_item', children: [{ type: 'text', value: 'item2' }] }
                ]
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('type: list');
            expect(result).toContain('type: list_item');
        });
    });

    describe('Markdown to YAML conversion', () => {
        test('should convert complex markdown', () => {
            const md = `# Title

Paragraph with **bold** and *italic*.

- item 1
- item 2

> blockquote

\`\`\`js
code
\`\`\``;
            const yaml = quikdown_yaml(md);
            expect(yaml).toContain('type: document');
            expect(yaml).toContain('type: heading');
            expect(yaml).toContain('type: paragraph');
            expect(yaml).toContain('type: list');
            expect(yaml).toContain('type: blockquote');
            expect(yaml).toContain('type: code_block');
        });

        test('should convert table to YAML', () => {
            const md = '| A | B |\n|:--|--:|\n| 1 | 2 |';
            const yaml = quikdown_yaml(md);
            expect(yaml).toContain('type: table');
            expect(yaml).toContain('alignments:');
        });

        test('should convert task list to YAML', () => {
            const md = '- [x] done\n- [ ] todo';
            const yaml = quikdown_yaml(md);
            expect(yaml).toContain('checked: true');
            expect(yaml).toContain('checked: false');
        });
    });

    describe('Additional edge cases', () => {
        test('should handle object with null property', () => {
            const ast = { type: 'code_block', lang: null, content: 'code' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('lang: null');
        });

        test('should handle nested object in array', () => {
            const ast = {
                items: [
                    { nested: { deep: 'value' } }
                ]
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('nested:');
            expect(result).toContain('deep: value');
        });

        test('should format value that is undefined', () => {
            const ast = { type: 'test', val: undefined };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('val: null');
        });

        test('should handle simple array in object', () => {
            const ast = { tags: ['a', 'b', 'c'] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('- a');
            expect(result).toContain('- b');
            expect(result).toContain('- c');
        });

        test('should handle nested arrays', () => {
            const ast = { rows: [['a', 'b'], ['c', 'd']] };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('rows:');
        });

        test('should handle complex table structure', () => {
            const ast = {
                type: 'table',
                headers: [[{type:'text',value:'A'}], [{type:'text',value:'B'}]],
                rows: [[[{type:'text',value:'1'}], [{type:'text',value:'2'}]]],
                alignments: ['left', 'right']
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('type: table');
            expect(result).toContain('headers:');
        });

        test('should handle empty string value', () => {
            const ast = { type: 'text', value: '' };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('""');
        });
    });

    describe('Nested list YAML conversion (lines 270-294)', () => {
        test('should convert simple nested list to YAML', () => {
            const md = '- item 1\n  - nested 1\n  - nested 2\n- item 2';
            const yaml = quikdown_yaml(md);
            expect(yaml).toContain('type: list');
        });

        test('should convert deeply nested list to YAML', () => {
            const md = '- level 1\n  - level 2\n    - level 3';
            const yaml = quikdown_yaml(md);
            expect(yaml).toContain('type: list');
        });

        test('should convert nested ordered list to YAML', () => {
            const md = '1. first\n   1. nested first\n2. second';
            const yaml = quikdown_yaml(md);
            expect(yaml).toContain('ordered: true');
        });
    });

    describe('Edge cases for formatValue fallback', () => {
        test('should handle nested object in array', () => {
            const ast = {
                items: [
                    { a: { b: { c: 'deep' } } }
                ]
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('c: deep');
        });

        test('should handle array of arrays', () => {
            const ast = {
                data: [['a', 'b'], ['c', 'd']]
            };
            const result = quikdown_yaml.stringify(ast);
            expect(result).toContain('data:');
        });
    });
});
