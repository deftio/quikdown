# Streaming LLM into the editor

Simulate LLM token output filling a **QuikdownEditor** — the “artifact viewer” pattern for agent UIs.

## Open the demo

```bash
npm run serve
# → http://localhost:6811/examples/llm-stream-editor/
```

Serve from the **repository root** so `dist/` and site nav resolve correctly.

## What this demonstrates

When a model generates a long markdown document (report, spec, README), users often need:

- Live preview while tokens arrive
- Source they can edit when generation finishes
- Rich fences (code, mermaid, tables) without a second render step

This example accumulates chunks in a buffer and calls `editor.setMarkdown(buffer)` on each tick — the same approach you’d use with a real SSE or `fetch` stream from OpenAI, Anthropic, Ollama, etc.

## Controls

| Control | Effect |
|---------|--------|
| **Start stream** | Tokenize sample markdown and drip it into the editor |
| **Stop** | Halt mid-stream |
| **Clear** | Reset buffer and editor |
| **Speed** | Delay between chunks (ms) |
| **Sample** | Product brief, API doc, or fence showcase |

## The core loop

```javascript
import QuikdownEditor from '../../dist/quikdown_edit.esm.js';

const editor = new QuikdownEditor('#editor', { mode: 'split' });
let buffer = '';

for await (const chunk of streamFromYourLLM()) {
  buffer += chunk;
  editor.setMarkdown(buffer);
}
```

Parser-only alternative (no editor chrome): see `pages/examples/integration-llm-stream.html` — `quikdown(buffer)` into a div.

## Files

```
examples/llm-stream-editor/
  index.html    ← demo page
  README.md     ← this file
```

Shared styles: `../styles/integration-example.css`  
Shared nav mount: `../scripts/example-mount.js`

## Production notes

- **Debounce** — batch updates every 50–100 ms on fast streams to reduce layout work.
- **Incomplete fences** — code blocks may flicker until closing backticks; often acceptable for agent UIs.
- **Undo** — disable or clear undo stack during streaming; commit final markdown once.
- **Headless** — `showToolbar: false` if you provide your own chrome.
- **Offline / air-gapped** — swap CDN editor for `quikdown_edit_standalone.esm.min.js` (see `docs/standalone-editor.md`).

## Related examples

- [LLM tool editor](../llm-tool-editor/) — agent **edits** document via tools (chat + editor)
- [Integration: LLM stream (parser)](../../pages/examples/integration-llm-stream.html) — render-only into HTML
- [Integration: quikchat](../../pages/examples/integration-quikchat.html) — markdown inside chat bubbles

## License

BSD-2-Clause (same as quikdown).
