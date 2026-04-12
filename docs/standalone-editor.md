# Standalone (Offline) Editor

The standalone editor bundles all fence-rendering libraries into a single file so that quikdown works fully offline — no CDN requests, no network dependencies.

## What's Bundled

| Library | Purpose | Size Contribution |
|---------|---------|-------------------|
| highlight.js | Syntax highlighting (12 languages) | ~500 KB |
| mermaid | Diagram rendering | ~2.0 MB |
| DOMPurify | HTML fence sanitization | ~30 KB |
| Leaflet | GeoJSON map rendering | ~140 KB |
| Three.js | STL 3D model rendering | ~500 KB |
| **quikdown editor** | Core editor + parser | ~81 KB |

**Total minified size:** ~3.8 MB

### Not Bundled

**MathJax** is intentionally excluded. It's architecturally incompatible with bundling — it dynamically loads fonts, configuration modules, and sub-processors at runtime. Math/KaTeX fences will display a loading placeholder when offline. This is the same approach used by squibview and other markdown editors.

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

This runs a dedicated rollup config (`rollup.config.standalone.js`) that bundles all dependencies with `inlineDynamicImports: true`.

The main build (`npm run build`) does NOT include the standalone bundle. To build everything:

```bash
npm run build:all
```

## When to Use

Use the standalone bundle when:

- **Air-gapped environments** — no internet access
- **Offline-first apps** — PWAs, Electron, mobile webviews
- **Self-hosted deployments** — no dependency on external CDNs
- **Embedded systems** — single-file deployment with no network

Use the regular editor when:

- **Bundle size matters** — the regular editor is 81 KB; fence libraries are loaded on demand
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
