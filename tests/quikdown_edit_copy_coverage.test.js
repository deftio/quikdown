/**
 * @jest-environment jsdom
 */

/**
 * @file quikdown_edit_copy_coverage.test.js
 *
 * copy() / copyRendered() and the copy module inlined in the editor bundle
 * (src/quikdown_edit_copy.js): SVG rasterisation, canvas capture, MathJax
 * output, Leaflet map capture, HTML fence images and clipboard feedback.
 *
 * Image, canvas, fetch, ClipboardItem and navigator.clipboard are mocked;
 * the tests read the HTML that reaches the clipboard and assert on it.
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

const PNG_FROM_BLOB = 'data:image/png;base64,cG5n';      // FileReader over the mocked toBlob payload "png"
const PNG_FROM_CANVAS = 'data:image/png;base64,Q0FOVkFT'; // mocked canvas.toDataURL
const TINY = 'data:image/png;base64,AA==';

let editor;
let host;
let ctx;
let warnSpy;
let errorSpy;
let imageState;
const protoMocks = [];
const originalImage = window.Image;
const hadCreateObjectURL = 'createObjectURL' in URL;
const hadRevokeObjectURL = 'revokeObjectURL' in URL;

class MockImage {
    constructor() {
        this.naturalWidth = imageState.naturalWidth;
        this.naturalHeight = imageState.naturalHeight;
        this.width = 0;
        this.height = 0;
        this.onload = null;
        this.onerror = null;
        imageState.instances.push(this);
    }
    set src(value) {
        this._src = value;
        const fail = imageState.failIf(value);
        Promise.resolve().then(() => {
            if (fail) {
                if (this.onerror) this.onerror(new Error('image failed'));
            } else if (this.onload) {
                this.onload();
            }
        });
    }
    get src() {
        return this._src;
    }
}

function mockGetter(proto, name, get) {
    protoMocks.push([proto, name, Object.getOwnPropertyDescriptor(proto, name)]);
    Object.defineProperty(proto, name, { get, configurable: true });
}

const rect = (left, top, width, height) => ({
    left, top, width, height, right: left + width, bottom: top + height,
});

async function makeEditor(options = {}) {
    host = document.createElement('div');
    document.body.appendChild(host);
    editor = new QuikdownEditor(host, options);
    await editor.initPromise;
    return editor;
}

function setPreview(html) {
    editor.previewPanel.innerHTML = html;
    return editor.previewPanel;
}

function readBlob(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsText(blob);
    });
}

/** The fragment that copyRendered() put on the clipboard, parsed into a <div>. */
async function copiedFragment() {
    expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
    const item = navigator.clipboard.write.mock.calls[0][0][0];
    const html = await readBlob(item.items['text/html']);
    const fragment = document.createElement('div');
    fragment.innerHTML = html.split('<!--StartFragment-->')[1].split('<!--EndFragment-->')[0];
    return fragment;
}

async function copyAndRead(html, output) {
    setPreview(html);
    await editor.copyRendered(output);
    return copiedFragment();
}

const dims = (img) => [img.getAttribute('width'), img.getAttribute('height'), img.style.width, img.style.height];
const warnings = () => warnSpy.mock.calls.map(call => call[0]);

beforeEach(async () => {
    jest.useFakeTimers();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    imageState = { instances: [], naturalWidth: 640, naturalHeight: 480, failIf: () => false };
    window.Image = MockImage;

    ctx = { scale: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillStyle: '' };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => PNG_FROM_CANVAS);
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => cb(new Blob(['png'], { type: 'image/png' })));

    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
    window.fetch = jest.fn(() => Promise.reject(new Error('fetch disabled in tests')));

    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            write: jest.fn(() => Promise.resolve()),
            writeText: jest.fn(() => Promise.resolve()),
        },
    });
    window.ClipboardItem = class ClipboardItem {
        constructor(items) { this.items = items; }
    };
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });

    await makeEditor();
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
    while (protoMocks.length) {
        const [proto, name, descriptor] = protoMocks.pop();
        if (descriptor) Object.defineProperty(proto, name, descriptor);
        else delete proto[name];
    }
    window.Image = originalImage;
    if (!hadCreateObjectURL) delete URL.createObjectURL;
    if (!hadRevokeObjectURL) delete URL.revokeObjectURL;
    delete window.fetch;
    delete window.ClipboardItem;
    delete navigator.clipboard;
    delete navigator.platform;
    delete navigator.userAgent;
    delete document.execCommand;
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

// ───────────────────────── copy() ─────────────────────────

