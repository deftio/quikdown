/**
 * Quikdown Editor - A drop-in markdown editor control
 * @license BSD-2-Clause
 */

import quikdown_bd from './quikdown_bd.js';

/** Build-time version stamp (injected by rollup replaceVersion plugin) */
const quikdownEditorVersion = '__QUIKDOWN_VERSION__';
import { getRenderedContent } from './quikdown_edit_copy.js';
import { isHRLine, fenceOpen, isFenceClose, classifyLine, looksLikeTableRow } from './quikdown_classify.js';
import { formatMarkdown, getFormatState, mapOffset, skipBlockPrefix, FORMAT_COMMANDS } from './quikdown_edit_format.js';

// Private-use characters that mark a selection's two ends while it is
// carried between the rendered pane and the markdown source.
const MARK_START = '\uE000';
const MARK_END = '\uE001';
const MARKS_RE = /[\uE000\uE001]/g;

/**
 * Curated safe HTML tag whitelist.
 * Pass to quikdown's `allow_unsafe_html` option to allow these tags
 * through while escaping everything else.  Callers can use this as-is,
 * pass a subset, or build their own object — any object whose keys are
 * lowercase tag names works.
 *
 * @example
 *   // Use the curated list
 *   quikdown(md, { allow_unsafe_html: QuikdownEditor.SAFE_HTML_TAGS });
 *
 *   // Or a minimal subset
 *   quikdown(md, { allow_unsafe_html: { img: 1, a: 1, br: 1 } });
 *
 *   // Or an array (converted internally)
 *   quikdown(md, { allow_unsafe_html: ['img', 'a', 'br'] });
 */
const SAFE_HTML_TAGS = {
    b:1, i:1, em:1, strong:1, del:1, s:1, u:1, mark:1, sup:1, sub:1,
    kbd:1, abbr:1, var:1, samp:1, cite:1, small:1, ins:1, dfn:1,
    ruby:1, rt:1, rp:1, time:1, wbr:1,
    img:1, picture:1, source:1, video:1, audio:1, figure:1, figcaption:1,
    a:1, br:1, hr:1,
    div:1, span:1, p:1, details:1, summary:1,
    section:1, article:1, aside:1, header:1, footer:1, nav:1, main:1,
    table:1, thead:1, tbody:1, tfoot:1, tr:1, th:1, td:1, caption:1, col:1, colgroup:1,
    ul:1, ol:1, li:1, dl:1, dt:1, dd:1,
    h1:1, h2:1, h3:1, h4:1, h5:1, h6:1,
    blockquote:1, pre:1, code:1
};

// Default options
const DEFAULT_OPTIONS = {
    mode: 'split',          // 'source' | 'preview' | 'split'
    showToolbar: true,
    showRemoveHR: false,    // Show button to remove horizontal rules (---)
    showLazyLinefeeds: false, // Show button to convert lazy linefeeds
    theme: 'auto',          // 'light' | 'dark' | 'auto'
    lazy_linefeeds: false,
    inline_styles: false,   // Use CSS classes (false) or inline styles (true)
    debounceDelay: 20,      // Reduced from 100ms for better responsiveness
    placeholder: 'Start typing markdown...',
    plugins: {
        highlightjs: false,
        mermaid: false
    },
    /**
     * Preload fence-rendering libraries at construction time so the FIRST
     * encounter with a fence type renders instantly (no lazy load delay).
     *
     * Accepts:
     *   - 'all'                                — preload every known library
     *   - ['highlightjs','mermaid','math',
     *      'geojson','stl']                    — preload specific libraries
     *   - [{ name: 'mylib', script: 'https://...', css: '...' }]
     *                                          — preload an arbitrary library
     *
     * Without this, fence libraries are loaded on demand the first time their
     * fence type is encountered. That keeps the editor lightweight, but the
     * first SVG/Mermaid/Math/GeoJSON/STL fence will show "loading..." for a
     * moment. Set `preloadFences` if you want zero-delay rendering — at the
     * cost of a few hundred KB of upfront network.
     *
     * Developer's choice. `preloadFences` only affects the OPTIONAL fence
     * renderers, not the size of the editor bundle itself.
     */
    preloadFences: null,
    customFences: {}, // { 'language': (code, lang) => html }
    enableComplexFences: true, // Enable CSV tables, math rendering, SVG, etc.
    showUndoRedo: false,      // Show undo/redo toolbar buttons
    undoStackSize: 100,       // Maximum number of undo states to keep
    allowUnsafeHTML: false,   // false | 'limited' | true — controls HTML passthrough
    showAllowUnsafeHTML: false, // Show toolbar button to cycle HTML mode
    allowExternalFetch: true, // Allow fence renderers to fetch external resources (CDN, tiles, etc.)
    reference_links: false,   // Enable reference-style links [text][id]
    footnotes: false,         // Enable footnotes [^id]
    shortcuts: true,          // Keyboard shortcuts (mode, undo/redo, bold, italic, list indent)
    mount: 'replace',         // 'replace' — take over the container; 'append' — add the editor as a child
    syncScroll: false,        // Keep the two panes at the same relative scroll position in split mode
    resolveImageSrc: null,    // (src, { alt, title }) => string — rewrite image URLs for display only
    onRender: null,           // (previewElement) => void — after every preview render
    onSelectionChange: null,  // ({ start, end, text, pane, format }) => void
    onLinkClick: null,        // (href, event) => void|true — return true to let the browser follow the link
    assetBase: null           // Directory URL for the standalone build's runtime assets (basemap *.topojson)
};

// MathJax reads its configuration from window.MathJax when its script runs,
// so the config object is put there before loading. If the load fails, the
// object must be removed again: it would otherwise look like a loaded library
// and no later render would retry.
let pendingMathJaxConfig = null;
const MATHJAX_RETRY_MS = 5000;

function configureMathJax() {
    if (!window.MathJax) {
        pendingMathJaxConfig = window.MathJax = {
            loader: { load: ['input/tex', 'output/svg'] },
            tex: {
                packages: { '[+]': ['ams'] },
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true,
                processEnvironments: true
            },
            options: {
                renderActions: { addMenu: [] },
                ignoreHtmlClass: 'tex2jax_ignore',
                processHtmlClass: 'tex2jax_process'
            },
            svg: {
                fontCache: 'none'  // self-contained SVGs (required for copy-rendered)
            },
            startup: { typeset: false }
        };
    }
}

function clearFailedMathJax() {
    if (window.MathJax && window.MathJax === pendingMathJaxConfig && !window.MathJax.version) {
        delete window.MathJax;
    }
    pendingMathJaxConfig = null;
    window._qde_mathjax_failed = Date.now();
}

// Script loads in flight, by URL, so two callers asking for the same library
// at the same time share one <script> element.
const scriptLoads = new Map();

// Library catalog used by preloadFences. Each entry knows how to:
//   - check if the library is already on the page (so we don't double-load)
//   - load it via script (and optional CSS)
const FENCE_LIBRARIES = {
    highlightjs: {
        check: () => typeof window.hljs !== 'undefined',
        script: 'https://unpkg.com/@highlightjs/cdn-assets/highlight.min.js',
        css: 'https://unpkg.com/@highlightjs/cdn-assets/styles/github.min.css',
        cssDark: 'https://unpkg.com/@highlightjs/cdn-assets/styles/github-dark.min.css'
    },
    mermaid: {
        check: () => typeof window.mermaid !== 'undefined',
        script: 'https://unpkg.com/mermaid/dist/mermaid.min.js',
        afterLoad: () => {
            if (window.mermaid) window.mermaid.initialize({ startOnLoad: false });
        }
    },
    math: {
        check: () => typeof window.MathJax !== 'undefined',
        script: 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js',
        beforeLoad: configureMathJax,
        onError: clearFailedMathJax
    },
    geojson: {
        check: () => typeof window.L !== 'undefined',
        script: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    },
    stl: {
        check: () => typeof window.THREE !== 'undefined',
        script: 'https://unpkg.com/three@0.147.0/build/three.min.js'
    },
    abc: {
        check: () => typeof window.ABCJS !== 'undefined',
        script: 'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js'
    },
    music: {
        check: () => typeof window.ABCJS !== 'undefined',
        script: 'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js'
    },
    vega: {
        check: () => typeof window.vegaEmbed !== 'undefined',
        scripts: [
            'https://cdn.jsdelivr.net/npm/vega@5',
            'https://cdn.jsdelivr.net/npm/vega-lite@5',
            'https://cdn.jsdelivr.net/npm/vega-embed@6'
        ]
    }
};

/**
 * Quikdown Editor - A complete markdown editing solution
 */
class QuikdownEditor {
    constructor(container, options = {}) {
        // Resolve container
        const host = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!host) {
            throw new Error('QuikdownEditor: Invalid container');
        }

        // Merge options. Nested defaults are copied so that no two editors
        // (and no editor and the defaults) ever share a mutable object.
        this.options = { ...DEFAULT_OPTIONS, ...options };
        if (!options.plugins) this.options.plugins = { ...DEFAULT_OPTIONS.plugins };
        if (!options.customFences) this.options.customFences = {};

        // `host` is the element the caller passed in. `container` is the
        // editor's own root: the host itself (mount: 'replace') or a child
        // the editor adds and later removes (mount: 'append').
        this.host = host;
        if (this.options.mount === 'append') {
            this.container = document.createElement('div');
            host.appendChild(this.container);
        } else {
            this.container = host;
        }

        // State — everything below belongs to this instance only
        this._markdown = '';
        this._html = '';
        this.currentMode = ['source', 'split', 'preview'].includes(this.options.mode) ? this.options.mode : 'split';
        this.updateTimer = null;
        this._pending = null;        // pane ('source' | 'preview') with a debounced update waiting
        this._destroyed = false;
        this._listeners = [];        // [target, type, handler] for removal in destroy()
        this._timers = new Set();    // UI feedback timers, cleared in destroy()
        this._lastPane = null;       // pane the user last worked in
        this._savedRange = null;     // last selection range seen inside the preview
        this._previewFresh = false;  // preview DOM is an untouched render of _markdown
        this._blocks = null;         // cached preview block → source line map
        this._lastSelKey = '';
        this._scrollLock = null;

        // Undo/redo state
        this._undoStack = [];
        this._redoStack = [];
        this._isUndoRedo = false;

        // Instance-level copy of fence libraries so custom entries
        // don't leak across editor instances.
        this._fenceLibraries = { ...FENCE_LIBRARIES };
        
