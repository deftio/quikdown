# quikdown — Issue Tracker

Active backlog. **Completed work** → [`dev/todo_completed.md`](todo_completed.md) (includes 1.2.14–1.2.16 review + MCP Path A).

**Legend:** P0 = packaging/consumer · P1 = bug/security · P2 = quality/docs/CI · P3 = polish/defer · ✅ done · 🟡 partial · ❌ open

**Last verified:** branch `feature/quikdown-mcp` · v1.2.16 · MCP Path A shipped, Path B open

---

## Status dashboard

| Area | Status | Notes |
|------|--------|-------|
| Core parser | ✅ | 100% coverage; security corpus |
| Packaging / CI / standalone release | ✅ | See todo_completed |
| Editor coverage | 🟡 | 79.5% stmts; v3 target 80% |
| MCP Path A (Cursor + bin) | ✅ | 24 tools; headless + fs + editor when bound |
| MCP Path B (render + doc host) | ✅ | 24 tools + doc host example shipped |
| Release pipeline reliability | 🟡 | gzip `-f` fixed; split publish/release still fragile |
| Try-it page chrome | ❌ | Full nav; no minimal mode / local file I/O |
| Markdown feature gaps | ❌ | Slugs, indented code, nested BQ — post-ship |

---

## MCP — open work

**Shipped (Path A):** `quikdown/mcp`, `quikdown-mcp` bin, 24 tools (6 headless + 5 filesystem + 13 editor), docs, site page, tests. See [todo_completed](todo_completed.md).

**Architecture (unchanged):** One package, one JSON-RPC server, three groups — headless (always) + filesystem (Node + `root`) + editor (when `{ editor }` bound). No tiering when editor is bound.

### Path B gaps — render & export (P1 for “full power” claim)

These were in the agreed v1 inventory; not implemented yet. Required for live doc copilot + rich export without huge tool payloads.

- [x] **`get_rendered`** — calls `editor.getRenderedContent({ output })` where `output` is `default` | `stripped` | `quikdown`. Requires Path B host with `getRenderedContent` on the editor binding.
- [x] **`write_rendered_to_file`** — `{ path, output? }` → calls `get_rendered` then writes to disk. Requires filesystem root + editor with `getRenderedContent`.
- [x] **`load_file_to_editor`** — `{ path }` → reads file from sandbox, calls `setMarkdown()`. Files over 100 KB return stats/threshold instead of loading.

### Path B gaps — doc-host example (Node + browser)

Path B is **not** pure Node and **not** IDE-only. It is a **Node launcher/bridge** plus a **browser window** the human uses.

**Architecture:**

```
Cursor (agent)  ──stdio MCP──►  Node host (start-mcp.js)
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              filesystem        WebSocket      (optional auto-open)
              sandbox               │
                                    ▼
                            Browser tab
                            QuikdownEditor + preview DOM
                            ◄── human interacts here
```

- [x] **`examples/mcp-doc-host/`** — `start-mcp.js` (stdio MCP + HTTP/WS + browser launcher), `editor-host.html` (QuikdownEditor + WS client)
- [x] **README in example** — explicit: human = browser; agent = Cursor via Node; two surfaces; render needs preview DOM
- [x] **Auto-open browser** with manual URL fallback (`http://localhost:PORT`)
- [x] **Deprecate or bridge `examples/shared/agent-tools.js`** — added @deprecated JSDoc pointing to MCP; existing demos still work
- [x] **Cross-link `docs/llm-integration.md`** → MCP section added with Path A vs Path B + link to `docs/quikdown-mcp.md`
- [x] **`docs/quikdown-mcp.md`** — Path A vs Path B; Node host + browser UX explicit
- [x] **`pages/mcp/`** — Path A vs Path B section (template + generated page)
- [x] **AGENTS.md / llms.txt** — when agents should use MCP tools vs raw string edits (guidance section added)
- [x] **Contributor note** — added to docs/quikdown-mcp.md: `npm run build` before `npx quikdown-mcp` from repo

### Optional / v1.1

- [ ] **`allowPaths` opt-in** on `createMcpServer({ root, allowPaths? })` — escape strict sandbox when documented
- [x] **`markdown_to_ast` / `markdown_to_json`** headless tools (optional v1)
- [ ] **Symlink hardening** in `safePath()` — low priority unless multi-tenant sandbox advertised
- [x] **`quikdown_mcp` in GitHub Release assets** — added to `publish.yml` files list

### MCP checklist

**Done**

- [x] Headless + filesystem + editor tool handlers
- [x] Path sandbox + regex guardrails (200 char / 200 match cap)
- [x] `createMcpServer({ editor?, root? })` + dynamic `tools/list`
- [x] Export `quikdown/mcp` + Rollup + `quikdown-mcp` bin
- [x] Jest JSON-RPC + fs tempdir (~114 tests, 90% threshold)
- [x] `docs/quikdown-mcp.md` + `pages/mcp/` + README/AGENTS
- [x] Path A Cursor config snippets in docs
- [x] Render/export/load tools (`get_rendered`, `write_rendered_to_file`, `load_file_to_editor`)
- [x] `docs/llm-integration.md` MCP section
- [x] Publish.yml MCP release assets
- [x] agents.md/llms.txt guidance: when to use MCP vs raw edits
- [x] Contributor note in docs

