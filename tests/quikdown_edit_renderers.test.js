/**
 * @jest-environment jsdom
 */

/**
 * @file quikdown_edit_renderers.test.js
 *
 * Fence renderers of the editor, driven through setMarkdown() with the
 * browser libraries (Leaflet, Three.js, ABCJS, vega-embed, Mermaid, MathJax,
 * DOMPurify, highlight.js) replaced by mocks, plus createFencePlugin and
 * preprocessSpecialElements.
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

const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
};

/** Run the zero-delay render timers and let their promise chains settle. */
async function settle() {
    jest.runOnlyPendingTimers();
    await flush();
}

const fence = (lang, body) => '```' + lang + '\n' + body + '\n```';
const preview = (selector) => editor.previewPanel.querySelector(selector);

/**
 * Intercept <script>/<link> insertion into <head> so nothing is fetched.
 * decide(el) returns 'load', 'error' or 'pending' and may define the
 * library global before the load event fires.
 */
function interceptHead(decide = () => 'load') {
    const appended = [];
    const real = Node.prototype.appendChild;
    document.head.appendChild = function (el) {
        if (el.tagName !== 'SCRIPT' && el.tagName !== 'LINK') return real.call(this, el);
        appended.push(el);
        const outcome = decide(el);
        if (outcome === 'load' && el.onload) el.onload();
        if (outcome === 'error' && el.onerror) el.onerror(new Error('network down'));
        return el;
    };
    return appended;
}

beforeEach(() => {
    jest.useFakeTimers();
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

// ───────────────────────────── SVG ─────────────────────────────

describe('renderSVG', () => {
    test('keeps the drawing, strips scripts, event handlers and javascript: URLs', async () => {
        await makeEditor();
        const source = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
            '<script>evil()</script><a href="javascript:evil()"><circle r="4" onclick="evil()"/></a></svg>';
        await editor.setMarkdown(fence('svg', source));

        const container = preview('.qde-svg-container');
        expect(container.getAttribute('data-qd-lang')).toBe('svg');
        expect(container.getAttribute('data-qd-source')).toBe(source);
        expect(container.querySelector('circle').getAttribute('r')).toBe('4');
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('circle').hasAttribute('onclick')).toBe(false);
        expect(container.querySelector('a').hasAttribute('href')).toBe(false);
        expect(container.innerHTML).not.toContain('evil');
    });

    test('reports malformed SVG instead of rendering it', async () => {
        await makeEditor();
        const html = editor.renderSVG('<svg><unclosed></svg>');
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const error = wrapper.querySelector('pre.qde-error');
        expect(error.textContent).toBe('Invalid SVG: Invalid SVG');
        expect(error.getAttribute('data-qd-lang')).toBe('svg');
    });
});

// ───────────────────────────── HTML ─────────────────────────────

describe('renderHTML', () => {
    test('uses DOMPurify when it is present', async () => {
        window.DOMPurify = { sanitize: jest.fn(() => '<b>clean</b>') };
        await makeEditor();
        await editor.setMarkdown(fence('html', '<b onclick="x()">dirty</b>'));

        expect(window.DOMPurify.sanitize).toHaveBeenCalledWith('<b onclick="x()">dirty</b>');
        const container = preview('.qde-html-container');
        expect(container.innerHTML).toBe('<b>clean</b>');
        expect(container.getAttribute('data-qd-source')).toBe('<b onclick="x()">dirty</b>');
    });

    test('shows the source as text, then swaps in sanitized HTML once DOMPurify loads', async () => {
        await makeEditor();
        let release;
        const appended = interceptHead(el => { release = el; return 'pending'; });
        await editor.setMarkdown(fence('html', '<i>later</i>'));

        const container = preview('.qde-html-container');
        expect(appended.map(el => el.src)).toEqual(['https://unpkg.com/dompurify/dist/purify.min.js']);
        expect(container.querySelector('pre').textContent).toBe('<i>later</i>');
        expect(container.querySelector('i')).toBeNull();

        window.DOMPurify = { sanitize: jest.fn(code => code.toUpperCase()) };
        release.onload();
        await flush();

        expect(container.innerHTML).toBe('<i>LATER</i>');
        expect(container.getAttribute('data-qd-lang')).toBe('html');
        expect(container.getAttribute('data-qd-source')).toBe('<i>later</i>');
    });

    test('keeps the text placeholder when DOMPurify cannot be loaded', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        interceptHead(() => 'error');
        await editor.setMarkdown(fence('html', '<i>never</i>'));
        await flush();

        expect(preview('.qde-html-container pre').textContent).toBe('<i>never</i>');
        expect(preview('.qde-html-container i')).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith('Failed to load DOMPurify:', expect.any(Error));
    });

    test('does nothing when the placeholder was removed before DOMPurify loaded', async () => {
        await makeEditor();
        let release;
        interceptHead(el => { release = el; return 'pending'; });
        await editor.setMarkdown(fence('html', '<i>gone</i>'));
        editor.previewPanel.innerHTML = '<p>replaced</p>';

        window.DOMPurify = { sanitize: jest.fn(() => '<i>gone</i>') };
        release.onload();
        await flush();

        expect(window.DOMPurify.sanitize).not.toHaveBeenCalled();
        expect(editor.previewPanel.innerHTML).toBe('<p>replaced</p>');
    });
});

// ───────────────────────────── Math ─────────────────────────────

describe('renderMath and MathJax loading', () => {
    test('collapses the formula to one line inside a math-display block', async () => {
        window.MathJax = { typesetPromise: jest.fn(() => Promise.resolve()) };
        await makeEditor();
        const html = editor.renderMath('a = b\n  + c', 'math');
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const block = wrapper.querySelector('.math-display');

        expect(block.textContent).toBe('$$a = b + c$$');
        expect(block.getAttribute('data-source-type')).toBe('math');
        expect(block.style.textAlign).toBe('center');
        expect(block.id).toMatch(/^math-/);
    });

    test('typesets every math block in the preview when MathJax is ready', async () => {
        window.MathJax = { typesetPromise: jest.fn(() => Promise.resolve()) };
        await makeEditor();
        await editor.setMarkdown(fence('math', 'x^2') + '\n\n' + fence('katex', 'y^2'));

        const blocks = Array.from(editor.previewPanel.querySelectorAll('.math-display'));
        expect(blocks).toHaveLength(2);
        expect(window.MathJax.typesetPromise).toHaveBeenCalledTimes(1);
        expect(window.MathJax.typesetPromise).toHaveBeenCalledWith(blocks);
    });

    test('configures and loads MathJax once, then typesets after the script loads', async () => {
        await makeEditor();
        let script;
        const appended = interceptHead(el => { script = el; return 'pending'; });
        await editor.setMarkdown(fence('math', 'x^2') + '\n\n' + fence('tex', 'y^2'));

        expect(appended.map(el => el.src)).toEqual(['https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js']);
        expect(script.async).toBe(true);
        expect(window.mathJaxLoading).toBe(true);
        expect(window.MathJax.svg.fontCache).toBe('none');
        expect(window.MathJax.startup.typeset).toBe(false);
        expect(window.MathJax.tex.displayMath).toEqual([['$$', '$$'], ['\\[', '\\]']]);

        window.MathJax.typesetPromise = jest.fn(() => Promise.resolve());
        script.onload();

        expect(window.mathJaxLoading).toBe(false);
        expect(window.MathJax.typesetPromise).toHaveBeenCalledWith(
            Array.from(editor.previewPanel.querySelectorAll('.math-display'))
        );
    });

    test('logs and clears the loading flag when the MathJax script fails', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        interceptHead(() => 'error');
        await editor.setMarkdown(fence('latex', 'x'));

        expect(errorSpy).toHaveBeenCalledWith('Failed to load MathJax');
        expect(window.mathJaxLoading).toBe(false);
        expect(preview('.math-display').textContent).toContain('x');
    });
});

