# SquibView Copy-to-Clipboard Implementation

## Overview

SquibView provides two distinct copy-to-clipboard functions:
1. **Copy Source** (`copySource()`) - Copies the raw Markdown/source content
2. **Copy Rendered** (`copyHTML()`) - Copies the formatted HTML with rich content preservation

## Copy Source Implementation

The `copySource()` method (src/squibview.js:1610) copies plain Markdown text to the clipboard:

```javascript
async copySource() {
  // Gets the raw Markdown source text
  const markdownText = this.getMarkdownSource();
  
  // Primary approach: Modern Clipboard API
  await navigator.clipboard.writeText(markdownText);
  
  // Fallback: Creates temporary textarea for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = markdownText;
  document.body.appendChild(textarea);
  textarea.select();
  document.body.removeChild(textarea);
}
```

## Copy Rendered HTML Implementation

The `copyHTML()` method (src/squibview.js:2224) is a sophisticated system that preserves rich formatting by converting complex content types to clipboard-compatible formats.

### Processing Pipeline

1. **Clone the rendered content** - Creates a deep clone of the contenteditable div
2. **Process each content type** - Transforms special elements for clipboard compatibility
3. **Generate HTML document** - Wraps content in proper HTML structure with styles
4. **Write to clipboard** - Uses platform-specific approaches

### Content Type Processing

#### 1. Code Blocks (src/squibview.js:2237)

Code blocks with syntax highlighting are converted to HTML tables for better compatibility:

```javascript
// Original: <pre><code class="hljs">...</code></pre>
// Converted to:
<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <td style="background-color: #f7f7f7; padding: 12px; 
               font-family: monospace; white-space: pre;">
      [formatted code with syntax highlighting preserved]
    </td>
  </tr>
</table>
```

#### 2. Regular Images (src/squibview.js:2261)

Images are converted to data URLs to ensure they paste correctly:

```javascript
// Process:
1. Create canvas with intended display dimensions
2. Draw image to canvas at proper size
3. Convert to PNG data URL
4. Replace img src with data URL
5. Set explicit width/height attributes
```

Special handling for external badges (e.g., shields.io) that can't be converted - preserves original URL.

#### 3. SVG Elements (src/squibview.js:2333)

Non-math SVGs (including Mermaid diagrams) are converted to PNG:

```javascript
svgToPng(svgElement) {
  // Serialize SVG to string
  const svgString = new XMLSerializer().serializeToString(svgElement);
  
  // Create canvas with 2x scale for quality
  const scale = 2;
  canvas.width = svgWidth * scale;
  canvas.height = svgHeight * scale;
  
  // Draw SVG to canvas
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  // Convert to PNG blob
  canvas.toBlob(resolve, 'image/png', 1.0);
}
```

Mermaid diagrams get special dimension handling since they often lack explicit width/height attributes.

#### 4. MathJax Content (src/squibview.js:2394)

Mathematical expressions rendered by MathJax require special processing:

```javascript
// MathJax rendering pipeline:
1. Find .math-display elements containing MathJax SVG
2. Extract SVG element
3. Serialize SVG to string
4. Create blob and object URL
5. Load into Image element
6. Draw to canvas with scaling:
   - Base scale factor: 0.10 (MathJax SVGs are oversized)
   - Target max dimensions: 300x100 pixels
   - Additional scaling if needed
7. Convert canvas to PNG data URL
8. Replace math element with img tag
```

The aggressive scaling (0.10 base factor) is necessary because MathJax generates SVGs with very large coordinate systems that would otherwise paste as huge images.

#### 5. GeoJSON Maps (src/squibview.js:2498)

Interactive Leaflet maps are converted to static images:

```javascript
divToDataUrl(element) {
  // Special handling for Leaflet maps
  if (element.classList.contains('geojson-container')) {
    // Access Leaflet map instance
    const map = window[mapId + '_map'];
    
    // Create canvas matching map dimensions
    // Draw map tiles layer by layer:
    1. White background
    2. Load and draw each tile image
    3. Draw SVG overlays (paths, markers)
    4. Convert final canvas to data URL
  }
}
```

Process captures:
- Map tiles from tile providers
- SVG overlays (GeoJSON features)
- Preserves geographic data visualization

