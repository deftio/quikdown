/**
 * quikdown_yaml — Markdown to YAML converter.
 */

import { ASTDocument } from './quikdown_ast';

/**
 * Convert markdown to a YAML string representation of its AST.
 * @param markdown  The markdown source text.
 * @param options   Configuration options.
 * @returns YAML string.
 */
declare function quikdown_yaml(markdown: string, options?: Record<string, unknown>): string;

declare namespace quikdown_yaml {
    /** Convert an AST document to YAML. */
    function stringify(ast: ASTDocument): string;
    /** Semantic version string. */
    const version: string;
}

export default quikdown_yaml;
