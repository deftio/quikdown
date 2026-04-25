# quikdown

[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage](https://img.shields.io/badge/coverage-96%25-brightgreen)](https://github.com/deftio/quikdown)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/badge/minified-10.8KB-green.svg)](https://bundlephobia.com/package/quikdown)

A small, secure markdown parser and editor for browsers and Node.js. Three modules — use only what you need.

- **quikdown.js** (9.8 KB) — Markdown to HTML parser. XSS-safe, fence plugin callbacks, inline styles or CSS classes.
- **quikdown_bd.js** (14.6 KB) — Bidirectional: everything in core plus HTML to Markdown round-trip.
- **quikdown_edit.js** (84.3 KB) — Drop-in split-view editor with live preview, undo/redo, bidirectional editing, and lazy-loaded fence plugins for code highlighting, Mermaid, MathJax, SVG, CSV, GeoJSON, and STL.
- **quikdown_edit_standalone.js** (3.8 MB) — Offline/air-gapped editor. Same as above but bundles highlight.js, Mermaid, DOMPurify, Leaflet, and Three.js — no CDN required. See [Standalone Docs](docs/standalone-editor.md).
- **quikdown_ast.js** / **quikdown_json.js** / **quikdown_yaml.js** / **quikdown_ast_html.js** — AST companion libraries for structured output.

**[Live Site](https://deftio.github.io/quikdown/pages/)** | **[Try the Editor](https://deftio.github.io/quikdown/pages/edit/)** | **[Examples](https://deftio.github.io/quikdown/pages/examples/)** | **[Frameworks](https://deftio.github.io/quikdown/pages/frameworks/)** | **[Downloads](https://deftio.github.io/quikdown/pages/downloads/)** | **[Docs](docs/)**

![quikdown editor in split mode with Mermaid diagram rendering](pages/assets/editor-screenshot.png)
*quikdown_edit in split mode — markdown source on the left, live rendered preview with Mermaid diagram on the right. Toolbar shows mode switching, undo/redo, copy, and linefeed controls.*

## Features

- **Compact markdown parser** — single-pass markdown to HTML. Handles headings, lists, tables, code blocks, inline formatting, task lists, autolinks, and lazy linefeeds.
- **Bidirectional editing** — edit the rendered HTML and get markdown back. Round-trip preserves formatting, fences, and tables.
- **Drop-in editor** — one `<div>`, one import. Source, split, and preview modes. Undo/redo, toolbar, copy as rich text, light/dark/auto themes.
- **Fence plugins** — code (highlight.js), Mermaid diagrams, MathJax equations, inline SVG, CSV/TSV/PSV tables, GeoJSON maps, STL 3D models, raw HTML. All bidirectional.
- **XSS-safe** — HTML entities escaped by default. URL sanitization blocks `javascript:`, `vbscript:`, and non-image `data:` URIs.
- **Browser and Node.js** — parser and bidirectional modules work in both. Editor requires DOM.
- **Zero runtime deps** — parser and bidirectional modules have no dependencies. Editor lazy-loads fence libraries (highlight.js, Mermaid, MathJax, etc.) from CDN on demand.
- **TypeScript definitions** — hand-maintained `.d.ts` files for all modules.
- **Inline styles or CSS classes** — built-in light/dark themes, or bring your own CSS.
- **Copy as rich text** — copies the rendered preview to clipboard with images, tables, and rendered fences. Paste into Gmail, Word, Slack, Notion.
- **Headless mode** — run the editor without a toolbar. Wire `undo()`, `setTheme()`, `setMode()` to your own UI.
- **Structured output** — parse markdown into AST, JSON, or YAML via companion libraries.

## Installation

Quikdown is available via [NPM](https://www.npmjs.com/package/quikdown) and related [unpkg](https://unpkg.com/quikdown) and [jsdelivr](https://cdn.jsdelivr.net/npm/quikdown)

### NPM package
```bash
npm install quikdown
```

### CDN using UNPKG  

**CDN (ES Modules):**
```html
<script type="module">
  import quikdown from 'https://unpkg.com/quikdown/dist/quikdown.esm.min.js';
  document.body.innerHTML = quikdown('# Hello World');
</script>
```

**CDN (UMD):**
```html
<script src="https://unpkg.com/quikdown/dist/quikdown.umd.min.js"></script>
<script>
  document.body.innerHTML = quikdown('# Hello World');
</script>
```

## Quick Start

Quikdown is built in 3 versions. The smallest (quikdown) provides markdown to html conversion only.  The next (quikdown_bd) provides markdown to html and html to markdown support.  The lightweight editor quikdown_edit allows a bidirectional editor with lazy loading for common fences such as codeblocks, svg, and mermaid diagrams is also provided.

### Markdown → HTML (quikdown.js)

```javascript
// Basic conversion
const html = quikdown('# Hello World',
    {inline_styles: true}  // Use inline styles,  more options in API docs
);

document.body.innerHTML = html;

```

### Bidirectional Markdown ↔  HTML (quikdown_bd.js)

```javascript
// Convert with source tracking
const htmlString = quikdown_bd(markdown, options);

// Convert HTML back to Markdown
const markdown = quikdown_bd.toMarkdown(htmlString);
```

Note: quikdown does not provide a *generic* html to markdown conversion but uses special tags and limited DOM parsing for HTML to markdown conversion.  Standard markdown components such as headings, text styles, tables, quotes, etc are supported.  For custom fences quikdown relies on its tag system or 3rd party handlers to provide reverse (html to md) conversion.

### Editor (quikdown_edit.js)

```javascript
const editor = new QuikdownEditor('#container', {
  mode: 'split',           // 'source', 'split', 'preview'
  theme: 'auto',           // 'light', 'dark', 'auto'
  plugins: { highlightjs: true, mermaid: true } // built-in fence handlers, see API docs for custom plugins
});

editor.setMarkdown('# Content  \nTo be quik or not to be.');  // provide default content
const content = editor.getMarkdown(); // get source content, see APIs for getting / setting HTML
```

### AST Libraries (quikdown_ast, quikdown_json, quikdown_yaml)

Convert markdown to structured data formats for programmatic manipulation:

```javascript
import quikdown_ast from 'quikdown/ast';
import quikdown_json from 'quikdown/json';
import quikdown_yaml from 'quikdown/yaml';
import quikdown_ast_html from 'quikdown/ast-html';

const markdown = '# Hello\n\nWorld **bold**';

// Markdown → AST object
const ast = quikdown_ast(markdown);

// Markdown → JSON string
const json = quikdown_json(markdown);

// Markdown → YAML string
const yaml = quikdown_yaml(markdown);

// AST/JSON/YAML → HTML
const html = quikdown_ast_html(ast);  // or pass json/yaml string
```

The AST parsers are "forgiving" - they handle malformed markdown gracefully without throwing errors. See [AST Documentation](docs/quikdown-ast.md) for the complete node type reference.

**Note:** The editor automatically lazy-loads plugin libraries from CDNs when needed:
- **highlight.js** - Loaded when code blocks are encountered and `highlightjs: true`
- **mermaid** - Loaded when mermaid diagrams are found and `mermaid: true`
- **DOMPurify** - Loaded when HTML fence blocks are rendered
- **KaTeX** - Loaded when math/tex fence blocks are encountered

This keeps the initial bundle small while providing rich functionality on-demand.

## Other Configuration Options
quikdown supports built-in styles for a "batteries included" experience or you can bring your own CSS themes.  Example css files are provided for basic light and dark themes to get started.

```javascript
const html = quikdown(markdown, {
  lazy_linefeeds: true,    // Single newlines become <br>
  inline_styles: false,    // Use class based CSS instead of inline styles
  fence_plugin: {          // Custom code block processor (v1.1.0+ API)
    render: myHandler      // Function to render fence blocks
  }
});
```

### Styling Options

**Inline styles:** All formatting uses inline CSS
```javascript
quikdown('**bold**', { inline_styles: true });
// <strong style="font-weight: bold;">bold</strong>
```

**Class-based styling:** Uses CSS classes (default)
```javascript
quikdown('**bold**');
// <strong>bold</strong>
// Requires CSS: .quikdown strong { font-weight: bold; }
// see included dist/quikdown.light.css or quikdown.dark.css
```

### Fence Plugins

Quikdown provides a callback for all fenced text such as code blocks, math, svg etc.

Handle code blocks with custom languages:

```javascript
const fencePlugin = {
  render: (code, language) => {
    if (language === 'mermaid') {
      // Process with mermaid library and return rendered diagram
      const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
      setTimeout(() => mermaid.render(id + '-svg', code).then(result => {
        document.getElementById(id).innerHTML = result.svg;
      }), 0);
      return `<div id="${id}" class="mermaid">Loading diagram...</div>`;
    }
    // Return undefined for default handling
  }
};

const html = quikdown(markdown, { fence_plugin: fencePlugin });
```


## TypeScript Support

quikdown includes TypeScript definitions for better IDE support and type safety:

```typescript
import quikdown, { QuikdownOptions, FencePlugin } from 'quikdown';

const fencePlugin: FencePlugin = {
  render: (content: string, language: string) => {
    return `<pre class="hljs ${language}">${content}</pre>`;
  }
};

const options: QuikdownOptions = {
  inline_styles: true,
  fence_plugin: fencePlugin
};

const html: string = quikdown(markdown, options);
```

## Supported Markdown

**Text formatting:** `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``

**Headings:** `# H1` through `###### H6`

**Lists:**

- Unordered lists  
1. Ordered lists  
- [x] Task lists  

**Links:** `[text](url)` and automatic URL detection

**Code blocks:**  

```javascript
console.log('syntax highlighting support via plugins');
```

**Tables, blockquotes, horizontal rules** - See [documentation](docs/) for complete syntax reference

## API Reference

For complete API documentation, see [docs/api-reference.md](docs/api-reference.md)

## Security

All HTML is escaped by default. Only safe markdown constructs become HTML:

```javascript
const unsafe = '<script>alert("XSS")</script> **bold**';
const safe = quikdown(unsafe);
// &lt;script&gt;alert("XSS")&lt;/script&gt; <strong>bold</strong>
```

**Static analysis** — quikdown passes ESLint with [eslint-plugin-security](https://www.npmjs.com/package/eslint-plugin-security) at error level with zero findings. All regex patterns are verified free of catastrophic backtracking (ReDoS), and no dynamic `RegExp` construction is used. Security lint is enforced in CI on every build.

For the full security model, see [docs/security.md](docs/security.md).

## Framework Integration

Works with React, Vue, Svelte, Angular. See [Framework Integration Guide](docs/framework-integration.md) for examples.

## Limitations

For size and security, quikdown doesn't support:
- Reference-style links  
- Footnotes
- Definition lists

Note that raw html, svg, etc can be rendered using appropriate fences
```html
<h1>My HTML Content</h1>
<p>Some HTML</p>
```
as long as an appropriate fence plugin is provided.  See API docs for example or try out in quikdown_edit.js which has built-in support for HTML with XSS prevention.

## License

BSD 2-Clause - see [LICENSE.txt](LICENSE.txt)

## Acknowledgments

- Inspired by the simplicity of early markdown parsers
- Built for the [QuikChat](https://github.com/deftio/quikchat) project
- CommonMark spec for markdown standardization


## Support

- 📖 [Documentation](docs/)
- 🐛 [Issues](https://github.com/deftio/quikdown/issues)
- 📦 [Examples](examples/)  

