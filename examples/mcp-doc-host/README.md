# MCP Doc Host — Path B

A Node.js host that bridges MCP (stdio) to a QuikdownEditor running in your browser. The agent drives the editor through Cursor while you watch and interact in a browser tab.

## Architecture

```
Cursor (agent)  ──stdio JSON-RPC──►  start-mcp.js (Node)
                                          │
                           ┌──────────────┼──────────────┐
                           │              │              │
                     filesystem      WebSocket     auto-open
                     sandbox              │
                                          ▼
                                  Browser tab
                                  QuikdownEditor (split mode)
                                  ◄── you interact here
```

**Two surfaces:** Cursor for the agent, browser for the human. Both operate on the same document.

## Setup

### Prerequisites

- Node.js 18+
- quikdown built: `npm run build` (if running from the repo)
- `ws` is included in quikdown devDependencies (`npm install` at repo root)

### 1. Cursor config

Add to `.cursor/mcp.json` in your project:

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

### 2. Start

Restart Cursor. The host starts automatically:

- Opens `http://localhost:7744` in your browser
- QuikdownEditor loads in split mode
- Status bar shows "Agent connected" when WebSocket links

### 3. Use

Ask the agent to edit the document:

> "Write a README for a new project called Foobar"
> "Find all level-2 headings and change them to level-3"
> "Export the rendered HTML to output.html"

Changes appear live in the browser editor.

## Configuration

| Env variable | Default | Description |
|-------------|---------|-------------|
| `QUIKDOWN_PORT` | `7744` | HTTP + WebSocket port |
| `QUIKDOWN_ROOT` | `process.cwd()` | Filesystem sandbox root |

## Available tools

All 24 MCP tools are available:

| Group | Tools |
|-------|-------|
| Headless | `markdown_to_html`, `html_to_markdown`, `markdown_stats`, `quikdown_info`, `markdown_to_ast`, `markdown_to_json` |
| Filesystem | `read_file_info`, `read_file_lines`, `read_file_markdown`, `write_markdown_to_file`, `write_html_to_file` |
| Editor | `read_editor`, `write_editor`, `find_regex`, `replace_regex`, `replace_text`, `extract_text`, `get_stats`, `get_html`, `undo`, `redo`, `load_file_to_editor`, `get_rendered`, `write_rendered_to_file` |

Headless and filesystem tools run in the Node process. Editor tools are forwarded to the browser over WebSocket.

## Known limitations

- **Browser must be open** before editor tools work. The host starts the server and auto-opens the browser, but if the tab closes, reconnect manually at `http://localhost:7744`.
- **Single client.** Only one browser tab connects at a time. Opening a second tab replaces the first connection.
- **`get_rendered` is async.** Mermaid/MathJax need time to render in the preview before `get_rendered` captures them. Allow a brief pause after writing complex fences.
- **`load_file_to_editor` and `write_rendered_to_file`** combine Node filesystem + browser editor. The render step happens in the browser; the file I/O happens in Node.
- **No authentication.** The WebSocket server binds to localhost only. Do not expose to the network.
- **Requires `ws` package.** Install with `npm install ws` if not already present.

## Files

| File | Role |
|------|------|
| `start-mcp.js` | MCP entry point: stdio listener, HTTP/WS server, browser launcher |
| `editor-host.html` | Browser page: QuikdownEditor + WebSocket client |
| `README.md` | This file |