describe('_typesetMath', () => {
    async function editorWithMath() {
        window.MathJax = { typesetPromise: jest.fn(() => Promise.resolve()) };
        await makeEditor();
        await editor.setMarkdown(fence('math', 'x'));
        delete window.MathJax;
        return Array.from(editor.previewPanel.querySelectorAll('.math-display'));
    }

    test('does not touch MathJax when there is nothing to typeset', async () => {
        await makeEditor();
        await editor.setMarkdown('plain text');
        window.MathJax = { typesetPromise: jest.fn(() => Promise.resolve()) };
        editor._typesetMath(editor.previewPanel);
        expect(window.MathJax.typesetPromise).not.toHaveBeenCalled();
    });

    test('defaults to the preview panel and swallows typesetting failures', async () => {
        const blocks = await editorWithMath();
        window.MathJax = { typesetPromise: jest.fn(() => Promise.reject(new Error('bad tex'))) };

        expect(() => editor._typesetMath()).not.toThrow();
        await flush();
        expect(window.MathJax.typesetPromise).toHaveBeenCalledWith(blocks);
    });

    test('waits for MathJax startup before typesetting', async () => {
        const blocks = await editorWithMath();
        let finishStartup;
        window.MathJax = { startup: { promise: new Promise(resolve => { finishStartup = resolve; }) } };
        editor._typesetMath(editor.previewPanel);

        const typeset = jest.fn(() => Promise.resolve());
        window.MathJax.typesetPromise = typeset;
        expect(typeset).not.toHaveBeenCalled();
        finishStartup();
        await flush();
        expect(typeset).toHaveBeenCalledWith(blocks);
    });

    test('skips typesetting when startup finishes without a typesetPromise', async () => {
        await editorWithMath();
        window.MathJax = { startup: { promise: Promise.resolve() } };
        editor._typesetMath(editor.previewPanel);
        await flush();
        expect(window.MathJax.typesetPromise).toBeUndefined();
        expect(jest.getTimerCount()).toBe(0);
    });

    test('ignores a rejected startup promise', async () => {
        await editorWithMath();
        window.MathJax = { startup: { promise: Promise.reject(new Error('startup failed')) } };
        expect(() => editor._typesetMath(editor.previewPanel)).not.toThrow();
        await flush();
        expect(jest.getTimerCount()).toBe(0);
    });

    test('polls every 100 ms until typesetPromise appears', async () => {
        const blocks = await editorWithMath();
        window.MathJax = {};
        editor._typesetMath(editor.previewPanel);

        jest.advanceTimersByTime(250);
        const typeset = jest.fn(() => Promise.resolve());
        window.MathJax.typesetPromise = typeset;
        expect(typeset).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);
        expect(typeset).toHaveBeenCalledTimes(1);
        expect(typeset).toHaveBeenCalledWith(blocks);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('polling hands over to the startup promise when one appears', async () => {
        const blocks = await editorWithMath();
        window.MathJax = {};
        editor._typesetMath(editor.previewPanel);

        let finishStartup;
        window.MathJax.startup = { promise: new Promise(resolve => { finishStartup = resolve; }) };
        jest.advanceTimersByTime(100);
        expect(jest.getTimerCount()).toBe(0);

        const typeset = jest.fn(() => Promise.resolve());
        window.MathJax.typesetPromise = typeset;
        finishStartup();
        await flush();
        expect(typeset).toHaveBeenCalledWith(blocks);
    });

    test('polling stops when MathJax is removed', async () => {
        await editorWithMath();
        window.MathJax = {};
        editor._typesetMath(editor.previewPanel);
        delete window.MathJax;

        jest.advanceTimersByTime(100);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('polling gives up after 50 attempts', async () => {
        await editorWithMath();
        window.MathJax = {};
        editor._typesetMath(editor.previewPanel);

        jest.advanceTimersByTime(4900);
        expect(jest.getTimerCount()).toBe(1);
        jest.advanceTimersByTime(100);
        expect(jest.getTimerCount()).toBe(0);

        const typeset = jest.fn(() => Promise.resolve());
        window.MathJax.typesetPromise = typeset;
        jest.advanceTimersByTime(1000);
        expect(typeset).not.toHaveBeenCalled();
    });
});

// ───────────────────────────── Tables ─────────────────────────────

describe('renderTable and parseCSVLine', () => {
    const cells = (selector) => Array.from(editor.previewPanel.querySelectorAll(selector)).map(el => el.textContent);

    test('parseCSVLine honours quotes, escaped quotes and the delimiter', async () => {
        await makeEditor();
        expect(editor.parseCSVLine('a,"b,c","say ""hi""",', ',')).toEqual(['a', 'b,c', 'say "hi"', '']);
        expect(editor.parseCSVLine('a|b,c|"d|e"', '|')).toEqual(['a', 'b,c', 'd|e']);
        expect(editor.parseCSVLine('', ',')).toEqual(['']);
    });

    test('renders csv with a header and escaped body cells', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('csv', 'name, note\n"Smith, J","<b>x</b>"\nDoe,plain'));

        const table = preview('table.qde-csv-table');
        expect(table.getAttribute('data-qd-lang')).toBe('csv');
        expect(cells('thead th')).toEqual(['name', 'note']);
        expect(cells('tbody tr:nth-child(1) td')).toEqual(['Smith, J', '<b>x</b>']);
        expect(cells('tbody tr:nth-child(2) td')).toEqual(['Doe', 'plain']);
        expect(table.querySelector('b')).toBeNull();
    });

    test('renders psv and tsv with their own delimiters', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('psv', 'a|b\n1,5|2') + '\n\n' + fence('tsv', 'c\td\n3\t4'));

        const tables = editor.previewPanel.querySelectorAll('table.qde-csv-table');
        expect(tables[0].getAttribute('data-qd-lang')).toBe('psv');
        expect(Array.from(tables[0].querySelectorAll('td')).map(td => td.textContent)).toEqual(['1,5', '2']);
        expect(tables[1].getAttribute('data-qd-lang')).toBe('tsv');
        expect(Array.from(tables[1].querySelectorAll('th')).map(th => th.textContent)).toEqual(['c', 'd']);
        expect(Array.from(tables[1].querySelectorAll('td')).map(td => td.textContent)).toEqual(['3', '4']);
    });

    test('a header-only table has no tbody', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('csv', 'only,header'));
        expect(cells('thead th')).toEqual(['only', 'header']);
        expect(preview('table.qde-csv-table tbody')).toBeNull();
    });

    test('falls back to an escaped <pre> when parsing throws', async () => {
        await makeEditor();
        editor.parseCSVLine = () => { throw new Error('parser broke'); };
        const html = editor.renderTable('a,"b"', 'csv');
        expect(html).toBe('<pre data-qd-fence="```" data-qd-lang="csv" data-qd-source="a,&quot;b&quot;">a,&quot;b&quot;</pre>');
    });
});

