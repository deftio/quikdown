# Quikdown MCP Server

The Quikdown MCP (Model Context Protocol) server exposes quikdown's parsing, bidirectional conversion, file I/O, and editor control as tools that any MCP-compatible AI host can call over JSON-RPC 2.0 on stdio.

**Version:** 1.2.16
**Protocol:** MCP 2024-11-05
**Transport:** JSON-RPC 2.0 over stdin/stdout
**Dependencies:** None beyond quikdown itself

## Overview

The server provides **24 tools** organized in three groups:

| Group | Tools | When available |
|-------|-------|----------------|
| **Headless** | 6 | Always — parse markdown, convert HTML, AST/JSON, get stats |
| **Filesystem** | 5 | When `--root` is set — read/write files in a sandboxed directory |
| **Editor** | 13 | When a host binds a `QuikdownEditor` instance — full buffer control |

The CLI binary (`npx quikdown-mcp`) activates the headless and filesystem groups only (**Path A**). Editor and render tools require **Path B** — a host that runs QuikdownEditor in a **browser** and binds the instance to MCP. See [Path A vs Path B](#path-a-vs-path-b) below.

---

## Path A vs Path B

One package (`quikdown/mcp`), one server, two **deployment paths**. Choose by where the human edits and whether you need live preview / rich render export.

### Path A — IDE + `quikdown-mcp` bin (shipped)

**What you run:** `npx quikdown-mcp --root=.` (stdio MCP; no browser, no editor window).

**Who uses what:**

| Role | UI / transport |
|------|----------------|
| **Human** | Your IDE (Cursor, VS Code, etc.) — edit `.md` files as usual |
| **Agent** | MCP → headless + filesystem tools (parse, BD, read/write files by path) |

**Good for:** Repo markdown, doc refactors, HTML↔MD migration, fence checks, exporting `get_html` to disk without loading huge strings into chat.

**Not included:** QuikdownEditor preview, Mermaid/math live render, `get_rendered`, agent driving a split-view doc pane.

### Path B — Doc copilot (Node host + browser; shipped)

**What you run:** The **doc-host example** — `node examples/mcp-doc-host/start-mcp.js` (from the quikdown repo after `npm run build`):

1. Serves a page with **QuikdownEditor** (split or preview)
2. Opens your **browser** (auto-launch or manual `http://localhost:7744`)
3. Exposes MCP on **stdio** for Cursor (Node bridges tool calls to the editor in the page via WebSocket)

See [examples/mcp-doc-host/README.md](../examples/mcp-doc-host/README.md) for setup, env vars, and known limitations.

**Who uses what:**

| Role | UI / transport |
|------|----------------|
| **Human** | **Browser tab** — QuikdownEditor; you watch preview update, edit manually, undo |
| **Agent** | MCP → Cursor → Node host → same editor instance (buffer + preview DOM) |

Path B is **both** processes: Node is the launcher/bridge, **not** the editor UI. The human always interacts in the **browser**. The agent never replaces that window — it edits the same document through MCP while you watch.

**Good for:** Long-form doc drafting, fence-heavy content, rich export (`get_rendered`, `write_rendered_to_file`), “copilot rewrites doc while I watch.”

**Requires (explicit limits):**

- A **real browser** with preview DOM — `get_rendered` cannot run in pure Node or from the Path A bin alone
- **Two surfaces** unless you embed chat+editor in one page (e.g. quikchat + editor): typically Cursor + browser tab
- **Async render** — Mermaid/MathJax need time to settle in preview before `get_rendered`
- Doc host must be **running** before editor MCP tools work

**Example (shipped):** [examples/mcp-doc-host/](../examples/mcp-doc-host/) — `start-mcp.js`, `editor-host.html`, README with limitations.

**Cursor config (Path B)** — command starts the **host**, not bare `quikdown-mcp`:

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

### Quick comparison

| | **Path A** | **Path B** |
|--|------------|------------|
| Human UI | IDE file editor | **Browser** — QuikdownEditor |
| Node process | MCP bin only | Host + MCP + file sandbox + bridge |
| Browser | Not used | **Required** (preview + render) |
| Agent tools | Headless + filesystem | + editor + render + export (via doc host) |
| Daily friction | Low (MCP config once) | Run doc host before session |

**Do not claim:** “Install MCP → Cursor becomes QuikdownEditor.” Path A keeps IDE editing. Path B adds a separate browser doc session.

---

## Quick Start

### 1. Install

```bash
npm install quikdown          # local
npm install -g quikdown       # global (provides quikdown-mcp in PATH)
```

### 2. Run the server

```bash
npx quikdown-mcp                       # headless + filesystem (cwd as root)
npx quikdown-mcp --root=/path/to/docs  # custom sandbox root
```

### 3. Test it

Send a JSON-RPC message on stdin:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test"}}}' | npx quikdown-mcp
```

Response:

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","serverInfo":{"name":"quikdown-mcp","version":"1.2.16"},"capabilities":{"tools":{},"resources":{}}}}
```

---

## Setup Guides

### Cursor

Add to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "quikdown": {
      "command": "npx",
      "args": ["quikdown-mcp", "--root=."]
    }
  }
}
```

Restart Cursor. The agent will see quikdown's tools when composing or editing markdown.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "quikdown": {
      "command": "npx",
      "args": ["quikdown-mcp", "--root=/path/to/your/project"]
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "quikdown": {
      "command": "npx",
      "args": ["quikdown-mcp", "--root=."]
    }
  }
}
```

