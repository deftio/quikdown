# quikdown — Issue Tracker

Active backlog. **Completed work** → [`dev/todo_completed.md`](todo_completed.md) (includes 1.2.14–1.2.16 review + MCP Path A).

**Legend:** P0 = packaging/consumer · P1 = bug/security · P2 = quality/docs/CI · P3 = polish/defer · ✅ done · 🟡 partial · ❌ open

**Last verified:** branch `feature/quikdown-mcp` · v1.2.16 · MCP Path A + Path B shipped; doc polish pass done

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
| Markdown feature gaps | ✅ | Slugs, indented code, ragged tables, nested BQ — v1.2.17 |

---

## MCP — status (shipped)

**Path A:** `quikdown/mcp`, `quikdown-mcp` bin — headless + filesystem (24 tools when editor bound). Docs, site page, tests. See [todo_completed](todo_completed.md).

**Path B:** `examples/mcp-doc-host/` — Node stdio MCP + WebSocket bridge + browser QuikdownEditor. Render/export tools (`get_rendered`, `write_rendered_to_file`, `load_file_to_editor`). Human works in **browser tab**; agent uses Cursor via Node.

**Architecture:** One package, one JSON-RPC server, three groups — headless (always) + filesystem (Node + `root`) + editor (when `{ editor }` bound). No tiering when editor is bound.

### Optional / v1.1

- [ ] **`allowPaths` opt-in** on `createMcpServer({ root, allowPaths? })` — escape strict sandbox when documented
- [ ] **Symlink hardening** in `safePath()` — low priority unless multi-tenant sandbox advertised

### User journeys (reference)

#### Path A — IDE + bin

| | |
|--|--|
| **Run** | `npx quikdown-mcp --root=.` in MCP config |
| **Human** | IDE file editor only — **no browser** |
| **Agent** | Headless + filesystem |

#### Path B — Node host + browser

| | |
|--|--|
| **Run** | `node examples/mcp-doc-host/start-mcp.js` in MCP config |
| **Human** | **Browser tab** — QuikdownEditor split/preview; you click, scroll, undo |
| **Node** | Launcher + stdio MCP + WebSocket bridge + file sandbox — **not** the editor UI |
| **Agent** | Full editor + render/export via Node bridge |

Path B is **both:** standalone Node app you start once **and** a browser window you work in.

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
