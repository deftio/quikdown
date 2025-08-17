# Release Notes

## v1.0.3 (2025-08-17)

### Major Size Optimizations
- **Achieved 24% size reduction**: Bundle now ~7.0KB (down from 9.2KB)
  - Implemented minifier-aware optimizations across dev2-dev4 phases
  - Module-level constant hoisting (QUIKDOWN_STYLES, CLASS_PREFIX, PLACEHOLDER_CB, ESC_MAP)
  - Optimized placeholder strings (§CB§ vs %%%CODEBLOCK%%%)
  - CSS string optimization (removed spaces after colons)
  - Build-time version injection instead of runtime imports
  - Shorter variable names in critical paths
  - Eliminated duplicate getAttr functions

### Experimental Lexer Implementation
- Developed alternative state-machine based parser (`quikdown-lex`)
  - Available as separate build: `npm run build:lex`
  - 100% test compatibility with regex implementation
  - ~7.9KB minified (0.9KB larger than regex version)
  - 4-8% slower but more maintainable architecture
  - Better suited for future features like streaming or AST generation
  - Comprehensive documentation in `docs/lexer-implementation.md`

### Build System Improvements
- Fixed sourcemap warnings in Rollup configuration
- Separated lexer build from main distribution
- Added performance benchmarking: `npm run test:perf`
- Test coverage now properly tracks dist files (99.56% coverage)

### Developer Experience
- Added TypeScript definitions (`dist/quikdown.d.ts`)
  - Full type safety for options and return values
  - Comprehensive JSDoc comments
  - Compatible with all modern IDEs
- Created performance benchmark suite
  - Compares regex vs lexer implementations
  - Tests both small (400 char) and large (22KB) documents
  - Memory usage tracking capabilities

### Code Quality
- Eliminated style duplication between main function and `emitStyles()`
- Improved code organization with pattern arrays
- Fixed test configuration to measure dist files instead of src
- Maintained high test coverage (99.56% statements, 92.12% branches)

### CSS Theme System Improvements
- **Container-based theme scoping**: Themes now use parent-child selectors
  - Light theme: `.quikdown-light .quikdown-h1 { ... }`
  - Dark theme: `.quikdown-dark .quikdown-h1 { ... }`
  - Allows multiple themes on the same page without conflicts
- **Explicit color properties for robustness**: Both themes now specify text colors
  - Light theme explicitly sets `color: #333` for all text elements
  - Dark theme sets `color: #e0e0e0` for light text on dark backgrounds
  - Prevents inheritance issues when deployed on pages with custom styles
- **CSS generation from emitStyles()**: All theme CSS generated directly from JS
  - `npm run build:css` generates theme files from `emitStyles('quikdown-', 'light/dark')`
  - `npm run minify:css` creates production-ready minified versions
  - Single source of truth for styles in JavaScript
- **Auto dark mode support**: Dark CSS includes media query for system preferences
  - `.quikdown-auto` class automatically applies dark theme when `prefers-color-scheme: dark`
- **Theme file organization**:
  - `dist/quikdown.light.css` - Light theme (3.2KB)
  - `dist/quikdown.dark.css` - Dark theme with auto mode (4.3KB)
  - Minified versions: 1.9KB and 2.6KB respectively

### Documentation
- Added comprehensive lexer implementation guide
- Updated todo.md with current progress
- Added experimental feature note to README
- Created detailed architecture documentation
- CSS theme generation tools in `tools/generateThemeCSS.js`

## v1.0.2 

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

## v1.0.1 (2025-08-09)

### Bug Fixes
- Fixed README demo URL
- Version sync updates across all distribution files

### Improvements
- Minor performance optimizations
- Test coverage improvements
- Documentation updates

### Build
- Prepared CI/CD for automated releases

## v1.0.0 

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