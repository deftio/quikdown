# Completed Tasks - quikdown

This file contains all completed tasks moved from todo.md to reduce clutter.

## Documentation & Architecture
* ✅ Created comprehensive documentation in docs/ folder
* ✅ Documented security model and HTML handling via fence plugins
* ✅ Created API reference with all methods and options
* ✅ Created plugin development guide with examples
* ✅ Linked all documentation from README
* ✅ Created release-notes.md (serves as CHANGELOG)
* [x] Add keywords to package.json for better NPM discoverability


## Build & Testing
* ✅ Fixed npm run build process
* ✅ Added version property to quikdown
* ✅ Achieved 100% test coverage (statements, functions, lines)
* ✅ Created Babel configuration for ES modules
* ✅ Fixed Jest configuration

## ✅ Code Quality
* ✅ Removed dead code in processTable function
* ✅ Fixed capitalization (QuikDown → quikdown)
* ✅ Created examples index.html page
* ✅ Consolidated duplicate styles to save ~200 bytes
* ✅ Fixed fence plugin fallback when returning undefined

## ✅ New Features
* ✅ **Task Lists Support** - GitHub-style checkboxes
  - `- [ ]` for unchecked, `- [x]` for checked
  - Disabled checkboxes for display only
  - Works with nested lists
  - ~300 bytes added

## ✅ CI/CD & Release Automation
* ✅ **GitHub Actions CI** - Automated testing pipeline
  - Tests on Node 16.x, 18.x, 20.x
  - Coverage reporting to Codecov
  - Build verification
* ✅ **NPM Publish Workflow** - Automated package publishing
  - Triggered on release or manual dispatch
  - Version management
* ✅ **GitHub Release Workflow** - Automated releases
  - Changelog generation
  - Asset uploads (UMD, ESM, CJS bundles)
  - Tag-based triggers

