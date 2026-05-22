# LLM and agent UI integration

quikdown is built for the **model ↔ markdown ↔ human** loop: small parser for chat bubbles, rich fences for artifacts, embeddable editor for documents agents read and write.

## Quick links

| Pattern | Example | When to use |
|---------|---------|-------------|
| **Parser stream** | [pages/examples/integration-llm-stream.html](../pages/examples/integration-llm-stream.html) | Tokens → `quikdown(buffer)` in a div (chat reply) |
| **Stream into editor** | [examples/llm-stream-editor/](../examples/llm-stream-editor/) | Long artifact; `editor.setMarkdown(buffer)` on each chunk |
| **Agent tool editor** | [examples/llm-tool-editor/](../examples/llm-tool-editor/) | Function calling: `read_editor`, `write_editor`, undo, stats |
| **Chat + markdown** | [pages/examples/integration-quikchat.html](../pages/examples/integration-quikchat.html) | [quikchat](https://github.com/deftio/quikchat) widget renders bubbles |
| **Live LLM + tools (BYOK)** | [quikchat tool editor demo](https://deftio.github.io/quikchat/examples/example_tool_editor.html) | Same tools, real API key |

Run local examples: `npm run serve` → `http://localhost:6811/examples/…`

## Three surfaces

```
┌─────────────────────────────────────────────────────────────┐
│  Chat bubble     quikdown(md)        Short replies, streaming│
├─────────────────────────────────────────────────────────────┤
│  Editor canvas   QuikdownEditor      Artifacts users edit    │
├─────────────────────────────────────────────────────────────┤
│  Agent tools     getMarkdown/setMarkdown   LLM mutates doc   │
└─────────────────────────────────────────────────────────────┘
```

### 1. Render-only (parser)

```javascript
import quikdown from 'quikdown';

let buffer = '';
for await (const chunk of streamFromLLM()) {
  buffer += chunk;
  preview.innerHTML = quikdown(buffer, { lazy_linefeeds: true });
}
```

- **XSS-safe by default** — treat LLM output as untrusted.
- **Re-parse whole buffer** — parser is ~10 KB; fast enough per chunk for typical chat.

### 2. Stream into the editor

```javascript
import QuikdownEditor from 'quikdown/edit';

const editor = new QuikdownEditor('#artifact', { mode: 'split' });
let buffer = '';

for await (const chunk of streamFromLLM()) {
  buffer += chunk;
  editor.setMarkdown(buffer);
}
```

Use when the output is a **document** (spec, report, README) with fences the user may edit after generation.

See [examples/llm-stream-editor/README.md](../examples/llm-stream-editor/README.md).

### 3. Agent tool calling (editor as canvas)

Register tools with your LLM API; execute against the editor in the browser:

| Tool | Editor API |
|------|----------------|
| `read_editor` | `editor.getMarkdown()` |
| `write_editor` | `editor.setMarkdown(content)` |
| `replace_text` | get → replace first match → set |
| `extract_text` | line slice (read-only) |
| `get_stats` | word/line/char counts |
| `undo` / `redo` | `editor.undo()` / `editor.redo()` |

Use **`stream: false`** during tool-call rounds so JSON parses completely. Keep a separate message array with `tool_calls` / `tool_call_id` fields.

Reference implementation: [examples/shared/agent-tools.js](../examples/shared/agent-tools.js)  
Simulated demo: [examples/llm-tool-editor/](../examples/llm-tool-editor/)  
Live BYOK demo: [quikchat example_tool_editor.html](https://deftio.github.io/quikchat/examples/example_tool_editor.html)

Pair with the **[quikchat](https://github.com/deftio/quikchat)** chat widget for UI, or your own input component.

### 4. MCP server (Model Context Protocol)

For agents that support MCP (Cursor, Claude Desktop, VS Code Copilot, Windsurf), quikdown ships a JSON-RPC 2.0 server that exposes 24 tools over stdio:

```bash
npx quikdown-mcp --root=.          # headless + filesystem tools
```

**Path A (IDE):** Agent calls MCP tools (`markdown_to_html`, `read_file_markdown`, `write_html_to_file`, etc.) while the human edits files in their IDE as usual. No browser window.

**Path B (Doc copilot):** A Node host serves QuikdownEditor in a browser tab and bridges MCP stdio to the editor. Agent drives the same buffer the human sees — full buffer control, regex search, rendered HTML export.

| Tool group | Count | What it does |
|------------|-------|--------------|
| Headless | 4 | Parse, convert, stats — no file I/O or editor |
| Filesystem | 5 | Sandboxed read/write of markdown and HTML files |
| Editor | 13 | Buffer control, regex search/replace, undo/redo, rendered export |

Configuration: add `npx quikdown-mcp --root=.` to your host's MCP config file. See [docs/quikdown-mcp.md](quikdown-mcp.md) for setup guides per tool (Cursor, Claude Desktop, VS Code, Claude Code, Windsurf).

Programmatic use:

```javascript
import { createMcpServer } from 'quikdown/mcp';
const mcp = createMcpServer({ root: '.' });
const result = mcp.callTool('markdown_to_html', { markdown: '# Hello' });
```

## Dependencies and footprint

| Module | Runtime deps | Typical size |
|--------|----------------|--------------|
| `quikdown` | Zero | ~10 KB min |
| `quikdown/bd` | Zero | ~15 KB min |
| `quikdown/edit` | Lazy CDN for fences | ~84 KB + on-demand libs |
| `quikdown_edit_standalone` | Bundled fences | ~3.8 MB min |
| `quikdown/mcp` | quikdown + quikdown_bd | ~20 KB (JSON-RPC server) |

For **air-gapped** agent UIs, use the [standalone editor](standalone-editor.md) — highlight.js, Mermaid, DOMPurify, Leaflet, Three.js bundled; MathJax still needs network.

## Framework wrappers

React and Vue patterns: [framework-integration.md](framework-integration.md)  
Full editor API: [quikdown-editor.md](quikdown-editor.md)

## Security checklist

- Default parser options for any user/LLM-visible HTML path.
- Do not set `allow_unsafe_html: true` on untrusted markdown without a whitelist ([security.md](security.md)).
- Sanitize or render model **chat replies** with quikdown even when the document canvas uses the editor.
- Block `javascript:` and non-image `data:` URLs (default).

## Related

- [MCP Server](quikdown-mcp.md) — tool reference, setup guides, JSON-RPC protocol
- [Architecture](architecture.md) — parser phases
- [Release process](release-process.md) — standalone ships on every release
- [Examples hub](../pages/examples/) — all interactive demos
