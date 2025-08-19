/**
 * quikdown_edit - Quikdown Editor Component
 * TypeScript definitions
 */

declare module 'quikdown/edit' {
  /**
   * Options for configuring the QuikdownEditor
   */
  export interface QuikdownEditorOptions {
    /**
     * Initial view mode
     * @default 'split'
     */
    mode?: 'source' | 'split' | 'preview';
    
    /**
     * Theme setting
     * @default 'auto'
     */
    theme?: 'light' | 'dark' | 'auto';
    
    /**
     * Show/hide the toolbar
     * @default true
     */
    showToolbar?: boolean;
    
    /**
     * Enable lazy linefeeds (single \n becomes <br>)
     * @default false
     */
    lazy_linefeeds?: boolean;
    
    /**
     * Debounce delay for updates in milliseconds
     * @default 100
     */
    debounceDelay?: number;
    
    /**
     * Placeholder text for empty editor
     * @default 'Start typing markdown...'
     */
    placeholder?: string;
    
    /**
     * Initial markdown content
     */
    initialContent?: string;
    
    /**
     * Plugin configuration
     */
    plugins?: {
      /** Enable Highlight.js for syntax highlighting */
      highlightjs?: boolean;
      /** Enable Mermaid for diagrams */
      mermaid?: boolean;
    };
    
    /**
     * Custom fence handlers
     * Maps language identifiers to render functions
     */
    customFences?: {
      [language: string]: (code: string, lang: string) => string;
    };
    
    /**
     * Callback fired when content changes
     * @param markdown - Current markdown content
     * @param html - Rendered HTML
     */
    onChange?: (markdown: string, html: string) => void;
    
    /**
     * Callback fired when view mode changes
     * @param mode - New view mode
     */
    onModeChange?: (mode: 'source' | 'split' | 'preview') => void;
  }

  /**
   * QuikdownEditor class - Drop-in markdown editor control
   */
  export class QuikdownEditor {
    /**
     * Create a new QuikdownEditor instance
     * @param container - DOM element or CSS selector for the container
     * @param options - Editor configuration options
     */
    constructor(container: HTMLElement | string, options?: QuikdownEditorOptions);
    
    /**
     * Get current markdown content
     */
    get markdown(): string;
    
    /**
     * Set markdown content
     */
    set markdown(value: string);
    
    /**
     * Get rendered HTML (read-only)
     */
    get html(): string;
    
    /**
     * Get current view mode (read-only)
     */
    get mode(): 'source' | 'split' | 'preview';
    
    /**
     * Set markdown content
     * @param markdown - Markdown text to set
     */
    setMarkdown(markdown: string): void;
    
    /**
     * Get current markdown content
     * @returns Current markdown text
     */
    getMarkdown(): string;
    
    /**
     * Get rendered HTML
     * @returns Rendered HTML
     */
    getHTML(): string;
    
    /**
     * Change view mode
     * @param mode - New view mode
     */
    setMode(mode: 'source' | 'split' | 'preview'): void;
    
    /**
     * Enable/disable lazy linefeeds
     * @param enabled - Whether to enable lazy linefeeds
     */
    setLazyLinefeeds(enabled: boolean): void;
    
    /**
     * Get lazy linefeeds setting
     * @returns Current lazy linefeeds setting
     */
    getLazyLinefeeds(): boolean;
    
    /**
     * Destroy the editor and clean up
     */
    destroy(): void;
  }

  export default QuikdownEditor;
}

// For direct import
declare class QuikdownEditor {
  constructor(container: HTMLElement | string, options?: QuikdownEditorOptions);
  get markdown(): string;
  set markdown(value: string);
  get html(): string;
  get mode(): 'source' | 'split' | 'preview';
  setMarkdown(markdown: string): void;
  getMarkdown(): string;
  getHTML(): string;
  setMode(mode: 'source' | 'split' | 'preview'): void;
  setLazyLinefeeds(enabled: boolean): void;
  getLazyLinefeeds(): boolean;
  destroy(): void;
}

export interface QuikdownEditorOptions {
  mode?: 'source' | 'split' | 'preview';
  theme?: 'light' | 'dark' | 'auto';
  showToolbar?: boolean;
  lazy_linefeeds?: boolean;
  debounceDelay?: number;
  placeholder?: string;
  initialContent?: string;
  plugins?: {
    highlightjs?: boolean;
    mermaid?: boolean;
  };
  customFences?: {
    [language: string]: (code: string, lang: string) => string;
  };
  onChange?: (markdown: string, html: string) => void;
  onModeChange?: (mode: 'source' | 'split' | 'preview') => void;
}

export default QuikdownEditor;