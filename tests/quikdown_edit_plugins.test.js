/**
 * @jest-environment jsdom
 */

/**
 * @file quikdown_edit_plugins.test.js
 *
 * - loadPlugins / lazyLoadLibrary / loadScript / loadCSS, with <script> and
 *   <link> insertion intercepted so nothing is fetched
 * - the statics removeHRFromMarkdown / convertLazyLinefeeds and the toolbar
 *   feedback of removeHR() / convertLazyLinefeeds()
 * - parser and HTML-to-markdown paths of the bundle that are reachable
 *   through the editor (reference links, footnotes, blockquotes, indented
 *   code, list continuation, tables)
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

const WINDOW_KEYS = ['L', 'THREE', 'hljs', 'mermaid', 'MathJax', 'DOMPurify', 'vegaEmbed', 'ABCJS', 'mathJaxLoading', '_qde_mathjax_failed'];

let editors = [];
let editor;

function construct(options = {}) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const instance = new QuikdownEditor(host, options);
    editors.push({ instance, host });
    return instance;
}

async function makeEditor(options = {}) {
    editor = construct(options);
    await editor.initPromise;
    return editor;
}

const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
};

/**
 * Intercept <script>/<link> insertion into <head>.
 * decide(el) returns:
 *   'load'    - fire onload without inserting
 *   'attach'  - really insert (jsdom fetches nothing), then fire onload
 *   'error'   - fire onerror
 *   'pending' - do nothing; the test fires the event itself
 */
function interceptHead(decide = () => 'load') {
    const appended = [];
    const real = Node.prototype.appendChild;
    document.head.appendChild = function (el) {
        if (el.tagName !== 'SCRIPT' && el.tagName !== 'LINK') return real.call(this, el);
        appended.push(el);
        const outcome = decide(el);
        if (outcome === 'attach') real.call(this, el);
        if ((outcome === 'load' || outcome === 'attach') && el.onload) el.onload();
        if (outcome === 'error' && el.onerror) el.onerror(new Error('network down'));
        return el;
    };
    return appended;
}

const urlOf = el => el.src || el.href;

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    editors.forEach(({ instance, host }) => {
        if (instance.container.classList.contains('qde-container')) instance.destroy();
        host.remove();
    });
    editors = [];
    editor = null;
    delete document.head.appendChild;
    document.head.querySelectorAll('script, link').forEach(el => el.remove());
    WINDOW_KEYS.forEach(key => { delete window[key]; });
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

// ───────────────────────── loadPlugins ─────────────────────────

