/**
 * Tests for quikdown_ast - Markdown to AST parser
 */
import quikdown_ast from '../dist/quikdown_ast.esm.js';
import { samples, forgivingSamples } from './fixtures/ast-samples.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load package.json to get the current version
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

describe('quikdown_ast parser', () => {

    describe('Basic functionality', () => {
        test('should export a function', () => {
            expect(typeof quikdown_ast).toBe('function');
        });

        test('should have version property', () => {
            expect(quikdown_ast.version).toBe(packageJson.version);
        });

        test('should handle empty input', () => {
            expect(quikdown_ast('')).toEqual({ type: 'document', children: [] });
            expect(quikdown_ast(null)).toEqual({ type: 'document', children: [] });
            expect(quikdown_ast(undefined)).toEqual({ type: 'document', children: [] });
        });

        test('should return document with children array', () => {
            const result = quikdown_ast('Hello');
            expect(result.type).toBe('document');
            expect(Array.isArray(result.children)).toBe(true);
        });
    });

    describe('Headings', () => {
        test('should parse h1-h6', () => {
            for (let i = 1; i <= 6; i++) {
                const markdown = '#'.repeat(i) + ' Heading ' + i;
                const result = quikdown_ast(markdown);
                expect(result.children[0].type).toBe('heading');
                expect(result.children[0].level).toBe(i);
            }
        });

        test('should parse heading content as inline', () => {
            const result = quikdown_ast('# Hello **world**');
            expect(result.children[0].children).toEqual([
                { type: 'text', value: 'Hello ' },
                { type: 'strong', children: [{ type: 'text', value: 'world' }] }
            ]);
        });
    });

    describe('Paragraphs', () => {
        test('should parse simple paragraph', () => {
            const result = quikdown_ast('Hello world');
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[0].children[0].value).toBe('Hello world');
        });

        test('should handle multiple paragraphs', () => {
            const result = quikdown_ast('First\n\nSecond');
            expect(result.children.length).toBe(2);
            expect(result.children[0].type).toBe('paragraph');
            expect(result.children[1].type).toBe('paragraph');
        });
    });

    describe('Code blocks', () => {
        test('should parse fenced code block with ```', () => {
            const result = quikdown_ast('```js\nconst x = 1;\n```');
            expect(result.children[0].type).toBe('code_block');
            expect(result.children[0].lang).toBe('js');
            expect(result.children[0].content).toBe('const x = 1;');
            expect(result.children[0].fence).toBe('```');
        });

        test('should parse fenced code block with ~~~', () => {
            const result = quikdown_ast('~~~python\nprint("hello")\n~~~');
            expect(result.children[0].type).toBe('code_block');
            expect(result.children[0].lang).toBe('python');
            expect(result.children[0].fence).toBe('~~~');
        });

        test('should handle code block without language', () => {
            const result = quikdown_ast('```\ncode\n```');
            expect(result.children[0].lang).toBe(null);
        });
    });

    describe('Lists', () => {
        test('should parse unordered list', () => {
            const result = quikdown_ast('- item 1\n- item 2');
            expect(result.children[0].type).toBe('list');
            expect(result.children[0].ordered).toBe(false);
            expect(result.children[0].items.length).toBe(2);
        });

        test('should parse ordered list', () => {
            const result = quikdown_ast('1. first\n2. second');
            expect(result.children[0].type).toBe('list');
            expect(result.children[0].ordered).toBe(true);
        });

        test('should parse task list items', () => {
            const result = quikdown_ast('- [ ] unchecked\n- [x] checked');
            expect(result.children[0].items[0].checked).toBe(false);
            expect(result.children[0].items[1].checked).toBe(true);
        });

        test('should handle list markers - * +', () => {
            const resultDash = quikdown_ast('- item');
            const resultStar = quikdown_ast('* item');
            const resultPlus = quikdown_ast('+ item');

            expect(resultDash.children[0].type).toBe('list');
            expect(resultStar.children[0].type).toBe('list');
            expect(resultPlus.children[0].type).toBe('list');
        });
    });

    describe('Inline formatting', () => {
        test('should parse bold with **', () => {
            const result = quikdown_ast('**bold**');
            expect(result.children[0].children[0].type).toBe('strong');
        });

        test('should parse bold with __', () => {
            const result = quikdown_ast('__bold__');
            expect(result.children[0].children[0].type).toBe('strong');
        });

        test('should parse italic with *', () => {
            const result = quikdown_ast('*italic*');
            expect(result.children[0].children[0].type).toBe('em');
        });

        test('should parse italic with _', () => {
            const result = quikdown_ast('_italic_');
            expect(result.children[0].children[0].type).toBe('em');
        });

        test('should parse strikethrough', () => {
            const result = quikdown_ast('~~strike~~');
            expect(result.children[0].children[0].type).toBe('del');
        });

        test('should parse inline code', () => {
            const result = quikdown_ast('`code`');
            expect(result.children[0].children[0].type).toBe('code');
            expect(result.children[0].children[0].value).toBe('code');
        });

        test('should parse links', () => {
            const result = quikdown_ast('[text](https://example.com)');
            expect(result.children[0].children[0].type).toBe('link');
            expect(result.children[0].children[0].url).toBe('https://example.com');
        });

        test('should parse images', () => {
            const result = quikdown_ast('![alt](image.png)');
            expect(result.children[0].children[0].type).toBe('image');
            expect(result.children[0].children[0].url).toBe('image.png');
            expect(result.children[0].children[0].alt).toBe('alt');
        });

        test('should parse autolinks', () => {
            const result = quikdown_ast('Check https://example.com for more');
            const linkNode = result.children[0].children.find(n => n.type === 'link');
            expect(linkNode).toBeDefined();
            expect(linkNode.url).toBe('https://example.com');
        });
    });

    describe('Blockquotes', () => {
        test('should parse blockquote', () => {
            const result = quikdown_ast('> quoted');
            expect(result.children[0].type).toBe('blockquote');
        });

        test('should parse nested blockquote content', () => {
            const result = quikdown_ast('> line 1\n> line 2');
            expect(result.children[0].type).toBe('blockquote');
        });
    });

    describe('Horizontal rules', () => {
        test('should parse hr with ---', () => {
            const result = quikdown_ast('---');
            expect(result.children[0].type).toBe('hr');
        });

        test('should parse hr with ***', () => {
            const result = quikdown_ast('***');
            expect(result.children[0].type).toBe('hr');
        });

        test('should parse hr with ___', () => {
            const result = quikdown_ast('___');
            expect(result.children[0].type).toBe('hr');
        });
    });

    describe('Tables', () => {
        test('should parse simple table', () => {
            const result = quikdown_ast('| A | B |\n|---|---|\n| 1 | 2 |');
            expect(result.children[0].type).toBe('table');
            expect(result.children[0].headers.length).toBe(2);
            expect(result.children[0].rows.length).toBe(1);
        });

        test('should parse table alignments', () => {
            const result = quikdown_ast('| L | C | R |\n|:--|:--:|--:|\n| 1 | 2 | 3 |');
            expect(result.children[0].alignments).toEqual(['left', 'center', 'right']);
        });
    });

    describe('Forgiving behaviors', () => {
        test('should trim whitespace in URLs', () => {
            const result = quikdown_ast('[text](  https://example.com  )');
            expect(result.children[0].children[0].url).toBe('https://example.com');
        });

        test('should handle unclosed code fences', () => {
            const result = quikdown_ast('```js\ncode without closing');
            expect(result.children[0].type).toBe('code_block');
            expect(result.children[0].content).toBe('code without closing');
        });

        test('should normalize CRLF line endings', () => {
            const result = quikdown_ast('# Hello\r\n\r\nWorld');
            expect(result.children[0].type).toBe('heading');
            expect(result.children[1].type).toBe('paragraph');
        });

        test('should normalize CR line endings', () => {
            const result = quikdown_ast('# Hello\r\rWorld');
            expect(result.children[0].type).toBe('heading');
        });

        test('should parse table without outer pipes', () => {
            const result = quikdown_ast('A | B\n---|---\n1 | 2');
            expect(result.children[0].type).toBe('table');
        });
    });

    describe('Sample fixtures', () => {
        Object.entries(samples).forEach(([name, sample]) => {
            test(`should correctly parse ${name}`, () => {
                const result = quikdown_ast(sample.markdown);
                expect(result.type).toBe('document');
                expect(result.children.length).toBeGreaterThan(0);
                // Type check
                expect(result.children[0].type).toBe(sample.ast.children[0].type);
            });
        });
    });

    describe('Complex documents', () => {
        test('should parse combined content', () => {
            const markdown = `# Title

Paragraph with **bold** and *italic*.

\`\`\`js
const x = 1;
\`\`\`

- list item 1
- list item 2

> blockquote

| A | B |
|---|---|
| 1 | 2 |`;

            const result = quikdown_ast(markdown);
            expect(result.type).toBe('document');

            const types = result.children.map(c => c.type);
            expect(types).toContain('heading');
            expect(types).toContain('paragraph');
            expect(types).toContain('code_block');
            expect(types).toContain('list');
            expect(types).toContain('blockquote');
            expect(types).toContain('table');
        });
    });
});
