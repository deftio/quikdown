/**
 * quikdown_bd - Bidirectional Markdown Parser
 * TypeScript definitions
 */

declare module 'quikdown/bd' {
  /**
   * Options for configuring the quikdown_bd parser
   */
  export interface QuikdownBdOptions {
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
    
    /**
     * Always true for quikdown_bd - adds data-qd attributes for bidirectional conversion.
     * @default true
     */
    bidirectional?: boolean;
    
    /**
     * If true, single newlines become <br> tags.
     * Useful for chat/LLM applications where Enter should create a line break.
     * @default false
     */
    lazy_linefeeds?: boolean;
  }

  /**
   * Parse markdown to HTML with bidirectional support
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns The rendered HTML string with data-qd attributes
   */
  function quikdown_bd(markdown: string, options?: QuikdownBdOptions): string;

  namespace quikdown_bd {
    /**
     * Convert HTML back to Markdown
     * @param htmlOrElement - HTML string or DOM element to convert
     * @param options - Options including fence plugin with reverse handler
     * @returns The recovered markdown string
     */
    export function toMarkdown(htmlOrElement: string | HTMLElement, options?: {
      fence_plugin?: import('quikdown').FencePlugin;
    }): string;
    
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
    export function configure(options: QuikdownBdOptions): (markdown: string) => string;
    
    /**
     * The version of quikdown_bd (same as core quikdown)
     */
    export const version: string;
  }

  export = quikdown_bd;
}

// For ES6 module imports
export default quikdown_bd;
export { QuikdownBdOptions };

/**
 * Default export for direct import
 */
declare function quikdown_bd(markdown: string, options?: QuikdownBdOptions): string;

declare namespace quikdown_bd {
  export function toMarkdown(htmlOrElement: string | HTMLElement, options?: {
    fence_plugin?: import('quikdown').FencePlugin;
  }): string;
  export function emitStyles(prefix?: string, theme?: 'light' | 'dark'): string;
  export function configure(options: QuikdownBdOptions): (markdown: string) => string;
  export const version: string;
}

export interface QuikdownBdOptions {
  fence_plugin?: (content: string, language: string) => string | undefined;
  inline_styles?: boolean;
  allow_unsafe_urls?: boolean;
  bidirectional?: boolean;
  lazy_linefeeds?: boolean;
}

export default quikdown_bd;