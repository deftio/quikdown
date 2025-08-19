# Release Notes

## v1.0.5dev1 (In Development)

### 🎉 Major Architecture Refactor

#### Complete Bidirectional Module Refactoring
- **Successfully refactored `quikdown_bd`** to import and extend core `quikdown` module
- **Eliminated ~800 lines of duplicate code** by using core module as base
- **Core `quikdown` module** now includes `bidirectional` option to emit `data-qd` attributes
- **`quikdown_bd` module** simplified to ~300 lines (from ~1100 lines)
- Maintains 100% backward compatibility with existing API

### 📊 Test Coverage Achievements
- **Achieved 99.5%+ overall test coverage**
- **`quikdown.esm.js`**: 100% line coverage, 100% branch coverage
- **`quikdown_bd.esm.js`**: 99.47% line coverage (remaining are build artifacts)
- **353 tests** all passing
- Added comprehensive test suites for:
  - Bidirectional conversion round-trips
  - Edge cases and malformed inputs
  - URL sanitization with various protocols
  - Fence plugin behaviors with custom renderers
  - Table alignment with inline styles
  - Nested list structures
  - Task list checkbox states
  - Empty and null inputs
  - DOM element conversions

### 🔧 Build System Improvements
- **Fixed CSS regeneration issue**: CSS files now use version number instead of timestamp
  - Prevents CSS files from appearing modified on every build
  - CSS only regenerates when version changes
- **Improved bundle sizes**:
  - QuikDown Core: 8.0 KB minified
  - QuikDown BD: 11.7 KB minified (includes core)

### 📚 Documentation Updates

#### API Documentation
- Added `bidirectional` option to core quikdown API reference
- Added `allow_unsafe_urls` option documentation
- Clarified that `quikdown_bd` automatically sets `bidirectional: true`
- Updated examples to reflect new architecture

#### Bidirectional Documentation
- Explained new `bidirectional` option in core module
- Clarified differences between `quikdown` and `quikdown_bd`
- Updated usage examples

### 🛠️ Technical Improvements
- **Module imports**: Converted all tests from CommonJS to ESM imports
- **Dead code elimination**: Removed unreachable code paths identified through coverage analysis
- **Logic simplification**: Fixed redundant conditions in strong/em/del element processing
- **Istanbul pragmas**: Added appropriate coverage pragmas for defensive code and build artifacts
- **Performance**: Maintained same performance characteristics despite architectural changes

### 🧹 Code Organization
- Moved experimental lexer files from `src/exp-lexer/` to `dev/exp-lexer/`
- Kept `src/` directory for production code only
- Added file size reporting tool (`tools/printSizes.cjs`)
- Updated bidir-fixes.md documentation with completion status

## v1.0.4 (2025-08-18)

### 🎉 Major Feature: Bidirectional Conversion Support

#### New `quikdown_bd` Module
- **HTML to Markdown conversion**: Convert HTML back to Markdown with high fidelity
- **Round-trip preservation**: Maintains original markdown formatting through conversion cycles
- **Smart source tracking**: Uses `data-qd` attributes to preserve original markdown syntax
- **DOM-based conversion**: Walks the DOM tree for accurate HTML-to-Markdown transformation
- **Bundle size**: 10KB minified (compared to 7.4KB for core quikdown)

#### Bidirectional API
- `quikdown_bd(markdown, options)` - Markdown to HTML with source tracking
- `quikdown_bd.toMarkdown(htmlOrElement)` - Convert HTML or DOM element back to Markdown
- `quikdown_bd.configure(options)` - Create configured bidirectional parser
- `quikdown_bd.version` - Version string (synced with core)

#### Use Cases
- **WYSIWYG Editors**: Build rich-text editors that store content as Markdown
- **Live Preview**: Edit in either Markdown or rendered view with real-time sync
- **Content Migration**: Convert existing HTML content to Markdown
- **Collaborative Editing**: Enable rich-text editing while maintaining Markdown storage

### 📦 Package Improvements

