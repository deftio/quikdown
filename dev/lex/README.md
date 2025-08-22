# QuikDown Lexer Implementation

A scanner-based lexer implementation of QuikDown that achieves 100% parity with the main version while being significantly smaller.

## Files

- `quikdown_lex_scanner.js` - Source code with Scanner and GrammarParser classes
- `quikdown_lex.js` - Built version with version injection
- `quikdown_lex.min.js` - Minified production build
- `build.js` - Build script

## Features

- **100% parity** with main QuikDown implementation
- **9.0KB minified** (36% smaller than main version's 14KB)
- Scanner-based architecture with helper methods
- Full markdown support including:
  - Headings, paragraphs, blockquotes
  - Bold, italic, strikethrough, code
  - Links, images, nested brackets
  - Lists (ordered, unordered, nested, task lists)
  - Tables with alignment
  - Code blocks with language support
  - Escape sequences
  - Edge case compatibility (including main version's bugs)

## Build

```bash
node build.js
```

## Architecture

The lexer uses a two-class design:

1. **Scanner** - Character-by-character tokenization with lookahead
2. **GrammarParser** - Recursive descent parser with helper methods:
   - `scanLine()` - scan until newline and consume it
   - `collectLines()` - gather lines while condition is met
   - `parseDelimited()` - handle symmetric delimiters (bold, italic)
   - `parseBracketed()` - handle bracketed patterns (links, images)

## Testing

The lexer passes 56/56 parity tests matching the main implementation exactly, including edge cases and quirks.