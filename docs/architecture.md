# quikdown Architecture

## Design Philosophy

quikdown is designed with these core principles:

1. **Small & Fast** - Optimized for size (~3KB minified) and performance
2. **Secure by Default** - All HTML is escaped unless explicitly trusted
3. **Zero Dependencies** - No external libraries required
4. **Extensible** - Plugin system for custom rendering
5. **Practical** - Focused on the markdown subset actually used in chat/LLM outputs

## Parser Architecture

### Overview

quikdown uses a multi-phase regex-based parser that prioritizes safety and simplicity:

```
Input Markdown
    ↓
Phase 1: Extract & Protect (Code blocks, inline code)
    ↓
Phase 2: Escape HTML (XSS protection)
    ↓
Phase 3: Process Block Elements (Tables, headings, lists)
    ↓
Phase 4: Process Inline Elements (Bold, italic, links)
    ↓
Phase 5: Create Paragraphs
    ↓
Phase 6: Restore Protected Content
    ↓
Output HTML
```

### Phase 1: Extract & Protect

Before any processing, we extract code blocks and inline code, replacing them with placeholders:

- **Fenced code blocks** → `%%%CODEBLOCK0%%%`, `%%%CODEBLOCK1%%%`, etc.
- **Inline code** → `%%%INLINECODE0%%%`, `%%%INLINECODE1%%%`, etc.

This prevents code content from being processed as markdown and ensures special characters remain intact.

### Phase 2: HTML Escaping

All remaining content is HTML-escaped to prevent XSS attacks:
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- `"` → `&quot;`
- `'` → `&#39;`

This is done BEFORE markdown processing, ensuring no user input can inject HTML tags.

### Phase 3: Block Elements

Process larger structural elements:
1. **Tables** - Multi-line processing with alignment support
2. **Headings** - ATX-style headers (`#` through `######`)
3. **Blockquotes** - Line-by-line `>` prefixes
4. **Horizontal rules** - Three or more hyphens
5. **Lists** - Both ordered and unordered with nesting

### Phase 4: Inline Elements

Process text formatting within blocks:
1. **Images** - Processed before links to avoid conflicts
2. **Links** - Standard markdown link syntax
3. **Bold** - `**text**` or `__text__`
4. **Italic** - `*text*` or `_text_`
5. **Strikethrough** - `~~text~~`
6. **Line breaks** - Two trailing spaces

### Phase 5: Paragraphs

Double newlines are converted to paragraph breaks, then we unwrap block elements that shouldn't be inside `<p>` tags.

### Phase 6: Restore Protected Content

Finally, we replace the placeholders with the actual code content, properly formatted.

## Key Design Decisions

### Why Regex Instead of AST?

1. **Size** - No parser/lexer overhead
2. **Speed** - Single pass for most operations
3. **Simplicity** - Easier to audit and understand
4. **Good enough** - Handles 95% of real-world markdown

### Why Extract-Escape-Process-Restore?

This pattern ensures:
1. Code blocks are never modified
2. HTML is always escaped (security)
3. Markdown syntax inside code is preserved
4. Processing order is predictable

### Why No HTML Passthrough?

By default, all HTML is escaped for security. However, trusted HTML can be rendered using the fence plugin system:

```javascript
// Controlled HTML rendering via fence blocks
const plugin = (content, lang) => {
  if (lang === 'html-render') {
    return content; // Trust this specific block
  }
  return undefined; // Use default escaping
};
```

This makes trust explicit and granular.

## Performance Considerations

### Optimizations

1. **Single-pass regex** where possible
2. **Pre-compiled patterns** (via JavaScript's regex literals)
3. **Minimal string concatenation**
4. **Early returns** for empty/invalid input

### Trade-offs

- **No streaming** - Entire document processed at once
- **Regex limitations** - Some edge cases in deeply nested structures
- **No incremental updates** - Full re-parse on change

These trade-offs are acceptable for the target use case (chat messages, LLM outputs) where documents are typically small.

## Memory Usage

- **Linear with input size** - No exponential growth
- **Temporary arrays** for code blocks and placeholders
- **No AST** - No intermediate tree structure

## Browser Compatibility

- **ES6 features used**: Template literals, arrow functions, const/let
- **No polyfills needed** for modern browsers (2017+)
- **Regex compatibility**: Avoided lookbehind for older Safari

## Extensibility Points

### 1. Fence Plugin System

Custom renderers for fenced code blocks:

```javascript
function myPlugin(content, language) {
  // content: Raw, unescaped content
  // language: The language identifier (if any)
  // Return: HTML string or undefined (fall back to default)
}
```

### 2. Style Options

- **Inline styles**: Embed CSS directly in elements
- **CSS classes**: Use external stylesheets
- **Custom prefix**: Avoid class name collisions

### 3. Configuration

The `configure()` method creates reusable configured instances:

```javascript
const myParser = quikdown.configure({
  inline_styles: true,
  fence_plugin: myPlugin
});
```

## Security Model

### Default Protections

1. **HTML Escaping** - All user input is escaped
2. **No Script Execution** - No `eval()` or dynamic code
3. **No HTML Parsing** - No innerHTML on untrusted content
4. **Protected Code Blocks** - Code content is preserved exactly

### Trust Boundaries

- **Input**: Untrusted markdown text
- **Output**: Safe HTML (escaped)
- **Plugins**: Trusted code (developer-provided)
- **Plugin Content**: Potentially unsafe (plugin's responsibility)

### Recommended Practices

1. Only use fence plugins from trusted sources
2. Validate plugin output if accepting third-party plugins
3. Use Content Security Policy (CSP) headers
4. Sanitize URLs in production applications

## Limitations by Design

### Not Supported

- Full CommonMark specification
- HTML blocks (security)
- Reference-style links (complexity)
- Footnotes (uncommon in chat)
- Definition lists (uncommon)
- Nested blockquotes with different markers

### Edge Cases

- Mixed emphasis markers can mis-parse
- Deeply nested lists beyond 10 levels
- Tables without proper separator rows
- Unclosed fenced code blocks

These limitations keep the parser small, fast, and secure.