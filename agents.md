# agents.md - AI Agent Guide for quikdown

This file helps AI coding agents (Claude, Copilot, Cursor, etc.) work effectively with the quikdown codebase.

## What is quikdown?

quikdown is a lightweight, zero-dependency markdown-to-HTML parser with built-in XSS protection and an extensible fence plugin system. It runs in both browser and Node.js environments. The project also includes a bidirectional converter (HTML back to markdown), a full-featured drop-in editor component (with headless mode), and structured output modules (AST, JSON, YAML).

- **Repository:** https://github.com/deftio/quikdown
- **License:** BSD-2-Clause
- **Version:** 1.2.12
- **Language:** JavaScript (ES modules, UMD, CommonJS)
- **TypeScript:** Definitions included in `dist/*.d.ts`
- **Test framework:** Jest (unit) + Playwright (e2e)
- **Build tool:** Rollup
- **Zero runtime dependencies** for all core modules

## Project Structure

```
quikdown/
├── src/                              # Source files
│   ├── quikdown.js                  # Core parser (~1000 lines)
│   ├── quikdown_bd.js               # Bidirectional conversion (MD ↔ HTML)
│   ├── quikdown_edit.js             # Editor component (~2600 lines)
│   ├── quikdown_edit_standalone.js  # Standalone editor (bundles all fence libs)
│   ├── quikdown_edit_copy.js        # Rich clipboard / copyRendered() (~1400 lines)
│   ├── quikdown_ast.js              # AST parser
│   ├── quikdown_json.js             # AST to JSON
│   ├── quikdown_yaml.js             # AST to YAML
│   ├── quikdown_ast_html.js         # AST to HTML renderer
│   ├── quikdown_classify.js         # Line classification utilities
│   └── quikdown_version.js          # Version constant
├── dist/                             # Build output (ESM, UMD, CJS, d.ts, CSS)
├── tests/                            # 30+ test files
├── examples/                         # 20+ working HTML examples + sample .md files
├── docs/                             # Detailed documentation (13 markdown files)
├── pages/                            # Static site templates and generated pages
├── tools/                            # Build scripts (version, CSS, badges, site)
├── rollup.config.js                 # Rollup build configuration
├── playwright.config.cjs            # Playwright e2e test config
├── package.json                     # Package metadata and scripts
└── README.md                        # Project readme
```

## Key Commands

```bash
# Build
npm run build              # Full build pipeline (version, CSS, Rollup, site, badges)
npm run build:standalone   # Build standalone editor bundle
npm run build:all          # Build everything including standalone

# Test
npm test                   # All tests with coverage
npm run test:quikdown      # Core parser tests only
npm run test:unit          # Unit tests with coverage
npm run test:e2e           # Playwright end-to-end tests

# Other
npm run serve              # Dev server on port 6811
npm run docs:api           # Generate JSDoc API docs
npm run buildSite          # Build site pages from templates
npm run minifyCSS          # Minify CSS theme files
npm run lint               # Run ESLint (includes security plugin)
```

## Architecture Overview

### Parser: Four-Phase Pipeline

The core parser (`src/quikdown.js`) processes markdown in four phases:

