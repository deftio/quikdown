# Bidirectional Fixes and Refactoring Plan

## Goal
Refactor `quikdown_bd.js` to import and extend `quikdown.js` instead of duplicating code. This will ensure feature parity and reduce maintenance burden.

## Phase 1: Simplify Data Attributes
Reduce from 8 different `data-qd-*` attributes to 4 with clear purposes:

### New Attribute Schema
- **`data-qd`** - The markdown marker/syntax (`**`, `#`, ``` , `|`, `!`, `[`, etc.)
- **`data-qd-src`** - Original source for preserved content (fences, images)  
- **`data-qd-ftype`** - Fence language/type (only for fence blocks)
- **`data-qd-align`** - Table column alignment (only for tables)

### Element Strategy

#### Static Elements (use `data-qd-src` to preserve exact original)
- [ ] Fence blocks - Store original code in `data-qd-src`
- [ ] Images - Store original `![alt](src)` syntax in `data-qd-src`
- [ ] Mermaid diagrams - Store source in `data-qd-src`

#### Dynamic Elements (reconstruct from live DOM)
- [ ] Tables - Rebuild from current cell content, only store alignment
- [ ] Lists - Rebuild from current items (support task checkbox changes)
- [ ] Text formatting - Use marker + current text content
- [ ] Headers - Use marker + current heading text
- [ ] Links - Use marker + current link text (href from attribute)

### Implementation Checklist
- [ ] Update `getAttr` function in quikdown_bd.js to use new schema
- [ ] Update all element generation to use new attributes
- [ ] Update `toMarkdown` function to handle new schema
- [ ] Update tests to expect new attribute names

## Phase 2: Refactor to Import Core

### Architecture
```javascript
// quikdown_bd.js
import quikdown from './quikdown.js';

function quikdown_bd(markdown, options = {}) {
    // Add bidirectional option
    const bdOptions = {
        ...options,
        bidirectional: true
    };
    return quikdown(markdown, bdOptions);
}

// Add toMarkdown method
quikdown_bd.toMarkdown = function(htmlOrElement) { /* ... */ };

// Re-export core methods
quikdown_bd.emitStyles = quikdown.emitStyles;
quikdown_bd.configure = quikdown.configure;
quikdown_bd.version = quikdown.version;
```

### Core Changes Needed
- [ ] Add `bidirectional` option to quikdown.js
- [ ] When `bidirectional: true`, emit data-qd attributes
- [ ] Keep core parser logic unchanged
- [ ] Add ~20-30 lines for attribute generation

### Build System Updates
- [ ] Update rollup.config.js for new import structure
- [ ] Ensure proper bundling for all formats (ESM, UMD, CJS)
- [ ] Test that tree-shaking works correctly

## Phase 3: Testing & Documentation

### Testing
- [ ] All existing tests pass
- [ ] Add tests for new attribute schema
- [ ] Test bidirectional option in core
- [ ] Test that quikdown_bd properly extends core
- [ ] Performance benchmarks (ensure minimal overhead)

### Documentation Updates
- [ ] Update API docs for new attribute schema
- [ ] Document bidirectional option in core
- [ ] Update examples to use new attributes
- [ ] Migration guide for v1.0.4 → v1.0.5
- [ ] Add bidirectional checkbox (default checked) to http://localhost:9977/examples/quikdown-bd-editor.html
- [ ] Add simplest possible demo of quikdown bidir with mermaid, hljs, but everything is from cdn (including quikdown) so someone can copy it and use it.
- [ ] make a js control quikdown_edit.js which is a full html drop in control.  with example
    * should pull in quikdown and have src/split/rendered views in a single div via buttons
    * manages all deps or uses built-in styles
    * has option to load hljs,mermaid,etc dynmacally in constructor
    * has setters/getters for source content,

### Examples to Update
- [ ] quikdown-bd-editor.html
- [ ] quikdown-bd-basic.html
- [ ] Any other bidirectional examples

## Phase 4: Additional Housekeeping
_[Space for additional tasks]_

- [ ] 
- [ ] 
- [ ] 

## Benefits of This Refactor

1. **Code reduction**: ~90% less code in quikdown_bd.js
2. **Maintenance**: Fix bugs once in core, automatically fixed in _bd
3. **Feature parity**: New features in core immediately available in _bd
4. **Smaller bundles**: When using both, less total JavaScript
5. **Cleaner API**: Fewer attributes, clearer purpose for each

## Migration Impact

### Breaking Changes
- Attribute names change (data-qd-lang → data-qd-ftype, etc.)
- Some attributes removed (data-qd-text, data-qd-alt, data-qd-src for links)

### Migration Path
- Provide a migration guide
- Consider a compatibility shim for v1.0.5 that maps old attributes to new
- Major version bump (v2.0.0) if breaking changes are too significant

## Estimated Effort
- Phase 1: 2-3 hours (attribute simplification)
- Phase 2: 3-4 hours (refactor to import core)
- Phase 3: 2-3 hours (testing & docs)
- Phase 4: TBD based on additional tasks

Total: ~8-10 hours of focused work

## Notes
- Keep backward compatibility where possible
- Ensure performance doesn't degrade
- Consider feature flags for gradual rollout