/**
 * @jest-environment jsdom
 */

/**
 * @file quikdown_edit_fence_arguments.test.js
 *
 * Fence info strings with arguments in the editor (```mermaid #arch,
 * ```js run #cell): renderer choice by first word, customFences handler
 * arguments, allowFenceArguments: false, and the verbatim info string
 * surviving a round trip through the preview pane for every built-in
 * renderer.
 */

import QuikdownEditor from '../dist/quikdown_edit.esm.js';

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

const WINDOW_KEYS = [
    'L', 'THREE', 'hljs', 'mermaid', 'MathJax', 'DOMPurify', 'vegaEmbed', 'ABCJS',
    '_qde_leaflet_loading', '_qde_three_loading', '_qde_abcjs_loading', '_qde_vega_loading',
    '_qde_worldGeoJSON', '_qde_admin1GeoJSON', '_qde_ensureBasemap', 'mathJaxLoading', '_qde_mathjax_failed',
];

let editor;
let host;

async function makeEditor(options = {}) {
    host = document.createElement('div');
    document.body.appendChild(host);
    editor = new QuikdownEditor(host, options);
    await editor.initPromise;
    return editor;
}

const fence = (info, body) => '```' + info + '\n' + body + '\n```';
const preview = (selector) => editor.previewPanel.querySelector(selector);
const byInfo = (info) => Array.from(editor.previewPanel.querySelectorAll('[data-qd-lang]'))
    .find(el => el.getAttribute('data-qd-lang') === info);

/** Keep library loads pending so no renderer fetches anything. */
let heldScripts;
function holdScripts() {
    heldScripts = [];
    const real = Node.prototype.appendChild;
    document.head.appendChild = function (el) {
        if (el.tagName === 'SCRIPT' || el.tagName === 'LINK') {
            heldScripts.push(el);
            return el;
        }
        return real.call(this, el);
    };
}

beforeEach(() => {
    jest.useFakeTimers();
    holdScripts();
});

