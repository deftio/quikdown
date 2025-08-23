# Bidirectional Fence Plugin API Proposal

## Design Goals
1. **100% Backwards Compatible** - Existing fence plugins continue to work unchanged
2. **Progressive Enhancement** - Developers can opt-in to bidirectional support
3. **Flexible** - Support both simple functions and object-based plugins
4. **Predictable** - Clear fallback behavior when reverse handler not provided

## Proposed API

### Option 1: Extended Object Format (Recommended)

```javascript
// Backwards compatible - still works
const simpleFencePlugin = (content, lang) => {
  return `<pre class="custom">${content}</pre>`;
};

// New extended format with reverse handler
const bidirectionalFencePlugin = {
  // Forward: markdown -> HTML (required)
  render: (content, lang) => {
    return `<div class="svg-container">${content}</div>`;
  },
  
  // Reverse: HTML element -> markdown (optional)
  reverse: (element) => {
    // Return object with fence details
    return {
      fence: '```',     // or '~~~'
      lang: 'svg',      // language identifier
      content: element.textContent || element.getAttribute('data-content')
    };
  }
};

// API accepts both formats
quikdown(markdown, {
  fence_plugin: simpleFencePlugin  // Works
});

quikdown(markdown, {
  fence_plugin: bidirectionalFencePlugin  // Also works
});
```

### Option 2: Function with Properties

```javascript
// Attach reverse handler as a property
const fencePlugin = (content, lang) => {
  return `<div class="custom">${content}</div>`;
};

fencePlugin.reverse = (element) => {
  return {
    fence: '```',
    lang: 'custom',
    content: element.textContent
  };
};

quikdown(markdown, {
  fence_plugin: fencePlugin
});
```

## Implementation Strategy

### 1. Detection Logic

```javascript
function isExtendedFencePlugin(plugin) {
  return plugin && typeof plugin === 'object' && typeof plugin.render === 'function';
}

function getFenceRenderer(plugin) {
  if (!plugin) return null;
  if (typeof plugin === 'function') return plugin;
  if (isExtendedFencePlugin(plugin)) return plugin.render;
  return null;
}

function getFenceReverser(plugin) {
  if (!plugin) return null;
  if (typeof plugin === 'function' && plugin.reverse) return plugin.reverse;
  if (isExtendedFencePlugin(plugin)) return plugin.reverse;
  return null;
}
```

### 2. Forward Conversion (markdown -> HTML)

```javascript
// In quikdown.js
const renderer = getFenceRenderer(fence_plugin);
if (renderer) {
  const html = renderer(code, lang);
  
  // If plugin supports reverse, add data attribute for roundtrip
  if (getFenceReverser(fence_plugin) && bidirectional) {
    // Store original for fallback
    html = html.replace(/^<(\w+)/, `<$1 data-qd-source="${escapeHtml(code)}" data-qd-lang="${lang}" data-qd-fence="${fence}"`);
  }
  
  return html;
}
```

### 3. Reverse Conversion (HTML -> markdown)

```javascript
// In quikdown_bd.js toMarkdown()
case 'pre':
case 'div':
  // Check if this was created by a fence plugin
  const lang = node.getAttribute('data-qd-lang');
  if (lang && fence_plugin) {
    const reverser = getFenceReverser(fence_plugin);
    
    if (reverser) {
      try {
        const result = reverser(node);
        if (result && result.content) {
          const fence = result.fence || '```';
          const langStr = result.lang || lang;
          return `${fence}${langStr}\n${result.content}\n${fence}\n\n`;
        }
      } catch (err) {
        console.warn('Fence reverse handler error:', err);
        // Fall through to default handling
      }
    }
  }
  
  // Fallback: use data-qd-source if available
  const source = node.getAttribute('data-qd-source');
  if (source) {
    const fence = node.getAttribute('data-qd-fence') || '```';
    return `${fence}${lang}\n${source}\n${fence}\n\n`;
  }
  
  // Final fallback: extract text content
  // ... existing code
```

## Usage Examples

### Example 1: SVG Fence Plugin

```javascript
const svgFencePlugin = {
  render: (content, lang) => {
    // Validate and sanitize SVG
    const sanitized = DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true }
    });
    return `<div class="svg-fence">${sanitized}</div>`;
  },
  
  reverse: (element) => {
    // Extract SVG from container
    const svg = element.querySelector('svg') || element;
    return {
      fence: '```',
      lang: 'svg',
      content: svg.outerHTML || svg.textContent
    };
  }
};
```

### Example 2: Mermaid Diagram Plugin

```javascript
const mermaidPlugin = {
  render: (content, lang) => {
    return `<div class="mermaid">${content}</div>`;
  },
  
  reverse: (element) => {
    // Mermaid stores original in data attribute
    const original = element.getAttribute('data-mermaid-source');
    return {
      fence: '```',
      lang: 'mermaid',
      content: original || element.textContent
    };
  }
};
```

### Example 3: Mathematical Equations

```javascript
const mathPlugin = {
  render: (content, lang) => {
    const html = katex.renderToString(content, {
      throwOnError: false,
      displayMode: lang === 'math-display'
    });
    return `<div class="math-block" data-math="${escapeHtml(content)}">${html}</div>`;
  },
  
  reverse: (element) => {
    return {
      fence: '```',
      lang: 'math',
      content: element.getAttribute('data-math') || element.textContent
    };
  }
};
```

## Compatibility Matrix

| Plugin Format | Forward Rendering | Reverse Conversion | Notes |
|--------------|------------------|-------------------|--------|
| Simple function | ✅ Works | ❌ Uses fallback | 100% backwards compatible |
| Function with .reverse | ✅ Works | ✅ Works | Minimal change required |
| Object with render/reverse | ✅ Works | ✅ Works | Cleanest API |
| No plugin | ✅ Default | ✅ Default | Standard behavior |

## Migration Path

```javascript
// Step 1: Existing code continues to work
const plugin = (content, lang) => { /* ... */ };

// Step 2: Add reverse handler when ready
const plugin = {
  render: (content, lang) => { /* same code */ },
  reverse: (element) => { /* new code */ }
};

// Step 3: Enhanced bidirectional editing
editor = new QuikdownEditor(container, {
  customFences: {
    'svg': plugin,  // Now supports full roundtrip
    'math': mathPlugin
  }
});
```

## Benefits

1. **No Breaking Changes** - All existing code continues to work
2. **Gradual Adoption** - Add reverse handlers as needed
3. **Better User Experience** - Custom content preserves through edit cycles
4. **Plugin Ecosystem** - Enables rich bidirectional plugins
5. **Clean Separation** - Forward and reverse logic clearly separated

## Implementation Checklist

- [ ] Add detection functions to quikdown.js
- [ ] Update fence processing to use new API
- [ ] Add reverse handler support to quikdown_bd.js
- [ ] Update QuikdownEditor to pass through extended plugins
- [ ] Add tests for both formats
- [ ] Update TypeScript definitions
- [ ] Document in API reference
- [ ] Create example plugins