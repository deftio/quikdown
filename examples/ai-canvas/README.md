# AI Canvas — Chat + Document Editor

Canvas-style editing demo: an AI agent drives document editing via a chat panel. Two modes in one page:

- **Simulated** — no API key, works on GitHub Pages. Hard-coded command-to-tool mappings.
- **Live** — BYOK (bring your own key). Sends messages to any OpenAI-compatible API with function calling.

## How to run

```bash
npm run serve
# open http://localhost:6811/examples/ai-canvas/
```

## Architecture

```
User types in chat
  -> handleUserMessage()
    -> Simulated: simulateCanvasCommand() maps regex patterns to tool calls
    -> Live: runLiveLLM() sends to OpenAI-compatible API, executes tool_calls
  -> Tools execute on QuikdownEditor via executeEditorTool()
  -> Response shown in chat
```

### Simulated commands

| Pattern | Action |
|---------|--------|
| `table of contents` / `toc` | Extract headings, prepend formatted TOC |
| `mermaid` / `diagram` / `flowchart` | Build Mermaid graph from headings, append |
| `professional` / `formal` | Apply tone substitutions |
| `code example` / `add code` | Append JS + Python code blocks |
| `what's in this` / `analyze` | Read + stats, format analysis |
| `replace X with Y` | Parse find/replace from natural language |
| Other | Falls back to `QdAgentTools.simulateAgentCommand()` |

### Live mode providers

| Provider | Default Model | Notes |
|----------|---------------|-------|
| OpenAI | `gpt-4o` | |
| Groq | `llama-3.3-70b-versatile` | |
| Together | `meta-llama/Llama-3-70b-chat-hf` | |
| OpenRouter | `anthropic/claude-sonnet-4` | Use this for Anthropic models |
| Ollama | `llama3.1` | No API key needed. Run `ollama serve` first. May need CORS config. |
| Custom | (user-provided) | Enter endpoint URL in the API key field |

**Note:** Anthropic's native API uses a different format than OpenAI. Use OpenRouter for Claude models.

**Ollama CORS:** If you get CORS errors with Ollama, start it with:
```bash
OLLAMA_ORIGINS="*" ollama serve
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main page (HTML + inline CSS + inline JS module) |
| `README.md` | This file |

## Dependencies

All loaded from the repo — no npm install needed:

- `../../dist/quikdown_edit.esm.js` — editor widget
- `../../dist/quikdown.esm.js` — parser (renders assistant chat messages)
- `../shared/agent-tools.js` — `executeEditorTool()` + `simulateAgentCommand()` fallback
- `../styles/integration-example.css` — shared `.ex-*` layout classes
- `../../pages/styles/quikdown-site.css` — site chrome
- `../scripts/example-mount.js` — nav/footer injection
