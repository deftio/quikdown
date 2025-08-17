# QuikDown Lexer Implementation (Experimental)

## Overview

The QuikDown lexer implementation (`quikdown-lex`) is an experimental alternative parser that uses a hand-coded state machine approach instead of regular expressions. While the primary regex-based implementation remains the recommended version, the lexer provides an interesting alternative architecture that may become the foundation for future versions.

**Current Status:** Experimental - passes all tests but is ~1KB larger and 4-8% slower than the regex version.

## Installation and Usage

The lexer implementation is built separately from the main distribution:

```bash
# Build the lexer implementation
npm run build:lex

# Run performance comparison
npm run test:perf
```

### Using the Lexer Version

```javascript
// ESM
import quikdown from 'quikdown/dist/quikdown-lex.esm.js';

// CommonJS
const quikdown = require('quikdown/dist/quikdown-lex.cjs');

// Browser (UMD)
<script src="quikdown/dist/quikdown-lex.umd.min.js"></script>
```

The API is identical to the main implementation:

```javascript
const html = quikdown(markdownText, {
  inline_styles: false,
  class_prefix: 'quikdown-',
  allow_unsafe_urls: false,
  fence_plugin: null
});
```

## Architecture Deep Dive

### State Machine Design

The lexer implementation processes markdown line-by-line using a finite state machine with the following states:

```javascript
const STATE_NORMAL = 0;      // Default state, ready for any block element
const STATE_FENCE = 1;       // Inside a code fence block
const STATE_LIST = 2;        // Processing list items (unused - lists handled atomically)
const STATE_TABLE = 3;       // Processing table rows (unused - tables handled atomically)
const STATE_BLOCKQUOTE = 4;  // Inside a blockquote
const STATE_PARAGRAPH = 5;   // Accumulating paragraph lines
```

### Line Classification

Each line is classified into one of these types:

