/**
 * @jest-environment jsdom
 */

/**
 * @file quikdown_fence_arguments.test.js
 *
 * Fence info strings with arguments (```js run #id) in the parser family:
 * the first word is the language, the rest is preserved and passed on.
 * Editor behaviour is in quikdown_edit_fence_arguments.test.js.
 */

import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';
import quikdown_ast from '../dist/quikdown_ast.esm.js';
import quikdown_json from '../dist/quikdown_json.esm.js';
import quikdown_yaml from '../dist/quikdown_yaml.esm.js';
import quikdown_ast_html from '../dist/quikdown_ast_html.esm.js';

const fence = (info, body = 'let a = 1;', marker = '```') => `${marker}${info}\n${body}\n${marker}`;

describe('core: language class from the first word', () => {
    test.each([
        ['js run #summary', 'js'],
        ['js {#foo} run=1', 'js'],
        ['js\trun', 'js'],
        ['js    run', 'js'],
        ['  js run  ', 'js'],
        ['js', 'js'],
        ['JavaScript run', 'JavaScript'],
    ])('```%s → language-%s', (info, lang) => {
        expect(quikdown(fence(info))).toContain(`<code class="language-${lang}">`);
    });

    test('tilde fences behave the same', () => {
        expect(quikdown(fence('py title="x"', 'print(1)', '~~~'))).toContain('<code class="language-py">print(1)</code>');
    });

    test('a fence with no info string has no class', () => {
        expect(quikdown(fence(''))).toContain('<code>let a = 1;</code>');
    });

    test('a brace-first info string is an unknown language, still escaped', () => {
        const html = quikdown(fence('{.js #foo}'));
        expect(html).toContain('<code class="language-{.js">');
    });

    test('special characters in the first word stay escaped', () => {
        const html = quikdown(fence('a"<b> x'));
        expect(html).toContain('class="language-a&quot;&lt;b&gt;"');
        expect(html).not.toContain('<b>');
    });

    test('inline_styles output has no language class', () => {
        const html = quikdown(fence('js run'), { inline_styles: true });
        expect(html).not.toContain('language-');
        expect(html).toContain('let a = 1;');
    });

    test('a fence with arguments inside a list item keeps its body', () => {
        const html = quikdown('- item\n\n' + fence('js run'));
        expect(html).toContain('<code class="language-js">let a = 1;</code>');
    });
});

describe('core: fence_plugin receives the whole info string', () => {
    test('render(code, info) gets the verbatim info string', () => {
        const render = jest.fn(() => '<div class="cell"></div>');
        quikdown(fence('js run #summary in=sales title="A b"'), { fence_plugin: { render } });
        expect(render).toHaveBeenCalledWith('let a = 1;', 'js run #summary in=sales title="A b"');
    });

    test('a declining plugin falls back to the first-word class', () => {
        const html = quikdown(fence('js run'), { fence_plugin: { render: () => undefined } });
        expect(html).toContain('<code class="language-js">let a = 1;</code>');
    });
});

describe('bidirectional: info string is preserved', () => {
    const info = 'js run #summary title="A <b> & c"';

    test('data-qd-lang holds the full info string, class the first word', () => {
        const html = quikdown_bd(fence(info));
        const div = document.createElement('div');
        div.innerHTML = html;
        const pre = div.querySelector('pre');
        expect(pre.getAttribute('data-qd-lang')).toBe(info);
        expect(pre.querySelector('code').className).toBe('language-js');
    });

    test('toMarkdown writes the fence line back unchanged', () => {
        expect(quikdown_bd.toMarkdown(quikdown_bd(fence(info))).trim()).toBe(fence(info));
    });

    test('tilde fence round trip keeps marker and info string', () => {
        const md = fence('py run', 'print(1)', '~~~');
        expect(quikdown_bd.toMarkdown(quikdown_bd(md)).trim()).toBe(md);
    });

    test('plugin output carries the full info string for the reverse pass', () => {
        const fence_plugin = {
            render: (code) => `<div class="cell">${code}</div>`,
            reverse: (el) => ({ content: el.getAttribute('data-qd-source'), lang: el.getAttribute('data-qd-lang') }),
        };
        const html = quikdown_bd(fence(info), { fence_plugin });
        const div = document.createElement('div');
        div.innerHTML = html;
        expect(div.querySelector('.cell').getAttribute('data-qd-lang')).toBe(info);
        expect(quikdown_bd.toMarkdown(html, { fence_plugin }).trim()).toBe(fence(info));
    });
});

describe('AST: lang is the first word, meta the rest', () => {
    const md = fence('js run #summary\tin=sales');

    test('quikdown_ast', () => {
        const [node] = quikdown_ast(md).children;
        expect(node).toMatchObject({ type: 'code_block', lang: 'js', meta: 'run #summary\tin=sales' });
    });

    test('no meta field without arguments', () => {
        const [node] = quikdown_ast(fence('js')).children;
        expect(node.lang).toBe('js');
        expect('meta' in node).toBe(false);
        expect(quikdown_ast(fence('')).children[0].lang).toBeNull();
    });

    test('quikdown_json', () => {
        const [node] = JSON.parse(quikdown_json(md)).children;
        expect(node.lang).toBe('js');
        expect(node.meta).toBe('run #summary\tin=sales');
        expect('meta' in JSON.parse(quikdown_json(fence('js'))).children[0]).toBe(false);
    });

    test('quikdown_yaml', () => {
        const yaml = quikdown_yaml(fence('js run'));
        expect(yaml).toMatch(/lang: js\n/);
        expect(yaml).toMatch(/meta: run$/m);
        expect(quikdown_yaml(fence('js'))).not.toContain('meta:');
    });

    test('quikdown_ast_html uses the first word for the class', () => {
        expect(quikdown_ast_html(md)).toContain('<code class="language-js">let a = 1;</code>');
        expect(quikdown_ast_html(fence('js'))).toContain('<code class="language-js">');
    });
});
