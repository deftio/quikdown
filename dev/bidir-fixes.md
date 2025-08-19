# Bidirectional Fixes and Refactoring

## ✅ COMPLETED IN v1.0.5 

- Successfully refactored quikdown_bd to import and extend quikdown.js
- Achieved 99.5%+ test coverage for both versions  
- Fixed CSS regeneration issue (now uses version number instead of timestamp)
- Created comprehensive CDN demo with Mermaid and Highlight.js
- Documented bidirectional option in API reference
- **NO BREAKING CHANGES** - 100% backward compatible

## Tasks Status

### Core Refactoring ✅ COMPLETE
- [x] Add `bidirectional` option to quikdown.js
- [x] When `bidirectional: true`, emit data-qd attributes
- [x] Keep core parser logic unchanged
- [x] Import quikdown from quikdown_bd instead of duplicating code
- [x] Copy all properties and methods from quikdown to quikdown_bd
- [x] Override configure method for bidirectional version

### Build System ✅ COMPLETE
- [x] Update rollup.config.js for new import structure
- [x] Ensure proper bundling for all formats (ESM, UMD, CJS)
- [x] Test that tree-shaking works correctly
- [x] Fix CSS regeneration to use version instead of timestamp

### Testing ✅ COMPLETE
- [x] All existing tests pass (353 tests passing)
- [x] Test bidirectional option in core
- [x] Test that quikdown_bd properly extends core
- [x] Performance benchmarks (ensure minimal overhead)
- [x] Achieved 99.5%+ test coverage for both versions
- [x] Convert tests from CommonJS to ESM imports

### Documentation ✅ COMPLETE
- [x] Document bidirectional option in core (added to api-reference.md)
- [x] Create standalone CDN demo with mermaid and hljs (quikdown-cdn-demo.html)
- [x] Link CDN demo from examples/index.html
- [x] Update README with CDN demo reference
- [x] API docs correctly show bidirectional option for both quikdown and quikdown_bd

### Examples ✅ COMPLETE
- [x] quikdown-bd-editor.html (works with current implementation)
- [x] quikdown-bd-basic.html (works with current implementation)  
- [x] quikdown-cdn-demo.html (created new with bidirectional checkbox)
- [x] All examples properly import quikdown_bd from ESM modules
- [x] Examples linked from index.html

## Current Attribute Schema (v1.0.5)

**The bidirectional implementation uses 6 data-qd attributes:**
- `data-qd` - Markdown marker (e.g., '**', '#', '[', etc.)
- `data-qd-alt` - Image alt text
- `data-qd-src` - Image source URL
- `data-qd-text` - Link text
- `data-qd-lang` - Code fence language
- `data-qd-fence` - Code fence type (``` or ~~~)

These attributes enable perfect round-trip conversion between Markdown and HTML.

## Benefits Achieved

1. **Code reduction**: ~800 lines removed from quikdown_bd.js
2. **Maintenance**: Fix bugs once in core, automatically fixed in _bd
3. **Feature parity**: New features in core immediately available in _bd
4. **Smaller bundles**: When using both, less total JavaScript loaded
5. **Test coverage**: 99.5%+ coverage ensures reliability

## Actual Effort

- Refactoring: ~4 hours
- Testing & coverage: ~5 hours  
- Documentation: ~1 hour
- **Total**: ~10 hours

**Result**: Successfully refactored with 99.5% test coverage and full backward compatibility