1. **Phase 1 - Extract & Protect:** Scan for fenced code blocks (``` / ~~~) and inline code spans. Replace with placeholders (`§CB§`, `§IC§`) to prevent markdown processing inside code.

2. **Phase 2 - HTML Escaping:** Escape `&`, `<`, `>`, `"`, `'` to prevent XSS. Skipped when `allow_unsafe_html` is true. An optional sub-phase handles safe HTML whitelisting.

3. **Phase 3 - Block Scanning + Inline Formatting:**
   - Tables (pipe-based line walker)
   - Headings, HR, blockquotes (per-line scanner)
   - Lists (ordered, unordered, task lists)
   - Inline formatting: images, links, autolinks, bold, italic, strikethrough
   - Line breaks and paragraph wrapping
   - Cleanup (remove accidental `<p>` around block elements)

4. **Phase 4 - Code Restoration:** Replace placeholders with rendered HTML. Apply `fence_plugin.render()` if provided. Fall back to `<pre><code>` for default rendering.

### Modules

| Module | Source | Import Path | Purpose |
|--------|--------|-------------|---------|
| Core parser | `src/quikdown.js` | `quikdown` | Markdown to HTML |
| Bidirectional | `src/quikdown_bd.js` | `quikdown/bd` | HTML ↔ Markdown roundtrip |
| Editor | `src/quikdown_edit.js` | `quikdown/edit` | Drop-in editor component |
| Editor standalone | `src/quikdown_edit_standalone.js` | (standalone builds) | Editor + all fence libs bundled |
| Editor copy | `src/quikdown_edit_copy.js` | (internal) | Rich clipboard for copyRendered() |
| AST | `src/quikdown_ast.js` | `quikdown/ast` | Markdown to AST |
| JSON | `src/quikdown_json.js` | `quikdown/json` | Markdown to JSON |
| YAML | `src/quikdown_yaml.js` | `quikdown/yaml` | Markdown to YAML |
| AST to HTML | `src/quikdown_ast_html.js` | `quikdown/ast-html` | Render AST to HTML |

### Build Outputs

Each module is built as ESM (`.esm.js`, `.esm.min.js`), UMD (`.umd.js`, `.umd.min.js`), CommonJS (`.cjs`), and TypeScript definitions (`.d.ts`). Source maps are included for minified files.

The standalone editor build uses a separate Rollup config (`rollup.config.standalone.js`) with `inlineDynamicImports: true` to bundle all fence libraries into a single file.

## Core Parser API

### quikdown(markdown, options?)

```javascript
import quikdown from 'quikdown';
const html = quikdown('# Hello **world**');
```

**Options:**
- `fence_plugin` (FencePlugin) - Custom code block renderer
- `inline_styles` (boolean, default: false) - Embed CSS directly in elements
- `lazy_linefeeds` (boolean, default: false) - Single `\n` becomes `<br>`
- `bidirectional` (boolean, default: false) - Add `data-qd` attributes for roundtrip
- `allow_unsafe_html` (boolean | Record | string[], default: false) - HTML passthrough control
- `allow_unsafe_urls` (boolean, default: false) - Allow javascript:, vbscript:, data: URIs

**Static methods:**
- `quikdown.emitStyles(prefix?, theme?)` - Generate CSS string ('light' or 'dark' theme)
- `quikdown.configure(options)` - Return pre-configured parser function
- `quikdown.version` - Version string

## Fence Plugin System

### Core Parser Plugins

```javascript
const html = quikdown(md, {
  fence_plugin: {
    render: (code, language) => {
      if (language === 'mermaid') return `<div class="mermaid">${code}</div>`;
      // Return undefined for default <pre><code> rendering
    },
    reverse: (element) => {
      // Optional: for bidirectional roundtrip
      if (element.classList.contains('mermaid'))
        return { fence: '```', lang: 'mermaid', content: element.textContent };
      return null;
    }
  }
});
```

### Editor Fence Handling

The editor has three mechanisms for fence rendering:

**1. preloadFences** - Load fence libraries at construction time:
```javascript
new QuikdownEditor('#e', { preloadFences: 'all' });                    // All libraries
new QuikdownEditor('#e', { preloadFences: ['mermaid', 'highlightjs'] }); // Specific
new QuikdownEditor('#e', { preloadFences: null });                     // Lazy (default)
```

Recognized names: `'highlightjs'`, `'mermaid'`, `'math'`, `'geojson'`, `'stl'`.

**2. customFences** - User-defined renderers (checked before built-ins):
```javascript
new QuikdownEditor('#e', {
  customFences: {
    'plantuml': (code, lang) => `<img src="http://plantuml.com/svg/${encode(code)}">`,
    'chart': (code, lang) => renderChart(JSON.parse(code))
  }
});
```

**3. enableComplexFences** - Master toggle for all built-in fence rendering (default: true).

**Built-in fence types:**

| Fence | Library | Auto-Loaded |
|-------|---------|-------------|
| Programming languages | Highlight.js | Yes (from CDN) |
| `mermaid` | Mermaid | Yes |
| `math`, `katex`, `tex`, `latex` | MathJax v3 | Yes |
| `geojson` | Leaflet | Yes |
| `stl` | Three.js | Yes |
| `csv`, `psv`, `tsv` | Built-in | N/A |
| `svg` | Built-in | N/A |
| `html` | DOMPurify | Yes |
| `json`, `json5` | Built-in / Highlight.js | Optional |

## Editor Component

### Build Variants

| Variant | Size | Use Case |
|---------|------|----------|
| Regular (`quikdown_edit.*`) | ~86 KB | Standard use. Fence libs lazy-loaded from CDN. |
| Standalone (`quikdown_edit_standalone.*`) | ~3.8 MB | Offline / Electron / PWA. All fence libs pre-bundled. |

The standalone bundles Highlight.js (12 languages), Mermaid, DOMPurify, Leaflet, and Three.js. MathJax is NOT bundled (requires dynamic font loading). Both variants have the identical API.

### Editor Setup

```javascript
import QuikdownEditor from 'quikdown/edit';

