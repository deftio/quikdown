/**
 * quikdown_ast_html — AST to HTML renderer.
 */

import { ASTDocument } from './quikdown_ast';

export interface ASTHtmlOptions {
    /** Use inline styles instead of CSS classes. Default: false. */
    inline_styles?: boolean;
}

/**
 * Convert markdown, AST, JSON, or YAML input to HTML.
 * Auto-detects input format.
 * @param input    Markdown string, AST object, JSON string, or YAML string.
 * @param options  Rendering options.
 * @returns HTML string.
 */
declare function quikdown_ast_html(input: string | ASTDocument, options?: ASTHtmlOptions): string;

declare namespace quikdown_ast_html {
    /** Convert any supported input format to an AST. */
    function toAst(input: string | ASTDocument, options?: Record<string, unknown>): ASTDocument;
    /** Render an AST to HTML. */
    function renderAst(node: ASTDocument, options?: ASTHtmlOptions): string;
    /** Semantic version string. */
    const version: string;
}

export default quikdown_ast_html;
