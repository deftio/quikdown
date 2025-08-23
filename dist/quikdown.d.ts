/**
 * quikdown - Lightweight Markdown Parser
 * TypeScript definitions
 */

declare module 'quikdown' {
  /**
   * Fence plugin for custom code block rendering (v1.1.0+)
   */
  export interface FencePlugin {
    /**
     * Render markdown fence to HTML
     * @param content - The code block content (unescaped)
     * @param language - The language identifier (or empty string)
     * @returns HTML string or undefined for default rendering
     */
    render: (content: string, language: string) => string | undefined;
    
    /**
     * Convert HTML element back to markdown fence (optional)
     * @param element - The HTML element to convert
     * @returns Fence details or null to use default
     */
    reverse?: (element: HTMLElement) => {
      fence: string;
      lang: string;
      content: string;
    } | null;
  }
  
  /**
   * Options for configuring the quikdown parser
   */
  export interface QuikdownOptions {
    /**
     * Custom renderer for fenced code blocks (v1.1.0: object format required)
     * @since 1.1.0 - Must be an object with render function
     */
    fence_plugin?: FencePlugin;
    
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
     * If true, adds data-qd attributes for bidirectional conversion.
     * Enables HTML to Markdown conversion.
     * @default false
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
   * Parse markdown to HTML
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns The rendered HTML string
   */
  function quikdown(markdown: string, options?: QuikdownOptions): string;

  namespace quikdown {
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
    export function configure(options: QuikdownOptions): (markdown: string) => string;
    
    /**
     * The version of quikdown
     */
    export const version: string;
  }

  export = quikdown;
}

// For ES6 module imports
export default quikdown;
export { QuikdownOptions };