// Full-featured
const editor = new QuikdownEditor('#container', {
  mode: 'split',
  theme: 'auto',
  showToolbar: true,
  showUndoRedo: true,
  plugins: { highlightjs: true, mermaid: true },
  onChange: (md, html) => save(md)
});

// Headless (no built-in UI)
const editor = new QuikdownEditor('#container', {
  showToolbar: false,
  onChange: (md, html) => myCustomPreview.innerHTML = html
});
// Control programmatically: editor.setMode(), editor.undo(), editor.copy(), etc.

// Standalone (offline)
import QuikdownEditor from './quikdown_edit_standalone.esm.min.js';
const editor = new QuikdownEditor('#container', { mode: 'split' });
// All fence types render instantly with no network calls
```

### Editor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `'split'` | `'source'`, `'split'`, `'preview'` |
| `theme` | string | `'auto'` | `'light'`, `'dark'`, `'auto'` |
| `showToolbar` | boolean | `true` | Show/hide toolbar (false = headless) |
| `showRemoveHR` | boolean | `false` | Show "Remove HR" button |
| `showLazyLinefeeds` | boolean | `false` | Show "Fix Linefeeds" button |
| `showUndoRedo` | boolean | `false` | Show undo/redo buttons |
| `showAllowUnsafeHTML` | boolean | `false` | Show HTML mode toggle |
| `initialContent` | string | `''` | Initial markdown |
| `placeholder` | string | `'Start typing markdown...'` | Textarea placeholder |
| `lazy_linefeeds` | boolean | `false` | Single `\n` becomes `<br>` |
| `inline_styles` | boolean | `false` | Inline CSS vs class names |
| `allowUnsafeHTML` | boolean\|'limited' | `false` | HTML passthrough |
| `debounceDelay` | number | `20` | Preview update delay (ms) |
| `undoStackSize` | number | `100` | Max undo states |
| `enableComplexFences` | boolean | `true` | Built-in fence rendering |
| `preloadFences` | various | `null` | Preload fence libraries |
| `customFences` | object | `{}` | Custom fence handlers |
| `plugins` | object | `{}` | Legacy: `{ highlightjs, mermaid }` |
| `onChange` | function | `null` | `(markdown, html) => void` |
| `onModeChange` | function | `null` | `(mode) => void` |

### Editor Methods

**Content:** `getMarkdown()`, `setMarkdown(md)`, `getHTML()`, `.markdown` (getter/setter), `.html` (getter)

**View:** `setMode(mode)`, `.mode` (getter), `setTheme(theme)`, `getTheme()`, `setLazyLinefeeds(bool)`, `getLazyLinefeeds()`, `setDebounceDelay(ms)`, `getDebounceDelay()`

**Undo/Redo:** `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clearHistory()`

**Transforms:** `removeHR()`, `convertLazyLinefeeds()`

**Clipboard:** `copy('markdown'|'html')`, `copyRendered()` (rich text with rasterized SVGs/diagrams/maps)

**Resources:** `loadScript(src)`, `loadCSS(href)`

**Lifecycle:** `destroy()`

**Static:** `QuikdownEditor.removeHRFromMarkdown(md)`, `QuikdownEditor.convertLazyLinefeeds(md)`, `QuikdownEditor.SAFE_HTML_TAGS`

### Editor Keyboard Shortcuts

Ctrl/Cmd + 1/2/3 for source/split/preview. Ctrl/Cmd + Z for undo. Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo.

### Editor UI CSS Classes

The editor DOM follows this structure:
```
.qde-container > .qde-toolbar + .qde-editor > (.qde-source > textarea.qde-textarea) + .qde-preview
```

Dark mode adds `.qde-dark` to the container. Mode classes: `.qde-mode-source`, `.qde-mode-split`, `.qde-mode-preview`. Override preview styles via `.qde-preview h1`, `.qde-preview pre`, etc. - no `!important` needed.

## Bidirectional Conversion

```javascript
import quikdown_bd from 'quikdown/bd';
const html = quikdown_bd('# Hello **world**');
const md = quikdown_bd.toMarkdown(html);
```

Uses `data-qd` attributes embedded during forward conversion. Supports roundtrip for: headings, bold, italic, strikethrough, links, images, code blocks, tables, blockquotes, lists, horizontal rules.

## AST / JSON / YAML

```javascript
import quikdown_ast from 'quikdown/ast';
import quikdown_json from 'quikdown/json';
import quikdown_yaml from 'quikdown/yaml';