#### Module Exports
- Added `exports` field in package.json for clean imports:
  ```javascript
  import quikdown from 'quikdown';        // Core parser
  import quikdown_bd from 'quikdown/bd';  // Bidirectional parser
  ```
- Multiple format support: ESM, UMD, CommonJS for both modules
- TypeScript definitions for both core and bidirectional modules

#### Build System
- Integrated `quikdown_bd` into Rollup build pipeline
- Generates all format variants (ESM, UMD, CJS, minified)
- Source maps for all production builds
- Version injection at build time for both modules

### 📚 Documentation

#### New Documentation
- **Framework Integration Guide** (`docs/framework-integration.md`)
  - React (hooks, components, Next.js)
  - Vue (Composition API, Options API, Nuxt)
  - Svelte (stores, reactive statements)
  - Angular (components, services, pipes)
  - Complete examples with bidirectional support
- **Bidirectional Documentation** (`docs/quikdown-bidirectional.md`)
  - Comprehensive guide for HTML-to-Markdown conversion
  - API reference and examples
  - Limitations and best practices

#### Documentation Updates
- Updated README with bidirectional module information
- Added clear distinction between `quikdown` and `quikdown_bd` modules
- Added module comparison table in API reference
- Updated all version references to 1.0.4

### 🧪 Testing

#### Test Suite Expansion
- Added 35 new tests for bidirectional functionality
- Integrated jsdom for DOM-based testing in Node.js
- Fixed TextEncoder/TextDecoder compatibility for Node.js 18+
- Suppressed punycode deprecation warnings from jsdom
- All 144 tests passing (109 core + 35 bidirectional)

#### Test Coverage
- Core quikdown: 99.58% statement coverage
- 100% line coverage maintained
- 92.3% branch coverage

### 🎨 Examples

#### New Examples
- **Bidirectional Editor** (`examples/quikdown-bd-editor.html`)
  - Full-featured WYSIWYG markdown editor
  - Real-time bidirectional sync
  - Mermaid diagram support
  - Theme toggling
- **Bidirectional Basic** (`examples/quikdown-bd-basic.html`)
  - Simple demonstration of round-trip conversion
  - Side-by-side Markdown, HTML, and rendered views
  - Test suite integration

#### Example Updates
- All examples now use consistent favicon (`favicon.svg`)
- Updated script paths to use distribution files
- Added bidirectional demos to examples index

### 🐛 Bug Fixes
- Fixed mermaid diagram rendering in bidirectional mode
- Fixed checkbox state preservation in task lists
- Fixed scrolling issues in example editors
- Fixed CSS layout for multi-panel editors

### 🔧 Technical Details

#### Bidirectional Implementation
- Standalone module (doesn't import core quikdown)
- Feature parity with core parser
- DOM walking algorithm for HTML parsing
- Preserves markdown source indicators through `data-qd` attributes
- Handles nested structures and special cases

#### Bundle Sizes
- `quikdown.min.js`: 7.4KB (core parser)
- `quikdown_bd.min.js`: 10KB (bidirectional)
- Both maintain zero dependencies

### 🚀 Migration Guide

#### Upgrading from 1.0.3
- No breaking changes for existing `quikdown` usage
- To add bidirectional support:
  ```javascript
  // Change from:
  import quikdown from 'quikdown';
  
  // To:
  import quikdown_bd from 'quikdown/bd';
  
  // Then use toMarkdown:
  const markdown = quikdown_bd.toMarkdown(html);
  ```

#### Browser Usage
```html
<!-- Core only -->
<script src="https://unpkg.com/quikdown@1.0.4/dist/quikdown.umd.min.js"></script>

<!-- Bidirectional -->
<script src="https://unpkg.com/quikdown@1.0.4/dist/quikdown_bd.umd.min.js"></script>
```

### 📝 Notes
- The `toMarkdown()` method is only available in `quikdown_bd`, not in regular `quikdown`
- Bidirectional conversion requires a DOM environment (use jsdom in Node.js)
- Round-trip conversion may normalize some markdown formatting
- Mermaid diagrams are preserved but not editable in rendered view

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