/**
 * QuikdownEditor — A drop-in markdown editor control.
 */

export interface EditorOptions {
    /** Editor mode. Default: 'split'. */
    mode?: 'source' | 'preview' | 'split';
    /** Show the toolbar. Default: true. */
    showToolbar?: boolean;
    /** Show button to remove horizontal rules. Default: false. */
    showRemoveHR?: boolean;
    /** Show button to toggle lazy linefeeds. Default: false. */
    showLazyLinefeeds?: boolean;
    /** Color theme. Default: 'auto'. */
    theme?: 'light' | 'dark' | 'auto';
    /** Single newlines become <br>. Default: false. */
    lazy_linefeeds?: boolean;
    /** Use inline styles instead of CSS classes. Default: false. */
    inline_styles?: boolean;
    /** Debounce delay in ms. Default: 20. */
    debounceDelay?: number;
    /** Placeholder text for the source panel. */
    placeholder?: string;
    /** Legacy plugin flags. */
    plugins?: { highlightjs?: boolean; mermaid?: boolean };
    /** Preload fence-rendering libraries. */
    preloadFences?: 'all' | string[] | Array<{ name: string; script: string; css?: string }> | null;
    /** Custom fence renderers. */
    customFences?: Record<string, (code: string, lang: string) => string>;
    /** Enable CSV tables, math rendering, SVG, etc. Default: true. */
    enableComplexFences?: boolean;
    /** Show undo/redo toolbar buttons. Default: false. */
    showUndoRedo?: boolean;
    /** Maximum number of undo states. Default: 100. */
    undoStackSize?: number;
    /** HTML passthrough control. Default: false. */
    allowUnsafeHTML?: false | 'limited' | true;
    /** Show toolbar button to cycle HTML mode. Default: false. */
    showAllowUnsafeHTML?: boolean;
}

/**
 * Drop-in markdown editor with live preview.
 */
declare class QuikdownEditor {
    /** Curated safe HTML tag whitelist for use with allow_unsafe_html. */
    static readonly SAFE_HTML_TAGS: Record<string, 1>;

    constructor(container: string | HTMLElement, options?: EditorOptions);

    /** Initialize the editor (called automatically by constructor). */
    init(): Promise<void>;
    /** Set the markdown source and update preview. */
    setMarkdown(markdown: string): Promise<void>;
    /** Get the current markdown source. */
    getMarkdown(): string;
    /** Get the rendered HTML from the preview panel. */
    getHTML(): string;
    /** Set the editor mode. */
    setMode(mode: 'source' | 'preview' | 'split'): void;
    /** Set the color theme. */
    setTheme(theme: 'light' | 'dark' | 'auto'): void;
    /** Get the current theme. */
    getTheme(): string;
    /** Enable or disable lazy linefeeds. */
    setLazyLinefeeds(enabled: boolean): void;
    /** Get whether lazy linefeeds are enabled. */
    getLazyLinefeeds(): boolean;
    /** Set the debounce delay. */
    setDebounceDelay(delay: number): void;
    /** Get the debounce delay. */
    getDebounceDelay(): number;
    /** Remove all horizontal rules from the markdown. */
    removeHR(): Promise<void>;
    /** Toggle lazy linefeeds and update. */
    toggleLazyLinefeeds(): Promise<void>;
    /** Undo the last edit. */
    undo(): void;
    /** Redo the last undone edit. */
    redo(): void;
    /** Whether undo is available. */
    canUndo(): boolean;
    /** Whether redo is available. */
    canRedo(): boolean;
    /** Tear down the editor and remove event listeners. */
    destroy(): void;
}

export default QuikdownEditor;
