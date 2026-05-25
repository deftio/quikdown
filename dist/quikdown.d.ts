/**
 * quikdown — A compact markdown-to-HTML parser with XSS protection.
 */

export interface FencePlugin {
    /** Render a fenced code block. Return undefined to fall back to default rendering. */
    render: (code: string, lang: string) => string | undefined;
    /** Reverse a rendered fence element back to source (for bidirectional mode). */
    reverse?: (element: Element) => { content: string; lang: string; fence: string };
}

export interface QuikdownOptions {
    /** Custom handler for fenced code blocks. */
    fence_plugin?: FencePlugin;
    /** Use inline styles instead of CSS classes. Default: false. */
    inline_styles?: boolean;
    /** Add data-qd attributes for HTML-to-markdown roundtrip. Default: false. */
    bidirectional?: boolean;
    /** Single newlines become <br> tags. Default: false. */
    lazy_linefeeds?: boolean;
    /**
     * HTML passthrough control. Default: false.
     * - false: all HTML is escaped (safe default)
     * - true: no escaping (trusted pipelines only)
     * - string[]: whitelist of allowed tag names
     * - Record<string, 1>: whitelist object
     */
    allow_unsafe_html?: boolean | string[] | Record<string, 1>;
    /** Allow javascript: and other potentially unsafe URLs. Default: false. */
    allow_unsafe_urls?: boolean;
    /** Add id attributes to headings for in-page anchor links. Default: false. */
    heading_ids?: boolean;
}

/**
 * Parse markdown to HTML.
 * @param markdown  The markdown source text.
 * @param options   Configuration options.
 * @returns Rendered HTML string.
 */
declare function quikdown(markdown: string, options?: QuikdownOptions): string;

declare namespace quikdown {
    /** Emit CSS rules for quikdown element classes. */
    function emitStyles(prefix?: string, theme?: 'light' | 'dark'): string;
    /** Create a pre-configured parser with baked-in options. */
    function configure(options: QuikdownOptions): (markdown: string) => string;
    /** Semantic version string. */
    const version: string;
}

export default quikdown;
