# quikdown Size Optimization & Theme System

## Current Status
- **Size:** ~9.2KB minified (approaching 10KB limit)
- **Target:** <7.5KB
- **Potential Savings:** ~2KB

## Theme System Architecture (Clarified)

### Design Goals
1. **"Batteries Included"** - Built-in styles for inline usage work out of the box
2. **Flexible Class-based** - Users can use our CSS or bring their own
3. **Multi-instance Support** - Different quikdown instances can use different themes on same page
4. **Size Efficient** - Share style definitions between inline and CSS generation

### How It Should Work

#### Option 1: Inline Styles (Batteries Included)
```javascript
// User gets nice looking output immediately
const html = quikdown(markdown, { inline_styles: true });
// Uses built-in theme styles directly in HTML
// Output: <h1 style="font-size: 2em; font-weight: 600; ...">
```

#### Option 2: Class-based with Our Themes
```html
<!-- User includes our theme -->
<link rel="stylesheet" href="quikdown.light.css">
<!-- Or -->
<link rel="stylesheet" href="quikdown.dark.css">

<div class="quikdown quikdown-light">
  <!-- quikdown output with classes -->
  <h1 class="quikdown-h1">Title</h1>
</div>
```

#### Option 3: Custom CSS
```css
/* User brings their own styles */
.my-theme .quikdown-h1 { 
  color: purple; 
  font-family: 'Comic Sans'; 
}
```

### Multi-Instance Theme Support
```html
<!-- Critical: CSS selectors must support scoping -->
<div class="quikdown quikdown-light">
  <!-- Uses light theme -->
  <div id="output1"></div>
</div>

<div class="quikdown quikdown-dark">
  <!-- Uses dark theme on same page -->
  <div id="output2"></div>
</div>

<style>
/* Properly scoped selectors - namespaced to avoid collisions */
.quikdown.quikdown-light .quikdown-h1 { color: #1a202c; }
.quikdown.quikdown-dark .quikdown-h1 { color: #f7fafc; }
</style>
```

## Implementation Architecture

### 1. Core Style Definitions (Single Source of Truth)
```javascript
// Base style definitions (structure, not colors)
const BASE_STYLES = {
  h1: { fontSize: '2em', fontWeight: '600', margin: '0.67em 0' },
  h2: { fontSize: '1.5em', fontWeight: '600', margin: '0.83em 0' },
  // ... structural styles
};

// Theme-specific parameters
const THEMES = {
  light: {
    colors: {
      text: '#333',
      heading: '#1a202c',
      background: '#fff',
      codeBg: '#f4f4f4',
      codeText: '#333',
      link: '#0066cc',
      border: '#ddd',
      tableBg: '#f2f2f2'
    }
  },
  dark: {
    colors: {
      text: '#e2e8f0',
      heading: '#f7fafc',
      background: '#1a202c',
      codeBg: '#2d3748',
      codeText: '#e2e8f0',
      link: '#90cdf4',
      border: '#4a5568',
      tableBg: '#2d3748'
    }
  }
};
```

### 2. Style Generation Functions
```javascript
// For inline styles (batteries included)
function getInlineStyle(element, theme = 'light') {
  const base = BASE_STYLES[element];
  const colors = THEMES[theme].colors;
  
  // Combine base + theme colors
  return Object.entries(base)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ');
}

// For CSS generation (build time)
function generateCSS(themeName) {
  const theme = THEMES[themeName];
  let css = '';
  
  // Generate scoped CSS - namespaced to avoid collisions
  css += `.quikdown.quikdown-${themeName} .quikdown-h1 {\n`;
  css += `  font-size: 2em;\n`;
  css += `  color: ${theme.colors.heading};\n`;
  css += `}\n`;
  // ... etc
  
  return css;
}
```

### 3. Build Process
```javascript
// tools/buildThemes.js
const fs = require('fs');

// Generate theme CSS files
const lightCSS = generateCSS('light');
fs.writeFileSync('dist/quikdown.light.css', lightCSS);

const darkCSS = generateCSS('dark');  
fs.writeFileSync('dist/quikdown.dark.css', darkCSS);

// Also generate a combined file with both themes
const combinedCSS = lightCSS + '\n' + darkCSS;
fs.writeFileSync('dist/quikdown.themes.css', combinedCSS);
```

## Size Optimizations

### 1. Unified Style System (~800 bytes saved)
**Current Problem:** Styles duplicated in main function and emitStyles()

**Solution:**
```javascript
// Single source of truth at module level
const STYLE_DEFS = { /* base styles */ };

// In main function for inline styles
if (inline_styles) {
  const style = STYLE_DEFS[tag];
  // ... apply inline
}

// In emitStyles for CSS generation
quikdown.emitStyles = function(theme) {
  // Use same STYLE_DEFS
  return generateCSS(STYLE_DEFS, theme);
};
```

