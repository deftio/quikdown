# Plugin Development Guide

## Overview

quikdown's plugin system allows you to customize how fenced code blocks are rendered. This enables syntax highlighting, diagrams, math rendering, custom components, and even trusted HTML rendering.

## Basic Plugin Structure

A fence plugin is a function that receives code block content and returns HTML:

```javascript
function myPlugin(content, language) {
  // content: Raw, unescaped content from the code block
  // language: The language identifier (or empty string)
  
  // Return HTML string to render, or undefined to use default
  return '<div>Custom HTML</div>';
}
```

## Plugin Contract

### Input Parameters

1. **`content`** (string)
   - Raw content from the fence block
   - **NOT HTML-escaped** when plugin is active
   - Trimmed of trailing whitespace
   - Preserves internal spacing and newlines

2. **`language`** (string)
   - Language identifier after ` ``` `
   - Empty string if no language specified
   - Can be any string (not limited to programming languages)

### Return Values

- **`string`** - HTML to render (you're responsible for escaping!)
- **`undefined`** - Fall back to default code block rendering

## Simple Examples

### Hello World Plugin

```javascript
function helloPlugin(content, language) {
  if (language === 'hello') {
    return `<div class="greeting">Hello, ${content}!</div>`;
  }
  return undefined; // Use default for other languages
}

// Usage in markdown:
// ```hello
// World
// ```
// Output: <div class="greeting">Hello, World!</div>
```

### JSON Viewer

```javascript
function jsonPlugin(content, language) {
  if (language === 'json') {
    try {
      const data = JSON.parse(content);
      const pretty = JSON.stringify(data, null, 2);
      return `<pre class="json-viewer">${escapeHtml(pretty)}</pre>`;
    } catch (e) {
      return `<pre class="json-error">Invalid JSON: ${e.message}</pre>`;
    }
  }
}
```

## Advanced Examples

### Syntax Highlighting with Prism.js

```javascript
function prismPlugin(content, language) {
  // Check if Prism supports this language
  if (language && Prism.languages[language]) {
    const highlighted = Prism.highlight(
      content,
      Prism.languages[language],
      language
    );
    return `<pre class="language-${language}"><code>${highlighted}</code></pre>`;
  }
  // Fall back to default for unsupported languages
  return undefined;
}
```

### Mermaid Diagrams

```javascript
function mermaidPlugin(content, language) {
  if (language === 'mermaid') {
    // Generate unique ID for async rendering
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    
    // Return placeholder that will be replaced
    return `
      <div id="${id}" class="mermaid-container">
        <pre class="mermaid-source" style="display:none">${escapeHtml(content)}</pre>
        <div class="mermaid-rendering">Rendering diagram...</div>
      </div>
      <script>
        (function() {
          const element = document.getElementById('${id}');
          const source = element.querySelector('.mermaid-source').textContent;
          mermaid.render('${id}-svg', source).then(result => {
            element.querySelector('.mermaid-rendering').innerHTML = result.svg;
          }).catch(error => {
            element.querySelector('.mermaid-rendering').innerHTML = 
              '<div class="error">Failed to render diagram: ' + error + '</div>';
          });
        })();
      </script>
    `;
  }
}
```

### Math with KaTeX

```javascript
function mathPlugin(content, language) {
  if (language === 'math' || language === 'latex') {
    try {
      const html = katex.renderToString(content, {
        displayMode: true,
        throwOnError: false,
        errorColor: '#cc0000'
      });
      return `<div class="math-block">${html}</div>`;
    } catch (e) {
      return `<div class="math-error">Invalid math: ${escapeHtml(e.message)}</div>`;
    }
  }
}
```

### Custom Components

```javascript
function componentPlugin(content, language) {
  if (language === 'component') {
    try {
      const config = JSON.parse(content);
      
      // Validate component type
      if (!['alert', 'card', 'tabs'].includes(config.type)) {
        throw new Error(`Unknown component type: ${config.type}`);
      }
      
      // Render based on type
      switch (config.type) {
        case 'alert':
          return `
            <div class="alert alert-${config.level || 'info'}">
              ${escapeHtml(config.message)}
            </div>
          `;
          
        case 'card':
          return `
            <div class="card">
              <h3>${escapeHtml(config.title)}</h3>
              <p>${escapeHtml(config.content)}</p>
            </div>
          `;
          
        default:
          return `<div>Unsupported component</div>`;
      }
    } catch (e) {
      return `<div class="component-error">Invalid component: ${escapeHtml(e.message)}</div>`;
    }
  }
}