// ───────────────────────────── JSON ─────────────────────────────

describe('renderJSON', () => {
    function mockHljs(highlight) {
        window.hljs = {
            getLanguage: jest.fn(lang => lang === 'json'),
            highlight: jest.fn(highlight || ((code) => ({ value: `<span class="hljs-attr">${code.length}</span>` }))),
        };
    }

    test('pretty-prints valid JSON before highlighting', async () => {
        mockHljs();
        await makeEditor();
        await editor.setMarkdown(fence('json', '{"a":1}'));

        const pretty = '{\n  "a": 1\n}';
        expect(window.hljs.highlight).toHaveBeenCalledWith(pretty, { language: 'json' });
        const pre = preview('pre.qde-json');
        expect(pre.getAttribute('data-qd-lang')).toBe('json');
        expect(pre.querySelector('code.hljs.language-json .hljs-attr').textContent).toBe(String(pretty.length));
    });

    test('highlights invalid JSON as written and keeps the json5 language tag', async () => {
        mockHljs();
        await makeEditor();
        await editor.setMarkdown(fence('json5', '{a: 1,}'));

        expect(window.hljs.highlight).toHaveBeenCalledWith('{a: 1,}', { language: 'json' });
        expect(preview('pre.qde-json').getAttribute('data-qd-lang')).toBe('json5');
    });

    test('falls back to escaped text when highlighting throws', async () => {
        mockHljs(() => { throw new Error('hljs broke'); });
        await makeEditor();
        const html = editor.renderJSON('{"a":"<b>"}', 'json');
        expect(html).toBe('<pre class="qde-json" data-qd-fence="```" data-qd-lang="json">{&quot;a&quot;:&quot;&lt;b&gt;&quot;}</pre>');
    });

    test('renders escaped text when highlight.js is not available', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('json', '{"a":"<b>"}'));
        const pre = preview('pre.qde-json');
        expect(pre.textContent).toBe('{"a":"<b>"}');
        expect(pre.querySelector('code')).toBeNull();
        expect(pre.querySelector('b')).toBeNull();
    });
});

// ───────────────────────────── GeoJSON ─────────────────────────────

const boundsOf = (south, west, north, east, valid = true) => ({
    isValid: () => valid,
    getSouthWest: () => ({ lat: south, lng: west }),
    getNorthEast: () => ({ lat: north, lng: east }),
});

function makeLeaflet({ zoom = 3, bounds = boundsOf(10, 20, 30, 40), tilePane = document.createElement('div') } = {}) {
    const handlers = {};
    const onMap = new Set();
    const made = { tile: [], geo: [] };
    const map = {
        zoom,
        getContainer: jest.fn(() => document.getElementById(map.id)),
        getPane: jest.fn(() => tilePane),
        getZoom: jest.fn(() => map.zoom),
        on: jest.fn((event, fn) => { handlers[event] = fn; }),
        hasLayer: jest.fn(layer => onMap.has(layer)),
        removeLayer: jest.fn(layer => { onMap.delete(layer); }),
        setView: jest.fn(),
        fitBounds: jest.fn(),
    };
    const layer = (data, options) => {
        const self = {
            data,
            options,
            handlers: {},
            setStyle: jest.fn(),
            addTo: jest.fn(() => { onMap.add(self); return self; }),
            getBounds: jest.fn(() => bounds),
            on: jest.fn((event, fn) => { self.handlers[event] = fn; }),
        };
        return self;
    };
    const L = {
        map: jest.fn((id, options) => { map.id = id; map.options = options; return map; }),
        tileLayer: jest.fn((url, options) => { const l = layer(url, options); made.tile.push(l); return l; }),
        geoJSON: jest.fn((data, options) => { const l = layer(data, options); made.geo.push(l); return l; }),
    };
    return { L, map, handlers, onMap, made, tilePane };
}

const POINTS = '{"type":"FeatureCollection","features":[]}';