describe('copy()', () => {
    test('copies the markdown and flashes the button label for 1.5 s', async () => {
        await editor.setMarkdown('# Title');
        await editor.copy('markdown');

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Title');
        const button = editor.toolbar.querySelector('[data-action="copy-markdown"]');
        expect(button.textContent).toBe('Copied!');
        jest.advanceTimersByTime(1499);
        expect(button.textContent).toBe('Copied!');
        jest.advanceTimersByTime(1);
        expect(button.textContent).toBe('Copy MD');
    });

    test('copies the rendered HTML for any other type', async () => {
        await editor.setMarkdown('**bold**');
        await editor.copy('html');

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(editor.getHTML());
        expect(editor.getHTML()).toContain('<strong');
        expect(editor.toolbar.querySelector('[data-action="copy-html"]').textContent).toBe('Copied!');
    });

    test('still copies when the toolbar has no matching button', async () => {
        await editor.setMarkdown('text');
        editor.toolbar.querySelector('[data-action="copy-html"]').remove();
        await editor.copy('html');

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(editor.getHTML());
        expect(errorSpy).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    test('logs a clipboard failure and leaves the button alone', async () => {
        navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
        await editor.setMarkdown('text');
        await editor.copy('markdown');

        expect(errorSpy).toHaveBeenCalledWith('Failed to copy:', expect.objectContaining({ message: 'denied' }));
        expect(editor.toolbar.querySelector('[data-action="copy-markdown"]').textContent).toBe('Copy MD');
    });
});

// ───────────────────────── copyRendered() feedback ─────────────────────────

describe('copyRendered() feedback and clipboard strategy', () => {
    test('flashes the button label for 1.5 s after a successful copy', async () => {
        const fragment = await copyAndRead('<p>hello <strong>world</strong></p>');

        expect(fragment.querySelector('strong').style.fontWeight).toBe('bold');
        const button = editor.toolbar.querySelector('[data-action="copy-rendered"]');
        expect(button.textContent).toBe('Copied!');
        jest.advanceTimersByTime(1500);
        expect(button.textContent).toBe('Copy Rendered');
    });

    test('rejects an unknown output profile without touching the clipboard', async () => {
        setPreview('<p>hello</p>');
        await editor.copyRendered('fancy');

        expect(navigator.clipboard.write).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to copy rendered content:',
            expect.objectContaining({ message: expect.stringContaining('Invalid output profile "fancy"') })
        );
        expect(editor.toolbar.querySelector('[data-action="copy-rendered"]').textContent).toBe('Copy Rendered');
    });

    test('an undetectable platform uses the non-mac path and cleans up its staging element', async () => {
        Object.defineProperty(navigator, 'platform', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: undefined });
        navigator.clipboard.write.mockRejectedValue(new Error('denied'));
        let staged = null;
        document.execCommand = jest.fn(() => {
            staged = Array.from(document.body.children).find(el => el.style.left === '-9999px');
            return true;
        });
        setPreview('<p>fallback text</p>');
        await editor.copyRendered();

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(staged.textContent).toBe('fallback text');
        expect(staged.isConnected).toBe(false);
        expect(editor.toolbar.querySelector('[data-action="copy-rendered"]').textContent).toBe('Copied!');
    });
});

// ───────────────────────── plain images ─────────────────────────

describe('images in the preview', () => {
    test('images without a size take their natural size, capped at 800x600', async () => {
        mockGetter(window.HTMLImageElement.prototype, 'naturalWidth', () => 1600);
        mockGetter(window.HTMLImageElement.prototype, 'naturalHeight', () => 1200);
        const fragment = await copyAndRead(`<p><img src="${TINY}" alt="big"></p>`);

        expect(dims(fragment.querySelector('img'))).toEqual(['800', '600', '800px', '600px']);
        expect(window.fetch).not.toHaveBeenCalled();
    });

    test('remote images are inlined as data URLs', async () => {
        window.fetch = jest.fn(() => Promise.resolve({
            blob: () => Promise.resolve(new Blob(['abc'], { type: 'image/png' })),
        }));
        const fragment = await copyAndRead('<p><img src="https://example.com/pic.png" alt="pic"></p>');

        expect(window.fetch).toHaveBeenCalledWith('https://example.com/pic.png');
        const img = fragment.querySelector('img');
        expect(img.getAttribute('src')).toBe('data:image/png;base64,YWJj');
        expect(img.getAttribute('v:shapes')).toMatch(/^image/);
    });

    test('images over 2 MB keep their URL', async () => {
        window.fetch = jest.fn(() => Promise.resolve({
            blob: () => Promise.resolve({ size: 3 * 1024 * 1024 }),
        }));
        const fragment = await copyAndRead('<p><img src="https://example.com/huge.png"></p>');

        expect(fragment.querySelector('img').getAttribute('src')).toBe('https://example.com/huge.png');
        expect(warnSpy).toHaveBeenCalledWith(
            'Image too large for inline data URL:', 'https://example.com/huge.png', 'Size:', 3 * 1024 * 1024
        );
    });

    test('images that cannot be fetched keep their URL', async () => {
        const fragment = await copyAndRead('<p><img src="https://example.com/missing.png"></p>');

        expect(fragment.querySelector('img').getAttribute('src')).toBe('https://example.com/missing.png');
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to convert image to data URL:', 'https://example.com/missing.png', expect.any(Error)
        );
    });

    test('an existing v:shapes attribute is preserved', async () => {
        const fragment = await copyAndRead(`<p><img src="${TINY}" v:shapes="keepme"></p>`);
        expect(fragment.querySelector('img').getAttribute('v:shapes')).toBe('keepme');
    });
});

// ───────────────────────── Mermaid (svgToPng) ─────────────────────────

