/**
 * quikdown - Lightweight Markdown Parser
 * TypeScript definitions
 */

declare module 'quikdown' {
  /**
   * Options for configuring the quikdown parser
   */
  export interface QuikdownOptions {
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
   * Parse markdown to HTML
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns The rendered HTML string
   */
  function quikdown(markdown: string, options?: QuikdownOptions): string;

  namespace quikdown {
    /**
     * Generate CSS styles for quikdown classes
     * @returns CSS string with .quikdown-* styles
     */
    export function emitStyles(): string;
    
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