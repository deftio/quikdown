# Release Notes

## v1.0.3 (Unreleased)

### Size Optimizations
- **Major size reduction**: Reduced bundle from ~9.2KB to 7.4KB (20% reduction)
  - Moved style definitions to module-level `QUIKDOWN_STYLES` constant (single source of truth)
  - Created `createGetAttr` factory function to eliminate 4 duplicate definitions
  - Implemented replace chain arrays for cleanup patterns and inline formatting
  - Consolidated inline markdown processing patterns into arrays
- Target: Working towards <6.5KB while maintaining readability and maintainability

### Code Quality
- Eliminated style duplication between main function and `emitStyles()`
- Improved code organization with pattern arrays
- Maintained 100% test coverage during refactoring

### Developer Experience
- Added TypeScript definitions (`quikdown.d.ts`) for better IDE support
- Full type safety for options and return values
- Improved documentation with TypeScript examples

## v1.0.2 (Unreleased)

### Bug Fixes
- Fixed critical ~~~ fence regex bug that was matching fence markers in the middle of text
  - Now requires fence markers to be at the start of lines
  - Properly handles text like "## Test with ~~~" without creating empty code blocks

### Improvements
- Simplified theme styles for minimal footprint
- Updated multi-theme demo with better contrast
  - Fixed dark mode text visibility issues
  - Improved light theme code block contrast
  - Enhanced table header readability in both themes

### Documentation
- Removed hardcoded file size references from README
- Renamed main demo from `live-demo.html` to `quikdown-live.html`
- Added quikdown icon/favicon to all example pages
- Updated todo.md with current feature set

## v1.0.1 (2025-01-01)

### Bug Fixes
- Fixed README demo URL
- Version sync updates across all distribution files

### Improvements
- Minor performance optimizations
- Test coverage improvements
- Documentation updates

### Build
- Prepared CI/CD for automated releases

## v1.0.0 (2024-12-31)

### Initial Release
- Core markdown parser with CommonMark subset support
- Built-in XSS protection with HTML escaping
- URL sanitization for links and images
- Support for both ``` and ~~~ fence markers
- Flexible table parsing (with/without leading pipes)
- Task list support with checkboxes
- Autolink detection for bare URLs
- Fence plugin system for custom code block rendering
- Inline styles or CSS class output modes
- Zero dependencies
- Under 10KB minified
- 99%+ test coverage
- Works in browser and Node.js environments

### Supported Markdown Features
- Headings (H1-H6) with optional trailing #'s
- Bold, italic, strikethrough formatting
- Inline code and fenced code blocks
- Links and images with URL sanitization
- Tables with alignment support
- Ordered and unordered lists
- Nested lists
- Task lists with checkboxes
- Blockquotes
- Horizontal rules
- Line breaks (two spaces)
- Paragraphs

### Security Features
- HTML entity escaping by default
- URL sanitization blocking javascript:, vbscript:, data: protocols
- Exception for data:image/* for embedded images
- External links get rel="noopener noreferrer"
- Optional allow_unsafe_urls flag for trusted content

### API
- `quikdown(markdown, options)` - Main parser function
- `quikdown.emitStyles()` - Generate CSS for quikdown classes
- `quikdown.configure(options)` - Create configured parser
- `quikdown.version` - Version string