# Quikdown MCP Server

The Quikdown MCP (Model Context Protocol) server exposes quikdown's parsing, bidirectional conversion, file I/O, and editor control as tools that any MCP-compatible AI host can call over JSON-RPC 2.0 on stdio.

**Version:** 1.2.16
**Protocol:** MCP 2024-11-05
**Transport:** JSON-RPC 2.0 over stdin/stdout
**Dependencies:** None beyond quikdown itself

## Overview

The server provides **19 tools** organized in three groups:

| Group | Tools | When available |
|-------|-------|----------------|
| **Headless** | 4 | Always — parse markdown, convert HTML, get stats |
| **Filesystem** | 5 | When `--root` is set — read/write files in a sandboxed directory |
| **Editor** | 10 | When a host binds a `QuikdownEditor` instance — full buffer control |

The CLI binary (`npx quikdown-mcp`) activates the headless and filesystem groups. Editor tools require a host application that creates the server programmatically and passes an editor binding.

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

## Editor Binding

To expose editor tools, create the server with an editor instance:

```javascript
import QuikdownEditor from 'quikdown/edit';
import { createMcpServer } from 'quikdown/mcp';

const editor = new QuikdownEditor('#container', { mode: 'split' });

const mcp = createMcpServer({
  root: '/path/to/docs',
  editor: editor
});

// Now all 19 tools are available
console.log(mcp.getTools().length); // 19
```

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
}
```

`canUndo`, `canRedo`, `undo`, and `redo` are optional. If missing, the undo/redo tools report "Nothing to undo/redo."

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
