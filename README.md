# quikdown

[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage](https://img.shields.io/badge/coverage-99.3%25-brightgreen)](https://github.com/deftio/quikdown)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/badge/minified-17.1KB-green.svg)](https://bundlephobia.com/package/quikdown)

Quikdown is a small, safe, bidirectional Markdown parser and editor for browser and Node.js apps — with rich fences, streaming, undo/redo, MCP tools, and a standalone airgapped build.

**[Try the Editor](https://deftio.github.io/quikdown/pages/edit/)** | **[Live Site](https://deftio.github.io/quikdown/pages/)** | **[Examples](https://deftio.github.io/quikdown/pages/examples/)** | **[Downloads](https://deftio.github.io/quikdown/pages/downloads/)** | **[Docs](docs/)**

![quikdown editor demo — markdown, Mermaid diagram, MathJax equation, and syntax-highlighted code](pages/assets/editor-demo.gif)
*Split-mode editor: Markdown source on the left, live preview on the right — with rendered Mermaid diagrams, MathJax equations, and syntax-highlighted code.*

### Why Quikdown?

- **Small** — ~15 KB parser, ~98 KB editor. Zero runtime dependencies.
- **Safe by default** — all HTML escaped, URL sanitization blocks `javascript:` / `vbscript:` / non-image `data:` URIs. No `eval`, no dynamic regex.
- **Bidirectional** — edit rendered HTML and get Markdown back. Round-trip preserves fences, tables, and formatting.
- **Rich fences** — Mermaid diagrams, Vega/Vega-Lite charts, MathJax equations, ABC music notation, GeoJSON maps, CSV/TSV/PSV tables, SVG, STL 3D models, syntax-highlighted code, and custom fences via the plugin API.
- **Undo/redo** — programmatic undo/redo lets LLMs and humans co-edit a shared document with full change reversibility.
- **Offline standalone** — a self-contained airgapped build (~7.7 MB / ~1 MB gzipped) bundles everything for air-gapped, regulated, or field environments. See companion app [Quikleaf](https://github.com/deftio/quikleaf) for an offline desktop app (with optional LLM support).
- **LLM-friendly** — stream Markdown tokens in, render incrementally, reverse agent mistakes with undo/redo. 24-tool MCP server for AI agents.

### Why another Markdown parser?

Quikdown is a compact, embeddable parser/editor where Markdown remains the source of truth — for both humans and agents. It doesn't try to replace full CommonMark parsers or heavyweight editor stacks. It fills the gap for apps that need a fast, safe, self-contained Markdown render+edit surface with minimal footprint.

### Modules

Nine modules — use only what you need:

| Module | Size | What it does |
|--------|------|--------------|
| **quikdown.js** | ~15 KB | Markdown → HTML parser. XSS-safe, fence plugin callbacks, inline styles or CSS classes. |
| **quikdown_bd.js** | ~20 KB | Bidirectional: core parser + HTML → Markdown round-trip. |
| **quikdown_edit.js** | ~98 KB | Drop-in split-view editor. Undo/redo, toolbar, lazy-loaded fence plugins. |
| **quikdown_edit_standalone.js** | ~7.7 MB | Offline editor. All fence libraries bundled — no CDN required. [Docs](docs/standalone-editor.md) |
| **quikdown_mcp.js** | ~26 KB | MCP server. 24 tools for AI agents over JSON-RPC 2.0. |
| **quikdown_ast/json/yaml/ast_html** | ~5–8 KB each | AST companion libraries for structured output. |

## Features

- **Compact markdown parser** — single-pass markdown to HTML. Handles headings, lists, tables, code blocks, inline formatting, task lists, autolinks, and lazy linefeeds.
- **Bidirectional editing** — edit the rendered HTML and get markdown back. Round-trip preserves formatting, fences, and tables.
- **Drop-in editor** — one `<div>`, one import. Source, split, and preview modes. Undo/redo, toolbar, copy as rich text, light/dark/auto themes.
- **Fence plugins** — code (highlight.js), Mermaid diagrams, MathJax equations, inline SVG, CSV/TSV/PSV tables, GeoJSON maps, STL 3D models, ABC music notation, Vega/Vega-Lite charts, raw HTML.
- **XSS-safe** — HTML entities escaped by default. URL sanitization blocks `javascript:`, `vbscript:`, and non-image `data:` URIs.
- **Browser and Node.js** — forward parser and bidirectional parser work in both. Quikdown Editor requires DOM.
- **Zero runtime deps (core)** — parser and bidirectional modules have no dependencies. The editor lazy-loads fence libraries (highlight.js, Mermaid, MathJax, ABCJS, Vega, etc.) from CDN on demand, or use the [standalone offline bundle](docs/standalone-editor.md) (~7.7 MB / ~1.0 MB gzipped, no CDN).
- **TypeScript definitions** — maintained `.d.ts` files for all modules.
- **Inline styles or CSS classes** — built-in light/dark themes, or bring your own CSS.
- **Copy as rich text** — copies the rendered preview to clipboard with images, tables, and rendered fences. Paste into Gmail, Word, Slack, Notion.
- **Headless mode** — run the editor without a toolbar. Wire `undo()`, `setTheme()`, `setMode()` to your own UI.  Rich API for controlling / selecting / manipulating markdown and rendered text with undo/redo support.
- **Structured output** — parse markdown into AST, JSON, or YAML via companion libraries.

## Security

All HTML is escaped by default. Only safe Markdown constructs become HTML:

```javascript
const unsafe = '<script>alert("XSS")</script> **bold**';
const safe = quikdown(unsafe);
// &lt;script&gt;alert("XSS")&lt;/script&gt; <strong>bold</strong>
```

- **HTML escaped by default** — no raw HTML passes through unless a fence plugin explicitly renders it.
- **URL sanitization** — blocks `javascript:`, `vbscript:`, and non-image `data:` URIs in links and images.
- **Trusted fence path** — fence plugin callbacks receive pre-extracted content and the declared language tag. The plugin decides what to render; untrusted content never reaches `innerHTML` without an explicit opt-in. The built-in editor uses DOMPurify for the `html` fence.
- **No `eval`, no dynamic `RegExp`** — all regex patterns are static literals, verified free of catastrophic backtracking (ReDoS).
- **Static analysis** — passes ESLint with [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security) at error level with zero findings. Enforced in CI on every build.

For the full security model, see [docs/security.md](docs/security.md).

## Installation

Quikdown is available via [NPM](https://www.npmjs.com/package/quikdown) and related [unpkg](https://unpkg.com/quikdown) and [jsdelivr](https://cdn.jsdelivr.net/npm/quikdown)

### NPM package
```bash
npm install quikdown
```

### CDN using UNPKG  

**CDN (ES Modules):**
```html
<script type="module">
  import quikdown from 'https://unpkg.com/quikdown/dist/quikdown.esm.min.js';
  document.body.innerHTML = quikdown('# Hello World');
</script>
```

**CDN (UMD):**
```html
<script src="https://unpkg.com/quikdown/dist/quikdown.umd.min.js"></script>
<script>
  document.body.innerHTML = quikdown('# Hello World');
</script>
```

## Quick Start

Quikdown is built in 3 versions. The smallest (quikdown) provides markdown to html conversion only.  The next (quikdown_bd) provides markdown to html and html to markdown support.  The lightweight editor quikdown_edit allows a bidirectional editor with lazy loading for common fences such as codeblocks, svg, and mermaid diagrams is also provided.

### Markdown → HTML (quikdown.js)

```javascript
// Basic conversion
const html = quikdown('# Hello World',
    {inline_styles: true}  // Use inline styles,  more options in API docs
);

document.body.innerHTML = html;

```

### Bidirectional Markdown ↔  HTML (quikdown_bd.js)

```javascript
// Convert with source tracking
const htmlString = quikdown_bd(markdown, options);

// Convert HTML back to Markdown
const markdown = quikdown_bd.toMarkdown(htmlString);
```

Note: quikdown does not provide a *generic* html to markdown conversion but uses special tags and limited DOM parsing for HTML to markdown conversion.  Standard markdown components such as headings, text styles, tables, quotes, etc are supported.  For custom fences quikdown relies on its tag system or 3rd party handlers to provide reverse (html to md) conversion.

### Editor (quikdown_edit.js)

```javascript
const editor = new QuikdownEditor('#container', {
  mode: 'split',           // 'source', 'split', 'preview'
  theme: 'auto',           // 'light', 'dark', 'auto'
  plugins: { highlightjs: true, mermaid: true } // built-in fence handlers, see API docs for custom plugins
});

editor.setMarkdown('# Content  \nTo be quik or not to be.');  // provide default content
const content = editor.getMarkdown(); // get source content, see APIs for getting / setting HTML
```

### AST Libraries (quikdown_ast, quikdown_json, quikdown_yaml)

Convert markdown to structured data formats for programmatic manipulation:

```javascript
import quikdown_ast from 'quikdown/ast';
import quikdown_json from 'quikdown/json';
import quikdown_yaml from 'quikdown/yaml';
import quikdown_ast_html from 'quikdown/ast-html';

const markdown = '# Hello\n\nWorld **bold**';

// Markdown → AST object
const ast = quikdown_ast(markdown);

// Markdown → JSON string
const json = quikdown_json(markdown);

// Markdown → YAML string
const yaml = quikdown_yaml(markdown);

// AST/JSON/YAML → HTML
const html = quikdown_ast_html(ast);  // or pass json/yaml string
```

The AST parsers are "forgiving" - they handle malformed markdown gracefully without throwing errors. See [AST Documentation](docs/quikdown-ast.md) for the complete node type reference.

**Note:** The editor automatically lazy-loads plugin libraries from CDNs when needed:
- **highlight.js** - Loaded when code blocks are encountered and `highlightjs: true`
- **mermaid** - Loaded when mermaid diagrams are found and `mermaid: true`
- **DOMPurify** - Loaded when HTML fence blocks are rendered
- **MathJax v3** - Loaded when `math`, `tex`, `latex`, or `katex` fence blocks are encountered (`katex` lang kept for backward compatibility)
- **ABCJS** - Loaded when `abc` or `music` fence blocks are encountered (sheet music rendering)
- **Vega + Vega-Lite + Vega-Embed** - Loaded when `vega`, `vega-lite`, or `vegalite` fence blocks are encountered (data visualization)

This keeps the initial bundle small while providing rich functionality on-demand.

## Integration

quikdown meets three common integration patterns. Pick the entry point that matches who drives the document:

| Audience | What you need | Entry point |
|----------|---------------|-------------|
| **Parse-only** | Render markdown, AST/JSON/YAML, streaming HTML in your app | `import quikdown from 'quikdown'` — or `quikdown/ast`, `quikdown/json`, `quikdown/yaml` |
| **File agents** | An AI agent reads and writes `.md` / HTML files in a repo sandbox | **Path A:** `npx quikdown-mcp --root=.` — IDE editing, no browser |
| **Doc copilot** | Human edits in a live preview; agent drives the same buffer | **Path B:** `node examples/mcp-doc-host/start-mcp.js` — browser QuikdownEditor + Node MCP bridge |

**Parse-only** is the default: zero config, embed anywhere. **File agents** add MCP filesystem tools under a `--root` sandbox — best when the human stays in Cursor or VS Code. **Doc copilot** binds the full editor surface (regex, undo, rich render export) when the human works in a browser tab.

Browser demos and streaming patterns: [docs/llm-integration.md](docs/llm-integration.md). MCP setup and tool reference: [docs/quikdown-mcp.md](docs/quikdown-mcp.md).

## LLM and agent UIs

quikdown fits the **model writes markdown, human sees rendered output** loop:

| Pattern | Doc / demo |
|---------|------------|
| **AI Canvas** — chat + document editor | [examples/ai-canvas](examples/ai-canvas/) — simulated or live LLM (BYOK) |
| Agent **tool calling** on editor | [examples/llm-tool-editor](examples/llm-tool-editor/) |
| **MCP doc copilot** (Node + browser) | [examples/mcp-doc-host](examples/mcp-doc-host/) — 24 MCP tools via WebSocket |
| Stream into **QuikdownEditor** | [examples/llm-stream-editor](examples/llm-stream-editor/) |
| Stream tokens into HTML | [integration-llm-stream](https://deftio.github.io/quikdown/pages/examples/integration-llm-stream.html) |
| Chat bubbles + markdown | [quikchat](https://github.com/deftio/quikchat) + [integration example](https://deftio.github.io/quikdown/pages/examples/integration-quikchat.html) |

Overview: [docs/llm-integration.md](docs/llm-integration.md)

## MCP Server (AI Agent Integration)

quikdown includes an MCP server that lets AI agents parse markdown, convert between formats, read/write files, and (with a doc host) control the editor — all over JSON-RPC 2.0.

**Two paths:**

| Path | Human UI | Command |
|------|----------|---------|
| **A — IDE** (shipped) | Cursor / VS Code file editor; no browser | `npx quikdown-mcp --root=.` |
| **B — Doc copilot** (shipped) | **Browser tab** with QuikdownEditor; Node host bridges MCP | `node examples/mcp-doc-host/start-mcp.js` |

Path B is a **Node launcher + browser window** — you work in the browser; the agent drives the same doc via MCP through Node. Setup: [examples/mcp-doc-host/README.md](examples/mcp-doc-host/README.md). Overview: [Path A vs Path B](docs/quikdown-mcp.md#path-a-vs-path-b).

```bash
npm install quikdown
npx quikdown-mcp --root=.
```

**24 tools** in three groups:

| Group | Tools | Activated by |
|-------|-------|-------------|
| Headless | `markdown_to_html`, `html_to_markdown`, `markdown_stats`, `quikdown_info`, `markdown_to_ast`, `markdown_to_json` | Always |
| Filesystem | `read_file_info`, `read_file_lines`, `read_file_markdown`, `write_markdown_to_file`, `write_html_to_file` | `--root` flag |
| Editor | `read_editor`, `write_editor`, `find_regex`, `replace_regex`, `replace_text`, `extract_text`, `get_stats`, `get_html`, `undo`, `redo`, `load_file_to_editor`, `get_rendered`, `write_rendered_to_file` | Editor binding |

**Cursor (Path A — IDE + repo files):**
```json
{
  "mcpServers": {
    "quikdown": { "command": "npx", "args": ["quikdown-mcp", "--root=."] }
  }
}
```

**Cursor (Path B — doc copilot, from quikdown repo):** run `npm run build` first, then:
```json
{
  "mcpServers": {
    "quikdown-doc": {
      "command": "node",
      "args": ["examples/mcp-doc-host/start-mcp.js"]
    }
  }
}
```
Opens a browser tab with QuikdownEditor; you edit in the browser while the agent uses MCP. See [examples/mcp-doc-host/README.md](examples/mcp-doc-host/README.md).

**Claude Desktop (Path A):**
```json
{
  "mcpServers": {
    "quikdown": { "command": "npx", "args": ["quikdown-mcp", "--root=."] }
  }
}
```

**Programmatic:**
```javascript
import { createMcpServer } from 'quikdown/mcp';
const mcp = createMcpServer({ root: '.' });
const result = mcp.callTool('markdown_to_html', { markdown: '# Hello' });
```

Full documentation: [docs/quikdown-mcp.md](docs/quikdown-mcp.md) | [MCP setup page](https://deftio.github.io/quikdown/pages/mcp/)

## Other Configuration Options
quikdown supports built-in styles for a "batteries included" experience or you can bring your own CSS themes.  Example css files are provided for basic light and dark themes to get started.

```javascript
const html = quikdown(markdown, {
  lazy_linefeeds: true,    // Single newlines become <br>
  inline_styles: false,    // Use class based CSS instead of inline styles
  fence_plugin: {          // Custom code block processor (v1.1.0+ API)
    render: myHandler      // Function to render fence blocks
  }
});
```

### Styling Options

**Inline styles:** All formatting uses inline CSS
```javascript
quikdown('**bold**', { inline_styles: true });
// <strong style="font-weight: bold;">bold</strong>
```

**Class-based styling:** Uses CSS classes (default)
```javascript
quikdown('**bold**');
// <strong>bold</strong>
// Requires CSS: .quikdown strong { font-weight: bold; }
// see included dist/quikdown.light.css or quikdown.dark.css
```

### Fence Plugins

Quikdown provides a callback for all fenced text such as code blocks, math, svg etc.

Handle code blocks with custom languages:

```javascript
const fencePlugin = {
  render: (code, language) => {
    if (language === 'mermaid') {
      // Process with mermaid library and return rendered diagram
      const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
      setTimeout(() => mermaid.render(id + '-svg', code).then(result => {
        document.getElementById(id).innerHTML = result.svg;
      }), 0);
      return `<div id="${id}" class="mermaid">Loading diagram...</div>`;
    }
    // Return undefined for default handling
  }
};

const html = quikdown(markdown, { fence_plugin: fencePlugin });
```


## TypeScript Support

quikdown includes TypeScript definitions for better IDE support and type safety:

```typescript
import quikdown, { QuikdownOptions, FencePlugin } from 'quikdown';

const fencePlugin: FencePlugin = {
  render: (content: string, language: string) => {
    return `<pre class="hljs ${language}">${content}</pre>`;
  }
};

const options: QuikdownOptions = {
  inline_styles: true,
  fence_plugin: fencePlugin
};

const html: string = quikdown(markdown, options);
```

## Supported Markdown

**Text formatting:** `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``

**Headings:** `# H1` through `###### H6`

**Lists:**

- Unordered lists  
1. Ordered lists  
- [x] Task lists  

**Links:** `[text](url)` and automatic URL detection

**Code blocks:**  

```javascript
console.log('syntax highlighting support via plugins');
```

**Tables, blockquotes, horizontal rules** - See [documentation](docs/) for complete syntax reference

## API Reference

For complete API documentation, see [docs/api-reference.md](docs/api-reference.md)

## Framework Integration

Works with React, Vue, Svelte, Angular. See [Framework Integration Guide](docs/framework-integration.md). For LLM/agent patterns (streaming, tool editor), see [LLM Integration](docs/llm-integration.md).

## Streaming

Quikdown's parser is fast enough to re-parse the full buffer on every incoming chunk — no incremental parsing state to manage:

```javascript
// Render-only: stream tokens into a div
let buffer = '';
for await (const chunk of llmStream) {
  buffer += chunk;
  previewEl.innerHTML = quikdown(buffer, { lazy_linefeeds: true });
}
```

```javascript
// Editor: stream into QuikdownEditor
let buffer = '';
for await (const chunk of llmStream) {
  buffer += chunk;
  await editor.setMarkdown(buffer);
}
```

Incomplete fences are handled gracefully — they render as plain text until the closing fence arrives. See [docs/llm-integration.md](docs/llm-integration.md) for production patterns (debouncing, undo grouping).

## Undo / Redo

The editor maintains a configurable undo stack (default 100 states). Keyboard shortcuts work out of the box:

| Action | Shortcut |
|--------|----------|
| Undo | Ctrl+Z (Cmd+Z on Mac) |
| Redo | Ctrl+Shift+Z / Ctrl+Y |

```javascript
const editor = new QuikdownEditor('#container', {
  undoStackSize: 200,     // max undo states (default 100)
  showUndoRedo: true      // show toolbar buttons
});

editor.undo();            // undo last change
editor.redo();            // redo
editor.canUndo();         // → boolean
editor.canRedo();         // → boolean
editor.clearHistory();    // wipe all history
```

This is especially useful for human + LLM collaborative editing: agents make mistakes, and users need reversible edits. Undo/redo is also available as an MCP tool in [Path B](docs/quikdown-mcp.md#path-a-vs-path-b). Full API: [docs/quikdown-editor.md](docs/quikdown-editor.md).

## Standalone / Airgapped Build

The standalone editor bundles all fence libraries — no CDN, no network required:

```bash
# Download from GitHub Releases
# or build locally:
npm run build:standalone
```

```html
<!-- Single file, works offline -->
<div id="editor"></div>
<script src="quikdown_edit_standalone.umd.min.js"></script>
<script>
  const editor = new QuikdownEditor('#editor', { mode: 'split' });
  editor.setMarkdown('# Works offline');
</script>
```

Use cases: air-gapped networks, regulated environments, field deployments, offline demos, Electron apps, embedded systems. See [docs/standalone-editor.md](docs/standalone-editor.md) for the full list of bundled libraries and build details. Pre-built zip available on [GitHub Releases](https://github.com/deftio/quikdown/releases).

## Comparison

| | Quikdown | marked | markdown-it | ProseMirror + markdown |
|---|---|---|---|---|
| **Parser size** | ~15 KB | ~40 KB | ~100 KB | ~200 KB+ |
| **Editor included** | Yes (~98 KB) | No | No | Yes (large stack) |
| **XSS-safe by default** | Yes | No (opt-in) | No (opt-in) | Depends on schema |
| **Bidirectional** | Yes | No | No | Yes |
| **Streaming-friendly** | Yes | Yes | Yes | Complex |
| **Offline standalone** | Yes (~7.7 MB all-in) | N/A | N/A | N/A |
| **Runtime deps** | 0 | 0 | 0 | Many |
| **MCP server** | 24 tools | No | No | No |
| **CommonMark coverage** | Subset | Full | Full | Full |

Quikdown intentionally trades full CommonMark coverage for a smaller, safer, more integrated package. If you need full spec compliance or a heavyweight collaborative editing framework, marked/markdown-it/ProseMirror are better choices.

## What Quikdown Is Not

- **Not a full CommonMark parser** — definition lists and some edge-case syntax are intentionally omitted. Reference-style links and footnotes are available as opt-in features (`reference_links: true`, `footnotes: true`).
- **Not a WYSIWYG framework** — the editor is a split-view Markdown-first surface, not a block-based rich text editor like Notion or ProseMirror.
- **Not a giant editor stack** — no virtual DOM, no plugin registries, no complex state management. One import, one `<div>`.

Optional **heading slugs**: pass `heading_ids: true` to add `id` attributes for in-page anchor links. Raw HTML/SVG can be rendered via fence plugins with XSS protection — see the API docs or try the built-in `html` fence in `quikdown_edit.js`.

## License

BSD 2-Clause - see [LICENSE.txt](LICENSE.txt)

## Acknowledgments

- Inspired by the simplicity of early markdown parsers
- Built for the [QuikChat](https://github.com/deftio/quikchat) project
- CommonMark spec for markdown standardization


## Support

- 📖 [Documentation](docs/)
- 🐛 [Issues](https://github.com/deftio/quikdown/issues)
- 📦 [Examples hub](https://deftio.github.io/quikdown/pages/examples/) · [examples/](examples/) (source)