```javascript
const LINE_BLANK = 0;           // Empty line
const LINE_HEADING = 1;         // # Heading
const LINE_HR = 2;              // --- horizontal rule
const LINE_FENCE = 3;           // ``` code fence
const LINE_BLOCKQUOTE = 4;      // > blockquote
const LINE_LIST_UNORDERED = 5;  // - list item
const LINE_LIST_ORDERED = 6;    // 1. list item
const LINE_TABLE = 7;           // | table | row |
const LINE_TABLE_SEP = 8;       // |---|---|
const LINE_TEXT = 9;            // Regular text
```

### Processing Flow

1. **Line-by-Line Parsing**
   ```javascript
   const lines = markdown.split('\n');
   let state = STATE_NORMAL;
   let i = 0;
   
   while (i < lines.length) {
     const line = lines[i];
     const lineType = getLineType(line);
     
     // State machine handles transitions
     switch (state) {
       case STATE_NORMAL:
         // Can transition to any state
         break;
       case STATE_PARAGRAPH:
         // Accumulate or end paragraph
         break;
       // ... other states
     }
   }
   ```

2. **Line Type Detection**
   - Uses optimized character-based discrimination
   - First character check for quick classification
   - Regex patterns only when necessary

   ```javascript
   const getLineType = (line) => {
     const trimmed = line.trim();
     if (!trimmed) return LINE_BLANK;
     
     const firstChar = trimmed[0];
     switch (firstChar) {
       case '#': 
         if (/^#{1,6}\s+/.test(trimmed)) return LINE_HEADING;
         break;
       case '-':
       case '*':
       case '_':
         // Could be HR or list
         if (/^[-*_](\s*[-*_]){2,}$/.test(trimmed)) return LINE_HR;
         if (/^[*+-]\s+/.test(trimmed)) return LINE_LIST_UNORDERED;
         break;
       // ... more cases
     }
   };
   ```

3. **Block Element Processing**

   **Lists:** Processed atomically with stack-based nesting
   ```javascript
   const processList = (startIdx) => {
     const listStack = []; // Stack of { type, indent, items }
     // Process all consecutive list items
     // Handle nesting via indentation
     // Return next line index to process
   };
   ```

   **Tables:** Require separator line for validation
   ```javascript
   const processTable = (startIdx) => {
     // Parse header row
     // Check for separator (required)
     // Parse body rows
     // Generate complete table HTML
   };
   ```

   **Blockquotes:** Accumulate and recursively process
   ```javascript
   const flushBlockquote = () => {
     if (blockquoteBuffer.length === 1) {
       // Simple single-line blockquote
       output.push(`<blockquote>${processInline(content)}</blockquote>`);
     } else {
       // Multi-line - recursively parse content
       const innerHtml = quikdown(innerContent, opts);
       output.push(`<blockquote>${innerHtml}</blockquote>`);
     }
   };
   ```

4. **Inline Processing**
   - Single-pass transformation with temporary markers
   - Code spans extracted first to protect content
   - Control characters (\x01, \x02) as placeholders
   - Sequential regex replacements for formatting

### Key Optimizations

1. **Character-Based Line Classification**
   - First character discrimination reduces regex usage
   - Switch statements for O(1) branching
   - Lazy regex compilation

2. **Minimal Memory Allocation**
   - Reuses buffers where possible
   - Direct string concatenation for small operations
   - Stack-based list processing

3. **Single-Pass Inline Processing**
   - Extracts code spans first
   - Sequential replacements without re-parsing
   - Efficient placeholder system

## Performance Comparison

Based on benchmark testing with both small (400 char) and large (22KB) documents:

| Metric | Regex Version | Lexer Version | Difference |
|--------|--------------|---------------|------------|
| **Bundle Size** | 7.0KB | 7.9KB | +0.9KB (+13%) |
| **Small Docs** | 27,429 ops/sec | 25,397 ops/sec | -7.4% |
| **Large Docs** | 727 ops/sec | 697 ops/sec | -4.1% |
| **Memory Usage** | Baseline | Similar | ~0% |

### Performance Analysis

The lexer is slightly slower due to:
- Additional function call overhead for state transitions
- More granular line-by-line processing
- Stack management for nested structures

However, it offers advantages in:
- Code maintainability and debugging
- Predictable performance characteristics
- Easier to extend with new features
- Better error recovery potential

## Advantages of the Lexer Approach

1. **Maintainability**
   - Clear state machine logic
   - Explicit state transitions
   - Easier to debug and trace execution

2. **Extensibility**
   - Adding new block types is straightforward
   - State machine can be extended without affecting other states
   - Plugin points are more obvious

3. **Error Recovery**
   - Can potentially recover from malformed markdown
   - State machine can reset to known good state
   - Better position tracking for error messages

4. **Predictable Performance**
   - O(n) complexity for document length
   - No catastrophic backtracking
   - Consistent performance across input types

## Disadvantages

1. **Code Size**
   - More verbose than regex patterns
   - Explicit state management code
   - Results in ~13% larger bundle

2. **Performance**
   - 4-8% slower on typical documents
   - More function calls and state checks
   - Additional overhead from line-by-line processing

3. **Complexity**
   - Requires understanding of state machines
   - More moving parts than regex approach
   - Harder to make quick fixes

## Future Potential

The lexer implementation could become the primary version if:

1. **Performance improvements** through:
   - WebAssembly compilation
   - Further optimization of hot paths
   - Reduced function call overhead

2. **Size reduction** through:
   - More aggressive minification strategies
   - Shared code extraction
   - Compile-time optimizations

3. **Feature requirements** that favor state machines:
   - Incremental parsing
   - Streaming support
   - Better error messages
   - AST generation

## Testing

The lexer implementation passes all 107 tests in the QuikDown test suite:

```bash
# Run tests against lexer implementation
npm run build:lex
npm test  # Uses main implementation
# To test lexer specifically, import it in test files
```

## Migration Guide

If the lexer becomes the primary implementation, migration would be seamless:

1. The API is 100% compatible
2. All options work identically
3. Output HTML is identical (except whitespace)
4. No code changes required

## Contributing

If you're interested in improving the lexer implementation:

1. Focus on performance optimizations
2. Maintain 100% test compatibility
3. Document any architectural changes
4. Run performance benchmarks before/after

## Conclusion

The lexer implementation represents a different architectural approach to markdown parsing. While currently experimental and slightly slower, it provides a solid foundation for future development and demonstrates that QuikDown's test suite and API can support multiple implementation strategies.

For production use, continue using the main regex-based implementation. The lexer is available for experimentation and evaluation by developers interested in alternative parsing strategies.