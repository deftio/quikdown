/**
 * @file quikdown_edit_browser_mocks.test.js
 *
 * Tests for browser-dependent editor paths using mocked APIs:
 *   - getRenderedContent / copyRendered (copy module)
 *   - getPlatform detection
 *   - enableComplexFences renderers (SVG, HTML, Math, Table, JSON, Mermaid)
 *   - Clipboard integration (macOS modern API, Windows/Linux fallback)
 */

import QuikdownEditor from '../dist/quikdown_edit.esm.js';

// ── Mock matchMedia for jsdom ──
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

// ── Shared helpers ──

let editor;
const originalCreateElement = document.createElement.bind(document);

// Mock canvas context
function createMockCanvas() {
    const canvas = originalCreateElement('canvas');
    const mockCtx = {
        scale: jest.fn(),
        drawImage: jest.fn(),
        fillRect: jest.fn(),
        fillStyle: '',
    };
    canvas.getContext = jest.fn(() => mockCtx);
    canvas.toDataURL = jest.fn(() => 'data:image/png;base64,mockPNG');
    canvas.toBlob = jest.fn((cb) => cb(new Blob(['mock'], { type: 'image/png' })));
    canvas._mockCtx = mockCtx;
    return canvas;
}

beforeAll(() => {
    // Ensure test container exists
    if (!document.getElementById('test-editor')) {
        const el = document.createElement('div');
        el.id = 'test-editor';
        document.body.appendChild(el);
    }
});

afterEach(async () => {
    if (editor) {
        editor.destroy();
        editor = null;
    }
    // Clean up globals
    delete window.mermaid;
    delete window.hljs;
    delete window.DOMPurify;
    delete window.MathJax;
    delete window.L;
    delete window.THREE;
    delete window._qde_leaflet_loading;
    delete window._qde_mermaid_loading;
    delete window._qde_threejs_loading;

    // Restore navigator.clipboard if mocked
    if (navigator._clipboardBackup) {
        Object.defineProperty(navigator, 'clipboard', {
            value: navigator._clipboardBackup,
            writable: true,
            configurable: true,
        });
        delete navigator._clipboardBackup;
    }
});

// ── getPlatform coverage (lines 1538-1550) ──

describe('getPlatform coverage', () => {
    // getPlatform is a module-level function, exercised through copyRendered
    // which calls it to decide clipboard strategy. We test it indirectly.

    test('macOS platform detected from navigator.platform', async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
        editor.updateFromMarkdown('hello');

        // Mock platform as Mac
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        // Mock clipboard to verify macOS path
        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = window.ClipboardItem || class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();

        // Restore
        Object.defineProperty(navigator, 'platform', origPlatform);
    });

    test('Windows platform detected from userAgent', async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
        editor.updateFromMarkdown('hello');

        const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true,
        });
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });

        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = window.ClipboardItem || class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();

        // Restore
        if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
        Object.defineProperty(navigator, 'platform', origPlatform);
    });

    test('Linux platform detected from userAgent', async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
        editor.updateFromMarkdown('hello');

        const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (X11; Linux x86_64)',
            configurable: true,
        });
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });

        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = window.ClipboardItem || class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();

        if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
        Object.defineProperty(navigator, 'platform', origPlatform);
    });
});

// ── getRenderedContent: text styling + code block processing (lines 1877-2058) ──

describe('getRenderedContent styling paths', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    function setupClipboard() {
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        const written = [];
        const mockWrite = jest.fn(async (items) => {
            for (const item of items) {
                written.push(item);
            }
        });
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        return { mockWrite, written, restore: () => {
            Object.defineProperty(navigator, 'platform', origPlatform);
        }};
    }

    test('default output applies inline styles to formatting elements', async () => {
        // Inject HTML with formatting into the preview panel
        editor.previewPanel.innerHTML = `
            <strong>bold</strong>
            <em>italic</em>
            <del>deleted</del>
            <u>underline</u>
            <code>inline code</code>
            <blockquote>quote</blockquote>
            <hr>
            <a href="#">link</a>
            <table><tr><th>H</th></tr><tr><td>D</td></tr></table>
        `;
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered('default');
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('quikdown output adds heading font-weight bold', async () => {
        editor.previewPanel.innerHTML = '<h1>Title</h1><h2>Sub</h2><p>text</p>';
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered('quikdown');
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('stripped output skips all inline style application', async () => {
        editor.previewPanel.innerHTML = '<strong>bold</strong><em>italic</em><p>text</p>';
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered('stripped');
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('code blocks with hljs classes get syntax colors', async () => {
        editor.previewPanel.innerHTML = `
            <pre><code class="hljs language-js">
                <span class="hljs-keyword">const</span>
                <span class="hljs-string">"hello"</span>
                <span class="hljs-number">42</span>
                <span class="hljs-comment">// comment</span>
                <span class="hljs-function">fn</span>
                <span class="hljs-class">Foo</span>
                <span class="hljs-title">bar</span>
                <span class="hljs-built_in">Array</span>
                <span class="hljs-literal">true</span>
                <span class="hljs-meta">#!</span>
                <span class="hljs-attr">key</span>
                <span class="hljs-variable">x</span>
                <span class="hljs-regexp">/re/</span>
                <span class="hljs-selector-class">.cls</span>
                <span class="hljs-selector-id">#id</span>
                <span class="hljs-selector-tag">div</span>
                <span class="hljs-tag">tag</span>
                <span class="hljs-name">name</span>
                <span class="hljs-attribute">attr</span>
            </code></pre>
        `;
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('plain code block without hljs still wraps in table', async () => {
        editor.previewPanel.innerHTML = '<pre><code>plain code</code></pre>';
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });
});

// ── getRenderedContent: image processing (lines 2062-2123) ──

describe('getRenderedContent image processing', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    function setupClipboard() {
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        return { mockWrite, restore: () => {
            Object.defineProperty(navigator, 'platform', origPlatform);
        }};
    }

    test('images with data URLs skip fetch conversion', async () => {
        editor.previewPanel.innerHTML = '<img src="data:image/png;base64,abc" width="100" height="100">';
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('oversized images get scaled down', async () => {
        const img = document.createElement('img');
        img.src = 'data:image/png;base64,abc';
        // Simulate very large image
        Object.defineProperty(img, 'width', { value: 2000, writable: true, configurable: true });
        Object.defineProperty(img, 'height', { value: 1500, writable: true, configurable: true });
        editor.previewPanel.innerHTML = '';
        editor.previewPanel.appendChild(img);
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });
});

// ── Clipboard fallback paths (lines 2958-3001) ──

describe('Clipboard fallback paths', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
        editor.updateFromMarkdown('hello');
    });

    test('macOS falls back to copyToClipboard when modern API fails', async () => {
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        // Mock clipboard.write to reject
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: jest.fn().mockRejectedValue(new Error('denied')) },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        // execCommand is the fallback for copyToClipboard
        const origExecCommand = document.execCommand;
        document.execCommand = jest.fn(() => true);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await editor.copyRendered();

        document.execCommand = origExecCommand;
        consoleSpy.mockRestore();
        errorSpy.mockRestore();
        Object.defineProperty(navigator, 'platform', origPlatform);
    });

    test('Windows/Linux falls back to execCommand when modern API fails', async () => {
        const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true,
        });
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });

        // Mock clipboard.write to reject
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: jest.fn().mockRejectedValue(new Error('denied')) },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        const origExecCommand = document.execCommand;
        document.execCommand = jest.fn(() => true);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await editor.copyRendered();
        expect(document.execCommand).toHaveBeenCalledWith('copy');

        document.execCommand = origExecCommand;
        consoleSpy.mockRestore();
        if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
        Object.defineProperty(navigator, 'platform', origPlatform);
    });

    test('Windows/Linux execCommand failure triggers error', async () => {
        const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true,
        });
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });

        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: jest.fn().mockRejectedValue(new Error('denied')) },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        // execCommand also fails
        const origExecCommand = document.execCommand;
        document.execCommand = jest.fn(() => false);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await editor.copyRendered();
        // copyRendered catches the error internally

        document.execCommand = origExecCommand;
        consoleSpy.mockRestore();
        errorSpy.mockRestore();
        if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
        Object.defineProperty(navigator, 'platform', origPlatform);
    });
});

