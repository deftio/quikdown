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
import type {
    EditorOptions, EditorSelection, FormatState, FormatCommand, FormatResult,
    EditorHistory, EditorScroll, EditorMode, EditorPane, ChangeMeta
} from 'quikdown/edit';
import StandaloneEditor from 'quikdown/edit-standalone';
import type { EditorOptions as StandaloneOptions } from 'quikdown/edit-standalone';
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

// Editor host API (types only — nothing here runs)
const hostOpts: EditorOptions = {
    showToolbar: false,
    mount: 'append',
    shortcuts: true,
    syncScroll: true,
    initialContent: '# hi',
    assetBase: 'https://example.com/assets/',
    resolveImageSrc: (src, info) => (info.alt ? 'asset://' + src : undefined),
    onChange: (markdown: string, html: string, meta: ChangeMeta) => { void markdown; void html; void meta.source; },
    onModeChange: (mode: EditorMode) => { void mode; },
    onRender: (preview: HTMLElement) => { void preview; },
    onSelectionChange: (sel) => { const bold: boolean = sel.format.bold; void bold; },
    onLinkClick: (href: string, event: MouseEvent) => { void href; void event; return true; },
};
function useEditor(editor: QuikdownEditor): void {
    const mode: EditorMode = editor.getMode();
    editor.setSplitPane('preview');
    const splitPane: EditorPane = editor.getSplitPane();
    editor.setLineNumbers(true);
    const numbered: boolean = editor.getLineNumbers();
    const sel: EditorSelection = editor.getSelection();
    const pane: EditorPane | null = editor.getFocusedPane();
    const range: { start: number; end: number } = editor.setSelection(sel.start, sel.end, 'preview');
    editor.setSelection(0);
    editor.insertText('text');
    editor.replaceRange(0, 4, 'more', true);
    editor.focus('source');
    const ok: boolean = editor.format('bold');
    editor.format('link', 'https://example.com');
    const state: FormatState = editor.getFormatState();
    const level: number = state.heading;
    const scroll: EditorScroll = editor.getScroll();
    editor.setScroll({ preview: scroll.preview });
    const line: number = editor.lineOf(document.body);
    const block: Element | null = editor.scrollToLine(line, 'preview');
    const history: EditorHistory = editor.getHistory();
    editor.setHistory(history);
    editor.clearHistory();
    editor.flush();
    void editor.setMarkdown('# doc', { history: 'reset', source: 'load' });
    const current: string = editor.markdown;
    const rendered: string = editor.html;
    const m2: EditorMode = editor.mode;
    void [mode, pane, range, ok, level, block, current, rendered, m2];
}
const command: FormatCommand = 'h2';
const formatted: FormatResult = QuikdownEditor.formatMarkdown('text', 0, 4, command);
const maybe: FormatResult | null = QuikdownEditor.formatMarkdown('text', 0, 4, 'anything' as string);
const fstate: FormatState = QuikdownEditor.getFormatState('**x**', 2, 3);
const mapped: number = QuikdownEditor.mapOffset('a', 'ab', 1);
const commands: FormatCommand[] = QuikdownEditor.FORMAT_COMMANDS;
const standaloneOpts: StandaloneOptions = { allowExternalFetch: false };
function makeStandalone(el: HTMLElement): QuikdownEditor { return new StandaloneEditor(el, standaloneOpts); }
void [hostOpts, useEditor, formatted, maybe, fstate, mapped, commands, makeStandalone];

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
