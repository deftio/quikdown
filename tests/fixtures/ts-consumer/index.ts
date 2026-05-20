/**
 * TypeScript consumer smoke test.
 * Verifies that all quikdown .d.ts files compile correctly.
 * Run: npx tsc --noEmit -p tests/fixtures/ts-consumer/tsconfig.json
 *
 * Uses relative paths to dist/ (same resolution consumers get via package.json exports).
 */

import quikdown from '../../../dist/quikdown';
import quikdown_bd from '../../../dist/quikdown_bd';
import QuikdownEditor from '../../../dist/quikdown_edit';
import type { EditorOptions } from '../../../dist/quikdown_edit';
import quikdown_ast from '../../../dist/quikdown_ast';
import type { ASTNode } from '../../../dist/quikdown_ast';
import quikdown_json from '../../../dist/quikdown_json';
import quikdown_yaml from '../../../dist/quikdown_yaml';
import quikdown_ast_html from '../../../dist/quikdown_ast_html';

// Core parser
const html: string = quikdown('# Hello');
const htmlStyled: string = quikdown('**bold**', { inline_styles: true });
const htmlBd: string = quikdown('> quote', { bidirectional: true });
const htmlWhitelist: string = quikdown('<b>safe</b>', { allow_unsafe_html: ['b'] });

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