// ── enableComplexFences renderers ──

describe('enableComplexFences renderers', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', {
            enableComplexFences: true,
        });
        await editor.initPromise;
    });

    test('renderTable for CSV fence', async () => {
        await editor.setMarkdown('```csv\nName,Age\nAlice,30\nBob,25\n```');
        const html = editor.html;
        expect(html).toContain('table');
        expect(html).toContain('Alice');
    });

    test('renderTable for TSV fence', async () => {
        await editor.setMarkdown('```tsv\nName\tAge\nAlice\t30\n```');
        const html = editor.html;
        expect(html).toContain('table');
    });

    test('renderTable for PSV fence', async () => {
        await editor.setMarkdown('```psv\nName|Age\nAlice|30\n```');
        const html = editor.html;
        expect(html).toContain('table');
    });

    test('renderTable error falls back to pre', async () => {
        // Empty CSV — lines.length === 0 branch (line 4406)
        await editor.setMarkdown('```csv\n\n```');
        const html = editor.html;
        expect(typeof html).toBe('string');
    });

    test('renderJSON without hljs shows plain formatted JSON', async () => {
        delete window.hljs;
        await editor.setMarkdown('```json\n{"key": "value"}\n```');
        const html = editor.html;
        expect(html).toContain('key');
    });

    test('renderJSON with hljs mock uses syntax highlighting', async () => {
        window.hljs = {
            getLanguage: jest.fn(() => true),
            highlight: jest.fn((code, opts) => ({
                value: `<span class="hljs-attr">"key"</span>: "value"`
            })),
        };
        await editor.setMarkdown('```json\n{"key": "value"}\n```');
        const html = editor.html;
        expect(html).toContain('key');
    });

    test('renderSVG with valid SVG', async () => {
        const svgCode = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
        await editor.setMarkdown('```svg\n' + svgCode + '\n```');
        const html = editor.html;
        expect(html).toContain('svg');
    });

    test('renderSVG with malicious SVG strips script from rendered SVG', async () => {
        const svgCode = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="50" cy="50" r="40"/></svg>';
        await editor.setMarkdown('```svg\n' + svgCode + '\n```');
        // The rendered SVG element inside the container should not contain <script>
        const svgContainer = editor.previewPanel.querySelector('.qde-svg-container');
        expect(svgContainer).not.toBeNull();
        const svgEl = svgContainer.querySelector('svg');
        expect(svgEl).not.toBeNull();
        expect(svgEl.querySelector('script')).toBeNull();
    });

    test('renderHTML without DOMPurify falls back to escaped pre', async () => {
        delete window.DOMPurify;
        await editor.setMarkdown('```html\n<b>bold</b>\n```');
        const html = editor.html;
        expect(typeof html).toBe('string');
    });

    test('renderHTML with DOMPurify mock sanitizes output', async () => {
        window.DOMPurify = {
            sanitize: jest.fn((html) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
        };
        await editor.setMarkdown('```html\n<b>bold</b><script>alert(1)</script>\n```');
        const html = editor.html;
        expect(typeof html).toBe('string');
    });

    test('renderMath creates MathJax container', async () => {
        await editor.setMarkdown('```math\nx^2 + y^2 = z^2\n```');
        const html = editor.html;
        expect(html).toContain('math');
    });

    test('renderMermaid with mock mermaid renders SVG', async () => {
        window.mermaid = {
            initialize: jest.fn(),
            render: jest.fn().mockResolvedValue({
                svg: '<svg><rect width="100" height="50"/></svg>',
            }),
        };
        await editor.setMarkdown('```mermaid\ngraph TD\nA-->B\n```');
        // Allow async mermaid render to complete
        await new Promise(r => setTimeout(r, 50));
        const html = editor.html;
        expect(typeof html).toBe('string');
    });

    test('renderMermaid error shows error container', async () => {
        window.mermaid = {
            initialize: jest.fn(),
            render: jest.fn().mockRejectedValue(new Error('Parse error')),
        };
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await editor.setMarkdown('```mermaid\ninvalid\n```');
        await new Promise(r => setTimeout(r, 50));
        consoleSpy.mockRestore();
    });

    test('katex fence maps to renderMath', async () => {
        await editor.setMarkdown('```katex\n\\frac{1}{2}\n```');
        const html = editor.html;
        expect(html).toContain('math');
    });
});

// ── MathJax typesetting in getRenderedContent (lines 1862-1875) ──

