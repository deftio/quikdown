# Todo : quikdown

A small markdown to html parser with fence plugin support

> **Note**: Completed tasks have been moved to [todo_completed.md](./todo_completed.md)

## 📋 Active Todo Items

### High Priority - Missing Features:
* [x] quikdown should have a render option to support lazy linefeeds (some content emitters don't have 2 spaces before previous carriage return)
* [x] Add keywords to package.json for better NPM discoverability
* [ ] Add a quikdown-cli.js standalone tool that converts markdown to html. Should support all quikdown features like inline styles or passing in your own css (assumes quikdown classes)

### Reduce Code Size (no feature changes)
* [ ] Investigate further size optimizations (current: 8.7KB, was 7.4KB before lazy linefeeds)

### List Improvements
* [ ] Treat tabs as 4 spaces for indentation
* [ ] Better handling of mixed indentation

### Table Improvements
* [x] Fix table alignment with CSS classes - now works in both modes (fixed in v1.0.5)
* [ ] Better handling of malformed tables
* [ ] More robust table parsing edge cases

### Code Quality
* [ ] Remove buggy blockquote merge line that can strip tags (line 163 - needs investigation)
  * Current: `html.replace(/<\/blockquote>\n<blockquote>/g, '\n')`
  * Could potentially strip content between blockquotes
* [ ] Add optional error callback: `onError: (error) => {}`

### Testing
* [ ] Add edge case tests for malformed markdown
* [ ] Create fixtures for common patterns
* [ ] Add fuzz tests for robustness

### Nice to Have
* [ ] Heading IDs/slugification for in-page linking (behind option)
* [ ] Support for definition lists (maybe)
* [x] Lazy line break option (treat single \n as <br> in certain contexts)


## 🤔 Under Consideration

These items need more thought before implementation:

* [x] QuikdownEditor - Full HTML drop-in control (COMPLETED in v1.0.5)
  * ✅ Pulls in quikdown_bd and has source/split/preview views
  * ✅ Manages all deps and uses built-in styles
  * ✅ Loads hljs/mermaid dynamically
  * ✅ Has setters/getters for content
  * ✅ Copy buttons for markdown and HTML
  * ✅ onChange() and onModeChange() callbacks
  * ✅ Full API for programmatic control
  * ✅ Support for custom fence plugins via customFences option

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

### Design Principles to Maintain
1. Security first - escape by default
2. Small size - keep under 10KB minified
3. Zero dependencies
4. Fast parsing - single pass where possible
5. Browser-first - but Node.js compatible

### Current Stats (v1.0.5)

* Core Size: **8.7KB minified** (was 7.4KB, increased due to lazy linefeeds & table alignment fix)
* Bidirectional Size: **12.5KB minified** (includes core)
* Editor Size: **24.4KB minified** (includes quikdown_bd)
* Test Coverage: 97.83% statements, 92.85% functions, 98.61% lines, 92.18% branches
* Tests: 391 passing
* Dependencies: 0
* Browser Support: Modern browsers (2017+)
* Key Features Implemented: 
  * ✅ Task lists
  * ✅ URL sanitization
  * ✅ Autolinks
  * ✅ ~~~ fences (with proper line-start matching)
  * ✅ Flexible tables
  * ✅ Trailing # support
  * ✅ Light/Dark themes
  * ✅ Lazy linefeeds
  * ✅ Table alignment (all modes)
  * ✅ QuikdownEditor control
* CI/CD: GitHub Actions ready
* Documentation: Complete with API reference, security guide, plugin guide, editor guide