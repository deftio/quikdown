# Quikdown AST Libraries

The AST (Abstract Syntax Tree) libraries provide structured data output from markdown, enabling programmatic manipulation, serialization, and custom rendering.

## Overview

```
markdown → quikdown_ast → AST object
                            ↓
            ├── quikdown_json → JSON string
            ├── quikdown_yaml → YAML string
            └── quikdown_ast_html → HTML string
```

## Installation

```javascript
// ES Modules
import quikdown_ast from 'quikdown/ast';
import quikdown_json from 'quikdown/json';
import quikdown_yaml from 'quikdown/yaml';
import quikdown_ast_html from 'quikdown/ast-html';

// CommonJS
const quikdown_ast = require('quikdown/ast');
const quikdown_json = require('quikdown/json');
const quikdown_yaml = require('quikdown/yaml');
const quikdown_ast_html = require('quikdown/ast-html');
```

## CDN Usage

```html
<!-- UMD -->
<script src="https://unpkg.com/quikdown/dist/quikdown_ast.umd.min.js"></script>
<script src="https://unpkg.com/quikdown/dist/quikdown_json.umd.min.js"></script>
<script src="https://unpkg.com/quikdown/dist/quikdown_yaml.umd.min.js"></script>
<script src="https://unpkg.com/quikdown/dist/quikdown_ast_html.umd.min.js"></script>

<!-- ES Modules -->
<script type="module">
  import quikdown_ast from 'https://unpkg.com/quikdown/dist/quikdown_ast.esm.js';
</script>
```

## API

### quikdown_ast(markdown, options?)

Parses markdown into an AST object.

```javascript
const ast = quikdown_ast('# Hello **world**');
// Returns:
// {
//   type: 'document',
//   children: [{
//     type: 'heading',
//     level: 1,
//     children: [
//       { type: 'text', value: 'Hello ' },
//       { type: 'strong', children: [{ type: 'text', value: 'world' }] }
//     ]
//   }]
// }
```

### quikdown_json(markdown, options?)

Converts markdown to a JSON string.

```javascript
const json = quikdown_json('# Hello', { indent: 2 });
// Returns formatted JSON string
```

**Options:**
- `indent` (number, default: 2) - JSON indentation spaces

### quikdown_yaml(markdown, options?)

Converts markdown to a YAML string.

```javascript
const yaml = quikdown_yaml('# Hello');
// Returns:
// type: document
// children:
//   - type: heading
//     level: 1
//     children:
//       - type: text
//         value: Hello
```

### quikdown_ast_html(input, options?)

Renders AST, JSON, or YAML back to HTML.

```javascript
// From AST object
const html = quikdown_ast_html(ast);

// From JSON string
const html = quikdown_ast_html(jsonString);

// From YAML string
const html = quikdown_ast_html(yamlString);

// From markdown (auto-detected)
const html = quikdown_ast_html('# Hello');
```

**Options:**
- `inline_styles` (boolean, default: false) - Use inline styles instead of CSS classes

## AST Node Types

### Document (root)

```javascript
{
  type: 'document',
  children: [/* block nodes */]
}
```

### Block Elements

#### Heading

```javascript
{
  type: 'heading',
  level: 1,  // 1-6
  children: [/* inline nodes */]
}
```

#### Paragraph

```javascript
{
  type: 'paragraph',
  children: [/* inline nodes */]
}
```

#### Code Block

```javascript
{
  type: 'code_block',
  lang: 'javascript',  // or null
  content: 'console.log("hi");',
  fence: '```'  // or '~~~'
}
```

#### Blockquote

```javascript
{
  type: 'blockquote',
  children: [/* block nodes */]
}
```

#### List

```javascript
{
  type: 'list',
  ordered: false,  // true for numbered lists
  items: [/* list_item nodes */]
}
```

#### List Item

```javascript
{
  type: 'list_item',
  checked: null,  // null, true, or false for task lists
  children: [/* inline nodes or nested list */]
}
```

#### Table

```javascript
{
  type: 'table',
  headers: [[/* inline nodes */], ...],  // array of cell contents
  rows: [[[/* inline nodes */], ...], ...],  // array of rows, each with cells
  alignments: ['left', 'center', 'right', null]  // per-column alignment
}
```

#### Horizontal Rule

```javascript
{
  type: 'hr'
}
```

### Inline Elements

#### Text

```javascript
{
  type: 'text',
  value: 'plain text'
}
```

#### Strong (bold)

```javascript
{
  type: 'strong',
  children: [/* inline nodes */]
}
```

#### Emphasis (italic)

```javascript
{
  type: 'em',
  children: [/* inline nodes */]
}
```

#### Strikethrough

```javascript
{
  type: 'del',
  children: [/* inline nodes */]
}
```

#### Inline Code

```javascript
{
  type: 'code',
  value: 'code text'
}
```

#### Link

```javascript
{
  type: 'link',
  url: 'https://example.com',
  children: [/* inline nodes */]
}
```

#### Image

```javascript
{
  type: 'image',
  url: 'image.png',
  alt: 'Alt text'
}
```

#### Line Break

```javascript
{
  type: 'br'
}
```

## Forgiving Parser Behaviors

The AST parser is designed to be forgiving and handle edge cases gracefully:

1. **Line endings** - Handles CRLF, CR, and LF uniformly
2. **Tables** - Accepts tables without outer pipes, misaligned columns
3. **Code fences** - Accepts mismatched fences (``` with ~~~)
4. **Lists** - Accepts varying indentation (1-4 spaces per level)
5. **Links** - Trims whitespace in URLs: `[text](  url  )`
6. **Unclosed elements** - Gracefully handles unclosed formatting
7. **Loop protection** - Built-in safeguards against malformed nested structures

## Example: Custom Rendering

```javascript
import quikdown_ast from 'quikdown/ast';

function renderToCustomFormat(node) {
  switch (node.type) {
    case 'document':
      return node.children.map(renderToCustomFormat).join('');
    case 'heading':
      return `<Heading level={${node.level}}>${renderChildren(node)}</Heading>`;
    case 'paragraph':
      return `<Para>${renderChildren(node)}</Para>`;
    case 'text':
      return node.value;
    // ... handle other node types
    default:
      return '';
  }
}

function renderChildren(node) {
  return (node.children || []).map(renderToCustomFormat).join('');
}

const ast = quikdown_ast('# Hello\n\nWorld');
const custom = renderToCustomFormat(ast);
```

## Example: Transforming AST

```javascript
import quikdown_ast from 'quikdown/ast';
import quikdown_ast_html from 'quikdown/ast-html';

// Parse markdown
const ast = quikdown_ast('# Hello World');

// Transform: make all headings one level deeper
function transformHeadings(node) {
  if (node.type === 'heading') {
    node.level = Math.min(node.level + 1, 6);
  }
  if (node.children) {
    node.children.forEach(transformHeadings);
  }
  if (node.items) {
    node.items.forEach(transformHeadings);
  }
  return node;
}

const transformed = transformHeadings(ast);
const html = quikdown_ast_html(transformed);
// <h2>Hello World</h2>
```

## TypeScript Support

TypeScript definitions are included:

```typescript
import quikdown_ast, { ASTNode, DocumentNode } from 'quikdown/ast';

const ast: DocumentNode = quikdown_ast('# Hello');
```
