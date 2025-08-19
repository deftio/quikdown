/**
 * Quikdown Editor - A drop-in markdown editor control
 * @version 1.0.5
 * @license BSD-2-Clause
 */

import quikdown_bd from './quikdown_bd.js';

// Default options
const DEFAULT_OPTIONS = {
    mode: 'split',          // 'source' | 'preview' | 'split'
    showToolbar: true,
    theme: 'auto',          // 'light' | 'dark' | 'auto'
    lazy_linefeeds: false,
    debounceDelay: 100,
    placeholder: 'Start typing markdown...',
    plugins: {
        highlightjs: false,
        mermaid: false
    },
    customFences: {} // { 'language': (code, lang) => html }
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
        this.init();
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
            { action: 'copy-html', text: 'Copy HTML', title: 'Copy HTML to clipboard' }
        ];
        
        copyButtons.forEach(({ action, text, title }) => {
            const btn = document.createElement('button');
            btn.className = 'qde-btn';
            btn.dataset.action = action;
            btn.textContent = text;
            btn.title = title;
            toolbar.appendChild(btn);
        });
        
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
                lazy_linefeeds: this.options.lazy_linefeeds
            });
            
            // Update preview if visible
            if (this.currentMode !== 'source') {
                this.previewPanel.innerHTML = this._html;
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
        this._html = this.previewPanel.innerHTML;
        this._markdown = quikdown_bd.toMarkdown(this.previewPanel);
        
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
     * Create fence plugin for syntax highlighting
     */
    createFencePlugin() {
        return (code, lang) => {
            // Check custom fences first
            if (this.options.customFences && this.options.customFences[lang]) {
                try {
                    return this.options.customFences[lang](code, lang);
                } catch (err) {
                    console.error(`Custom fence plugin error for ${lang}:`, err);
                    return `<pre><code class="language-${lang}">${this.escapeHtml(code)}</code></pre>`;
                }
            }
            
            // Mermaid support
            if (lang === 'mermaid' && window.mermaid) {
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                setTimeout(() => {
                    const element = document.getElementById(id);
                    if (element) {
                        mermaid.render(id + '-svg', code).then(result => {
                            element.innerHTML = result.svg;
                        }).catch(err => {
                            element.innerHTML = `<pre>Error rendering diagram: ${err.message}</pre>`;
                        });
                    }
                }, 0);
                return `<div id="${id}" class="mermaid" data-qd-source="${this.escapeHtml(code)}" data-qd-fence="\`\`\`" data-qd-lang="mermaid">Loading diagram...</div>`;
            }
            
            // Syntax highlighting support
            if (window.hljs && lang && hljs.getLanguage(lang)) {
                const highlighted = hljs.highlight(code, { language: lang }).value;
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
            }
            
            // Default: let quikdown handle it
            return undefined;
        };
    }
    
    /**
     * Escape HTML for attributes
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Load plugins dynamically
     */
    async loadPlugins() {
        const promises = [];
        
        // Load highlight.js
        if (this.options.plugins.highlightjs && !window.hljs) {
            promises.push(
                this.loadScript('https://unpkg.com/@highlightjs/cdn-assets/highlight.min.js'),
                this.loadCSS('https://unpkg.com/@highlightjs/cdn-assets/styles/github.min.css')
            );
        }
        
        // Load mermaid
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
    setMarkdown(markdown) {
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

// Also export for UMD builds
if (typeof window !== 'undefined') {
    window.QuikdownEditor = QuikdownEditor;
}