#### 6. TopoJSON Data (src/squibview.js:2556)

TopoJSON is converted to structured HTML tables:

```javascript
// Creates informative table showing:
- Type: "Topology"
- Objects: List of geographic objects
- Falls back to formatted JSON if parsing fails
```

#### 7. STL 3D Models (src/squibview.js:2599)

Three.js rendered 3D models are captured as static images:

```javascript
// Process:
1. Find Three.js WebGL canvas
2. Access renderer, scene, and camera objects
3. Force render: renderer.render(scene, camera)
4. Convert canvas to PNG data URL
5. Handle WebGL context security restrictions
```

Falls back to placeholder text if WebGL context can't be captured.

### Platform-Specific Clipboard Writing

#### macOS (src/squibview.js:2702)
```javascript
await navigator.clipboard.write([
  new ClipboardItem({
    'text/html': new Blob([htmlContent], { type: 'text/html' }),
    'text/plain': new Blob([clone.innerText], { type: 'text/plain' })
  })
]);
```

#### Windows/Linux (src/squibview.js:2718)
Creates temporary div with content, uses selection range, and fallback to document.execCommand('copy').

### Fallback Method

The `copyToClipboard()` helper (src/squibview.js:2909) provides multiple fallback approaches:

1. Creates textarea with contenteditable=true
2. Attempts document.execCommand('copy')
3. Handles iOS-specific quirks
4. Returns boolean success indicator

## Hard Fence Processing

Hard fences are special code blocks that render as interactive content:

### Fence Types and Renderers

1. **`mermaid`** - Diagram notation → Mermaid SVG diagram
2. **`svg`** - Raw SVG code → Rendered SVG element  
3. **`geojson`** - Geographic data → Leaflet interactive map
4. **`topojson`** - Topology data → Leaflet interactive map
5. **`stl`** - 3D model data → Three.js WebGL viewer
6. **`math`** - LaTeX notation → MathJax formatted equations
7. **`csv/tsv/psv`** - Delimited data → HTML tables

### Clipboard Conversion Strategy

Each hard fence type has a specific conversion strategy for clipboard:

| Fence Type | Rendered As | Clipboard Format |
|------------|-------------|------------------|
| mermaid | SVG diagram | PNG image |
| svg | SVG element | PNG image |
| geojson | Leaflet map | PNG screenshot or placeholder |
| topojson | Leaflet map | HTML table with data |
| stl | 3D WebGL canvas | PNG snapshot or placeholder |
| math | MathJax SVG | Scaled PNG image |
| csv/tsv | HTML table | HTML table (preserved) |

## Error Handling

The implementation includes comprehensive error handling:

1. **Try-catch blocks** at each conversion step
2. **Fallback content** when conversion fails (placeholders)
3. **Console warnings** for debugging without breaking flow
4. **Progressive degradation** from rich content → image → text

## Key Implementation Details

### Dimension Preservation
- Images maintain aspect ratios
- Explicit width/height attributes prevent layout shifts
- SVGs converted at appropriate scale (2x for quality)

### Data URL Generation
- Canvas-based conversion for maximum compatibility
- Base64 encoding for inline embedding
- PNG format for universal support

### Memory Management
- Object URLs revoked after use
- Temporary elements removed from DOM
- Blob cleanup after clipboard write

### Cross-Browser Compatibility
- Modern Clipboard API as primary method
- Fallback to execCommand for older browsers
- Platform detection for OS-specific approaches
- Special handling for Safari/iOS limitations

## Testing Considerations

When testing copy functionality:

1. **Test each content type** individually
2. **Verify dimension preservation** for images/diagrams
3. **Check math equation scaling** is appropriate
4. **Ensure maps capture** or fallback gracefully
5. **Test platform-specific paths** (macOS vs Windows/Linux)
6. **Verify fallback mechanisms** work in older browsers
7. **Check memory cleanup** (no leaking object URLs)

## Future Improvements

Potential enhancements:
- Vector format preservation for SVG/Math where possible
- Configurable image quality/compression
- User preferences for conversion formats
- Better WebGL canvas capture for 3D content
- Async loading indicators for large content