describe('renderGeoJSON', () => {
    test('online: OSM tiles, animated map, bounds fitted, references stored for copy', async () => {
        const leaflet = makeLeaflet();
        window.L = leaflet.L;
        await makeEditor();
        await editor.setMarkdown(fence('geojson', POINTS));

        const container = preview('.geojson-container');
        expect(container.textContent).toBe('Loading map...');
        expect(container.getAttribute('data-qd-source')).toBe(POINTS);
        expect(container.getAttribute('data-original-source')).toBe(editor.escapeHtml(POINTS));
        await settle();

        const mapDiv = container.firstElementChild;
        expect(container.id).toBe(mapDiv.id + '-container');
        expect(leaflet.L.map).toHaveBeenCalledWith(mapDiv.id, { zoomAnimation: true, fadeAnimation: true });
        expect(mapDiv.classList.contains('qde-offline-map')).toBe(false);
        expect(leaflet.L.tileLayer).toHaveBeenCalledWith(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { attribution: '', crossOrigin: 'anonymous' }
        );
        const [tiles] = leaflet.made.tile;
        const [features] = leaflet.made.geo;
        expect(features.data).toEqual({ type: 'FeatureCollection', features: [] });
        expect(leaflet.onMap.has(tiles)).toBe(true);
        expect(leaflet.onMap.has(features)).toBe(true);
        expect(leaflet.map.fitBounds).toHaveBeenCalledWith(features.getBounds(), { padding: [28, 28], maxZoom: 6 });
        expect(container._map).toBe(leaflet.map);
        expect(container._tileLayer).toBe(tiles);
        expect(container._geoJsonLayer).toBe(features);

        expect(container.hasAttribute('data-tiles-loaded')).toBe(false);
        tiles.handlers.load();
        expect(container.getAttribute('data-tiles-loaded')).toBe('true');
    });

    test('a single point is centred with setView instead of fitBounds', async () => {
        const leaflet = makeLeaflet({ bounds: boundsOf(48.85, 2.35, 48.85, 2.35) });
        window.L = leaflet.L;
        await makeEditor();
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        expect(leaflet.map.setView).toHaveBeenCalledWith([48.85, 2.35], 8);
        expect(leaflet.map.fitBounds).not.toHaveBeenCalled();
    });

    test('points sharing only a latitude are still fitted', async () => {
        const leaflet = makeLeaflet({ bounds: boundsOf(10, 20, 10, 40) });
        window.L = leaflet.L;
        await makeEditor();
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        expect(leaflet.map.fitBounds).toHaveBeenCalledTimes(1);
        expect(leaflet.map.setView).not.toHaveBeenCalled();
    });

    test('invalid bounds fall back to a world view', async () => {
        const leaflet = makeLeaflet({ bounds: boundsOf(0, 0, 0, 0, false) });
        window.L = leaflet.L;
        await makeEditor();
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        expect(leaflet.map.setView).toHaveBeenCalledWith([0, 0], 2);
    });

    test('invalid GeoJSON shows the parse error', async () => {
        const leaflet = makeLeaflet();
        window.L = leaflet.L;
        await makeEditor();
        await editor.setMarkdown(fence('geojson', '{not json'));
        await settle();

        expect(preview('.geojson-container pre.qde-error').textContent).toMatch(/^GeoJSON error: /);
        expect(leaflet.L.map).not.toHaveBeenCalled();
    });

    test('does nothing when the container left the document before rendering', async () => {
        const leaflet = makeLeaflet();
        window.L = leaflet.L;
        await makeEditor();
        await editor.setMarkdown(fence('geojson', POINTS));
        editor.previewPanel.innerHTML = '';
        await settle();

        expect(leaflet.L.map).not.toHaveBeenCalled();
    });

    test('offline with a world basemap: vector layers, no tiles, zoom-dependent styling (light)', async () => {
        const leaflet = makeLeaflet({ zoom: 3 });
        window.L = leaflet.L;
        window._qde_worldGeoJSON = { type: 'FeatureCollection', features: ['world'] };
        window._qde_admin1GeoJSON = { type: 'FeatureCollection', features: ['admin1'] };
        await makeEditor({ allowExternalFetch: false, theme: 'light' });
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        const container = preview('.geojson-container');
        expect(leaflet.L.map).toHaveBeenCalledWith(expect.any(String), {
            zoomAnimation: false,
            fadeAnimation: false,
            minZoom: 2,
            maxBounds: [[-84, -180], [84, 180]],
            maxBoundsViscosity: 0.85,
        });
        expect(container.firstElementChild.classList.contains('qde-offline-map')).toBe(true);
        expect(leaflet.tilePane.style.display).toBe('none');
        expect(leaflet.L.tileLayer).not.toHaveBeenCalled();
        expect(container._tileLayer).toBeNull();
        expect(container.getAttribute('data-tiles-loaded')).toBe('true');

        const [countries, admin1, features] = leaflet.made.geo;
        expect(countries.data).toBe(window._qde_worldGeoJSON);
        expect(countries.options).toMatchObject({ smoothFactor: 1.5, interactive: false });
        expect(admin1.data).toBe(window._qde_admin1GeoJSON);
        expect(admin1.options).toMatchObject({ smoothFactor: 1, interactive: false });
        expect(features.data).toEqual({ type: 'FeatureCollection', features: [] });

        const lowZoom = { weight: 0.45, color: '#1a1a1a', fillColor: '#ebe6d9', fillOpacity: 1 };
        expect(countries.options.style()).toEqual(lowZoom);
        expect(countries.setStyle).toHaveBeenLastCalledWith(lowZoom);
        expect(leaflet.onMap.has(countries)).toBe(true);
        expect(leaflet.onMap.has(admin1)).toBe(false);

        // Zoom 5: admin-1 boundaries appear
        leaflet.map.zoom = 5;
        leaflet.handlers.zoomend();
        expect(countries.setStyle).toHaveBeenLastCalledWith({ ...lowZoom, weight: 0.75 });
        expect(admin1.setStyle).toHaveBeenLastCalledWith({ weight: 0.45, color: '#555', fillOpacity: 0, fill: false });
        expect(leaflet.onMap.has(admin1)).toBe(true);
        expect(admin1.addTo).toHaveBeenCalledTimes(1);

        // Zoom 7: heavier lines, layer not added twice
        leaflet.map.zoom = 7;
        leaflet.handlers.zoomend();
        expect(countries.setStyle).toHaveBeenLastCalledWith({ ...lowZoom, weight: 1.1 });
        expect(admin1.options.style()).toEqual({ weight: 0.6, color: '#555', fillOpacity: 0, fill: false });
        expect(admin1.addTo).toHaveBeenCalledTimes(1);

        // Back out: admin-1 removed
        leaflet.map.zoom = 3;
        leaflet.handlers.zoomend();
        expect(leaflet.map.removeLayer).toHaveBeenCalledWith(admin1);
        expect(leaflet.onMap.has(admin1)).toBe(false);
    });

    test('offline basemap uses the dark palette in the dark theme', async () => {
        const leaflet = makeLeaflet({ zoom: 7 });
        window.L = leaflet.L;
        window._qde_worldGeoJSON = { type: 'FeatureCollection', features: [] };
        window._qde_admin1GeoJSON = { type: 'FeatureCollection', features: [] };
        await makeEditor({ allowExternalFetch: false, theme: 'dark' });
        expect(host.classList.contains('qde-dark')).toBe(true);
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        const [countries, admin1] = leaflet.made.geo;
        expect(countries.options.style()).toEqual({ weight: 1, color: '#b8b8b8', fillColor: '#3a3a3e', fillOpacity: 1 });
        expect(admin1.options.style()).toEqual({ weight: 0.5, color: '#666', fillOpacity: 0, fill: false });
        expect(leaflet.onMap.has(admin1)).toBe(true);
    });

    test('offline basemap works without admin-1 data', async () => {
        const leaflet = makeLeaflet({ zoom: 6, tilePane: null });
        window.L = leaflet.L;
        window._qde_worldGeoJSON = { type: 'FeatureCollection', features: [] };
        await makeEditor({ allowExternalFetch: false });
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        expect(leaflet.made.geo).toHaveLength(2);
        expect(leaflet.map.on).toHaveBeenCalledWith('zoomend', expect.any(Function));
        expect(() => leaflet.handlers.zoomend()).not.toThrow();
        expect(leaflet.map.removeLayer).not.toHaveBeenCalled();
    });

    test('offline: waits for _qde_ensureBasemap before drawing', async () => {
        const leaflet = makeLeaflet();
        window.L = leaflet.L;
        let finish;
        window._qde_ensureBasemap = jest.fn(() => new Promise(resolve => { finish = resolve; }));
        await makeEditor({ allowExternalFetch: false });
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        expect(window._qde_ensureBasemap).toHaveBeenCalledTimes(1);
        expect(leaflet.L.map).not.toHaveBeenCalled();

        window._qde_worldGeoJSON = { type: 'FeatureCollection', features: [] };
        finish();
        await flush();
        expect(leaflet.L.map).toHaveBeenCalledTimes(1);
        expect(leaflet.made.geo[0].data).toBe(window._qde_worldGeoJSON);
        expect(leaflet.L.tileLayer).not.toHaveBeenCalled();
    });

    test('offline: reports a basemap that fails to load', async () => {
        const leaflet = makeLeaflet();
        window.L = leaflet.L;
        window._qde_ensureBasemap = jest.fn(() => Promise.reject(new Error('no <basemap>')));
        await makeEditor({ allowExternalFetch: false });
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();

        expect(preview('.geojson-container pre.qde-error').textContent).toBe('Basemap load failed: no <basemap>');
        expect(leaflet.L.map).not.toHaveBeenCalled();
    });

    test('offline: a basemap failure after the container is gone is ignored', async () => {
        const leaflet = makeLeaflet();
        window.L = leaflet.L;
        let fail;
        window._qde_ensureBasemap = jest.fn(() => new Promise((resolve, reject) => { fail = reject; }));
        await makeEditor({ allowExternalFetch: false });
        await editor.setMarkdown(fence('geojson', POINTS));
        await settle();
        editor.previewPanel.innerHTML = '<p>other</p>';
        fail(new Error('late'));
        await flush();

        expect(editor.previewPanel.innerHTML).toBe('<p>other</p>');
    });

    test('lazy-loads Leaflet (script and stylesheet) and then renders', async () => {
        const leaflet = makeLeaflet();
        await makeEditor();
        const appended = interceptHead(el => {
            if (el.tagName === 'SCRIPT') window.L = leaflet.L;
            return 'load';
        });
        await editor.setMarkdown(fence('geojson', POINTS));
        await flush();

        expect(appended.map(el => el.src || el.href)).toEqual([
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        ]);
        expect(leaflet.L.map).toHaveBeenCalledTimes(1);
        expect(preview('.geojson-container')._map).toBe(leaflet.map);
    });

    test('shows a failure message when Leaflet cannot be loaded', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        interceptHead(el => (el.tagName === 'SCRIPT' ? 'error' : 'load'));
        await editor.setMarkdown(fence('geojson', POINTS));
        await flush();

        expect(preview('.geojson-container').textContent).toBe('Failed to load map library');
    });

    test('a Leaflet load failure after the container is gone is ignored', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        let script;
        interceptHead(el => { if (el.tagName === 'SCRIPT') script = el; return 'pending'; });
        await editor.setMarkdown(fence('geojson', POINTS));
        editor.previewPanel.innerHTML = '<p>other</p>';
        script.onerror(new Error('network down'));
        await flush();

        expect(editor.previewPanel.innerHTML).toBe('<p>other</p>');
    });
});