describe('Mermaid diagrams', () => {
    test('are rasterised at 2x and replaced by a PNG sized from the viewBox', async () => {
        const fragment = await copyAndRead('<div class="mermaid"><svg viewBox="0 0 200 100"><rect></rect></svg></div>');

        expect(fragment.querySelector('.mermaid')).toBeNull();
        const img = fragment.querySelector('img');
        expect(img.alt).toBe('Mermaid Diagram');
        expect(img.getAttribute('src')).toBe(PNG_FROM_BLOB);
        expect(dims(img)).toEqual(['200', '100', '200px', '100px']);
        expect(img.style.maxWidth).toBe('none');

        const [source] = imageState.instances;
        expect(source.src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
        const svgText = decodeURIComponent(source.src.split(',')[1]);
        expect(svgText).toContain('width="200"');
        expect(svgText).toContain('height="100"');
        expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 200, 100);
    });

    test('prefer the rendered size when the browser reports one', async () => {
        mockGetter(window.SVGElement.prototype, 'clientWidth', () => 320);
        mockGetter(window.SVGElement.prototype, 'clientHeight', () => 180);
        const fragment = await copyAndRead('<div class="mermaid"><svg viewBox="0 0 200 100"></svg></div>');

        expect(dims(fragment.querySelector('img'))).toEqual(['320', '180', '320px', '180px']);
        expect(ctx.drawImage).toHaveBeenCalledWith(imageState.instances[0], 0, 0, 320, 180);
    });

    test('fall back to the width attribute, then to 400x300', async () => {
        const fragment = await copyAndRead(
            '<div class="mermaid"><svg width="250"></svg></div><div class="mermaid"><svg></svg></div>'
        );
        const [first, second] = fragment.querySelectorAll('img');
        expect(dims(first)).toEqual(['250', '300', '250px', '300px']);
        expect(dims(second)).toEqual(['400', '300', '400px', '300px']);
    });

    test('stay as SVG when the image cannot be loaded', async () => {
        imageState.failIf = () => true;
        const fragment = await copyAndRead('<div class="mermaid"><svg viewBox="0 0 200 100"></svg></div>');

        expect(fragment.querySelector('.mermaid svg')).not.toBeNull();
        expect(fragment.querySelector('img')).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Failed to convert Mermaid diagram:', expect.any(Error));
    });

    test('stay as SVG when drawing to the canvas throws', async () => {
        ctx.drawImage.mockImplementation(() => { throw new Error('canvas tainted'); });
        const fragment = await copyAndRead('<div class="mermaid"><svg viewBox="0 0 200 100"></svg></div>');

        expect(fragment.querySelector('.mermaid svg')).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to convert Mermaid diagram:', expect.objectContaining({ message: 'canvas tainted' })
        );
    });
});

// ───────────────────────── ABC ─────────────────────────

describe('ABC notation', () => {
    test('uses the viewBox aspect ratio for the image height', async () => {
        const fragment = await copyAndRead('<div class="qde-abc-container"><svg width="100%" viewBox="0 0 800 200"></svg></div>');
        const img = fragment.querySelector('img');

        expect(img.alt).toBe('Music Notation');
        expect(img.getAttribute('src')).toBe(PNG_FROM_BLOB);
        expect(dims(img)).toEqual(['800', '200', '800px', '200px']);
        expect(fragment.querySelector('.qde-abc-container')).toBeNull();
    });

    test('scales the height from the rendered width', async () => {
        mockGetter(window.SVGElement.prototype, 'clientWidth', () => 400);
        mockGetter(window.SVGElement.prototype, 'clientHeight', () => 999);
        const fragment = await copyAndRead('<div class="qde-abc-container"><svg viewBox="0 0 800 200"></svg></div>');

        expect(dims(fragment.querySelector('img'))).toEqual(['400', '100', '400px', '100px']);
    });

    test('without a viewBox uses the attributes, then 400x200', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-abc-container"><svg width="300" height="90"></svg></div>' +
            '<div class="qde-abc-container"><svg></svg></div>'
        );
        const [first, second] = fragment.querySelectorAll('img');
        expect(dims(first)).toEqual(['300', '90', '300px', '90px']);
        expect(dims(second)).toEqual(['400', '200', '400px', '200px']);
    });

    test('an unrendered block becomes a text placeholder', async () => {
        const fragment = await copyAndRead('<div class="qde-abc-container">Loading music notation...</div>');

        expect(fragment.querySelector('.qde-abc-container')).toBeNull();
        expect(fragment.textContent).toBe('[Music Notation - Interactive content not available in copy]');
    });

    test('stays as SVG when rasterising fails', async () => {
        imageState.failIf = () => true;
        const fragment = await copyAndRead('<div class="qde-abc-container"><svg viewBox="0 0 800 200"></svg></div>');

        expect(fragment.querySelector('.qde-abc-container svg')).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Failed to convert ABC notation:', expect.any(Error));
    });
});

// ───────────────────────── Vega ─────────────────────────

