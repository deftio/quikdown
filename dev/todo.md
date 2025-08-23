# Todo : quikdown

A small markdown to html parser with fence plugin support

> **Note**: Completed tasks have been moved to [todo_completed.md](./todo_completed.md)

## 📋 Active Todo Items

### High Priority - Missing Features:

* [ ] Add a quikdown-cli.js standalone tool that converts markdown to html. Should support all quikdown features like inline styles or passing in your own css (assumes quikdown classes)
* [ ] Add reverse fence call back (when toMarkdown() encounters a fence for which it can't parse, have option for callback.  This can be useful for mermaid and svg constructs for example
* [ ] Move to quikdown_lex as main build (move away from regex)
  - allows broader range of grammers
  - allows full spec compliance
  - easier to debug

### List Improvements
* [ ] Treat tabs as 4 spaces for indentation
* [ ] Better handling of mixed indentation

### Table Improvements
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

* [ ] Allow custom color palettes to be passed to emitStyles()
* [ ] **Bidirectional Fence Plugin Architecture** - Allow fence plugins to define reverse handlers for HTML→Markdown conversion
  ```javascript
  // Proposed API for 
  customFences: {
    'svg': {
      render: (code, lang) => { /* markdown → HTML */ },
      reverse: (element) => { /* HTML → markdown, returns {fence, lang, content} */ }
    }
  }
  ```
  - Would eliminate need for preprocessSpecialElements() function
  - Each fence type self-contained with forward and reverse logic
  - Cleaner architecture for QuikdownEditor bidirectional support
  - Fallback to data-qd-source if no reverse handler defined

* Streaming parser mode (if needed
## 📝 Notes

### Design Principles to Maintain
1. Security first - escape by default
2. Small size - keep under 10KB minified
3. Zero dependencies
4. Fast parsing - single pass where possible
5. Browser-first - but Node.js compatible