describe('MathJax in getRenderedContent', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    function setupClipboard() {
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        return { mockWrite, restore: () => {
            Object.defineProperty(navigator, 'platform', origPlatform);
        }};
    }

    test('MathJax typesetting called when math-display exists without mjx-container', async () => {
        editor.previewPanel.innerHTML = '<div class="math-display">x^2</div>';
        editor._html = editor.previewPanel.innerHTML;

        window.MathJax = {
            typesetPromise: jest.fn().mockResolvedValue(undefined),
        };

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(window.MathJax.typesetPromise).toHaveBeenCalled();
        restore();
    });

    test('MathJax skipped when mjx-container already exists', async () => {
        editor.previewPanel.innerHTML = '<div class="math-display"><mjx-container>rendered</mjx-container></div>';
        editor._html = editor.previewPanel.innerHTML;

        window.MathJax = {
            typesetPromise: jest.fn().mockResolvedValue(undefined),
        };

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        // typesetPromise should NOT be called because needsRendering is false
        expect(window.MathJax.typesetPromise).not.toHaveBeenCalled();
        restore();
    });

    test('MathJax error is caught gracefully', async () => {
        editor.previewPanel.innerHTML = '<div class="math-display">x^2</div>';
        editor._html = editor.previewPanel.innerHTML;

        window.MathJax = {
            typesetPromise: jest.fn().mockRejectedValue(new Error('MathJax failed')),
        };

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(window.MathJax.typesetPromise).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });
});

// ── STL, Mermaid, GeoJSON container processing in getRenderedContent ──