// ───────────────────────────── STL ─────────────────────────────

function makeThree() {
    const made = { renderers: [], cameras: [], meshes: [], scenes: [] };
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
        normalize() { return this; }
    }
    const THREE = {
        Vector3,
        Color: class { constructor(hex) { this.hex = hex; } },
        Scene: class {
            constructor() { this.children = []; made.scenes.push(this); }
            add(obj) { this.children.push(obj); }
        },
        PerspectiveCamera: class {
            constructor(fov, aspect, near, far) {
                Object.assign(this, { fov, aspect, near, far });
                this.position = new Vector3();
                this.lookAt = jest.fn();
                made.cameras.push(this);
            }
        },
        WebGLRenderer: class {
            constructor(options) {
                this.options = options;
                this.domElement = document.createElement('canvas');
                this.setSize = jest.fn();
                this.render = jest.fn();
                made.renderers.push(this);
            }
        },
        BufferGeometry: class {
            constructor() { this.attributes = {}; }
            setAttribute(name, attribute) { this.attributes[name] = attribute; }
        },
        Float32BufferAttribute: class {
            constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
        },
        MeshLambertMaterial: class { constructor(options) { this.options = options; } },
        Mesh: class {
            constructor(geometry, material) {
                this.geometry = geometry;
                this.material = material;
                this.rotation = { y: 0 };
                made.meshes.push(this);
            }
        },
        AmbientLight: class { constructor(color, intensity) { this.color = color; this.intensity = intensity; } },
        DirectionalLight: class {
            constructor(color, intensity) { this.color = color; this.intensity = intensity; this.position = new Vector3(); }
        },
        Box3: class {
            setFromObject() { return this; }
            getCenter(target) { return target.set(1, 2, 3); }
            getSize(target) { return target.set(4, 10, 6); }
        },
    };
    return { THREE, made };
}

const STL = [
    'solid tri',
    '  facet normal 0 0 1',
    '    outer loop',
    '      vertex 0 0 0',
    '      vertex 1 0 0',
    '      vertex 0 1 0',
    '    endloop',
    '  endfacet',
    'endsolid tri',
].join('\n');

describe('renderSTL and parseSTL', () => {
    test('parseSTL collects vertices and repeats the facet normal per vertex', async () => {
        window.THREE = makeThree().THREE;
        await makeEditor();
        const geometry = editor.parseSTL(STL);

        expect(geometry.attributes.position.array).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        expect(geometry.attributes.position.itemSize).toBe(3);
        expect(geometry.attributes.normal.array).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    });

    test('parseSTL emits no normal for a vertex that precedes any facet', async () => {
        window.THREE = makeThree().THREE;
        await makeEditor();
        const geometry = editor.parseSTL('vertex 1 2 3\nfacet normal 1 0 0\nvertex 4 5 6');

        expect(geometry.attributes.position.array).toEqual([1, 2, 3, 4, 5, 6]);
        expect(geometry.attributes.normal.array).toEqual([1, 0, 0]);
    });

    test('builds the scene, frames the camera on the model and starts animating', async () => {
        const { THREE, made } = makeThree();
        window.THREE = THREE;
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        await makeEditor();
        await editor.setMarkdown(fence('stl', STL));

        const container = preview('.qde-stl-container');
        expect(container.textContent).toBe('Loading 3D model...');
        expect(container.getAttribute('data-stl-id')).toBe(container.id);
        expect(container.getAttribute('data-qd-source')).toBe(STL);
        await settle();

        const [renderer] = made.renderers;
        const [camera] = made.cameras;
        const [mesh] = made.meshes;
        const [scene] = made.scenes;
        expect(renderer.options).toEqual({ antialias: true });
        expect(renderer.setSize).toHaveBeenCalledWith(container.clientWidth, 400);
        expect(container.firstElementChild).toBe(renderer.domElement);
        expect(container.textContent).toBe('');
        expect(container._threeRenderer).toBe(renderer);
        expect(container._threeScene).toBe(scene);
        expect(container._threeCamera).toBe(camera);

        expect(mesh.geometry.attributes.position.array).toHaveLength(9);
        expect(mesh.material.options).toEqual({ color: 0x0066ff });
        expect(scene.children[0]).toBe(mesh);
        expect(scene.children).toHaveLength(3);
        // centre (1,2,3) offset by the largest dimension (10)
        expect(camera.position).toMatchObject({ x: 11, y: 12, z: 13 });
        expect(camera.lookAt).toHaveBeenCalledWith(expect.objectContaining({ x: 1, y: 2, z: 3 }));

        expect(raf).toHaveBeenCalledTimes(1);
        expect(mesh.rotation.y).toBeCloseTo(0.01);
        expect(renderer.render).toHaveBeenCalledWith(scene, camera);

        raf.mock.calls[0][0]();
        expect(mesh.rotation.y).toBeCloseTo(0.02);
        expect(renderer.render).toHaveBeenCalledTimes(2);
    });

    test('shows the error when Three.js throws', async () => {
        const { THREE } = makeThree();
        THREE.WebGLRenderer = class { constructor() { throw new Error('no <WebGL>'); } };
        window.THREE = THREE;
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        await editor.setMarkdown(fence('stl', STL));
        await settle();

        expect(preview('.qde-stl-container pre.qde-error').textContent).toBe('STL error: no <WebGL>');
        expect(errorSpy).toHaveBeenCalledWith('STL rendering error:', expect.any(Error));
    });

    test('does nothing when the container left the document before rendering', async () => {
        const { THREE, made } = makeThree();
        window.THREE = THREE;
        await makeEditor();
        await editor.setMarkdown(fence('stl', STL));
        editor.previewPanel.innerHTML = '';
        await settle();

        expect(made.scenes).toHaveLength(0);
    });

    test('lazy-loads Three.js and then renders', async () => {
        const { THREE, made } = makeThree();
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        await makeEditor();
        const appended = interceptHead(() => { window.THREE = THREE; return 'load'; });
        await editor.setMarkdown(fence('stl', STL));
        await flush();

        expect(appended.map(el => el.src)).toEqual(['https://unpkg.com/three@0.147.0/build/three.min.js']);
        expect(made.renderers).toHaveLength(1);
        expect(preview('.qde-stl-container canvas')).toBe(made.renderers[0].domElement);
    });

    test('shows a failure message when Three.js cannot be loaded', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        interceptHead(() => 'error');
        await editor.setMarkdown(fence('stl', STL));
        await flush();

        expect(preview('.qde-stl-container').textContent).toBe('Failed to load Three.js for STL rendering');
    });

    test('a Three.js load failure after the container is gone is ignored', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        let script;
        interceptHead(el => { script = el; return 'pending'; });
        await editor.setMarkdown(fence('stl', STL));
        editor.previewPanel.innerHTML = '<p>other</p>';
        script.onerror(new Error('network down'));
        await flush();

        expect(editor.previewPanel.innerHTML).toBe('<p>other</p>');
    });
});

