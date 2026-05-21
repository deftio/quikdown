/**
 * quikdown_bd — Bidirectional markdown ↔ HTML converter.
 */

import { QuikdownOptions } from './quikdown';

export interface ToMarkdownOptions {
    /** Preserve whitespace formatting. */
    preserveWhitespace?: boolean;
}

/**
 * Parse markdown to HTML with bidirectional data-qd attributes.
 * @param markdown  The markdown source text.
 * @param options   Configuration options (bidirectional is always true).
 * @returns Rendered HTML string with data-qd attributes.
 */
declare function quikdown_bd(markdown: string, options?: QuikdownOptions): string;

declare namespace quikdown_bd {
    /**
     * Convert HTML back to markdown using data-qd attributes.
     * @param htmlOrElement  HTML string or DOM Element.
     * @param options        Conversion options.
     * @returns Markdown string.
     */
    function toMarkdown(htmlOrElement: string | Element, options?: ToMarkdownOptions): string;
    /** Emit CSS rules for quikdown element classes. */
    function emitStyles(prefix?: string, theme?: 'light' | 'dark'): string;
    /** Create a pre-configured parser with baked-in options. */
    function configure(options: QuikdownOptions): (markdown: string) => string;
    /** Semantic version string. */
    const version: string;
}

export default quikdown_bd;
