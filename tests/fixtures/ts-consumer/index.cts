/**
 * TypeScript CommonJS consumer smoke test (moduleResolution: nodenext).
 * `require()` must type-check against the .d.cts declarations, which describe
 * the real `module.exports = fn` shape of the CommonJS bundles.
 *
 * Run: npm run verify:types
 */

import quikdown = require('quikdown');
import quikdown_bd = require('quikdown/bd');
import QuikdownEditor = require('quikdown/edit');
import quikdown_ast = require('quikdown/ast');
import quikdown_json = require('quikdown/json');
import quikdown_yaml = require('quikdown/yaml');
import quikdown_ast_html = require('quikdown/ast-html');
import mcp = require('quikdown/mcp');

const opts: quikdown.QuikdownOptions = { inline_styles: false, allow_images: false };
const html: string = quikdown('# Hello', opts);
const parser = quikdown.configure({ lazy_linefeeds: true });
const configured: string = parser('line1\nline2');
const ver: string = quikdown.version;

const bdHtml: string = quikdown_bd('**bold**', opts);
const md: string = quikdown_bd.toMarkdown('<h1>Hello</h1>');

const editorOpts: QuikdownEditor.EditorOptions = { mode: 'split' };
const EditorCtor: typeof QuikdownEditor = QuikdownEditor;

const ast: quikdown_ast.ASTDocument = quikdown_ast('# Heading');
const json: string = quikdown_json('# Heading');
const yaml: string = quikdown_yaml('# Heading');
const astHtml: string = quikdown_ast_html(json);

const server: mcp.McpServer = mcp.createMcpServer();