### 2. Consolidate getAttr() (~200 bytes saved)
**Problem:** Defined 4 times

**Solution:**
```javascript
// Single factory function
function createGetAttr(inline_styles, styleDefs) {
  return (tag, additionalStyle = '') => {
    if (inline_styles) {
      const style = styleDefs[tag];
      // ... generate inline style
    } else {
      return ` class="quikdown-${tag}"`;
    }
  };
}
```

### 3. Replace Chain Optimization (~400 bytes saved)
```javascript
// Array of replacements instead of chain
const cleanups = [
  [/<p><\/p>/g, ''],
  [/<p>(<h[1-6][^>]*>)/g, '$1'],
  // ...
];
cleanups.forEach(([pattern, replacement]) => {
  html = html.replace(pattern, replacement);
});
```

### 4. Deduplicate Inline Processing (~300 bytes saved)
- Use single function for inline markdown (bold, italic, etc.)
- Call it from both main and table processing

## CSS Scoping Requirements

### Must Support:
```css
/* Multiple themes on same page - properly namespaced */
.quikdown.quikdown-light .quikdown-h1 { /* light styles */ }
.quikdown.quikdown-dark .quikdown-h1 { /* dark styles */ }

/* Custom overrides - user can add their own theme */
.quikdown.quikdown-custom .quikdown-h1 { /* custom */ }

/* User can also override specific elements */
.my-app .quikdown .quikdown-h1 { /* app-specific override */ }
```

### CSS Architecture:
1. **Never use bare selectors** - Always scope under theme class
2. **Use consistent naming** - `.quikdown-*` for all elements
3. **Avoid !important** - Allow easy overrides
4. **Support cascading** - More specific selectors win

## Implementation Plan

### Phase 1: Refactor Style System
- [ ] Create STYLE_DEFS constant (single source)
- [ ] Update main function to use STYLE_DEFS
- [ ] Update emitStyles to use STYLE_DEFS
- [ ] Add theme parameter support

### Phase 2: Build Theme Generation
- [ ] Create buildThemes.js tool
- [ ] Generate quikdown.light.css
- [ ] Generate quikdown.dark.css
- [ ] Test multi-instance support

### Phase 3: Size Optimizations (Completed)
- [x] Implement replace chain array
- [x] Consolidate getAttr functions  
- [x] Deduplicate inline processing (partial)
- [x] Measure size reduction (9.2KB → 7.4KB)

### Phase 4: Testing
- [ ] Test inline styles work
- [ ] Test class-based with our CSS
- [ ] Test multi-theme on same page
- [ ] Verify backward compatibility

## Success Criteria
1. ✅ Size reduced to <7.5KB
2. ✅ Inline styles work out of box
3. ✅ Theme CSS properly scoped
4. ✅ Multiple themes on same page work
5. ✅ All tests pass
6. ✅ Backward compatible

## Sam's Minifier-Aware Recommendations

### Size-impactful (survive minification)

1. **Kill duplication of logic**
   - Create `getAttr` **once** in `quikdown()` and **pass it** into `processInlineMarkdown`, `processTable`, and `processLists` instead of recreating it there.
   - Use **one** inline-formatting pass (`processInlineMarkdown`) everywhere (main flow and table cells) instead of maintaining two sets of replacements.

2. **Tighten string literals (cannot be minified)**
   - **CSS in `QUIKDOWN_STYLES`:** remove spaces after `:`/`;`, shorten colors (`#0066cc`→`#06c`), drop redundant declarations (e.g., `font-weight:bold` for `<strong>`), and unify margins across headings where acceptable.
   - Deduplicate common fragments: hoist `"quikdown-"` (and task checkbox fragments) into a single constant and reuse.

3. **Prune noop/unused styles**
   - Remove empty entries (`thead`, `tbody`, `tr`, `br:''`) and any map keys that never affect output. `emitStyles` already skips falsy values; keeping them only bloats literals.

4. **Collapse unwrap/cleanup boilerplate**
   - Replace the array of many `<p>…</p>` unwrappers with one tiny helper invoked per tag-group. Same behavior, fewer repeated regex literals.

5. **Drop multi-target export glue (if possible)**
   - If your distribution allows: ship an **ESM-only** build (or separate builds). Removing CommonJS + `window.quikdown` scaffolding trims real bytes.

6. **Version string source**
   - Avoid importing a version module just to attach `quikdown.version`. Inject it at build-time (define/replace plugin) so the import and filename go away.

