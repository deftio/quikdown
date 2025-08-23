# Framework Integration Guide

This guide shows how to integrate quikdown into popular JavaScript frameworks.

## Table of Contents
- [React](#react)
- [Vue.js](#vuejs)
- [Svelte](#svelte)
- [Angular](#angular)
- [Next.js](#nextjs)
- [Nuxt](#nuxt)

## React

### Basic Usage

```jsx
import React, { useState, useMemo } from 'react';
import quikdown from 'quikdown';

function MarkdownEditor() {
  const [markdown, setMarkdown] = useState('# Hello React\n\nEdit me!');
  
  const html = useMemo(() => {
    return quikdown(markdown, { inline_styles: true });
  }, [markdown]);
  
  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        style={{ width: '50%', minHeight: '400px' }}
      />
      <div 
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ width: '50%' }}
      />
    </div>
  );
}

export default MarkdownEditor;
```

### With Bidirectional Support

**⚠️ Note:** Bidirectional support requires `quikdown_bd`, not regular `quikdown`.

```jsx
import React, { useState, useEffect, useRef } from 'react';
// Use quikdown_bd for bidirectional support, NOT regular quikdown
import quikdown_bd from 'quikdown/bd';

function BidirectionalEditor() {
  const [markdown, setMarkdown] = useState('# Bidirectional Editor\n\n**Edit** either side!');
  const [isEditingHtml, setIsEditingHtml] = useState(false);
  const htmlRef = useRef(null);
  
  useEffect(() => {
    if (!isEditingHtml && htmlRef.current) {
      htmlRef.current.innerHTML = quikdown_bd(markdown, { bidirectional: true });
    }
  }, [markdown, isEditingHtml]);
  
  const handleHtmlEdit = () => {
    if (htmlRef.current) {
      const newMarkdown = quikdown_bd.toMarkdown(htmlRef.current);
      setMarkdown(newMarkdown);
      setIsEditingHtml(false);
    }
  };
  
  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <textarea
        value={markdown}
        onChange={(e) => {
          setMarkdown(e.target.value);
          setIsEditingHtml(false);
        }}
        style={{ width: '50%', minHeight: '400px' }}
      />
      <div
        ref={htmlRef}
        contentEditable
        onFocus={() => setIsEditingHtml(true)}
        onBlur={handleHtmlEdit}
        style={{ width: '50%', border: '1px solid #ccc', padding: '10px' }}
      />
    </div>
  );
}
```

### Custom Hook

```jsx
import { useState, useMemo } from 'react';
import quikdown from 'quikdown';

export function useMarkdown(initialMarkdown = '', options = {}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  
  const html = useMemo(() => {
    return quikdown(markdown, options);
  }, [markdown, options]);
  
  return { markdown, setMarkdown, html };
}

// Usage
function MyComponent() {
  const { markdown, setMarkdown, html } = useMarkdown('# Hello');
  // ...
}
```

## Vue.js

### Vue 3 Composition API

```vue
<template>
  <div class="markdown-editor">
    <textarea 
      v-model="markdown" 
      class="editor"
    />
    <div 
      v-html="html" 
      class="preview"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import quikdown from 'quikdown';

const markdown = ref('# Hello Vue 3\n\nEdit this **markdown**!');

const html = computed(() => {
  return quikdown(markdown.value, { inline_styles: true });
});
</script>

<style scoped>
.markdown-editor {
  display: flex;
  gap: 20px;
}
.editor, .preview {
  width: 50%;
  min-height: 400px;
  padding: 10px;
  border: 1px solid #ccc;
}
</style>
```

### Vue 2 Options API

```vue
<template>
  <div class="markdown-editor">
    <textarea 
      v-model="markdown" 
      class="editor"
    />
    <div 
      v-html="html" 
      class="preview"
    />
  </div>
</template>

<script>
import quikdown from 'quikdown';

export default {
  data() {
    return {
      markdown: '# Hello Vue 2\n\nEdit me!'
    };
  },
  computed: {
    html() {
      return quikdown(this.markdown, { inline_styles: true });
    }
  }
};
</script>
```

### Vue Component with Bidirectional Support

```vue
<template>
  <div class="bidirectional-editor">
    <textarea 
      v-model="markdown" 
      @input="syncFromMarkdown"
      class="editor"
    />
    <div 
      ref="htmlEditor"
      contenteditable="true"
      @blur="syncFromHtml"
      class="preview"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import quikdown_bd from 'quikdown/bd';

const markdown = ref('# Bidirectional\n\n**Edit** either side!');
const htmlEditor = ref(null);
let isUpdating = false;

const syncFromMarkdown = () => {
  if (!isUpdating && htmlEditor.value) {
    isUpdating = true;
    htmlEditor.value.innerHTML = quikdown_bd(markdown.value, { bidirectional: true });
    isUpdating = false;
  }
};

const syncFromHtml = () => {
  if (!isUpdating && htmlEditor.value) {
    isUpdating = true;
    markdown.value = quikdown_bd.toMarkdown(htmlEditor.value);
    isUpdating = false;
  }
};

onMounted(() => {
  syncFromMarkdown();
});
</script>
```

## Svelte

### Basic Svelte Component

```svelte
<script>
  import quikdown from 'quikdown';
  
  let markdown = '# Hello Svelte\n\n**Bold** and *italic* text';
  
  $: html = quikdown(markdown, { inline_styles: true });
</script>

<div class="editor">
  <textarea bind:value={markdown} />
  <div class="preview">
    {@html html}
  </div>
</div>

<style>
  .editor {
    display: flex;
    gap: 20px;
  }
  textarea, .preview {
    width: 50%;
    min-height: 400px;
    padding: 10px;
    border: 1px solid #ccc;
  }
</style>
```

### Svelte Store Integration

```javascript
// markdownStore.js
import { writable, derived } from 'svelte/store';
import quikdown from 'quikdown';

export function createMarkdownStore(initialValue = '') {
  const markdown = writable(initialValue);
  
  const html = derived(markdown, $markdown => 
    quikdown($markdown, { inline_styles: true })
  );
  
  return {
    markdown,
    html,
    setMarkdown: markdown.set,
    updateMarkdown: markdown.update
  };
}
```

```svelte
<!-- Component.svelte -->
<script>
  import { createMarkdownStore } from './markdownStore.js';
  
  const { markdown, html, setMarkdown } = createMarkdownStore('# Hello Store');
</script>

<textarea value={$markdown} on:input={(e) => setMarkdown(e.target.value)} />
<div>{@html $html}</div>
```

### Bidirectional Svelte Component

```svelte
<script>
  import { onMount } from 'svelte';
  import quikdown_bd from 'quikdown/bd';
  
  let markdown = '# Bidirectional\n\n**Edit** anywhere!';
  let htmlElement;
  let isUpdating = false;
  
  function updateHtml() {
    if (!isUpdating && htmlElement) {
      isUpdating = true;
      htmlElement.innerHTML = quikdown_bd(markdown, { bidirectional: true });
      isUpdating = false;
    }
  }
  
  function updateMarkdown() {
    if (!isUpdating && htmlElement) {
      isUpdating = true;
      markdown = quikdown_bd.toMarkdown(htmlElement);
      isUpdating = false;
    }
  }
  
  onMount(() => {
    updateHtml();
  });
  
  $: if (markdown) updateHtml();
</script>

<div class="editor">
  <textarea bind:value={markdown} />
  <div 
    bind:this={htmlElement}
    contenteditable="true"
    on:blur={updateMarkdown}
    class="preview"
  />
</div>
```

## Angular

### Angular Component

```typescript
// markdown-editor.component.ts
import { Component, OnInit } from '@angular/core';
import quikdown from 'quikdown';

@Component({
  selector: 'app-markdown-editor',
  template: `
    <div class="editor-container">
      <textarea 
        [(ngModel)]="markdown" 
        (ngModelChange)="updateHtml()"
        class="editor"
      ></textarea>
      <div 
        [innerHTML]="html" 
        class="preview"
      ></div>
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      gap: 20px;
    }
    .editor, .preview {
      width: 50%;
      min-height: 400px;
      padding: 10px;
      border: 1px solid #ccc;
    }
  `]
})
export class MarkdownEditorComponent implements OnInit {
  markdown = '# Hello Angular\n\n**Bold** text';
  html = '';
  
  ngOnInit() {
    this.updateHtml();
  }
  
  updateHtml() {
    this.html = quikdown(this.markdown, { inline_styles: true });
  }
}
```

### Angular Service

```typescript
// markdown.service.ts
import { Injectable } from '@angular/core';
import quikdown from 'quikdown';
import quikdown_bd from 'quikdown/bd';

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  
  toHtml(markdown: string, options?: any): string {
    return quikdown(markdown, options);
  }
  
  toHtmlBidirectional(markdown: string): string {
    return quikdown_bd(markdown, { bidirectional: true });
  }
  
  toMarkdown(html: string | HTMLElement): string {
    return quikdown_bd.toMarkdown(html);
  }
}
```

### Angular Pipe

```typescript
// markdown.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import quikdown from 'quikdown';

@Pipe({
  name: 'markdown'
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string, options?: any): string {
    return value ? quikdown(value, options) : '';
  }
}

// Usage in template
// <div [innerHTML]="markdownContent | markdown"></div>
```

## Next.js

### Next.js Page with SSR

```jsx
// pages/markdown-demo.js
import { useState } from 'react';
import quikdown from 'quikdown';

// Server-side rendering
export async function getServerSideProps() {
  const initialMarkdown = '# Server-Rendered\n\nThis was rendered on the server!';
  const initialHtml = quikdown(initialMarkdown, { inline_styles: true });
  
  return {
    props: {
      initialMarkdown,
      initialHtml
    }
  };
}

export default function MarkdownDemo({ initialMarkdown, initialHtml }) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [html, setHtml] = useState(initialHtml);
  
  const handleChange = (e) => {
    const newMarkdown = e.target.value;
    setMarkdown(newMarkdown);
    setHtml(quikdown(newMarkdown, { inline_styles: true }));
  };
  
  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
      <textarea 
        value={markdown} 
        onChange={handleChange}
        style={{ width: '50%', minHeight: '400px' }}
      />
      <div 
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ width: '50%' }}
      />
    </div>
  );
}
```

### Next.js API Route

```javascript
// pages/api/markdown.js
import quikdown from 'quikdown';

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { markdown, options = {} } = req.body;
    
    try {
      const html = quikdown(markdown, options);
      res.status(200).json({ html });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
```

## Nuxt

### Nuxt 3 Component

```vue
<!-- components/MarkdownEditor.vue -->
<template>
  <div class="markdown-editor">
    <textarea 
      v-model="markdown" 
      class="editor"
    />
    <div 
      v-html="html" 
      class="preview"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import quikdown from 'quikdown';

const markdown = ref('# Hello Nuxt 3');
const html = computed(() => quikdown(markdown.value, { inline_styles: true }));
</script>
```

### Nuxt Plugin

```javascript
// plugins/quikdown.client.js
import quikdown from 'quikdown';
import quikdown_bd from 'quikdown/bd';

export default defineNuxtPlugin(() => {
  return {
    provide: {
      quikdown,
      quikdown_bd
    }
  };
});

// Usage in component
// const { $quikdown } = useNuxtApp();
// const html = $quikdown(markdown);
```

## Common Patterns

### Debounced Updates

For better performance with large documents:

```javascript
import { debounce } from 'lodash-es'; // or your debounce implementation

const debouncedConvert = debounce((markdown, callback) => {
  const html = quikdown(markdown);
  callback(html);
}, 300);
```

### Syntax Highlighting Integration

```javascript
import quikdown from 'quikdown';
import hljs from 'highlight.js';

function highlightPlugin(code, language) {
  if (language && hljs.getLanguage(language)) {
    try {
      const result = hljs.highlight(code, { language });
      return `<pre><code class="hljs language-${language}">${result.value}</code></pre>`;
    } catch (e) {
      console.error('Highlighting failed:', e);
    }
  }
  return undefined; // Use default
}

const html = quikdown(markdown, { 
  fence_plugin: highlightPlugin 
});
```

### Sanitization

While quikdown has built-in XSS protection, you can add extra sanitization:

```javascript
import quikdown from 'quikdown';
import DOMPurify from 'dompurify';

function safeRender(markdown) {
  const html = quikdown(markdown);
  return DOMPurify.sanitize(html);
}
```

## TypeScript Support

All frameworks can benefit from quikdown's TypeScript definitions:

```typescript
import quikdown, { QuikdownOptions } from 'quikdown';
import quikdown_bd from 'quikdown/bd';

const options: QuikdownOptions = {
  inline_styles: true,
  fence_plugin: {
    render: (code: string, lang: string) => {
      // Custom plugin logic
      return `<pre class="${lang}">${code}</pre>`;
    }
  }
};

const html: string = quikdown(markdown, options);
const backToMarkdown: string = quikdown_bd.toMarkdown(html);
```

## Performance Tips

1. **Memoize conversions** - Use React.useMemo, Vue computed, or Svelte reactive statements
2. **Debounce updates** - For live editors, debounce the conversion by 200-300ms
3. **Virtual scrolling** - For very long documents, consider virtual scrolling
4. **Web Workers** - For large documents, consider moving conversion to a Web Worker
5. **Lazy loading** - Load quikdown dynamically when needed:

```javascript
// Dynamic import
const quikdown = await import('quikdown');
const html = quikdown.default(markdown);
```

## See Also

- [API Reference](./api-reference.md)
- [Plugin Guide](./plugin-guide.md)
- [Bidirectional Documentation](./quikdown-bidirectional.md)
- [Examples](../examples/)