describe('Vega charts', () => {
    test('are replaced by a PNG with the SVG size, or 400x300', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-vega-container"><svg width="300" height="150"></svg></div>' +
            '<div class="qde-vega-container"><svg></svg></div>'
        );
        const [first, second] = fragment.querySelectorAll('img');

        expect(first.alt).toBe('Data Visualization');
        expect(first.getAttribute('src')).toBe(PNG_FROM_BLOB);
        expect(dims(first)).toEqual(['300', '150', '300px', '150px']);
        expect(dims(second)).toEqual(['400', '300', '400px', '300px']);
        expect(fragment.querySelector('.qde-vega-container')).toBeNull();
    });

    test('use the rendered size when available', async () => {
        mockGetter(window.SVGElement.prototype, 'clientWidth', () => 500);
        mockGetter(window.SVGElement.prototype, 'clientHeight', () => 250);
        const fragment = await copyAndRead('<div class="qde-vega-container"><svg width="300" height="150"></svg></div>');

        expect(dims(fragment.querySelector('img'))).toEqual(['500', '250', '500px', '250px']);
    });

    test('an unrendered block becomes a text placeholder', async () => {
        const fragment = await copyAndRead('<div class="qde-vega-container">Loading visualization...</div>');
        expect(fragment.textContent).toBe('[Vega Chart - Interactive content not available in copy]');
    });

    test('stay as SVG when rasterising fails', async () => {
        imageState.failIf = () => true;
        const fragment = await copyAndRead('<div class="qde-vega-container"><svg width="300" height="150"></svg></div>');

        expect(fragment.querySelector('.qde-vega-container svg')).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Failed to convert Vega chart:', expect.any(Error));
    });
});

// ───────────────────────── SVG fences ─────────────────────────

describe('SVG fences', () => {
    test('explicit width and height win', async () => {
        mockGetter(window.SVGElement.prototype, 'clientWidth', () => 999);
        mockGetter(window.SVGElement.prototype, 'clientHeight', () => 999);
        const fragment = await copyAndRead(
            '<div class="qde-svg-container"><svg width="120" height="80" viewBox="0 0 10 10"></svg></div>'
        );
        const img = fragment.querySelector('.qde-svg-container img');

        expect(img.alt).toBe('SVG Image');
        expect(img.getAttribute('src')).toBe(PNG_FROM_BLOB);
        expect(dims(img)).toEqual(['120', '80', '120px', '80px']);
        expect(fragment.querySelector('svg')).toBeNull();
        expect(ctx.drawImage).toHaveBeenCalledWith(imageState.instances[0], 0, 0, 120, 80);
    });

    test('without attributes the size comes from the viewBox, then 400x300', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-svg-container"><svg viewBox="0 0 64 32"></svg></div>' +
            '<div class="qde-svg-container"><svg></svg></div>'
        );
        const [first, second] = fragment.querySelectorAll('img');
        expect(dims(first)).toEqual(['64', '32', '64px', '32px']);
        expect(dims(second)).toEqual(['400', '300', '400px', '300px']);
    });

    test('without attributes the rendered size is preferred', async () => {
        mockGetter(window.SVGElement.prototype, 'clientWidth', () => 70);
        mockGetter(window.SVGElement.prototype, 'clientHeight', () => 35);
        const fragment = await copyAndRead('<div class="qde-svg-container"><svg viewBox="0 0 64 32"></svg></div>');

        expect(dims(fragment.querySelector('img'))).toEqual(['70', '35', '70px', '35px']);
    });

    test('non-numeric attributes fall back to the viewBox, then 400x300', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-svg-container"><svg width="auto" height="auto" viewBox="0 0 90 45"></svg></div>' +
            '<div class="qde-svg-container"><svg width="auto" height="auto"></svg></div>'
        );
        const [first, second] = fragment.querySelectorAll('img');
        expect(dims(first)).toEqual(['90', '45', '90px', '45px']);
        expect(dims(second)).toEqual(['400', '300', '400px', '300px']);
    });

    test('non-numeric attributes without a viewBox use the rendered size', async () => {
        mockGetter(window.SVGElement.prototype, 'clientWidth', () => 70);
        mockGetter(window.SVGElement.prototype, 'clientHeight', () => 35);
        const fragment = await copyAndRead('<div class="qde-svg-container"><svg width="auto" height="auto"></svg></div>');

        expect(dims(fragment.querySelector('img'))).toEqual(['70', '35', '70px', '35px']);
    });

    test('stay as SVG when rasterising fails', async () => {
        imageState.failIf = () => true;
        const fragment = await copyAndRead('<div class="qde-svg-container"><svg width="120" height="80"></svg></div>');

        expect(fragment.querySelector('.qde-svg-container svg')).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Failed to convert SVG to image:', expect.any(Error));
    });
});

// ───────────────────────── canvases: Chart.js and STL ─────────────────────────

describe('chart canvases', () => {
    test('are captured at the canvas size', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-chart-container" data-chart-id="c1"><canvas width="300" height="150"></canvas></div>'
        );
        const img = fragment.querySelector('img');

        expect(img.alt).toBe('Chart');
        expect(img.getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(dims(img)).toEqual(['300', '150', '300px', '150px']);
        expect(fragment.querySelector('.qde-chart-container')).toBeNull();
    });

    test('become a placeholder when the canvas cannot be exported', async () => {
        HTMLCanvasElement.prototype.toDataURL.mockImplementation(() => { throw new Error('tainted'); });
        const fragment = await copyAndRead(
            '<div class="qde-chart-container" data-chart-id="c1"><canvas width="300" height="150"></canvas></div>'
        );

        expect(fragment.textContent).toBe('[Chart - Interactive content not available in copy]');
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to convert chart canvas to image:', expect.objectContaining({ message: 'tainted' })
        );
    });

    test('become a placeholder without a chart id or with an empty canvas', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-chart-container"><canvas width="300" height="150"></canvas></div>' +
            '<div class="qde-chart-container" data-chart-id="c2"><canvas width="0" height="0"></canvas></div>'
        );

        expect(fragment.querySelector('img')).toBeNull();
        expect(Array.from(fragment.children).map(el => el.textContent)).toEqual([
            '[Chart - Interactive content not available in copy]',
            '[Chart - Interactive content not available in copy]',
        ]);
    });
});