afterEach(() => {
    if (editor) {
        editor.destroy();
        editor = null;
    }
    if (host) {
        host.remove();
        host = null;
    }
    delete document.head.appendChild;
    WINDOW_KEYS.forEach(key => { delete window[key]; });
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

const ARGS = ' #cell run title="A <b> & c"';

// [language, body, selector the built-in renderer produces]
const RENDERERS = [
    ['svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>', '.qde-svg-container'],
    ['html', '<p>hi</p>', '.qde-html-container'],
    ['math', 'x^2', '.math-display'],
    ['csv', 'a,b\n1,2', 'table.qde-csv-table'],
    ['tsv', 'a\tb\n1\t2', 'table.qde-csv-table'],
    ['json', '{"a": 1}', 'pre.qde-json'],
    ['mermaid', 'graph TD; A-->B', '.mermaid'],
    ['geojson', '{"type": "FeatureCollection", "features": []}', '.geojson-container'],
    ['stl', 'solid t\nendsolid t', '.qde-stl-container'],
    ['abc', 'X:1\nK:C\nC', '.qde-abc-container'],
    ['vega-lite', '{"mark": "bar"}', '.qde-vega-container'],
];

describe('built-in renderers with fence arguments', () => {
    beforeEach(() => {
        window.mermaid = { render: jest.fn(() => new Promise(() => {})) };
    });

    test.each(RENDERERS)('```%s with arguments renders and keeps the info string', async (lang, body, selector) => {
        await makeEditor();
        const info = lang + ARGS;
        await editor.setMarkdown(fence(info, body));

        const el = preview(selector);
        expect(el).not.toBeNull();
        expect(byInfo(info)).toBeDefined();
    });

    test.each(RENDERERS)('```%s with arguments round-trips through the preview pane', async (lang, body, selector) => {
        await makeEditor();
        const md = fence(lang + ARGS, body);
        await editor.setMarkdown(md);
        expect(preview(selector)).not.toBeNull();

        editor.updateFromHTML('user');
        expect(editor.getMarkdown().split('\n')[0]).toBe('```' + lang + ARGS);
    });

    test('html fence keeps the info string after DOMPurify loads', async () => {
        await makeEditor();
        const info = 'html' + ARGS;
        await editor.setMarkdown(fence(info, '<p>hi</p>'));
        expect(preview('.qde-html-container pre').textContent).toBe('<p>hi</p>');

        // The library arrives late and fills the placeholder in place.
        const script = heldScripts.find(el => /purify/.test(el.src));
        expect(script).toBeDefined();
        window.DOMPurify = { sanitize: (s) => s };
        script.onload();
        for (let i = 0; i < 20; i++) await Promise.resolve();

        const container = preview('.qde-html-container');
        expect(container.querySelector('p').textContent).toBe('hi');
        expect(container.getAttribute('data-qd-lang')).toBe(info);
    });
});

describe('customFences with fence arguments', () => {
    test('handler is chosen by first word and gets (code, lang, info)', async () => {
        const js = jest.fn(() => '<div class="cell"></div>');
        await makeEditor({ customFences: { js } });
        await editor.setMarkdown(fence('js run #a', 'let a = 1;'));

        expect(js).toHaveBeenCalledWith('let a = 1;', 'js', 'js run #a');
        expect(preview('.cell').getAttribute('data-qd-lang')).toBe('js run #a');
    });

    test('a key equal to the whole info string wins over the first word', async () => {
        const whole = jest.fn(() => '<div class="whole"></div>');
        const first = jest.fn(() => '<div class="first"></div>');
        await makeEditor({ customFences: { 'js run': whole, js: first } });
        await editor.setMarkdown(fence('js run', 'x'));

        expect(whole).toHaveBeenCalledWith('x', 'js run', 'js run');
        expect(first).not.toHaveBeenCalled();
        expect(preview('.whole')).not.toBeNull();
    });

    test('a handler returning undefined falls back to a plain code block', async () => {
        await makeEditor({ customFences: { js: () => undefined } });
        await editor.setMarkdown(fence('js run', 'x'));
        expect(preview('pre code.language-js').textContent).toBe('x');
        expect(preview('pre').getAttribute('data-qd-lang')).toBe('js run');
    });

    test('a throwing handler falls back with the first-word class', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor({ customFences: { js: () => { throw new Error('no'); } } });
        const { render } = editor.createFencePlugin();
        expect(render('x', 'js run')).toBe('<pre><code class="language-js">x</code></pre>');
    });

    test('names inherited from Object.prototype are not handlers', async () => {
        await makeEditor();
        const { render } = editor.createFencePlugin();
        for (const name of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
            expect(render('x', name)).toBeUndefined();
        }
        await editor.setMarkdown(fence('toString', 'x'));
        expect(preview('pre code').textContent).toBe('x');
    });

    test('a non-function value is ignored', async () => {
        await makeEditor({ customFences: { js: 'not a function' } });
        const { render } = editor.createFencePlugin();
        expect(render('x', 'js')).toBeUndefined();
        expect(render('x', '')).toBeUndefined();
        expect(render('x')).toBeUndefined();
    });
});

describe('highlight.js with fence arguments', () => {
    test('highlights by first word and keeps the info string', async () => {
        window.hljs = {
            getLanguage: jest.fn(lang => lang === 'js'),
            highlight: jest.fn(() => ({ value: '<span class="hljs-keyword">let</span> a' })),
        };
        await makeEditor();
        await editor.setMarkdown(fence('js run #a', 'let a'));

        expect(window.hljs.highlight).toHaveBeenCalledWith('let a', { language: 'js' });
        const pre = byInfo('js run #a');
        expect(pre.querySelector('code.hljs.language-js')).not.toBeNull();

        editor.updateFromHTML('user');
        expect(editor.getMarkdown()).toBe(fence('js run #a', 'let a'));
    });
});

describe('allowFenceArguments: false', () => {
    test('the whole info string is the language, as before 1.3.2', async () => {
        window.mermaid = { render: jest.fn(() => new Promise(() => {})) };
        const js = jest.fn(() => '<div class="cell"></div>');
        await makeEditor({ allowFenceArguments: false, customFences: { js } });
        await editor.setMarkdown(fence('mermaid #arch', 'graph TD; A-->B') + '\n\n' + fence('js run', 'x'));

        expect(preview('.mermaid')).toBeNull();
        expect(js).not.toHaveBeenCalled();
        expect(byInfo('mermaid #arch').tagName).toBe('PRE');
    });

    test('exact keys still match', async () => {
        const js = jest.fn(() => '<div class="cell"></div>');
        await makeEditor({ allowFenceArguments: false, customFences: { js } });
        await editor.setMarkdown(fence('js', 'x'));
        expect(js).toHaveBeenCalledWith('x', 'js', 'js');
    });

    test('a CSV table with arguments is not converted back as CSV', async () => {
        await makeEditor({ allowFenceArguments: false });
        const panel = document.createElement('div');
        panel.innerHTML = '<table class="qde-csv-table" data-qd-lang="csv #x"><tbody><tr><td>1</td></tr></tbody></table>';
        editor.preprocessSpecialElements(panel);
        expect(panel.querySelector('table')).not.toBeNull();
    });
});

describe('editing a CSV table with arguments', () => {
    test('the edited table is written back under the same fence line', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('csv #sales', 'region,q1\nwest,120'));

        preview('tbody td').textContent = 'east';
        editor.updateFromHTML('user');
        expect(editor.getMarkdown()).toBe(fence('csv #sales', 'region,q1\neast,120'));
    });
});