describe('loadPlugins', () => {
    const HLJS = 'https://unpkg.com/@highlightjs/cdn-assets/highlight.min.js';
    const HLJS_LIGHT = 'https://unpkg.com/@highlightjs/cdn-assets/styles/github.min.css';
    const HLJS_DARK = 'https://unpkg.com/@highlightjs/cdn-assets/styles/github-dark.min.css';
    const MERMAID = 'https://unpkg.com/mermaid/dist/mermaid.min.js';
    const THREE = 'https://unpkg.com/three@0.147.0/build/three.min.js';
    const ABCJS = 'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js';
    const VEGA = [
        'https://cdn.jsdelivr.net/npm/vega@5',
        'https://cdn.jsdelivr.net/npm/vega-lite@5',
        'https://cdn.jsdelivr.net/npm/vega-embed@6',
    ];

    function loadLegacyLibraries(el) {
        if (el.src === MERMAID) window.mermaid = { initialize: jest.fn() };
        return el.tagName === 'LINK' ? 'attach' : 'load';
    }

    test('nothing is loaded by default', async () => {
        const appended = interceptHead();
        await makeEditor();
        expect(appended).toHaveLength(0);
    });

    test('legacy plugins flags load highlight.js with both themes and initialise Mermaid', async () => {
        const appended = interceptHead(loadLegacyLibraries);
        await makeEditor({ plugins: { highlightjs: true, mermaid: true }, theme: 'light' });

        expect(appended.map(urlOf)).toEqual([HLJS, HLJS_LIGHT, HLJS_DARK, MERMAID]);
        const light = document.getElementById('qde-hljs-light');
        const dark = document.getElementById('qde-hljs-dark');
        expect(light.getAttribute('href')).toBe(HLJS_LIGHT);
        expect(light.rel).toBe('stylesheet');
        expect(dark.getAttribute('href')).toBe(HLJS_DARK);
        expect(light.disabled).toBe(false);
        expect(dark.disabled).toBe(true);
        expect(window.mermaid.initialize).toHaveBeenCalledWith({ startOnLoad: false });
    });

    test('the dark theme enables the dark highlight.js stylesheet instead', async () => {
        interceptHead(loadLegacyLibraries);
        await makeEditor({ plugins: { highlightjs: true }, theme: 'dark' });

        expect(document.getElementById('qde-hljs-light').disabled).toBe(true);
        expect(document.getElementById('qde-hljs-dark').disabled).toBe(false);
    });

    test('libraries that are already present are not loaded again', async () => {
        window.hljs = { getLanguage: () => false };
        window.mermaid = { initialize: jest.fn() };
        const appended = interceptHead();
        await makeEditor({ plugins: { highlightjs: true, mermaid: true } });

        expect(appended).toHaveLength(0);
        expect(window.mermaid.initialize).not.toHaveBeenCalled();
    });

    test("preloadFences: 'all' requests every known library and preconfigures MathJax", async () => {
        const appended = interceptHead();
        await makeEditor({ preloadFences: 'all' });

        expect(new Set(appended.map(urlOf))).toEqual(new Set([
            HLJS, HLJS_LIGHT, HLJS_DARK, MERMAID,
            'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            THREE, ABCJS, ...VEGA,
        ]));
        expect(window.MathJax.svg.fontCache).toBe('none');
        expect(window.MathJax.startup.typeset).toBe(false);
        expect(window.MathJax.loader.load).toEqual(['input/tex', 'output/svg']);
    });

    test('an array preloads named libraries and custom entries, and warns about unknown names', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const appended = interceptHead();
        await makeEditor({
            preloadFences: [
                'stl',
                'nope',
                { name: 'mylib', script: 'https://cdn.example/mylib.js', css: 'https://cdn.example/mylib.css' },
                { script: 'https://cdn.example/anon.js' },
                { name: 'no-script' },
                null,
                42,
            ],
        });

        expect(appended.map(urlOf)).toEqual([
            THREE,
            'https://cdn.example/mylib.js',
            'https://cdn.example/mylib.css',
            'https://cdn.example/anon.js',
        ]);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('QuikdownEditor: unknown preloadFences entry "nope"');

        // custom entries belong to that editor only
        await makeEditor({ preloadFences: ['stl'] });
        expect(appended.map(urlOf).slice(4)).toEqual([THREE]);
    });

    test('plugins: null with a preloadFences array loads only the array', async () => {
        const appended = interceptHead();
        await makeEditor({ plugins: null, preloadFences: ['abc'] });
        expect(appended.map(urlOf)).toEqual([ABCJS]);
    });

    test('an invalid preloadFences value is reported and ignored', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const appended = interceptHead();
        await makeEditor({ preloadFences: 'everything' });

        expect(warnSpy).toHaveBeenCalledWith('QuikdownEditor: preloadFences should be "all", an array, or null');
        expect(appended).toHaveLength(0);
    });

    test('multi-script libraries load their scripts one after another', async () => {
        const appended = interceptHead(() => 'pending');
        editor = construct({ preloadFences: ['vega'] });
        await flush();
        expect(appended.map(urlOf)).toEqual(VEGA.slice(0, 1));

        appended[0].onload();
        await flush();
        expect(appended.map(urlOf)).toEqual(VEGA.slice(0, 2));
        expect(editor.previewPanel).toBeUndefined();

        appended[1].onload();
        await flush();
        appended[2].onload();
        await editor.initPromise;
        expect(appended.map(urlOf)).toEqual(VEGA);
        expect(editor.previewPanel).toBeInstanceOf(HTMLElement);
    });

    test('a library that fails to load is reported and the editor still starts', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        interceptHead(el => (el.src === THREE ? 'error' : 'load'));
        await makeEditor({ preloadFences: ['stl', 'abc'] });

        expect(warnSpy).toHaveBeenCalledWith('QuikdownEditor: failed to preload stl:', expect.any(Error));
        await editor.setMarkdown('# works');
        expect(editor.previewPanel.querySelector('h1').textContent).toBe('works');
    });
});

// ───────────────────────── lazyLoadLibrary / loadScript / loadCSS ─────────────────────────

