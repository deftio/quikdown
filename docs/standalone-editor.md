# Standalone (Offline) Editor

The standalone editor bundles all fence-rendering libraries into a single file so that quikdown works fully offline — no CDN requests, no network dependencies.

## What's Bundled

| Library | Purpose | Size Contribution |
|---------|---------|-------------------|
| highlight.js | Syntax highlighting (12 languages) | ~500 KB |
| mermaid | Diagram rendering | ~2.0 MB |
| DOMPurify | HTML fence sanitization | ~30 KB |
| Leaflet | GeoJSON map rendering + base64 marker icons | ~140 KB |
| Three.js | STL 3D model rendering | ~500 KB |
| ABCJS | ABC music notation rendering | ~300 KB |
| Vega + Vega-Lite + Vega-Embed | Data visualization charts | ~1.5 MB |
| MathJax (tex-svg) | Math equation rendering | ~1.5 MB |
| Natural Earth (110m) | Offline vector basemap for GeoJSON maps | ~200 KB |
| **quikdown editor** | Core editor + parser | ~98 KB |

**Total minified size:** ~7.7 MB (~1.0 MB gzipped)

The standalone bundle defaults `allowExternalFetch: false` — all rendering is local with no network requests. Pass `allowExternalFetch: true` to re-enable OSM tiles and CDN loads.

## Distribution Files

| File | Format | Use Case |
|------|--------|----------|
| `quikdown_edit_standalone.esm.min.js` | ES Module (minified) | Modern apps with `import` |
| `quikdown_edit_standalone.umd.min.js` | UMD (minified) | Script tag, any environment |
| `quikdown_edit_standalone.esm.js` | ES Module | Development / debugging |
| `quikdown_edit_standalone.umd.js` | UMD | Development / debugging |

## Usage

### ES Module

```html
<div id="editor"></div>
<script type="module">
  import QuikdownEditor from './quikdown_edit_standalone.esm.min.js';
  const editor = new QuikdownEditor('#editor', { mode: 'split' });
  editor.setMarkdown('# Hello offline world!');
</script>
```

### UMD (Script Tag)

```html
<div id="editor"></div>
<script src="quikdown_edit_standalone.umd.min.js"></script>
<script>
  const editor = new QuikdownEditor('#editor', { mode: 'split' });
  editor.setMarkdown('# Hello offline world!');
</script>
```

### API

The standalone editor has the **exact same API** as the regular editor (`quikdown_edit.js`). All options, methods, and events work identically. The only difference is that fence-rendering libraries are pre-loaded instead of lazy-loaded from CDN.

See [API Reference](api-reference.md) for the full editor API.

## Building

The standalone bundle is built separately from the main build:

```bash
npm run build:standalone
```

This runs a dedicated rollup config (`rollup.config.standalone.js`) that bundles all dependencies with `inlineDynamicImports: true`. Fence libraries (`highlight.js`, `mermaid`, `dompurify`, `leaflet`, `three`, `abcjs`, `vega`, `vega-lite`, `vega-embed`, `mathjax-full`) must be present in **devDependencies** — CI runs `npm ci` before building.

The main build (`npm run build`) does NOT include the standalone bundle. To build everything:

```bash
npm run build:all
```

Release CI and `npm run release` always run **`build:all`**, **`verify:release`**, and **`test:standalone:e2e`** so the offline bundle cannot be omitted from a ship.

## Release / CI

| Step | What happens |
|------|----------------|
| `npm run release` | `build:all` → `verify:release` → `test:standalone:e2e` → `build:airgap` → `npm test` → auto-commit `dist/` |
| PR / daily CI | `npm run build` + tests only — **no standalone build** |
| `publish.yml` | `build:all`, `verify:release`, standalone smoke, npm publish, GitHub Release assets |
| npm publish | Standalone in `dist/` (`files: ["dist"]`) |
| GitHub Release | `quikdown_edit_standalone.*.min.js`, `.gz`, and **`quikdown-airgap-vX.Y.Z.zip`** |

See [release-process.md](release-process.md) for the full workflow.

## When to Use

Use the standalone bundle when:

- **Air-gapped environments** — no internet access
- **Offline-first apps** — PWAs, Electron, mobile webviews
- **Self-hosted deployments** — no dependency on external CDNs
- **Embedded systems** — single-file deployment with no network

Use the regular editor when:

- **Bundle size matters** — the regular editor is 86 KB; fence libraries are loaded on demand
- **Most fences aren't used** — if your users only write text and code blocks, loading mermaid/leaflet/three.js upfront is waste
- **CDN is available** — lazy loading gives the best initial load time

## Supported Languages (highlight.js)

The standalone bundle includes syntax highlighting for 12 common languages:

JavaScript, TypeScript, Python, Java, C, C++, CSS, HTML/XML, JSON, Bash, Shell, SQL

Additional languages can be registered at runtime if highlight.js is available on `window.hljs`:

```javascript
// After importing the standalone editor
import go from 'highlight.js/lib/languages/go';
window.hljs.registerLanguage('go', go);
```
