# API Reference

## Core Function

### `quikdown(markdown, options?)`

Converts markdown text to HTML.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | `string` | Yes | The markdown text to convert |
| `options` | `object` | No | Configuration options |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `inline_styles` | `boolean` | `false` | Use inline styles instead of CSS classes |
| `fence_plugin` | `function` | `undefined` | Custom handler for fenced code blocks |
| `bidirectional` | `boolean` | `false` | Add data-qd attributes for source tracking (v1.0.5+) |
| `allow_unsafe_urls` | `boolean` | `false` | Allow javascript: and other potentially unsafe URLs |

#### Returns

`string` - The converted HTML

#### Example

```javascript
import quikdown from 'quikdown';

const markdown = '# Hello World\n\nThis is **bold** text.';
const html = quikdown(markdown);
console.log(html);
// <h1 class="quikdown-h1">Hello World</h1><p>This is <strong class="quikdown-strong">bold</strong> text.</p>
```

## Configuration Methods

### `quikdown.configure(options)`

Creates a pre-configured parser function with default options.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `object` | Yes | Default configuration options |

#### Returns

`function` - A configured parser function

#### Example

```javascript
const myParser = quikdown.configure({
  inline_styles: true,
  fence_plugin: myPlugin
});

// Use the configured parser
const html = myParser('# Heading');
// No need to pass options each time
```

## Style Methods

### `quikdown.emitStyles(prefix?, theme?)`

Returns CSS styles for quikdown HTML output when not using inline styles.

#### Parameters

- `prefix` (string, optional) - CSS class prefix. Default: `'quikdown-'`
- `theme` (string, optional) - Theme name: `'light'` (default) or `'dark'`

#### Returns

`string` - CSS stylesheet content with theme-appropriate colors

#### Example

```javascript
// Generate light theme CSS
const lightStyles = quikdown.emitStyles('quikdown-', 'light');

// Generate dark theme CSS  
const darkStyles = quikdown.emitStyles('quikdown-', 'dark');

// Add to your page
const styleElement = document.createElement('style');
styleElement.textContent = lightStyles;
document.head.appendChild(styleElement);

// Or use pre-generated theme files
// dist/quikdown.light.css - Light theme with explicit colors
// dist/quikdown.dark.css - Dark theme with auto dark mode support
```

#### Theme Features

- **Container-based scoping**: Use `.quikdown-light` or `.quikdown-dark` containers
- **Explicit colors**: Both themes specify text colors for robustness
- **Auto dark mode**: Dark CSS includes `.quikdown-auto` for system preferences
- **No conflicts**: Multiple themes can coexist on the same page

#### Generated CSS Classes

```css
.quikdown-h1 { margin-top: 0.5em; margin-bottom: 0.3em }
.quikdown-h2 { margin-top: 0.5em; margin-bottom: 0.3em }
.quikdown-h3 { margin-top: 0.5em; margin-bottom: 0.3em }
.quikdown-h4 { margin-top: 0.5em; margin-bottom: 0.3em }
.quikdown-h5 { margin-top: 0.5em; margin-bottom: 0.3em }
.quikdown-h6 { margin-top: 0.5em; margin-bottom: 0.3em }
.quikdown-pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto }
.quikdown-code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px }
.quikdown-blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666 }
.quikdown-table { border-collapse: collapse; width: 100%; margin: 1em 0 }
.quikdown-th { border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; font-weight: bold }
.quikdown-td { border: 1px solid #ddd; padding: 8px; text-align: left }
.quikdown-hr { border: none; border-top: 1px solid #ddd; margin: 1em 0 }
.quikdown-img { max-width: 100%; height: auto }
.quikdown-a { color: #0066cc; text-decoration: underline }
.quikdown-strong { font-weight: bold }
.quikdown-em { font-style: italic }
.quikdown-del { text-decoration: line-through }
.quikdown-ul { margin: 0.5em 0; padding-left: 2em }
.quikdown-ol { margin: 0.5em 0; padding-left: 2em }
.quikdown-li { margin: 0.25em 0 }
```

## Properties

### `quikdown.version`

The version of quikdown.

#### Type

`string`

#### Example

```javascript
console.log(quikdown.version); // "2.0"
```

## Fence Plugin API

### Plugin Function Signature

```typescript
type FencePlugin = (
  content: string,
  language: string
) => string | undefined;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `string` | Raw, unescaped content of the code block |
| `language` | `string` | Language identifier (empty string if none) |

#### Returns

- `string` - HTML to render
- `undefined` - Use default code block rendering

#### Example

```javascript
function syntaxHighlightPlugin(content, language) {
  if (language && hljs.getLanguage(language)) {
    const highlighted = hljs.highlight(content, { language }).value;
    return `<pre class="hljs"><code class="language-${language}">${highlighted}</code></pre>`;
  }
  // Return undefined to use default rendering
  return undefined;
}