describe('lazyLoadLibrary', () => {
    test('returns true without loading when the library is present', async () => {
        await makeEditor();
        const appended = interceptHead();
        await expect(editor.lazyLoadLibrary('Lib', () => true, 'https://cdn.example/lib.js')).resolves.toBe(true);
        expect(appended).toHaveLength(0);
    });

    test('loads the script and stylesheet, then reports whether the library appeared', async () => {
        await makeEditor();
        let present = false;
        const appended = interceptHead(el => { if (el.tagName === 'SCRIPT') present = true; return 'load'; });
        const loaded = await editor.lazyLoadLibrary('Lib', () => present, 'https://cdn.example/lib.js', 'https://cdn.example/lib.css');

        expect(loaded).toBe(true);
        expect(appended.map(urlOf)).toEqual(['https://cdn.example/lib.js', 'https://cdn.example/lib.css']);
    });

    test('returns false when the script loads but the library is still missing', async () => {
        await makeEditor();
        interceptHead();
        await expect(editor.lazyLoadLibrary('Lib', () => false, 'https://cdn.example/lib.js')).resolves.toBe(false);
    });

    test('returns false and logs when the script fails', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        interceptHead(() => 'error');

        await expect(editor.lazyLoadLibrary('Lib', () => false, 'https://cdn.example/lib.js')).resolves.toBe(false);
        expect(errorSpy).toHaveBeenCalledWith('Failed to load Lib:', expect.objectContaining({ message: 'network down' }));
    });

    test('can load a stylesheet only', async () => {
        await makeEditor();
        const appended = interceptHead();
        const loaded = await editor.lazyLoadLibrary('Styles', () => false, null, 'https://cdn.example/only.css');

        expect(loaded).toBe(false);
        expect(appended.map(el => el.tagName)).toEqual(['LINK']);
    });
});

describe('loadScript and loadCSS', () => {
    test('loadScript resolves on load', async () => {
        await makeEditor();
        const appended = interceptHead(() => 'pending');
        const done = jest.fn();
        editor.loadScript('https://cdn.example/a.js').then(done);
        await flush();

        expect(appended[0].tagName).toBe('SCRIPT');
        expect(appended[0].src).toBe('https://cdn.example/a.js');
        expect(done).not.toHaveBeenCalled();
        appended[0].onload();
        await flush();
        expect(done).toHaveBeenCalledTimes(1);
    });

    test('loadScript rejects on error', async () => {
        await makeEditor();
        interceptHead(() => 'error');
        await expect(editor.loadScript('https://cdn.example/a.js')).rejects.toThrow('network down');
    });

    test('loadCSS resolves when the stylesheet loads', async () => {
        await makeEditor();
        const appended = interceptHead();
        await editor.loadCSS('https://cdn.example/a.css', 'my-styles');

        const [link] = appended;
        expect(link.tagName).toBe('LINK');
        expect(link.rel).toBe('stylesheet');
        expect(link.href).toBe('https://cdn.example/a.css');
        expect(link.id).toBe('my-styles');
    });

    test('loadCSS resolves after one second when no load event arrives', async () => {
        await makeEditor();
        const appended = interceptHead(() => 'pending');
        const done = jest.fn();
        editor.loadCSS('https://cdn.example/slow.css').then(done);

        jest.advanceTimersByTime(999);
        await flush();
        expect(done).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await flush();
        expect(done).toHaveBeenCalledTimes(1);
        expect(appended[0].id).toBe('');
    });
});

// ───────────────────────── statics ─────────────────────────

describe('QuikdownEditor.removeHRFromMarkdown', () => {
    const removeHR = QuikdownEditor.removeHRFromMarkdown;

    test('removes every HR style, including one on the first line', () => {
        expect(removeHR('---\na\n***\nb\n_ _ _\nc')).toBe('a\nb\nc');
    });

    test('returns an empty string for missing input', () => {
        expect(removeHR(null)).toBe('');
        expect(removeHR(undefined)).toBe('');
    });

    test('keeps lines that only resemble a rule', () => {
        expect(removeHR('- -\n--\n-- x')).toBe('- -\n--\n-- x');
    });

    test('keeps rules inside a fence until a real closing fence', () => {
        const fenced = '```\n---\nab\n``` not a close\n---\n```';
        expect(removeHR(fenced + '\n---')).toBe(fenced);
    });

    test('a shorter run of tildes does not close a longer fence', () => {
        const fenced = '~~~~\n---\n~~~\n---\n~~~~';
        expect(removeHR(fenced + '\n---\nend')).toBe(fenced + '\nend');
    });

    test('two backticks do not open a fence', () => {
        expect(removeHR('``x\n---\ny')).toBe('``x\ny');
    });

    test('keeps table separators, with or without outer pipes', () => {
        const piped = '| a | b |\n|---|---|\n| 1 | 2 |';
        const bare = 'a | b\n---\n1 | 2';
        expect(removeHR(piped)).toBe(piped);
        expect(removeHR(bare)).toBe(bare);
        expect(removeHR('--- | ---')).toBe('--- | ---');
    });
});