describe('STL viewers', () => {
    const STL_HTML = '<div class="qde-stl-container" data-stl-id="s1"><canvas width="600" height="800"></canvas></div>';

    test('re-render the scene and capture the canvas at half its pixel size', async () => {
        const live = setPreview(STL_HTML).querySelector('.qde-stl-container');
        live._threeRenderer = { render: jest.fn() };
        live._threeScene = { name: 'scene' };
        live._threeCamera = { name: 'camera' };
        await editor.copyRendered();
        const fragment = await copiedFragment();
        const img = fragment.querySelector('img');

        expect(live._threeRenderer.render).toHaveBeenCalledWith(live._threeScene, live._threeCamera);
        expect(img.alt).toBe('STL 3D Model');
        expect(img.getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(dims(img)).toEqual(['300', '400', '300px', '400px']);
    });

    test('capture the canvas as-is when no Three.js references are stored', async () => {
        const fragment = await copyAndRead(STL_HTML);
        expect(fragment.querySelector('img').alt).toBe('STL 3D Model');
    });

    test('become a placeholder when the WebGL canvas cannot be exported', async () => {
        HTMLCanvasElement.prototype.toDataURL.mockImplementation(() => { throw new Error('context lost'); });
        const fragment = await copyAndRead(STL_HTML);

        expect(fragment.textContent).toBe('[STL 3D Model - Interactive content not available in copy]');
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to convert STL canvas to image (likely WebGL context issue):',
            expect.objectContaining({ message: 'context lost' })
        );
    });

    test('become a placeholder without an id or without a canvas', async () => {
        const fragment = await copyAndRead(
            '<div class="qde-stl-container"><canvas width="600" height="800"></canvas></div>' +
            '<div class="qde-stl-container" data-stl-id="s2">Loading 3D model...</div>'
        );

        expect(Array.from(fragment.children).map(el => el.textContent)).toEqual([
            '[STL 3D Model - Interactive content not available in copy]',
            '[STL 3D Model - Interactive content not available in copy]',
        ]);
        expect(warnings()).toEqual(expect.arrayContaining([
            'Could not find original STL container',
            'No valid canvas found in STL container',
        ]));
    });
});

// ───────────────────────── Math ─────────────────────────

describe('math blocks', () => {
    const MATH = '<div class="math-display"><mjx-container><svg viewBox="0 0 10000 2000"></svg></mjx-container></div>';

    test('are scaled down to at most 150x45 and replaced by a PNG', async () => {
        imageState.naturalWidth = 300;
        imageState.naturalHeight = 60;
        const fragment = await copyAndRead(MATH);
        const img = fragment.querySelector('img');

        expect(fragment.querySelector('.math-display')).toBeNull();
        expect(img.alt).toBe('Math equation');
        expect(img.getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(img.getAttribute('width')).toBe('150');
        expect(img.getAttribute('height')).toBe('30');
        expect(img.style.width).toBe('150px');
        expect(img.style.verticalAlign).toBe('middle');

        // 10000x2000 * 0.04 = 400x80, then fitted into 150x45
        const [, , width, height] = ctx.fillRect.mock.calls[0];
        expect(width).toBeCloseTo(150);
        expect(height).toBeCloseTo(30);
        expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        expect(ctx.drawImage.mock.calls[0][0]).toBe(imageState.instances[0]);
        expect(imageState.instances[0].src).toBe('blob:mock');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });

    test('use absolute SVG width/height when the browser exposes them', async () => {
        mockGetter(window.SVGSVGElement.prototype, 'width', () => ({ baseVal: { value: 500 } }));
        mockGetter(window.SVGSVGElement.prototype, 'height', () => ({ baseVal: { value: 100 } }));
        await copyAndRead(MATH);

        // 500x100 * 0.04 = 20x4, already inside the limit
        const [, , width, height] = ctx.fillRect.mock.calls[0];
        expect(width).toBeCloseTo(20);
        expect(height).toBeCloseTo(4);
    });

    test('use the loaded image size when the SVG has no usable geometry', async () => {
        mockGetter(window.SVGSVGElement.prototype, 'viewBox', () => undefined);
        imageState.naturalWidth = 300;
        imageState.naturalHeight = 60;
        await copyAndRead(MATH);

        const [, , width, height] = ctx.fillRect.mock.calls[0];
        expect(width).toBeCloseTo(12);
        expect(height).toBeCloseTo(2.4);
    });

    test('without an SVG the block is left as it is', async () => {
        const fragment = await copyAndRead('<div class="math-display"><mjx-container>x</mjx-container></div>');

        expect(fragment.querySelector('.math-display').textContent).toBe('x');
        expect(warnSpy).toHaveBeenCalledWith('No SVG found in math element, skipping');
    });

    test('are left as they are when the SVG image fails to load', async () => {
        imageState.failIf = () => true;
        const fragment = await copyAndRead(MATH);

        expect(fragment.querySelector('.math-display svg')).not.toBeNull();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to convert math element to image:',
            expect.objectContaining({ message: 'Failed to load SVG image' })
        );
    });
});

