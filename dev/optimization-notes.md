# Quikdown Optimization Notes

## Optimization History

### Completed Optimizations (v1.0.3)
- ✅ **Moved styles to module level** (~800 bytes saved)
- ✅ **Created getAttr factory** (~200 bytes saved)  
- ✅ **Replace chain arrays** (~400 bytes saved)
- ✅ **Escape map to module level** (~100 bytes saved)
- ✅ **Style consolidation** (removed duplication between main and emitStyles)
- ✅ **Theme CSS generation** (build-time generation from single source)

### Size Progress
| Version | Size | Reduction | 
|---------|------|-----------|
| 1.0.2   | 9.2KB | Baseline |
| 1.0.3   | 7.0KB | -2.2KB |
| Current | 7.0KB | - |
| Target  | <7KB | - |

## Theme System Architecture

### Design Principles
1. **"Batteries Included"** - Inline styles work out of the box
2. **Flexible Class-based** - Users can use our CSS or bring their own
3. **Multi-instance Support** - Different themes on same page
4. **Size Efficient** - Single source of truth for styles

### CSS Scoping Requirements

Must support multiple themes on same page:
```css
/* Properly namespaced selectors */
.quikdown-light .quikdown-h1 { color: #1a202c; }
.quikdown-dark .quikdown-h1 { color: #f7fafc; }

/* User custom themes */
.quikdown-custom .quikdown-h1 { /* custom */ }

/* App-specific overrides */
.my-app .quikdown .quikdown-h1 { /* override */ }
```

**Rules:**
- Never use bare selectors - always scope under theme class
- Use consistent `.quikdown-*` naming
- Avoid `!important` - allow easy overrides
- Support cascading - more specific selectors win

## Remaining Optimization Opportunities

### High Impact, Low Risk (~400 bytes potential)

#### 1. CSS String Compression
```javascript
// Current
h1: 'font-size: 2em; font-weight: 600; margin: 0.67em 0',

// Optimized (remove spaces, shorten decimals)
h1: 'font-size:2em;font-weight:600;margin:.67em 0',
```
- Remove spaces after colons/semicolons
- Use decimal shortcuts (.67 vs 0.67)
- Shorten colors (#0066cc → #06c)

#### 2. Deduplicate String Constants
```javascript
// Current: "quikdown-" repeated many times
const PREFIX = 'quikdown-';
// Then use: PREFIX + 'h1', PREFIX + 'table', etc.
```

#### 3. Remove Empty Styles
Several styles are empty strings that can be handled specially:
- `thead: ''`
- `tbody: ''`  
- `tr: ''`
- `br: ''`

### Medium Impact (~300 bytes potential)

#### 4. URL Sanitization - Allowlist Approach
```javascript
// Current: blocklist dangerous protocols
// Optimized: allowlist safe protocols (smaller AND safer)
if (!/^(https?|mailto|tel|#):/i.test(url) && 
    !/^data:image\//i.test(url)) {
    return '#';
}
return url;
```

#### 5. Version Injection at Build Time
Remove the import and inject version during build:
```javascript
// Remove: import { version } from './version.js';
// Build tool injects: quikdown.version = '1.0.3';
```

#### 6. Regex Consolidation
```javascript
// Current: separate patterns for bold
html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

// Optimized: single pattern
html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
```

### Future Considerations

#### 7. ESM-Only Build Option
Removing CommonJS + window.quikdown scaffolding could save ~200 bytes

#### 8. Optional Features
Gate task lists behind a flag for tree-shaking:
```javascript
if (options.enableTaskLists) {
    // Task list code
}
```

## Expert Review: Sam's Minifier-Aware Recommendations

### Size-Impactful (Survive Minification)

1. **Kill duplication of logic**
   - Create `getAttr` ONCE and pass it to functions
   - Use one inline-formatting pass everywhere

2. **Tighten string literals** (cannot be minified)
   - CSS: remove spaces, shorten colors, drop redundant declarations
   - Deduplicate common fragments into constants

3. **Prune noop/unused styles**
   - Remove empty entries that never affect output

4. **Collapse cleanup boilerplate**
   - Replace array of `<p>` unwrappers with one helper

5. **Drop multi-target export glue**
   - Ship ESM-only build if possible

6. **Version string source**
   - Inject at build-time instead of importing

7. **Sanitizer allowlist = shorter code**
   - Allowlist safe protocols instead of blocklisting dangerous ones

8. **Regex reuse**
   - Hoist repeated patterns to constants

9. **Fence regex generalization**
   - Single pattern for ``` and ~~~ with 3+ markers

10. **Optional features as flags/builds**
    - Gate task lists behind option for tree-shaking

### Robustness/Quality Improvements

1. **Remove blockquote merge line** - Can erase content between quotes
2. **Tighten table detection** - Require `|` between cells
3. **Fence parity with GFM** - Support 3+ markers
4. **Lookbehind-free patterns** - Better compatibility
5. **Autolink punctuation** - Exclude trailing punctuation
6. **Consistent inline code** - Same handling everywhere
7. **Stable attribute order** - Predictable output

## Implementation Priority

### Phase 1: Quick Wins (Do Now)
1. CSS literal slimming - Remove spaces, shorten colors
2. Remove empty styles - thead, tbody, tr, br  
3. "quikdown-" constant - Deduplicate prefix
4. URL allowlist approach - Smaller and safer

### Phase 2: Build Changes (Next Release)
5. Version injection at build - Remove import
6. Pass getAttr instead of recreating - True deduplication

### Phase 3: Consider for Future
7. ESM-only build option - Separate targets
8. Optional task lists - Feature flag
9. Fence regex generalization - GFM compatibility

## Experimental JavaScript Files in dev/

### Overview
Three experimental implementations exploring different optimization approaches:

### 1. quikdown-lexer-ast.js (~15KB)
**Purpose:** Lexer + AST approach for potential performance gains
**Status:** Experimental prototype
**Key Features:**
- Hand-rolled line tokenizer with AST generation
- Aims for feature parity with original quikdown
- More traditional compiler approach (tokenize → parse → render)
**Opinion:** KEEP for reference but don't pursue - adds complexity without significant size benefit

### 2. quikdown-ultra-lexer.js (~9.4KB)  
**Purpose:** Ultra-optimized single-pass state machine
**Status:** Experimental optimization testbed
**Key Features:**
- Compact variable names (S for styles, E for escape map)
- Combined tokenizer/parser/renderer in one pass
- Aggressive minification techniques
**Opinion:** KEEP as reference for optimization techniques, some ideas already incorporated

### 3. old-quikdown-codereview-notes.md (formerly quikdown-updates.js)
**Purpose:** Code review feedback and suggested refactoring
**Status:** Historical archive - improvements already incorporated
**Key Features:**
- Single STYLE_MAP to avoid duplication (✅ implemented)
- Fixed fence regex for non-word languages (✅ implemented)
- Improved URL sanitization (✅ implemented)
**Opinion:** Renamed to .md to clarify it's documentation, not active code

### Recommendation
1. **Keep quikdown-lexer-ast.js** - Alternative lexer/AST approach reference
2. **Keep quikdown-ultra-lexer.js** - Optimization techniques reference  
3. **Keep old-quikdown-codereview-notes.md** - Historical record of improvements made

These files show the optimization journey but aren't part of the main codebase. They're experimental approaches that informed the current optimized implementation.

## Notes

- Every byte counts in string literals (can't be minified)
- Prefer allowlists over blocklists (safer AND smaller)
- Consider feature flags for optional functionality
- Keep a balance between size and maintainability
- The experimental files in dev/ are historical artifacts showing optimization exploration