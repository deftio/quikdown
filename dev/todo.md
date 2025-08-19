# Todo : quikdown

A small markdown to html parser with fence plugin support

> **Note**: Completed tasks have been moved to [todo_completed.md](./todo_completed.md)

## 📋 Active Todo Items

### High Priority - Missing Features:
* [x] quikdown should have a render option to support lazy linefeeds (some content emitters don't have 2 spaces before previous carriage return)
* [x] Add keywords to package.json for better NPM discoverability
* [?] Add a quikdown-cli.js standalone tool that converst markdown to html.  should support all quikdown features like inline styles or passing in your own css (assumes quikdown classes)  
* [x] Add a pure cdn example with plugins for highlightjs and mermaid

### Reduce Code Size (no feature changes)
* [ ] Investigate further size optimizations (target: < 7KB)

### List Improvements:
* [ ] Treat tabs as 4 spaces for indentation
* [ ] Better handling of mixed indentation

### Table Improvements:
* [x] Fix table alignment with CSS classes - now works in both modes (fixed in v1.0.5)
* [ ] Better handling of malformed tables
* [ ] More robust table parsing edge cases

### Code Quality:
* [ ] Remove buggy blockquote merge line that can strip tags (line 163 - needs investigation)
  - Current: `html.replace(/<\/blockquote>\n<blockquote>/g, '\n')`
  - Could potentially strip content between blockquotes
* [ ] Add optional error callback: `onError: (error) => {}`

### Testing:
* [ ] Add edge case tests for malformed markdown
* [ ] Create fixtures for common patterns
* [ ] Add fuzz tests for robustness

### Nice to Have:
* [ ] Heading IDs/slugification for in-page linking (behind option)
* [ ] Support for definition lists (maybe)
* [x] Lazy line break option (treat single \n as <br> in certain contexts)


## 🤔 Under Consideration

These items need more thought before implementation:

* [ ] make a js control quikdown_edit.js which is a full html drop in control.  with example
  * should pull in quikdown and have src/split/rendered views in a single div via buttons
  * manages all deps or uses built-in styles
  * has option to load hljs,mermaid,etc dynmacally in constructor
  * has setters/getters for source content 
  * copy buttons for source, editor content
  * onChange() for either source or html
  * all controls have an api so editor can be programmatically controlled

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

* [ ] Allow custom color palettes to be passed to emitStyles()
* Bidirectional text support
* Streaming parser mode (if needed)
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

### Current Stats (v1.0.3):
- Size: **~7.4KB minified** (optimized from 9.2KB!)
- Lexer Size: **~8.3KB minified** (experimental alternative)
- Test Coverage: 99.58% statements, 100% functions, 100% lines, 92.3% branches
- Tests: 109 passing (both implementations)
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