describe('QuikdownEditor.convertLazyLinefeeds', () => {
    const convert = QuikdownEditor.convertLazyLinefeeds;

    test('puts exactly one blank line between paragraphs', () => {
        expect(convert('one\ntwo\n\n\n\nthree')).toBe('one\n\ntwo\n\nthree');
        expect(convert('a\n   \nb')).toBe('a\n\nb');
    });

    test('returns an empty string for missing input', () => {
        expect(convert(null)).toBe('');
        expect(convert(undefined)).toBe('');
    });

    test('separates headings and rules from text', () => {
        expect(convert('# H\ntext\n---\nmore')).toBe('# H\n\ntext\n\n---\n\nmore');
    });

    test('keeps lists, their continuations, blockquotes and tables together', () => {
        expect(convert('- a\n- b\n  - c\n1. d\ntext')).toBe('- a\n- b\n  - c\n1. d\n\ntext');
        expect(convert('- a\n    continued\npara')).toBe('- a\n    continued\n\npara');
        expect(convert('> a\n> b\nc')).toBe('> a\n> b\n\nc');
        expect(convert('| a |\n| b |\nc')).toBe('| a |\n| b |\n\nc');
    });

    test('leaves fenced code untouched and isolates the fence', () => {
        expect(convert('text\n```\na\n\nb\n```\nafter')).toBe('text\n\n```\na\n\nb\n```\n\nafter');
        expect(convert('```\na\nb\n```')).toBe('```\na\nb\n```');
    });

    test('trims blank lines left at the end of an unclosed fence', () => {
        expect(convert('a\n```\ncode\n\n')).toBe('a\n\n```\ncode');
    });

    test('two backticks do not open a fence', () => {
        expect(convert('``x\ny')).toBe('``x\n\ny');
    });

    test('is idempotent', () => {
        const once = convert('# T\nintro\nmore\n- a\n- b\n> q\n```js\nx\n\ny\n```\n| a |\n| b |\nend');
        expect(convert(once)).toBe(once);
    });
});

describe('removeHR() and convertLazyLinefeeds() on an editor', () => {
    test('removeHR rewrites the document and flashes its button for 1.5 s', async () => {
        await makeEditor({ showRemoveHR: true });
        await editor.setMarkdown('above\n\n---\n\nbelow');
        expect(editor.previewPanel.querySelector('hr')).not.toBeNull();
        await editor.removeHR();

        expect(editor.getMarkdown()).toBe('above\n\n\nbelow');
        expect(editor.sourceTextarea.value).toBe('above\n\n\nbelow');
        expect(editor.previewPanel.querySelector('hr')).toBeNull();
        const button = editor.toolbar.querySelector('[data-action="remove-hr"]');
        expect(button.textContent).toBe('Removed!');
        jest.advanceTimersByTime(1499);
        expect(button.textContent).toBe('Removed!');
        jest.advanceTimersByTime(1);
        expect(button.textContent).toBe('Remove HR');
    });

    test('removeHR works without the toolbar button', async () => {
        await makeEditor();
        await editor.setMarkdown('a\n\n***\n\nb');
        await editor.removeHR();

        expect(editor.getMarkdown()).toBe('a\n\n\nb');
        expect(jest.getTimerCount()).toBe(0);
    });

    test('convertLazyLinefeeds rewrites the document and flashes its button for 1.5 s', async () => {
        await makeEditor({ showLazyLinefeeds: true });
        await editor.setMarkdown('one\ntwo');
        expect(editor.previewPanel.querySelectorAll('p')).toHaveLength(1);
        await editor.convertLazyLinefeeds();

        expect(editor.getMarkdown()).toBe('one\n\ntwo');
        expect(Array.from(editor.previewPanel.querySelectorAll('p')).map(p => p.textContent)).toEqual(['one', 'two']);
        const button = editor.toolbar.querySelector('[data-action="lazy-linefeeds"]');
        expect(button.textContent).toBe('Converted!');
        jest.advanceTimersByTime(1500);
        expect(button.textContent).toBe('Fix Linefeeds');
    });

    test('convertLazyLinefeeds works without the toolbar button', async () => {
        await makeEditor();
        await editor.setMarkdown('one\ntwo');
        await editor.convertLazyLinefeeds();

        expect(editor.getMarkdown()).toBe('one\n\ntwo');
        expect(jest.getTimerCount()).toBe(0);
    });
});

// ───────────────────────── parser paths through the editor ─────────────────────────

async function render(markdown, options) {
    await makeEditor(options);
    await editor.setMarkdown(markdown);
    return editor.previewPanel;
}