// ───────────────────────── GeoJSON map rasterisation ─────────────────────────

describe('GeoJSON maps (rasterizeGeoJSONMap)', () => {
    const MAP_HTML =
        '<div class="geojson-container" data-original-source="SRC">' +
        '<img class="leaflet-tile" id="t1" src="https://tiles.example/1.png">' +
        '<img class="leaflet-tile" id="t2" src="https://tiles.example/2.png">' +
        '<svg id="overlay"><path></path></svg>' +
        '<div class="leaflet-control"><svg id="control"></svg></div>' +
        '<img class="leaflet-marker-icon" id="pin" src="https://tiles.example/pin.png">' +
        '</div>';

    function liveMap() {
        const live = setPreview(MAP_HTML).querySelector('.geojson-container');
        live._map = {};
        live.getBoundingClientRect = () => rect(100, 50, 600, 300);
        live.querySelector('#t1').getBoundingClientRect = () => rect(100, 50, 256, 256);
        live.querySelector('#t2').getBoundingClientRect = () => rect(356, 50, 256, 256);
        live.querySelector('#overlay').getBoundingClientRect = () => rect(150, 80, 400, 200);
        live.querySelector('#pin').getBoundingClientRect = () => rect(300, 150, 25, 41);
        return live;
    }

    test('composes tiles, vector overlay and markers onto one canvas', async () => {
        liveMap();
        await editor.copyRendered();
        const fragment = await copiedFragment();
        const img = fragment.querySelector('img[alt="GeoJSON Map"]');

        expect(fragment.querySelector('.geojson-container')).toBeNull();
        expect(img.getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(img.style.height).toBe('300px');

        const [tile1, tile2, overlay, pin] = imageState.instances;
        expect(imageState.instances).toHaveLength(4);
        expect(tile1.src).toBe('https://tiles.example/1.png');
        expect(tile1.crossOrigin).toBe('anonymous');
        expect(overlay.src).toBe('blob:mock');
        expect(pin.src).toBe('https://tiles.example/pin.png');
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1); // the control SVG is skipped
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');

        expect(ctx.fillStyle).toBe('#FFFFFF');
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 600, 300);
        expect(ctx.drawImage).toHaveBeenCalledWith(tile1, 0, 0, 256, 256);
        expect(ctx.drawImage).toHaveBeenCalledWith(tile2, 256, 0, 256, 256);
        expect(ctx.drawImage).toHaveBeenCalledWith(overlay, 50, 30, 400, 200);
        expect(ctx.drawImage).toHaveBeenCalledWith(pin, 200, 100, 25, 41);
        expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    });

    test('still produces an image when a tile, the overlay and a marker fail to load', async () => {
        liveMap();
        imageState.failIf = src => src.includes('2.png') || src === 'blob:mock' || src.includes('pin');
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.querySelector('img[alt="GeoJSON Map"]').getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('Failed to load tile:', 'https://tiles.example/2.png');
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to draw SVG overlay:', expect.objectContaining({ message: 'Failed to load SVG overlay' })
        );
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });

    test('a tile that cannot be drawn is skipped', async () => {
        liveMap();
        ctx.drawImage.mockImplementationOnce(() => { throw new Error('tainted tile'); });
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.querySelector('img[alt="GeoJSON Map"]')).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Failed to draw tile:', expect.objectContaining({ message: 'tainted tile' }));
        expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    });

    test('a map with no layout size becomes a placeholder', async () => {
        const live = setPreview(MAP_HTML).querySelector('.geojson-container');
        live._map = {};
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.textContent).toBe('[GeoJSON Map - Interactive content not available in copy]');
        expect(warnSpy).toHaveBeenCalledWith('Map container has zero dimensions');
    });

    test('a canvas without a 2D context becomes a placeholder', async () => {
        liveMap();
        HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.textContent).toBe('[GeoJSON Map - Interactive content not available in copy]');
        expect(errorSpy).toHaveBeenCalledWith('Failed to rasterize GeoJSON map:', expect.any(Error));
    });

    test('each copied map is matched to its own live container', async () => {
        const panel = setPreview(
            '<div class="geojson-container" data-original-source="first">Loading map...</div>' +
            '<div class="geojson-container" data-original-source="second"></div>'
        );
        const second = panel.querySelectorAll('.geojson-container')[1];
        second._map = {};
        second.getBoundingClientRect = () => rect(0, 0, 400, 300);
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.children[0].textContent).toBe('[GeoJSON Map - Still loading]');
        expect(fragment.children[1].alt).toBe('GeoJSON Map');
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    });
});

