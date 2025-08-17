# quikdown

[![CI](https://github.com/deftio/quikdown/actions/workflows/ci.yml/badge.svg)](https://github.com/deftio/quikdown/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/quikdown.svg)](https://www.npmjs.com/package/quikdown)
[![Coverage Status](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)](https://github.com/deftio/quikdown)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](https://opensource.org/licenses/BSD-2-Clause)
[![Bundle Size](https://img.shields.io/badge/minified-<10KB-green.svg)](https://github.com/deftio/quikdown/tree/main/dist)

A lightweight, fast markdown parser with built-in XSS protection. Quikdown works in both browser and Node.js environments.  Via its fenced plug-in support it can support highlighted code blocks, diagrams, and other custom fenced content.

🚀 **[Try Live Demo](https://deftio.github.io/quikdown/examples/quikdown-live.html)** - Interactive markdown editor with real-time preview  
📚 **[View Examples](examples/)** - Additional demos and test pages  
📖 **[Read Documentation](docs/)** - Architecture, security, API reference, and plugin guide

## Features

- 🚀 **Lightweight** - Under 10KB minified
- 🔒 **Secure by default** - Built-in XSS protection with URL sanitization
- 🎨 **Flexible styling** - Inline styles or CSS classes including examples for light and dark mode generation
- 🔌 **Plugin system** - Extensible fence block handlers
- 📦 **Zero dependencies** - No external libraries required
- 🌐 **Universal** - Works in browsers and Node.js
- ⚡ **Fast** - Optimized regex-based parsing
- 📝 **CommonMark subset** - Supports essential markdown features
- ✅ **Task Lists** - GitHub-style checkboxes
- 🔗 **Autolinks** - Automatic URL detection

## Installation

```bash
npm install quikdown
```

Or via CDN:
```html
<script src="https://unpkg.com/quikdown/dist/quikdown.umd.js"></script>
```

## Quick Start

### Basic Usage

```javascript
import quikdown from 'quikdown';

const markdown = '# Hello World\n\nThis is **bold** text.';
const html = quikdown(markdown);
console.log(html);
// Output: <h1>Hello World</h1><p>This is <strong>bold</strong> text.</p>
```

### With Options

```javascript
const html = quikdown(markdown, {
    inline_styles: true,  // Use inline styles instead of classes
    fence_plugin: myFenceHandler  // Custom code fence handler
});
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

## API Reference

For complete API documentation, see [docs/api-reference.md](docs/api-reference.md)

### `quikdown(markdown, options?)`

Main function to convert markdown to HTML.

**Parameters:**
- `markdown` (string): The markdown text to convert
- `options` (object, optional):
  - `inline_styles` (boolean): Use inline styles instead of classes
  - `fence_plugin` (function): Custom fence block handler

**Returns:** HTML string

### `quikdown.configure(options)`

Creates a configured instance of the parser.

```javascript
const myParser = quikdown.configure({
    inline_styles: true,
    fence_plugin: myPlugin
});

// Use the configured parser
const html = myParser(markdown);
```

### `quikdown.emitStyles()`

Returns CSS styles for quikdown HTML output when not using inline styles.

```javascript
const styles = quikdown.emitStyles();
// Add to your stylesheet or <style> tag
```

## Browser Usage

### Via Script Tag

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/quikdown/dist/quikdown.umd.js"></script>
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

### ES Modules

```javascript
import quikdown from 'quikdown';

const html = quikdown('**Hello** world!');
document.body.innerHTML = html;
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

