# quikdown

[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage](https://img.shields.io/badge/coverage-98.3%25-brightgreen)](https://github.com/deftio/quikdown)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/badge/minified-14.9KB-green.svg)](https://bundlephobia.com/package/quikdown)

A small, secure markdown parser and editor for the browser and Node.js. Parse markdown to HTML, edit it bidirectionally, render rich fences (diagrams, math, maps, charts, music), and let AI agents drive the same document humans see — all with zero runtime dependencies.

**[Live Site](https://deftio.github.io/quikdown/pages/)** | **[Try the Editor](https://deftio.github.io/quikdown/pages/edit/)** | **[Examples](https://deftio.github.io/quikdown/pages/examples/)** | **[Frameworks](https://deftio.github.io/quikdown/pages/frameworks/)** | **[Downloads](https://deftio.github.io/quikdown/pages/downloads/)** | **[Docs](docs/)**

![quikdown editor in split mode with Mermaid diagram rendering](pages/assets/editor-screenshot.png)
*quikdown_edit in split mode — markdown source on the left, live rendered preview with Mermaid diagram on the right.*

## Why quikdown

- **Secure by default** — all HTML is escaped. No XSS without explicit opt-in. URL sanitization blocks `javascript:`, `vbscript:`, and non-image `data:` URIs. Safe for untrusted input from users or LLMs.
- **Zero runtime dependencies** — the parser and bidirectional modules have no dependencies at all. The editor lazy-loads fence libraries on demand or ships as a single offline bundle.
- **Bidirectional** — convert markdown to HTML and back. Humans and AI agents edit the same document; the source of truth stays in markdown.
- **Rich fences out of the box** — 12 built-in fence types (code highlighting, Mermaid, MathJax, SVG, CSV/TSV/PSV, GeoJSON, STL, ABC music, Vega/Vega-Lite) with a one-callback plugin API for your own.
- **Works offline** — the standalone bundle (7.7 MB / ~1.0 MB gzipped) includes every fence library. No CDN, no network. Suitable for air-gapped and local-only deployments.
- **Tested** — 3,270 tests, 98.3% coverage with enforced per-module thresholds, ESLint security plugin at error level in CI. Every build verifies package exports, TypeScript definitions, and bundle integrity.
- **MCP server** — 24 tools for AI agents over JSON-RPC 2.0. Agents parse, convert, read/write files, and control the editor through the same protocol Cursor, Claude Desktop, and VS Code use.

## Modules

Use only what you need. Each module is available as ESM, UMD, and CommonJS with TypeScript definitions.

| Module | Size (min) | What it does |
|--------|-----------|--------------|
| **quikdown.js** | 14.7 KB | Markdown to HTML. XSS-safe, fence plugin callbacks, inline styles or CSS classes. |
| **quikdown_bd.js** | 19.5 KB | Everything in core plus HTML to Markdown round-trip. |
| **quikdown_edit.js** | 98 KB | Drop-in split-view editor. Live preview, undo/redo, bidirectional editing, lazy-loaded fence plugins. |
| **quikdown_edit_standalone.js** | 7.7 MB | Offline editor. Same as above but bundles highlight.js, Mermaid, DOMPurify, Leaflet, Three.js, ABCJS, Vega, Vega-Lite, Vega-Embed, and MathJax. No CDN required. [Docs](docs/standalone-editor.md) |
| **quikdown_mcp.js** | 26 KB | MCP server. 24 tools for AI agents over JSON-RPC 2.0 on stdio. |
| **quikdown_ast.js** / **quikdown_json.js** / **quikdown_yaml.js** / **quikdown_ast_html.js** | 5-10 KB each | AST companion libraries for structured output. |

## Installation

```bash
npm install quikdown
```

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

Also available via [jsDelivr](https://cdn.jsdelivr.net/npm/quikdown).

## Quick Start

### Parse markdown to HTML

```javascript
import quikdown from 'quikdown';

const html = quikdown('# Hello **world**', { inline_styles: true });
```

### Bidirectional round-trip

```javascript
import quikdown_bd from 'quikdown/bd';

const html = quikdown_bd(markdown);               // markdown to HTML
const recovered = quikdown_bd.toMarkdown(html);    // HTML back to markdown
```

Note: bidirectional conversion uses data-attributes and DOM walking optimized for quikdown's own output. It is not a generic HTML-to-markdown converter.

### Drop-in editor

```javascript
import QuikdownEditor from 'quikdown/edit';

const editor = new QuikdownEditor('#container', {
  mode: 'split',           // 'source', 'split', 'preview'
  theme: 'auto',           // 'light', 'dark', 'auto'
  plugins: { highlightjs: true, mermaid: true }
});

editor.setMarkdown('# Hello\n\nStart editing.');
const content = editor.getMarkdown();
```

### Stream LLM output into rendered HTML

```javascript
import quikdown from 'quikdown';

let buffer = '';
for await (const chunk of streamFromLLM()) {
  buffer += chunk;
  preview.innerHTML = quikdown(buffer, { lazy_linefeeds: true });
}
```

### Stream into the editor

```javascript
import QuikdownEditor from 'quikdown/edit';

const editor = new QuikdownEditor('#artifact', { mode: 'split' });
let buffer = '';

for await (const chunk of streamFromLLM()) {
  buffer += chunk;
  editor.setMarkdown(buffer);
}
```

### Structured output (AST / JSON / YAML)

```javascript
import quikdown_ast from 'quikdown/ast';
import quikdown_json from 'quikdown/json';
import quikdown_yaml from 'quikdown/yaml';
import quikdown_ast_html from 'quikdown/ast-html';

const ast  = quikdown_ast('# Hello\n\nWorld **bold**');
const json = quikdown_json('# Hello');
const yaml = quikdown_yaml('# Hello');
const html = quikdown_ast_html(ast);   // render AST, JSON, or YAML back to HTML
```

See [AST Documentation](docs/quikdown-ast.md) for the complete node type reference.

## Fence Plugins

The editor ships with 12 built-in fence types. Libraries are lazy-loaded from CDN on first use, keeping the initial bundle small.

| Fence | Renders | Library |
|-------|---------|---------|
| `javascript`, `python`, etc. | Syntax-highlighted code | highlight.js |
| `mermaid` | Diagrams (flowchart, sequence, Gantt, etc.) | Mermaid |
| `math`, `tex`, `latex`, `katex` | Equations | MathJax v3 |
| `svg` | Inline SVG | None |
| `html` | Sanitized HTML | DOMPurify |
| `csv`, `tsv`, `psv` | Data tables | None |
| `geojson` | Interactive maps | Leaflet |
| `stl` | 3D model viewer | Three.js |
| `abc`, `music` | Sheet music notation | ABCJS |
| `vega`, `vega-lite`, `vegalite` | Data visualization charts | Vega + Vega-Lite + Vega-Embed |

### Custom fence plugin

```javascript
const fencePlugin = {
  render: (code, language) => {
    if (language === 'mermaid') {
      const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
      setTimeout(() => mermaid.render(id + '-svg', code).then(result => {
        document.getElementById(id).innerHTML = result.svg;
      }), 0);
      return `<div id="${id}" class="mermaid">Loading diagram...</div>`;
    }
    return undefined; // fall back to default rendering
  }
};

const html = quikdown(markdown, { fence_plugin: fencePlugin });
```

Return a string to render custom HTML, or `undefined` to use default code-block rendering. See [Plugin Guide](docs/plugin-guide.md) for reverse handlers, editor customFences, and more examples.

## LLM and Agent Integration

quikdown fits the **model writes markdown, human sees rendered output** loop. Both sides work with the same document — the human sees rich preview, the agent sees markdown source.

| Pattern | Example |
|---------|---------|
| **AI Canvas** — chat + document editor | [examples/ai-canvas](examples/ai-canvas/) |
| Agent **tool calling** on editor | [examples/llm-tool-editor](examples/llm-tool-editor/) |
| **MCP doc copilot** (Node + browser) | [examples/mcp-doc-host](examples/mcp-doc-host/) |
| Stream into **QuikdownEditor** | [examples/llm-stream-editor](examples/llm-stream-editor/) |
| Stream tokens into HTML | [integration-llm-stream](https://deftio.github.io/quikdown/pages/examples/integration-llm-stream.html) |
| Chat bubbles + markdown | [quikchat](https://github.com/deftio/quikchat) + [integration example](https://deftio.github.io/quikdown/pages/examples/integration-quikchat.html) |

Overview: [docs/llm-integration.md](docs/llm-integration.md)

### Integration patterns

| Audience | What you need | Entry point |
|----------|---------------|-------------|
| **Parse-only** | Render markdown or structured output in your app | `import quikdown from 'quikdown'` |
| **File agents** | AI agent reads/writes `.md` and HTML files in a repo sandbox | `npx quikdown-mcp --root=.` (IDE editing, no browser) |
| **Doc copilot** | Human edits in a live preview; agent drives the same buffer | `node examples/mcp-doc-host/start-mcp.js` (browser editor + Node MCP bridge) |

## MCP Server (AI Agent Integration)

quikdown includes an MCP server that lets AI agents parse markdown, convert between formats, read/write files, and control the editor — all over JSON-RPC 2.0 on stdio.

**Two deployment paths:**

| Path | Human UI | Command |
|------|----------|---------|
| **A — IDE** | Cursor / VS Code file editor; no browser | `npx quikdown-mcp --root=.` |
| **B — Doc copilot** | Browser tab with QuikdownEditor; Node host bridges MCP | `node examples/mcp-doc-host/start-mcp.js` |

**24 tools** in three groups:

| Group | Tools | Activated by |
|-------|-------|-------------|
| Headless | `markdown_to_html`, `html_to_markdown`, `markdown_stats`, `quikdown_info`, `markdown_to_ast`, `markdown_to_json` | Always |
| Filesystem | `read_file_info`, `read_file_lines`, `read_file_markdown`, `write_markdown_to_file`, `write_html_to_file` | `--root` flag |
| Editor | `read_editor`, `write_editor`, `find_regex`, `replace_regex`, `replace_text`, `extract_text`, `get_stats`, `get_html`, `undo`, `redo`, `load_file_to_editor`, `get_rendered`, `write_rendered_to_file` | Editor binding |

**Cursor / Claude Code (Path A):**
```json
{
  "mcpServers": {
    "quikdown": { "command": "npx", "args": ["quikdown-mcp", "--root=."] }
  }
}
```

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

## Configuration

```javascript
const html = quikdown(markdown, {
  inline_styles: false,       // true: inline CSS; false: class-based (default)
  lazy_linefeeds: false,      // true: single \n becomes <br>
  bidirectional: false,       // true: add data-qd attributes for round-trip
  heading_ids: false,         // true: add id slugs for anchor links
  allow_unsafe_urls: false,   // true: allow javascript: URLs
  allow_unsafe_html: false,   // true/array/object: HTML passthrough control
  fence_plugin: {             // custom code block processor
    render: myHandler
  }
});
```

### Styling

**Inline styles** — all formatting uses inline CSS. Good for emails and isolated components.
```javascript
quikdown('**bold**', { inline_styles: true });
// <strong style="font-weight: bold;">bold</strong>
```

**Class-based styling** (default) — uses CSS classes. Include the provided theme files or bring your own.
```javascript
quikdown('**bold**');
// <strong class="quikdown-strong">bold</strong>
```

Theme files: `dist/quikdown.light.css`, `dist/quikdown.dark.css` (and minified variants).

## Supported Markdown

**Text formatting:** `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, `\` backslash escapes

**Headings:** `# H1` through `###### H6`

**Lists:**
- Unordered lists (`-`, `*`, `+`)
1. Ordered lists
- [x] Task lists

**Links and images:** `[text](url)`, `![alt](url)`, automatic URL detection

**Code blocks:** fenced with ` ``` ` or `~~~`, with optional language identifier

**Tables, blockquotes, horizontal rules** — see [API Reference](docs/api-reference.md) for complete syntax

**GFM alerts:** `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, etc.

## TypeScript

quikdown includes TypeScript definitions for all modules:

```typescript
import quikdown, { QuikdownOptions, FencePlugin } from 'quikdown';

const plugin: FencePlugin = {
  render: (content: string, language: string) => {
    return `<pre class="${language}">${content}</pre>`;
  }
};

const options: QuikdownOptions = {
  inline_styles: true,
  fence_plugin: plugin
};

const html: string = quikdown(markdown, options);
```

## Framework Integration

Works with React, Vue, Svelte, Angular, Next.js, and Nuxt. See [Framework Integration Guide](docs/framework-integration.md).

## Security

All HTML is escaped by default. Only safe markdown constructs become HTML:

```javascript
const unsafe = '<script>alert("XSS")</script> **bold**';
const safe = quikdown(unsafe);
// &lt;script&gt;alert("XSS")&lt;/script&gt; <strong>bold</strong>
```

**Static analysis** — ESLint with [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security) at error level, zero findings. All regex patterns are verified free of catastrophic backtracking (ReDoS). No dynamic `RegExp` construction. Security lint runs in CI on every build.

For the full security model, whitelist mode, and fence plugin security guidance, see [docs/security.md](docs/security.md).

## Offline and Air-Gapped Use

The standalone editor bundles every fence library into a single file — no CDN, no network requests. Use it for:

- Air-gapped enterprise environments
- Local-only LLM setups (Ollama, llama.cpp, etc.)
- Environments where external CDN fetches are blocked
- USB-portable documentation tools

```html
<script src="quikdown_edit_standalone.umd.min.js"></script>
<script>
  const editor = new QuikdownEditor('#container', { mode: 'split' });
</script>
```

The `npm run build:airgap` command produces a zip with the standalone bundle, CSS themes, and TypeScript definitions. See [Standalone Docs](docs/standalone-editor.md).

## Testing

quikdown enforces coverage thresholds per module in CI. The build fails if coverage drops below the gate.

| Module | Line coverage | Threshold |
|--------|--------------|-----------|
| quikdown (core) | 100% | 99% |
| quikdown_bd | 95.5% | 94% |
| quikdown_edit | 79.9% | 79% |
| quikdown_ast | 98.9% | 98% |
| quikdown_mcp | 92.8% | 90% |
| **Weighted total** | **98.3%** | — |

3,270 tests across 32 suites. Unit tests with Jest, end-to-end tests with Playwright.

```bash
npm test                  # all tests with coverage
npm run test:e2e          # Playwright end-to-end tests
npm run test:quikdown     # core parser tests only
```

## Limitations

For size and security, quikdown intentionally omits:

- Reference-style links
- Footnotes
- Definition lists
- Full CommonMark spec compliance (handles the practical subset used in documentation, chat, and LLM output)

Optional **heading slugs**: pass `heading_ids: true` to add `id` attributes for in-page anchor links.

Raw HTML, SVG, etc. can be rendered using fence blocks with an appropriate plugin. The editor has built-in support for HTML fences with XSS prevention via DOMPurify.

## License

BSD 2-Clause — see [LICENSE.txt](LICENSE.txt)

## Acknowledgments

- Built for the [QuikChat](https://github.com/deftio/quikchat) project
- Inspired by the simplicity of early markdown parsers
- CommonMark spec for markdown standardization

## Support

- [Documentation](docs/)
- [Issues](https://github.com/deftio/quikdown/issues)
- [Examples hub](https://deftio.github.io/quikdown/pages/examples/) | [examples/](examples/) (source)