/** Put HTML in the preview and convert it back to markdown. */
async function toMarkdown(html) {
    await makeEditor();
    editor.previewPanel.innerHTML = html;
    editor.updateFromHTML();
    return editor.getMarkdown();
}

const texts = (root, selector) => Array.from(root.querySelectorAll(selector)).map(el => el.textContent);

describe('reference links', () => {
    const DOC = [
        'See [Text][ref], [Collapsed][], [short], [plain], [Missing][nope] and [undefined].',
        '',
        '[ref]: https://example.com "Title"',
        '[REF]: https://dup.example',
        "[collapsed]: /c 'single'",
        '[short]: <https://s.example> (paren)',
        '[plain]: /p',
    ].join('\n');

    test('resolve full, collapsed and shortcut references against their definitions', async () => {
        const panel = await render(DOC, { reference_links: true });
        const [full, collapsed, shortcut, plain] = panel.querySelectorAll('a');

        expect(panel.querySelectorAll('a')).toHaveLength(4);
        expect(full.textContent).toBe('Text');
        expect(full.getAttribute('href')).toBe('https://example.com'); // first definition wins
        expect(full.title).toBe('Title');
        expect(full.rel).toBe('noopener noreferrer');
        expect(collapsed.textContent).toBe('Collapsed');
        expect(collapsed.getAttribute('href')).toBe('/c');
        expect(collapsed.title).toBe('single');
        expect(collapsed.hasAttribute('rel')).toBe(false);
        expect(shortcut.getAttribute('href')).toBe('https://s.example');
        expect(shortcut.title).toBe('paren');
        expect(plain.getAttribute('href')).toBe('/p');
        expect(plain.hasAttribute('title')).toBe(false);

        expect(panel.textContent).toContain('[Missing][nope] and [undefined].');
        expect(panel.textContent).not.toContain('dup.example');
        expect(panel.textContent).not.toContain('[ref]:');
    });

    test('are written back as references when the preview is converted to markdown', async () => {
        await render(DOC, { reference_links: true });
        editor.updateFromHTML();

        expect(editor.getMarkdown()).toContain('See [Text][ref], [Collapsed][], [short], [plain], [Missing][nope] and [undefined].');
    });

    test('stay literal text when the option is off or nothing is defined', async () => {
        const off = await render(DOC);
        expect(texts(off, 'a')).not.toContain('Text');
        expect(off.textContent).toContain('[Text][ref]');

        const undefinedRefs = await render('Just [Text][ref] here.', { reference_links: true });
        expect(undefinedRefs.querySelector('a')).toBeNull();
        expect(undefinedRefs.textContent).toContain('[Text][ref]');
    });

    test('a definition inside a code fence is code, not a definition', async () => {
        const panel = await render('```text\n[ref]: https://example.com\n```\n\n[ref]', { reference_links: true });

        expect(panel.querySelector('pre code').textContent).toBe('[ref]: https://example.com');
        expect(panel.querySelector('a')).toBeNull();
    });
});

describe('footnotes', () => {
    const DOC = [
        'Water[^1] is wet[^note], really[^1]. Unknown[^zz].',
        '',
        '[^1]: First **bold** note',
        '    continued here',
        '[^1]: duplicate ignored',
        '[^note]: Second <b>note</b>',
        '[^unused]: never referenced',
    ].join('\n');

    test('number markers in order of first use and list the referenced notes', async () => {
        const panel = await render(DOC, { footnotes: true });

        expect(texts(panel, 'sup')).toEqual(['1', '2', '1']);
        expect(Array.from(panel.querySelectorAll('sup a')).map(a => a.getAttribute('href'))).toEqual(['#fn-1', '#fn-note', '#fn-1']);
        expect(panel.querySelector('p').textContent).toContain('Unknown[^zz].');

        const notes = panel.querySelectorAll('section.quikdown-footnotes ol li');
        expect(Array.from(notes).map(li => li.id)).toEqual(['fn-1', 'fn-note']);
        expect(notes[0].textContent).toBe('First bold note continued here ↩');
        expect(notes[0].querySelector('strong').textContent).toBe('bold');
        expect(notes[0].querySelector('a').getAttribute('href')).toBe('#fnref-1');
        expect(notes[1].textContent).toBe('Second <b>note</b> ↩');
        expect(notes[1].querySelector('b')).toBeNull();
        expect(panel.textContent).not.toContain('duplicate ignored');
        expect(panel.textContent).not.toContain('never referenced');
        expect(panel.querySelector('section hr')).not.toBeNull();
    });

    test('footnote text keeps raw HTML when unsafe HTML is allowed', async () => {
        const panel = await render(DOC, { footnotes: true, allowUnsafeHTML: true });
        expect(panel.querySelector('#fn-note b').textContent).toBe('note');
    });

    test('markers and definitions are written back when the preview is converted to markdown', async () => {
        await render(DOC, { footnotes: true });
        editor.updateFromHTML();
        const markdown = editor.getMarkdown();

        expect(markdown).toContain('Water[^1] is wet[^note], really[^1]. Unknown[^zz].');
        expect(markdown).toContain('[^1]: First bold note continued here\n');
        expect(markdown).toContain('[^note]: Second <b>note</b>');
        expect(markdown).not.toContain('↩');
    });

    test('no section is rendered when nothing is referenced or defined', async () => {
        const unreferenced = await render('Text only.\n\n[^a]: defined but unused', { footnotes: true });
        expect(unreferenced.querySelector('section')).toBeNull();
        expect(unreferenced.textContent.trim()).toBe('Text only.');

        const undefinedNote = await render('Text[^a] only.', { footnotes: true });
        expect(undefinedNote.querySelector('sup')).toBeNull();
        expect(undefinedNote.textContent).toContain('Text[^a] only.');
    });

    test('markers stay literal when the option is off', async () => {
        const panel = await render(DOC);
        expect(panel.querySelector('sup')).toBeNull();
        expect(panel.textContent).toContain('Water[^1]');
    });
});

