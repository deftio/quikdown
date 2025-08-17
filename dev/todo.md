# Todo : quikdown

A small markdown to html parser with fence plugin support

> **Note**: Completed tasks have been moved to [todo_completed.md](./todo_completed.md)

## 📋 Active Todo Items

### High Priority - Missing Features:
* [ ] quikdown should have a render option to support lazy linefeeds (some content emitters don't have 2 spaces before previous carriage return)
* [ ] Add keywords to package.json for better NPM discoverability
* [?] Add a quikdown-cli.js standalone tool that converst markdown to html.  should support all quikdown features like inline styles or passing in your own css (assumes quikdown classes)  
* [ ] Add a pure cdn example with plugins for highlightjs and mermaid

### Reduce Code Size (no feature changes)
* [x] Implemented minifier-aware optimizations (dev2-dev4)
* [x] Module-level constant hoisting (QUIKDOWN_STYLES, CLASS_PREFIX, etc.)
* [x] Optimized placeholder strings (§CB§ vs %%%CODEBLOCK%%%)
* [x] CSS string optimization (removed spaces after colons)
* [x] Build-time version injection
* [ ] Look in code to remove redundant constructs like html.replace = html.replace ... etc
* [ ] Single global built-in styles dictionary (currently duplicated)

### List Improvements:
* [ ] Treat tabs as 4 spaces for indentation
* [ ] Better handling of mixed indentation

### Table Improvements:
* [ ] Better handling of malformed tables
* [ ] More robust table parsing edge cases

### Code Quality:
* [ ] Remove buggy blockquote merge line that can strip tags (needs investigation)
* [ ] Add optional error callback: `onError: (error) => {}`

### Testing:
* [ ] Add edge case tests for malformed markdown
* [ ] Create fixtures for common patterns
* [x] Add performance benchmarks (tests/performance-benchmark.js)
  - `npm run test:perf` to run benchmarks
  - Compares regex vs lexer implementations
* [ ] Add fuzz tests for robustness

### Nice to Have:
* [ ] Heading IDs/slugification for in-page linking (behind option)
* [ ] Support for definition lists (maybe)
* [ ] Lazy line break option (treat single \n as <br> in certain contexts)

## 🤔 Under Consideration

These items need more thought before implementation:

* HTML passthrough option - Currently using fence plugins for this (safer)
* Complex emphasis (`***bold+italic***`) - May add too much complexity
* Reference-style links - Rarely used in chat/LLM context
* Footnotes - Not common in target use case
* Drop lookbehind in italics regex for older Safari compatibility
* Add customizable class prefix option (default 'quikdown-') to avoid CSS conflicts

## ❌ Won't Implement

These items go against the design philosophy:

* Full CommonMark compliance - Would bloat the codebase
* HTML blocks support - Security risk, use fence plugins instead
* Nested blockquotes with different markers - Too complex for benefit

## 🔮 Future Enhancements

* Generate theme CSS files from emitStyles() function
  - Create build script to generate quikdown.light.css and quikdown.dark.css
  - Allow custom color palettes to be passed to emitStyles()
  - Ensure proper scoping for multiple themes on same page
* Bidirectional text support
* [x] TypeScript definitions (added dist/quikdown.d.ts)
* Streaming parser mode (if needed)
* **Experimental lexer implementation** (completed, available as quikdown-lex)
  - State machine-based parser as alternative to regex
  - 100% test compatibility
  - ~13% larger, 4-8% slower
  - Better maintainability and extensibility
  - See docs/lexer-implementation.md for details
* Plugin marketplace/registry
* Official plugins for common use cases:
  - Syntax highlighting (highlight.js integration)
  - Mermaid diagrams
  - Math (KaTeX/MathJax)
  - Social media embeds

## 📝 Notes

### Design Principles to Maintain:
1. Security first - escape by default
2. Small size - keep under 10KB minified
3. Zero dependencies
4. Fast parsing - single pass where possible
5. Browser-first - but Node.js compatible

### Current Stats:
- Size: **~7.0KB minified** (optimized from 9.2KB!)
- Lexer Size: **~7.9KB minified** (experimental alternative)
- Test Coverage: 99.56% statements, 100% functions, 100% lines, 92.12% branches
- Tests: 107 passing (both implementations)
- Dependencies: 0
- Browser Support: Modern browsers (2017+)
- Key Features Implemented: 
  - ✅ Task lists
  - ✅ URL sanitization
  - ✅ Autolinks
  - ✅ ~~~ fences (with proper line-start matching)
  - ✅ Flexible tables
  - ✅ Trailing # support
  - ✅ Light/Dark themes
- CI/CD: GitHub Actions ready
- Documentation: Complete with API reference, security guide, plugin guide