# quikdown

[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage Status](https://img.shields.io/badge/coverage-99%25-blue.svg)](https://github.com/deftio/quikdown)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/badge/core-7.4KB-blue.svg)](https://github.com/deftio/quikdown/tree/main/dist)
[![Bundle Size BD](https://img.shields.io/badge/bidirectional-10KB-blue.svg)](https://github.com/deftio/quikdown/tree/main/dist)

A lightweight, fast markdown parser with built-in XSS protection and optional bidirectional conversion support. Quikdown works in both browser and Node.js environments. Via its fenced plug-in support it can support highlighted code blocks, diagrams, and other custom fenced content.

🚀 **[Try Live Demo](https://deftio.github.io/quikdown/examples/quikdown-live.html)** - Interactive markdown ot HTML editor with real-time preview 
🚀 **[Try Bidirectional Demo](https://deftio.github.io/quikdown/examples/quikdown-bd-editor.html)** - Interactive markdown editor with bidirectional support (can edit either markdown or html and see other update)
📚 **[View Examples](examples/)** - Additional demos and test pages  
📖 **[Read Documentation](docs/)** - Architecture, security, API reference, and plugin guide

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Bidirectional Conversion](#bidirectional-conversion-new)
- [Supported Markdown](#supported-markdown)
- [Configuration Options](#configuration-options)
- [Plugin System](#plugin-system)
- [Framework Integration](#framework-integration)
- [API Reference](#api-reference)
- [Security](#security)
- [Contributing](#contributing)

## Features

- 📦 **Zero dependencies** - No external libraries required
- 🌐 **Universal** - Works in browsers and Node.js
- 🚀 **Lightweight** - 7.4KB minified (core), 10KB with bidirectional support
- 🔒 **Secure by default** - Built-in XSS protection with URL sanitization
- 🎨 **Flexible styling** - Inline styles or CSS classes including light and dark mode generation, custom themes
- 🔌 **Plugin system** - Extensible fence block handlers
- ⚡ **Fast** - Optimized regex-based parsing
- 📝 **CommonMark subset** - Supports essential markdown features
- ✅ **Task Lists** - GitHub-style checkboxes
- 🔗 **Autolinks** - Automatic URL detection
- 🔄 **Bidirectional** - Convert HTML back to Markdown (requires `quikdown_bd` module) 

## Installation

```bash
npm install quikdown
```

Or via CDN:

**ES Modules (recommended for modern applications):**
```html
<script type="module">
  import quikdown from 'https://unpkg.com/quikdown/dist/quikdown.esm.min.js';
  
  const html = quikdown('# Hello World');
  document.body.innerHTML = html;
</script>
```

**UMD (for legacy browser support):**
```html
<script src="https://unpkg.com/quikdown/dist/quikdown.umd.min.js"></script>
<script>
  // Available as window.quikdown
  const html = quikdown('# Hello World');
</script>
```

> **Production tip:** Pin to a specific version for stability (e.g., `https://unpkg.com/quikdown@1.0.4/dist/quikdown.esm.min.js`)

### Complete CDN Example

See our [complete CDN demo](examples/quikdown-cdn-demo.html) that includes QuikDown with Highlight.js and Mermaid - all loaded from CDN. Perfect for copying as a starting template!

## Quick Start

### Basic Usage (Standard - One-way conversion)

```javascript
import quikdown from 'quikdown';

const markdown = '# Hello World\n\nThis is **bold** text.';
const html = quikdown(markdown);
console.log(html);
// Output: <h1>Hello World</h1><p>This is <strong>bold</strong> text.</p>

// Note: Regular quikdown does NOT support HTML to Markdown conversion
```

### Bidirectional Usage (Two-way conversion)

```javascript
// Use quikdown_bd for bidirectional support
import quikdown_bd from 'quikdown/bd';

const markdown = '# Hello World\n\nThis is **bold** text.';

// Markdown to HTML
const html = quikdown_bd(markdown);

// HTML back to Markdown (only available in quikdown_bd)
const recoveredMarkdown = quikdown_bd.toMarkdown(html);
console.log(recoveredMarkdown);
// Output: # Hello World\n\nThis is **bold** text.
```

### With Options

```javascript
const html = quikdown(markdown, {
    inline_styles: true,  // Use inline styles instead of classes
    fence_plugin: myFenceHandler  // Custom code fence handler
});
```

### TypeScript Support

quikdown includes TypeScript definitions for better IDE support and type safety:

```typescript
import quikdown, { QuikdownOptions } from 'quikdown';

const options: QuikdownOptions = {
    inline_styles: true,
    fence_plugin: (content: string, language: string) => {
        return `<pre class="hljs ${language}">${content}</pre>`;
    }
};

const html: string = quikdown(markdown, options);
```

## Supported Markdown

quikdown supports a practical subset of CommonMark:

### Text Formatting
- **Bold**: `**text**` or `__text__`
- *Italic*: `*text*` or `_text_`
- ~~Strikethrough~~: `~~text~~`
- `Code`: `` `code` ``

### Headings
```markdown
# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading
```

### Lists

Unordered:
```markdown
- Item 1
- Item 2
  - Nested item
* Also works with asterisks
```

Ordered:
```markdown
1. First item
2. Second item
   1. Nested item
```

Task Lists:
```markdown
- [x] Completed task
- [ ] Pending task
- [ ] Another todo
```

### Links and Images
```markdown
[Link text](https://example.com)
![Alt text](image.jpg)

// Autolinks - URLs are automatically linked
Visit https://github.com for more info
```

### Code Blocks
````markdown
```javascript
console.log('Hello, world!');
```

// Also supports ~~~ fences
~~~python
print("Hello, world!")
~~~
````

### Tables
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
```

### Other Elements
- **Blockquotes**: `> Quote text`
- **Horizontal rules**: `---` or `***` or `___`
- **Line breaks**: Two spaces at end of line or `<br>`

## Configuration Options

### `inline_styles` (boolean)
When `true`, uses inline styles for formatting. When `false`, uses CSS classes.

```javascript
// With inline_styles: true
quikdown('**bold**', { inline_styles: true });
// Output: <strong style="font-weight: bold;">bold</strong>

// With inline_styles: false (default)
quikdown('**bold**', { inline_styles: false });
// Output: <strong>bold</strong>
```

### `fence_plugin` (function)
Custom handler for fenced code blocks. Useful for syntax highlighting or diagrams.

```javascript
function fencePlugin(code, language) {
    if (language === 'mermaid') {
        return `<div class="mermaid">${code}</div>`;
    }
    // Return undefined to use default handling
}

const html = quikdown(markdown, { fence_plugin: fencePlugin });
```

## Plugin System

For a complete plugin development guide, see [docs/plugin-guide.md](docs/plugin-guide.md)

### Creating a Fence Plugin

Fence plugins allow you to customize how code blocks are rendered:

```javascript
function myFencePlugin(code, language) {
    // Handle specific languages
    if (language === 'graph') {
        return renderGraph(code);
    }
    
    // Add syntax highlighting
    if (language && hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(code, { language }).value;
        return `<pre><code class="language-${language}">${highlighted}</code></pre>`;
    }
    
    // Return undefined for default handling
    return undefined;
}
```

### Example: Mermaid Diagrams

```javascript
function mermaidPlugin(code, language) {
    if (language === 'mermaid') {
        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
        // Render with mermaid.js after DOM update
        setTimeout(() => {
            mermaid.render(id + '-svg', code).then(result => {
                document.getElementById(id).innerHTML = result.svg;
            });
        }, 0);
        return `<div id="${id}" class="mermaid">Loading diagram...</div>`;
    }
}

const html = quikdown(markdownWithMermaid, { 
    fence_plugin: mermaidPlugin 
});
```

## Security

For detailed security information, see [docs/security.md](docs/security.md)

quikdown includes built-in XSS protection:

- All HTML tags in markdown are escaped by default
- Attributes are sanitized
- JavaScript URLs are blocked
- Only safe markdown constructs are converted to HTML

```javascript
const unsafe = '<script>alert("XSS")</script> **bold**';
const safe = quikdown(unsafe);
// Output: &lt;script&gt;alert("XSS")&lt;/script&gt; <strong>bold</strong>
```

## Bidirectional Conversion (1.0.4+)

**⚠️ Important:** Full bidirectional conversion (including HTML-to-Markdown) requires the `quikdown_bd` module, not the regular `quikdown` module.

The `quikdown_bd` module is a separate build that includes both markdown-to-HTML and HTML-to-markdown conversion capabilities. It's perfect for WYSIWYG editors and round-trip conversion scenarios.

**New in v1.0.5:** The core `quikdown` module now supports the `bidirectional` option to emit `data-qd` attributes, but only `quikdown_bd` includes the `toMarkdown()` function for converting HTML back to Markdown.

### Installation

```javascript
// ES Modules - Use quikdown_bd, NOT quikdown
import quikdown_bd from 'quikdown/bd';

// CommonJS - Use quikdown_bd, NOT quikdown
const quikdown_bd = require('quikdown/bd');

// Browser - Load the quikdown_bd script, NOT the regular quikdown
<script src="https://unpkg.com/quikdown/dist/quikdown_bd.umd.min.js"></script>
<script>
  // Available as window.quikdown_bd
  const html = quikdown_bd(markdown);
</script>
```

### Basic Usage

```javascript
// IMPORTANT: Use quikdown_bd for bidirectional support
import quikdown_bd from 'quikdown/bd';

// Markdown to HTML with source tracking (bidirectional is automatic)
const html = quikdown_bd('**Hello** world');
console.log(html);
// <strong data-qd="**">Hello</strong> world

// HTML back to Markdown (only available in quikdown_bd)
const markdown = quikdown_bd.toMarkdown(html);
console.log(markdown);
// **Hello** world

// Note: Regular quikdown does NOT have toMarkdown method
// This will fail: quikdown.toMarkdown(html) // ❌ Error
```

### Use Cases

- **Live Editors**: Build WYSIWYG markdown editors where users can edit in either view
- **Content Migration**: Convert existing HTML content to Markdown
- **Round-trip Preservation**: Maintain markdown source formatting through HTML conversion
- **Collaborative Editing**: Enable rich-text editing while storing content as Markdown

### Browser Example

```html
<div id="editor" contenteditable="true"></div>
<script type="module">
  import quikdown_bd from 'https://unpkg.com/quikdown/dist/quikdown_bd.esm.min.js';
  
  const editor = document.getElementById('editor');
  const markdown = '# Edit me\n\n**Bold** and *italic*';
  
  // Convert to HTML and display
  editor.innerHTML = quikdown_bd(markdown, { bidirectional: true });
  
  // Convert back to Markdown when needed
  editor.addEventListener('blur', () => {
    const updatedMarkdown = quikdown_bd.toMarkdown(editor);
    console.log('Updated markdown:', updatedMarkdown);
  });
</script>
```

For complete documentation, see [Bidirectional Documentation](docs/quikdown-bidirectional.md).

## Quikdown Lexer Version

An experimental lexer-based implementation is available for testing. See [docs/lexer-implementation.md](docs/lexer-implementation.md) for details.


## Framework Integration

quikdown integrates seamlessly with modern JavaScript frameworks:

- **React** - Hooks, components, and Next.js support
- **Vue** - Composition API, Options API, and Nuxt support  
- **Svelte** - Reactive statements and stores
- **Angular** - Components, services, and pipes

See the [Framework Integration Guide](docs/framework-integration.md) for detailed examples and best practices.

## API Reference

For complete API documentation, see [docs/api-reference.md](docs/api-reference.md)

### Core API

#### `quikdown(markdown, options?)`

Main function to convert markdown to HTML.

**Parameters:**
- `markdown` (string): The markdown text to convert
- `options` (object, optional):
  - `inline_styles` (boolean): Use inline styles instead of classes
  - `fence_plugin` (function): Custom fence block handler

**Returns:** HTML string

#### `quikdown.configure(options)`

Creates a configured instance of the parser.

```javascript
const myParser = quikdown.configure({
    inline_styles: true,
    fence_plugin: myPlugin
});

// Use the configured parser
const html = myParser(markdown);
```

#### `quikdown.emitStyles(prefix?, theme?)`

Returns CSS styles for quikdown HTML output when not using inline styles.

```javascript
// Get light theme CSS
const lightStyles = quikdown.emitStyles();

// Get dark theme CSS  
const darkStyles = quikdown.emitStyles('quikdown-', 'dark');
```

### Bidirectional API

**⚠️ These methods are only available in `quikdown_bd`, not in regular `quikdown`:**

#### `quikdown_bd(markdown, options?)`

Converts markdown to HTML with source tracking for bidirectional conversion.

#### `quikdown_bd.toMarkdown(htmlOrElement)`

Converts HTML back to Markdown. **This method only exists in `quikdown_bd`.**

**Parameters:**
- `htmlOrElement` (string | HTMLElement): HTML string or DOM element

**Returns:** Markdown string

```javascript
// ✅ Correct - using quikdown_bd
import quikdown_bd from 'quikdown/bd';
const markdown = quikdown_bd.toMarkdown(html);

// ❌ Wrong - regular quikdown doesn't have toMarkdown
import quikdown from 'quikdown';
const markdown = quikdown.toMarkdown(html); // Error: toMarkdown is not a function
```

See [API Reference](docs/api-reference.md) for complete documentation.

## Theming

QuikDown supports flexible theming through container-based CSS scoping:

### Using Pre-built Themes

```html
<!-- Load theme CSS files -->
<link rel="stylesheet" href="quikdown.light.css">
<link rel="stylesheet" href="quikdown.dark.css">

<!-- Apply themes via container classes -->
<div class="quikdown-light">
  <!-- Light themed content -->
</div>

<div class="quikdown-dark">
  <!-- Dark themed content -->
</div>
```

### Theme Architecture

- **Structural styles**: Shared across all themes (margins, padding, font-sizes)
- **Theme colors**: Scoped to container classes (`.quikdown-light`, `.quikdown-dark`)
- **No conflicts**: Multiple themes can coexist on the same page
- **No default theme**: Without a container class, only structural styles apply

### Inline Styles

For a batteries-included approach without CSS files:

```javascript
// Use inline styles (always light theme currently)
const html = quikdown(markdown, { inline_styles: true });
```

## Browser Usage

### ES Modules (Recommended)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body>
    <div id="output"></div>
    <script type="module">
        import quikdown from 'https://unpkg.com/quikdown/dist/quikdown.esm.min.js';
        
        const markdown = '# Hello quikdown!\n\nSupports **bold** and *italic* text.';
        const html = quikdown(markdown, { inline_styles: true });
        document.getElementById('output').innerHTML = html;
    </script>
</body>
</html>
```

### UMD Script Tag (Legacy)

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/quikdown/dist/quikdown.umd.min.js"></script>
</head>
<body>
    <div id="output"></div>
    <script>
        const markdown = '# Hello quikdown!';
        const html = quikdown(markdown, { inline_styles: true });
        document.getElementById('output').innerHTML = html;
    </script>
</body>
</html>
```

## Node.js Usage

```javascript
const quikdown = require('quikdown');

const markdown = '# Server-side Markdown';
const html = quikdown(markdown);

// Use in Express, etc.
res.send(html);
```

## Performance

quikdown is optimized for speed:

- Single-pass regex parsing
- Minimal memory allocation
- No AST generation
- Efficient string operations

Benchmarks show quikdown performs comparably to larger markdown parsers while maintaining a much smaller footprint.

## Limitations

quikdown intentionally doesn't support:

- HTML blocks (for security)
- Reference-style links
- Footnotes
- Definition lists
- Complex table alignment
- Nested blockquotes with different markers

These omissions keep the parser small, fast, and secure.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## License

BSD 2-Clause License - see [LICENSE.txt](LICENSE.txt) file for details.

## Acknowledgments

- Inspired by the simplicity of early markdown parsers
- Built for the [QuikChat](https://github.com/deftio/quikchat) project
- CommonMark spec for markdown standardization


Choose quikdown when you need:
- A lightweight solution
- Built-in security
- Simple plugin system
- Zero dependencies


## Support

- 🐛 Issues: [GitHub Issues](https://github.com/deftio/quikdown/issues)