describe('HTML to markdown through updateFromHTML', () => {
    test('a hand-built footnotes section yields one definition per identified item', async () => {
        const markdown = await toMarkdown(
            '<p>Body</p>' +
            '<section data-qd="[^section"><ol>' +
            '<div>stray</div>' +
            '<li>no id</li>' +
            '<li data-qd-fn-id="a">Alpha <em>em</em> <a href="#fnref-a">↩</a><a href="/other">link</a></li>' +
            '</ol></section>'
        );

        expect(markdown).toContain('Body');
        expect(markdown).toContain('[^a]: Alpha em link');
        expect(markdown).not.toContain('stray');
        expect(markdown).not.toContain('no id');
    });

    test('a footnotes section without usable items adds nothing', async () => {
        const markdown = await toMarkdown(
            '<p>Body</p><section data-qd="[^section"><ol><li>no id</li></ol></section><section data-qd="[^section"></section>'
        );
        expect(markdown.trim()).toBe('Body');
    });

    test('plain <sup> and <section> elements pass their text through', async () => {
        const markdown = await toMarkdown('<p>x<sup>2</sup></p><section><p>inside</p></section>');
        expect(markdown).toContain('x2');
        expect(markdown).toContain('inside');
    });

    test('footnote back-links are dropped and anchors without href become empty links', async () => {
        const markdown = await toMarkdown('<p>a<a href="#fnref-1">↩</a> <a>anchor</a></p>');
        expect(markdown.trim()).toBe('a [anchor]()');
    });

    test('an image without alt or src becomes an empty image', async () => {
        expect((await toMarkdown('<p>pic: <img></p>')).trim()).toBe('pic: ![]()');
    });

    test('whitespace-only paragraphs are dropped', async () => {
        expect((await toMarkdown('<p>one</p><p>   </p><p>two</p>')).trim()).toBe('one\n\ntwo');
    });

    test('a nested list emitted beside its parent item is indented one level', async () => {
        await render('- a\n  - b\n- c');
        editor.updateFromHTML();
        expect(editor.getMarkdown().trim()).toBe('- a\n  - b\n- c');

        const mixed = await toMarkdown('<ul><li>a</li><ol><li>one</li><li>two</li></ol></ul>');
        expect(mixed.trim()).toBe('- a\n  1. one\n  2. two');
    });

    test('tables tolerate an empty header and empty rows', async () => {
        const markdown = await toMarkdown('<table><thead></thead><tbody><tr></tr><tr><td>x</td><td>y</td></tr></tbody></table>');
        expect(markdown.trim()).toBe('| x | y |');
    });

    test('an empty code block with a language keeps its fence', async () => {
        const markdown = await toMarkdown('<pre data-qd-fence="```" data-qd-lang="js"><code></code></pre>');
        expect(markdown.trim()).toBe('```js\n\n```');
    });
});

