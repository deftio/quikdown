# QuikDown Lexer Versions Documentation

## Overview
This directory contains different implementations of a pure grammar-based lexer for QuikDown, 
designed to replace the regex-based parser with a character-by-character tokenizer.

## Directory Structure

### `/dev/lex/` - v1 Lexer (Production Ready)
- **quikdown_lex.js** - Main v1 lexer implementation (1244 lines, 14KB minified)
  - Character-by-character tokenizer
  - 100% test compatibility (31/31 tests passing)
  - Token-based state machine approach
  - No regex in core parsing logic

- **quikdown_lex.esm.min.js** - Minified ES module build
- **quikdown_lex.umd.min.js** - Minified UMD build
- **build-lex.js** - Build script for v1
- **test-runner.js** - Test runner for v1
- **quikdown_lex.test.js** - Test suite

### `/dev/lex/v2/` - v2 Scanner-based Lexer (Complete)
- **quikdown_lex_scanner.js** - Main v2 source implementation (560 lines, 8.9KB minified)
  - Scanner-based approach with clean architecture
  - 36.4% smaller than v1
  - 100% test parity with regex version
  - All functionality working

- **quikdown_lex_v2.js** - Built version with version injection
- **quikdown_lex_v2.min.js** - Minified v2
- **build-v2.js** - Build script for v2

#### v2 Grammar System (Experimental)
- **quikdown_lex_grammar.js** - Declarative grammar definition
- **quikdown_lex_compiler.js** - Grammar compiler
- **compiled-grammar.js** - Compiled grammar output (not currently used)

#### v2 Build & Test
- **build-v2.js** - Build script
- **run-full-tests.js** - Test runner

### `/dev/lex/old/` - Archived Versions
- **quikdown_lex_original.js** - Original lexer attempt
- **quikdown_lex_v1.js** - Earlier v1 iteration
- **quikdown_lex_compact.js** - Compacted version attempt

## Version Comparison

| Version | Size (min) | Test Pass | Architecture | Status |
|---------|-----------|-----------|--------------|--------|
| Regex (main) | 7.4KB | 100% | Regex-based | Production |
| Lexer v1 | 14.0KB | 100% | Token state machine | Complete |
| Lexer v2 | 8.9KB | 100% | Scanner-based | Complete |

## Key Differences

### v1 Lexer
- Pure character-by-character parsing
- No regex in core logic
- Larger size due to explicit state handling
- Full compatibility with all tests

### v2 Scanner  
- Cleaner Scanner class abstraction
- Significantly smaller codebase (8.9KB vs 14KB)
- Full feature parity with regex version
- All table classes and formatting matches exactly

## Status
v2 is now feature-complete with 100% test parity! It's 36.4% smaller than v1 and has a much cleaner architecture.

## Build Commands
```bash
# Build v1
cd /dev/lex
node build-lex.js

# Build v2
cd /dev/lex/v2
node build-v2.js

# Test v2 compatibility
node test-compatibility.js
```

## Next Steps
1. ✅ Add missing table classes to v2 - DONE
2. ✅ Fix newline formatting for exact match - DONE
3. ✅ Achieve 100% test parity - DONE
4. Consider replacing v1 with v2 (v2 is now ready for production use)