const ast = quikdown_ast('# Heading\n\nParagraph');
const json = quikdown_json('# Heading');
const yaml = quikdown_yaml('# Heading');
```

Node types: `document`, `heading`, `paragraph`, `code_block`, `blockquote`, `list`, `list_item`, `table`, `hr`, `text`, `strong`, `em`, `del`, `code`, `link`, `image`, `br`.

## Styling

### CSS Classes (default)

Elements get classes like `quikdown-h1`, `quikdown-pre`, `quikdown-code`, `quikdown-table`, `quikdown-strong`, etc. Generate CSS with `quikdown.emitStyles('quikdown-', 'light')` or use `dist/quikdown.light.css` / `dist/quikdown.dark.css`.

### Inline Styles

Set `inline_styles: true` to embed styles directly in HTML elements. Useful for emails or contexts without external CSS.

## Security Model

- **HTML escaping by default:** All `<`, `>`, `&`, `"`, `'` are entity-encoded
- **URL sanitization:** Blocks `javascript:`, `vbscript:`, non-image `data:` URIs
- **No dynamic RegExp:** All patterns are static; verified free of ReDoS
- **ESLint security plugin:** Enforced at error level with zero findings
- **Zero dependencies:** No supply chain risk
- **Controlled HTML passthrough:** `allow_unsafe_html` accepts `false` (default), `true`, a tag whitelist array, or a tag whitelist object. `QuikdownEditor.SAFE_HTML_TAGS` provides a curated whitelist.

## Testing

Tests are in `tests/` using Jest (jsdom environment) and Playwright:

- `quikdown.test.js` - Core parser (100% coverage target)
- `quikdown_bd.test.js` - Bidirectional conversion
- `quikdown_edit*.test.js` - Editor (multiple test files)
- `quikdown_ast.test.js` - AST parser
- `quikdown_json.test.js` - JSON converter
- `quikdown_yaml.test.js` - YAML converter
- `quikdown_malformed.test.js` - Error handling / edge cases
- `quikdown_stress.test.js` - Performance
- `*.spec.js` - Playwright e2e tests

Coverage thresholds: 100% for core, 89-100% for variants, minimum 80% overall.

## Documentation Reference

Detailed docs in `docs/`:

