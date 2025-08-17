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

### Phase 3: Size Optimizations
- [ ] Implement replace chain array
- [ ] Consolidate getAttr functions
- [ ] Deduplicate inline processing
- [ ] Measure size reduction

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