// ───────────────────────────── ABC ─────────────────────────────

const TUNE = 'X:1\nK:C\nCDEF';

describe('renderABC', () => {
    test('hands the tune to ABCJS', async () => {
        window.ABCJS = { renderAbc: jest.fn() };
        await makeEditor();
        await editor.setMarkdown(fence('abc', TUNE));

        const container = preview('.qde-abc-container');
        expect(container.textContent).toBe('Loading music notation...');
        expect(container.getAttribute('data-qd-source')).toBe(TUNE);
        await settle();

        expect(window.ABCJS.renderAbc).toHaveBeenCalledWith(container, TUNE, { responsive: 'resize' });
        expect(container.textContent).toBe('');
    });

    test('the music alias renders through ABCJS too', async () => {
        window.ABCJS = { renderAbc: jest.fn() };
        await makeEditor();
        await editor.setMarkdown(fence('music', TUNE));
        await settle();

        expect(window.ABCJS.renderAbc).toHaveBeenCalledWith(preview('.qde-abc-container'), TUNE, { responsive: 'resize' });
    });

    test('shows the error when ABCJS throws', async () => {
        window.ABCJS = { renderAbc: jest.fn(() => { throw new Error('bad <tune>'); }) };
        await makeEditor();
        await editor.setMarkdown(fence('abc', TUNE));
        await settle();

        expect(preview('.qde-abc-container pre.qde-error').textContent).toBe('ABC notation error: bad <tune>');
    });

    test('does nothing when the container left the document before rendering', async () => {
        window.ABCJS = { renderAbc: jest.fn() };
        await makeEditor();
        await editor.setMarkdown(fence('abc', TUNE));
        editor.previewPanel.innerHTML = '';
        await settle();

        expect(window.ABCJS.renderAbc).not.toHaveBeenCalled();
    });

    test('lazy-loads ABCJS and then renders', async () => {
        const renderAbc = jest.fn();
        await makeEditor();
        const appended = interceptHead(() => { window.ABCJS = { renderAbc }; return 'load'; });
        await editor.setMarkdown(fence('abc', TUNE));
        await flush();

        expect(appended.map(el => el.src)).toEqual(['https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js']);
        expect(renderAbc).toHaveBeenCalledWith(preview('.qde-abc-container'), TUNE, { responsive: 'resize' });
    });

    test('shows a failure message when ABCJS cannot be loaded', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        interceptHead(() => 'error');
        await editor.setMarkdown(fence('abc', TUNE));
        await flush();

        expect(preview('.qde-abc-container').textContent).toBe('Failed to load ABC notation library');
    });

    test('an ABCJS load failure after the container is gone is ignored', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        let script;
        interceptHead(el => { script = el; return 'pending'; });
        await editor.setMarkdown(fence('abc', TUNE));
        editor.previewPanel.innerHTML = '<p>other</p>';
        script.onerror(new Error('network down'));
        await flush();

        expect(editor.previewPanel.innerHTML).toBe('<p>other</p>');
    });
});

// ───────────────────────────── Vega ─────────────────────────────

const INLINE_SPEC = '{"mark":"bar","data":{"values":[{"a":1}]}}';
const URL_SPEC = '{"mark":"bar","data":{"url":"https://example.com/data.json"}}';

describe('renderVega', () => {
    test('vega-lite specs get a $schema and are embedded as SVG without actions', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor();
        await editor.setMarkdown(fence('vega-lite', INLINE_SPEC));

        const container = preview('.qde-vega-container');
        expect(container.textContent).toBe('Loading visualization...');
        expect(container.getAttribute('data-qd-lang')).toBe('vega-lite');
        await settle();

        expect(window.vegaEmbed).toHaveBeenCalledWith(
            container,
            { mark: 'bar', data: { values: [{ a: 1 }] }, $schema: 'https://vega.github.io/schema/vega-lite/v5.json' },
            { renderer: 'svg', actions: false }
        );
    });

    test('an explicit $schema is kept, and plain vega specs get none', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor();
        await editor.setMarkdown(
            fence('vegalite', '{"$schema":"https://example.com/own.json","mark":"point"}') + '\n\n' +
            fence('vega', '{"marks":[]}')
        );
        await settle();

        expect(window.vegaEmbed.mock.calls.map(call => call[1])).toEqual([
            { $schema: 'https://example.com/own.json', mark: 'point' },
            { marks: [] },
        ]);
    });

    test('offline mode refuses specs that reference external data URLs', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor({ allowExternalFetch: false });
        await editor.setMarkdown(fence('vega-lite', URL_SPEC));
        await settle();

        expect(window.vegaEmbed).not.toHaveBeenCalled();
        expect(preview('.qde-vega-container').textContent).toContain('External fetch is disabled in offline mode');
    });

    test('offline mode still renders specs with inline values', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor({ allowExternalFetch: false });
        await editor.setMarkdown(fence('vega-lite', INLINE_SPEC));
        await settle();

        expect(window.vegaEmbed).toHaveBeenCalledTimes(1);
    });

    test('online mode passes external data URLs through', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor();
        await editor.setMarkdown(fence('vega-lite', URL_SPEC));
        await settle();

        expect(window.vegaEmbed.mock.calls[0][1].data).toEqual({ url: 'https://example.com/data.json' });
    });

    test('shows the error when vegaEmbed rejects', async () => {
        window.vegaEmbed = jest.fn(() => Promise.reject(new Error('bad <spec>')));
        await makeEditor();
        await editor.setMarkdown(fence('vega', '{"marks":[]}'));
        await settle();

        expect(preview('.qde-vega-container pre.qde-error').textContent).toBe('Vega error: bad <spec>');
    });

    test('shows a JSON error for an unparseable spec', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor();
        await editor.setMarkdown(fence('vega', '{nope'));
        await settle();

        expect(preview('.qde-vega-container pre.qde-error').textContent).toMatch(/^Vega JSON error: /);
        expect(window.vegaEmbed).not.toHaveBeenCalled();
    });

    test('does nothing when the container left the document before rendering', async () => {
        window.vegaEmbed = jest.fn(() => Promise.resolve());
        await makeEditor();
        await editor.setMarkdown(fence('vega', '{"marks":[]}'));
        editor.previewPanel.innerHTML = '';
        await settle();

        expect(window.vegaEmbed).not.toHaveBeenCalled();
    });

    test('lazy-loads vega, vega-lite and vega-embed in order, then renders', async () => {
        const embed = jest.fn(() => Promise.resolve());
        await makeEditor();
        const appended = interceptHead(el => {
            if (el.src.includes('vega-embed')) window.vegaEmbed = embed;
            return 'load';
        });
        await editor.setMarkdown(fence('vega', '{"marks":[]}'));
        await flush();

        expect(appended.map(el => el.src)).toEqual([
            'https://cdn.jsdelivr.net/npm/vega@5',
            'https://cdn.jsdelivr.net/npm/vega-lite@5',
            'https://cdn.jsdelivr.net/npm/vega-embed@6',
        ]);
        expect(embed).toHaveBeenCalledWith(preview('.qde-vega-container'), { marks: [] }, { renderer: 'svg', actions: false });
    });

    test('shows a failure message when the scripts load but vegaEmbed is missing', async () => {
        await makeEditor();
        interceptHead(() => 'load');
        await editor.setMarkdown(fence('vega', '{"marks":[]}'));
        await flush();

        expect(preview('.qde-vega-container').textContent).toBe('Failed to load Vega visualization library');
    });

    test('a failed script load is reported and can be retried later', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await makeEditor();
        const appended = interceptHead(el => (el.src.includes('vega-lite') ? 'error' : 'load'));
        await editor.setMarkdown(fence('vega', '{"marks":[]}'));
        await flush();

        expect(appended).toHaveLength(2);
        expect(warnSpy).toHaveBeenCalledWith('Failed to load Vega:', expect.any(Error));
        expect(window._qde_vega_loading).toBeNull();
        expect(preview('.qde-vega-container').textContent).toBe('Failed to load Vega visualization library');
    });

    test('a load failure after the container is gone is ignored', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        await makeEditor();
        let script;
        interceptHead(el => { script = el; return 'pending'; });
        await editor.setMarkdown(fence('vega', '{"marks":[]}'));
        editor.previewPanel.innerHTML = '<p>other</p>';
        script.onerror(new Error('network down'));
        await flush();

        expect(editor.previewPanel.innerHTML).toBe('<p>other</p>');
    });
});

