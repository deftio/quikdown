/**
 * quikdown_ast_html - AST to HTML Converter
 * TypeScript definitions
 */

declare module 'quikdown/ast-html' {
  import type { DocumentNode, ASTNode, QuikdownASTOptions } from 'quikdown/ast';

  /**
   * Options for the HTML renderer
   */
  export interface QuikdownASTHTMLOptions extends QuikdownASTOptions {
    /**
     * If true, uses inline styles instead of CSS classes.
     * Useful for emails or environments without CSS support.
     * @default false
     */
    inline_styles?: boolean;
  }

  /**
   * Convert input to HTML
   * Accepts markdown string, AST object, JSON string, or YAML string
   * @param input - The input to convert
   * @param options - Optional configuration
   * @returns HTML string
   */
  function quikdown_ast_html(
    input: string | ASTNode | DocumentNode,
    options?: QuikdownASTHTMLOptions
  ): string;

  namespace quikdown_ast_html {
    /**
     * Convert input to AST
     * Accepts markdown string, AST object, JSON string, or YAML string
     * @param input - The input to convert
     * @param options - Optional configuration
     * @returns The AST document object
     */
    export function toAst(
      input: string | ASTNode | DocumentNode,
      options?: QuikdownASTOptions
    ): DocumentNode;

    /**
     * Render an AST node to HTML
     * @param node - The AST node to render
     * @param options - Optional configuration
     * @returns HTML string
     */
    export function renderAst(
      node: ASTNode | DocumentNode,
      options?: QuikdownASTHTMLOptions
    ): string;

    /**
     * The version of quikdown_ast_html
     */
    export const version: string;
  }

  export = quikdown_ast_html;
}

// For ES6 module imports
export default quikdown_ast_html;
export { QuikdownASTHTMLOptions };
