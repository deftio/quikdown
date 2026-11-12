/**
 * TypeScript ESM consumer smoke test.
 * Imports by package name, so resolution goes through package.json "exports"
 * exactly as it does for a real consumer.
 *
 * Run: npm run verify:types
 * (tools/verifyTypes.cjs installs the `npm pack` tarball into a temp project
 * and compiles this file under several module-resolution modes.)
 */

import quikdown, { type QuikdownOptions } from 'quikdown';
import quikdown_bd from 'quikdown/bd';
import QuikdownEditor from 'quikdown/edit';
import type { EditorOptions } from 'quikdown/edit';
import quikdown_ast from 'quikdown/ast';
import type { ASTNode } from 'quikdown/ast';
import quikdown_json from 'quikdown/json';
import quikdown_yaml from 'quikdown/yaml';
import quikdown_ast_html from 'quikdown/ast-html';
import createMcpServer, { type McpServer } from 'quikdown/mcp';

// Core parser
const html: string = quikdown('# Hello');
const htmlStyled: string = quikdown('**bold**', { inline_styles: true });
const htmlBd: string = quikdown('> quote', { bidirectional: true });
const htmlWhitelist: string = quikdown('<b>safe</b>', { allow_unsafe_html: ['b'] });
const opts: QuikdownOptions = { allow_images: false };
const htmlNoImages: string = quikdown('![alt](https://example.com/a.png)', opts);

// Configured parser
const parser = quikdown.configure({ lazy_linefeeds: true });
const configured: string = parser('line1\nline2');

// Version
const ver: string = quikdown.version;

// Styles
const css: string = quikdown.emitStyles('qd-', 'dark');

// Bidirectional
const bdHtml: string = quikdown_bd('| A | B |\n|---|---|\n| 1 | 2 |');
const md: string = quikdown_bd.toMarkdown('<h1>Hello</h1>');

// Editor (type-check constructor signature)
const editorOpts: EditorOptions = {
    mode: 'split',
    showToolbar: true,
    theme: 'auto',
};

// AST
const ast: ASTNode = quikdown_ast('# Heading\n\nParagraph');

// JSON serialization
const json: string = quikdown_json('# Heading');

// YAML serialization
const yaml: string = quikdown_yaml('# Heading');

// AST to HTML
const astHtml: string = quikdown_ast_html(json);

// Editor class + MCP server are importable values
const EditorCtor: typeof QuikdownEditor = QuikdownEditor;
const mcp: McpServer = createMcpServer();