// ───────────────────────────── Mermaid ─────────────────────────────

describe('renderMermaid', () => {
    test('inserts the SVG produced by mermaid.render', async () => {
        window.mermaid = { render: jest.fn(() => Promise.resolve({ svg: '<svg id="diagram"></svg>' })) };
        await makeEditor();
        await editor.setMarkdown(fence('mermaid', 'graph TD; A-->B'));

        const container = preview('.mermaid');
        expect(container.textContent).toBe('Loading diagram...');
        await settle();

        expect(window.mermaid.render).toHaveBeenCalledWith(container.id + '-svg', 'graph TD; A-->B');
        expect(container.querySelector('svg#diagram')).not.toBeNull();
    });

    test('shows the error when mermaid.render rejects', async () => {
        window.mermaid = { render: jest.fn(() => Promise.reject(new Error('bad <graph>'))) };
        await makeEditor();
        await editor.setMarkdown(fence('mermaid', 'nonsense'));
        await settle();

        expect(preview('.mermaid pre').textContent).toBe('Error rendering diagram: bad <graph>');
    });

    test('does nothing when the container left the document before rendering', async () => {
        window.mermaid = { render: jest.fn(() => Promise.resolve({ svg: '<svg></svg>' })) };
        await makeEditor();
        await editor.setMarkdown(fence('mermaid', 'graph TD; A-->B'));
        editor.previewPanel.innerHTML = '';
        await settle();

        expect(window.mermaid.render).not.toHaveBeenCalled();
    });

    test('without Mermaid the fence stays a plain code block', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('mermaid', 'graph TD; A-->B'));

        expect(preview('.mermaid')).toBeNull();
        expect(preview('pre[data-qd-lang="mermaid"] code').textContent).toBe('graph TD; A-->B');
    });
});

// ───────────────────────────── createFencePlugin ─────────────────────────────

describe('createFencePlugin', () => {
    test('custom fences take precedence over built-in renderers', async () => {
        const csv = jest.fn((code, lang) => `<div class="mine">${lang}:${code}</div>`);
        await makeEditor({ customFences: { csv } });
        await editor.setMarkdown(fence('csv', 'a,b'));

        expect(csv).toHaveBeenCalledWith('a,b', 'csv');
        expect(preview('.mine').textContent).toBe('csv:a,b');
        expect(preview('table')).toBeNull();
    });

    test('a custom fence that throws falls back to an escaped code block', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor({ customFences: { boom: () => { throw new Error('plugin failed'); } } });
        const { render } = editor.createFencePlugin();

        expect(render('<b>x</b>', 'boom')).toBe('<pre><code class="language-boom">&lt;b&gt;x&lt;/b&gt;</code></pre>');
        expect(errorSpy).toHaveBeenCalledWith('Custom fence plugin error for boom:', expect.any(Error));
    });

    test('highlight.js output is used for languages it knows', async () => {
        window.hljs = {
            getLanguage: jest.fn(lang => lang === 'js'),
            highlight: jest.fn(() => ({ value: '<span class="hljs-keyword">const</span> a' })),
        };
        await makeEditor();
        await editor.setMarkdown(fence('js', 'const a') + '\n\n' + fence('cobol', 'MOVE A TO B'));

        expect(window.hljs.highlight).toHaveBeenCalledTimes(1);
        expect(window.hljs.highlight).toHaveBeenCalledWith('const a', { language: 'js' });
        const highlighted = preview('pre[data-qd-lang="js"] code.hljs.language-js');
        expect(highlighted.querySelector('.hljs-keyword').textContent).toBe('const');
        expect(preview('pre[data-qd-lang="cobol"] code').textContent).toBe('MOVE A TO B');
        expect(preview('pre[data-qd-lang="cobol"] code').classList.contains('hljs')).toBe(false);
    });

    test('enableComplexFences: false leaves special fences as code', async () => {
        window.ABCJS = { renderAbc: jest.fn() };
        await makeEditor({ enableComplexFences: false });
        await editor.setMarkdown(fence('csv', 'a,b\n1,2') + '\n\n' + fence('abc', TUNE));
        await settle();

        expect(preview('table')).toBeNull();
        expect(preview('.qde-abc-container')).toBeNull();
        expect(preview('pre[data-qd-lang="csv"] code').textContent).toBe('a,b\n1,2');
        expect(window.ABCJS.renderAbc).not.toHaveBeenCalled();
        const { render } = editor.createFencePlugin();
        expect(render('a,b', 'csv')).toBeUndefined();
    });

    test('reverse reads highlighted code, plain code, or the element text', async () => {
        await makeEditor();
        const { reverse } = editor.createFencePlugin();
        const el = (html) => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            return wrapper.firstElementChild;
        };

        expect(reverse(el('<pre data-qd-lang="js"><code class="hljs"><span>const</span> a</code></pre>')))
            .toEqual({ content: 'const a', lang: 'js', fence: '```' });
        expect(reverse(el('<pre data-qd-lang="py"><code>print(1)</code></pre>')))
            .toEqual({ content: 'print(1)', lang: 'py', fence: '```' });
        expect(reverse(el('<div>just text</div>')))
            .toEqual({ content: 'just text', lang: '', fence: '```' });
        expect(reverse(el('<pre><code class="hljs"></code></pre>')).content).toBe('');
        expect(reverse(el('<pre><code></code></pre>')).content).toBe('');
        expect(reverse(el('<div></div>')).content).toBe('');
    });
});

