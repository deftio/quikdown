/**
 * quikdown_yaml - Markdown to YAML Converter
 * TypeScript definitions
 */

declare module 'quikdown/yaml' {
  import type { DocumentNode, QuikdownASTOptions, ASTNode } from 'quikdown/ast';

  /**
   * Options for the YAML converter
   */
  export interface QuikdownYAMLOptions extends QuikdownASTOptions {
    // Reserved for future options
  }

  /**
   * Convert markdown to YAML string
   * @param markdown - The markdown source text
   * @param options - Optional configuration
   * @returns YAML string representation of the AST
   */
  function quikdown_yaml(markdown: string, options?: QuikdownYAMLOptions): string;

  namespace quikdown_yaml {
    /**
     * Direct access to the AST parser
     * @param markdown - The markdown source text
     * @param options - Optional configuration
     * @returns The AST document object
     */
    export function parse(markdown: string, options?: QuikdownASTOptions): DocumentNode;

    /**
     * Convert an AST object directly to YAML string
     * @param ast - The AST object to serialize
     * @returns YAML string
     */
    export function stringify(ast: ASTNode | DocumentNode): string;

    /**
     * The version of quikdown_yaml
     */
    export const version: string;
  }

  export = quikdown_yaml;
}

// For ES6 module imports
export default quikdown_yaml;
export { QuikdownYAMLOptions };