        // Initialize
        this.initPromise = this.init();
    }
    
    /**
     * Initialize the editor
     */
    async init() {
        // Load plugins if requested
        await this.loadPlugins();

        // destroy() may have been called while libraries were loading
        if (this._destroyed) return;

        // Build UI
        this.buildUI();
        
        // Attach event listeners
        this.attachEvents();
        
        // Apply initial theme
        this.applyTheme();
        
        // Set initial mode
        this.setMode(this.currentMode);
        
        // Set initial content if provided
        if (this.options.initialContent) {
            this._load(this.options.initialContent, 'api');
        }
    }

    /**
     * Add an event listener that destroy() will remove.
     * @private
     */
    _on(target, type, handler) {
        target.addEventListener(type, handler);
        this._listeners.push([target, type, handler]);
    }

    /**
     * setTimeout that is cancelled by destroy().
     * @private
     */
    _later(fn, ms) {
        const id = setTimeout(() => {
            this._timers.delete(id);
            fn();
        }, ms);
        this._timers.add(id);
        return id;
    }
    
    /**
     * Build the editor UI
     */
    buildUI() {
        // Clear container (in 'append' mode it is our own, empty element)
        this.container.innerHTML = '';

        // Add editor class
        this.container.classList.add('qde-container');
        
        // Create toolbar if enabled
        if (this.options.showToolbar) {
            this.toolbar = this.createToolbar();
            this.container.appendChild(this.toolbar);
        }
        
        // Create editor area
        this.editorArea = document.createElement('div');
        this.editorArea.className = 'qde-editor';
        
        // Create source panel
        this.sourcePanel = document.createElement('div');
        this.sourcePanel.className = 'qde-source';
        
        this.sourceTextarea = document.createElement('textarea');
        this.sourceTextarea.className = 'qde-textarea';
        this.sourceTextarea.spellcheck = false;
        this.sourceTextarea.placeholder = this.options.placeholder;
        this.sourcePanel.appendChild(this.sourceTextarea);
        
        // Create preview panel
        this.previewPanel = document.createElement('div');
        this.previewPanel.className = 'qde-preview';
        this.previewPanel.contentEditable = true;
        this.previewPanel.spellcheck = false;
        
        // Add panels to editor
        this.editorArea.appendChild(this.sourcePanel);
        this.editorArea.appendChild(this.previewPanel);
        this.container.appendChild(this.editorArea);
        
        // Add built-in styles if not already present
        this.injectStyles();
    }
    
    /**
     * Create toolbar
     */
    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'qde-toolbar';
        
        // Mode buttons
        const modes = ['source', 'split', 'preview'];
        const modeLabels = { source: 'Source', split: 'Split', preview: 'Rendered' };
        modes.forEach(mode => {
            const btn = document.createElement('button');
            btn.className = 'qde-btn';
            btn.dataset.mode = mode;
            btn.textContent = modeLabels[mode];
            btn.title = `Switch to ${modeLabels[mode]} view`;
            toolbar.appendChild(btn);
        });

        // Mobile split toggle (hidden by default, shown via CSS on narrow viewports)
        const splitToggle = document.createElement('button');
        splitToggle.className = 'qde-btn qde-split-toggle';
        splitToggle.textContent = 'Preview';
        splitToggle.title = 'Toggle between source and preview in split mode';
        toolbar.appendChild(splitToggle);

        // Undo/Redo buttons (if enabled)
        if (this.options.showUndoRedo) {
            const undoBtn = document.createElement('button');
            undoBtn.className = 'qde-btn disabled';
            undoBtn.dataset.action = 'undo';
            undoBtn.textContent = 'Undo';
            undoBtn.title = 'Undo (Ctrl+Z)';
            toolbar.appendChild(undoBtn);

            const redoBtn = document.createElement('button');
            redoBtn.className = 'qde-btn disabled';
            redoBtn.dataset.action = 'redo';
            redoBtn.textContent = 'Redo';
            redoBtn.title = 'Redo (Ctrl+Shift+Z / Ctrl+Y)';
            toolbar.appendChild(redoBtn);
        }

        // Spacer
        const spacer = document.createElement('span');
        spacer.className = 'qde-spacer';
        toolbar.appendChild(spacer);
        
        // Copy buttons
        const copyButtons = [
            { action: 'copy-markdown', text: 'Copy MD', title: 'Copy markdown to clipboard' },
            { action: 'copy-html', text: 'Copy HTML', title: 'Copy HTML to clipboard' },
            { action: 'copy-rendered', text: 'Copy Rendered', title: 'Copy rich text to clipboard' }
        ];
        
        copyButtons.forEach(({ action, text, title }) => {
            const btn = document.createElement('button');
            btn.className = 'qde-btn';
            btn.dataset.action = action;
            btn.textContent = text;
            btn.title = title;
            toolbar.appendChild(btn);
        });
        
        // Remove HR button (if enabled)
        if (this.options.showRemoveHR) {
            const removeHRBtn = document.createElement('button');
            removeHRBtn.className = 'qde-btn';
            removeHRBtn.dataset.action = 'remove-hr';
            removeHRBtn.textContent = 'Remove HR';
            removeHRBtn.title = 'Remove all horizontal rules (---) from markdown';
            toolbar.appendChild(removeHRBtn);
        }

        // Lazy linefeeds button (if enabled)
        if (this.options.showLazyLinefeeds) {
            const lazyLFBtn = document.createElement('button');
            lazyLFBtn.className = 'qde-btn';
            lazyLFBtn.dataset.action = 'lazy-linefeeds';
            lazyLFBtn.textContent = 'Fix Linefeeds';
            lazyLFBtn.title = 'Convert single newlines to paragraph breaks (one-time transform)';
            toolbar.appendChild(lazyLFBtn);
        }

        // Allow unsafe HTML toggle button (if enabled)
        if (this.options.showAllowUnsafeHTML) {
            const htmlModeBtn = document.createElement('button');
            htmlModeBtn.className = 'qde-btn';
            htmlModeBtn.dataset.action = 'toggle-html-mode';
            htmlModeBtn.textContent = this._getHtmlModeLabel(this.options.allowUnsafeHTML);
            htmlModeBtn.title = this._getHtmlModeTooltip(this.options.allowUnsafeHTML);
            toolbar.appendChild(htmlModeBtn);
        }

        return toolbar;
    }
    
    /**
     * Inject built-in styles
     */
    injectStyles() {
        if (document.getElementById('qde-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'qde-styles';
        style.textContent = `
            .qde-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                border: 1px solid var(--qde-border, #ddd);
                border-radius: var(--qde-radius, 4px);
                overflow: hidden;
                background: var(--qde-bg, white);
                color: var(--qde-fg, #1f2937);
            }
            
            .qde-toolbar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                padding: 8px;
                background: var(--qde-toolbar-bg, #f5f5f5);
                border-bottom: 1px solid var(--qde-border, #ddd);
                gap: 4px;
            }
            
            .qde-btn {
                padding: 6px 12px;
                border: 1px solid var(--qde-btn-border, #ccc);
                background: var(--qde-btn-bg, white);
                color: var(--qde-btn-fg, inherit);
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .qde-btn:hover {
                background: var(--qde-btn-hover-bg, #e9e9e9);
                border-color: var(--qde-btn-hover-border, #999);
            }
            
            .qde-btn.active {
                background: var(--qde-accent, #007bff);
                color: var(--qde-accent-fg, white);
                border-color: var(--qde-accent-border, #0056b3);
            }

            .qde-btn.disabled {
                opacity: 0.4;
                pointer-events: none;
            }
            .qde-btn[data-action="toggle-html-mode"] {
                position: relative;
            }
            .qde-btn[data-action="toggle-html-mode"]:hover::after {
                content: attr(title);
                position: absolute;
                bottom: calc(100% + 6px);
                left: 50%;
                transform: translateX(-50%);
                padding: 5px 10px;
                background: #1f2937;
                color: #fff;
                font-size: 0.75rem;
                font-weight: 400;
                white-space: nowrap;
                border-radius: 4px;
                pointer-events: none;
                z-index: 10;
            }
            
            .qde-spacer {
                flex: 1;
            }
            
            .qde-editor {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .qde-source, .qde-preview {
                flex: 1 1 0;
                min-width: 0;       /* allow flex shrinking below content size */
                min-height: 0;
                overflow: auto;
                padding: var(--qde-padding, 16px);
                box-sizing: border-box;
            }

            .qde-source {
                border-right: 1px solid var(--qde-border, #ddd);
                /* Source pane is just a container for the textarea — make it
                   a positioning context so the textarea can fill it absolutely */
                position: relative;
                padding: 0;          /* textarea brings its own padding */
            }

            .qde-textarea {
                display: block;
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
                resize: none;
                padding: var(--qde-padding, 16px);
                box-sizing: border-box;
                font-family: var(--qde-source-font, 'Monaco', 'Courier New', monospace);
                font-size: var(--qde-source-font-size, var(--qde-font-size, 14px));
                line-height: var(--qde-source-line-height, 1.5);
                background: var(--qde-source-bg, transparent);
                color: var(--qde-source-fg, inherit);
                /* Wrap long lines so the textarea only scrolls VERTICALLY.
                   pre-wrap preserves intentional line breaks/whitespace
                   while soft-wrapping at the right edge. */
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: hidden;
                overflow-y: auto;
            }
            
            .qde-preview {
                font-family: var(--qde-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
                font-size: var(--qde-preview-font-size, var(--qde-font-size, 16px));
                line-height: var(--qde-line-height, 1.6);
                background: var(--qde-preview-bg, transparent);
                color: var(--qde-preview-fg, inherit);
                outline: none;
                cursor: text;  /* Standard text cursor */
                overflow-x: hidden;  /* never scroll horizontally; clip wide content */
            }

            /* Code blocks and inline code — self-contained so the editor
               does not depend on any external stylesheet for these. */
            .qde-preview pre {
                background: var(--qde-code-bg, #f4f4f4);
                color: var(--qde-code-fg, #1f2937);
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 0.6em 0;
                font-size: 0.9em;
                line-height: 1.5;
                font-family: var(--qde-code-font, ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace);
            }
            .qde-preview code {
                padding: 2px 4px;
                font-size: 0.9em;
                border-radius: 3px;
                background: var(--qde-inline-code-bg, var(--qde-code-bg, #f0f0f0));
                color: var(--qde-code-fg, #1f2937);
                font-family: var(--qde-code-font, ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace);
            }
            .qde-preview pre code {
                padding: 0;
                font-size: inherit;
                border-radius: 0;
                background: transparent;
                color: inherit;
            }

            /* Wide fence content (Leaflet maps, large SVGs, STL canvases,
               iframes, raw <img>) must never overflow the preview pane */
            .qde-preview .geojson-container,
            .qde-preview .qde-stl-container,
            .qde-preview .qde-svg-container,
            .qde-preview .leaflet-container,
            .qde-preview iframe,
            .qde-preview img,
            .qde-preview > svg {
                max-width: 100%;
            }
            .qde-preview img {
                display: inline;
            }
            .qde-preview .leaflet-container { box-sizing: border-box; }
            .qde-preview .leaflet-container.qde-offline-map {
                background: #b8d4f0;
            }
            .qde-preview .leaflet-container.qde-offline-map path {
                shape-rendering: geometricPrecision;
            }
            .qde-dark .qde-preview .leaflet-container.qde-offline-map {
                background: #1a3048;
            }

            /* Standard markdown tables (the .quikdown-table class) need to
               scroll horizontally inside their own wrapper rather than
               making the whole preview pane scroll */
            .qde-preview table.quikdown-table,
            .qde-preview table.qde-csv-table {
                display: block;
                max-width: 100%;
                overflow-x: auto;
            }

            /* Fence-specific styles */
            .qde-svg-container {
                max-width: 100%;
                overflow: auto;
            }

            .qde-svg-container svg {
                max-width: 100%;
                height: auto;
            }
            
            .qde-html-container {
                /* HTML containers inherit background */
                margin: 12px 0;
            }
            
            .qde-math-container {
                text-align: center;
                margin: 16px 0;
                overflow-x: auto;
            }
            
            /* All tables in preview (both regular markdown and CSV) */
            .qde-preview table {
                width: 100%;
                border-collapse: collapse;
                margin: 12px 0;
                font-size: 14px;
            }
            
            .qde-preview table th,
            .qde-preview table td {
                border: 1px solid var(--qde-table-border, var(--qde-border, #ddd));
                padding: 8px;
            }
            
            /* Support for alignment classes from quikdown */
            .qde-preview .quikdown-left { text-align: left; }
            .qde-preview .quikdown-center { text-align: center; }
            .qde-preview .quikdown-right { text-align: right; }
            
            .qde-preview table th {
                background: var(--qde-table-header-bg, #f5f5f5);
                font-weight: bold;
            }
            
            .qde-preview table tr:nth-child(even) {
                background: var(--qde-table-stripe-bg, #f9f9f9);
            }
            
            /* Specific to CSV-generated tables */
            .qde-data-table {
                /* Can add specific CSV table styles here if needed */
            }
            
            .qde-json {
                /* Let highlight.js handle styling */
                overflow-x: auto;
            }
            
            .qde-error {
                background: #fee;
                border: 1px solid #fcc;
                color: #c00;
                padding: 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
            }
            
            /* Read-only complex fence blocks in preview */
            .qde-preview [contenteditable="false"] {
                cursor: auto;  /* Use automatic cursor (arrow for non-text) */
                user-select: text;
                position: relative;
            }
            
            /* Reset headings inside the preview to plain browser defaults so
               parent-page styles (site navs, marketing pages, design systems)
               cannot bleed in. Business-casual: black text, decreasing sizes,
               no decorative borders. See docs/quikdown-editor.md for how
               embedders can override these with their own stylesheet. */
            .qde-preview h1 { font-size: 2em; }
            .qde-preview h2 { font-size: 1.5em; }
            .qde-preview h3 { font-size: 1.25em; }
            .qde-preview h4 { font-size: 1em; }
            .qde-preview h5 { font-size: 0.875em; }
            .qde-preview h6 { font-size: 0.85em; }
            .qde-preview h1,
            .qde-preview h2,
            .qde-preview h3,
            .qde-preview h4,
            .qde-preview h5,
            .qde-preview h6 {
                font-weight: bold;
                color: inherit;
                border: none;
                margin: 0.6em 0 0.3em 0;
                line-height: 1.25;
            }
            .qde-preview p {
                margin: 0.35em 0;
            }
            .qde-preview ul,
            .qde-preview ol {
                padding-left: 1.8em;
                margin: 0.4em 0;
            }
            .qde-preview li {
                margin: 0.15em 0;
            }
            .qde-preview blockquote {
                margin: 0.5em 0;
                padding-left: 1em;
            }

            /* Ensure proper cursor for editable text elements */
            .qde-preview p,
            .qde-preview h1,
            .qde-preview h2,
            .qde-preview h3,
            .qde-preview h4,
            .qde-preview h5,
            .qde-preview h6,
            .qde-preview li,
            .qde-preview td,
            .qde-preview th,
            .qde-preview blockquote,
            .qde-preview pre[contenteditable="true"],
            .qde-preview code[contenteditable="true"] {
                cursor: text;
            }
            
            
            /* Non-editable complex renderers */
            .qde-preview .qde-svg-container[contenteditable="false"],
            .qde-preview .qde-html-container[contenteditable="false"],
            .qde-preview .qde-math-container[contenteditable="false"],
            .qde-preview .mermaid[contenteditable="false"] {
                opacity: 0.98;
            }
            
            /* Subtle hover effect for read-only blocks */
            .qde-preview [contenteditable="false"]:hover::after {
                content: "Read-only";
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 10px;
                color: #999;
                background: rgba(255, 255, 255, 0.9);
                padding: 2px 4px;
                border-radius: 2px;
                pointer-events: none;
            }
            
            /* Fix list padding in preview */
            .qde-preview ul,
            .qde-preview ol {
                padding-left: 2em;
                margin: 0.5em 0;
            }
            
            .qde-preview li {
                margin: 0.25em 0;
            }
            
            /* Mode-specific visibility */
            .qde-mode-source .qde-preview { display: none; }
            .qde-mode-source .qde-source { border-right: none; }
            .qde-mode-preview .qde-source { display: none; }
            .qde-mode-split .qde-source,
            .qde-mode-split .qde-preview { display: block; }
            
            /* Dark theme */
            .qde-dark {
                background: var(--qde-bg, #1e1e1e);
                color: var(--qde-fg, #e0e0e0);
                border-color: var(--qde-border, #444);
            }
            
            .qde-dark .qde-toolbar {
                background: var(--qde-toolbar-bg, #2d2d2d);
                border-color: var(--qde-border, #444);
            }
            
            .qde-dark .qde-btn {
                background: var(--qde-btn-bg, #3a3a3a);
                color: var(--qde-btn-fg, #e0e0e0);
                border-color: var(--qde-btn-border, #555);
            }
            
            .qde-dark .qde-btn:hover {
                background: var(--qde-btn-hover-bg, #4a4a4a);
            }
            
            .qde-dark .qde-source {
                border-color: var(--qde-border, #444);
            }
            
            .qde-dark .qde-textarea {
                background: var(--qde-source-bg, var(--qde-bg, #1e1e1e));
                color: var(--qde-source-fg, var(--qde-fg, #e0e0e0));
            }
            
            .qde-dark .qde-preview {
                background: var(--qde-preview-bg, var(--qde-bg, #1e1e1e));
                color: var(--qde-preview-fg, var(--qde-fg, #e0e0e0));
            }
            
            /* Dark mode code blocks */
            .qde-dark .qde-preview pre {
                background: var(--qde-code-bg, #2d2d3a);
                color: var(--qde-code-fg, #e6e6f0);
            }
            .qde-dark .qde-preview code {
                background: var(--qde-inline-code-bg, var(--qde-code-bg, #2a2a3a));
                color: var(--qde-code-fg, #e6e6f0);
            }
            .qde-dark .qde-preview pre code {
                background: transparent;
                color: inherit;
            }

            /* Dark mode table styles */
            .qde-dark .qde-preview table th,
            .qde-dark .qde-preview table td {
                border-color: var(--qde-table-border, var(--qde-border, #3a3a3a));
            }
            
            .qde-dark .qde-preview table th {
                background: var(--qde-table-header-bg, #2d2d2d);
            }
            
            .qde-dark .qde-preview table tr:nth-child(even) {
                background: var(--qde-table-stripe-bg, #252525);
            }
            
            /* Mobile split toggle — hidden by default */
            .qde-split-toggle { display: none; }

            /* Mobile responsive — compact toolbar for all small screens */
            @media (max-width: 720px) {
                .qde-toolbar {
                    padding: 6px;
                    gap: 3px;
                }
                .qde-btn {
                    padding: 5px 8px;
                    font-size: 12px;
                }
                .qde-source, .qde-preview {
                    padding: 10px;
                }
                .qde-textarea {
                    padding: 10px;
                }
                /* Undo/Redo: show circular arrows instead of text */
                .qde-btn[data-action="undo"] { font-size: 0; }
                .qde-btn[data-action="undo"]::after { content: "\\21B6"; font-size: 14px; }
                .qde-btn[data-action="redo"] { font-size: 0; }
                .qde-btn[data-action="redo"]::after { content: "\\21B7"; font-size: 14px; }
                /* Hide secondary utility buttons to reduce clutter */
                .qde-btn[data-action="remove-hr"],
                .qde-btn[data-action="lazy-linefeeds"],
                .qde-btn[data-action="copy-rendered"] { display: none; }
            }

            /* Portrait mobile: drop split mode entirely */
            @media (max-width: 720px) and (orientation: portrait) {
                .qde-btn[data-mode="split"] { display: none; }
                .qde-split-toggle { display: none !important; }
                /* Fallback: if still in split mode, show source only */
                .qde-mode-split .qde-source { border-right: none; }
                .qde-mode-split .qde-preview { display: none; }
                .qde-mode-split.qde-split-preview .qde-source { display: none; }
                .qde-mode-split.qde-split-preview .qde-preview { display: block; }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Attach event listeners
     */
    attachEvents() {
        // Source textarea input
        this._on(this.sourceTextarea, 'input', () => {
            this.handleSourceInput();
        });

        // Preview contenteditable input
        this._on(this.previewPanel, 'input', () => {
            this.handlePreviewInput();
        });

        // Toolbar buttons
        if (this.toolbar) {
            this._on(this.toolbar, 'click', (e) => {
                const btn = e.target.closest('.qde-btn');
                if (!btn) return;

                // Mobile split-toggle button
                if (btn.classList.contains('qde-split-toggle')) {
                    this.setSplitPane(this.getSplitPane() === 'preview' ? 'source' : 'preview');
                    return;
                }

                if (btn.dataset.mode) {
                    this.setMode(btn.dataset.mode);
                } else if (btn.dataset.action) {
                    this.handleAction(btn.dataset.action);
                }
            });
        }

        // Keyboard shortcuts. The listener is on this editor's own element,
        // so a shortcut acts only on the editor that holds focus: other
        // editors and other inputs on the page are left alone.
        if (this.options.shortcuts) {
            this._on(this.container, 'keydown', (e) => this._handleKeydown(e));
        }

        // Track which pane the user is working in, so API calls made from a
        // host toolbar (which takes focus when clicked) still know the pane.
        ['focusin', 'mousedown', 'keydown', 'input'].forEach(type => {
            this._on(this.sourceTextarea, type, () => { this._lastPane = 'source'; });
            this._on(this.previewPanel, type, () => { this._lastPane = 'preview'; });
        });

        // Selection tracking. `selectionchange` only fires on the document;
        // the handler ignores selections outside this editor.
        this._on(document, 'selectionchange', () => this._handleSelectionChange());
        ['select', 'keyup', 'mouseup'].forEach(type => {
            this._on(this.sourceTextarea, type, () => this._handleSelectionChange());
        });

        // Link clicks in the rendered pane
        this._on(this.previewPanel, 'click', (e) => this._handlePreviewClick(e));

        // Scroll sync (no-op unless options.syncScroll is on)
        this._on(this.sourceTextarea, 'scroll', () => this._handleScroll('source'));
        this._on(this.previewPanel, 'scroll', () => this._handleScroll('preview'));

        // On narrow portrait viewports, auto-switch out of split mode to source.
        // Split is kept available on landscape where there is enough width.
        if (typeof window.matchMedia === 'function') {
            const portraitQuery = window.matchMedia('(max-width: 720px) and (orientation: portrait)');
            const switchIfPortrait = () => {
                if (!this._destroyed && portraitQuery.matches && this.currentMode === 'split') {
                    this.setMode('source');
                }
            };
            // Check after init's setMode() has run (microtask fires after sync code).
            Promise.resolve().then(switchIfPortrait);
            this._on(portraitQuery, 'change', switchIfPortrait);
        }
    }

    /**
     * Keyboard shortcuts for the editor that holds focus.
     * @private
     */
    _handleKeydown(e) {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey) {
            switch (e.key.toLowerCase()) {
                case '1':
                    e.preventDefault();
                    this.setMode('source');
                    break;
                case '2':
                    e.preventDefault();
                    this.setMode('split');
                    break;
                case '3':
                    e.preventDefault();
                    this.setMode('preview');
                    break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) this.redo();
                    else this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'b':
                    if (e.shiftKey) break;
                    e.preventDefault();
                    this.format('bold');
                    break;
                case 'i':
                    if (e.shiftKey) break;
                    e.preventDefault();
                    this.format('italic');
                    break;
            }
        } else if (e.key === 'Tab' && !mod && !e.altKey) {
            // Tab / Shift+Tab indent and outdent list items. Outside a list
            // the key keeps its normal meaning (move focus).
            if (this.getFormatState().list) {
                e.preventDefault();
                this.format(e.shiftKey ? 'outdent' : 'indent');
            }
        }
    }

    /**
     * Save the preview selection and report selection changes to the host.
     * @private
     */
    _handleSelectionChange() {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        if (range && this._inPreview(range)) {
            this._savedRange = range.cloneRange();
            if (document.activeElement !== this.sourceTextarea) this._lastPane = 'preview';
        } else if (document.activeElement !== this.sourceTextarea) {
            return; // the selection is somewhere else on the page
        }
        this._notifySelection();
    }

    /**
     * Call onSelectionChange if the selection differs from the last report.
     * Skipped while a debounced edit is waiting; the update that follows
     * reports the selection itself.
     * @private
     */
    _notifySelection() {
        if (!this.options.onSelectionChange || this._pending) return;
        const sel = this.getSelection();
        const key = `${sel.pane}:${sel.start}:${sel.end}:${this._markdown.length}`;
        if (key === this._lastSelKey) return;
        this._lastSelKey = key;
        this.options.onSelectionChange({ ...sel, format: getFormatState(this._markdown, sel.start, sel.end) });
    }

    /**
     * Hand link clicks in the rendered pane to the host.
     * @private
     */
    _handlePreviewClick(e) {
        if (!this.options.onLinkClick) return;
        const link = e.target.closest ? e.target.closest('a[href]') : null;
        if (!link || !this.previewPanel.contains(link)) return;
        if (this.options.onLinkClick(link.getAttribute('href'), e) !== true) {
            e.preventDefault();
        }
    }

    /**
     * Mirror one pane's relative scroll position onto the other.
     * @private
     */
    _handleScroll(pane) {
        if (!this.options.syncScroll || this.currentMode !== 'split') return;
        if (this._scrollLock === pane) {
            // This event is the echo of the position we just wrote.
            this._scrollLock = null;
            return;
        }
        const from = pane === 'source' ? this.sourceTextarea : this.previewPanel;
        const to = pane === 'source' ? this.previewPanel : this.sourceTextarea;
        const range = from.scrollHeight - from.clientHeight;
        const ratio = range > 0 ? from.scrollTop / range : 0;
        const target = Math.round(ratio * Math.max(0, to.scrollHeight - to.clientHeight));
        if (Math.abs(to.scrollTop - target) > 1) {
            this._scrollLock = pane === 'source' ? 'preview' : 'source';
            to.scrollTop = target;
        }
    }

    /**
     * Handle source textarea input
     */
    handleSourceInput() {
        clearTimeout(this.updateTimer);
        this._pending = 'source';
        this.updateTimer = setTimeout(() => {
            this._pending = null;
            this.updateFromMarkdown(this.sourceTextarea.value, 'user');
        }, this.options.debounceDelay);
    }

    /**
     * Handle preview panel input
     */
    handlePreviewInput() {
        clearTimeout(this.updateTimer);
        this._pending = 'preview';
        this._previewFresh = false;
        this.updateTimer = setTimeout(() => {
            this._pending = null;
            this.updateFromHTML('user');
        }, this.options.debounceDelay);
    }

    /**
     * Apply any edit that is still waiting on the debounce timer, so that
     * the markdown, HTML and history are current. Called by every API
     * method that reads or changes the document.
     */
    flush() {
        if (!this._pending) return;
        const pane = this._pending;
        clearTimeout(this.updateTimer);
        this._pending = null;
        if (pane === 'source') this.updateFromMarkdown(this.sourceTextarea.value, 'user');
        else this.updateFromHTML('user');
    }

    /**
     * Render markdown to HTML with this editor's options.
     * @private
     */
    _renderMarkdown(markdown) {
        // Translate editor's allowUnsafeHTML to parser's allow_unsafe_html:
        //   false → false,  true → true,  'limited' → quikdown_bd.SAFE_HTML_TAGS
        const htmlMode = this.options.allowUnsafeHTML;
        const allowHtml = htmlMode === 'limited' ? SAFE_HTML_TAGS : htmlMode;

        return quikdown_bd(markdown, {
            fence_plugin: this.createFencePlugin(),
            lazy_linefeeds: this.options.lazy_linefeeds,
            inline_styles: this.options.inline_styles,
            allow_unsafe_html: allowHtml,
            reference_links: this.options.reference_links,
            footnotes: this.options.footnotes
        });
    }

    /**
     * Put the current HTML into the preview pane.
     * @private
     */
    _renderPreview() {
        if (!this._markdown.trim()) {
            this.previewPanel.innerHTML = '<div style="color: #999; font-style: italic; padding: 16px;">Start typing markdown in the source panel...</div>';
        } else {
            this.previewPanel.innerHTML = this._html;
            this._resolveImages();

            // Process all math elements with MathJax if loaded (like squibview)
            this._typesetMath(this.previewPanel);
        }
        this._previewFresh = true;
        this._blocks = null;
        this._savedRange = null;

        if (this.options.onRender) {
            this.options.onRender(this.previewPanel);
        }
    }

    /**
     * Rewrite image sources for display through options.resolveImageSrc.
     * The markdown keeps the original URL: it is stored in data-qd-src,
     * which the HTML → markdown conversion reads in preference to src.
     * @private
     */
    _resolveImages() {
        const resolve = this.options.resolveImageSrc;
        if (typeof resolve !== 'function') return;
        this.previewPanel.querySelectorAll('img').forEach(img => {
            const original = img.getAttribute('data-qd-src') || img.getAttribute('src') || '';
            const resolved = resolve(original, {
                alt: img.getAttribute('alt') || '',
                title: img.getAttribute('title') || ''
            });
            if (typeof resolved === 'string' && resolved !== img.getAttribute('src')) {
                img.setAttribute('data-qd-src', original);
                img.setAttribute('src', resolved);
            }
        });
    }

    /**
     * Report a change to the host.
     * @private
     */
    _emitChange(source) {
        this._lastSelKey = '';
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html, { source });
        }
    }

    /**
     * Update from markdown source
     * @param {string} markdown
     * @param {string} [source='api'] reported to onChange as meta.source
     */
    updateFromMarkdown(markdown, source = 'api') {
        if (this._destroyed) return;

        // Push current state to undo stack before changing (unless this is an undo/redo operation)
        if (!this._isUndoRedo) {
            this._pushUndoState(markdown || '');
        }
        this._isUndoRedo = false;

        this._markdown = markdown || '';
        this._html = this._markdown.trim() ? this._renderMarkdown(this._markdown) : '';

        // Update preview if visible
        if (this.currentMode !== 'source') {
            this._renderPreview();
        } else {
            this._previewFresh = false;
            this._blocks = null;
        }

        this._emitChange(source);
        this._updateUndoButtons();
    }

    /**
     * Update from HTML preview
     * @param {string} [source='user'] reported to onChange as meta.source
     */
    updateFromHTML(source = 'user') {
        if (this._destroyed) return;

        // Clone the preview panel to avoid modifying the actual DOM
        const clonedPanel = this.previewPanel.cloneNode(true);

        // Pre-process special elements on the clone
        this.preprocessSpecialElements(clonedPanel);

        this._html = this.previewPanel.innerHTML;
        const newMarkdown = quikdown_bd.toMarkdown(clonedPanel, {
            fence_plugin: this.createFencePlugin()
        });

        // Push previous state to undo stack (now that we know the new markdown)
        this._pushUndoState(newMarkdown);
        this._isUndoRedo = false;

        this._markdown = newMarkdown;
        this._previewFresh = false;
        this._blocks = null;

        // Keep the source in step even while it is hidden, so a later
        // switch to source or split mode shows the current text.
        this.sourceTextarea.value = this._markdown;

        this._emitChange(source);
        this._updateUndoButtons();
    }

    /**
     * Pre-process special elements before markdown conversion
     */
    preprocessSpecialElements(panel) {
        if (!panel) return;
        
        // Restore non-editable complex fences from their data attributes
        const complexFences = panel.querySelectorAll('[contenteditable="false"][data-qd-source]');
        complexFences.forEach(element => {
            const source = element.getAttribute('data-qd-source');
            const fence = element.getAttribute('data-qd-fence') || '```';
            const lang = element.getAttribute('data-qd-lang') || '';
            
            // Create a pre element with the original source
            const pre = document.createElement('pre');
            pre.setAttribute('data-qd-fence', fence);
            if (lang) pre.setAttribute('data-qd-lang', lang);
            const code = document.createElement('code');
            // The source is already the original unescaped content when using setAttribute
            // No need to unescape since browser handles it automatically
            code.textContent = source;
            pre.appendChild(code);
            
            // Replace the complex element with pre
            element.parentNode.replaceChild(pre, element);
        });
        
        // Convert CSV tables back to CSV fence blocks (these ARE editable)
        const csvTables = panel.querySelectorAll('table.qde-csv-table[data-qd-lang]');
        csvTables.forEach(table => {
            const lang = table.getAttribute('data-qd-lang');
            if (!lang || !['csv', 'psv', 'tsv'].includes(lang)) return;
            
            const delimiter = lang === 'csv' ? ',' : lang === 'psv' ? '|' : '\t';
            
            // Extract data from table
            let csv = '';
            
            // Get headers
            const headers = [];
            const headerCells = table.querySelectorAll('thead th');
            headerCells.forEach(th => {
                const text = th.textContent.trim();
                // Quote if contains delimiter or quotes
                const needsQuoting = text.includes(delimiter) || text.includes('"') || text.includes('\n');
                headers.push(needsQuoting ? `"${text.replace(/"/g, '""')}"` : text);
            });
            csv += headers.join(delimiter) + '\n';
            
            // Get rows
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(tr => {
                const cells = [];
                tr.querySelectorAll('td').forEach(td => {
                    const text = td.textContent.trim();
                    const needsQuoting = text.includes(delimiter) || text.includes('"') || text.includes('\n');
                    cells.push(needsQuoting ? `"${text.replace(/"/g, '""')}"` : text);
                });
                csv += cells.join(delimiter) + '\n';
            });
            
            // Create a pre element with the CSV data
            const pre = document.createElement('pre');
            pre.setAttribute('data-qd-fence', '```');
            pre.setAttribute('data-qd-lang', lang);
            const code = document.createElement('code');
            code.textContent = csv.trim();
            pre.appendChild(code);
            
            // Replace table with pre
            table.parentNode.replaceChild(pre, table);
        });
    }
    
    /**
     * Create fence plugin for syntax highlighting
     */
    createFencePlugin() {
        const render = (code, lang) => {
            // Check custom fences first (they take precedence)
            if (this.options.customFences && this.options.customFences[lang]) {
                try {
                    return this.options.customFences[lang](code, lang);
                } catch (err) {
                    console.error(`Custom fence plugin error for ${lang}:`, err);
                    return `<pre><code class="language-${this.escapeHtml(lang)}">${this.escapeHtml(code)}</code></pre>`;
                }
            }
            
            // For bidirectional editing, only apply syntax highlighting
            // Skip complex transformations that break round-trip conversion
            const skipComplexRendering = !this.options.enableComplexFences;
            
            if (!skipComplexRendering) {
                // Built-in lazy loading fence handlers (disabled for now)
                switch(lang) {
                    case 'svg':
                        return this.renderSVG(code);
                        
                    case 'html':
                        return this.renderHTML(code);
                        
                    case 'math':
                    case 'tex':
                    case 'latex':
                        return this.renderMath(code, lang);
                        
                    case 'csv':
                    case 'psv':
                    case 'tsv':
                        return this.renderTable(code, lang);
                        
                    case 'json':
                    case 'json5':
                        return this.renderJSON(code, lang);
                        
                    case 'katex':  // Use MathJax for katex fence blocks (backward compatibility)
                        return this.renderMath(code, 'katex');
                        
                    case 'mermaid':
                        if (window.mermaid) {
                            return this.renderMermaid(code);
                        }
                        break;
                        
                    case 'geojson':
                        return this.renderGeoJSON(code);
                        
                    case 'stl':
                        return this.renderSTL(code);

                    case 'abc':
                    case 'music':
                        return this.renderABC(code);

                    case 'vega':
                    case 'vega-lite':
                    case 'vegalite':
                        return this.renderVega(code, lang);
                }
            }
            
            // Syntax highlighting support - keep editable for bidirectional
            if (window.hljs && lang && hljs.getLanguage(lang)) {
                const highlighted = hljs.highlight(code, { language: lang }).value;
                // Don't add contenteditable="false" - the bidirectional system can extract text from the highlighted code
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${this.escapeHtml(lang)}"><code class="hljs language-${this.escapeHtml(lang)}">${highlighted}</code></pre>`;
            }
            
            // Default: let quikdown handle it
            return undefined;
        };
        
        // Reverse function to extract raw source from rendered HTML
        const reverse = (element) => {
            // Get the language from data attribute
            const lang = element.getAttribute('data-qd-lang') || '';
            let content;

            // For syntax-highlighted code, extract the raw text
            if (element.querySelector('code.hljs')) {
                const code = element.querySelector('code.hljs');
                content = code.textContent || code.innerText || '';
            }
            // For other code blocks, just get the text content
            else if (element.querySelector('code')) {
                const codeEl = element.querySelector('code');
                content = codeEl.textContent || codeEl.innerText || '';
            }
            // Fallback to element text
            else {
                content = element.textContent || element.innerText || '';
            }
            
            // Return in the format quikdown_bd expects
            return {
                content: content,
                lang: lang,
                fence: '```'
            };
        };
        
        // Return object format for v1.1.0 API with both render and reverse
        return { render, reverse };
    }
    
    /**
     * Render SVG content
     */
    renderSVG(code) {
        try {
            // Basic SVG validation
            const parser = new DOMParser();
            const doc = parser.parseFromString(code, 'image/svg+xml');
            const parseError = doc.querySelector('parsererror');
            
            if (parseError) {
                throw new Error('Invalid SVG');
            }
            
            // Sanitize SVG by removing script tags and event handlers
            const svg = doc.documentElement;
            svg.querySelectorAll('script').forEach(el => el.remove());
            
            // Remove event handlers
            // Start at the root <svg> itself: nextNode() alone would skip it
            const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
            for (let node = svg; node; node = walker.nextNode()) {
                for (let i = node.attributes.length - 1; i >= 0; i--) {
                    const attr = node.attributes[i];
                    if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                        node.removeAttribute(attr.name);
                    }
                }
            }
            
            // Create container element programmatically to avoid attribute escaping issues
            const container = document.createElement('div');
            container.className = 'qde-svg-container';
            container.contentEditable = 'false';
            container.setAttribute('data-qd-fence', '```');
            container.setAttribute('data-qd-lang', 'svg');
            container.setAttribute('data-qd-source', code);  // No escaping needed when using setAttribute!
            container.innerHTML = new XMLSerializer().serializeToString(svg);
            
            // Return the HTML string
            return container.outerHTML;
        } catch (err) {
            const errorContainer = document.createElement('pre');
            errorContainer.className = 'qde-error';
            errorContainer.contentEditable = 'false';
            errorContainer.setAttribute('data-qd-fence', '```');
            errorContainer.setAttribute('data-qd-lang', 'svg');
            errorContainer.textContent = `Invalid SVG: ${err.message}`;
            return errorContainer.outerHTML;
        }
    }
    
    /**
     * Render HTML content with DOMPurify if available
     */
    renderHTML(code) {
        const id = `html-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // If DOMPurify is loaded, use it
        if (window.DOMPurify) {
            const clean = DOMPurify.sanitize(code);
            
            // Create container programmatically
            const container = document.createElement('div');
            container.className = 'qde-html-container';
            container.contentEditable = 'false';
            container.setAttribute('data-qd-fence', '```');
            container.setAttribute('data-qd-lang', 'html');
            container.setAttribute('data-qd-source', code);
            container.innerHTML = clean;
            
            return container.outerHTML;
        }
        
        // Try to lazy load DOMPurify
        this.lazyLoadLibrary(
            'DOMPurify',
            () => window.DOMPurify,
            'https://unpkg.com/dompurify/dist/purify.min.js'
        ).then(loaded => {
            if (loaded) {
                const element = document.getElementById(id);
                if (element) {
                    const clean = DOMPurify.sanitize(code);
                    element.innerHTML = clean;
                    // Update attributes after loading
                    element.setAttribute('data-qd-source', code);
                    element.setAttribute('data-qd-fence', '```');
                    element.setAttribute('data-qd-lang', 'html');
                }
            }
        });
        
        // Return placeholder with bidirectional attributes - non-editable
        const placeholder = document.createElement('div');
        placeholder.id = id;
        placeholder.className = 'qde-html-container';
        placeholder.contentEditable = 'false';
        placeholder.setAttribute('data-qd-fence', '```');
        placeholder.setAttribute('data-qd-lang', 'html');
        placeholder.setAttribute('data-qd-source', code);
        const pre = document.createElement('pre');
        pre.textContent = code;
        placeholder.appendChild(pre);
        
        return placeholder.outerHTML;
    }
    
    /**
     * Render math with MathJax (SVG output for better copy support)
     */
    renderMath(code, _lang) {
        const id = `math-${Math.random().toString(36).substring(2, 15)}`;
        
        // Create container exactly like squibview
        const container = document.createElement('div');
        container.id = id;
        container.className = 'math-display';
        container.contentEditable = 'false';
        container.setAttribute('data-source-type', 'math');
        
        // Format content for MathJax (display mode with $$) - exactly like squibview
        const singleLineContent = code.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        container.textContent = `$$${singleLineContent}$$`;
        
        // Add centering style
        container.style.textAlign = 'center';
        container.style.margin = '1em 0';
        
        
        // Ensure MathJax will be loaded (if not already)
        if (!window.MathJax || !window.MathJax.typesetPromise) {
            this.ensureMathJaxLoaded();
        }
        
        // MathJax will be processed in batch after preview update
        return container.outerHTML;
    }
    
    /**
     * Typeset math elements, handling both ready and not-yet-ready MathJax.
     * In the standalone bundle MathJax may be imported but its async startup
     * not yet complete, so typesetPromise is not available immediately.
     */
    _typesetMath(root) {
        const mathElements = (root || this.previewPanel || document).querySelectorAll('.math-display');
        if (mathElements.length === 0) return;
        const elements = Array.from(mathElements);

        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise(elements).catch(() => {});
        } else if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
            // Standalone bundle: MathJax imported but async startup not finished
            window.MathJax.startup.promise.then(() => {
                if (window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise(elements).catch(() => {});
                }
            }).catch(() => {});
        } else if (window.MathJax) {
            // MathJax config exists but startup not yet initialized — poll
            const poll = (n) => {
                if (n <= 0) return;
                setTimeout(() => {
                    if (!window.MathJax) return;
                    if (window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise(elements).catch(() => {});
                    } else if (window.MathJax.startup && window.MathJax.startup.promise) {
                        window.MathJax.startup.promise.then(() => {
                            if (window.MathJax && window.MathJax.typesetPromise) {
                                window.MathJax.typesetPromise(elements).catch(() => {});
                            }
                        }).catch(() => {});
                    } else {
                        poll(n - 1);
                    }
                }, 100);
            };
            poll(50);
        }
    }

    /**
     * Ensures MathJax is loaded (but doesn't process elements)
     */
    ensureMathJaxLoaded() {
        if (typeof window.MathJax === 'undefined' && !window.mathJaxLoading) {
            // After a failed load, wait before trying again so an offline
            // page does not request the script on every render.
            if (Date.now() - (window._qde_mathjax_failed || 0) < MATHJAX_RETRY_MS) return;
            window.mathJaxLoading = true;
            configureMathJax();

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
            script.async = true;
            script.onload = () => {
                window.mathJaxLoading = false;

                // Process any existing math elements (like squibview)
                this._typesetMath(this.previewPanel || document);
            };
            script.onerror = () => {
                window.mathJaxLoading = false;
                // Remove the config and the dead script so the next render retries
                clearFailedMathJax();
                script.remove();
                console.error('Failed to load MathJax');
            };
            document.head.appendChild(script);
        }
    }
    
    /**
     * Render CSV/PSV/TSV as HTML table
     */
    renderTable(code, lang) {
        const escapedCode = this.escapeHtml(code);
        try {
            const delimiter = lang === 'csv' ? ',' : lang === 'psv' ? '|' : '\t';
            const lines = code.trim().split('\n');
            
            if (lines.length === 0) {
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}">${escapedCode}</pre>`;
            }
            
            // CSV tables CAN be editable - we'll convert HTML table back to CSV
            // Don't need data-qd-source since we convert the table structure back to CSV
            let html = `<table class="qde-data-table qde-csv-table" data-qd-fence="\`\`\`" data-qd-lang="${lang}">`;
            
            // Parse header
            const header = this.parseCSVLine(lines[0], delimiter);
            html += '<thead><tr>';
            header.forEach(cell => {
                html += `<th>${this.escapeHtml(cell.trim())}</th>`;
            });
            html += '</tr></thead>';
            
            // Parse body
            if (lines.length > 1) {
                html += '<tbody>';
                for (let i = 1; i < lines.length; i++) {
                    const row = this.parseCSVLine(lines[i], delimiter);
                    html += '<tr>';
                    row.forEach(cell => {
                        html += `<td>${this.escapeHtml(cell.trim())}</td>`;
                    });
                    html += '</tr>';
                }
                html += '</tbody>';
            }
            
            html += '</table>';
            return html;
        } catch (_err) {
            return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}">${escapedCode}</pre>`;
        }
    }

    /**
     * Parse CSV line handling quoted values
     */
    parseCSVLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }
    
    /**
     * Render JSON with syntax highlighting
     */
    renderJSON(code, lang) {
        // If highlight.js is available, use it for all JSON
        if (window.hljs && hljs.getLanguage('json')) {
            try {
                // Try to format if valid JSON
                let toHighlight = code;
                try {
                    const data = JSON.parse(code);
                    toHighlight = JSON.stringify(data, null, 2);
                } catch (_e) {
                    // Use original if not valid JSON
                }
                
                const highlighted = hljs.highlight(toHighlight, { language: 'json' }).value;
                return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-json">${highlighted}</code></pre>`;
            } catch (_e) {
                // Fall through if highlighting fails
            }
        }
        
        // No highlighting available - return plain
        return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}">${this.escapeHtml(code)}</pre>`;
    }
    
    /**
     * Render GeoJSON map
     */
    renderGeoJSON(code) {
        // Generate unique map ID (following SquibView pattern)
        const mapId = `map-${Math.random().toString(36).substr(2, 15)}`;
        
        // Function to render the map
        const renderMap = () => {
            const container = document.getElementById(mapId + '-container');
            if (!container || !window.L) return;
            
            try {
                const data = JSON.parse(code);
                
                // Clear container and set deterministic size for rasterization
                const mapDiv = document.createElement('div');
                mapDiv.id = mapId;
                mapDiv.style.cssText = 'width: 100%; height: 300px;';
                container.innerHTML = '';
                container.appendChild(mapDiv);
                
                // Create the map — SVG basemap (not canvas) to avoid tile-clipping bands at world zoom
                const offlineVector = !this.options.allowExternalFetch;
                const mapOptions = {
                    zoomAnimation: !offlineVector,
                    fadeAnimation: !offlineVector
                };
                if (offlineVector) {
                    mapOptions.minZoom = 2;
                    mapOptions.maxBounds = [[-84, -180], [84, 180]];
                    mapOptions.maxBoundsViscosity = 0.85;
                }
                const map = L.map(mapId, mapOptions);
                if (offlineVector) {
                    map.getContainer().classList.add('qde-offline-map');
                    const tilePane = map.getPane('tilePane');
                    if (tilePane) tilePane.style.display = 'none';
                }

                // Store back-reference for capture (per Gem's guide)
                container._map = map; // Avoid window pollution

                // Add basemap — vector (offline) or OSM tiles (online)
                let tileLayer = null;
                const isDark = this.container.classList.contains('qde-dark');
                if (!this.options.allowExternalFetch && window._qde_worldGeoJSON) {
                    const basemapStyle = (zoom) => ({
                        weight: zoom < 4 ? 0.45 : zoom < 6 ? 0.75 : (isDark ? 1 : 1.1),
                        color: isDark ? '#b8b8b8' : '#1a1a1a',
                        fillColor: isDark ? '#3a3a3e' : '#ebe6d9',
                        fillOpacity: 1
                    });
                    const admin1Style = (zoom) => ({
                        weight: zoom < 6 ? 0.45 : (isDark ? 0.5 : 0.6),
                        color: isDark ? '#666' : '#555',
                        fillOpacity: 0,
                        fill: false
                    });

                    // Country fills — SVG renderer (canvas tiles clip large polygons at low zoom)
                    const countriesLayer = L.geoJSON(window._qde_worldGeoJSON, {
                        smoothFactor: 1.5,
                        style: () => basemapStyle(map.getZoom()),
                        interactive: false
                    }).addTo(map);

                    // Admin-1 hidden when zoomed out (dense lines read as horizontal banding)
                    let admin1Layer = null;
                    if (window._qde_admin1GeoJSON) {
                        admin1Layer = L.geoJSON(window._qde_admin1GeoJSON, {
                            smoothFactor: 1,
                            style: () => admin1Style(map.getZoom()),
                            interactive: false
                        });
                    }

                    const syncBasemapForZoom = () => {
                        const z = map.getZoom();
                        countriesLayer.setStyle(basemapStyle(z));
                        if (admin1Layer) {
                            if (z >= 5) {
                                admin1Layer.setStyle(admin1Style(z));
                                if (!map.hasLayer(admin1Layer)) admin1Layer.addTo(map);
                            } else if (map.hasLayer(admin1Layer)) {
                                map.removeLayer(admin1Layer);
                            }
                        }
                    };
                    map.on('zoomend', syncBasemapForZoom);
                    syncBasemapForZoom();
                } else {
                    // Standard OSM tiles
                    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '',
                        crossOrigin: 'anonymous' // Important for canvas capture
                    });
                    tileLayer.addTo(map);
                }
                
                // Add GeoJSON layer
                const geoJsonLayer = L.geoJSON(data);
                geoJsonLayer.addTo(map);
                
                // Fit bounds if valid
                const bounds = geoJsonLayer.getBounds();
                if (bounds.isValid()) {
                    const sw = bounds.getSouthWest();
                    const ne = bounds.getNorthEast();
                    if (sw.lat === ne.lat && sw.lng === ne.lng) {
                        // Single point — setView instead of fitBounds to avoid NaN
                        map.setView([sw.lat, sw.lng], 8);
                    } else {
                        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6 });
                    }
                } else {
                    map.setView([0, 0], 2);
                }
                
                // Store references for copy-time capture
                container._tileLayer = tileLayer;
                container._geoJsonLayer = geoJsonLayer;
                
                // Optional: Wait for tiles to load for better capture
                if (tileLayer) {
                    tileLayer.on('load', () => {
                        container.setAttribute('data-tiles-loaded', 'true');
                    });
                } else {
                    // Vector basemap — tiles always "loaded"
                    container.setAttribute('data-tiles-loaded', 'true');
                }
                
            } catch (err) {
                container.innerHTML = `<pre class="qde-error">GeoJSON error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };
        
        // Check if Leaflet is already loaded
        const runRender = () => {
            const needBasemap = !this.options.allowExternalFetch
                && !window._qde_worldGeoJSON
                && typeof window._qde_ensureBasemap === 'function';
            if (needBasemap) {
                window._qde_ensureBasemap(this.options.assetBase).then(() => renderMap()).catch(err => {
                    const el = document.getElementById(mapId + '-container');
                    if (el) {
                        el.innerHTML = `<pre class="qde-error">Basemap load failed: ${this.escapeHtml(err.message)}</pre>`;
                    }
                });
            } else {
                renderMap();
            }
        };

        if (window.L) {
            // Render after DOM update
            setTimeout(runRender, 0);
        } else {
            // Lazy load Leaflet only if not already loading
            if (!window._qde_leaflet_loading) {
                window._qde_leaflet_loading = this.lazyLoadLibrary(
                    'Leaflet',
                    () => window.L,
                    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
                    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                ).catch(err => {
                    console.warn('Failed to load Leaflet:', err);
                    // Clear the loading promise so it can be retried
                    window._qde_leaflet_loading = null;
                    return false;
                });
            }
            
            window._qde_leaflet_loading.then(loaded => {
                if (loaded) {
                    runRender();
                } else {
                    const element = document.getElementById(mapId + '-container');
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load map library</div>';
                    }
                }
            }).catch(() => {
                // Error already handled above
            });
        }
        
        // Return container following SquibView pattern
        const container = document.createElement('div');
        container.className = 'geojson-container';
        container.id = mapId + '-container';
        container.style.cssText = 'width: 100%; height: 300px; border: 1px solid #ddd; border-radius: 4px; margin: 0.5em 0; background: #f0f0f0;';
        container.contentEditable = 'false';
        
        // Preserve source for copy-time identification (per Gem's guide)
        container.setAttribute('data-source-type', 'geojson');
        container.setAttribute('data-original-source', this.escapeHtml(code));
        
        // For bidirectional editing
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', 'geojson');
        container.setAttribute('data-qd-source', code);
        
        container.textContent = 'Loading map...';
        
        return container.outerHTML;
    }
    
    /**
     * Render STL 3D model
     */
    renderSTL(code) {
        const id = `qde-stl-viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Function to render the 3D model (assumes window.THREE is loaded)
        const render3D = () => {
            const element = document.getElementById(id);
            if (!element) return;

            try {
                const THREE = window.THREE;
                
                // Create scene
                const scene = new THREE.Scene();
                scene.background = new THREE.Color(0xf0f0f0);
                
                // Create camera
                const camera = new THREE.PerspectiveCamera(75, element.clientWidth / 400, 0.1, 1000);
                
                // Create renderer
                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(element.clientWidth, 400);
                element.innerHTML = '';
                element.appendChild(renderer.domElement);
                
                // Store Three.js references for copy functionality (like squibview)
                element._threeScene = scene;
                element._threeCamera = camera;
                element._threeRenderer = renderer;
                
                // Parse STL data (ASCII format)
                const geometry = this.parseSTL(code);
                const material = new THREE.MeshLambertMaterial({ color: 0x0066ff });
                const mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);
                
                // Add lighting
                const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
                scene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(1, 1, 1).normalize();
                scene.add(directionalLight);
                
                // Position camera based on object bounds
                const box = new THREE.Box3().setFromObject(mesh);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                
                camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
                camera.lookAt(center);
                
                // Animate
                const animate = () => {
                    requestAnimationFrame(animate);
                    mesh.rotation.y += 0.01;
                    renderer.render(scene, camera);
                };
                animate();
            } catch (err) {
                console.error('STL rendering error:', err);
                element.innerHTML = `<pre class="qde-error">STL error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };
        
        // If Three.js is already loaded, render immediately. Otherwise lazy-load
        // it from a CDN (matches the GeoJSON/Leaflet pattern).
        if (window.THREE) {
            setTimeout(render3D, 0);
        } else {
            if (!window._qde_three_loading) {
                window._qde_three_loading = this.lazyLoadLibrary(
                    'Three.js',
                    () => window.THREE,
                    'https://unpkg.com/three@0.147.0/build/three.min.js'
                ).catch(_err => {
                    console.warn('Failed to load Three.js for STL rendering');
                    window._qde_three_loading = null;
                    return false;
                });
            }
            window._qde_three_loading.then(loaded => {
                if (loaded) {
                    render3D();
                } else {
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load Three.js for STL rendering</div>';
                    }
                }
            });
        }

        // Return placeholder with data-stl-id for copy functionality
        return `<div id="${id}" class="qde-stl-container" data-stl-id="${id}" data-qd-fence="\`\`\`" data-qd-lang="stl" data-qd-source="${this.escapeHtml(code)}" contenteditable="false" style="height: 400px; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">Loading 3D model...</div>`;
    }
    
    /**
     * Parse ASCII STL format
     * @param {string} stlData - The STL file content
     * @returns {THREE.BufferGeometry} - The parsed geometry
     */
    parseSTL(stlData) {
        const THREE = window.THREE;
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        
        const lines = stlData.split('\n');
        let currentNormal = null;
        
        for (let line of lines) {
            line = line.trim();
            
            if (line.startsWith('facet normal')) {
                const parts = line.split(/\s+/);
                currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
            } else if (line.startsWith('vertex')) {
                const parts = line.split(/\s+/);
                vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                if (currentNormal) {
                    normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
                }
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        
        return geometry;
    }

    /**
     * Render ABC music notation
     */
    renderABC(code) {
        const id = `qde-abc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const renderNotation = () => {
            const element = document.getElementById(id);
            if (!element || !window.ABCJS) return;
            try {
                element.innerHTML = '';
                window.ABCJS.renderAbc(element, code, { responsive: 'resize' });
            } catch (err) {
                element.innerHTML = `<pre class="qde-error">ABC notation error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };

        if (window.ABCJS) {
            setTimeout(renderNotation, 0);
        } else {
            if (!window._qde_abcjs_loading) {
                window._qde_abcjs_loading = this.lazyLoadLibrary(
                    'ABCJS',
                    () => window.ABCJS,
                    'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js'
                ).catch(err => {
                    console.warn('Failed to load ABCJS:', err);
                    window._qde_abcjs_loading = null;
                    return false;
                });
            }
            window._qde_abcjs_loading.then(loaded => {
                if (loaded) {
                    renderNotation();
                } else {
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load ABC notation library</div>';
                    }
                }
            });
        }

        const container = document.createElement('div');
        container.id = id;
        container.className = 'qde-abc-container';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-source', code);
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', 'abc');
        container.style.cssText = 'min-height: 80px; margin: 0.5em 0;';
        container.textContent = 'Loading music notation...';

        return container.outerHTML;
    }

    /**
     * Render Vega or Vega-Lite visualization
     */
    renderVega(code, lang) {
        const id = `qde-vega-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const renderChart = () => {
            const element = document.getElementById(id);
            if (!element || !window.vegaEmbed) return;
            try {
                const spec = JSON.parse(code);
                // If using vega-lite alias, ensure $schema is set for vega-lite
                if ((lang === 'vega-lite' || lang === 'vegalite') && !spec.$schema) {
                    spec.$schema = 'https://vega.github.io/schema/vega-lite/v5.json';
                }
                // Warn about external URL data sources when allowExternalFetch is off
                if (!this.options.allowExternalFetch) {
                    const specStr = JSON.stringify(spec);
                    if (/"url"\s*:/.test(specStr)) {
                        element.innerHTML = '<div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404; font-size: 0.9em;">⚠ This Vega spec references external data URLs. External fetch is disabled in offline mode. Use inline <code>"values"</code> instead.</div>';
                        return;
                    }
                }
                window.vegaEmbed(element, spec, { renderer: 'svg', actions: false }).catch(err => {
                    element.innerHTML = `<pre class="qde-error">Vega error: ${this.escapeHtml(err.message)}</pre>`;
                });
            } catch (err) {
                element.innerHTML = `<pre class="qde-error">Vega JSON error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };

        if (window.vegaEmbed) {
            setTimeout(renderChart, 0);
        } else {
            if (!window._qde_vega_loading) {
                // Vega-Embed requires vega + vega-lite loaded first (peer deps)
                window._qde_vega_loading = (async () => {
                    try {
                        await this.loadScript('https://cdn.jsdelivr.net/npm/vega@5');
                        await this.loadScript('https://cdn.jsdelivr.net/npm/vega-lite@5');
                        await this.loadScript('https://cdn.jsdelivr.net/npm/vega-embed@6');
                        return !!window.vegaEmbed;
                    } catch (err) {
                        console.warn('Failed to load Vega:', err);
                        window._qde_vega_loading = null;
                        return false;
                    }
                })();
            }
            window._qde_vega_loading.then(loaded => {
                if (loaded) {
                    renderChart();
                } else {
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load Vega visualization library</div>';
                    }
                }
            });
        }

        const container = document.createElement('div');
        container.id = id;
        container.className = 'qde-vega-container';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-source', code);
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', lang);
        container.style.cssText = 'min-height: 100px; margin: 0.5em 0;';
        container.textContent = 'Loading visualization...';

        return container.outerHTML;
    }

    /**
     * Render Mermaid diagram
     */
    renderMermaid(code) {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element && window.mermaid) {
                mermaid.render(id + '-svg', code).then(result => {
                    element.innerHTML = result.svg;
                }).catch(err => {
                    element.innerHTML = `<pre>Error rendering diagram: ${this.escapeHtml(err.message)}</pre>`;
                });
            }
        }, 0);
        
        // Create container programmatically
        const container = document.createElement('div');
        container.id = id;
        container.className = 'mermaid';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-source', code);
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', 'mermaid');
        container.textContent = 'Loading diagram...';
        
        return container.outerHTML;
    }
    
    /**
     * Escape HTML for attributes
     */
    escapeHtml(text) {
        return (text ?? "").replace(/[&"'<>]/g, m => 
            ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[m]));
    }
    
    /**
     * Load plugins dynamically — honors both `plugins: { highlightjs, mermaid }`
     * (legacy) and the newer `preloadFences` option which can preload any
     * combination of fence libraries (or 'all') at construction time.
     */
    async loadPlugins() {
        const namesToLoad = new Set();

        // Legacy plugins option
        if (this.options.plugins.highlightjs) namesToLoad.add('highlightjs');
        if (this.options.plugins.mermaid)     namesToLoad.add('mermaid');

        // New preloadFences option
        const pf = this.options.preloadFences;
        if (pf === 'all') {
            Object.keys(this._fenceLibraries).forEach(n => namesToLoad.add(n));
        } else if (Array.isArray(pf)) {
            for (const entry of pf) {
                if (typeof entry === 'string') {
                    if (this._fenceLibraries[entry]) namesToLoad.add(entry);
                    else console.warn(`QuikdownEditor: unknown preloadFences entry "${entry}"`);
                } else if (entry && typeof entry === 'object' && entry.script) {
                    // Custom library: { name, script, css? }
                    namesToLoad.add('__custom__:' + (entry.name || entry.script));
                    this._fenceLibraries['__custom__:' + (entry.name || entry.script)] = {
                        check: () => false,
                        script: entry.script,
                        css: entry.css
                    };
                }
            }
        } else if (pf) {
            console.warn('QuikdownEditor: preloadFences should be "all", an array, or null');
        }

        // Load each in parallel; respect already-loaded state
        const promises = [];
        for (const name of namesToLoad) {
            const lib = this._fenceLibraries[name];
            if (!lib || lib.check()) continue;
            if (lib.beforeLoad) lib.beforeLoad();
            const p = (async () => {
                try {
                    const tasks = [];
                    // scripts (array) = sequential deps; script (string) = single load
                    if (lib.scripts) {
                        for (const s of lib.scripts) await this.loadScript(s);
                    } else if (lib.script) {
                        tasks.push(this.loadScript(lib.script));
                    }
                    // Only the highlight.js pair is theme-switched by id; other
                    // libraries' CSS must stay enabled in both themes.
                    if (lib.css)    tasks.push(this.loadCSS(lib.css, lib.cssDark ? 'qde-hljs-light' : undefined));
                    if (lib.cssDark) tasks.push(this.loadCSS(lib.cssDark, 'qde-hljs-dark'));
                    await Promise.all(tasks);
                    if (lib.css && lib.cssDark) this._syncHljsTheme();
                    if (lib.afterLoad) lib.afterLoad();
                } catch (err) {
                    if (lib.onError) lib.onError();
                    console.warn(`QuikdownEditor: failed to preload ${name}:`, err);
                }
            })();
            promises.push(p);
        }

        await Promise.all(promises);
    }
    
    /**
     * Lazy load library if not already loaded
     */
    async lazyLoadLibrary(name, check, scriptUrl, cssUrl = null) {
        // Check if library is already loaded
        if (check()) {
            return true;
        }
        
        try {
            const promises = [];
            
            // Load script
            if (scriptUrl) {
                promises.push(this.loadScript(scriptUrl));
            }
            
            // Load CSS if provided
            if (cssUrl) {
                promises.push(this.loadCSS(cssUrl));
            }
            
            await Promise.all(promises);
            
            // Verify library loaded
            return check();
        } catch (err) {
            console.error(`Failed to load ${name}:`, err);
            return false;
        }
    }
    
    /**
     * Load external script
     */
    loadScript(src) {
        const pending = scriptLoads.get(src);
        if (pending && pending.script.isConnected) return pending.promise;

        const script = document.createElement('script');
        const promise = new Promise((resolve, reject) => {
            script.src = src;
            script.onload = (event) => {
                scriptLoads.delete(src);
                resolve(event);
            };
            script.onerror = (event) => {
                scriptLoads.delete(src);
                script.remove();
                reject(event);
            };
            document.head.appendChild(script);
        });
        scriptLoads.set(src, { script, promise });
        return promise;
    }
    
    /**
     * Load external CSS
     */
    loadCSS(href, id) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            if (id) link.id = id;
            link.onload = resolve;
            document.head.appendChild(link);
            // Resolve anyway after timeout (CSS doesn't always fire onload)
            setTimeout(resolve, 1000);
        });
    }

    /**
     * Enable the hljs stylesheet matching the current theme and disable
     * the other one. Called from applyTheme and after hljs CSS loads.
     */
    _syncHljsTheme() {
        const isDark = this.container.classList.contains('qde-dark');
        const light = document.getElementById('qde-hljs-light');
        const dark  = document.getElementById('qde-hljs-dark');
        if (light) light.disabled = isDark;
        if (dark)  dark.disabled  = !isDark;
    }

    /**
     * Apply the current theme (based on this.options.theme)
     */
    applyTheme() {
        const theme = this.options.theme;

        // Tear down any previous auto-mode listener so we don't stack them
        if (this._autoThemeListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this._autoThemeListener);
            this._autoThemeListener = null;
        }

        if (theme === 'auto') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            this.container.classList.toggle('qde-dark', mq.matches);
            this._autoThemeListener = (e) => {
                this.container.classList.toggle('qde-dark', e.matches);
                this._syncHljsTheme();
            };
            mq.addEventListener('change', this._autoThemeListener);
        } else {
            this.container.classList.toggle('qde-dark', theme === 'dark');
        }
        this._syncHljsTheme();
    }

    /**
     * Set theme at runtime. Accepts 'light', 'dark', or 'auto'.
     * @param {'light'|'dark'|'auto'} theme
     */
    setTheme(theme) {
        if (!['light', 'dark', 'auto'].includes(theme)) return;
        this.options.theme = theme;
        this.applyTheme();
    }

    /**
     * Get the current theme option (as configured, not resolved).
     * @returns {'light'|'dark'|'auto'}
     */
    getTheme() {
        return this.options.theme;
    }
    
    /**
     * Set lazy linefeeds option
     * @param {boolean} enabled - Whether to enable lazy linefeeds
     */
    setLazyLinefeeds(enabled) {
        this.options.lazy_linefeeds = enabled;
        // Re-render if we have content
        if (this._markdown) {
            this.updateFromMarkdown(this._markdown);
        }
    }
    
    /**
     * Get lazy linefeeds option
     * @returns {boolean}
     */
    getLazyLinefeeds() {
        return this.options.lazy_linefeeds;
    }
    
    /**
     * Set debounce delay for input updates
     * @param {number} delay - Delay in milliseconds (0 for instant)
     */
    setDebounceDelay(delay) {
        this.options.debounceDelay = Math.max(0, delay);
    }
    
    /**
     * Get current debounce delay
     * @returns {number} Delay in milliseconds
     */
    getDebounceDelay() {
        return this.options.debounceDelay;
    }
    
    /**
     * Set editor mode
     */
    setMode(mode) {
        if (!['source', 'preview', 'split'].includes(mode)) return;

        // Apply any edit still waiting on the debounce timer before the
        // panes change visibility.
        this.flush();

        const previousMode = this.currentMode;
        this.currentMode = mode;

        // Swap only the editor's own mode classes; the theme class and any
        // classes the host put on the element stay.
        const classes = this.container.classList;
        classes.add('qde-container');
        classes.remove('qde-mode-source', 'qde-mode-split', 'qde-mode-preview', 'qde-split-preview');
        classes.add(`qde-mode-${mode}`);

        this._syncSplitToggle();

        // Update toolbar buttons
        if (this.toolbar) {
            this.toolbar.querySelectorAll('.qde-btn[data-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }

        // If the preview was hidden (source-only) it may have missed content
        // updates. Re-render it now, including MathJax typesetting.
        // Do NOT re-render if the preview was already visible — that would
        // destroy MathJax-typeset SVG output with raw pre-typeset HTML.
        if (mode !== 'source' && previousMode === 'source' && this._html) {
            this._renderPreview();
        }

        // Trigger mode change event
        if (this.options.onModeChange) {
            this.options.onModeChange(mode);
        }
    }
    
    // --- Undo / Redo ---

    /**
     * Push current markdown state onto the undo stack (called before a change).
     * Only pushes if the new state differs from the current state.
     * @param {string} newMarkdown - the incoming markdown (used to detect no-op)
     * @private
     */
    _pushUndoState(newMarkdown) {
        // Don't push if the content hasn't actually changed
        if (newMarkdown === this._markdown) return;

        this._undoStack.push(this._markdown);

        // Enforce max stack size
        const max = this.options.undoStackSize || 100;
        if (this._undoStack.length > max) {
            this._undoStack.splice(0, this._undoStack.length - max);
        }

        // Any new edit clears the redo stack
        this._redoStack = [];
        this._updateUndoButtons();
    }

    /**
     * Undo the last change. Restores the previous markdown state.
     */
    undo() {
        this.flush();
        if (!this.canUndo()) return;
        // Save current state to redo stack
        this._redoStack.push(this._markdown);
        const previous = this._undoStack.pop();
        this._isUndoRedo = true;
        this.sourceTextarea.value = previous;
        this.updateFromMarkdown(previous, 'undo');
    }

    /**
     * Redo the last undone change.
     */
    redo() {
        this.flush();
        if (!this.canRedo()) return;
        // Save current state to undo stack
        this._undoStack.push(this._markdown);
        const next = this._redoStack.pop();
        this._isUndoRedo = true;
        this.sourceTextarea.value = next;
        this.updateFromMarkdown(next, 'redo');
    }

    /**
     * @returns {boolean} true if undo is possible
     */
    canUndo() {
        return this._undoStack.length > 0;
    }

    /**
     * @returns {boolean} true if redo is possible
     */
    canRedo() {
        return this._redoStack.length > 0;
    }

    /**
     * Clear the undo and redo history.
     */
    clearHistory() {
        this._undoStack = [];
        this._redoStack = [];
        this._updateUndoButtons();
    }

    /**
     * Snapshot of the undo and redo stacks, for hosts that keep one
     * history per document. The arrays are copies.
     * @returns {{undo: string[], redo: string[]}}
     */
    getHistory() {
        this.flush();
        return { undo: this._undoStack.slice(), redo: this._redoStack.slice() };
    }

    /**
     * Replace the undo and redo stacks with a snapshot from getHistory().
     * @param {{undo?: string[], redo?: string[]}} [state] omitted or invalid parts become empty
     */
    setHistory(state) {
        const clean = list => (Array.isArray(list) ? list.filter(item => typeof item === 'string') : []);
        const max = this.options.undoStackSize || 100;
        this._undoStack = clean(state && state.undo).slice(-max);
        this._redoStack = clean(state && state.redo).slice(-max);
        this._updateUndoButtons();
    }

    /**
     * Update the disabled state of the undo/redo toolbar buttons.
     * @private
     */
    _updateUndoButtons() {
        if (!this.toolbar) return;
        const undoBtn = this.toolbar.querySelector('[data-action="undo"]');
        const redoBtn = this.toolbar.querySelector('[data-action="redo"]');
        if (undoBtn) {
            undoBtn.classList.toggle('disabled', !this.canUndo());
        }
        if (redoBtn) {
            redoBtn.classList.toggle('disabled', !this.canRedo());
        }
    }

    /**
     * Handle toolbar actions
     */
    handleAction(action) {
        switch(action) {
            case 'copy-markdown':
                this.copy('markdown');
                break;
            case 'copy-html':
                this.copy('html');
                break;
            case 'copy-rendered':
                this.copyRendered();
                break;
            case 'remove-hr':
                this.removeHR();
                break;
            case 'lazy-linefeeds':
                this.convertLazyLinefeeds();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'toggle-html-mode':
                this.cycleAllowUnsafeHTML();
                break;
        }
    }
    
    /**
     * Copy content to clipboard
     */
    async copy(type) {
        this.flush();
        const content = type === 'markdown' ? this._markdown : this._html;
        
        try {
            await navigator.clipboard.writeText(content);
            
            // Visual feedback
            const btn = this.toolbar?.querySelector(`[data-action="copy-${type}"]`);
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                this._later(() => {
                    btn.textContent = originalText;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
    
    // Public API
    
    /**
     * Get current markdown
     */
    get markdown() {
        return this._markdown;
    }
    
    /**
     * Set markdown content
     */
    set markdown(value) {
        this.setMarkdown(value);
    }
    
    /**
     * Get current HTML
     */
    get html() {
        return this._html;
    }
    
    /**
     * Get current mode
     */
    get mode() {
        return this.currentMode;
    }
    
    /**
     * Get current mode: 'source', 'split' or 'preview'.
     * @returns {'source'|'split'|'preview'}
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * Choose which pane split mode shows when the editor is too narrow to
     * show both side by side (the toolbar's Preview/Source toggle). On a wide
     * editor both panes stay visible and this has no visible effect. Changing
     * mode with setMode() resets it to 'source'.
     * @param {'source'|'preview'} pane
     */
    setSplitPane(pane) {
        if (pane !== 'source' && pane !== 'preview') return;
        this.container.classList.toggle('qde-split-preview', pane === 'preview');
        this._syncSplitToggle();
    }

    /**
     * The pane split mode shows on a narrow editor: 'source' or 'preview'.
     * @returns {'source'|'preview'}
     */
    getSplitPane() {
        return this.container.classList.contains('qde-split-preview') ? 'preview' : 'source';
    }

    // The toggle button names the pane a click would switch to
    _syncSplitToggle() {
        const label = this.getSplitPane() === 'preview' ? 'Source' : 'Preview';
        this.toolbar?.querySelectorAll('.qde-split-toggle').forEach(toggle => { toggle.textContent = label; });
    }

    /**
     * Set markdown content
     * @param {string} markdown
     * @param {Object} [options]
     * @param {'keep'|'reset'|'push'} [options.history='keep'] 'keep' leaves the
     *        undo history as it is, 'reset' clears it (use when loading a
     *        different document), 'push' records the replaced text as an undo step
     * @param {string} [options.source='api'] reported to onChange as meta.source
     */
    async setMarkdown(markdown, options = {}) {
        // Wait for initialization if needed
        if (this.initPromise) {
            await this.initPromise;
        }
        if (this._destroyed) return;
        this._load(markdown, options.source || 'api', options.history);
    }

    /**
     * Synchronous core of setMarkdown().
     * @private
     */
    _load(markdown, source, history) {
        const text = markdown === null || markdown === undefined ? '' : String(markdown);
        clearTimeout(this.updateTimer);
        this._pending = null;
        if (history === 'reset') {
            this._undoStack = [];
            this._redoStack = [];
        }
        // 'keep' (the default) replaces the text without adding an undo step
        if (history !== 'push') this._isUndoRedo = true;
        this.sourceTextarea.value = text;
        this.updateFromMarkdown(text, source);
    }

    /**
     * Get markdown content
     */
    getMarkdown() {
        this.flush();
        return this._markdown;
    }

    /**
     * Get HTML content
     */
    getHTML() {
        this.flush();
        return this._html;
    }

    // --- Selection, cursor and text edits ---

    /**
     * Which pane has keyboard focus.
     * @returns {'source'|'preview'|null} null when focus is outside the editor
     */
    getFocusedPane() {
        const active = document.activeElement;
        if (active === this.sourceTextarea) return 'source';
        if (active && this.previewPanel.contains(active)) return 'preview';
        return null;
    }

    /**
     * The pane API calls act on: the focused pane, else the pane the user
     * last worked in, limited to what the current mode shows.
     * @private
     */
    _activePane() {
        if (this.currentMode === 'source') return 'source';
        if (this.currentMode === 'preview') return 'preview';
        return this.getFocusedPane() || this._lastPane || 'source';
    }

    /** @private */
    _inPreview(range) {
        return this.previewPanel.contains(range.startContainer) && this.previewPanel.contains(range.endContainer);
    }

    /**
     * Current (or last seen) selection range inside the preview.
     * @private
     */
    _previewRange() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && this._inPreview(sel.getRangeAt(0))) return sel.getRangeAt(0);
        if (this._savedRange && this._inPreview(this._savedRange)) return this._savedRange;
        return null;
    }

    /**
     * Convert a copy of the preview to markdown after `mark(clone, locate)`
     * has dropped marker text into the copy. `locate(node)` returns the
     * copy's counterpart of a node in the live preview.
     * @private
     */
    _markedMarkdown(mark) {
        const clone = this.previewPanel.cloneNode(true);
        const locate = (node) => {
            const path = [];
            for (let n = node; n !== this.previewPanel; n = n.parentNode) {
                path.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n));
            }
            return path.reduce((at, index) => at.childNodes[index], clone);
        };
        mark(clone, locate);
        this.preprocessSpecialElements(clone);
        return quikdown_bd.toMarkdown(clone, { fence_plugin: this.createFencePlugin() });
    }

    /**
     * The preview selection as offsets into the markdown the preview
     * converts to. Null when there is no selection in the preview or its
     * ends fall inside content that has no text of its own in the markdown.
     * @private
     */
    _previewSelection() {
        const range = this._previewRange();
        if (!range) return null;
        const marked = this._markedMarkdown((clone, locate) => {
            const put = (node, offset, mark) => {
                const target = locate(node);
                if (target.nodeType === 3) target.insertData(offset, mark);
                else target.insertBefore(document.createTextNode(mark), target.childNodes[offset] || null);
            };
            // End first, so the start offset is still valid in a shared node
            put(range.endContainer, range.endOffset, MARK_END);
            put(range.startContainer, range.startOffset, MARK_START);
        });
        const a = marked.indexOf(MARK_START);
        const b = marked.indexOf(MARK_END);
        if (a === -1 || b === -1) return null;
        return {
            markdown: marked.replace(MARKS_RE, ''),
            start: Math.min(a, b),
            end: Math.max(a, b) - 1
        };
    }

    /**
     * Current selection as character offsets into the markdown, whichever
     * pane the user is in. A caret is a selection with start === end.
     * @returns {{start: number, end: number, text: string, pane: 'source'|'preview'}}
     */
    getSelection() {
        this.flush();
        const pane = this._activePane();
        const md = this._markdown;
        if (pane === 'preview') {
            const found = this._previewSelection();
            if (found) {
                const start = mapOffset(found.markdown, md, found.start);
                const end = Math.max(start, mapOffset(found.markdown, md, found.end));
                return { start, end, text: md.slice(start, end), pane };
            }
        }
        const start = Math.min(md.length, this.sourceTextarea.selectionStart || 0);
        const end = Math.min(md.length, Math.max(start, this.sourceTextarea.selectionEnd || 0));
        return { start, end, text: md.slice(start, end), pane };
    }

    /**
     * Select a range of the markdown (or place the caret when end is omitted).
     * In the rendered pane the matching rendered text is selected.
     * @param {number} start
     * @param {number} [end=start]
     * @param {'source'|'preview'} [pane] defaults to the pane the user is in
     * @returns {{start: number, end: number}} the clamped range
     */
    setSelection(start, end = start, pane) {
        this.flush();
        const len = this._markdown.length;
        let a = Math.max(0, Math.min(len, Number(start) || 0));
        let b = Math.max(0, Math.min(len, Number(end) || 0));
        if (a > b) [a, b] = [b, a];

        // The source pane always carries the selection, so it is already
        // in place when the user switches panes.
        this.sourceTextarea.setSelectionRange(a, b);

        const target = pane === 'source' || pane === 'preview' ? pane : this._activePane();
        if (target === 'preview' && this.currentMode !== 'source') {
            this._selectInPreview(a, b);
        }
        this._lastSelKey = '';
        return { start: a, end: b };
    }

    /**
     * Select the rendered text that corresponds to markdown offsets.
     * Renders a marked copy of the document off-screen to find where the
     * two ends land, then selects the same places in the live preview.
     * @private
     */
    _selectInPreview(start, end) {
        // The live preview must be an untouched render for positions found
        // in the off-screen copy to line up with it.
        if (!this._previewFresh) this._renderPreview();

        const md = this._markdown;
        const a = skipBlockPrefix(md, start);
        const b = Math.max(a, skipBlockPrefix(md, end));
        const scratch = document.createElement('div');
        scratch.innerHTML = this._renderMarkdown(md.slice(0, a) + MARK_START + md.slice(a, b) + MARK_END + md.slice(b));

        // Find a marker in the copy, remove it, and describe where it was.
        const take = (mark) => {
            const walker = document.createTreeWalker(scratch, 4 /* NodeFilter.SHOW_TEXT */);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const at = node.data.indexOf(mark);
                if (at === -1) continue;
                node.deleteData(at, 1);
                let anchor = node;
                let offset = at;
                let text = node.data.replace(MARKS_RE, '');
                if (text === '') {
                    // The marker stood alone between elements
                    anchor = node.parentNode;
                    offset = Array.prototype.indexOf.call(anchor.childNodes, node);
                    anchor.removeChild(node);
                    text = null;
                }
                const path = [];
                for (let n = anchor; n !== scratch; n = n.parentNode) {
                    path.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n));
                }
                return { path, offset, text };
            }
            return null;
        };

        // Resolve a description against the live preview, or fall back to
        // the start of the block that holds the offset.
        const resolve = (point, offset) => {
            if (point) {
                let node = this.previewPanel;
                for (const index of point.path) {
                    node = node && node.childNodes[index];
                }
                if (node && point.text !== null && node.nodeType === 3 && node.data === point.text) {
                    return [node, Math.min(point.offset, node.data.length)];
                }
                if (node && point.text === null && node.nodeType === 1 && point.offset <= node.childNodes.length) {
                    return [node, point.offset];
                }
            }
            const block = this._blockAt(this._markdown.slice(0, offset).split('\n').length - 1);
            return [block || this.previewPanel, 0];
        };

        const from = resolve(take(MARK_START), start);
        const to = start === end ? from : resolve(take(MARK_END), end);
        const range = document.createRange();
        range.setStart(from[0], from[1]);
        range.setEnd(to[0], to[1]);
        if (range.collapsed && start !== end) range.setEnd(from[0], from[1]);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        this._savedRange = range.cloneRange();
    }

    /**
     * Move keyboard focus into the editor.
     * @param {'source'|'preview'} [pane] defaults to the pane the user is in;
     *        a pane the current mode hides falls back to the visible one
     */
    focus(pane) {
        let target = pane === 'source' || pane === 'preview' ? pane : this._activePane();
        if (this.currentMode === 'source') target = 'source';
        if (this.currentMode === 'preview') target = 'preview';
        this._lastPane = target;
        if (target === 'source') {
            this.sourceTextarea.focus();
            return;
        }
        this.previewPanel.focus();
        if (this._savedRange && this._inPreview(this._savedRange)) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this._savedRange);
        }
    }

    /**
     * Replace the document with an edited version and restore view state.
     * Every programmatic edit goes through here so it reaches the history,
     * the other pane and onChange the same way typing does.
     * @private
     */
    _applyEdit(markdown, start, end, source, pane) {
        clearTimeout(this.updateTimer);
        this._pending = null;
        const scroll = this.getScroll();
        this.sourceTextarea.value = markdown;
        this.updateFromMarkdown(markdown, source);
        this.setScroll(scroll);
        return this.setSelection(start, end, pane);
    }

    /**
     * Replace a range of the markdown.
     * @param {number} start
     * @param {number} end
     * @param {string} text
     * @param {boolean} [select=false] select the inserted text instead of placing the caret after it
     * @returns {{start: number, end: number}} the resulting selection
     */
    replaceRange(start, end, text, select = false) {
        this.flush();
        const md = this._markdown;
        let a = Math.max(0, Math.min(md.length, Number(start) || 0));
        let b = Math.max(0, Math.min(md.length, Number(end) || 0));
        if (a > b) [a, b] = [b, a];
        const insert = text === null || text === undefined ? '' : String(text);
        const pane = this._activePane();
        const to = a + insert.length;
        return this._applyEdit(md.slice(0, a) + insert + md.slice(b), select ? a : to, to, 'edit', pane);
    }

    /**
     * Insert text at the caret, replacing the selection if there is one.
     * @param {string} text
     * @returns {{start: number, end: number}} the caret after the inserted text
     */
    insertText(text) {
        const sel = this.getSelection();
        return this.replaceRange(sel.start, sel.end, text);
    }

    // --- Formatting ---

    /**
     * Apply a formatting command to the selection in whichever pane the
     * user is in. Inline commands toggle.
     *
     * Commands: bold, italic, strike, code, link (value: URL; null removes),
     * h1…h6, heading (value: 0–6), paragraph, ul, ol, task, quote,
     * codeblock (value: language), hr, table (value: { rows, cols }),
     * indent, outdent.
     *
     * @param {string} command
     * @param {*} [value]
     * @returns {boolean} false for an unknown command
     */
    format(command, value) {
        const sel = this.getSelection();
        const next = formatMarkdown(this._markdown, sel.start, sel.end, command, value);
        if (!next) return false;
        if (next.markdown === this._markdown) {
            this.setSelection(next.start, next.end, sel.pane);
        } else {
            this._applyEdit(next.markdown, next.start, next.end, 'format', sel.pane);
        }
        return true;
    }

    /**
     * Formatting at the caret or selection, for toolbar pressed states.
     * @returns {{bold: boolean, italic: boolean, strike: boolean, code: boolean, link: boolean,
     *            heading: number, list: ('ul'|'ol'|'task'|null), quote: boolean, codeblock: boolean}}
     */
    getFormatState() {
        const sel = this.getSelection();
        return getFormatState(this._markdown, sel.start, sel.end);
    }

    // --- Scroll and line mapping ---

    /**
     * Scroll positions of both panes.
     * @returns {{source: number, preview: number}}
     */
    getScroll() {
        return { source: this.sourceTextarea.scrollTop, preview: this.previewPanel.scrollTop };
    }

    /**
     * Restore scroll positions from getScroll(). Either field may be omitted.
     * @param {{source?: number, preview?: number}} [scroll]
     */
    setScroll(scroll) {
        if (!scroll) return;
        if (Number.isFinite(scroll.source)) {
            this._scrollLock = null;
            this.sourceTextarea.scrollTop = scroll.source;
        }
        if (Number.isFinite(scroll.preview)) {
            this._scrollLock = null;
            this.previewPanel.scrollTop = scroll.preview;
        }
    }

    /**
     * Top-level preview blocks with the zero-based source line each starts on.
     * Built on demand (one HTML → markdown pass) and cached until the next
     * render or edit.
     * @private
     */
    _blockMap() {
        if (this._blocks) return this._blocks;
        const blocks = [];
        if (this._markdown.trim() && this.currentMode !== 'source') {
            const live = Array.from(this.previewPanel.children);
            const marked = this._markedMarkdown((clone) => {
                Array.from(clone.children).forEach((el, i) => {
                    clone.insertBefore(document.createTextNode(MARK_START + i + MARK_END), el);
                });
            });
            let clean = '';
            let last = 0;
            const found = [];
            marked.replace(/(\d+)/g, (match, index, at) => {
                clean += marked.slice(last, at);
                last = at + match.length;
                found.push({ el: live[Number(index)], offset: clean.length });
                return match;
            });
            clean += marked.slice(last);
            found.forEach(item => {
                let at = item.offset;
                while (at < clean.length && /\s/.test(clean[at])) at++;
                const offset = mapOffset(clean, this._markdown, at);
                blocks.push({ el: item.el, line: this._markdown.slice(0, offset).split('\n').length - 1 });
            });
        }
        this._blocks = blocks;
        return blocks;
    }

    /**
     * The preview block that holds a source line.
     * @private
     */
    _blockAt(line) {
        let hit = null;
        for (const block of this._blockMap()) {
            if (block.line > line && hit) break;
            hit = block.el;
        }
        return hit;
    }

    /**
     * Zero-based source line of an element in the rendered pane.
     * @param {Element} element
     * @returns {number} -1 when the element is not in the preview
     */
    lineOf(element) {
        this.flush();
        if (!element || element === this.previewPanel || !this.previewPanel.contains(element)) return -1;

        const lineAt = (marked) => {
            const at = marked.indexOf(MARK_START);
            if (at === -1) return -1;
            const clean = marked.replace(MARKS_RE, '');
            let pos = at;
            while (pos < clean.length && /\s/.test(clean[pos])) pos++;
            return this._markdown.slice(0, mapOffset(clean, this._markdown, pos)).split('\n').length - 1;
        };

        // A marker as the element's first text, then one just before it
        let line = lineAt(this._markedMarkdown((clone, locate) => {
            const target = locate(element);
            target.insertBefore(document.createTextNode(MARK_START), target.firstChild);
        }));
        if (line === -1) {
            line = lineAt(this._markedMarkdown((clone, locate) => {
                const target = locate(element);
                target.parentNode.insertBefore(document.createTextNode(MARK_START), target);
            }));
        }
        if (line !== -1) return line;

        // Fall back to the top-level block that contains the element
        let top = element;
        while (top.parentNode !== this.previewPanel) top = top.parentNode;
        const block = this._blockMap().find(item => item.el === top);
        return block ? block.line : -1;
    }

    /**
     * Scroll a zero-based source line into view.
     * @param {number} line
     * @param {'source'|'preview'} [pane] omitted scrolls both panes
     * @returns {Element|null} the preview block that was scrolled to, if any
     */
    scrollToLine(line, pane) {
        this.flush();
        const total = this._markdown.split('\n').length;
        const n = Math.max(0, Math.min(total - 1, Math.floor(Number(line)) || 0));
        let block = null;

        if (pane !== 'preview') {
            const ta = this.sourceTextarea;
            const lineHeight = parseFloat(window.getComputedStyle(ta).lineHeight);
            this._scrollLock = null;
            ta.scrollTop = Number.isFinite(lineHeight)
                ? n * lineHeight
                : (n / total) * ta.scrollHeight;
        }
        if (pane !== 'source' && this.currentMode !== 'source') {
            block = this._blockAt(n);
            if (block) {
                const panel = this.previewPanel;
                this._scrollLock = null;
                panel.scrollTop += block.getBoundingClientRect().top - panel.getBoundingClientRect().top;
            }
        }
        return block;
    }

    /**
     * Remove all horizontal rules (---) from markdown source.
     * Preserves content inside fences (``` or ~~~) and table separator rows.
     */
    async removeHR() {
        const cleaned = QuikdownEditor.removeHRFromMarkdown(this._markdown);
        await this.setMarkdown(cleaned);

        // Visual feedback if toolbar button exists
        const btn = this.toolbar?.querySelector('[data-action="remove-hr"]');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Removed!';
            this._later(() => {
                btn.textContent = originalText;
            }, 1500);
        }
    }

    /**
     * Static: remove horizontal rules from markdown string.
     * Safe for fences, tables, and all markdown constructs.
     * Can be used headless without an editor instance.
     * @param {string} markdown - source markdown
     * @returns {string} markdown with standalone HRs removed
     */
    static removeHRFromMarkdown(markdown) {
        const lines = (markdown || '').split('\n');
        const result = [];
        let inFence = false;
        let openChar = null;
        let openLen = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Track fence open/close
            if (!inFence) {
                const fo = fenceOpen(trimmed);
                if (fo) {
                    inFence = true;
                    openChar = fo.char;
                    openLen = fo.len;
                    result.push(line);
                    continue;
                }
            } else {
                if (isFenceClose(trimmed, openChar, openLen)) {
                    inFence = false;
                    openChar = null;
                    openLen = 0;
                }
                result.push(line);
                continue;
            }

            // Detect table row/separator with pipes — always keep
            if (/^\|.*\|$/.test(trimmed) || (/^[-| :]+$/.test(trimmed) && trimmed.includes('|'))) {
                result.push(line);
                continue;
            }

            // Check if this line is a standalone HR (no ReDoS — linear scan)
            if (isHRLine(trimmed)) {
                // Table separator heuristic: immediately adjacent lines (no blank
                // lines between) that look like table rows protect this HR-like line
                const prevLine = i > 0 ? lines[i - 1].trim() : '';
                const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
                if (looksLikeTableRow(prevLine) || looksLikeTableRow(nextLine)) {
                    result.push(line);
                    continue;
                }
                // It's a real HR — skip it
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    }

    /**
     * Convert lazy linefeeds in markdown source.
     * Replaces single newlines with double newlines (adds real line breaks)
     * except inside fences, tables, and other block-level constructs.
     * Idempotent: calling multiple times produces the same result.
     * Can be used as a toolbar action or headless via the static method.
     */
    async convertLazyLinefeeds() {
        const converted = QuikdownEditor.convertLazyLinefeeds(this._markdown);
        await this.setMarkdown(converted);

        // Visual feedback if toolbar button exists
        const btn = this.toolbar?.querySelector('[data-action="lazy-linefeeds"]');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Converted!';
            this._later(() => {
                btn.textContent = originalText;
            }, 1500);
        }
    }

    /**
     * Static: convert lazy linefeeds in markdown source.
     * Turns single \n between non-blank lines into \n\n so each line becomes
     * its own paragraph / hard break. Idempotent — already-doubled newlines
     * are not doubled again. Fences, tables, lists, blockquotes, headings,
     * and HTML blocks are left untouched.
     * @param {string} markdown - source markdown
     * @returns {string} markdown with lazy linefeeds resolved
     */
    static convertLazyLinefeeds(markdown) {
        // Two-phase approach (much cleaner than the old single pass):
        //
        //   Phase A: walk lines, classify each as { content, blank, fence }.
        //            Inside fences, lines are passed through verbatim.
        //   Phase B: emit lines with the rule:
        //            "between two adjacent CONTENT lines, ensure exactly one
        //             blank line — never zero, never more than one."
        //
        // The rule applies regardless of whether the content lines are
        // headings, lists, blockquotes, table rows, paragraphs, or HR — any
        // adjacent pair of non-fence non-blank lines gets exactly one blank
        // between them. This produces the cleanest possible output for any
        // input and is fully idempotent.
        //
        // Lines that are whitespace-only (e.g. "   ") are normalized to
        // empty strings, eliminating "phantom" blank lines.
        //
        // Lists are a special case: adjacent list items (same marker type)
        // should NOT get a blank line between them, otherwise we'd break
        // tight lists.
        //
        // Same applies to blockquote lines and table rows — adjacent rows
        // belong to the same block.

        const inputLines = (markdown || '').split('\n');

        // -------- Phase A: classify lines, normalize whitespace-only --------
        // Each entry: { line, kind } where kind is one of:
        //   'fence-open', 'fence-close', 'fence-body', 'blank', 'content'
        // Plus a 'category' for content lines: 'list-ul', 'list-ol',
        //   'blockquote', 'table', 'heading', 'hr', 'paragraph'
        const items = [];
        let inFence = false;
        let openChar = null;
        let openLen = 0;

        for (const rawLine of inputLines) {
            const line = rawLine;
            const trimmed = line.trim();

            // Fence tracking via shared utilities
            if (!inFence) {
                const fo = fenceOpen(trimmed);
                if (fo) {
                    inFence = true;
                    openChar = fo.char;
                    openLen  = fo.len;
                    items.push({ line, kind: 'fence-open' });
                    continue;
                }
            } else {
                if (isFenceClose(trimmed, openChar, openLen)) {
                    inFence = false;
                    openChar = null;
                    openLen = 0;
                    items.push({ line, kind: 'fence-close' });
                } else {
                    items.push({ line, kind: 'fence-body' });
                }
                continue;
            }

            // Outside fence: whitespace-only lines become canonical blanks
            if (trimmed === '') {
                items.push({ line: '', kind: 'blank' });
                continue;
            }

            // Categorize content lines (no ReDoS — classifyLine uses linear scan for HR)
            let category = classifyLine(trimmed);
            // Indented continuation of a list (2+ leading spaces or tab)
            if (category === 'paragraph' && /^(?: {4}|\t| {2,}[-*+]| {2,}\d+\.)/.test(line)) {
                category = 'list-cont';
            }

            items.push({ line, kind: 'content', category });
        }

        // -------- Phase B: emit with exactly-one-blank-line normalization --------
        // Same-block adjacent lines (lists, blockquotes, tables) stay
        // touching; any other adjacent content pair gets exactly one blank.
        const result = [];
        let prev = null;   // last emitted non-blank content item

        function inSameBlock(a, b) {
            if (!a || !b) return false;
            // Lists: same marker family OR list-content continuation
            if ((a.category === 'list-ul' || a.category === 'list-ol' || a.category === 'list-cont') &&
                (b.category === 'list-ul' || b.category === 'list-ol' || b.category === 'list-cont')) {
                return true;
            }
            // Blockquotes
            if (a.category === 'blockquote' && b.category === 'blockquote') return true;
            // Table rows
            if (a.category === 'table' && b.category === 'table') return true;
            return false;
        }

        for (const item of items) {
            if (item.kind === 'fence-open' || item.kind === 'fence-body' || item.kind === 'fence-close') {
                // Fences: ensure exactly one blank line before the fence-open
                if (item.kind === 'fence-open' && prev && result.length > 0 && result[result.length - 1] !== '') {
                    result.push('');
                }
                result.push(item.line);
                if (item.kind === 'fence-close') prev = { kind: 'content', category: 'fence' };
                continue;
            }

            if (item.kind === 'blank') {
                // Skip — Phase B inserts its own blank lines as needed
                continue;
            }

            // item.kind === 'content'
            if (prev) {
                if (inSameBlock(prev, item)) {
                    // Adjacent same-block lines: no blank between
                } else {
                    // Different blocks (or paragraphs): exactly one blank
                    if (result[result.length - 1] !== '') result.push('');
                }
            }
            result.push(item.line);
            prev = item;
        }

        // Trim trailing blank lines so output has exactly one terminal newline
        while (result.length > 0 && result[result.length - 1] === '') result.pop();

        return result.join('\n');
    }
    
    /**
     * Copy rendered content as rich text
     * @param {string} [output='default'] - Output profile: 'default', 'quikdown', or 'stripped'
     */
    async copyRendered(output = 'default') {
        try {
            const result = await getRenderedContent(this.previewPanel, { output });
            if (result.success) {
                // Visual feedback
                const btn = this.toolbar?.querySelector('[data-action="copy-rendered"]');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    this._later(() => {
                        btn.textContent = originalText;
                    }, 1500);
                }
            }
        } catch (err) {
            console.error('Failed to copy rendered content:', err);
        }
    }
    
    /**
     * Get the label for the current HTML passthrough mode.
     * @private
     */
    _getHtmlModeLabel(mode) {
        if (mode === true)      return 'HTML: Raw';
        if (mode === 'limited') return 'HTML: Safe';
        return 'HTML: Off';
    }

    /** @private */
    _getHtmlModeTooltip(mode) {
        if (mode === true)      return 'All HTML passes through — no protection';
        if (mode === 'limited') return 'Safe tags render, dangerous tags escaped';
        return 'All HTML tags shown as text';
    }

    /**
     * Cycle allowUnsafeHTML through false → "limited" → true → false.
     */
    cycleAllowUnsafeHTML() {
        const current = this.options.allowUnsafeHTML;
        let next;
        if (current === false)         next = 'limited';
        else if (current === 'limited') next = true;
        else                            next = false;
        this.setAllowUnsafeHTML(next);
    }

    /**
     * Set the HTML passthrough mode.
     * @param {boolean|'limited'} mode - false, 'limited', or true
     */
    setAllowUnsafeHTML(mode) {
        if (mode !== false && mode !== true && mode !== 'limited') return;
        this.options.allowUnsafeHTML = mode;
        // Update toolbar button label
        if (this.toolbar) {
            const btn = this.toolbar.querySelector('[data-action="toggle-html-mode"]');
            if (btn) {
                btn.textContent = this._getHtmlModeLabel(mode);
                btn.title = this._getHtmlModeTooltip(mode);
            }
        }
        // Re-render
        this.updateFromMarkdown(this._markdown);
    }

    /**
     * Get the current HTML passthrough mode.
     * @returns {boolean|'limited'}
     */
    getAllowUnsafeHTML() {
        return this.options.allowUnsafeHTML;
    }

    /**
     * Destroy the editor: remove its listeners, timers and DOM. Safe to
     * call more than once. Other editors on the page are not affected.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        // Timers
        clearTimeout(this.updateTimer);
        this._pending = null;
        this._timers.forEach(id => clearTimeout(id));
        this._timers.clear();

        // Listeners (document, media queries, own elements)
        this._listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
        this._listeners = [];
        if (this._autoThemeListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this._autoThemeListener);
            this._autoThemeListener = null;
        }

        // UI may not exist if init was still loading libraries
        if (this.previewPanel) {
            // Release Leaflet maps created by geojson fences
            this.previewPanel.querySelectorAll('[id$="-container"]').forEach(el => {
                if (el._map && typeof el._map.remove === 'function') {
                    try { el._map.remove(); } catch (_err) { /* already gone */ }
                    el._map = null;
                }
            });
        }

        // DOM
        if (this.options.mount === 'append') {
            this.container.remove();
        } else {
            this.container.innerHTML = '';
            this.container.classList.remove(
                'qde-container', 'qde-dark', 'qde-split-preview',
                'qde-mode-source', 'qde-mode-split', 'qde-mode-preview'
            );
        }

        // State
        this._undoStack = [];
        this._redoStack = [];
        this._savedRange = null;
        this._blocks = null;

        // Remove injected styles (only if no other editors exist)
        const otherEditors = document.querySelectorAll('.qde-container');
        if (otherEditors.length === 0) {
            const style = document.getElementById('qde-styles');
            if (style) style.remove();
        }
    }
}

/** Static: apply a formatting command to a markdown string (no editor needed). */
QuikdownEditor.formatMarkdown = formatMarkdown;

/** Static: formatting state at a selection in a markdown string. */
QuikdownEditor.getFormatState = getFormatState;

/**
 * Static: translate a character offset in one version of a document to the
 * matching offset in another (for example to keep the caret after reloading
 * a file that changed on disk).
 */
QuikdownEditor.mapOffset = mapOffset;

/** Static: command names accepted by format(). */
QuikdownEditor.FORMAT_COMMANDS = FORMAT_COMMANDS;

/** Static: curated safe HTML tag whitelist for allow_unsafe_html */
QuikdownEditor.SAFE_HTML_TAGS = SAFE_HTML_TAGS;

/** Semantic version (injected at build time) */
QuikdownEditor.version = quikdownEditorVersion;

// Export
export default QuikdownEditor;

// Export for CommonJS (needed for bundled ESM to work with Jest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuikdownEditor;
}

// Also export for UMD builds
if (typeof window !== 'undefined') {
    window.QuikdownEditor = QuikdownEditor;
}