// ───────────────────────────── preprocessSpecialElements ─────────────────────────────

describe('preprocessSpecialElements', () => {
    const panelOf = (html) => {
        const panel = document.createElement('div');
        panel.innerHTML = html;
        return panel;
    };

    test('ignores a missing panel', async () => {
        await makeEditor();
        expect(editor.preprocessSpecialElements(null)).toBeUndefined();
    });

    test('replaces non-editable fences with a <pre> holding their source', async () => {
        await makeEditor();
        const panel = panelOf(
            '<div contenteditable="false" data-qd-fence="~~~" data-qd-lang="mermaid" data-qd-source="graph TD; A--&gt;B"><svg></svg></div>' +
            '<div contenteditable="false" data-qd-source="raw text">rendered</div>' +
            '<div contenteditable="true" data-qd-source="left alone">editable</div>'
        );
        editor.preprocessSpecialElements(panel);

        const [first, second] = panel.querySelectorAll('pre');
        expect(first.getAttribute('data-qd-fence')).toBe('~~~');
        expect(first.getAttribute('data-qd-lang')).toBe('mermaid');
        expect(first.querySelector('code').textContent).toBe('graph TD; A-->B');
        expect(second.getAttribute('data-qd-fence')).toBe('```');
        expect(second.hasAttribute('data-qd-lang')).toBe(false);
        expect(second.querySelector('code').textContent).toBe('raw text');
        expect(panel.querySelector('svg')).toBeNull();
        expect(panel.querySelector('[contenteditable="true"]').textContent).toBe('editable');
    });

    test('turns csv tables back into csv source, quoting where needed', async () => {
        await makeEditor();
        const panel = panelOf(
            '<table class="qde-csv-table" data-qd-lang="csv">' +
            '<thead><tr><th>name, full</th><th>note</th></tr></thead>' +
            '<tbody><tr><td>Smith, J</td><td>said "hi"</td></tr><tr><td>Doe</td><td> plain </td></tr></tbody>' +
            '</table>'
        );
        editor.preprocessSpecialElements(panel);

        const pre = panel.querySelector('pre');
        expect(pre.getAttribute('data-qd-lang')).toBe('csv');
        expect(pre.getAttribute('data-qd-fence')).toBe('```');
        expect(pre.querySelector('code').textContent).toBe('"name, full",note\n"Smith, J","said ""hi"""\nDoe,plain');
        expect(panel.querySelector('table')).toBeNull();
    });

    test('uses the pipe and tab delimiters for psv and tsv', async () => {
        await makeEditor();
        const panel = panelOf(
            '<table class="qde-csv-table" data-qd-lang="psv"><thead><tr><th>a</th><th>b</th></tr></thead>' +
            '<tbody><tr><td>1,5</td><td>x|y</td></tr></tbody></table>' +
            '<table class="qde-csv-table" data-qd-lang="tsv"><thead><tr><th>c</th><th>d</th></tr></thead>' +
            '<tbody><tr><td>3</td><td>4</td></tr></tbody></table>'
        );
        editor.preprocessSpecialElements(panel);

        const [psv, tsv] = panel.querySelectorAll('pre code');
        expect(psv.textContent).toBe('a|b\n1,5|"x|y"');
        expect(tsv.textContent).toBe('c\td\n3\t4');
    });

    test('leaves tables with an unknown data language alone', async () => {
        await makeEditor();
        const panel = panelOf('<table class="qde-csv-table" data-qd-lang="xlsx"><thead><tr><th>a</th></tr></thead></table>');
        editor.preprocessSpecialElements(panel);

        expect(panel.querySelector('table')).not.toBeNull();
        expect(panel.querySelector('pre')).toBeNull();
    });

    test('an edited csv table round-trips to a csv fence in the markdown', async () => {
        await makeEditor();
        await editor.setMarkdown(fence('csv', 'name,qty\napple,1'));
        preview('tbody td').textContent = 'pear, ripe';
        editor.updateFromHTML();

        expect(editor.getMarkdown().trim()).toBe(fence('csv', 'name,qty\n"pear, ripe",1'));
    });
});

// ───────────────────────── MathJax retry ─────────────────────────

describe('MathJax load failure and retry', () => {
    const MATHJAX = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';

    test('a failed load is retried on a later render, after a short wait', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        let outcome = 'error';
        const appended = interceptHead(() => outcome);

        await editor.setMarkdown(fence('math', 'x^2'));
        expect(appended.map(el => el.src)).toEqual([MATHJAX]);
        // The config object is gone, so MathJax does not look loaded
        expect(window.MathJax).toBeUndefined();
        expect(window.mathJaxLoading).toBe(false);

        // Renders right after the failure do not request the script again
        await editor.setMarkdown(fence('math', 'x^3'));
        await editor.setMarkdown(fence('math', 'x^4'));
        expect(appended).toHaveLength(1);

        // After the wait, the next render requests it again
        jest.advanceTimersByTime(5000);
        outcome = 'pending';
        await editor.setMarkdown(fence('math', 'x^5'));
        expect(appended.map(el => el.src)).toEqual([MATHJAX, MATHJAX]);
        expect(window.MathJax.startup.typeset).toBe(false);

        window.MathJax.typesetPromise = jest.fn(() => Promise.resolve());
        appended[1].onload();
        expect(window.MathJax.typesetPromise).toHaveBeenCalledWith(
            Array.from(editor.previewPanel.querySelectorAll('.math-display'))
        );
    });

    test('each failure starts a new wait', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        const appended = interceptHead(() => 'error');

        await editor.setMarkdown(fence('math', 'a'));
        jest.advanceTimersByTime(5000);
        await editor.setMarkdown(fence('math', 'b'));
        expect(appended).toHaveLength(2);

        jest.advanceTimersByTime(4000);
        await editor.setMarkdown(fence('math', 'c'));
        expect(appended).toHaveLength(2);

        jest.advanceTimersByTime(1000);
        await editor.setMarkdown(fence('math', 'd'));
        expect(appended).toHaveLength(3);
    });

    test('a failure does not remove a MathJax the page loaded itself', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await makeEditor();
        let script;
        interceptHead(el => { script = el; return 'pending'; });
        await editor.setMarkdown(fence('math', 'x'));

        const hostMathJax = window.MathJax = { version: '3.2.2', typesetPromise: jest.fn(() => Promise.resolve()) };
        script.onerror(new Error('network down'));

        expect(window.MathJax).toBe(hostMathJax);
    });
});

