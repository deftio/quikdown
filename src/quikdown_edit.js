/**
 * Quikdown Editor - A drop-in markdown editor control
 * @version 1.0.5
 * @license BSD-2-Clause
 */

import quikdown_bd from './quikdown_bd.js';
import { getRenderedContent } from './quikdown_edit_copy.js';

// Default options
const DEFAULT_OPTIONS = {
    mode: 'split',          // 'source' | 'preview' | 'split'
    showToolbar: true,
    showRemoveHR: false,    // Show button to remove horizontal rules (---) 
    theme: 'auto',          // 'light' | 'dark' | 'auto'
    lazy_linefeeds: false,
    inline_styles: false,   // Use CSS classes (false) or inline styles (true)
    debounceDelay: 20,      // Reduced from 100ms for better responsiveness
    placeholder: 'Start typing markdown...',
    plugins: {
        highlightjs: false,
        mermaid: false
    },
    customFences: {}, // { 'language': (code, lang) => html }
    enableComplexFences: true // Enable CSV tables, math rendering, SVG, etc.
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
        this.sourceTextarea.placeholder = this.options.placeholder;
        this.sourcePanel.appendChild(this.sourceTextarea);
        
        // Create preview panel
        this.previewPanel = document.createElement('div');
        this.previewPanel.className = 'qde-preview';
        this.previewPanel.contentEditable = true;
        
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
            }
            
            .qde-toolbar {
                display: flex;
                align-items: center;
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
            
            .qde-spacer {
                flex: 1;
            }
            
            .qde-editor {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .qde-source, .qde-preview {
                flex: 1;
                overflow: auto;
                padding: 16px;
            }
            
            .qde-source {
                border-right: 1px solid #ddd;
            }
            
            .qde-textarea {
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
                resize: none;
                font-family: 'Monaco', 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .qde-preview {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                outline: none;
                cursor: text;  /* Standard text cursor */
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
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .qde-mode-split .qde-editor {
                    flex-direction: column;
                }
                
                .qde-mode-split .qde-source {
                    border-right: none;
                    border-bottom: 1px solid #ddd;
                }
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
                }
            }
        });
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
        this._markdown = quikdown_bd.toMarkdown(clonedPanel, {
            fence_plugin: this.createFencePlugin()
        });
        
        // Update source if visible
        if (this.currentMode !== 'preview') {
            this.sourceTextarea.value = this._markdown;
        }
        
        // Trigger change event
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html);
        }
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
                    case 'katex':
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
            while (node = walker.nextNode()) {
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
     * Render math with KaTeX if available
     */
    renderMath(code, lang) {
        const id = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // If KaTeX is loaded, use it
        if (window.katex) {
            try {
                const rendered = katex.renderToString(code, {
                    displayMode: true,
                    throwOnError: false
                });
                
                // Create container programmatically
                const container = document.createElement('div');
                container.className = 'qde-math-container';
                container.contentEditable = 'false';
                container.setAttribute('data-qd-fence', '```');
                container.setAttribute('data-qd-lang', lang);
                container.setAttribute('data-qd-source', code);
                container.innerHTML = rendered;
                
                return container.outerHTML;
            } catch (err) {
                const errorContainer = document.createElement('pre');
                errorContainer.className = 'qde-error';
                errorContainer.contentEditable = 'false';
                errorContainer.setAttribute('data-qd-fence', '```');
                errorContainer.setAttribute('data-qd-lang', lang);
                errorContainer.setAttribute('data-qd-source', code);
                errorContainer.textContent = `Math error: ${err.message}`;
                return errorContainer.outerHTML;
            }
        }
        
        // Try to lazy load KaTeX
        this.lazyLoadLibrary(
            'KaTeX',
            () => window.katex,
            'https://unpkg.com/katex/dist/katex.min.js',
            'https://unpkg.com/katex/dist/katex.min.css'
        ).then(loaded => {
            if (loaded) {
                const element = document.getElementById(id);
                if (element) {
                    try {
                        katex.render(code, element, {
                            displayMode: true,
                            throwOnError: false
                        });
                        // Update attributes after rendering
                        element.setAttribute('data-qd-source', code);
                        element.setAttribute('data-qd-fence', '```');
                        element.setAttribute('data-qd-lang', lang);
                    } catch (err) {
                        element.innerHTML = `<pre class="qde-error">Math error: ${this.escapeHtml(err.message)}</pre>`;
                    }
                }
            }
        });
        
        // Return placeholder with bidirectional attributes - non-editable
        const placeholder = document.createElement('div');
        placeholder.id = id;
        placeholder.className = 'qde-math-container';
        placeholder.contentEditable = 'false';
        placeholder.setAttribute('data-qd-fence', '```');
        placeholder.setAttribute('data-qd-lang', lang);
        placeholder.setAttribute('data-qd-source', code);
        const pre = document.createElement('pre');
        pre.textContent = code;
        placeholder.appendChild(pre);
        
        return placeholder.outerHTML;
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
        } catch (err) {
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
                } catch (e) {
                    // Use original if not valid JSON
                }
                
                const highlighted = hljs.highlight(toHighlight, { language: 'json' }).value;
                return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-json">${highlighted}</code></pre>`;
            } catch (e) {
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
        const id = `geojson-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Function to render the map
        const renderMap = () => {
            const element = document.getElementById(id);
            if (element && window.L) {
                try {
                    const data = JSON.parse(code);
                    const map = L.map(element).setView([0, 0], 2);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    const geoJsonLayer = L.geoJSON(data).addTo(map);
                    map.fitBounds(geoJsonLayer.getBounds());
                } catch (err) {
                    element.innerHTML = `<pre class="qde-error">GeoJSON error: ${this.escapeHtml(err.message)}</pre>`;
                }
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
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load map library</div>';
                    }
                }
            }).catch(() => {
                // Error already handled above
            });
        }
        
        // Return placeholder
        const container = document.createElement('div');
        container.id = id;
        container.style.cssText = 'height: 400px; background: #f0f0f0;';
        container.contentEditable = 'false';
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
        const id = `stl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Function to render the 3D model
        const render3D = () => {
            const element = document.getElementById(id);
            if (element && window.THREE && window.THREE.STLLoader) {
                try {
                    // Create scene
                    const scene = new THREE.Scene();
                    scene.background = new THREE.Color(0xf0f0f0);
                    
                    // Create camera
                    const camera = new THREE.PerspectiveCamera(75, element.clientWidth / 400, 0.1, 1000);
                    camera.position.z = 100;
                    
                    // Create renderer
                    const renderer = new THREE.WebGLRenderer();
                    renderer.setSize(element.clientWidth, 400);
                    element.innerHTML = '';
                    element.appendChild(renderer.domElement);
                    
                    // Add lights
                    const light1 = new THREE.DirectionalLight(0xffffff, 1);
                    light1.position.set(1, 1, 1);
                    scene.add(light1);
                    
                    const light2 = new THREE.AmbientLight(0x404040);
                    scene.add(light2);
                    
                    // Load STL
                    const loader = new THREE.STLLoader();
                    const geometry = loader.parse(code);
                    const material = new THREE.MeshPhongMaterial({ color: 0x0066ff });
                    const mesh = new THREE.Mesh(geometry, material);
                    scene.add(mesh);
                    
                    // Center and scale
                    geometry.computeBoundingBox();
                    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
                    mesh.position.sub(center);
                    
                    // Animate
                    const animate = () => {
                        requestAnimationFrame(animate);
                        mesh.rotation.x += 0.01;
                        mesh.rotation.y += 0.01;
                        renderer.render(scene, camera);
                    };
                    animate();
                } catch (err) {
                    element.innerHTML = `<pre class="qde-error">STL error: ${this.escapeHtml(err.message)}</pre>`;
                }
            }
        };
        
        // Check if Three.js is already loaded
        if (window.THREE && (window.THREE.STLLoader || window.STLLoader)) {
            // Make sure STLLoader is attached to THREE
            if (!window.THREE.STLLoader && window.STLLoader) {
                window.THREE.STLLoader = window.STLLoader;
            }
            // Render after DOM update
            setTimeout(render3D, 0);
        } else {
            // Lazy load Three.js only if not already loading
            if (!window._qde_three_loading) {
                // Pin to version 0.150.0 which has the legacy js examples
                window._qde_three_loading = this.loadScript('https://unpkg.com/three@0.150.0/build/three.min.js')
                    .then(() => {
                        // Load STLLoader after Three.js is loaded (legacy path for 0.150.0)
                        return this.loadScript('https://unpkg.com/three@0.150.0/examples/js/loaders/STLLoader.js');
                    })
                    .then(() => {
                        // Ensure STLLoader is attached to THREE
                        if (window.STLLoader && !window.THREE.STLLoader) {
                            window.THREE.STLLoader = window.STLLoader;
                        }
                    })
                    .catch(err => {
                        console.warn('Failed to load Three.js or STLLoader:', err);
                        // Clear the loading promise so it can be retried
                        window._qde_three_loading = null;
                        // Update the placeholder to show error
                        const element = document.getElementById(id);
                        if (element) {
                            element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load 3D libraries</div>';
                        }
                    });
            }
            
            if (window._qde_three_loading) {
                window._qde_three_loading.then(() => {
                    if (window.THREE && (window.THREE.STLLoader || window.STLLoader)) {
                        if (!window.THREE.STLLoader && window.STLLoader) {
                            window.THREE.STLLoader = window.STLLoader;
                        }
                        render3D();
                    }
                }).catch(() => {
                    // Error already handled above
                });
            }
        }
        
        // Return placeholder
        const container = document.createElement('div');
        container.id = id;
        container.style.cssText = 'height: 400px; background: #f0f0f0;';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', 'stl');
        container.setAttribute('data-qd-source', code);
        container.textContent = 'Loading 3D model...';
        
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
     * Load plugins dynamically
     */
    async loadPlugins() {
        const promises = [];
        
        // Load highlight.js (check if already loaded)
        if (this.options.plugins.highlightjs && !window.hljs) {
            promises.push(
                this.loadScript('https://unpkg.com/@highlightjs/cdn-assets/highlight.min.js'),
                this.loadCSS('https://unpkg.com/@highlightjs/cdn-assets/styles/github.min.css')
            );
        }
        
        // Load mermaid (check if already loaded)
        if (this.options.plugins.mermaid && !window.mermaid) {
            promises.push(
                this.loadScript('https://unpkg.com/mermaid/dist/mermaid.min.js').then(() => {
                    if (window.mermaid) {
                        mermaid.initialize({ startOnLoad: false });
                    }
                })
            );
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
    loadCSS(href) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
            // Resolve anyway after timeout (CSS doesn't always fire onload)
            setTimeout(resolve, 1000);
        });
    }
    
    /**
     * Apply theme
     */
    applyTheme() {
        const theme = this.options.theme;
        
        if (theme === 'auto') {
            // Check system preference
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.container.classList.toggle('qde-dark', isDark);
            
            // Listen for changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.container.classList.toggle('qde-dark', e.matches);
            });
        } else {
            this.container.classList.toggle('qde-dark', theme === 'dark');
        }
    }
    
    /**
     * Set lazy linefeeds option
     * @param {boolean} enabled - Whether to enable lazy linefeeds
     */
    setLazyLinefeeds(enabled) {
        this.options.lazy_linefeeds = enabled;
        // Re-render if we have content
        if (this._markdown) {
            this.updateFromSource();
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
        
        this.currentMode = mode;
        this.container.className = `qde-container qde-mode-${mode}`;
        
        // Update toolbar buttons
        if (this.toolbar) {
            this.toolbar.querySelectorAll('.qde-btn[data-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }
        
        // Apply theme class
        if (this.container.classList.contains('qde-dark')) {
            this.container.classList.add('qde-dark');
        }
        
        // Make fence blocks non-editable when showing preview
        if (mode !== 'source') {
            setTimeout(() => this.makeFencesNonEditable(), 0);
        }
        
        // Trigger mode change event
        if (this.options.onModeChange) {
            this.options.onModeChange(mode);
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
     * Remove all horizontal rules (---) from markdown
     */
    async removeHR() {
        // Remove standalone HR lines (3 or more dashes/underscores/asterisks)
        // Matches: ---, ___, ***, ----, etc. with optional spaces
        const cleaned = this._markdown
            .split('\n')
            .filter(line => {
                // Keep lines that aren't just HR patterns
                const trimmed = line.trim();
                // Match HR patterns: 3+ of -, _, or * with optional spaces between
                return !(/^[-_*](\s*[-_*]){2,}\s*$/.test(trimmed));
            })
            .join('\n');
        
        // Update the markdown
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