describe('blockquotes', () => {
    test('unprefixed lines continue the quote', async () => {
        const panel = await render('> quote\nlazy line\nstill lazy');
        expect(panel.querySelector('blockquote').textContent).toBe('quote\nlazy line\nstill lazy');
    });

    test.each([
        ['a heading', '> q\n# Head', 'h1'],
        ['a rule', '> q\n---', 'hr'],
        ['a bullet', '> q\n- item', 'ul li'],
        ['a numbered item', '> q\n1. one', 'ol li'],
        ['a code fence', '> q\n```\ncode\n```', 'pre code'],
    ])('%s ends the quote', async (_name, markdown, selector) => {
        const panel = await render(markdown);
        expect(panel.querySelector('blockquote').textContent).toBe('q');
        expect(panel.querySelector(selector)).not.toBeNull();
        expect(panel.querySelector('blockquote ' + selector)).toBeNull();
    });

    test('a blank line or a table row ends the quote', async () => {
        const blank = await render('> q\n\nafter');
        expect(blank.querySelector('blockquote').textContent).toBe('q');
        expect(blank.querySelector('p').textContent).toBe('after');

        const row = await render('> q\n| a | b |');
        expect(row.querySelector('blockquote').textContent).toBe('q');
        expect(row.textContent).toContain('| a | b |');
        expect(row.querySelector('table')).toBeNull();
    });

    test('the marker needs no following space, and a shallower line closes the nested quote', async () => {
        const tight = await render('>tight');
        expect(tight.querySelector('blockquote').textContent).toBe('tight');

        const nested = await render('>> deep\n> shallow');
        const outer = nested.querySelector('blockquote');
        expect(outer.querySelector('blockquote').textContent.trim()).toBe('deep');
        expect(outer.lastChild.textContent.trim()).toBe('shallow');
    });

    test('GFM alerts render with inline styles when inline_styles is on', async () => {
        const panel = await render('> [!WARNING]\n> Hot surface', { inline_styles: true });
        const alert = panel.firstElementChild;

        expect(alert.tagName).toBe('DIV');
        expect(alert.hasAttribute('class')).toBe(false);
        expect(alert.getAttribute('style')).toBeTruthy();
        const title = alert.querySelector('p');
        expect(title.textContent).toBe('Warning');
        expect(title.getAttribute('style')).toBeTruthy();
        expect(alert.textContent).toContain('Hot surface');
        expect(panel.querySelector('blockquote')).toBeNull();
    });
});

describe('indented code and list continuation', () => {
    test('four-space blocks keep blank lines between indented lines', async () => {
        const panel = await render('intro\n\n    first\n\n    second\nafter');
        expect(panel.querySelector('pre code').textContent).toBe('first\n\nsecond');
        expect(panel.textContent).toContain('after');
        expect(panel.querySelector('pre').textContent).not.toContain('after');
    });

    test('tabs and mixed space/tab indents count as code', async () => {
        const panel = await render('intro\n\n\ttabbed\n\nmiddle\n\n \tmixed');
        expect(texts(panel, 'pre code')).toEqual(['tabbed', 'mixed']);
    });

    test('short indents and indented headings are not code', async () => {
        const shortIndent = await render('intro\n\n  two spaces');
        expect(shortIndent.querySelector('pre')).toBeNull();

        const heading = await render('intro\n\n    # not code');
        expect(heading.querySelector('pre')).toBeNull();
        expect(heading.textContent).toContain('# not code');
    });

    test('indented text under a list item is folded into the item', async () => {
        const panel = await render('- item one\n  wrapped text\n- two\nplain');
        expect(texts(panel, 'li')).toEqual(['item one wrapped text', 'two']);
        expect(panel.querySelector('pre')).toBeNull();
        expect(panel.textContent).toContain('plain');
    });

    test('a hard break before the wrapped text becomes <br>', async () => {
        const spaces = await render('- item  \n  next');
        expect(spaces.querySelector('li').innerHTML).toMatch(/^item<br[^>]*>next$/);

        const backslash = await render('- item\\\n  next');
        expect(backslash.querySelector('li').innerHTML).toMatch(/^item<br[^>]*>next$/);
    });

    test('an indented rule under a list item is not folded in', async () => {
        const panel = await render('- item\n  ---\nafter');
        expect(texts(panel, 'li')).toEqual(['item']);
        expect(panel.querySelector('hr')).not.toBeNull();
    });

    test('an indented heading marker under a list item is not folded in', async () => {
        const panel = await render('- item\n  # not folded');
        expect(texts(panel, 'li')).toEqual(['item']);
        expect(panel.textContent).toContain('# not folded');
    });
});

