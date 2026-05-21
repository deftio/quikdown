# LLM tool editor example

Chat widget + markdown editor + agent tools — the pattern used when an LLM **edits** a document instead of only replying in a bubble.

## Open the demo

Serve the repo from the root (required for nav partials and `dist/` imports):

```bash
npm run serve
# → http://localhost:6811/examples/llm-tool-editor/
```

Or any static server with the repository root as the web root.

## What this demonstrates

| Piece | Library | Role |
|-------|---------|------|
| Chat UI | [quikchat](https://github.com/deftio/quikchat) | Messages, input, optional tool-call visibility |
| Document canvas | **QuikdownEditor** (`quikdown/edit`) | Split source + preview; `getMarkdown` / `setMarkdown` / undo |
| Agent glue | This page (`shared/agent-tools.js`) | Tool implementations + **simulated** command handler |

This page uses a **simulated agent** — no API key. It runs the same seven tools documented in the [quikchat tool editor demo](https://deftio.github.io/quikchat/examples/example_tool_editor.html):

- `read_editor`, `write_editor`, `replace_text`, `extract_text`, `get_stats`, `undo`, `redo`

Replace `simulateAgentCommand()` with a real OpenAI-compatible function-calling loop for production.

## Files

```
examples/llm-tool-editor/
  index.html          ← demo page
  README.md           ← this file
examples/shared/
  agent-tools.js      ← tool exec + simulation (shared logic)
```

## Dependencies

| Asset | Source |
|-------|--------|
| quikdown editor | `../../dist/quikdown_edit.esm.js` (build with `npm run build`) |
| quikchat | [unpkg](https://unpkg.com/quikchat) (`quikchat-md.umd.min.js` + CSS) |
| Site chrome | `../../pages/styles/quikdown-site.css`, `../scripts/example-mount.js` |

## Try these commands

- **Summarize this** — `read_editor` → `write_editor`
- **How long is this document?** — `get_stats`
- **Show me lines 5-10** — `extract_text`
- **Add a FAQ section** — read → append via `write_editor`
- **Undo that** — `undo`

Toggle **Show tool calls** to inspect the audit trail (same idea as the quikchat demo’s hidden `tool-call` tags).

## Production checklist

1. Register tools with your LLM API (`tools` / `functions` array).
2. Use **`stream: false`** for the tool-call round (JSON must be complete).
3. Keep conversation history with `tool_calls` + `tool_call_id` fields (see quikchat demo docs).
4. Cap tool rounds (e.g. 10) to avoid infinite loops.
5. XSS: editor output is rendered markdown; chat replies from the model are untrusted — sanitize or use quikdown in the chat formatter.

## Related examples

- [Stream into editor](../llm-stream-editor/) — one-way token stream into the editor (artifact viewer)
- [quikchat tool editor (live LLM)](https://deftio.github.io/quikchat/examples/example_tool_editor.html) — BYOK, all providers
- [pages/examples/integration-llm-stream.html](../../pages/examples/integration-llm-stream.html) — stream into a div (parser-only)

## License

Same as quikdown (BSD-2-Clause).
