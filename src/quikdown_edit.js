/**
 * Quikdown Editor - A drop-in markdown editor control
 * @version 1.0.5
 * @license BSD-2-Clause
 */

import quikdown_bd from './quikdown_bd.js';
import { getRenderedContent } from './quikdown_edit_copy.js';
import { isHRLine, fenceOpen, isFenceClose, classifyLine, looksLikeTableRow } from './quikdown_classify.js';

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
     * Developer's choice. The editor itself is still ~70 KB minified;
     * `preloadFences` only affects the OPTIONAL fence renderers.
     */
    preloadFences: null,
    customFences: {}, // { 'language': (code, lang) => html }
    enableComplexFences: true, // Enable CSV tables, math rendering, SVG, etc.
    showUndoRedo: false,      // Show undo/redo toolbar buttons
    undoStackSize: 100        // Maximum number of undo states to keep
};

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
        beforeLoad: () => {
            // Configure MathJax before loading (must be set on window before script runs)
            // Must match the config in ensureMathJaxLoaded() for consistent behavior
            if (!window.MathJax) {
                window.MathJax = {
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
    },
    geojson: {
        check: () => typeof window.L !== 'undefined',
        script: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    },
    stl: {
        check: () => typeof window.THREE !== 'undefined',
        script: 'https://unpkg.com/three@0.147.0/build/three.min.js'
    }
};

/**
 * Quikdown Editor - A complete markdown editing solution
 */
class QuikdownEditor {
    constructor(container, options = {}) {
        // Resolve container
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!this.container) {
            throw new Error('QuikdownEditor: Invalid container');
        }
        
        // Merge options
        this.options = { ...DEFAULT_OPTIONS, ...options };
        
        // State
        this._markdown = '';
        this._html = '';
        this.currentMode = this.options.mode;
        this.updateTimer = null;

        // Undo/redo state
        this._undoStack = [];
        this._redoStack = [];
        this._isUndoRedo = false;
        
        // Initialize
        this.initPromise = this.init();
    }
    
    /**
     * Initialize the editor
     */
    async init() {
        // Load plugins if requested
        await this.loadPlugins();
        
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
            this.setMarkdown(this.options.initialContent);
        }
    }
    
    /**
     * Build the editor UI
     */
    buildUI() {
        // Clear container
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
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                background: white;
                color: #1f2937;
            }
            
            .qde-toolbar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                padding: 8px;
                background: #f5f5f5;
                border-bottom: 1px solid #ddd;
                gap: 4px;
            }
            
            .qde-btn {
                padding: 6px 12px;
                border: 1px solid #ccc;
                background: white;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .qde-btn:hover {
                background: #e9e9e9;
                border-color: #999;
            }
            
            .qde-btn.active {
                background: #007bff;
                color: white;
                border-color: #0056b3;
            }

            .qde-btn.disabled {
                opacity: 0.4;
                pointer-events: none;
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
                padding: 16px;
                box-sizing: border-box;
            }

            .qde-source {
                border-right: 1px solid #ddd;
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
                padding: 16px;
                box-sizing: border-box;
                font-family: 'Monaco', 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
                background: transparent;
                color: inherit;
                /* Wrap long lines so the textarea only scrolls VERTICALLY.
                   pre-wrap preserves intentional line breaks/whitespace
                   while soft-wrapping at the right edge. */
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: hidden;
                overflow-y: auto;
            }
            
            .qde-preview {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                outline: none;
                cursor: text;  /* Standard text cursor */
                overflow-x: hidden;  /* never scroll horizontally; clip wide content */
            }

            /* Code blocks and inline code — self-contained so the editor
               does not depend on any external stylesheet for these. */
            .qde-preview pre {
                background: #f4f4f4;
                color: #1f2937;
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 0.6em 0;
                font-size: 0.9em;
                line-height: 1.5;
                font-family: ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace;
            }
            .qde-preview code {
                padding: 2px 4px;
                font-size: 0.9em;
                border-radius: 3px;
                background: #f0f0f0;
                color: #1f2937;
                font-family: ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace;
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
            .qde-preview .leaflet-container { box-sizing: border-box; }

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
                border: 1px solid #ddd;
                padding: 8px;
            }
            
            /* Support for alignment classes from quikdown */
            .qde-preview .quikdown-left { text-align: left; }
            .qde-preview .quikdown-center { text-align: center; }
            .qde-preview .quikdown-right { text-align: right; }
            
            .qde-preview table th {
                background: #f5f5f5;
                font-weight: bold;
            }
            
            .qde-preview table tr:nth-child(even) {
                background: #f9f9f9;
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
                background: #1e1e1e;
                color: #e0e0e0;
                border-color: #444;
            }
            
            .qde-dark .qde-toolbar {
                background: #2d2d2d;
                border-color: #444;
            }
            
            .qde-dark .qde-btn {
                background: #3a3a3a;
                color: #e0e0e0;
                border-color: #555;
            }
            
            .qde-dark .qde-btn:hover {
                background: #4a4a4a;
            }
            
            .qde-dark .qde-source {
                border-color: #444;
            }
            
            .qde-dark .qde-textarea {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            .qde-dark .qde-preview {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            /* Dark mode code blocks */
            .qde-dark .qde-preview pre {
                background: #2d2d3a;
                color: #e6e6f0;
            }
            .qde-dark .qde-preview code {
                background: #2a2a3a;
                color: #e6e6f0;
            }
            .qde-dark .qde-preview pre code {
                background: transparent;
                color: inherit;
            }

            /* Dark mode table styles */
            .qde-dark .qde-preview table th,
            .qde-dark .qde-preview table td {
                border-color: #3a3a3a;
            }
            
            .qde-dark .qde-preview table th {
                background: #2d2d2d;
            }
            
            .qde-dark .qde-preview table tr:nth-child(even) {
                background: #252525;
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
        this.sourceTextarea.addEventListener('input', () => {
            this.handleSourceInput();
        });
        
        // Preview contenteditable input
        this.previewPanel.addEventListener('input', () => {
            this.handlePreviewInput();
        });
        
        // Toolbar buttons
        if (this.toolbar) {
            this.toolbar.addEventListener('click', (e) => {
                const btn = e.target.closest('.qde-btn');
                if (!btn) return;

                // Mobile split-toggle button
                if (btn.classList.contains('qde-split-toggle')) {
                    this.container.classList.toggle('qde-split-preview');
                    const showingPreview = this.container.classList.contains('qde-split-preview');
                    btn.textContent = showingPreview ? 'Source' : 'Preview';
                    return;
                }

                if (btn.dataset.mode) {
                    this.setMode(btn.dataset.mode);
                } else if (btn.dataset.action) {
                    this.handleAction(btn.dataset.action);
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
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
                    case 'Z':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.redo();
                        } else {
                            e.preventDefault();
                            this.undo();
                        }
                        break;
                    case 'y':
                    case 'Y':
                        e.preventDefault();
                        this.redo();
                        break;
                }
            }
        });

        // On narrow portrait viewports, auto-switch out of split mode to source.
        // Split is kept available on landscape where there is enough width.
        if (typeof window.matchMedia === 'function') {
            const portraitQuery = window.matchMedia('(max-width: 720px) and (orientation: portrait)');
            const switchIfPortrait = () => {
                if (portraitQuery.matches && this.currentMode === 'split') {
                    this.setMode('source');
                }
            };
            // Check after init's setMode() has run (microtask fires after sync code).
            Promise.resolve().then(switchIfPortrait);
            portraitQuery.addEventListener('change', switchIfPortrait);
        }
    }

    /**
     * Handle source textarea input
     */
    handleSourceInput() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updateFromMarkdown(this.sourceTextarea.value);
        }, this.options.debounceDelay);
    }
    
    /**
     * Handle preview panel input
     */
    handlePreviewInput() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updateFromHTML();
        }, this.options.debounceDelay);
    }
    
    /**
     * Update from markdown source
     */
    updateFromMarkdown(markdown) {
        // Push current state to undo stack before changing (unless this is an undo/redo operation)
        if (!this._isUndoRedo) {
            this._pushUndoState(markdown || '');
        }
        this._isUndoRedo = false;

        this._markdown = markdown || '';
        
        // Show placeholder if empty
        if (!this._markdown.trim()) {
            this._html = '';
            if (this.currentMode !== 'source') {
                this.previewPanel.innerHTML = '<div style="color: #999; font-style: italic; padding: 16px;">Start typing markdown in the source panel...</div>';
            }
        } else {
            this._html = quikdown_bd(markdown, {
                fence_plugin: this.createFencePlugin(),
                lazy_linefeeds: this.options.lazy_linefeeds,
                inline_styles: this.options.inline_styles
            });
            
            // Update preview if visible
            if (this.currentMode !== 'source') {
                this.previewPanel.innerHTML = this._html;
                // Make all fence blocks non-editable
                this.makeFencesNonEditable();
                
                // Process all math elements with MathJax if loaded (like squibview)
                if (window.MathJax && window.MathJax.typesetPromise) {
                    const mathElements = this.previewPanel.querySelectorAll('.math-display');
                    if (mathElements.length > 0) {
                        window.MathJax.typesetPromise(Array.from(mathElements))
                            .catch(_err => {
                                console.warn('MathJax batch processing failed:', _err);
                            });
                    }
                }
            }
        }
        
        // Trigger change event
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html);
        }
    }
    
    /**
     * Update from HTML preview
     */
    updateFromHTML() {
        // Clone the preview panel to avoid modifying the actual DOM
        const clonedPanel = this.previewPanel.cloneNode(true);

        // Pre-process special elements on the clone
        this.preprocessSpecialElements(clonedPanel);

        this._html = this.previewPanel.innerHTML;
        const newMarkdown = quikdown_bd.toMarkdown(clonedPanel, {
            fence_plugin: this.createFencePlugin()
        });

        // Push previous state to undo stack (now that we know the new markdown)
        if (!this._isUndoRedo) {
            this._pushUndoState(newMarkdown);
        }
        this._isUndoRedo = false;

        this._markdown = newMarkdown;

        // Update source if visible
        if (this.currentMode !== 'preview') {
            this.sourceTextarea.value = this._markdown;
        }

        // Trigger change event
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html);
        }

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
                    return `<pre><code class="language-${lang}">${this.escapeHtml(code)}</code></pre>`;
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
                }
            }
            
            // Syntax highlighting support - keep editable for bidirectional
            if (window.hljs && lang && hljs.getLanguage(lang)) {
                const highlighted = hljs.highlight(code, { language: lang }).value;
                // Don't add contenteditable="false" - the bidirectional system can extract text from the highlighted code
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
            }
            
            // Default: let quikdown handle it
            return undefined;
        };
        
        // Reverse function to extract raw source from rendered HTML
        const reverse = (element) => {
            // Get the language from data attribute
            const lang = element.getAttribute('data-qd-lang') || '';
            let content = '';
            
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
            const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
            let node;
            while ((node = walker.nextNode())) {
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
     * Ensures MathJax is loaded (but doesn't process elements)
     */
    ensureMathJaxLoaded() {
        if (typeof window.MathJax === 'undefined' && !window.mathJaxLoading) {
            window.mathJaxLoading = true;
            
            // Configure MathJax before loading
            if (!window.MathJax) {
                window.MathJax = {
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
                        fontCache: 'none'  // Important: self-contained SVGs for copy
                    },
                    startup: { typeset: false }
                };
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
            script.async = true;
            script.onload = () => {
                window.mathJaxLoading = false;
                
                // Process any existing math elements (like squibview)
                if (window.MathJax && window.MathJax.typesetPromise) {
                    const mathElements = document.querySelectorAll('.math-display');
                    if (mathElements.length > 0) {
                        window.MathJax.typesetPromise(Array.from(mathElements)).catch(err => {
                            console.warn('Initial MathJax processing failed:', err);
                        });
                    }
                }
            };
            script.onerror = () => {
                window.mathJaxLoading = false;
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
                
                // Create the map
                const map = L.map(mapId);
                
                // Store back-reference for capture (per Gem's guide)
                container._map = map; // Avoid window pollution
                
                // Add tile layer with CORS support
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '',
                    crossOrigin: 'anonymous' // Important for canvas capture
                });
                tileLayer.addTo(map);
                
                // Add GeoJSON layer
                const geoJsonLayer = L.geoJSON(data);
                geoJsonLayer.addTo(map);
                
                // Fit bounds if valid
                if (geoJsonLayer.getBounds().isValid()) {
                    map.fitBounds(geoJsonLayer.getBounds());
                } else {
                    map.setView([0, 0], 2);
                }
                
                // Store references for copy-time capture
                container._tileLayer = tileLayer;
                container._geoJsonLayer = geoJsonLayer;
                
                // Optional: Wait for tiles to load for better capture
                tileLayer.on('load', () => {
                    container.setAttribute('data-tiles-loaded', 'true');
                });
                
            } catch (err) {
                container.innerHTML = `<pre class="qde-error">GeoJSON error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };
        
        // Check if Leaflet is already loaded
        if (window.L) {
            // Render after DOM update
            setTimeout(renderMap, 0);
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
                    renderMap();
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
                    element.innerHTML = `<pre>Error rendering diagram: ${err.message}</pre>`;
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
     * Make complex fence blocks non-editable
     */
    makeFencesNonEditable() {
        if (!this.previewPanel) return;
        
        // Only make specific complex fence types non-editable
        // SVG, HTML, Math, Mermaid already have contenteditable="false" set
        // Syntax-highlighted code also has it set
        
        // Don't make regular code blocks or tables non-editable
        // They can be edited and properly round-trip
    }
    
    /**
     * Load plugins dynamically — honors both `plugins: { highlightjs, mermaid }`
     * (legacy) and the newer `preloadFences` option which can preload any
     * combination of fence libraries (or 'all') at construction time.
     */
    async loadPlugins() {
        const namesToLoad = new Set();

        // Legacy plugins option
        if (this.options.plugins) {
            if (this.options.plugins.highlightjs) namesToLoad.add('highlightjs');
            if (this.options.plugins.mermaid)     namesToLoad.add('mermaid');
        }

        // New preloadFences option
        const pf = this.options.preloadFences;
        if (pf === 'all') {
            Object.keys(FENCE_LIBRARIES).forEach(n => namesToLoad.add(n));
        } else if (Array.isArray(pf)) {
            for (const entry of pf) {
                if (typeof entry === 'string') {
                    if (FENCE_LIBRARIES[entry]) namesToLoad.add(entry);
                    else console.warn(`QuikdownEditor: unknown preloadFences entry "${entry}"`);
                } else if (entry && typeof entry === 'object' && entry.script) {
                    // Custom library: { name, script, css? }
                    namesToLoad.add('__custom__:' + (entry.name || entry.script));
                    FENCE_LIBRARIES['__custom__:' + (entry.name || entry.script)] = {
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
            const lib = FENCE_LIBRARIES[name];
            if (!lib || lib.check()) continue;
            if (lib.beforeLoad) lib.beforeLoad();
            const p = (async () => {
                try {
                    const tasks = [];
                    if (lib.script) tasks.push(this.loadScript(lib.script));
                    if (lib.css)    tasks.push(this.loadCSS(lib.css, 'qde-hljs-light'));
                    if (lib.cssDark) tasks.push(this.loadCSS(lib.cssDark, 'qde-hljs-dark'));
                    await Promise.all(tasks);
                    if (lib.css && lib.cssDark) this._syncHljsTheme();
                    if (lib.afterLoad) lib.afterLoad();
                } catch (err) {
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
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
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

        // Preserve theme class across mode swap (the assignment to className
        // below would otherwise wipe it out — this used to be a no-op bug
        // where dark mode was lost on every setMode call).
        const wasDark = this.container.classList.contains('qde-dark');
        const previousMode = this.currentMode;

        this.currentMode = mode;
        this.container.className = `qde-container qde-mode-${mode}`;
        if (wasDark) {
            this.container.classList.add('qde-dark');
        }

        // Reset mobile split-toggle button text
        if (this.toolbar) {
            const splitToggle = this.toolbar.querySelector('.qde-split-toggle');
            if (splitToggle) {
                splitToggle.textContent = 'Preview';
            }
        }

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
            this.previewPanel.innerHTML = this._html;
            setTimeout(() => this.makeFencesNonEditable(), 0);
            if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
                const mathElements = this.previewPanel.querySelectorAll('.math-display');
                if (mathElements.length > 0) {
                    window.MathJax.typesetPromise(Array.from(mathElements))
                        .catch(() => {});
                }
            }
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
        if (!this.canUndo()) return;
        // Save current state to redo stack
        this._redoStack.push(this._markdown);
        const previous = this._undoStack.pop();
        this._isUndoRedo = true;
        // Update state directly (setMarkdown is async; keep it synchronous here)
        this._markdown = previous;
        if (this.sourceTextarea) {
            this.sourceTextarea.value = previous;
        }
        this.updateFromMarkdown(previous);
        this._updateUndoButtons();
    }

    /**
     * Redo the last undone change.
     */
    redo() {
        if (!this.canRedo()) return;
        // Save current state to undo stack
        this._undoStack.push(this._markdown);
        const next = this._redoStack.pop();
        this._isUndoRedo = true;
        this._markdown = next;
        if (this.sourceTextarea) {
            this.sourceTextarea.value = next;
        }
        this.updateFromMarkdown(next);
        this._updateUndoButtons();
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
        }
    }
    
    /**
     * Copy content to clipboard
     */
    async copy(type) {
        const content = type === 'markdown' ? this._markdown : this._html;
        
        try {
            await navigator.clipboard.writeText(content);
            
            // Visual feedback
            const btn = this.toolbar.querySelector(`[data-action="copy-${type}"]`);
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
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
     * Set markdown content
     */
    async setMarkdown(markdown) {
        // Wait for initialization if needed
        if (this.initPromise) {
            await this.initPromise;
        }
        
        this._markdown = markdown;
        if (this.sourceTextarea) {
            this.sourceTextarea.value = markdown;
        }
        this.updateFromMarkdown(markdown);
    }
    
    /**
     * Get markdown content
     */
    getMarkdown() {
        return this._markdown;
    }
    
    /**
     * Get HTML content
     */
    getHTML() {
        return this._html;
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
            setTimeout(() => {
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
            setTimeout(() => {
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
     */
    async copyRendered() {
        try {
            const result = await getRenderedContent(this.previewPanel);
            if (result.success) {
                // Visual feedback
                const btn = this.toolbar?.querySelector('[data-action="copy-rendered"]');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 1500);
                }
            }
        } catch (err) {
            console.error('Failed to copy rendered content:', err);
        }
    }
    
    /**
     * Destroy the editor
     */
    destroy() {
        // Clear timers
        clearTimeout(this.updateTimer);
        
        // Clear container
        this.container.innerHTML = '';
        this.container.classList.remove('qde-container', 'qde-dark');
        
        // Remove injected styles (only if no other editors exist)
        const otherEditors = document.querySelectorAll('.qde-container');
        if (otherEditors.length === 0) {
            const style = document.getElementById('qde-styles');
            if (style) style.remove();
        }
    }
}

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