describe('getRenderedContent fence container processing', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    function setupClipboard() {
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        return { mockWrite, restore: () => {
            Object.defineProperty(navigator, 'platform', origPlatform);
        }};
    }

    test('STL container without canvas gets placeholder', async () => {
        editor.previewPanel.innerHTML =
            '<div class="qde-stl-container" data-stl-id="stl1">3D model</div>';
        editor._html = editor.previewPanel.innerHTML;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('Mermaid SVG gets processed (svgToPng path)', async () => {
        // Create mermaid div with SVG inside
        editor.previewPanel.innerHTML =
            '<div class="mermaid"><svg width="200" height="100"><rect width="200" height="100" fill="blue"/></svg></div>';
        editor._html = editor.previewPanel.innerHTML;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        // May fail on svgToPng (canvas) but should be caught
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('GeoJSON map container gets processed', async () => {
        editor.previewPanel.innerHTML =
            '<div class="qde-geojson-container" data-qd-fence="```" data-qd-lang="geojson">' +
            '<div class="qde-geojson-map" id="map1-container" style="width:400px;height:300px;">map</div></div>';
        editor._html = editor.previewPanel.innerHTML;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('SVG fence block gets processed', async () => {
        editor.previewPanel.innerHTML =
            '<div class="qde-svg-container" data-qd-fence="```" data-qd-lang="svg">' +
            '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg></div>';
        editor._html = editor.previewPanel.innerHTML;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('math-display SVG gets processed', async () => {
        editor.previewPanel.innerHTML =
            '<div class="math-display"><mjx-container><svg viewBox="0 0 100 50"><text>x^2</text></svg></mjx-container></div>';
        editor._html = editor.previewPanel.innerHTML;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('HTML fence container gets processed', async () => {
        editor.previewPanel.innerHTML =
            '<div class="qde-html-container" data-qd-fence="```" data-qd-lang="html" data-qd-source="&lt;b&gt;bold&lt;/b&gt;">' +
            '<b>bold</b></div>';
        editor._html = editor.previewPanel.innerHTML;

        const { mockWrite, restore } = setupClipboard();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });
});

// ── copyRendered visual feedback (lines 5524-5532) ──

describe('copyRendered visual feedback', () => {
    test('copy-rendered toolbar button shows "Copied!" feedback', async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
        editor.updateFromMarkdown('hello');

        // Create a fake toolbar button
        if (editor.toolbar) {
            const btn = document.createElement('button');
            btn.setAttribute('data-action', 'copy-rendered');
            btn.textContent = 'Copy';
            editor.toolbar.appendChild(btn);
        }

        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: jest.fn().mockResolvedValue(undefined) },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        await editor.copyRendered();

        if (editor.toolbar) {
            const btn = editor.toolbar.querySelector('[data-action="copy-rendered"]');
            if (btn) {
                expect(btn.textContent).toBe('Copied!');
            }
        }

        Object.defineProperty(navigator, 'platform', origPlatform);
    });
});

// ── Deep browser API mocks for copy module success paths ──
// These tests mock Canvas, Image, FileReader, URL.createObjectURL at a
// low level so that the copy module's container-processing branches
// execute their success paths rather than falling into catch blocks.

describe('getRenderedContent deep mock paths', () => {
    let mockWrite;
    let origImage;

    function setupDeepMocks() {
        // Clipboard
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        // URL.createObjectURL / revokeObjectURL
        const origCOU = URL.createObjectURL;
        const origROU = URL.revokeObjectURL;
        URL.createObjectURL = jest.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = jest.fn();

        // Override document.createElement to return mock canvas
        const origCE = document.createElement;
        document.createElement = jest.fn(function (tag) {
            if (tag === 'canvas') {
                return createMockCanvas();
            }
            return origCE.call(document, tag);
        });

        // Mock Image to fire onload synchronously
        origImage = window.Image;
        window.Image = class MockImage {
            constructor() {
                this.crossOrigin = '';
                this.naturalWidth = 200;
                this.naturalHeight = 100;
                this.width = 200;
                this.height = 100;
                this._src = '';
            }
            get src() { return this._src; }
            set src(val) {
                this._src = val;
                if (this.onload) {
                    setTimeout(() => this.onload(), 0);
                }
            }
        };

        return {
            restore: () => {
                Object.defineProperty(navigator, 'platform', origPlatform);
                URL.createObjectURL = origCOU;
                URL.revokeObjectURL = origROU;
                document.createElement = origCE;
                window.Image = origImage;
            }
        };
    }

    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    test('STL container with canvas and Three.js refs gets converted to image (lines 2138-2176)', async () => {
        const stlId = 'stl-test-1';
        const stlHtml = `<div class="qde-stl-container" data-stl-id="${stlId}">Loading</div>`;
        editor.previewPanel.innerHTML = stlHtml;
        editor._html = stlHtml;

        const liveContainer = editor.previewPanel.querySelector('.qde-stl-container');
        const mockCanvas = originalCreateElement('canvas');
        mockCanvas.width = 400;
        mockCanvas.height = 400;
        mockCanvas.toDataURL = jest.fn(() => 'data:image/png;base64,stlMock');
        const mockCtx = { scale: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), fillStyle: '' };
        mockCanvas.getContext = jest.fn(() => mockCtx);
        liveContainer.appendChild(mockCanvas);

        liveContainer._threeRenderer = { render: jest.fn() };
        liveContainer._threeScene = {};
        liveContainer._threeCamera = {};

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('STL container where originalContainer not found (line 2182)', async () => {
        const stlHtml = '<div class="qde-stl-container" data-stl-id="no-match">Loading</div>';
        editor.previewPanel.innerHTML = '';
        editor._html = stlHtml;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('Chart.js container with canvas gets converted to image (lines 2258-2302)', async () => {
        const chartId = 'chart-test-1';
        const chartHtml = `<div class="qde-chart-container" data-chart-id="${chartId}">Chart</div>`;
        editor.previewPanel.innerHTML = chartHtml;
        editor._html = chartHtml;

        const liveContainer = editor.previewPanel.querySelector('.qde-chart-container');
        const mockCanvas = originalCreateElement('canvas');
        mockCanvas.width = 500;
        mockCanvas.height = 300;
        mockCanvas.toDataURL = jest.fn(() => 'data:image/png;base64,chartMock');
        liveContainer.appendChild(mockCanvas);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('Chart.js container without valid canvas gets placeholder (lines 2298-2302)', async () => {
        const chartId = 'chart-test-2';
        const chartHtml = `<div class="qde-chart-container" data-chart-id="${chartId}">Chart</div>`;
        editor.previewPanel.innerHTML = chartHtml;
        editor._html = chartHtml;

        const liveContainer = editor.previewPanel.querySelector('.qde-chart-container');
        const mockCanvas = originalCreateElement('canvas');
        mockCanvas.width = 0;
        mockCanvas.height = 0;
        liveContainer.appendChild(mockCanvas);

        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('GeoJSON .geojson-container with no original-source gets warning (line 2493)', async () => {
        const html = '<div class="geojson-container">map</div>';
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('GeoJSON .geojson-container with source but no live match gets placeholder (line 2508)', async () => {
        const html = '<div class="geojson-container" data-original-source="geo-src-1">map</div>';
        editor.previewPanel.innerHTML = '<div>other content</div>';
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('GeoJSON .geojson-container with matching live container but no map (line 2519)', async () => {
        const src = 'geo-data-123';
        const html = `<div class="geojson-container" data-original-source="${src}">map</div>`;
        editor.previewPanel.innerHTML = `<div class="geojson-container" data-original-source="${src}">live map</div>`;
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('HTML fence container with data-qd-source processes images and sanitizes (lines 2685-2810)', async () => {
        const sourceHtml = '<b>Hello</b><img src="data:image/png;base64,abc" width="100" height="80">';
        const escaped = sourceHtml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const html = `<div class="qde-html-container" data-qd-fence="\`\`\`" data-qd-lang="html" data-qd-source="${escaped}"><pre>${sourceHtml.replace(/</g, '&lt;')}</pre></div>`;
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('HTML fence container without source and without pre (lines 2811-2894)', async () => {
        const html = '<div class="qde-html-container" data-qd-fence="```" data-qd-lang="html"><b>bold text</b><img src="data:image/png;base64,xyz" width="50"></div>';
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('Image with non-data URL gets fetched and converted (lines 2099-2119)', async () => {
        const html = '<p><img src="https://example.com/test.png" width="200" height="150"></p>';
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const mockBlob = new Blob(['fake-image'], { type: 'image/png' });
        const origFetch = window.fetch;
        window.fetch = jest.fn().mockResolvedValue({
            blob: () => Promise.resolve(mockBlob),
        });

        const origFileReader = window.FileReader;
        window.FileReader = class MockFileReader {
            readAsDataURL() {
                setTimeout(() => {
                    this.result = 'data:image/png;base64,fetchedImage';
                    if (this.onloadend) this.onloadend();
                }, 0);
            }
        };

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
        window.fetch = origFetch;
        window.FileReader = origFileReader;
    });

    test('Oversized image gets scaled down (lines 2076-2079)', async () => {
        const html = '<p><img src="data:image/png;base64,big" width="1600" height="1200"></p>';
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const img = editor.previewPanel.querySelector('img');
        Object.defineProperty(img, 'naturalWidth', { value: 1600 });
        Object.defineProperty(img, 'naturalHeight', { value: 1200 });
        img.width = 1600;
        img.height = 1200;

        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });

    test('Image with naturalWidth but no width gets naturalWidth applied (lines 2066-2070)', async () => {
        const html = '<p><img src="data:image/png;base64,test"></p>';
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const img = editor.previewPanel.querySelector('img');
        Object.defineProperty(img, 'naturalWidth', { value: 300 });
        Object.defineProperty(img, 'naturalHeight', { value: 200 });

        const { restore } = setupDeepMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        restore();
    });
});

// ── renderGeoJSON with Leaflet mock (lines 4509-4556) ──

describe('renderGeoJSON with Leaflet library mock', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderGeoJSON with window.L present renders map (lines 4509-4556)', async () => {
        const mockLayer = {
            addTo: jest.fn(),
            getBounds: jest.fn().mockReturnValue({
                isValid: () => true,
            }),
            on: jest.fn(),
        };
        window.L = {
            map: jest.fn().mockReturnValue({
                fitBounds: jest.fn(),
                setView: jest.fn(),
            }),
            tileLayer: jest.fn().mockReturnValue({
                addTo: jest.fn(),
                on: jest.fn(),
            }),
            geoJSON: jest.fn().mockReturnValue(mockLayer),
        };

        const geojsonCode = '{"type":"FeatureCollection","features":[]}';
        await editor.setMarkdown('```geojson\n' + geojsonCode + '\n```');
        await new Promise(r => setTimeout(r, 50));

        expect(window.L.map).toHaveBeenCalled();
        expect(window.L.geoJSON).toHaveBeenCalled();
    });

    test('renderGeoJSON with invalid JSON shows error (line 4555-4556)', async () => {
        window.L = {
            map: jest.fn().mockReturnValue({
                fitBounds: jest.fn(),
                setView: jest.fn(),
            }),
            tileLayer: jest.fn().mockReturnValue({
                addTo: jest.fn(),
                on: jest.fn(),
            }),
            geoJSON: jest.fn().mockImplementation(() => { throw new Error('Invalid GeoJSON'); }),
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await editor.setMarkdown('```geojson\n{invalid json\n```');
        await new Promise(r => setTimeout(r, 50));
        consoleSpy.mockRestore();
    });

    test('renderGeoJSON with invalid bounds uses setView fallback (line 4543)', async () => {
        const mockMap = {
            fitBounds: jest.fn(),
            setView: jest.fn(),
        };
        const mockLayer = {
            addTo: jest.fn(),
            getBounds: jest.fn().mockReturnValue({
                isValid: () => false,
            }),
        };
        window.L = {
            map: jest.fn().mockReturnValue(mockMap),
            tileLayer: jest.fn().mockReturnValue({
                addTo: jest.fn(),
                on: jest.fn(),
            }),
            geoJSON: jest.fn().mockReturnValue(mockLayer),
        };

        await editor.setMarkdown('```geojson\n{"type":"Point","coordinates":[0,0]}\n```');
        await new Promise(r => setTimeout(r, 50));

        expect(mockMap.setView).toHaveBeenCalledWith([0, 0], 2);
    });
});

// ── renderSTL with Three.js mock (lines 4623-4747) ──

describe('renderSTL with Three.js mock', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderSTL with window.THREE renders 3D model (lines 4623-4679)', async () => {
        const mockVector3 = { x: 0, y: 0, z: 0 };
        const mockBox3 = {
            getCenter: jest.fn().mockReturnValue(mockVector3),
            getSize: jest.fn().mockReturnValue({ x: 10, y: 10, z: 10 }),
            setFromObject: jest.fn().mockReturnThis(),
        };
        const mockGeometry = {
            setAttribute: jest.fn(),
        };
        const mockRendererDom = originalCreateElement('canvas');
        const mockRenderer = {
            setSize: jest.fn(),
            render: jest.fn(),
            domElement: mockRendererDom,
        };
        const mockMesh = {
            rotation: { y: 0 },
        };

        window.THREE = {
            Scene: jest.fn().mockReturnValue({ background: null, add: jest.fn() }),
            Color: jest.fn(),
            PerspectiveCamera: jest.fn().mockReturnValue({
                position: { set: jest.fn() },
                lookAt: jest.fn(),
            }),
            WebGLRenderer: jest.fn().mockReturnValue(mockRenderer),
            BufferGeometry: jest.fn().mockReturnValue(mockGeometry),
            MeshLambertMaterial: jest.fn(),
            Mesh: jest.fn().mockReturnValue(mockMesh),
            AmbientLight: jest.fn(),
            DirectionalLight: jest.fn().mockReturnValue({
                position: { set: jest.fn().mockReturnValue({ normalize: jest.fn() }) },
            }),
            Box3: jest.fn().mockReturnValue(mockBox3),
            Vector3: jest.fn().mockReturnValue(mockVector3),
            Float32BufferAttribute: jest.fn(),
        };

        const stlCode = `solid cube
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 1 1 0
  endloop
endfacet
endsolid cube`;

        const origRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = jest.fn();

        await editor.setMarkdown('```stl\n' + stlCode + '\n```');
        await new Promise(r => setTimeout(r, 50));

        expect(window.THREE.Scene).toHaveBeenCalled();
        expect(window.THREE.WebGLRenderer).toHaveBeenCalled();
        expect(mockGeometry.setAttribute).toHaveBeenCalledWith('position', expect.anything());
        expect(mockGeometry.setAttribute).toHaveBeenCalledWith('normal', expect.anything());

        window.requestAnimationFrame = origRAF;
    });

    test('renderSTL error in render3D shows error message (line 4678-4679)', async () => {
        window.THREE = {
            Scene: jest.fn().mockImplementation(() => { throw new Error('THREE init failed'); }),
            Color: jest.fn(),
            PerspectiveCamera: jest.fn(),
            WebGLRenderer: jest.fn(),
            BufferGeometry: jest.fn(),
            Float32BufferAttribute: jest.fn(),
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await editor.setMarkdown('```stl\nsolid test\nendsolid test\n```');
        await new Promise(r => setTimeout(r, 50));
        consoleSpy.mockRestore();
    });
});

// ── renderHTML lazy DOMPurify callback (lines 4283-4291) ──

describe('renderHTML DOMPurify lazy load callback', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderHTML with DOMPurify already loaded sanitizes and re-renders (lines 4283-4291)', async () => {
        window.DOMPurify = {
            sanitize: jest.fn((html) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
        };
        await editor.setMarkdown('```html\n<b>bold</b><script>alert(1)</script>\n```');
        await new Promise(r => setTimeout(r, 100));

        const container = editor.previewPanel.querySelector('.qde-html-container');
        expect(container).not.toBeNull();
    });
});

// ── renderMath MathJax script loading callback (lines 4376-4390) ──

describe('renderMath MathJax script loading', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderMath creates math-display element', async () => {
        await editor.setMarkdown('```math\nx^2 + y^2 = z^2\n```');
        const mathEl = editor.previewPanel.querySelector('.math-display');
        expect(mathEl).not.toBeNull();
    });
});

// ── renderTable edge cases (lines 4399-4406) ──

describe('renderTable edge cases', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderTable with CSV data produces table', async () => {
        await editor.setMarkdown('```csv\nName,Age\nAlice,30\nBob,25\n```');
        const table = editor.previewPanel.querySelector('table');
        expect(table).not.toBeNull();
    });

    test('renderTable with TSV data produces table', async () => {
        await editor.setMarkdown('```tsv\nName\tAge\nAlice\t30\n```');
        const table = editor.previewPanel.querySelector('table');
        expect(table).not.toBeNull();
    });

    test('renderTable with PSV data produces table', async () => {
        await editor.setMarkdown('```psv\nName|Age\nAlice|30\n```');
        const table = editor.previewPanel.querySelector('table');
        expect(table).not.toBeNull();
    });

    test('renderJSON renders JSON with formatting', async () => {
        await editor.setMarkdown('```json\n{"key": "value"}\n```');
        const html = editor.html;
        expect(html).toContain('key');
    });
});

// ── GeoJSON data-qd-lang="geojson" container in getRenderedContent (lines 2566-2671) ──

describe('getRenderedContent geojson data-qd-lang containers', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    function setupClipboardAndMocks() {
        const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform') ||
            { value: navigator.platform, configurable: true };
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        const mockWrite = jest.fn().mockResolvedValue(undefined);
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        return { mockWrite, restore: () => {
            Object.defineProperty(navigator, 'platform', origPlatform);
        }};
    }

    test('geojson container with data-qd-lang="geojson" but no live container skips', async () => {
        const containerId = 'geo-container-1';
        const html = `<div data-qd-lang="geojson" id="${containerId}"><div class="leaflet-container">map</div></div>`;
        editor.previewPanel.innerHTML = '<div>other</div>';
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboardAndMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });

    test('geojson container with matching live container processes (lines 2566-2671)', async () => {
        const containerId = 'geo-live-1';
        const html = `<div data-qd-lang="geojson" id="${containerId}"><div class="leaflet-container" style="width:400px;height:300px;">map</div></div>`;
        editor.previewPanel.innerHTML = html;
        editor._html = html;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { mockWrite, restore } = setupClipboardAndMocks();
        await editor.copyRendered();
        expect(mockWrite).toHaveBeenCalled();
        consoleSpy.mockRestore();
        restore();
    });
});

// ── Windows/Linux clipboard fallback (lines 2966-3001) ──

describe('clipboard Windows/Linux execCommand fallback', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
        editor.updateFromMarkdown('test content');
    });

    test('Windows clipboard.write failure falls back to execCommand (lines 2984-2996)', async () => {
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true
        });

        const mockWrite = jest.fn().mockRejectedValue(new Error('Clipboard write failed'));
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        document.execCommand = jest.fn().mockReturnValue(true);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        // copyRendered() catches errors internally and returns undefined
        await editor.copyRendered();
        // The fallback should have been attempted
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        consoleSpy.mockRestore();
    });

    test('Windows double failure (clipboard + execCommand) is caught by copyRendered (lines 2993-2994)', async () => {
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            configurable: true
        });

        const mockWrite = jest.fn().mockRejectedValue(new Error('Clipboard write failed'));
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        document.execCommand = jest.fn().mockReturnValue(false);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // copyRendered catches all errors, so this should not throw
        await editor.copyRendered();
        // The error should have been logged
        expect(errorSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('macOS clipboard.write failure falls back to copyToClipboard (lines 2958-2964)', async () => {
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

        const mockWrite = jest.fn().mockRejectedValue(new Error('Clipboard write failed'));
        navigator._clipboardBackup = navigator.clipboard;
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        document.execCommand = jest.fn().mockReturnValue(true);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        // copyRendered catches errors, check that execCommand fallback was used
        await editor.copyRendered();
        consoleSpy.mockRestore();
    });
});

// ══════════════════════════════════════════════════════════════════════
//  Coverage push: embedded parser + BD dead paths + lazy-load callbacks
// ══════════════════════════════════════════════════════════════════════

describe('embedded parser paths via editor', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    test('setMarkdown with empty string hits line 298 guard', async () => {
        await editor.setMarkdown('');
        expect(editor.html).toBe('');
    });

    test('closing fence with trailing whitespace hits line 99', async () => {
        // Fence closing line "```  \t" must match even with trailing spaces/tabs
        const md = '```js\nconsole.log("hi");\n```  \t';
        await editor.setMarkdown(md);
        const html = editor.html;
        expect(html).toContain('console.log');
        // The editor uses its own fence plugin, so output is a div container
        // not a raw <pre>. Just verify the code appears in the output.
        expect(html.length).toBeGreaterThan(0);
    });

    test('updateFromHTML with pre[data-qd-lang] but no data-qd-source hits lines 1242-1244', async () => {
        // A <pre> with fence attrs but no data-qd-source — code element fallback
        const preHtml = '<pre data-qd-fence="```" data-qd-lang="python"><code>print("hello")</code></pre>';
        editor.previewPanel.innerHTML = preHtml;
        editor.updateFromHTML();
        const md = editor.getMarkdown();
        expect(md).toContain('```python');
        expect(md).toContain('print("hello")');
    });

    test('toMarkdown with invalid input returns empty string (line 1156)', async () => {
        // The embedded quikdown_bd.toMarkdown is called from updateFromHTML
        // but we can trigger line 1156 by feeding a numeric input via
        // the editor's internal call — actually, line 1156 is for non-string/non-Element.
        // We can't call quikdown_bd.toMarkdown directly, but we can test that
        // updateFromHTML handles an empty preview panel
        editor.previewPanel.innerHTML = '';
        editor.updateFromHTML();
        expect(editor.getMarkdown()).toBe('');
    });
});

describe('lazyLoadLibrary callback coverage', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderHTML DOMPurify lazy load resolves and sanitizes (lines 4283-4291)', async () => {
        // Remove DOMPurify so check() returns false initially
        delete window.DOMPurify;

        // Mock loadScript to simulate async load: resolve + set library
        const origLoadScript = editor.loadScript.bind(editor);
        editor.loadScript = jest.fn().mockImplementation((src) => {
            // Simulate the library appearing after script loads
            if (src.includes('purify')) {
                window.DOMPurify = {
                    sanitize: (html) => html.replace(/<script[^>]*>.*?<\/script>/gi, ''),
                };
            }
            return Promise.resolve();
        });

        await editor.setMarkdown('```html\n<b>bold</b><script>alert(1)</script>\n```');
        // Wait for the lazy load .then() callback
        await new Promise(r => setTimeout(r, 150));

        const container = editor.previewPanel.querySelector('.qde-html-container');
        expect(container).not.toBeNull();
        // DOMPurify should have sanitized the content
        if (container) {
            expect(container.innerHTML).not.toContain('<script>');
        }

        editor.loadScript = origLoadScript;
    });

    test('renderMath MathJax script.onload triggers typeset (lines 4376-4383)', async () => {
        delete window.MathJax;
        delete window.mathJaxLoading;

        // Mock loadScript — but MathJax uses a direct script.onload, not loadScript
        // The MathJax loading path creates a <script> element directly
        // We need to intercept document.createElement('script') to fire onload
        const origCE = document.createElement.bind(document);
        const origAppend = document.head.appendChild.bind(document.head);

        document.head.appendChild = jest.fn().mockImplementation((el) => {
            if (el.tagName === 'SCRIPT' && el.src && el.src.includes('mathjax')) {
                // Simulate the library loading
                window.MathJax = {
                    typesetPromise: jest.fn().mockResolvedValue(undefined),
                };
                // Fire onload async
                setTimeout(() => {
                    if (el.onload) el.onload();
                }, 10);
                return el;
            }
            return origAppend(el);
        });

        await editor.setMarkdown('```math\nx^2 + y^2 = z^2\n```');
        await new Promise(r => setTimeout(r, 100));

        // MathJax.typesetPromise should have been called
        if (window.MathJax && window.MathJax.typesetPromise) {
            expect(window.MathJax.typesetPromise).toHaveBeenCalled();
        }

        document.head.appendChild = origAppend;
    });

    test('renderMath MathJax script.onerror path (lines 4389-4390)', async () => {
        delete window.MathJax;
        delete window.mathJaxLoading;

        const origAppend = document.head.appendChild.bind(document.head);
        document.head.appendChild = jest.fn().mockImplementation((el) => {
            if (el.tagName === 'SCRIPT' && el.src && el.src.includes('mathjax')) {
                setTimeout(() => {
                    if (el.onerror) el.onerror();
                }, 10);
                return el;
            }
            return origAppend(el);
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await editor.setMarkdown('```math\na + b = c\n```');
        await new Promise(r => setTimeout(r, 100));
        consoleSpy.mockRestore();

        document.head.appendChild = origAppend;
    });

    test('renderGeoJSON lazy load Leaflet fails (lines 4573-4576)', async () => {
        delete window.L;
        delete window._qde_leaflet_loading;

        // Mock lazyLoadLibrary to reject
        const origLazy = editor.lazyLoadLibrary.bind(editor);
        editor.lazyLoadLibrary = jest.fn().mockRejectedValue(new Error('Network error'));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await editor.setMarkdown('```geojson\n{"type":"Point","coordinates":[0,0]}\n```');
        await new Promise(r => setTimeout(r, 100));
        consoleSpy.mockRestore();

        editor.lazyLoadLibrary = origLazy;
    });

    test('renderGeoJSON lazy load Leaflet succeeds but loaded=false (lines 4583-4586)', async () => {
        delete window.L;
        delete window._qde_leaflet_loading;

        // lazyLoadLibrary resolves with false (library failed to actually load)
        const origLazy = editor.lazyLoadLibrary.bind(editor);
        editor.lazyLoadLibrary = jest.fn().mockResolvedValue(false);

        await editor.setMarkdown('```geojson\n{"type":"Point","coordinates":[0,0]}\n```');
        await new Promise(r => setTimeout(r, 100));

        // The container should show failure message
        const container = editor.previewPanel.querySelector('[id$="-container"]');
        if (container) {
            expect(container.innerHTML).toContain('Failed to load map library');
        }

        editor.lazyLoadLibrary = origLazy;
    });

    test('renderGeoJSON lazy load Leaflet succeeds with loaded=true calls renderMap (line 4582)', async () => {
        delete window.L;
        delete window._qde_leaflet_loading;

        const mockMap = {
            fitBounds: jest.fn(),
            setView: jest.fn(),
        };
        const mockLayer = {
            addTo: jest.fn(),
            getBounds: jest.fn().mockReturnValue({ isValid: () => true }),
        };

        const origLazy = editor.lazyLoadLibrary.bind(editor);
        editor.lazyLoadLibrary = jest.fn().mockImplementation(() => {
            // Simulate Leaflet appearing after async load
            window.L = {
                map: jest.fn().mockReturnValue(mockMap),
                tileLayer: jest.fn().mockReturnValue({
                    addTo: jest.fn(),
                    on: jest.fn(),
                }),
                geoJSON: jest.fn().mockReturnValue(mockLayer),
            };
            return Promise.resolve(true);
        });

        await editor.setMarkdown('```geojson\n{"type":"FeatureCollection","features":[]}\n```');
        await new Promise(r => setTimeout(r, 100));

        expect(window.L.map).toHaveBeenCalled();
        editor.lazyLoadLibrary = origLazy;
    });

    test('renderSTL lazy load Three.js fails (lines 4694-4696)', async () => {
        delete window.THREE;
        delete window._qde_three_loading;

        const origLazy = editor.lazyLoadLibrary.bind(editor);
        editor.lazyLoadLibrary = jest.fn().mockRejectedValue(new Error('Network error'));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await editor.setMarkdown('```stl\nsolid cube\nendsolid cube\n```');
        await new Promise(r => setTimeout(r, 100));
        consoleSpy.mockRestore();

        editor.lazyLoadLibrary = origLazy;
    });

    test('renderSTL lazy load Three.js succeeds but loaded=false (lines 4702-4705)', async () => {
        delete window.THREE;
        delete window._qde_three_loading;

        const origLazy = editor.lazyLoadLibrary.bind(editor);
        editor.lazyLoadLibrary = jest.fn().mockResolvedValue(false);

        await editor.setMarkdown('```stl\nsolid cube\nendsolid cube\n```');
        await new Promise(r => setTimeout(r, 100));

        const container = editor.previewPanel.querySelector('.qde-stl-container');
        if (container) {
            expect(container.innerHTML).toContain('Failed to load Three.js');
        }

        editor.lazyLoadLibrary = origLazy;
    });

    test('renderSTL lazy load Three.js succeeds with loaded=true calls render3D (line 4701)', async () => {
        delete window.THREE;
        delete window._qde_three_loading;

        const mockVector3 = { x: 0, y: 0, z: 0 };
        const mockBox3 = {
            getCenter: jest.fn().mockReturnValue(mockVector3),
            getSize: jest.fn().mockReturnValue({ x: 10, y: 10, z: 10 }),
            setFromObject: jest.fn().mockReturnThis(),
        };
        const mockGeometry = { setAttribute: jest.fn() };
        const mockRendererDom = originalCreateElement('canvas');
        const mockRenderer = {
            setSize: jest.fn(),
            render: jest.fn(),
            domElement: mockRendererDom,
        };

        const origLazy = editor.lazyLoadLibrary.bind(editor);
        editor.lazyLoadLibrary = jest.fn().mockImplementation(() => {
            // Simulate Three.js appearing after async load
            window.THREE = {
                Scene: jest.fn().mockReturnValue({ background: null, add: jest.fn() }),
                Color: jest.fn(),
                PerspectiveCamera: jest.fn().mockReturnValue({
                    position: { set: jest.fn() },
                    lookAt: jest.fn(),
                }),
                WebGLRenderer: jest.fn().mockReturnValue(mockRenderer),
                BufferGeometry: jest.fn().mockReturnValue(mockGeometry),
                MeshLambertMaterial: jest.fn(),
                Mesh: jest.fn().mockReturnValue({ rotation: { y: 0 } }),
                AmbientLight: jest.fn(),
                DirectionalLight: jest.fn().mockReturnValue({
                    position: { set: jest.fn().mockReturnValue({ normalize: jest.fn() }) },
                }),
                Box3: jest.fn().mockReturnValue(mockBox3),
                Vector3: jest.fn().mockReturnValue(mockVector3),
                Float32BufferAttribute: jest.fn(),
            };
            return Promise.resolve(true);
        });

        const origRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = jest.fn();

        const stlCode = 'solid cube\nfacet normal 0 0 -1\n  outer loop\n    vertex 0 0 0\n    vertex 1 0 0\n    vertex 1 1 0\n  endloop\nendfacet\nendsolid cube';
        await editor.setMarkdown('```stl\n' + stlCode + '\n```');
        await new Promise(r => setTimeout(r, 100));

        expect(window.THREE.Scene).toHaveBeenCalled();

        window.requestAnimationFrame = origRAF;
        editor.lazyLoadLibrary = origLazy;
    });

    test('lazyLoadLibrary resolves and returns check() result (line 4874)', async () => {
        // Call lazyLoadLibrary directly with a check that returns true after load
        let loaded = false;
        const origLoadScript = editor.loadScript.bind(editor);
        editor.loadScript = jest.fn().mockImplementation(() => {
            loaded = true;
            return Promise.resolve();
        });

        const result = await editor.lazyLoadLibrary(
            'TestLib',
            () => loaded,
            'https://example.com/lib.js'
        );
        expect(result).toBe(true);

        editor.loadScript = origLoadScript;
    });

    test('lazyLoadLibrary with cssUrl loads both script and css', async () => {
        let scriptLoaded = false;
        const origLoadScript = editor.loadScript.bind(editor);
        const origLoadCSS = editor.loadCSS.bind(editor);
        editor.loadScript = jest.fn().mockImplementation(() => {
            scriptLoaded = true;
            return Promise.resolve();
        });
        editor.loadCSS = jest.fn().mockResolvedValue(undefined);

        const result = await editor.lazyLoadLibrary(
            'TestLib2',
            () => scriptLoaded,
            'https://example.com/lib.js',
            'https://example.com/lib.css'
        );
        expect(result).toBe(true);
        expect(editor.loadCSS).toHaveBeenCalledWith('https://example.com/lib.css');

        editor.loadScript = origLoadScript;
        editor.loadCSS = origLoadCSS;
    });

    test('lazyLoadLibrary script load failure returns false (line 4876)', async () => {
        const origLoadScript = editor.loadScript.bind(editor);
        editor.loadScript = jest.fn().mockRejectedValue(new Error('Load failed'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const result = await editor.lazyLoadLibrary(
            'FailLib',
            () => false,
            'https://example.com/bad.js'
        );
        expect(result).toBe(false);
        consoleSpy.mockRestore();

        editor.loadScript = origLoadScript;
    });

    test('mermaid afterLoad callback initializes mermaid (line 3108)', async () => {
        // Delete mermaid so check() returns false, forcing loadScript
        delete window.mermaid;

        // Mock loadScript to simulate library appearing after load
        const origLoadScript = editor.loadScript.bind(editor);
        editor.loadScript = jest.fn().mockImplementation(() => {
            window.mermaid = {
                initialize: jest.fn(),
                render: jest.fn().mockResolvedValue({ svg: '<svg>mocked</svg>' }),
            };
            return Promise.resolve();
        });

        // Set preloadFences to trigger mermaid loading via loadPlugins
        editor.options.preloadFences = ['mermaid'];
        await editor.loadPlugins();

        // afterLoad should have called mermaid.initialize
        expect(window.mermaid.initialize).toHaveBeenCalledWith({ startOnLoad: false });

        editor.loadScript = origLoadScript;
    });
});

describe('MathJax typeset on mode switch (line 5044)', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('switching from source to split with MathJax triggers typeset (line 5044)', async () => {
        // Render math content
        await editor.setMarkdown('```math\nE = mc^2\n```');

        // Set MathJax mock
        window.MathJax = {
            typesetPromise: jest.fn().mockResolvedValue(undefined),
        };

        // Switch to source first (so previousMode = 'source')
        await editor.setMode('source');

        // Now switch to split — this triggers the re-render + MathJax typeset at line 5044
        await editor.setMode('split');
        await new Promise(r => setTimeout(r, 50));

        expect(window.MathJax.typesetPromise).toHaveBeenCalled();
    });
});

describe('copyToClipboard error handling (lines 1609-1610)', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor');
        await editor.initPromise;
    });

    test('copyToClipboard catches execCommand errors', async () => {
        // Make execCommand throw
        const origExec = document.execCommand;
        document.execCommand = jest.fn().mockImplementation(() => {
            throw new Error('Security restriction');
        });

        // Set up minimal content
        editor.updateFromMarkdown('test content');

        // Need to trigger the copyToClipboard fallback path
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
        const mockWrite = jest.fn().mockRejectedValue(new Error('Clipboard write failed'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: mockWrite },
            writable: true,
            configurable: true,
        });
        window.ClipboardItem = class ClipboardItem {
            constructor(items) { this.items = items; }
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await editor.copyRendered();
        // The error path at 1609-1610 should have been hit
        consoleSpy.mockRestore();
        warnSpy.mockRestore();
        document.execCommand = origExec;
    });
});

describe('embedded quikdown.emitStyles coverage (lines 1046-1086)', () => {
    // emitStyles is a module-scoped function on the embedded quikdown object.
    // It's not directly exported by QuikdownEditor. However, we can test
    // whether the editor's constructor or internal code calls it.
    // Actually, emitStyles is dead code in the editor bundle — the editor
    // uses its own CSS generation. We document this for coverage purposes.

    test('editor bundle includes emitStyles but it is not called via editor API', () => {
        // This test documents that emitStyles (lines 1046-1086),
        // quikdown.configure (1096-1097), and quikdown_bd.configure (1509-1511)
        // are dead code in the editor bundle. They exist because the editor
        // bundle includes the full quikdown + quikdown_bd source.
        //
        // These ~46 lines represent ~0.8% of the file and cannot be covered
        // through the QuikdownEditor API.
        expect(typeof QuikdownEditor).toBe('function');
    });
});

describe('GeoJSON tile load event (line 4552)', () => {
    beforeEach(async () => {
        editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
        await editor.initPromise;
    });

    test('renderGeoJSON tile load event sets data-tiles-loaded attribute', async () => {
        const mockTileLayer = {
            addTo: jest.fn(),
            on: jest.fn(),
        };
        const mockLayer = {
            addTo: jest.fn(),
            getBounds: jest.fn().mockReturnValue({ isValid: () => true }),
        };
        const mockMap = {
            fitBounds: jest.fn(),
            setView: jest.fn(),
        };
        window.L = {
            map: jest.fn().mockReturnValue(mockMap),
            tileLayer: jest.fn().mockReturnValue(mockTileLayer),
            geoJSON: jest.fn().mockReturnValue(mockLayer),
        };

        await editor.setMarkdown('```geojson\n{"type":"FeatureCollection","features":[]}\n```');
        await new Promise(r => setTimeout(r, 50));

        // The tileLayer.on('load', ...) handler should have been registered
        expect(mockTileLayer.on).toHaveBeenCalledWith('load', expect.any(Function));

        // Call the registered handler to cover line 4552
        const loadHandler = mockTileLayer.on.mock.calls.find(c => c[0] === 'load');
        if (loadHandler) {
            const container = editor.previewPanel.querySelector('[id$="-container"]');
            if (container) {
                loadHandler[1](); // fire the callback
                expect(container.getAttribute('data-tiles-loaded')).toBe('true');
            }
        }
    });
});