### VS Code (Copilot MCP)

Add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "quikdown": {
      "command": "npx",
      "args": ["quikdown-mcp", "--root=${workspaceFolder}"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "quikdown": {
      "command": "npx",
      "args": ["quikdown-mcp", "--root=."]
    }
  }
}
```

### Programmatic (Node.js)

```javascript
import { createMcpServer } from 'quikdown/mcp';

// Headless only — no file access, no editor
const mcp = createMcpServer();

// With filesystem access
const mcp = createMcpServer({ root: '/path/to/docs' });

// With editor binding (browser context)
const mcp = createMcpServer({
  root: '/path/to/docs',
  editor: editorInstance   // QuikdownEditor or compatible object
});

// Process a message
const response = mcp.handleMessage({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'markdown_to_html', arguments: { markdown: '# Hello' } }
});
console.log(response.result.content[0].text);
// <h1 class="quikdown-h1">Hello</h1>
```

---

## Tool Reference

### Headless Tools (always available)

#### `markdown_to_html`

Convert markdown to HTML using the quikdown parser.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown content to convert |
| `options.inline_styles` | boolean | no | Embed CSS directly in elements (default: false) |
| `options.lazy_linefeeds` | boolean | no | Single newlines become `<br>` (default: false) |
| `options.allow_unsafe_html` | boolean | no | Skip HTML escaping (default: false) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "tools/call",
  "params": {
    "name": "markdown_to_html",
    "arguments": {
      "markdown": "# Hello\n\n**Bold** and *italic*",
      "options": { "inline_styles": true }
    }
  }
}
```

#### `html_to_markdown`

Convert HTML back to markdown using the bidirectional converter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `html` | string | yes | HTML content to convert |

#### `markdown_stats`

Get statistics about a markdown string.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown to analyze |

Returns JSON with `characters`, `words`, `lines`, `paragraphs`.

#### `quikdown_info`

Get server metadata: version, available modules, active tool groups, and usage hints. Takes no parameters.

#### `markdown_to_ast`

Parse markdown into an AST (Abstract Syntax Tree) object. Returns a structured node tree as JSON.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown content to parse |

#### `markdown_to_json`

Parse markdown into a JSON string representation of the AST.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown content to parse |

---

### Filesystem Tools (requires `--root`)

All paths are relative to the sandbox root. Paths that resolve outside the root (e.g., `../../../etc/passwd`) are rejected.

#### `read_file_info`

Get file metadata: size, line count, last modified time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |

#### `read_file_lines`

Read a specific range of lines from a file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |
| `start_line` | integer | no | Start line, 1-based (default: 1) |
| `end_line` | integer | yes | End line, 1-based, inclusive |

#### `read_file_markdown`

Read the full contents of a file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |

#### `write_markdown_to_file`

Write markdown content to a file. Creates parent directories if needed. If `content` is omitted and an editor is bound, writes the current editor buffer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |
| `content` | string | no | Markdown content (uses editor buffer if omitted) |

#### `write_html_to_file`

