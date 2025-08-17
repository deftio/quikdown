# Quikdown Size Optimization - Target 6.5KB

## Current Status
- **Current Size:** 7.4KB (7583 bytes)
- **Target:** 6.5KB (6656 bytes)
- **Needed Reduction:** ~1.1KB (927 bytes)

## Completed Optimizations (v1.0.3dev2)
1. ✅ Moved styles to module level (~800 bytes saved)
2. ✅ Created getAttr factory (~200 bytes saved)
3. ✅ Replace chain arrays (~400 bytes saved)

## Potential Further Optimizations

### 1. Inline Styles Consolidation (~300-400 bytes)
The QUIKDOWN_STYLES object contains verbose CSS strings. We could:

**Option A: Abbreviated Style Properties**
```javascript
// Current (verbose)
h1: 'font-size: 2em; font-weight: 600; margin: 0.67em 0; text-align: left',

// Optimized (abbreviated)
h1: 'font-size:2em;font-weight:600;margin:.67em 0;text-align:left',
```
- Remove spaces after colons
- Remove spaces after semicolons
- Use decimal shortcuts (.67 instead of 0.67)
- Estimated savings: ~200 bytes

**Option B: Style Compression Function**
```javascript
// Define common style patterns once
const fs = 'font-size:', fw = 'font-weight:', m = 'margin:';
// Then compose
h1: fs+'2em;'+fw+'600;'+m+'.67em 0;text-align:left',
```
- More complex but could save more
- Estimated savings: ~150 bytes

### 2. Regex Consolidation (~200-300 bytes)
Currently we have many separate regex patterns. Could combine similar ones:

**Current:**
```javascript
html = html.replace(/\*\*(.+?)\*\*/g, `<strong>$1</strong>`);
html = html.replace(/__(.+?)__/g, `<strong>$1</strong>`);
```

**Optimized:**
```javascript
// Single regex for both bold markers
html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
```

### 3. Function Inlining (~150-200 bytes)
The `processInlineMarkdown` function is called only from table processing. 
We could inline it to save function overhead.

### 4. Escaping Optimization (~100-150 bytes)
The escapeHtml function creates a map object every time. Could optimize:

**Current:**
```javascript
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
```

**Optimized:**
```javascript
const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ESC_MAP[m]);
}
```

### 5. Variable Name Shortening in Minification (~100-150 bytes)
Some opportunities for the minifier:
- Long repeated strings like 'CODEBLOCK' could be shortened
- Pattern placeholder strings could be more compact

### 6. Remove Empty Style Values (~50 bytes)
Several styles are empty strings:
```javascript
thead: '',
tbody: '',
tr: '',
br: '',
```
Could handle these specially to avoid storing empty strings.

### 7. Simplify URL Sanitization (~100 bytes)
The sanitizeUrl function could be more compact:

**Current:**
```javascript
const dangerousProtocols = ['javascript:', 'vbscript:', 'data:'];
for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
        // Exception for data:image/*
        if (protocol === 'data:' && lowerUrl.startsWith('data:image/')) {
            return trimmedUrl;
        }
        return '#';
    }
}
```

**Optimized:**
```javascript
if (/^(javascript|vbscript|data):/i.test(url)) {
    return /^data:image\//i.test(url) ? url : '#';
}
```

### 8. Table Processing Optimization (~150 bytes)
The table building code has repetitive patterns that could be consolidated.

## Recommended Implementation Order

### Phase 1: Low-Risk, High-Impact (Target: ~500 bytes)
1. **Inline style string optimization** - Remove unnecessary spaces/zeros
2. **Empty style handling** - Special case for empty strings
3. **Escape map to module level** - Move map outside function

### Phase 2: Medium Complexity (Target: ~300 bytes)
4. **URL sanitization simplification** - Regex-based approach
5. **Regex pattern consolidation** - Combine similar patterns
6. **Placeholder string optimization** - Shorter placeholders

### Phase 3: Higher Complexity (Target: ~200 bytes)
7. **Function inlining** - Inline processInlineMarkdown
8. **Table code consolidation** - Reduce repetition

## Risks and Tradeoffs

### Maintainability vs Size
- More aggressive optimizations make code harder to read
- Need to balance size gains with code clarity
- Document any clever optimizations well

### Performance Considerations
- Some optimizations might impact performance
- Regex consolidation could be slower
- Need to benchmark critical paths

### Testing Requirements
- Every optimization needs full test suite pass
- Check performance doesn't degrade
- Verify minified output works correctly

## Size Tracking

| Version | Size | Reduction | Techniques |
|---------|------|-----------|------------|
| 1.0.2   | 9.2KB | - | Baseline |
| 1.0.3dev1 | 7.7KB | 1.5KB | Styles consolidation |
| 1.0.3dev2 | 7.4KB | 0.3KB | Replace chains |
| 1.0.3dev3 | ? | ? | Style strings |
| 1.0.3dev4 | ? | ? | Escape optimization |
| Target | 6.5KB | 2.7KB total | All optimizations |

## Decision Points

1. **How aggressive should we be?**
   - Conservative: Keep code very readable, accept 7KB
   - Moderate: Some complexity for 6.5KB
   - Aggressive: Maximum optimization for <6KB

2. **Which optimizations to prioritize?**
   - Size impact
   - Maintainability cost
   - Risk of bugs

3. **Testing strategy?**
   - Add size regression tests
   - Performance benchmarks
   - Browser compatibility checks