// Usage:
// ```component
// {
//   "type": "alert",
//   "level": "warning",
//   "message": "This is a warning!"
// }
// ```
```

## Security Considerations

### ⚠️ Critical: Escape User Content

Plugins receive **raw, unescaped content**. You MUST escape it unless you explicitly trust it:

```javascript
// ❌ DANGEROUS - XSS vulnerability!
function badPlugin(content, language) {
  return `<div>${content}</div>`; // content could contain <script>!
}

// ✅ SAFE - Content is escaped
function goodPlugin(content, language) {
  return `<div>${escapeHtml(content)}</div>`;
}

// Helper function
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

### Trusted HTML Rendering

If you need to render trusted HTML:

```javascript
function trustedHtmlPlugin(content, language) {
  // Only allow for specific, trusted sources
  if (language === 'html-preview' && isAdminUser()) {
    // Sanitize even trusted content for defense-in-depth
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'a', 'img'],
      ALLOWED_ATTR: ['class', 'href', 'src', 'alt']
    });
  }
}
```

### Validation Best Practices

Always validate and sanitize:

```javascript
function robustPlugin(content, language) {
  // 1. Check language
  if (!['myformat'].includes(language)) {
    return undefined;
  }
  
  // 2. Validate content
  if (content.length > 10000) {
    return '<div class="error">Content too large</div>';
  }
  
  // 3. Parse safely
  try {
    const data = parseContent(content);
    
    // 4. Validate parsed data
    if (!isValidData(data)) {
      throw new Error('Invalid data format');
    }
    
    // 5. Escape when rendering
    return renderData(data, escapeHtml);
    
  } catch (error) {
    // 6. Safe error handling
    return `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}
