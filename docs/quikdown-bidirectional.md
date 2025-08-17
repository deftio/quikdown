# quikdown_bd - Bidirectional Markdown/HTML Conversion

## Overview

`quikdown_bd` is an extension of quikdown that provides bidirectional conversion between Markdown and HTML. It allows you to convert Markdown to HTML (like regular quikdown) and also convert the HTML back to Markdown, preserving the original structure and formatting.

## Installation

```bash
npm install quikdown
```

Then import the bidirectional module:

```javascript
// ES6 modules
import quikdown_bd from 'quikdown/bd';

// CommonJS
const quikdown_bd = require('quikdown/dist/quikdown_bd.cjs');

// Browser (UMD)
<script src="https://unpkg.com/quikdown/dist/quikdown_bd.umd.min.js"></script>
```

## Basic Usage

### Forward Conversion (Markdown → HTML)

```javascript
const markdown = '**Hello** *world*!';
const html = quikdown_bd(markdown);
// Output: <p><strong data-qd="**" class="quikdown-strong">Hello</strong> <em data-qd="*" class="quikdown-em">world</em>!</p>
```

### Reverse Conversion (HTML → Markdown)

```javascript
const html = '<p><strong>Hello</strong> <em>world</em>!</p>';
const markdown = quikdown_bd.toMarkdown(html);
// Output: **Hello** *world*!
```

### Round-trip Conversion

```javascript
const originalMarkdown = '# Heading\n\n**Bold** and *italic* text.';
const html = quikdown_bd(originalMarkdown);
const recoveredMarkdown = quikdown_bd.toMarkdown(html);
// recoveredMarkdown ≈ originalMarkdown
```

## Key Features

### Data Attributes for Source Tracking

quikdown_bd adds `data-qd` attributes to HTML elements to track the original Markdown syntax:

```javascript
quikdown_bd('**bold**')
// <strong data-qd="**" class="quikdown-strong">bold</strong>

quikdown_bd('~~strike~~')
// <del data-qd="~~" class="quikdown-del">strike</del>
```

### Supported Elements

All standard Markdown elements are supported for bidirectional conversion:

- **Text Formatting**: bold, italic, strikethrough, inline code
- **Headings**: H1-H6 with optional trailing #'s
- **Lists**: Ordered, unordered, nested lists, task lists
- **Links & Images**: With title attributes
- **Code Blocks**: Fenced with ``` or ~~~, with language specification
- **Tables**: With alignment support
- **Blockquotes**: Single and nested
- **Horizontal Rules**: ---

### Special Features

#### Task Lists
```javascript
const md = '- [ ] Unchecked\n- [x] Checked';
const html = quikdown_bd(md);
// Preserves checkbox state in round-trip conversion
```

#### Mermaid Diagrams
```javascript
const md = '```mermaid\ngraph TD\nA-->B\n```';
const html = quikdown_bd(md);
// Mermaid source is preserved for reverse conversion
```

## API Reference

### quikdown_bd(markdown, options)

Convert Markdown to HTML with bidirectional support.

**Parameters:**
- `markdown` (string): The Markdown source text
- `options` (object): Optional configuration
  - `fence_plugin` (function): Custom renderer for fenced code blocks
  - `inline_styles` (boolean): Use inline styles instead of CSS classes
  - `allow_unsafe_urls` (boolean): Allow potentially unsafe URLs

**Returns:** HTML string with data-qd attributes

### quikdown_bd.toMarkdown(htmlOrElement)

Convert HTML back to Markdown.

**Parameters:**
- `htmlOrElement` (string | HTMLElement): HTML string or DOM element

**Returns:** Markdown string

### quikdown_bd.emitStyles(prefix, theme)

Generate CSS styles for quikdown elements.

**Parameters:**
- `prefix` (string): CSS class prefix (default: 'quikdown-')
- `theme` (string): 'light' or 'dark' (default: 'light')

**Returns:** CSS string

### quikdown_bd.configure(options)

Create a configured parser with preset options.

**Parameters:**
- `options` (object): Configuration to apply to all parsing

**Returns:** Configured parser function

## Browser vs Node.js Usage

### Browser
```javascript
// Works natively in browsers with DOM support
const html = quikdown_bd('# Hello');
const markdown = quikdown_bd.toMarkdown(html);
```

### Node.js
```javascript
// Requires a DOM implementation for toMarkdown
const { JSDOM } = require('jsdom');
global.document = new JSDOM().window.document;

const html = quikdown_bd('# Hello');
const markdown = quikdown_bd.toMarkdown(html);
```

## Limitations

### What Works Well
- quikdown-generated HTML converts back perfectly
- Standard Markdown elements have high fidelity
- Nested structures are preserved
- Formatting preferences are maintained

### Known Limitations
1. **Custom HTML**: Non-quikdown HTML may not convert accurately
2. **Whitespace**: Some whitespace normalization occurs
3. **Mermaid**: Diagrams render but can't be edited as diagrams
4. **Complex Tables**: Very complex nested tables may lose formatting
5. **Inline HTML**: Raw HTML in Markdown is escaped for safety

### Not Suitable For
- General HTML to Markdown conversion
- Preserving custom CSS or JavaScript
- Converting from other Markdown parsers
- Maintaining exact byte-for-byte equality

## Performance

- **Bundle Size**: <11KB minified
- **Speed**: ~1000 documents/second on modern hardware
- **Memory**: Minimal overhead with DOM walking approach
- **Round-trip**: <5ms for typical documents

## Examples

### Live Editor
```javascript
// Create a live bidirectional editor
const editor = {
  markdown: document.getElementById('markdown-input'),
  html: document.getElementById('html-output'),
  
  updateHTML() {
    this.html.innerHTML = quikdown_bd(this.markdown.value);
  },
  
  updateMarkdown() {
    this.markdown.value = quikdown_bd.toMarkdown(this.html.innerHTML);
  }
};

// Two-way binding
editor.markdown.addEventListener('input', () => editor.updateHTML());
editor.html.addEventListener('input', () => editor.updateMarkdown());
```

### With Syntax Highlighting
```javascript
const options = {
  fence_plugin: (code, lang) => {
    if (lang && window.hljs) {
      const highlighted = hljs.highlight(code, { language: lang }).value;
      return `<pre><code class="language-${lang}">${highlighted}</code></pre>`;
    }
  }
};

const html = quikdown_bd(markdown, options);
```

## Migration from Regular quikdown

```javascript
// Before (one-way)
import quikdown from 'quikdown';
const html = quikdown(markdown);

// After (bidirectional)
import quikdown_bd from 'quikdown/bd';
const html = quikdown_bd(markdown);
const recoveredMarkdown = quikdown_bd.toMarkdown(html);
```

## Best Practices

1. **Use for quikdown content**: Best results with quikdown-generated HTML
2. **Preserve data attributes**: Don't remove data-qd attributes if you need reverse conversion
3. **Test round-trips**: Verify your content survives round-trip conversion
4. **Handle edge cases**: Plan for imperfect conversions with user-generated content
5. **Performance**: Use debouncing for live editors with large documents

## TypeScript Support

```typescript
import quikdown_bd from 'quikdown/bd';
import type { QuikdownBDOptions } from 'quikdown/bd';

const options: QuikdownBDOptions = {
  inline_styles: true,
  fence_plugin: (code: string, lang: string) => {
    return `<pre class="${lang}">${code}</pre>`;
  }
};

const html: string = quikdown_bd(markdown, options);
const md: string = quikdown_bd.toMarkdown(html);
```

## Version

quikdown_bd uses the same version as core quikdown: **1.0.4**

## License

BSD-2-Clause - Same as quikdown core