const html = quikdown(markdown, {
  fence_plugin: syntaxHighlightPlugin
});
```

### Plugin Examples

#### Mermaid Diagrams

```javascript
function mermaidPlugin(content, language) {
  if (language === 'mermaid') {
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    // Render asynchronously after DOM insertion
    setTimeout(() => {
      mermaid.render(id + '-svg', content).then(result => {
        document.getElementById(id).innerHTML = result.svg;
      });
    }, 0);
    return `<div id="${id}" class="mermaid-diagram">Loading...</div>`;
  }
}
```

#### Math Rendering

```javascript
function mathPlugin(content, language) {
  if (language === 'math' || language === 'latex') {
    return katex.renderToString(content, {
      throwOnError: false,
      displayMode: true
    });
  }
}
```

#### Custom Components

```javascript
function componentPlugin(content, language) {
  if (language === 'component') {
    try {
      const config = JSON.parse(content);
      return renderComponent(config);
    } catch (e) {
      return `<div class="error">Invalid component: ${e.message}</div>`;
    }
  }
}
```

#### Trusted HTML

```javascript
function trustedHtmlPlugin(content, language) {
  // Only allow from trusted sources!
  if (language === 'html-render' && isTrustedSource()) {
    return content; // Raw HTML - be careful!
  }
}
```

## Options Deep Dive

### `bidirectional` Option

Enables preservation of original markdown syntax for HTML→Markdown conversion.

#### `bidirectional: false` (Default)

Standard HTML output without preservation attributes:

```javascript
quikdown('**bold**', { bidirectional: false });
// Output: <strong class="quikdown-strong">bold</strong>
```

#### `bidirectional: true`

Adds `data-qd` attributes to preserve original markdown:

```javascript
quikdown('**bold**', { bidirectional: true });
// Output: <strong class="quikdown-strong" data-qd="**">bold</strong>
```

**Use when:**
- Building a markdown editor
- Need HTML→Markdown conversion
- Want to preserve exact markdown syntax
- Using with `quikdown_bd` module

### `inline_styles` Option

Controls how styling is applied to generated HTML.

#### `inline_styles: false` (Default)

Generates HTML with CSS classes:

```javascript
quikdown('**bold**', { inline_styles: false });
// Output: <strong class="quikdown-strong">bold</strong>
```

**Use when:**
- You have a stylesheet
- You want consistent styling
- You need to override styles
- Page has multiple quikdown instances

#### `inline_styles: true`

Generates HTML with inline styles:

```javascript
quikdown('**bold**', { inline_styles: true });
// Output: <strong style="font-weight: bold">bold</strong>
```

**Use when:**
- Rendering in emails
- No stylesheet access
- Isolated components
- Quick prototypes

## Supported Markdown

### Block Elements

| Element | Syntax | Example |
|---------|--------|---------|
| Heading 1-6 | `#` to `######` | `# Heading` |
| Paragraph | Double newline | `Text\n\nText` |
| Blockquote | `>` prefix | `> Quote` |
| Code Block | Triple backticks | ` ```js\ncode\n``` ` |
| Horizontal Rule | Three+ hyphens | `---` |
| Unordered List | `-`, `*`, or `+` | `- Item` |
| Ordered List | `1.`, `2.`, etc. | `1. Item` |
| Table | Pipes and hyphens | `\|A\|B\|` |

### Inline Elements

| Element | Syntax | Example |
|---------|--------|---------|
| Bold | `**` or `__` | `**bold**` |
| Italic | `*` or `_` | `*italic*` |
| Strikethrough | `~~` | `~~strike~~` |
| Code | Single backtick | `` `code` `` |
| Link | `[text](url)` | `[Google](https://google.com)` |
| Image | `![alt](url)` | `![Logo](logo.png)` |
| Line Break | Two spaces + newline | `Line  \nBreak` |

## Error Handling

quikdown is designed to be forgiving and never throw errors:

| Input | Result |
|-------|--------|
| `null` | `""` (empty string) |
| `undefined` | `""` (empty string) |
| Non-string | `""` (empty string) |
| Malformed markdown | Best-effort HTML |
| Unclosed fence | Treated as regular text |
| Invalid table | Rendered as plain text |

## Performance Tips

### 1. Reuse Configured Parsers

```javascript
// ❌ Inefficient - options object created each time
for (const msg of messages) {
  html += quikdown(msg, { inline_styles: true });
}

// ✅ Efficient - reuse configured parser
const parser = quikdown.configure({ inline_styles: true });
for (const msg of messages) {
  html += parser(msg);
}
```

### 2. Cache Styles

```javascript
// ❌ Generates styles repeatedly
function render() {
  return quikdown.emitStyles() + content;
}

// ✅ Generate once
const styles = quikdown.emitStyles();
function render() {
  return styles + content;
}
```

### 3. Batch Small Documents

