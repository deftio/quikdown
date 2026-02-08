/**
 * Additional coverage tests for quikdown_ast
 */
import quikdown_ast from '../dist/quikdown_ast.esm.js';

describe('quikdown_ast coverage boost', () => {

    describe('Table edge cases', () => {
        test('should handle table with only header (no body rows)', () => {
            const result = quikdown_ast('| A | B |\n|---|---|');
            expect(result.children[0].type).toBe('table');
            expect(result.children[0].rows.length).toBe(0);
        });

        test('should handle single column table', () => {
            const result = quikdown_ast('|A|\n|---|\n|1|');
            expect(result.children[0].type).toBe('table');
            expect(result.children[0].headers.length).toBe(1);
        });

        test('should not parse line with pipe but no valid separator', () => {
            const result = quikdown_ast('text | with | pipes');
            expect(result.children[0].type).toBe('paragraph');
        });
    });

    describe('List edge cases', () => {
        test('should handle list type change at same level', () => {
            const md = '- unordered\n1. ordered';
            const result = quikdown_ast(md);
            expect(result.children.length).toBe(2);
        });

        test('should handle list with + marker', () => {
            const md = '+ item 1\n+ item 2';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });

        test('should handle list with * marker', () => {
            const md = '* item 1\n* item 2';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });
    });

    describe('Inline parsing edge cases', () => {
        test('should handle unmatched asterisk', () => {
            const result = quikdown_ast('text * with asterisk');
            expect(result.children[0].type).toBe('paragraph');
        });

        test('should handle unmatched underscore', () => {
            const result = quikdown_ast('text _ underscore');
            expect(result.children[0].type).toBe('paragraph');
        });

        test('should handle unmatched backtick', () => {
            const result = quikdown_ast('text ` backtick');
            expect(result.children[0].type).toBe('paragraph');
        });

        test('should handle unmatched tilde', () => {
            const result = quikdown_ast('text ~ tilde');
            expect(result.children[0].type).toBe('paragraph');
        });

        test('should handle exclamation mark alone', () => {
            const result = quikdown_ast('Hello! World');
            expect(result.children[0].children[0].type).toBe('text');
        });

        test('should handle open bracket alone', () => {
            const result = quikdown_ast('text [not link');
            expect(result.children[0].type).toBe('paragraph');
        });
    });

    describe('Block element edge cases', () => {
        test('should handle paragraph before code block', () => {
            const result = quikdown_ast('para\n```\ncode\n```');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('code_block');
        });

        test('should handle paragraph before heading', () => {
            const result = quikdown_ast('para\n# heading');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('heading');
        });

        test('should handle paragraph before hr', () => {
            const result = quikdown_ast('para\n---');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('hr');
        });

        test('should handle paragraph before blockquote', () => {
            const result = quikdown_ast('para\n> quote');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('blockquote');
        });

        test('should handle paragraph before list', () => {
            const result = quikdown_ast('para\n- list');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('list');
        });

        test('should handle tilde fence code block', () => {
            const result = quikdown_ast('~~~js\ncode\n~~~');
            expect(result.children[0].type).toBe('code_block');
            expect(result.children[0].fence).toBe('~~~');
        });

        test('should handle hr with asterisks', () => {
            const result = quikdown_ast('***');
            expect(result.children[0].type).toBe('hr');
        });

        test('should handle hr with underscores', () => {
            const result = quikdown_ast('___');
            expect(result.children[0].type).toBe('hr');
        });

        test('should handle multiple blockquote lines', () => {
            const result = quikdown_ast('> line 1\n> line 2');
            expect(result.children[0].type).toBe('blockquote');
        });
    });

    describe('Image and link edge cases', () => {
        test('should handle image with empty alt', () => {
            const result = quikdown_ast('![](img.png)');
            expect(result.children[0].children[0].type).toBe('image');
            expect(result.children[0].children[0].alt).toBe('');
        });

        test('should handle link with spaces in URL', () => {
            const result = quikdown_ast('[t](  url  )');
            expect(result.children[0].children[0].url).toBe('url');
        });
    });

    describe('Heading edge cases', () => {
        test('should handle h1 with trailing hashes', () => {
            const result = quikdown_ast('# Heading ###');
            expect(result.children[0].type).toBe('heading');
            expect(result.children[0].level).toBe(1);
        });

        test('should parse all heading levels', () => {
            for (let i = 1; i <= 6; i++) {
                const result = quikdown_ast('#'.repeat(i) + ' H' + i);
                expect(result.children[0].level).toBe(i);
            }
        });
    });

    describe('Code block edge cases', () => {
        test('should handle code block with trailing spaces in lang', () => {
            const result = quikdown_ast('```js   \ncode\n```');
            expect(result.children[0].lang).toBe('js');
        });

        test('should handle empty code block', () => {
            const result = quikdown_ast('```\n```');
            expect(result.children[0].type).toBe('code_block');
            expect(result.children[0].content).toBe('');
        });
    });

    describe('Table header edge cases', () => {
        test('should handle table with pipe only header', () => {
            const result = quikdown_ast('|\n|---|\n|1|');
            // Should parse as table with empty header
            expect(result.children.length).toBeGreaterThan(0);
        });

        test('should handle last line being table header line', () => {
            const result = quikdown_ast('| A |');
            // Not a valid table without separator
            expect(result.children[0].type).toBe('paragraph');
        });
    });

    describe('Paragraph before table', () => {
        test('should handle paragraph followed by table', () => {
            const result = quikdown_ast('para\n| A |\n|---|\n| 1 |');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('table');
        });
    });

    describe('Nested list handling (lines 265-287)', () => {
        test('should handle simple nested unordered list', () => {
            const md = '- item 1\n  - nested 1\n  - nested 2\n- item 2';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
            expect(result.children[0].items.length).toBeGreaterThanOrEqual(1);
        });

        test('should handle nested ordered list', () => {
            const md = '1. first\n   1. nested first\n   2. nested second\n2. second';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
            expect(result.children[0].ordered).toBe(true);
        });

        test('should handle mixed nested lists', () => {
            const md = '- outer\n  1. inner ordered\n  2. inner ordered 2';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });

        test('should handle deeply nested list (3 levels)', () => {
            const md = '- level 1\n  - level 2\n    - level 3';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });

        test('should handle nested list item with content', () => {
            const md = '- parent item\n  - child with **bold**';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });

        test('should handle nested list after task item', () => {
            const md = '- [x] task done\n  - subtask 1\n  - subtask 2';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });

        test('should handle nested list with different markers', () => {
            const md = '* outer star\n  + inner plus\n  - inner dash';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });

        test('should break on non-list line in nested context', () => {
            const md = '- item\n  - nested\n  not a list';
            const result = quikdown_ast(md);
            expect(result.children.length).toBeGreaterThanOrEqual(1);
        });

        test('should handle return to parent indent level', () => {
            const md = '- item 1\n  - nested\n- item 2';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
            expect(result.children[0].items.length).toBe(2);
        });

        test('should handle nested list adding children to last item', () => {
            const md = '- first\n- second\n  - nested under second';
            const result = quikdown_ast(md);
            const list = result.children[0];
            expect(list.items.length).toBe(2);
        });

        test('should handle empty nested list gracefully', () => {
            const md = '- item\n  ';
            const result = quikdown_ast(md);
            expect(result.children[0].type).toBe('list');
        });
    });
});