describe('Leaflet containers without a stored source', () => {
    const LEGACY_HTML =
        '<div id="map-1" data-qd-lang="geojson"><div class="leaflet-container">' +
        `<img class="leaflet-tile" id="t1" src="${TINY}">` +
        `<img class="leaflet-tile" id="t2" src="${TINY}">` +
        `<img class="leaflet-tile" id="t3" src="${TINY}" style="display: none">` +
        '<div class="leaflet-overlay-pane"><svg id="ov1"></svg><svg id="ov2"></svg></div>' +
        '<div class="leaflet-marker-pane">' +
        `<img class="leaflet-marker-icon" id="m1" src="${TINY}">` +
        `<img class="leaflet-marker-icon" id="m2" src="${TINY}" style="visibility: hidden">` +
        '</div></div></div>';

    function liveLegacyMap() {
        const live = setPreview(LEGACY_HTML).querySelector('#map-1');
        const el = id => live.querySelector('#' + id);
        live.querySelector('.leaflet-container').getBoundingClientRect = () => rect(10, 20, 600, 400);
        el('t1').getBoundingClientRect = () => rect(10, 20, 256, 256);
        el('t2').getBoundingClientRect = () => rect(1000, 1000, 256, 256);  // outside the map
        el('t3').getBoundingClientRect = () => rect(266, 20, 256, 256);     // hidden
        el('ov1').getBoundingClientRect = () => rect(60, 70, 100, 50);
        el('m1').getBoundingClientRect = () => rect(110, 120, 25, 41);
        el('m2').getBoundingClientRect = () => rect(210, 120, 25, 41);      // hidden
        return { live, el };
    }

    test('draws visible tiles, overlays and markers and replaces the block with an image', async () => {
        const { el } = liveLegacyMap();
        await editor.copyRendered();
        const fragment = await copiedFragment();
        const img = fragment.querySelector('img[alt="Map"]');

        expect(fragment.querySelector('#map-1')).toBeNull();
        expect(img.getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(dims(img)).toEqual(['600', '400', '600px', '400px']);
        expect(img.style.display).toBe('block');

        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 600, 400);
        expect(ctx.drawImage).toHaveBeenCalledTimes(3);
        expect(ctx.drawImage).toHaveBeenCalledWith(el('t1'), 0, 0, 257, 257);
        expect(ctx.drawImage).toHaveBeenCalledWith(el('m1'), 100, 100, 25, 41);
        const overlayCall = ctx.drawImage.mock.calls[1];
        expect(overlayCall[0]).toBeInstanceOf(MockImage);
        expect(overlayCall[0].src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
        expect(overlayCall.slice(1)).toEqual([50, 50, 100, 50]);
    });

    test('a map whose fence has arguments (```geojson #map) is captured too', async () => {
        const { live } = liveLegacyMap();
        live.setAttribute('data-qd-lang', 'geojson #map title="Sites"');
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.querySelector('#map-1')).toBeNull();
        expect(fragment.querySelector('img[alt="Map"]').getAttribute('src')).toBe(PNG_FROM_CANVAS);
    });

    test('a tainted canvas yields a grey box of the same size', async () => {
        liveLegacyMap();
        HTMLCanvasElement.prototype.toDataURL.mockImplementation(() => { throw new Error('tainted'); });
        await editor.copyRendered();
        const fragment = await copiedFragment();
        const img = fragment.querySelector('img[alt="Map"]');

        expect(img.hasAttribute('src')).toBe(false);
        expect(img.style.width).toBe('600px');
        expect(img.style.height).toBe('400px');
        expect(img.style.backgroundColor).toBe('rgb(240, 240, 240)');
        expect(warnSpy).toHaveBeenCalledWith('Map canvas tainted; falling back to placeholder');
    });

    test('layers that cannot be drawn are skipped one by one', async () => {
        liveLegacyMap();
        ctx.drawImage.mockImplementation(() => { throw new Error('cannot draw'); });
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.querySelector('img[alt="Map"]').getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(warnings()).toEqual(expect.arrayContaining([
            'Failed to draw tile:', 'Failed to draw overlay SVG:', 'Failed to draw marker icon:',
        ]));
    });

    test('blocks without an id or without a Leaflet container are left alone', async () => {
        const fragment = await copyAndRead(
            '<div data-qd-lang="geojson">no id</div><div id="map-2" data-qd-lang="geojson">no map yet</div>'
        );

        expect(Array.from(fragment.children).map(el => el.textContent)).toEqual(['no id', 'no map yet']);
        expect(fragment.querySelector('img')).toBeNull();
    });

    test('a canvas without a 2D context leaves the block alone', async () => {
        liveLegacyMap();
        HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
        await editor.copyRendered();
        const fragment = await copiedFragment();

        expect(fragment.querySelector('#map-1 .leaflet-container')).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Failed to process map container:', expect.any(Error));
    });
});

// ───────────────────────── HTML fences ─────────────────────────

