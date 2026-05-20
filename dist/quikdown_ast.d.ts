/**
 * quikdown_ast — Markdown to AST parser.
 */

export interface ASTNode {
    type: string;
    children?: ASTNode[];
    value?: string;
    level?: number;
    lang?: string;
    content?: string;
    ordered?: boolean;
    items?: ASTNode[];
    checked?: boolean;
    url?: string;
    alt?: string;
    alignments?: string[];
    rows?: ASTNode[];
}

export interface ASTDocument {
    type: 'document';
    children: ASTNode[];
}

export interface ASTOptions {
    /** Options passed through to the parser. */
    [key: string]: unknown;
}

/**
 * Parse markdown into an AST.
 * @param markdown  The markdown source text.
 * @param options   Configuration options.
 * @returns AST document node.
 */
declare function quikdown_ast(markdown: string, options?: ASTOptions): ASTDocument;

declare namespace quikdown_ast {
    /** Semantic version string. */
    const version: string;
}

export default quikdown_ast;