Convert markdown to HTML and write the result to a file. If `markdown` is omitted, uses the editor buffer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |
| `markdown` | string | no | Markdown source (uses editor buffer if omitted) |

---

### Editor Tools (requires editor binding)

These tools require a host application that passes a `QuikdownEditor` instance (or compatible object with `getMarkdown()`, `setMarkdown()`, `getHTML()`, `canUndo()`, `canRedo()`, `undo()`, `redo()`).

#### `read_editor`

Read the current markdown content from the editor buffer. Takes no parameters.

#### `write_editor`

Replace the entire editor buffer with new markdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | yes | New markdown content |

#### `find_regex`

Search the editor buffer with a regex pattern. Returns matches with line numbers and excerpts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | yes | Regex pattern (max 200 chars) |
| `flags` | string | no | Regex flags (default: "gi") |
| `max_matches` | integer | no | Maximum matches to return (default: 50, max: 200) |

#### `replace_regex`

Replace text in the editor buffer using a regex pattern. Supports capture group references (`$1`, `$2`, etc.) in the replacement string.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | yes | Regex pattern (max 200 chars) |
| `replacement` | string | yes | Replacement string |
| `flags` | string | no | Regex flags (default: "g") |
| `limit` | string | no | `"first"` or `"all"` (default: "all") |

#### `replace_text`

Replace the first occurrence of a literal string in the editor buffer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `find` | string | yes | Text to find |
| `replace` | string | yes | Replacement text |

#### `extract_text`

Extract a range of lines from the editor buffer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_line` | integer | yes | Start line (1-based, inclusive) |
| `end_line` | integer | yes | End line (1-based, inclusive) |

#### `get_stats`

Get word count, line count, character count, and paragraph count of the editor buffer. Takes no parameters.

#### `get_html`

Get the HTML output of the current editor buffer. Takes no parameters.

#### `undo`

Undo the last editor change. Takes no parameters.

#### `redo`

Redo the last undone editor change. Takes no parameters.

#### `load_file_to_editor`

Read a file from the filesystem sandbox and load it into the editor buffer. Requires both an editor binding and a filesystem root. Files over 100 KB are skipped (returns stats instead of loading).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |

#### `get_rendered`

Get the rendered HTML from the editor's preview panel, including rasterized SVGs, Mermaid diagrams, MathJax, etc. Requires the editor binding to implement `getRenderedContent()` (Path B only).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `output` | string | no | Output profile: `"default"`, `"stripped"`, or `"quikdown"` (default: `"default"`) |

#### `write_rendered_to_file`

Get the rendered HTML from the editor preview and write it to a file. Requires both filesystem root and editor with `getRenderedContent()`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path (relative to root) |
| `output` | string | no | Output profile (default: `"default"`) |

---

## Resources

The server exposes one MCP resource:

| URI | Description |
|-----|-------------|
| `quikdown://meta` | Server metadata: version, active tool groups, guidance text |

Query it with `resources/read`:

```json
{
  "jsonrpc": "2.0", "id": 2,
  "method": "resources/read",
  "params": { "uri": "quikdown://meta" }
}
```

---

## Security

- **Filesystem sandbox:** All file operations are confined to the `--root` directory. Path traversal attempts (e.g., `../`) are rejected before any I/O occurs.
- **XSS protection:** `markdown_to_html` produces XSS-safe output by default. HTML entities are escaped. `allow_unsafe_html` must be explicitly set.
- **Regex limits:** `find_regex` and `replace_regex` cap pattern length at 200 characters and match count at 200 to prevent resource exhaustion.
- **No network access:** The MCP server makes no outbound network requests. All operations are local.

---

## Editor Binding (Path B)

Editor tools (and future `get_rendered` / export tools) require **Path B**: QuikdownEditor running in a **browser**, bound to MCP from a Node host. The binding is not available from `npx quikdown-mcp` alone.

Typical pattern inside the doc-host page:

```javascript
import QuikdownEditor from 'quikdown/edit';
import { createMcpServer } from 'quikdown/mcp';

const editor = new QuikdownEditor('#container', { mode: 'split' });

const mcp = createMcpServer({
  root: '/path/to/docs',
  editor: editor
});

// Node host forwards stdio JSON-RPC ↔ WebSocket ↔ this page
```

The human edits and views preview in the **browser tab**. Cursor talks to the **Node** process on stdio; Node forwards `tools/call` to the bound editor.