| File | Content |
|------|---------|
| `docs/api-reference.md` | Complete API with all parameters, return types, examples |
| `docs/architecture.md` | Four-phase parser pipeline, design rationale |
| `docs/plugin-guide.md` | Plugin development with 6+ examples (basic to production) |
| `docs/framework-integration.md` | React, Vue, Svelte, Angular, Next.js, Nuxt |
| `docs/security.md` | Threat model, XSS prevention, CSP, deployment checklist |
| `docs/quikdown-bidirectional.md` | HTML ↔ markdown roundtrip |
| `docs/quikdown-editor.md` | Full editor docs: setup, API, headless, plugins, styling |
| `docs/standalone-editor.md` | Standalone/offline editor: bundled libs, build, usage |
| `docs/quikdown-ast.md` | AST, JSON, YAML structured output |
| `docs/release-notes.md` | Complete version history |
| `docs/release-process.md` | Release workflow |

## Examples Reference

Working HTML examples in `examples/`:

**Parser basics:** `parser-hello.html`, `parser-options.html`, `parser-themes.html`, `parser-fence-plugin.html`

**Bidirectional:** `bd-roundtrip.html`, `bd-fence-reverse.html`, `bd-tables-and-fences.html`

**Editor:** `editor-embed-minimal.html`, `editor-api-playground.html`, `editor-fence-custom.html`, `editor-themes-runtime.html`, `demo-headless.html`

**Integrations:** `integration-react.html`, `integration-vue.html`, `integration-llm-stream.html`, `integration-quikchat.html`

**Sample markdown:** `sample-basic.md`, `sample-comprehensive.md`, `sample-fence.md`, `sample-tables.md`, `sample-security.md`, `sample-bidirectional.md`, `sample-many-fences.md`, `sample-tasks.md`, `sample-rich-content.md`

## Common Agent Tasks

### Adding a new fence type to the editor

1. If it needs an external library, add an entry to `FENCE_LIBRARIES` in `src/quikdown_edit.js` with `check()`, `script`, optional `css`, `cssDark`, `beforeLoad`, `afterLoad`.
2. Add rendering logic in the editor's fence handling section.
3. For the standalone build, import the library in `src/quikdown_edit_standalone.js`.
4. Add tests in `tests/`.

### Adding a core parser feature

1. Edit `src/quikdown.js`. The parser processes in phases - identify which phase your feature belongs in.
2. Run `npm run test:quikdown` to verify. Add tests for the new feature.
3. If the feature affects bidirectional conversion, update `src/quikdown_bd.js` and add `data-qd` attributes.
4. Update TypeScript definitions in the corresponding `dist/*.d.ts` file.
5. Run `npm run build` to generate all output formats.

### Adding framework integration examples

1. See `docs/framework-integration.md` for existing patterns (React, Vue, Svelte, Angular, Next.js, Nuxt).
2. Add a new HTML example in `examples/integration-{framework}.html`.
3. Update the examples hub in `pages/templates/examples-hub.html`.

### Modifying the editor UI

1. Editor CSS is defined inline in `src/quikdown_edit.js` (injected as `<style id="qde-styles">`).
2. Toolbar buttons are created in the constructor. CSS classes follow the `qde-` prefix convention.
3. The editor UI structure: `.qde-container > .qde-toolbar + .qde-editor > .qde-source + .qde-preview`.
4. Test with `npm run test:unit` and `npm run test:e2e`.

### Working with the build system

- `rollup.config.js` defines build targets for all modules.
- `rollup.config.standalone.js` bundles the standalone editor with all dependencies.
- `tools/updateVersion.js` syncs version across files.
- `tools/minifyThemeCSS.js` minifies theme CSS.
- `tools/buildSite.js` generates pages from templates.
- Output goes to `dist/`.

## Important Conventions

- **No runtime dependencies** in production modules.
- **Security first:** All regex patterns must be static (no dynamic construction). HTML escaping is always on by default. URL sanitization blocks dangerous schemes.
- **CSS prefix:** `quikdown-` for parser output classes, `qde-` for editor UI classes.
- **Test coverage:** Maintain minimum 80% overall, 100% target for core parser.
- **Module formats:** Every module must be available as ESM, UMD, and CommonJS.
- **Bidirectional:** When adding block-level features, consider whether `data-qd` attributes are needed for roundtrip conversion.