7. **Sanitizer allowlist = shorter code**
   - Make `sanitizeUrl` an **allowlist** (`https?`, `mailto:`, `tel:`, `data:image/…`) and default everything else to `#`. This is both smaller and safer than checking "dangerous" protocols.

8. **Regex reuse**
   - Hoist repeated regexes/constants (list markers, emphasis patterns) and reuse them across helpers to cut literal duplication in the final bundle.

9. **Fence regex generalization**
   - Use a single pattern that supports ``` and `~~~` and 3+ markers. One generalized fence pattern lets you remove alternative branches and comments later.

10. **Optional features as flags/builds**
    - Gate **task list rendering** (checkbox DOM, styles) behind an option or offer a "core" build without it. That lets bundlers tree-shake the feature out.

11. **Heading styles: rely on UA where acceptable**
    - If your UI doesn't require custom `font-size`/`font-weight` on `h1–h6`, drop them from the style map and keep just margin adjustments. Big string savings with no functional change to semantics.

12. **Autolink regex refinement**
    - Use a single autolink approach that trims common trailing punctuation in replacement. It avoids later fix-ups and reduces literal variations.

### Robustness / quality (not primarily size, but worth doing)

1. **Remove blockquote "merge" line**
   - The `</blockquote>\n<blockquote>` → `\n` replacement drops structure and can erase content between quotes. Safer to delete it entirely.

2. **Table row detection is too loose**
   - Current check will treat many non-table lines as tables. Tighten the detection (e.g., require at least one `|` **between** two non-empty cells). This prevents misclassification and reduces need for fallback code.

3. **Fence parity with GFM**
   - Support **3+** markers and match identical marker on close. Keeps behavior predictable for copy-pasted GitHub code blocks.

4. **Lookbehind in italics**
   - Replace lookbehind-based patterns with lookbehind-free heuristics for compatibility with older Safari/WebViews (and less regex backtracking risk).

5. **Autolink punctuation**
   - Exclude trailing `.,);:?!` from the URL capture so rendered links are clean (no user-visible defects).

6. **Consistent inline-code handling**
   - Ensure inline code is treated consistently inside/outside tables (either via placeholder or via the same `processInlineMarkdown` path). It simplifies mental model and testing.

7. **Stable attribute order**
   - Keep link attributes in a stable order (`href`, then `rel`) to reduce diff churn and make tests deterministic.

8. **Tests that guard the tiny surface**
   - Keep a handful of fixtures (headings, nested lists, tables with/without trailing pipes, both fences, autolinks, task lists). Prevents regressions without adding runtime code.

### Sam's Prioritization for Size Wins
For **pure size wins post-minify**, focus on:
- **(1) dedup helpers**
- **(2) CSS literal slimming**
- **(3) prune empty styles**
- **(5) export glue**
- **(6) version injection**

These deliver the biggest bite without touching behavior.

## Comparison: Our Analysis vs Sam's

### Overlapping Ideas
1. **CSS string optimization** - Both identified removing spaces/shortening
2. **Empty style removal** - Both saw thead/tbody/tr/br as waste
3. **getAttr deduplication** - Both identified passing it rather than recreating
4. **URL sanitization** - Both suggested simplification (though different approaches)

### Sam's Unique Insights
1. **Version injection at build time** - Remove import entirely
2. **Export glue removal** - ESM-only could save significant bytes
3. **"quikdown-" constant** - Hoist repeated string prefix
4. **Allowlist vs blocklist for URLs** - Safer AND smaller
5. **Fence regex generalization** - Support 3+ markers like GFM
6. **Optional features/builds** - Task lists as optional feature

### Our Unique Ideas
1. **Escape map to module level** - Simple win
2. **Shorter placeholders** - %%%CODEBLOCK%%% → §CB§
3. **Inline processInlineMarkdown** - Called only from tables
4. **Combined bold/italic regex** - Use backreferences

### Recommended Next Steps (Prioritized)

#### Phase 1: Quick Wins (Target: ~400 bytes)
1. **CSS literal slimming** - Remove spaces, shorten colors
2. **Remove empty styles** - thead, tbody, tr, br
3. **Escape map to module level** - Stop recreating
4. **Shorter placeholders** - Reduce string literals
5. **"quikdown-" constant** - Deduplicate prefix

#### Phase 2: Structural Changes (Target: ~300 bytes)
6. **Pass getAttr instead of recreating** - True deduplication
7. **Version injection at build** - Remove import
8. **URL allowlist approach** - Smaller and safer

#### Phase 3: Consider for Future (Target: ~200 bytes)
9. **ESM-only build option** - Separate build targets
10. **Optional task lists** - Feature flag or separate build
11. **Fence regex generalization** - GFM compatibility