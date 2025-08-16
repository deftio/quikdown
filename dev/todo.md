# Todo : quikdown

A small markdown to html parser with fence plugin support


## ✅ Completed

### Documentation & Architecture
* ✅ Created comprehensive documentation in docs/ folder
* ✅ Documented security model and HTML handling via fence plugins
* ✅ Created API reference with all methods and options
* ✅ Created plugin development guide with examples
* ✅ Linked all documentation from README

### Build & Testing
* ✅ Fixed npm run build process
* ✅ Added version property to quikdown
* ✅ Achieved 100% test coverage (statements, functions, lines)
* ✅ Created Babel configuration for ES modules
* ✅ Fixed Jest configuration

### Code Quality
* ✅ Removed dead code in processTable function
* ✅ Fixed capitalization (QuikDown → quikdown)
* ✅ Created examples index.html page


## ✅ Recent Additions (Just Completed!)

### Security Enhancements
* ✅ Added URL sanitization to prevent XSS attacks
  - Blocks javascript:, data: (except data:image/*), vbscript: URLs
  - Added `allow_unsafe_urls` option for opt-in when needed
  - Added rel="noopener noreferrer" to all external links

### Parser Improvements  
* ✅ Fixed fenced code regex to allow non-word language identifiers (c++, tsx, etc.)
  - Now supports: c++, tsx, jsx, asp.net, shell-session, etc.
* ✅ Support for ~~~ fences alongside ```
* ✅ Support for autolinks - bare URLs are now clickable
* ✅ Tolerates heading trailing #'s: `## Title ##` → `<h2>`
* ✅ Tables now work without leading/trailing pipes (GFM style)

### Code Quality
* ✅ Consolidated duplicate styles to save ~200 bytes
* ✅ Fixed fence plugin fallback when returning undefined


## 📋 Todo

### High Priority - Release & CI/CD:
* [ ] Add GitHub Actions CI support
  - Run tests on push/PR
  - Check coverage thresholds
  - Build all targets
  - Run linting
* [ ] Add GitHub release script
  - Automate version tagging
  - Generate release notes from commits
  - Upload built artifacts
* [ ] Add NPM release/publish support
  - Update package.json metadata
  - Add .npmignore file
  - Create publish workflow
  - Add README badges

### List Improvements:
* [ ] Treat tabs as 4 spaces
* [ ] Better handling of mixed indentation

### Table Improvements:
* [ ] Better handling of malformed tables

### Code Quality:
* [ ] Remove buggy blockquote merge line that can strip tags (needs investigation)
* [ ] Add optional error callback: `onError: (error) => {}`

### Testing:
* [ ] Add edge case tests for malformed markdown
* [ ] Create fixtures for common patterns
* [ ] Add micro-benchmarks
* [ ] Add fuzz tests 

### Nice to Have:
* [ ] Task lists support (`- [ ]` and `- [x]`)
* [ ] Heading IDs/slugification for in-page linking (behind option)
* [ ] Support for definition lists (maybe) // what is this?


## 🤔 Under Consideration

These items need more thought before implementation:

* HTML passthrough option - Currently using fence plugins for this (safer)
* Complex emphasis (`***bold+italic***`) - May add too much complexity
* Reference-style links - Rarely used in chat/LLM context
* Footnotes - Not common in target use case
* [?] Drop lookbehind in italics regex for older Safari compatibility
d

## ❌ Won't Implement

These items go against the design philosophy:

* Full CommonMark compliance - Would bloat the codebase
* HTML blocks support - Security risk, use fence plugins instead
* Nested blockquotes with different markers - Too complex for benefit
* [?]Add customizable class prefix option (default 'quikdown-') to avoid CSS 

## 🔮 Future

* Bidirectional text support
* TypeScript definitions
* Streaming parser mode (if needed)
* Plugin marketplace/registry
* Official plugins for common use cases:
  - Syntax highlighting
  - Mermaid diagrams
  - Math (KaTeX/MathJax)
  - Social media embeds


## 📝 Notes

### Design Principles to Maintain:
1. Security first - escape by default
2. Small size - keep under 5KB minified
3. Zero dependencies
4. Fast parsing - single pass where possible
5. Browser-first - but Node.js compatible

### Current Stats:
- Size: ~8.2KB minified (includes new features)
- Test Coverage: 99.57% statements, 100% functions, 100% lines, 88.73% branches
- Dependencies: 0
- Browser Support: Modern browsers (2017+)
- New Features: URL sanitization, autolinks, ~~~ fences, flexible tables