describe('HTML fences', () => {
    function htmlFence(source, inner = '<pre>source shown as text</pre>') {
        const container = document.createElement('div');
        container.className = 'qde-html-container';
        if (source !== null) container.setAttribute('data-qd-source', source);
        container.innerHTML = inner;
        return container.outerHTML;
    }
    const copied = async (html) => (await copyAndRead(html)).querySelector('.qde-html-container');

    test('source HTML is rendered without scripts or event handlers', async () => {
        const container = await copied(htmlFence('<p onclick="x()" class="keep">hi</p><script>bad()</script>'));

        expect(container.innerHTML).toBe('<p class="keep">hi</p>');
    });

    test('an image with only a width keeps its aspect ratio', async () => {
        const container = await copied(htmlFence('<img src="https://example.com/a.png" width="250">'));
        const img = container.querySelector('img');
        const loader = imageState.instances[0];

        expect(loader.src).toBe('https://example.com/a.png');
        expect(loader.crossOrigin).toBe('anonymous');
        expect(ctx.drawImage).toHaveBeenCalledWith(loader, 0, 0, 250, 188);
        expect(img.getAttribute('src')).toBe(PNG_FROM_CANVAS);
        expect(dims(img)).toEqual(['250', '188', '250px', '188px']);
        expect(img.getAttribute('v:shapes')).toMatch(/^image/);
    });

    test('an image with only a height keeps its aspect ratio', async () => {
        const container = await copied(htmlFence('<img src="https://example.com/a.png" height="120">'));
        expect(dims(container.querySelector('img'))).toEqual(['160', '120', '160px', '120px']);
    });

    test('an image with both dimensions is not rescaled', async () => {
        const container = await copied(htmlFence('<img src="https://example.com/a.png" width="100" height="50">'));
        expect(dims(container.querySelector('img'))).toEqual(['100', '50', '100px', '50px']);
    });

    test('an unsized or percent-sized image uses its natural size', async () => {
        const container = await copied(htmlFence(
            '<img src="https://example.com/a.png"><img src="https://example.com/b.png" width="50%" height="25%">'
        ));
        const [plain, percent] = container.querySelectorAll('img');

        expect(dims(plain)).toEqual(['640', '480', '640px', '480px']);
        expect(dims(percent)).toEqual(['640', '480', '640px', '480px']);
    });

    test('an image with no natural size defaults to 250x200', async () => {
        imageState.naturalWidth = 0;
        imageState.naturalHeight = 0;
        const container = await copied(htmlFence('<img src="https://example.com/a.png">'));
        expect(dims(container.querySelector('img'))).toEqual(['250', '200', '250px', '200px']);
    });

    test('an image that fails to load keeps its URL', async () => {
        imageState.failIf = () => true;
        const container = await copied(htmlFence('<img src="https://example.com/gone.png" width="250">'));
        const img = container.querySelector('img');

        expect(img.getAttribute('src')).toBe('https://example.com/gone.png');
        expect(img.getAttribute('v:shapes')).toMatch(/^image/);
        expect(warnSpy).toHaveBeenCalledWith('Failed to load HTML fence image:', 'https://example.com/gone.png');
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to convert HTML fence image:', 'https://example.com/gone.png',
            expect.objectContaining({ message: 'Image load failed' })
        );
    });

    test('data: images are left alone and non-http URLs are resolved through a second Image', async () => {
        const container = await copied(htmlFence(`<img src="${TINY}"><img src="file:///images/pic.png">`));
        const [inline, local] = container.querySelectorAll('img');

        expect(inline.getAttribute('src')).toBe(TINY);
        expect(inline.getAttribute('v:shapes')).toMatch(/^image/);
        expect(imageState.instances.map(image => image.src)).toEqual(['file:///images/pic.png', 'file:///images/pic.png']);
        expect(local.getAttribute('src')).toBe(PNG_FROM_CANVAS);
    });

    describe('already rendered (no stored source)', () => {
        test('images are converted with the same sizing rules', async () => {
            const container = await copied(htmlFence(null,
                '<img id="w" src="https://example.com/w.png" width="200">' +
                '<img id="h" src="https://example.com/h.png" height="120">' +
                '<img id="n" src="https://example.com/n.png">' +
                '<img id="p" src="https://example.com/p.png" width="50%" height="25%">' +
                `<img id="d" src="${TINY}">`
            ));
            const img = id => container.querySelector('#' + id);

            expect(dims(img('w'))).toEqual(['200', '150', '200px', '150px']);
            expect(dims(img('h'))).toEqual(['160', '120', '160px', '120px']);
            expect(dims(img('n'))).toEqual(['640', '480', '640px', '480px']);
            expect(dims(img('p'))).toEqual(['50', '25', '50px', '25px']);
            ['w', 'h', 'n', 'p'].forEach(id => expect(img(id).getAttribute('src')).toBe(PNG_FROM_CANVAS));
            expect(img('d').getAttribute('src')).toBe(TINY);
            expect(img('d').getAttribute('v:shapes')).toMatch(/^image/);
            expect(ctx.drawImage).toHaveBeenCalledTimes(4);
        });

        test('an image that fails to load keeps its URL', async () => {
            imageState.failIf = () => true;
            const container = await copied(htmlFence(null, '<img src="https://example.com/gone.png" width="200">'));

            expect(container.querySelector('img').getAttribute('src')).toBe('https://example.com/gone.png');
            expect(warnSpy).toHaveBeenCalledWith('Failed to load HTML fence image:', 'https://example.com/gone.png');
        });

        test('non-http URLs are resolved through a second Image', async () => {
            const container = await copied(htmlFence(null, '<img src="file:///images/pic.png" width="200">'));

            expect(imageState.instances.map(image => image.src)).toEqual(['file:///images/pic.png', 'file:///images/pic.png']);
            expect(container.querySelector('img').getAttribute('src')).toBe(PNG_FROM_CANVAS);
        });

        test('a text placeholder (<pre>) is copied unchanged', async () => {
            const container = await copied(htmlFence(null, '<pre>&lt;b&gt;raw&lt;/b&gt;</pre><img src="https://example.com/a.png">'));

            expect(container.querySelector('pre').textContent).toBe('<b>raw</b>');
            expect(container.querySelector('img').getAttribute('src')).toBe('https://example.com/a.png');
            expect(imageState.instances).toHaveLength(0);
        });
    });
});
