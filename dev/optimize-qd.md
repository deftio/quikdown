# quikdown Size Optimization & Theme System

## Current Status
- **Size:** ~9.2KB minified (approaching 10KB limit)
- **Target:** <7.5KB
- **Potential Savings:** ~2KB

## Theme System Architecture (Clarification)

### Current Issue
The styles are hardcoded in the source file, duplicated in two places. This is NOT the intended design.

### Intended Design
1. **Theme Parameters** - Core should have configurable theme parameters:
   ```javascript
   const THEME_PARAMS = {
     colors: {
       text: '#333',
       background: '#fff',
       codeBg: '#f4f4f4',
       codeText: '#333',
       link: '#0066cc',
       border: '#ddd',
       // etc...
     },
     fonts: {
       body: 'sans-serif',
       code: 'monospace'
     },
     spacing: {
       // margins, paddings, etc.
     }
   };
   ```

2. **emitStyles(theme)** - Should accept theme parameters:
   ```javascript
   quikdown.emitStyles = function(theme = 'light') {
     const params = THEMES[theme];
     // Generate CSS from params
     return generateCSS(params);
   };
   ```

3. **Build Process** - Should generate theme files:
   ```javascript
   // tools/generateThemes.js
   const lightCSS = quikdown.emitStyles('light');
   fs.writeFileSync('dist/quikdown.light.css', lightCSS);
   
   const darkCSS = quikdown.emitStyles('dark');
   fs.writeFileSync('dist/quikdown.dark.css', darkCSS);
   ```

4. **User Options:**
   - Use pre-built themes: `<link rel="stylesheet" href="quikdown.light.css">`
   - Use inline styles: `quikdown(md, { inline_styles: true })`
   - Custom CSS: Write own styles for `.quikdown-*` classes

## Size Optimizations

### 1. Remove Style Duplication (~800 bytes)
**Problem:** Styles defined twice - in main function and emitStyles()

**Solution:** 
- [ ] Create theme parameter system
- [ ] Generate styles from parameters
- [ ] Build tool to create CSS files

### 2. Consolidate getAttr() Function (~200 bytes)
**Problem:** Defined 4 times in different functions

**Solution:**
- [ ] Create single factory function
- [ ] Pass as parameter or use closure

### 3. Optimize Replace Chains (~400 bytes)
**Problem:** 30+ sequential `html = html.replace()` calls

**Solution:**
```javascript
// Current (verbose)
html = html.replace(/<p><\/p>/g, '');
html = html.replace(/<p>(<h[1-6][^>]*>)/g, '$1');
html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
// ... 10+ more lines

// Optimized
const paragraphCleanups = [
  [/<p><\/p>/g, ''],
  [/<p>(<h[1-6][^>]*>)/g, '$1'],
  [/(<\/h[1-6]>)<\/p>/g, '$1'],
  // ...
];
for (const [pattern, replacement] of paragraphCleanups) {
  html = html.replace(pattern, replacement);
}
```

### 4. Remove processInlineMarkdown Duplication (~300 bytes)
**Problem:** Duplicate logic for bold/italic/strikethrough

**Options:**
- A) Use processInlineMarkdown everywhere
- B) Remove it and inline in tables
- C) Refactor to eliminate duplication

### 5. Pre-compile Common Regexes (~100 bytes)
**Problem:** Regex literals created multiple times

**Solution:**
```javascript
// Module level
const REGEX = {
  bold: /\*\*(.+?)\*\*/g,
  italic: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
  // ...
};
```

## Implementation Plan

### Phase 1: Theme System Refactor
1. [ ] Design theme parameter structure
2. [ ] Implement theme-based style generation
3. [ ] Create build script for CSS generation
4. [ ] Test generated CSS matches current output

### Phase 2: Size Optimizations
1. [ ] Implement replace chain optimization
2. [ ] Consolidate getAttr functions
3. [ ] Remove processInlineMarkdown duplication
4. [ ] Pre-compile regexes

### Phase 3: Testing & Validation
1. [ ] Run full test suite
2. [ ] Compare outputs (original vs optimized)
3. [ ] Verify size reduction
4. [ ] Test theme generation

## Notes
- The theme system should be the priority - it's the intended design
- Size optimizations should not break theme flexibility
- Each optimization should be tested independently
- Keep backward compatibility for existing usage