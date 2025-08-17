/**
 * quikdown_bd - Bidirectional Markdown/HTML Converter
 * TypeScript definitions
 */

declare module 'quikdown/bd' {
  /**
   * Options for configuring the quikdown_bd parser
   */
  export interface QuikdownBDOptions {
    /**
     * Custom renderer for fenced code blocks.
     * Return undefined to use default rendering.
     * @param content - The code block content (unescaped)
     * @param language - The language identifier (or empty string)
     * @returns HTML string or undefined for default rendering
     */
    fence_plugin?: (content: string, language: string) => string | undefined;
    
    /**
     * If true, uses inline styles instead of CSS classes.
     * Useful for emails or environments without CSS support.
     * @default false
     */
    inline_styles?: boolean;
    
    /**
     * If true, allows potentially unsafe URLs (javascript:, data:, etc).
     * Only use with trusted content.
     * @default false
     */
    allow_unsafe_urls?: boolean;
  }

  /**
   * Parse markdown to HTML with bidirectional support
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns The rendered HTML string with data-qd attributes for reverse conversion
   */
  function quikdown_bd(markdown: string, options?: QuikdownBDOptions): string;

  namespace quikdown_bd {
    /**
     * Convert HTML back to Markdown
     * @param htmlOrElement - HTML string or DOM element to convert
     * @returns The reconstructed markdown string
     */
    export function toMarkdown(htmlOrElement: string | HTMLElement): string;

    /**
     * Generate CSS styles for quikdown classes with theme support
     * @param prefix - CSS class prefix (default: 'quikdown-')
     * @param theme - Theme name: 'light' (default) or 'dark'
     * @returns CSS string with themed .quikdown-* styles
     */
    export function emitStyles(prefix?: string, theme?: 'light' | 'dark'): string;
    
    /**
     * Create a configured parser function with preset options
     * @param options - Configuration to apply to all parsing
     * @returns A parser function with the options pre-applied
     */
    export function configure(options: QuikdownBDOptions): (markdown: string) => string;
    
    /**
     * The version of quikdown_bd (same as core quikdown)
     */
    export const version: string;
  }

  export = quikdown_bd;
}

// For direct imports
declare module 'quikdown_bd' {
  export * from 'quikdown/bd';
  import quikdown_bd from 'quikdown/bd';
  export default quikdown_bd;
}