## ✅ Security Enhancements
* ✅ Added URL sanitization to prevent XSS attacks
  - Blocks javascript:, data: (except data:image/*), vbscript: URLs
  - Added `allow_unsafe_urls` option for opt-in when needed

## ✅ v1.0.5 Features (2025-08-19)

### QuikdownEditor Implementation
* ✅ Created standalone drop-in editor control (quikdown_edit.js)
* ✅ Three view modes: source, split, preview
* ✅ Bidirectional editing with real-time sync
* ✅ Built-in toolbar with mode switching and copy functions
* ✅ Plugin support for Highlight.js and Mermaid
* ✅ Custom fence plugin support via customFences option
* ✅ Keyboard shortcuts (Ctrl/Cmd+1/2/3)
* ✅ Theme support (light/dark/auto)
* ✅ Mobile responsive design
* ✅ Full API with methods and events
* ✅ Bundle size: 24.4KB minified


### Core Features
* ✅ Lazy linefeeds support - single \n becomes <br> for chat/LLM apps
* ✅ Fixed table alignment in CSS class mode
* ✅ Added keywords to package.json for NPM discoverability
* ✅ Created pure CDN examples with plugins
* [x] Fix table alignment with CSS classes - now works in both modes (fixed in v1.0.5)

### Architecture Refactor
* ✅ Refactored quikdown_bd to import and extend core module
* ✅ Eliminated ~800 lines of duplicate code
* ✅ Core module now supports bidirectional option
* ✅ Achieved 98%+ test coverage (391 tests passing)
  - Added rel="noopener noreferrer" to all external links

## ✅ Parser Improvements  
* ✅ Fixed fenced code regex to allow non-word language identifiers (c++, tsx, etc.)
  - Now supports: c++, tsx, jsx, asp.net, shell-session, etc.
* ✅ Support for ~~~ fences alongside ```
* ✅ Fixed ~~~ fence regex bug that matched fences in middle of text
  - Now requires fences to be at start of line
* ✅ Support for autolinks - bare URLs are now clickable
* ✅ Tolerates heading trailing #'s: `## Title ##` → `<h2>`
* ✅ Tables now work without leading/trailing pipes (GFM style)

## ✅ Documentation & Release
* ✅ Light and Darkmode css examples (quikdown.light.css quikdown.dark.css)
  - Files exist in dist/ directory
  - Multi-theme demo shows scoped themes working
* ✅ Update README with new features
  - Task list examples
  - CI/CD badges
  - NPM installation instructions
* ✅ Update package.json metadata for NPM
  - Repository URL is set
  - Author information is present
  - Homepage and bugs URLs configured
* ✅ Add README badges
  - CI status badge
  - NPM version badge
  - Coverage percentage badge
  - Bundle size badge
  - License badge

* [x] QuikdownEditor - Full HTML drop-in control (COMPLETED in v1.0.5)
  * ✅ Pulls in quikdown_bd and has source/split/preview views
  * ✅ Manages all deps and uses built-in styles
  * ✅ Loads hljs/mermaid dynamically
  * ✅ Has setters/getters for content
  * ✅ Copy buttons for markdown and HTML
  * ✅ onChange() and onModeChange() callbacks
  * ✅ Full API for programmatic control
  * ✅ Support for custom fence plugins via customFences option


## ✅ Recent UI/UX Improvements
* ✅ Fixed size reference in README (removed hardcoded 8.7kb)
* ✅ Renamed live-demo.html to quikdown-live.html
* ✅ Created quikdown icon/favicon with 'q' and down arrow
* ✅ Added favicon to all HTML files
* ✅ Made examples/index.html mobile-responsive
* ✅ Made examples/quikdown-live.html mobile-responsive
* ✅ Added documentation link to examples page
* ✅ Fixed all broken links to renamed demo file

## ✅ v1.0.3 Release - Size Optimizations & Features
* ✅ **Achieved 24% size reduction** (9.2KB → 7.0KB minified)
  - ✅ Implemented minifier-aware optimizations (dev2-dev4)
  - ✅ Module-level constant hoisting (QUIKDOWN_STYLES, CLASS_PREFIX, etc.)
  - ✅ Optimized placeholder strings (§CB§ vs %%%CODEBLOCK%%%)
  - ✅ CSS string optimization (removed spaces after colons)
  - ✅ Build-time version injection
  - ✅ Look in code to remove redundant constructs
  - ✅ Single global built-in styles dictionary (QUIKDOWN_STYLES constant)
* ✅ **TypeScript definitions** (added dist/quikdown.d.ts)
  - Full type safety for options and return values
  - Comprehensive JSDoc comments
* ✅ **Performance benchmarks** (tests/performance-benchmark.js)
  - `npm run test:perf` to run benchmarks
  - Compares regex vs lexer implementations
* ✅ **Experimental lexer implementation** (available as quikdown-lex)
  - State machine-based parser as alternative to regex
  - 100% test compatibility
  - ~7.9KB minified (0.9KB larger than regex version)
  - 4-8% slower but better maintainability
  - See docs/lexer-implementation.md for details
## 1.2.14–1.2.16 code review — completed (May 2026)

Moved from `dev/issues-tracked.md` to reduce clutter. See that file for **open** items only.

### Packaging & TypeScript
- [x] Restored `dist/*.d.ts` for all seven modules (+ MCP `.d.ts` in 1.2.16)
- [x] `tools/verifyPackage.cjs`, `npm run verify:package`, wired into PR CI
- [x] `verify:release` for publish (standalone + npm pack)
- [x] CI build → test order (no stale dist)
- [x] CI checks all `.d.ts` exist after build
- [x] Package contract tests (`tests/quikdown_package_contract.test.js`, 45 tests)
- [x] Fixed `package.json` author field typo

### CI & permissions
- [x] GitHub Actions default `contents: read`; write only on tag/publish
- [x] Playwright e2e job on PR CI (full suite non-blocking)
- [x] Blocking `@smoke` e2e job (`e2e-smoke` in ci.yml)
- [x] `gzip -9 -k -f` in publish.yml release job (fix half-published releases)

### Bidirectional fidelity
- [x] Table `data-qd-align` emission + contract tests
- [x] Blockquote `data-qd` for roundtrip
- [x] Unified underscore emphasis (body + tables)
- [x] HR policy aligned (parser, classifier, editor)
- [x] Weak table alignment test assertions fixed

### Security (core + editor + AST)
- [x] Fence lang XSS (core + editor + AST-HTML)
- [x] AST-HTML URL entity bypass fix; `allow_unsafe_urls` aligned with core
- [x] Security QA corpus (45 XSS payloads)
- [x] Mermaid error escape, MathJax scoping, rich copy re-sanitize
- [x] contenteditable / customFences trust documented
- [x] `FENCE_LIBRARIES` instance copy (no cross-editor leak)

### Editor quality
- [x] Editor coverage 49% → 79.5%; threshold 78% stmts; 612+ editor tests
- [x] Editor version from build (`__QUIKDOWN_VERSION__`)
- [x] Removed `makeFencesNonEditable` stub, `exp-bd/` tree
- [x] Fixed broken `performance-benchmark.js`
- [x] Direct `quikdown_classify.js` unit tests (90 tests)
- [x] Coverage thresholds ratcheted across all modules

### Standalone release pipeline
- [x] `build:all`, `checkStandalone.cjs`, `test:standalone:e2e` on publish + release.sh
- [x] highlight.js in devDependencies for standalone bundle
- [x] Air-gap zip on GitHub Release

### Documentation & LLM
- [x] `allow_unsafe_html` in api-reference + security + architecture Phase 1.5
- [x] Version strings synced; `docs/llm-integration.md`
- [x] LLM examples: `llm-tool-editor/`, `llm-stream-editor/`
- [x] README LLM section + zero-deps clarification
- [x] GitHub Release: standalone + air-gap + all `.d.ts` + CSS

### Release process
- [x] `release.sh` preflight: build:all → verify:release → standalone e2e → airgap → test
- [x] `docs/release-process.md` synced
- [x] Contract tests for BD roundtrip + package exports
- [x] `verify:types` ts-consumer fixture
- [x] Placeholder collision tests documented in malformed suite

### MCP — Path A (1.2.16)
- [x] `src/quikdown_mcp.js` — one server, three tool groups, JSON-RPC 2.0 stdio
- [x] Headless tools (4): parse, BD, stats, info
- [x] Filesystem tools (5): read info/lines/markdown, write md/html + sandbox
- [x] Editor tools (10): read/write, regex find/replace, extract, stats, get_html, undo/redo
- [x] `bin/quikdown-mcp`, export `quikdown/mcp`, Rollup ESM+CJS, `.d.ts`
- [x] ~94 Jest tests, 90% coverage threshold on `quikdown_mcp.esm.js`
- [x] `docs/quikdown-mcp.md` + `pages/mcp/` landing + README/AGENTS sections
- [x] `verify:package` + CI dist checks for MCP artifacts

---

* ✅ **CSS Theme System Improvements**
  - ✅ Container-based theme scoping with parent-child selectors
  - ✅ Generate theme CSS files from emitStyles() function
  - ✅ Created quikdown.light.css and quikdown.dark.css in dist/
  - ✅ Added generation script: `npm run build:css` (tools/generateThemeCSS.js)
  - ✅ Both themes now have explicit colors for robustness
  - ✅ Auto dark mode support with `.quikdown-auto` class
  - ✅ Fixed dark theme issues on live demo page
* ✅ **Documentation Updates**
  - ✅ Added ESM CDN examples (now shown before UMD)
  - ✅ Updated API reference with emitStyles() theme parameter
  - ✅ Comprehensive lexer implementation guide
  - ✅ Updated release notes for v1.0.3