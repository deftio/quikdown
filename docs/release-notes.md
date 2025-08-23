# Release Notes

## v1.1.0 (2025-08-23)

### 💥 Breaking Changes

#### Fence Plugin API Redesign
- **Object format required**: Fence plugins must now use object format with `render` function (breaking change from v1.0.x)
- **Bidirectional support**: Added optional `reverse` handler for HTML-to-markdown conversion
- **Data attributes**: Automatic data-qd-* attributes for roundtrip conversion
- **Better TypeScript**: Clean interface definition with FencePlugin type

**Migration:**
```javascript
// OLD (v1.0.x) - No longer supported
const plugin = (content, lang) => '<pre>' + content + '</pre>';

// NEW (v1.1.0) - Required format
const plugin = {
  render: (content, lang) => '<pre>' + content + '</pre>',
  reverse: (element) => ({ // Optional
    fence: '```',
    lang: 'custom',
    content: element.textContent
  })
};
```

### 🎯 New Features

#### Bidirectional Fence Plugins
- **Reverse handlers**: Custom fence plugins can now convert HTML back to markdown
- **Perfect roundtrips**: Maintain custom content through edit cycles
- **Fallback support**: Automatic data-qd-source preservation when no reverse handler
- **Plugin ecosystem ready**: Enables rich bidirectional plugins for mermaid, math, etc.

#### Editor Enhancements
- **Remove HR button**: New toolbar button to remove horizontal rules (---) from markdown
- **API method**: `removeHR()` method to programmatically remove all horizontal rules
- **Configurable display**: `showRemoveHR` option (default: false) to show/hide button
- **LLM-friendly**: Helps clean up markdown from AI-generated content

### 📦 Bundle Sizes
- **QuikDown Core**: 9.0 KB minified (from 9.1 KB in v1.0.6)
- **QuikDown Bidirectional**: 13.8 KB minified
- **QuikDown Editor**: 37.8 KB minified
- **CSS Themes**: Light 1.9 KB, Dark 2.6 KB minified

### 🔬 Experimental Features

#### Lexer/Grammar-Based Parser Achievement
- **100% Test Parity**: The experimental trie-based lexer parser in `dev/lex/` now passes all 20 core tests
- **Compact Implementation**: Achieved 9.9KB minified size using a compiled trie/DFA structure
- **Grammar-Driven Architecture**: Formal EBNF grammar compiled to efficient state machine
- **Future Foundation**: Provides basis for future extensibility and custom grammar rules

### 🐛 Bug Fixes

#### Horizontal Rule Parsing
- **Fixed HR with trailing spaces**: HR pattern now accepts trailing whitespace (e.g., `---  `)
- **Prevents editor jumping**: Fixes cursor jumping when typing `---` in the editor
- **More forgiving**: Matches common user input patterns

#### HTML-to-Markdown Roundtrip Conversion
- **Fixed missing `<p>` tags**: Paragraphs following headings were missing opening `<p>` tags, causing invalid HTML
- **Preserved blank lines**: Fixed issue where blank lines between paragraphs and headings were lost during roundtrip conversion
- **Improved paragraph handling**: Added proper detection of trailing whitespace lines within paragraphs to maintain formatting intent
- **Perfect roundtrip fidelity**: The bidirectional module now maintains exact markdown formatting through HTML and back

### 🔧 QuikdownEditor Improvements

#### Performance and Responsiveness
- **Reduced debounce delay**: Changed default from 100ms to 20ms for much snappier editor response
- **Configurable debounce**: Added `setDebounceDelay()` and `getDebounceDelay()` API methods
- **Zero-delay option**: Support for instant updates with `debounceDelay: 0`

#### Styling Flexibility
- **Inline styles support**: Added `inline_styles` option pass-through to quikdown_bd
- **Parent div styling**: Enables CSS cascade from parent containers when using class-based styles
- **Choice of styling**: Users can now choose between CSS classes (default) or inline styles

### 🧪 Testing & Quality Improvements

#### Comprehensive Test Coverage Boost
- **QuikDown Core**: Achieved **100% line coverage**, 99.26% statement coverage, 99.42% branch coverage
- **QuikDown Editor**: Improved from 47% to **62% statement coverage**, 75.8% function coverage
- **Test Suite**: 512 total tests (507 passing, 5 skipped due to jsdom limitations)
- **Added 38 new editor tests**: Covering toolbar actions, plugin loading, advanced features, and edge cases

#### Coverage Achievements
- **Core module (quikdown.esm.js)**: 
  - Lines: 100% ✅
  - Statements: 99.26% ✅
  - Branches: 99.42% ✅
  - Functions: 97.36% ✅
- **Bidirectional module (quikdown_bd.esm.js)**:
  - Lines: 94.35%
  - Statements: 93.82%
  - Functions: 89.58%
- **Editor module (quikdown_edit.esm.js)**:
  - Lines: 63.17% (up from 48.23%)
  - Statements: 61.98% (up from 47.46%)
  - Functions: 75.8% (up from 62.9%)

#### Testing Infrastructure
- **Dynamic Version Testing**: Version tests now dynamically check against `package.json` instead of hardcoded values
- **Automated compatibility**: Tests automatically work with any version number without manual updates
- **Fence plugin test migration**: All tests updated to use new v1.1.0 object format
- **Bidirectional coverage**: Added tests for fence plugins with and without reverse handlers

## v1.0.5 (2025-08-19)

### 🚀 New: Quikdown Editor

#### Drop-in Markdown Editor Control
- **New `QuikdownEditor` class**: Complete markdown editor that can be embedded in any webpage
- **Three view modes**: Source-only, Split view, and Preview-only modes
- **Bidirectional editing**: Edit markdown or preview and see changes sync in real-time
- **Plugin support**: Built-in integration with Highlight.js and Mermaid
- **Theme support**: Light, dark, and auto themes that follow system preferences
- **Keyboard shortcuts**: Quick mode switching with Ctrl/Cmd+1/2/3
- **Toolbar actions**: Copy markdown or HTML to clipboard with one click
- **Mobile responsive**: Automatically adapts layout for mobile devices
- **Bundle size**: 35.8KB minified (includes embedded quikdown_bd and fence plugins)

#### Editor API
- Simple constructor: `new QuikdownEditor(container, options)`
- Methods: `setMarkdown()`, `getMarkdown()`, `getHTML()`, `setMode()`, `setLazyLinefeeds()`, `destroy()`
- Properties: `markdown`, `html`, `mode`
- Callbacks: `onChange`, `onModeChange`
- **Custom fence plugins**: Support for custom fence renderers via `customFences` option
- Full documentation in `docs/quikdown-editor.md`

#### Built-in Lazy-Loading Fence Plugins
- **SVG**: Inline SVG rendering with validation and XSS protection
- **HTML**: Safe HTML rendering with DOMPurify (auto-loaded from CDN)
- **Math/KaTeX**: Mathematical equations with KaTeX (auto-loaded from CDN)
- **CSV/PSV/TSV**: Data tables with smart parsing and bidirectional editing support
- **JSON**: Syntax-highlighted JSON with validation
- **Mermaid**: Diagram rendering (when plugin enabled)
- **Custom fences**: Support for user-defined fence handlers with fallback behavior
- All fence types properly preserve content during bidirectional editing with `data-qd-source` attributes

#### Editor Examples
- **Full-featured demo**: `examples/qde/index.html`
- **CDN usage example**: `examples/quikdown-editor-cdn.html`
- **Simple 5-line setup**: `examples/quikdown-editor-simple.html`
- Multiple integration examples in documentation

#### Testing & Quality Improvements
- **Comprehensive test suite**: Added 51 tests for QuikdownEditor with 65% line coverage, 75% function coverage
- **Fixed ESM imports**: Added CommonJS exports to support Jest testing of ESM builds
- **CI/CD ready**: All tests pass with no console errors, Playwright tests properly excluded from Jest
- **Coverage thresholds**: Set realistic targets (60% statements, 70% functions) for editor module

### 🎉 Major Architecture Refactor

#### Complete Bidirectional Module Refactoring
- **Successfully refactored `quikdown_bd`** to import and extend core `quikdown` module
- **Eliminated ~800 lines of duplicate code** by using core module as base
- **Core `quikdown` module** now includes `bidirectional` option to emit `data-qd` attributes
- **`quikdown_bd` module** simplified to ~300 lines (from ~1100 lines)
- Maintains 100% backward compatibility with existing API

### 📊 Test Coverage Achievements
- **Achieved 98%+ overall test coverage**
- **`quikdown.esm.js`**: 100% line coverage, 99.4% branch coverage
- **`quikdown_bd.esm.js`**: 97.75% line coverage, 89.36% function coverage
- **`quikdown_edit.esm.js`**: 64.88% line coverage, 75.42% function coverage
- **467 total tests** all passing (including comprehensive editor and fence plugin tests)
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
  - QuikdownEditor build verification (14 tests)

### 🔧 Build System Improvements
- **Fixed CSS regeneration issue**: CSS files now use version number instead of timestamp
  - Prevents CSS files from appearing modified on every build
  - CSS only regenerates when version changes
- **Fixed Jest testing**: Excluded Playwright tests from Jest runs to prevent CI failures
- **Bundle sizes** (v1.0.5):
  - Quikdown Core: 8.7 KB minified
  - Quikdown BD: 13 KB minified (includes core)
  - Quikdown Editor: 36 KB minified (includes quikdown_bd and fence plugins)

### 🎯 New Features

#### NPM Discoverability
- **Added comprehensive keywords** to package.json for better NPM search visibility
- Keywords cover: markdown parsing, chat/LLM use cases, bidirectional editing, and more

#### Lazy Linefeeds Support
- **Added `lazy_linefeeds` option** for chat/LLM applications
- When enabled, single newlines (`\n`) automatically become `<br>` tags
- Perfect for chat interfaces where users expect Enter to create a new line
- Preserves double newlines for paragraph breaks
- Code blocks and lists maintain proper formatting
- Example:
  ```javascript
  quikdown('Line 1\nLine 2', { lazy_linefeeds: true });
  // Output: <p>Line 1<br>Line 2</p>
  ```

### 📚 Documentation Updates

#### API Documentation
- Added `bidirectional` option to core quikdown API reference
- Added `lazy_linefeeds` option documentation with examples
- Added `allow_unsafe_urls` option documentation
- Clarified that `quikdown_bd` automatically sets `bidirectional: true`
- Updated TypeScript definitions with new options
- Updated examples to reflect new architecture

#### Bidirectional Documentation
- Explained new `bidirectional` option in core module
- Clarified differences between `quikdown` and `quikdown_bd`
- Updated usage examples

### 🐛 Bug Fixes

#### Table Alignment Fix
- **Fixed table alignment in CSS class mode**: Table column alignment (left, center, right) now works correctly in both CSS class and inline styles modes
- Previously, alignment only worked with `inline_styles: true` option
- Now applies alignment as inline style attribute even when using CSS classes
- Eliminated duplicate `text-align` properties in inline styles mode
- Example:
  ```markdown
  | Left | Center | Right |
  |:-----|:------:|------:|
  | L    |   C    |     R |
  ```
  Now correctly renders with proper text alignment in all cells

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
- Reorganized examples index page with clear sections for each module
- Added individual size badges for all three modules in README

## v1.0.4 (2025-08-18)

### 🎉 Major Feature: Bidirectional Conversion Support

#### New `quikdown_bd` Module
- **HTML to Markdown conversion**: Convert HTML back to Markdown with high fidelity
- **Round-trip preservation**: Maintains original markdown formatting through conversion cycles
- **Smart source tracking**: Uses `data-qd` attributes to preserve original markdown syntax
- **DOM-based conversion**: Walks the DOM tree for accurate HTML-to-Markdown transformation
- **Bundle size**: 12.5KB minified (compared to 8.5KB for core quikdown)

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
- `quikdown.min.js`: 8.5KB (core parser)
- `quikdown_bd.min.js`: 12.5KB (bidirectional)
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