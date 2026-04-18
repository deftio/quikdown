# quikdown Architecture

## Design Philosophy

quikdown is designed with these core principles:

1. **Small & Fast** - Optimized for size (~11.0KB minified) and performance
2. **Secure by Default** - All HTML is escaped unless explicitly trusted
3. **Zero Dependencies** - No external libraries required
4. **Extensible** - Plugin system for custom rendering
5. **Practical** - Focused on the markdown subset actually used in chat/LLM outputs

## Parser Architecture

### Overview

As of v1.2.8, quikdown uses a **line-scanning** approach for block detection
combined with per-block inline formatting. The overall pipeline is:

```
Input Markdown
    ↓
Phase 1: Extract & Protect (Code blocks, inline code → §CB§ / §IC§ placeholders)
    ↓
Phase 2: Escape HTML (XSS protection)
    ↓
Phase 3: Block Scanning + Inline Formatting + Paragraph Wrapping
    ├── 3a: Table detection (line walker — multi-line lookahead)
    ├── 3b: Line scanner (headings, HR, blockquotes — single pass)
    ├── 3c: List detection (line walker — indent tracking)
    ├── 3d: Inline formatting (bold, italic, links, autolinks, images)
    └── 3e: Paragraph wrapping + lazy linefeeds
    ↓
Phase 4: Restore Protected Content (§CB§ → <pre>, §IC§ → <code>)
    ↓
Output HTML
```

Prior to v1.2.8 the parser applied 10+ sequential regex passes over the full
document. The v1.2.8 rewrite replaced that with structured line-walkers: each
line is classified once, and inline formatting is applied per-block rather than
globally. This makes the parser easier to debug, extend, and reason about.

### Phase 1: Extract & Protect

Before any processing, we extract code blocks and inline code, replacing them with placeholders:

- **Fenced code blocks** → `§CB0§`, `§CB1§`, etc.
- **Inline code** → `§IC0§`, `§IC1§`, etc.

This prevents code content from being processed as markdown and ensures special characters remain intact.

### Phase 2: HTML Escaping

All remaining content is HTML-escaped to prevent XSS attacks:
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- `"` → `&quot;`
- `'` → `&#39;`

This is done BEFORE markdown processing, ensuring no user input can inject HTML tags.

### Phase 3: Block Scanning + Inline + Paragraphs

This is the core of the lexer rewrite. Three line-walkers process the text:

1. **Table walker** — scans for runs of pipe-containing lines, validates the
   separator row, and renders `<table>` HTML. Invalid runs are left as text.
2. **Line scanner** (`scanLineBlocks`) — a single pass that identifies
   headings (`#`), horizontal rules (`---`), and blockquotes (`&gt;`).
   Each matched line is replaced with its HTML inline.
3. **List walker** — tracks indentation levels to build nested `<ul>`/`<ol>`
   structures, including task-list checkboxes.

After block scanning, **inline formatting** is applied globally:
images, links, autolinks, bold/italic/strikethrough.

Finally, **paragraph wrapping** converts double newlines to `</p><p>` breaks,
wraps the result in `<p>…</p>`, and removes spurious `<p>` tags around block
elements. Lazy linefeeds mode converts single `\n` to `<br>` while preserving
block boundaries.

### Phase 4: Restore Protected Content

Replace placeholders with rendered HTML: `§CB0§` → `<pre><code>…</code></pre>`
(or fence-plugin output), `§IC0§` → `<code>…</code>`.

## Key Design Decisions

### Why Line Scanning Instead of Full AST?

1. **Size** — No separate tokenizer/AST/renderer layers (~11.0 KB minified)
2. **Speed** — Each line is classified once; inline formatting per-block
3. **Simplicity** — Easy to add a new block type (add a branch in the scanner)
4. **Good enough** — Handles 95%+ of real-world markdown used in chat/LLM output

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
const plugin = {
  render: (content, lang) => {
    if (lang === 'html-render') {
      return content; // Trust this specific block
    }
    return undefined; // Use default escaping
  }
};
```

This makes trust explicit and granular.

## Performance Considerations

### Optimizations

1. **Line-scanning** — each line classified once, not re-scanned by multiple regex passes
2. **Pre-compiled patterns** (via JavaScript's regex literals for inline formatting)
3. **Minimal string concatenation**
4. **Early returns** for empty/invalid input

### Trade-offs

- **No streaming** — entire document processed at once
- **No incremental updates** — full re-parse on change
- **Placeholder-based code extraction** — adds two array lookups per code block

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
const myPlugin = {
  render: (content, language) => {
    // content: Raw, unescaped content
    // language: The language identifier (if any)
    // Return: HTML string or undefined (fall back to default)
  }
};
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

### Static Analysis

The build pipeline enforces security scanning via ESLint with `eslint-plugin-security` at **error** level. Key guarantees:

- **No ReDoS-vulnerable regex** — `security/detect-unsafe-regex` is enforced as an error. All line-classification logic (HR detection, fence tracking, block categorization) uses linear-scan functions in `src/quikdown_classify.js` instead of regex with nested quantifiers.
- **No dynamic RegExp** — `security/detect-non-literal-regexp` is enforced as an error. String replacements use `replaceAll()` instead of `new RegExp()`.
- **CI-gated** — the lint step runs first in `npm run build`, and CI runs the same pipeline on every push and PR.

See [Security Guide](security.md) for the full static analysis status table.

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