**Open**

- [x] Render tools (`get_rendered`, `write_rendered_to_file`) + tests (24 tools total)
- [x] `load_file_to_editor` + tests
- [x] Path B runnable example (`examples/mcp-doc-host/`)
- [x] `docs/llm-integration.md` MCP section
- [x] Release asset list includes MCP bundle + `.d.ts` (added to publish.yml)

### User journeys (reference)

#### Path A — IDE + bin (shipped)

| | |
|--|--|
| **Run** | `npx quikdown-mcp --root=.` in MCP config |
| **Human** | IDE file editor only — **no browser** |
| **Agent** | Headless + filesystem |

#### Path B — Node host + browser (open)

| | |
|--|--|
| **Run** | `node examples/mcp-doc-host/start-mcp.js` in MCP config |
| **Human** | **Browser tab** — QuikdownEditor split/preview; you click, scroll, undo |
| **Node** | Launcher + stdio MCP + WebSocket bridge + file sandbox — **not** the editor UI |
| **Agent** | Cursor → Node → editor in browser (+ render/export when tools ship) |

**Path B is both:** standalone Node app you start once **and** a browser window you work in. Not either/or.

**Not Path B:** `quikdown-mcp` bin alone (no preview, no `get_rendered`). **Not Path A:** expecting live Mermaid/math preview from MCP in Cursor.

---

## Release & CI — open

- [ ] **`copyRendered` Playwright test** — e2e clicks copy-rendered; asserts rich clipboard (P1 quality)
- [ ] **Release-only retry path** — publish job can succeed while GitHub Release fails; re-run full workflow breaks on npm duplicate version (see release-process “if something goes wrong”)
- [ ] **PR CI dry-run publish steps** — `build:all` + airgap + gzip `-f` + asset checklist (partially on branch; ensure on main)
- [ ] **Branch protection: require `e2e-smoke`** — currently only `build` is required to merge
- [ ] **`tag-and-publish` should wait for smoke** — can tag while e2e-smoke still running
- [ ] **Husky pre-commit staleness check** — lint + test only; no build/dist freshness
- [ ] **`npm pack` audit** in verifyPackage — flip warn → fail
- [ ] **Tarball install smoke** — `npm pack && npm install ./quikdown-*.tgz`
- [ ] **Expand `release-notes.md`** for recent releases (security/BD depth)
- [ ] **Backfill v1.2.14 GitHub Release** (optional) — npm has 1.2.14; Release page skips to 1.2.15

---

## Editor & QA — open

- [ ] **80% editor coverage (v3)** — canvas rasterization (svgToPng, GeoJSON tiles), deep CDN callbacks; likely Playwright+coverage merge
- [ ] **Reduce coverage-gaming duplication** — consolidate `*_coverage.test.js` boosters (long-term)
- [ ] **Adopt layered CI gates** — document vs enforce (verify:types, fixture matrix)
- [ ] **Fixture matrix runner** — extend `tests/fixtures/markdown-samples.js` with roundtrip contracts
- [ ] **Fences contract matrix** — each built-in lang render + BD where applicable
- [ ] **Split editor monolith** (long-term) — fences, toolbar, copy, styles, loader modules

---

## Parser & markdown gaps (P2 — not blocking ship)

| Feature | Why it matters |
|---------|----------------|
| Heading slug / `id` | TOC links `#installation` go nowhere |
| 4-space indented code | Pasted READMEs break |
| Nested blockquotes | LLM/email-style quotes |
| Tab-as-4-spaces list indent | Obsidian/VS Code files |
| Malformed table graceful parse | LLM-generated ragged tables |
| Setext headings | Some models use underline style |

### Parser hygiene

- [ ] **Blockquote merge HTML strip** — investigate adjacent `<blockquote>` merge regex
- [ ] **List indent policy** — 2-space vs 4-space vs tabs; test matrix
- [ ] **Fence plugin multi-root BD** — document single-wrapper requirement in plugin-guide

---

## Pages & README polish (P3)

### Try-it (`pages/edit/`)

- [ ] Minimal chrome mode (more editor pixels)
- [ ] Download `.md`, open/save local file, share `#md=` link
- [ ] Export HTML; drag-drop `.md`

### Site hub

- [ ] Landing hero CTA: Try Editor · npm · LLM example
- [ ] Examples hub tags: LLM / Editor / Parser
- [ ] Docs hub cards for try-it + LLM examples
- [ ] Consistent “no signup” messaging

### README / docs

- [ ] Trim Quick Start / Supported Markdown / TypeScript sections (link out)
- [ ] `docs/README.md` hub links to `pages/`
- [ ] Reduce README ↔ docs feature-list duplication

---

## Related files

| Area | Paths |
|------|-------|
| MCP | `src/quikdown_mcp.js`, `bin/quikdown-mcp`, `docs/quikdown-mcp.md`, `pages/templates/mcp.html`, `examples/mcp-doc-host/` |
| Release | `tools/release.sh`, `.github/workflows/ci.yml`, `.github/workflows/publish.yml` |
| Editor | `src/quikdown_edit.js`, `src/quikdown_edit_copy.js` |
| LLM demos | `examples/llm-tool-editor/`, `examples/shared/agent-tools.js` |
| Completed log | `dev/todo_completed.md` |
