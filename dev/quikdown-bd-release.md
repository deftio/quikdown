# quikdown-bd Release Planning

## Overview
Release quikdown-bd as a production-ready bidirectional markdown/HTML converter extension of quikdown.

## Core Requirements

### 1. Source Code Organization
- [ ] Move and rename: `exp-bd/quikdown-bd.js` → `src/quikdown_bd.js`
- [ ] Rename exported object: `quikdownBD` → `quikdown_bd` (1:1 naming purity)
- [ ] Refactor to import core quikdown instead of duplicating code
  - Import `quikdown` from `./quikdown.js`
  - Extend/wrap core functions
  - Add bidirectional-specific features only
  - Ensure 100% feature parity with core quikdown

### 2. Build Configuration
- [ ] Add `quikdown_bd` to `rollup.config.js`
  - Generate `dist/quikdown_bd.esm.js` (ES Module)
  - Generate `dist/quikdown_bd.umd.js` (UMD)
  - Generate `dist/quikdown_bd.cjs` (CommonJS)
  - Generate `dist/quikdown_bd.esm.min.js` (Minified ESM)
  - Generate `dist/quikdown_bd.umd.min.js` (Minified UMD)
- [ ] Update `package.json` exports to include bd variants
- [ ] Add minification targets for all bd builds
- [ ] Ensure source maps are generated

### 3. Test Suite
- [ ] Create `tests/quikdown_bd.test.js`
  - Must pass ALL existing quikdown tests (import and run)
  - Additional tests for bidirectional features:
    - Round-trip conversion tests
    - data-qd attribute preservation
    - DOM walking functionality
    - Edge cases (nested structures, special characters)
    - Mermaid diagram preservation
    - Task list checkbox state preservation
- [ ] Run existing performance benchmarks and document in `docs/quikdown-performance.md`
  - quikdown vs quikdown_bd comparison
  - Round-trip conversion times
  - Document results only (no targets)
- [ ] Browser-specific tests (DOM required)
- [ ] Node.js compatibility tests with warnings
- [ ] Make sure this fence is handled properly (fails in manual testing ```svg   ) - might need new test case.

### 4. Documentation

#### API Documentation
- [ ] Update `docs/api.md` with quikdown-bd section
  - `quikdown_bd(markdown, options)` - forward conversion
  - `quikdown_bd.toMarkdown(htmlOrElement)` - reverse conversion
  - Options and parameters
  - Return values and types

#### Usage Documentation
- [ ] Create `docs/quikdown_bidirectional.md`
  - When to use quikdown vs quikdown_bd, limitations of quikdown_bd
  - Browser vs Node.js usage
  - Live editing scenarios
  - Integration examples

#### Limitations Documentation for BD
- [ ] Clear limitations section:
  - Mermaid diagrams (render but don't reverse-edit)
  - Complex nested tables
  - Custom HTML (non-quikdown generated)
  - Whitespace normalization
  - Style preservation limits

#### Technical Documentation
- [ ] Explain "tricks" used for bidirectional editing:
  - data-qd attributes for source tracking
  - DOM walking vs HTML parsing
  - Hidden source preservation (.mermaid-source)
  - Computed styles fallback
  - Round-trip normalization strategies

### 5. Examples
- [ ] `examples/bidirectional-basic.html` - Simple demo
- [ ] `examples/bidirectional-editor.html` - Production version of live editor with support for common fences (highlight, mermaid, html, svg)
- [ ] `examples/bidirectional-nodejs.js` - Node.js usage with jsdom
- [ ] Update existing examples to show quikdown vs quikdown-bd choice

### 6. TypeScript Definitions
- [ ] Generate `dist/quikdown_bd.d.ts` from existing TypeScript tooling
  - Ensure proper typing for `quikdown_bd` object
  - Include `toMarkdown` method
  - Maintain consistency with core quikdown types

### 7. Package Configuration
- [ ] Verify `package.json` exports don't conflict
- [ ] Add quikdown_bd files to `files` array
- [ ] Ensure no conflicting definitions

### 8. Node.js Compatibility
- [ ] Add clear warnings/documentation:
  - Requires DOM implementation (jsdom, happy-dom, etc.)
  - Example setup code
  - Performance implications
  - Recommended for browser use

### 9. Quality Assurance
- [ ] Code coverage must be ≥99.5%
- [ ] All tests must pass with zero warnings
- [ ] Bundle size requirements:
  - quikdown.min.js < 8KB
  - quikdown_bd.min.js < 11KB
- [ ] Document performance metrics (no targets, just documentation)
- [ ] Cross-browser testing:
  - Chrome/Edge (latest)
  - Firefox (latest)
  - Safari (latest)
  - Mobile browsers

### 10. Migration Guide
- [ ] Create `docs/migrating-to-bidirectional.md`:
  - When to migrate
  - Code changes required  (should be none, only bidirectional specific)
  - Performance implications
  - Fallback strategies

### 11. Release Notes and Docs
- [ ] Version bump (1.0.4 - new feature)
- [ ] docs/release-notes.md entry
  - Feature highlights
  - Breaking changes (none expected)
  - Migration guide link
  - Bundle size comparison
- [ ] Make sure examples/index.html as full links to all examples

### 12. Additional Considerations

#### Framework Integration
- [ ] Add simple documentation for vanilla JS usage in:
  - React (useEffect example)
  - Vue (mounted example)
  - Svelte (onMount example)
- [ ] No framework-specific code, just usage examples

STOP HERE.  Then we will discuss how to release 1.0.4 

#### Accessibility
- [ ] Preserved ARIA attributes in round-trip
- [ ] Semantic HTML maintained
- [ ] Screen reader compatibility

#### Performance Optimizations
- [ ] Lazy loading for toMarkdown (only when needed)
- [ ] Efficient DOM walking algorithms
- [ ] Minimal memory footprint
- [ ] Debouncing for live editors (in examples)

## Testing Checklist

### Unit Tests
- [ ] Markdown → HTML (all quikdown features)
- [ ] HTML → Markdown (DOM walking)
- [ ] Round-trip preservation
- [ ] data-qd attributes
- [ ] Edge cases and error handling

### Integration Tests
- [ ] With React/Vue/Angular
- [ ] With markdown editors (CodeMirror, Monaco)
- [ ] With static site generators
- [ ] With documentation tools

### Performance Tests
- [ ] Large documents (>100KB)
- [ ] Deeply nested structures
- [ ] Rapid conversions (live typing)
- [ ] Memory leak detection

## Release Steps

1. **Development** (Week 1)
   - Refactor code to import core
   - Add to build system
   - Create test suite

2. **Documentation** (Week 2)
   - API documentation
   - Usage guides
   - Examples

3. **Testing** (Week 3)
   - Unit tests
   - Integration tests
   - Performance tests
   - Cross-browser tests

4. **Beta Release** (Week 4)
   - npm beta tag
   - Community feedback
   - Bug fixes

5. **Production Release**
   - Version bump
   - npm publish
   - GitHub release
   - Announcement

## Success Criteria

- ✅ 100% backward compatible with quikdown core
- ✅ quikdown.min.js < 8KB
- ✅ quikdown_bd.min.js < 11KB
- ✅ ≥99.5% code coverage
- ✅ All tests passing with zero warnings
- ✅ Zero breaking changes
- ✅ Clear documentation
- ✅ Working examples

## Notes

- **Primary Use Case**: Live editing of quikdown-generated HTML, not general HTML→Markdown conversion
- **Philosophy**: Quality over features - better to do less but do it perfectly
- **Target Audience**: Developers building markdown editors and documentation tools
- **Key Differentiator**: True bidirectional editing with source preservation