describe('tables, images, autolinks and limited HTML', () => {
    test('rows shorter than the separator are padded with empty cells', async () => {
        const panel = await render('| a | b |\n|---|---|---|\n| 1 |');
        expect(texts(panel, 'th')).toEqual(['a', 'b', '']);
        expect(texts(panel, 'td')).toEqual(['1', '', '']);
    });

    test('an image title is rendered as a title attribute', async () => {
        const panel = await render('![alt text](https://example.com/i.png "The title")');
        const img = panel.querySelector('img');
        expect(img.getAttribute('src')).toBe('https://example.com/i.png');
        expect(img.alt).toBe('alt text');
        expect(img.title).toBe('The title');
    });

    test('autolinks drop an unbalanced closing parenthesis but keep balanced ones', async () => {
        const panel = await render('Visit https://example.com/a) or https://en.wikipedia.org/wiki/Foo_(bar) today');
        const [first, second] = panel.querySelectorAll('a');

        expect(first.getAttribute('href')).toBe('https://example.com/a');
        expect(first.nextSibling.textContent.startsWith(')')).toBe(true);
        expect(second.getAttribute('href')).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    });

    test("limited HTML mode accepts single-quoted attributes and drops handlers", async () => {
        const panel = await render("<span title='hello there' onclick='x()'>tagged</span>", { allowUnsafeHTML: 'limited' });
        const span = panel.querySelector('span');

        expect(span.textContent).toBe('tagged');
        expect(span.title).toBe('hello there');
        expect(span.hasAttribute('onclick')).toBe(false);
    });
});

// ───────────────────── shared and failed script loads ─────────────────────

describe('script loads are shared and retried', () => {
    const ABCJS = 'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js';
    const MATHJAX = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
    const attach = el => { Node.prototype.appendChild.call(document.head, el); };

    test("preloadFences: 'all' requests abcjs once for the abc and music fences", async () => {
        const appended = interceptHead(el => {
            if (urlOf(el) !== ABCJS) return 'load';
            attach(el);
            return 'pending';
        });
        editor = construct({ preloadFences: 'all' });
        await flush();

        const abc = appended.filter(el => urlOf(el) === ABCJS);
        expect(abc).toHaveLength(1);
        expect(document.head.querySelectorAll(`script[src="${ABCJS}"]`)).toHaveLength(1);

        abc[0].onload();
        await editor.initPromise;
    });

    test('two editors asking for the same script at the same time share one element', async () => {
        const appended = interceptHead(el => { attach(el); return 'pending'; });
        const a = construct({ plugins: null });
        const b = construct({ plugins: null });
        const first = a.loadScript('https://cdn.example/lib.js');
        const second = b.loadScript('https://cdn.example/lib.js');

        expect(second).toBe(first);
        expect(appended).toHaveLength(1);

        appended[0].onload();
        await expect(first).resolves.toBeUndefined();

        // Once settled, a new request makes a new element
        a.loadScript('https://cdn.example/lib.js');
        expect(appended).toHaveLength(2);
    });

    test('a failed script is removed from the page and can be requested again', async () => {
        const appended = interceptHead(el => { attach(el); return 'pending'; });
        editor = construct({ plugins: null });
        const first = editor.loadScript('https://cdn.example/lib.js');
        appended[0].onerror(new Error('network down'));

        await expect(first).rejects.toThrow('network down');
        expect(appended[0].isConnected).toBe(false);

        const second = editor.loadScript('https://cdn.example/lib.js');
        expect(second).not.toBe(first);
        expect(appended).toHaveLength(2);
        appended[1].onload();
        await second;
    });

    test('a pending load whose element was removed from the page is not reused', () => {
        const appended = interceptHead(el => { attach(el); return 'pending'; });
        editor = construct({ plugins: null });
        editor.loadScript('https://cdn.example/gone.js');
        appended[0].remove();
        editor.loadScript('https://cdn.example/gone.js');

        expect(appended).toHaveLength(2);
    });

    test('a failed MathJax preload removes its config so a later render can retry', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        interceptHead(el => (urlOf(el) === MATHJAX ? 'error' : 'load'));
        await makeEditor({ plugins: null, preloadFences: ['math'] });

        expect(warnSpy).toHaveBeenCalledWith('QuikdownEditor: failed to preload math:', expect.any(Error));
        expect(window.MathJax).toBeUndefined();
    });

    test('a failed preload leaves a MathJax object it did not create', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        let hostMathJax;
        interceptHead(el => {
            // The host page installs its own MathJax while ours is loading
            hostMathJax = window.MathJax = { version: '3.2.2', typesetPromise: jest.fn() };
            return urlOf(el) === MATHJAX ? 'error' : 'load';
        });
        await makeEditor({ plugins: null, preloadFences: ['math'] });

        expect(window.MathJax).toBe(hostMathJax);
    });
});