```javascript
// ❌ Many small parses
messages.forEach(msg => {
  container.innerHTML += quikdown(msg);
});

// ✅ Single parse
const combined = messages.join('\n\n---\n\n');
container.innerHTML = quikdown(combined);
```

## Browser Compatibility

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 61+ | Full support |
| Firefox | 60+ | Full support |
| Safari | 12+ | Full support |
| Edge | 79+ | Full support |
| IE | ❌ | Not supported |

## Node.js Compatibility

| Version | Support |
|---------|---------|
| 14.x | ✅ Full |
| 16.x | ✅ Full |
| 18.x | ✅ Full |
| 20.x | ✅ Full |

## Module Comparison

| Feature | `quikdown` | `quikdown_bd` |
|---------|------------|---------------|
| Markdown to HTML | ✅ Yes | ✅ Yes |
| HTML to Markdown | ❌ No | ✅ Yes |
| Size (minified) | 7.4KB | 10KB |
| `toMarkdown()` method | ❌ No | ✅ Yes |
| data-qd attributes | ❌ No | ✅ Yes |
| Use case | Standard parsing | WYSIWYG editors |

## Bidirectional API

**⚠️ Important:** These methods are only available in the `quikdown_bd` module, NOT in regular `quikdown`.

### `quikdown_bd(markdown, options?)`

Converts markdown to HTML with source tracking for bidirectional conversion. Only available when using `quikdown_bd`.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | `string` | Yes | The markdown text to convert |
| `options` | `object` | No | Configuration options |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `inline_styles` | `boolean` | `false` | Use inline styles instead of CSS classes |
| `fence_plugin` | `function` | `undefined` | Custom handler for fenced code blocks |
| `bidirectional` | `boolean` | `true` | Add data-qd attributes for source tracking |

#### Returns

`string` - HTML with data-qd attributes for source tracking

#### Example

```javascript
import quikdown_bd from 'quikdown/bd';

const markdown = '**Hello** world';
const html = quikdown_bd(markdown, { bidirectional: true });
console.log(html);
// <strong data-qd="**" class="quikdown-strong">Hello</strong> world
```

### `quikdown_bd.toMarkdown(htmlOrElement)`

Converts HTML back to Markdown using DOM walking and data-qd attributes.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `htmlOrElement` | `string \| HTMLElement` | Yes | HTML string or DOM element to convert |

#### Returns

`string` - The reconstructed Markdown

#### Example

```javascript
// From HTML string
const markdown = quikdown_bd.toMarkdown('<strong>bold</strong>');
console.log(markdown); // **bold**

// From DOM element
const element = document.getElementById('content');
const markdown = quikdown_bd.toMarkdown(element);
```

#### Browser Requirement

`toMarkdown` requires a DOM environment. In Node.js, use a library like jsdom:

```javascript
const { JSDOM } = require('jsdom');
const dom = new JSDOM();
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
```

### `quikdown_bd.configure(options)`

Creates a pre-configured bidirectional parser with default options.

#### Example

```javascript
const myParser = quikdown_bd.configure({
  inline_styles: true,
  bidirectional: true
});

const html = myParser(markdown);
```

### `quikdown_bd.emitStyles(prefix?, theme?)`

Returns CSS styles for bidirectional HTML output (currently returns empty string, reserved for future use).

### `quikdown_bd.version`

Returns the version string of the quikdown_bd module.

## Module Formats

quikdown is distributed in multiple formats:

### Core Module

| Format | File | Usage |
|--------|------|-------|
| UMD | `dist/quikdown.umd.js` | Browser script tag |
| UMD minified | `dist/quikdown.umd.min.js` | Production browser |
| ESM | `dist/quikdown.esm.js` | ES6 imports |
| ESM minified | `dist/quikdown.esm.min.js` | Production ES6 |
| CommonJS | `dist/quikdown.cjs` | Node.js require() |

### Bidirectional Module

| Format | File | Usage |
|--------|------|-------|
| UMD | `dist/quikdown_bd.umd.js` | Browser script tag |
| UMD minified | `dist/quikdown_bd.umd.min.js` | Production browser |
| ESM | `dist/quikdown_bd.esm.js` | ES6 imports |
| ESM minified | `dist/quikdown_bd.esm.min.js` | Production ES6 |
| CommonJS | `dist/quikdown_bd.cjs` | Node.js require() |

## TypeScript

TypeScript definitions are included for both modules:

```typescript
declare module 'quikdown' {
  interface QuikdownOptions {
    inline_styles?: boolean;
    fence_plugin?: (content: string, language: string) => string | undefined;
  }
  
  interface QuikdownFunction {
    (markdown: string, options?: QuikdownOptions): string;
    configure(options: QuikdownOptions): (markdown: string) => string;
    emitStyles(prefix?: string, theme?: 'light' | 'dark'): string;
    version: string;
  }
  
  const quikdown: QuikdownFunction;
  export default quikdown;
}
```