# quikdown Bidirectional Converter (Experimental)

This directory contains an experimental bidirectional markdown/HTML converter based on quikdown.

## Features

- **Bidirectional conversion**: Markdown → HTML → Markdown
- **DOM walking**: Uses browser DOM API for accurate HTML parsing
- **Source preservation**: Uses `data-qd` attributes to preserve original markdown syntax
- **Editable output**: Test page allows direct editing of rendered HTML
- **Minified size**: 9.0KB (compared to ~11KB estimated)

## Files

- `quikdown-bd.js` - Main bidirectional converter module (23KB)
- `quikdown-bd.min.js` - Minified version (9.0KB)
- `quikdown-bd.esm.js` - ES Module build (43KB)
- `test-bidirectional.html` - Interactive test page with triple editors
- `test-roundtrip.html` - Automated round-trip test suite

## Usage

```javascript
// Import the module
import quikdownBD from './quikdown-bd.esm.js';

// Convert Markdown to HTML with data-qd attributes
const html = quikdownBD(markdown, { bidirectional: true });

// Convert HTML back to Markdown (DOM walking)
const markdown = quikdownBD.toMarkdown(htmlStringOrElement);
```

## Test Page

Open `test-bidirectional.html` at http://localhost:9977/exp-bd/test-bidirectional.html

Features:
- Three panels: Markdown source, HTML with data-qd, Rendered output
- Editable rendered output - changes can be converted back to markdown
- Multiple test examples (basic, complex, full features)
- Round-trip testing
- Theme switching (light/dark)

## How It Works

1. **Markdown → HTML**: Enhanced parser adds `data-qd` attributes to track source syntax
   - Headers: `<h1 data-qd="#">Title</h1>`
   - Bold: `<strong data-qd="**">text</strong>`
   - Links: `<a data-qd="[" data-qd-text="text" href="url">text</a>`

2. **HTML → Markdown**: DOM walker reconstructs markdown from HTML
   - Walks DOM tree node by node
   - Uses data-qd attributes when available
   - Falls back to inferring from tags/styles
   - Handles nested structures (lists, blockquotes)

## Supported Features

✅ Headers (H1-H6)
✅ Bold/Italic/Strikethrough
✅ Links and Images
✅ Code (inline and blocks)
✅ Lists (ordered, unordered, task lists)
✅ Tables with alignment
✅ Blockquotes
✅ Horizontal rules
✅ Line breaks

## Known Limitations

- Requires browser environment (uses DOM API)
- Some whitespace normalization occurs
- Complex nested structures may not perfectly round-trip
- Table cell content limited to plain text

## Next Steps

- Consider using quikdown-lex.js lexer for better parsing
- Add support for more complex table cell content
- Optimize for perfect round-trip preservation
- Create standalone Node.js version without DOM dependency