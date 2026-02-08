/**
 * quikdown_json - Markdown to JSON Converter
 * TypeScript definitions
 */

declare module 'quikdown/json' {
  import type { DocumentNode, QuikdownASTOptions } from 'quikdown/ast';

  /**
   * Options for the JSON converter
   */
  export interface QuikdownJSONOptions extends QuikdownASTOptions {
    /**
     * Number of spaces for JSON indentation
     * @default 2
     */
    indent?: number;
  }

  /**
   * Convert markdown to JSON string
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns JSON string representation of the AST
   */
  function quikdown_json(markdown: string, options?: QuikdownJSONOptions): string;

  namespace quikdown_json {
    /**
     * Direct access to the AST parser
     * @param markdown - The markdown source text
     * @param options - Optional configuration
     * @returns The AST document object
     */
    export function parse(markdown: string, options?: QuikdownASTOptions): DocumentNode;

    /**
     * The version of quikdown_json
     */
    export const version: string;
  }

  export = quikdown_json;
}

// For ES6 module imports
export default quikdown_json;
export { QuikdownJSONOptions };
