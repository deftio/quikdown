# Bidirectional Fence Plugin API - v1.1.0

## Breaking Change
Starting with v1.1.0, fence plugins MUST use the object format with a `render` function. This is a breaking change from v1.0.x where plugins could be simple functions.

## API Design

### Required Object Format

```javascript
const fencePlugin = {
  // Required: markdown -> HTML
  render: (content, lang) => {
    return `<pre class="custom">${content}</pre>`;
  },
  
  // Optional: HTML element -> markdown  
  reverse: (element) => {
    return {
      fence: '```',     // or '~~~'
      lang: 'svg',      // language identifier
      content: element.textContent
    };
  }
};

// Usage
quikdown(markdown, {
  fence_plugin: fencePlugin
});
```

## Implementation

### 1. Forward Conversion (markdown -> HTML)

```javascript
// In quikdown.js
if (fence_plugin && fence_plugin.render) {
  const html = fence_plugin.render(code, lang);
  
  // If plugin supports reverse, add data attributes for roundtrip
  if (fence_plugin.reverse && bidirectional) {
    // Store original for fallback
    return html.replace(/^<(\w+)/, 
      `<$1 data-qd-fence="${fence}" data-qd-lang="${lang}" data-qd-source="${escapeHtml(code)}"`);
  }
  
  return html;
}
```

### 2. Reverse Conversion (HTML -> markdown)

```javascript
// In quikdown_bd.js toMarkdown()
case 'pre':
case 'div':
  // Check if this was created by a fence plugin
  const lang = node.getAttribute('data-qd-lang');
  const fence = node.getAttribute('data-qd-fence');
  
  if (lang && fence_plugin && fence_plugin.reverse) {
    try {
      const result = fence_plugin.reverse(node);
      if (result && result.content) {
        const fenceMarker = result.fence || fence || '```';
        const langStr = result.lang || lang || '';
        return `${fenceMarker}${langStr}\n${result.content}\n${fenceMarker}\n\n`;
      }
    } catch (err) {
      console.warn('Fence reverse handler error:', err);
      // Fall through to default handling
    }
  }
  
  // Fallback: use data-qd-source if available
  const source = node.getAttribute('data-qd-source');
  if (source && fence) {
    return `${fence}${lang || ''}\n${source}\n${fence}\n\n`;
  }
  
  // Final fallback: extract text content
  // ... existing code
```

## Usage Examples

### Example 1: Simple Syntax Highlighting

```javascript
const highlightPlugin = {
  render: (content, lang) => {
    const highlighted = hljs.highlight(content, { language: lang }).value;
    return `<pre><code class="language-${lang}">${highlighted}</code></pre>`;
  }
  // No reverse needed - will use data-qd-source fallback
};
```

### Example 2: Mermaid Diagrams (Bidirectional)

```javascript
const mermaidPlugin = {
  render: (content, lang) => {
    return `<div class="mermaid" data-mermaid-source="${escapeHtml(content)}">${content}</div>`;
  },
  
  reverse: (element) => {
    // Try to get original source, fall back to text content
    const source = element.getAttribute('data-mermaid-source') || element.textContent;
    return {
      fence: '```',
      lang: 'mermaid',
      content: source
    };
  }
};
```

### Example 3: SVG Rendering (Bidirectional)

```javascript
const svgPlugin = {
  render: (content, lang) => {
    // Validate and sanitize SVG
    const sanitized = DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true }
    });
    return `<div class="svg-container">${sanitized}</div>`;
  },
  
  reverse: (element) => {
    // Extract SVG from container
    const svg = element.querySelector('svg');
    return {
      fence: '```',
      lang: 'svg',
      content: svg ? svg.outerHTML : element.textContent
    };
  }
};
```

### Example 4: Math with KaTeX (Bidirectional)

```javascript
const mathPlugin = {
  render: (content, lang) => {
    try {
      const html = katex.renderToString(content, {
        throwOnError: false,
        displayMode: lang === 'math-display'
      });
      return `<div class="math-block" data-math-source="${escapeHtml(content)}">${html}</div>`;
    } catch (e) {
      return `<pre class="math-error">${escapeHtml(content)}</pre>`;
    }
  },
  
  reverse: (element) => {
    // Prefer original LaTeX source over rendered HTML
    const source = element.getAttribute('data-math-source') || element.textContent;
    return {
      fence: '```',
      lang: 'math',
      content: source
    };
  }
};
```

## TypeScript Definitions

```typescript
interface FencePlugin {
  render: (content: string, lang: string) => string;
  reverse?: (element: HTMLElement) => {
    fence: string;
    lang: string;
    content: string;
  } | null;
}

interface QuikdownOptions {
  fence_plugin?: FencePlugin;
  // ... other options
}
```

## Migration from v1.0.x

```javascript
// OLD (v1.0.x) - No longer supported
const oldPlugin = (content, lang) => {
  return `<pre>${content}</pre>`;
};

// NEW (v1.1.0) - Required object format
const newPlugin = {
  render: (content, lang) => {
    return `<pre>${content}</pre>`;
  }
};
```

## Implementation Checklist

- [ ] Update quikdown.js to only accept object format
- [ ] Add reverse handler support to quikdown_bd.js
- [ ] Update QuikdownEditor to pass through fence plugins
- [ ] Update all tests to use object format
- [ ] Update TypeScript definitions
- [ ] Update API documentation
- [ ] Update examples to show object format
- [ ] Update release notes for v1.1.0 breaking change

## Benefits of Clean Break

1. **Simpler Codebase** - No dual-format detection logic
2. **Clear API** - One way to define plugins
3. **Better TypeScript** - Clean interface definition
4. **Future-Ready** - Easy to extend with new properties
5. **Explicit Intent** - Object format makes plugin capabilities obvious