# quikdown documentation

Complete documentation for the quikdown markdown parser, editor, and companion libraries.

## Start here

| Doc | Description |
|-----|-------------|
| **[Try the editor](https://deftio.github.io/quikdown/pages/edit/)** | Live split-view editor on the site |
| **[Examples hub](https://deftio.github.io/quikdown/pages/examples/)** | Interactive demos (parser, editor, LLM, offline) |
| **[LLM integration](llm-integration.md)** | Streaming, agent tools, quikchat — agent UI patterns |
| **[Editor](quikdown-editor.md)** | QuikdownEditor API, headless mode, fences, themes |
| **[Fence authoring](fences.md)** | ABC, Vega-Lite, Mermaid, math, GeoJSON, and all built-in fences |
| **[Standalone editor](standalone-editor.md)** | Offline / air-gapped bundle (~7.7 MB / ~1.0 MB gzipped) |

## Core reference

- **[API Reference](api-reference.md)** — Parser options, modules, TypeScript types
- **[Architecture](architecture.md)** — Four-phase parser pipeline
- **[Security Guide](security.md)** — XSS model, CSP, deployment checklist
- **[Plugin Development](plugin-guide.md)** — Custom fence plugins
- **[Fence authoring](fences.md)** — Built-in fence types: ABC, Vega-Lite, Mermaid, math, maps, …
- **[Bidirectional Conversion](quikdown-bidirectional.md)** — HTML ↔ Markdown round-trip
- **[AST Libraries](quikdown-ast.md)** — AST, JSON, YAML structured output

## Integration

- **[Framework Integration](framework-integration.md)** — React, Vue, Svelte, Angular, Next.js, Nuxt
- **[LLM Integration](llm-integration.md)** — Streaming, tool editor, chat widgets
- **[MCP Server](quikdown-mcp.md)** — AI agent tool integration (Cursor, Claude Desktop, VS Code)
- **[Release Process](release-process.md)** — Shipping, standalone bundle, CI gates

## Examples (repo)

| Path | Description |
|------|-------------|
| [examples/ai-canvas/](../examples/ai-canvas/) | AI Canvas — chat + document editor, simulated + live LLM (BYOK) |
| [examples/mcp-doc-host/](../examples/mcp-doc-host/) | MCP Path B doc copilot — Node bridges MCP to browser editor |
| [examples/llm-tool-editor/](../examples/llm-tool-editor/) | quikchat + editor + simulated agent tools |
| [examples/llm-stream-editor/](../examples/llm-stream-editor/) | Stream tokens into QuikdownEditor |
| [pages/examples/](../pages/examples/) | Site-hosted examples (parser, BD, editor, integrations) |
| [examples/](../examples/) | Additional HTML demos and sample `.md` files |

Run locally: `npm run serve` → http://localhost:6811

## Other

- **[Lexer Implementation](lexer-implementation.md)** — Experimental lexer-based parser
- **[Release Notes](release-notes.md)** — Version history

## Quick links

- [GitHub](https://github.com/deftio/quikdown)
- [NPM](https://www.npmjs.com/package/quikdown)
- [Downloads](https://deftio.github.io/quikdown/pages/downloads/)
- [quikchat](https://github.com/deftio/quikchat) — chat widget often paired with quikdown

## Overview

quikdown is a lightweight, secure markdown toolkit for chat, LLM output, and embeddable editing:

- **Security** — HTML escaped by default; URL sanitization
- **Size** — ~14.9 KB parser, ~98 KB editor (fences lazy-loaded)
- **Offline** — Standalone editor bundles fence libs (~7.7 MB / ~1.0 MB gzipped)
- **Bidirectional** — Optional HTML ↔ Markdown round-trip
- **Zero deps (core)** — Parser and BD modules have no runtime dependencies

## License

BSD-2-Clause — see [LICENSE](../LICENSE.txt)
