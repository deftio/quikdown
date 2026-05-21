/**
 * quikdown_json — Markdown to JSON converter.
 */

import quikdown_ast from './quikdown_ast';
import { ASTDocument } from './quikdown_ast';

export interface JsonOptions {
    /** JSON indentation level. Default: 2. */
    indent?: number;
}

/**
 * Convert markdown to a JSON string representation of its AST.
 * @param markdown  The markdown source text.
 * @param options   Configuration options.
 * @returns JSON string.
 */
declare function quikdown_json(markdown: string, options?: JsonOptions): string;

declare namespace quikdown_json {
    /** Direct access to the AST parser. */
    const parse: typeof quikdown_ast;
    /** Semantic version string. */
    const version: string;
}

export default quikdown_json;
