/**
 * quikdown_edit - Quikdown Editor Component
 * TypeScript definitions
 */

declare module 'quikdown/edit' {
  /**
   * Options for configuring the QuikdownEditor
   */
  export interface QuikdownEditorOptions {
    /** Initial view mode @default 'split' */
    mode?: 'source' | 'split' | 'preview';
    /** Theme setting @default 'auto' */
    theme?: 'light' | 'dark' | 'auto';
    /** Show/hide the toolbar @default true */
    showToolbar?: boolean;
    /** Show "Remove HR" toolbar button @default false */
    showRemoveHR?: boolean;
    /** Show "Fix Linefeeds" toolbar button @default false */
    showLazyLinefeeds?: boolean;
    /** Show undo/redo toolbar buttons @default false */
    showUndoRedo?: boolean;
    /** Enable lazy linefeeds (single \n becomes <br>) @default false */
    lazy_linefeeds?: boolean;
    /** Use inline styles instead of CSS classes @default false */
    inline_styles?: boolean;
    /** Debounce delay for updates in ms @default 20 */
    debounceDelay?: number;
    /** Placeholder text for empty editor */
    placeholder?: string;
    /** Initial markdown content */
    initialContent?: string;
    /** Maximum number of undo states to keep @default 100 */
    undoStackSize?: number;
    /** Enable complex fences (CSV, math, SVG, etc.) @default true */
    enableComplexFences?: boolean;
    /** Plugin configuration */
    plugins?: {
      /** Enable Highlight.js for syntax highlighting */
      highlightjs?: boolean;
      /** Enable Mermaid for diagrams */
      mermaid?: boolean;
    };
    /** Custom fence handlers keyed by language */
    customFences?: {
      [language: string]: (code: string, lang: string) => string;
    };
    /** Callback fired when content changes */
    onChange?: (markdown: string, html: string) => void;
    /** Callback fired when view mode changes */
    onModeChange?: (mode: 'source' | 'split' | 'preview') => void;
  }

  /**
   * QuikdownEditor class - Drop-in markdown editor control
   *
   * @example
   * ```typescript
   * import QuikdownEditor from 'quikdown/edit';
   *
   * const editor = new QuikdownEditor('#editor', {
   *   mode: 'split',
   *   showUndoRedo: true,
   *   showRemoveHR: true,
   *   onChange: (md, html) => console.log('Changed:', md.length)
   * });
   *
   * editor.setMarkdown('# Hello\n\nWorld');
   * editor.undo();
   * editor.redo();
   * ```
   */
  export class QuikdownEditor {
    constructor(container: HTMLElement | string, options?: QuikdownEditorOptions);

    // --- Properties ---
    get markdown(): string;
    set markdown(value: string);
    get html(): string;
    get mode(): 'source' | 'split' | 'preview';

    // --- Content ---
    setMarkdown(markdown: string): Promise<void>;
    getMarkdown(): string;
    getHTML(): string;

    // --- View ---
    setMode(mode: 'source' | 'split' | 'preview'): void;
    setLazyLinefeeds(enabled: boolean): void;
    getLazyLinefeeds(): boolean;
    setDebounceDelay(delay: number): void;
    getDebounceDelay(): number;
    /** Change theme at runtime */
    setTheme(theme: 'light' | 'dark' | 'auto'): void;
    /** Get the currently configured theme */
    getTheme(): 'light' | 'dark' | 'auto';

    // --- Undo / Redo ---
    /** Undo the last edit */
    undo(): Promise<void>;
    /** Redo the last undone edit */
    redo(): Promise<void>;
    /** Whether undo is available */
    canUndo(): boolean;
    /** Whether redo is available */
    canRedo(): boolean;
    /** Clear the undo/redo history */
    clearHistory(): void;

    // --- HR Removal ---
    /** Remove all horizontal rules from the current markdown (fence/table-safe) */
    removeHR(): Promise<void>;

    // --- Lazy Linefeed Conversion ---
    /** One-time transform: convert single newlines to paragraph breaks (idempotent) */
    convertLazyLinefeeds(): Promise<void>;

    // --- Static utilities (headless — no editor instance needed) ---
    /** Remove HRs from markdown string (fence/table-safe) */
    static removeHRFromMarkdown(markdown: string): string;
    /** Convert lazy linefeeds in markdown string (idempotent) */
    static convertLazyLinefeeds(markdown: string): string;

    // --- Clipboard ---
    copy(type: 'markdown' | 'html'): Promise<void>;
    copyRendered(): Promise<void>;

    // --- Plugin loading ---
    loadScript(src: string): Promise<void>;
    loadCSS(href: string): Promise<void>;

    // --- Lifecycle ---
    destroy(): void;
  }

  export default QuikdownEditor;
}

// For direct import (non-module usage)
declare class QuikdownEditor {
  constructor(container: HTMLElement | string, options?: import('quikdown/edit').QuikdownEditorOptions);
  get markdown(): string;
  set markdown(value: string);
  get html(): string;
  get mode(): 'source' | 'split' | 'preview';
  setMarkdown(markdown: string): Promise<void>;
  getMarkdown(): string;
  getHTML(): string;
  setMode(mode: 'source' | 'split' | 'preview'): void;
  setLazyLinefeeds(enabled: boolean): void;
  getLazyLinefeeds(): boolean;
  setDebounceDelay(delay: number): void;
  getDebounceDelay(): number;
  setTheme(theme: 'light' | 'dark' | 'auto'): void;
  getTheme(): 'light' | 'dark' | 'auto';
  undo(): Promise<void>;
  redo(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
  clearHistory(): void;
  removeHR(): Promise<void>;
  convertLazyLinefeeds(): Promise<void>;
  static removeHRFromMarkdown(markdown: string): string;
  static convertLazyLinefeeds(markdown: string): string;
  copy(type: 'markdown' | 'html'): Promise<void>;
  copyRendered(): Promise<void>;
  loadScript(src: string): Promise<void>;
  loadCSS(href: string): Promise<void>;
  destroy(): void;
}

export default QuikdownEditor;
export { QuikdownEditorOptions } from 'quikdown/edit';