The editor binding expects any object implementing this interface:

```typescript
interface McpEditorBinding {
  getMarkdown(): string;
  setMarkdown(md: string): void;
  getHTML(): string;
  canUndo?(): boolean;
  canRedo?(): boolean;
  undo?(): void;
  redo?(): void;
  getRenderedContent?(options?: { output?: string }): { success: boolean; html?: string; text?: string };
}
```

`canUndo`, `canRedo`, `undo`, `redo`, and `getRenderedContent` are optional. If missing, the corresponding tools report an appropriate message. `getRenderedContent` is required for `get_rendered` and `write_rendered_to_file` (Path B only).

---

## TypeScript

TypeScript definitions are included at `dist/quikdown_mcp.d.ts`:

```typescript
import { createMcpServer, McpServer, McpServerOptions } from 'quikdown/mcp';

const mcp: McpServer = createMcpServer({ root: '.' });
const tools = mcp.getTools();           // McpTool[]
const result = mcp.callTool('markdown_to_html', { markdown: '# Hi' });
// result: McpToolResult
```

---

## npm Scripts

These scripts are available in the quikdown package for MCP-related workflows:

```bash
npm run build          # Builds all modules including MCP (ESM + CJS)
npm test               # Runs all tests including MCP coverage
```

The MCP module is built as:
- `dist/quikdown_mcp.esm.js` — ES module
- `dist/quikdown_mcp.cjs` — CommonJS
- `dist/quikdown_mcp.d.ts` — TypeScript definitions

---

## JSON-RPC Protocol Reference

The server implements the MCP protocol over JSON-RPC 2.0 on stdio (one JSON object per line).

### Lifecycle

```
Client                          Server
  │                               │
  │── initialize ────────────────►│
  │◄─────────── serverInfo ───────│
  │── notifications/initialized ─►│  (no response)
  │                               │
  │── tools/list ────────────────►│
  │◄─────────── tool list ────────│
  │                               │
  │── tools/call ────────────────►│
  │◄─────────── result ───────────│
  │                               │
  │── ping ──────────────────────►│
  │◄─────────── {} ───────────────│
```

### Error Codes

| Code | Meaning |
|------|---------|
| -32601 | Method not found |
| -32602 | Invalid params (e.g., unknown resource URI) |

Tool execution errors are returned as `result.isError = true` with the error message in `result.content[0].text`, not as JSON-RPC error responses.

---

## Examples

### Convert markdown in Cursor

With the MCP server configured, ask the agent:

> "Convert this markdown to HTML: `# Hello World`"

The agent calls `markdown_to_html` and returns the rendered HTML.

### Batch-convert a docs folder

> "Read all `.md` files in the docs/ folder and write corresponding `.html` files next to them."

The agent uses `read_file_markdown` and `write_html_to_file` for each file.

### Search and replace in the editor

> "Find all level-2 headings and change them to level-3."

The agent calls `find_regex` with `pattern: "^## "`, then `replace_regex` with `pattern: "^## "`, `replacement: "### "`, `flags: "gm"`.

### Get document statistics

> "How many words are in the current document?"

The agent calls `get_stats` (if editor bound) or `markdown_stats` (headless) and reports the word count.

---

## Troubleshooting

**"Unknown tool" error:** Check which tool groups are active with `quikdown_info`. Filesystem tools require `--root`, editor tools require a host binding.

**Path traversal rejected:** All filesystem paths must resolve within the `--root` directory. Use relative paths without `..`.

**Server doesn't start:** Ensure `quikdown` is installed (`npm ls quikdown`). The `npx quikdown-mcp` command requires the package to be available locally or globally.

**No response on stdin:** The server expects one complete JSON object per line. Multi-line JSON or trailing whitespace may cause buffering. Each message must be a single line terminated by `\n`.

---

## Contributing

When developing locally from the repo, you must build before running the MCP server:

```bash
npm run build              # builds dist/quikdown_mcp.esm.js + .cjs
npx quikdown-mcp --root=.  # now uses the local build
```

The `bin/quikdown-mcp` entry point imports from `../dist/quikdown_mcp.esm.js`, which does not exist until the Rollup build runs. If you see `ERR_MODULE_NOT_FOUND`, run `npm run build` first.