```

## Multi-Language Plugin

Handle multiple languages in one plugin:

```javascript
function multiPlugin(content, language) {
  switch (language) {
    case 'graph':
      return renderGraph(content);
      
    case 'music':
      return renderMusicNotation(content);
      
    case 'csv':
      return renderCSVTable(content);
      
    case 'diff':
      return renderDiff(content);
      
    default:
      // Check if it's a programming language
      if (Prism.languages[language]) {
        return renderSyntaxHighlight(content, language);
      }
      
      // Fall back to default
      return undefined;
  }
}
```

## Async Rendering

For async operations, return a placeholder and update later:

```javascript
function asyncPlugin(content, language) {
  if (language === 'async-content') {
    const id = 'async-' + Date.now();
    
    // Schedule async operation
    setTimeout(() => {
      fetchContent(content).then(result => {
        const element = document.getElementById(id);
        if (element) {
          element.innerHTML = result;
        }
      });
    }, 0);
    
    // Return placeholder immediately
    return `<div id="${id}" class="loading">Loading...</div>`;
  }
}
```

## Error Handling

Always handle errors gracefully:

```javascript
function safePlugin(content, language) {
  try {
    // Attempt to process
    return processContent(content, language);
    
  } catch (error) {
    // Log for debugging
    console.error(`Plugin error for language '${language}':`, error);
    
    // Return safe error message
    return `
      <div class="plugin-error">
        <strong>Error rendering ${escapeHtml(language)} block:</strong>
        <pre>${escapeHtml(error.message)}</pre>
      </div>
    `;
  }
}
```

## Testing Plugins

### Unit Testing

```javascript
describe('myPlugin', () => {
  test('renders correct language', () => {
    const result = myPlugin('content', 'mylang');
    expect(result).toContain('content');
  });
  
  test('returns undefined for unknown language', () => {
    const result = myPlugin('content', 'unknown');
    expect(result).toBeUndefined();
  });
  
  test('escapes HTML in content', () => {
    const result = myPlugin('<script>alert("xss")</script>', 'mylang');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
  
  test('handles errors gracefully', () => {
    const result = myPlugin('invalid{{content', 'mylang');
    expect(result).toContain('error');
    expect(result).not.toThrow();
  });
});
```

### Integration Testing

```javascript
test('plugin works with quikdown', () => {
  const markdown = '```mylang\ntest content\n```';
  const html = quikdown(markdown, { fence_plugin: myPlugin });
  expect(html).toContain('test content');
});
```

## Performance Tips

### 1. Early Returns

```javascript
function fastPlugin(content, language) {
  // Check language first (fast)
  if (language !== 'mylang') return undefined;
  
  // Then validate content (slower)
  if (!isValid(content)) return undefined;
  
  // Finally process (slowest)
  return process(content);
}
```

### 2. Cache Expensive Operations

```javascript
const cache = new Map();

function cachedPlugin(content, language) {
  if (language !== 'expensive') return undefined;
  
  const key = `${language}:${content}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = expensiveOperation(content);
  cache.set(key, result);
  return result;
}
```

### 3. Limit Content Size

```javascript
function limitedPlugin(content, language) {
  if (content.length > 50000) {
    return '<div class="error">Content too large</div>';
  }
  return processContent(content, language);
}
```

## Plugin Composition

Combine multiple plugins:

```javascript
function combinePlugins(...plugins) {
  return (content, language) => {
    for (const plugin of plugins) {
      const result = plugin(content, language);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  };
}

// Usage
const myPlugin = combinePlugins(
  syntaxPlugin,
  diagramPlugin,
  mathPlugin,
  customPlugin
);
```

## Debugging Plugins

Add debug output:

```javascript
function debugPlugin(content, language) {
  console.group(`Plugin called: ${language}`);
  console.log('Content length:', content.length);
  console.log('First 100 chars:', content.substring(0, 100));
  
  try {
    const result = actualPlugin(content, language);
    console.log('Result:', result ? 'HTML generated' : 'undefined');
    console.groupEnd();
    return result;
  } catch (error) {
    console.error('Plugin error:', error);
    console.groupEnd();
    throw error;
  }
}
```

## Real-World Example: Complete Plugin

Here's a production-ready plugin example:

```javascript
/**
 * Advanced code block plugin with multiple features
 */
function advancedCodePlugin(content, language) {
  // Configuration
  const config = {
    maxSize: 100000,
    supportedLanguages: ['js', 'python', 'html', 'css', 'json', 'markdown'],
    enableLineNumbers: true,
    enableCopy: true
  };
  
  // Early return for unsupported languages
  if (!config.supportedLanguages.includes(language)) {
    return undefined;
  }
  
  // Size check
  if (content.length > config.maxSize) {
    return `<div class="code-error">Code too large (${content.length} chars)</div>`;
  }
  
  // Generate unique ID
  const id = 'code-' + Math.random().toString(36).substr(2, 9);
  
  // Process content
  let processedContent;
  try {
    if (typeof Prism !== 'undefined' && Prism.languages[language]) {
      // Syntax highlighting available
      processedContent = Prism.highlight(content, Prism.languages[language], language);
    } else {
      // No highlighting, escape HTML
      processedContent = escapeHtml(content);
    }
  } catch (error) {
    return `<div class="code-error">Highlighting failed: ${escapeHtml(error.message)}</div>`;
  }
  
  // Build HTML
  let html = `<div class="code-block" id="${id}">`;
  
  // Header with language and copy button
  html += `
    <div class="code-header">
      <span class="code-language">${escapeHtml(language)}</span>
      ${config.enableCopy ? `
        <button class="code-copy" onclick="copyCode('${id}')">
          Copy
        </button>
      ` : ''}
    </div>
  `;
  
  // Code content with optional line numbers
  if (config.enableLineNumbers) {
    const lines = content.split('\n');
    const lineNumbers = lines.map((_, i) => i + 1).join('\n');
    html += `
      <div class="code-content">
        <pre class="line-numbers">${lineNumbers}</pre>
        <pre class="language-${language}"><code>${processedContent}</code></pre>
      </div>
    `;
  } else {
    html += `
      <pre class="language-${language}"><code>${processedContent}</code></pre>
    `;
  }
  
  html += '</div>';
  
  return html;
}

// Helper function (should be in global scope)
window.copyCode = function(id) {
  const element = document.getElementById(id);
  const code = element.querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const button = element.querySelector('.code-copy');
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 2000);
  });
};
```

## Summary

Key points for plugin development:

1. **Always escape user content** unless explicitly trusted
2. **Return `undefined`** to fall back to default rendering
3. **Handle errors gracefully** - never throw
4. **Validate input** before processing
5. **Keep plugins focused** - one plugin per concern
6. **Test thoroughly** - including security and edge cases
7. **Document requirements** - what libraries/setup needed
8. **Consider performance** - cache expensive operations
9. **Provide feedback** - loading states, error messages
10. **Be defensive** - assume content could be malicious