# Copy Rich Content Implementation Plan

## Overview
Implement robust copy-paste functionality for QuikDown Editor that matches squibview's capabilities.
Goal: Ensure all content types paste correctly into Google Docs, Word, and other rich text editors.

## Core Strategy (Based on Squibview)
1. Convert all external resources to base64 data URLs
2. Use canvas for SVG-to-PNG conversion 
3. Preserve dimensions and styling
4. Use async processing for conversions
5. Provide graceful fallbacks

## Phase 1: Built-in Markdown Elements

### 1.1 Text Formatting
- [ ] **Bold** - Preserve `<strong>` or `<b>` tags with inline styles
- [ ] **Italic** - Preserve `<em>` or `<i>` tags with inline styles  
- [ ] **Underline** - Convert to `<u>` tags with inline styles
- [ ] **Strikethrough** - Convert to `<del>` or `<s>` tags with inline styles
- [ ] **Inline code** - Convert to `<code>` with background color

### 1.2 Block Elements
- [ ] **Headings (H1-H6)** - Preserve with inline font sizes and weights
- [ ] **Paragraphs** - Maintain paragraph spacing with inline margins
- [ ] **Lists (ul/ol)** - Preserve list structure with proper indentation
- [ ] **Blockquotes** - Style with left border and padding
- [ ] **Horizontal rules** - Convert to styled `<hr>` or border div

### 1.3 Tables
- [ ] **Basic tables** - Convert to HTML tables with inline border styles
- [ ] **Header rows** - Apply background color to header cells
- [ ] **Cell alignment** - Preserve text-align styles
- [ ] **Cell padding** - Apply consistent padding inline

### 1.4 Links & Images
- [ ] **Links** - Preserve href with underline and color
- [ ] **Images** - Convert to base64 data URLs
  - [ ] Handle local images
  - [ ] Handle remote images with CORS
  - [ ] Preserve alt text
  - [ ] Maintain dimensions

## Phase 2: Fence Block Types

### 2.1 Code Blocks
- [ ] **Plain code** - Wrap in table with gray background
- [ ] **Syntax highlighted** - Convert highlight classes to inline colors
  - [ ] Map hljs classes to color styles
  - [ ] Preserve monospace font
  - [ ] Apply single background to whole block (not line-by-line)

### 2.2 SVG Content and SVG Block fences
- [ ] **Inline SVG** - Convert to PNG using canvas
  - [ ] Create offscreen canvas
  - [ ] Draw SVG to canvas
  - [ ] Extract as data URL
  - [ ] Preserve dimensions

### 2.3 Mermaid Diagrams
- [ ] **Rendered Mermaid** - Convert SVG output to PNG
  - [ ] Wait for Mermaid rendering to complete
  - [ ] Get generated SVG element
  - [ ] Convert to PNG via canvas
  - [ ] Handle complex gradients and styles

### 2.4 Math Blocks
- [ ] **KaTeX/MathJax output** - Convert rendered math to image
  - [ ] Wait for math rendering
  - [ ] If SVG output: convert to PNG
  - [ ] If HTML output: use html2canvas
  - [ ] Scale oversized equations
  - [ ] Add white background

### 2.5 Data Tables (CSV/TSV/PSV)
- [ ] **Rendered tables** - Convert to HTML tables
  - [ ] Parse delimiter-separated values
  - [ ] Apply consistent styling
  - [ ] Handle header rows
  - [ ] Apply borders and padding

### 2.6 HTML Blocks 
- [ ] **Raw HTML** - Preserve with sanitization
  - [ ] Keep safe HTML elements
  - [ ] Convert external resources to data URLs
  - [ ] Apply inline styles


### 2.7 GeoJSON Maps
- [ ] **Leaflet maps** - Convert to static image
  - [ ] Wait for map tiles to load
  - [ ] Use leaflet-image or canvas capture
  - [ ] Include attribution text
  - [ ] Preserve zoom level and center

### 2.8 STL 3D Models
- [ ] **Three.js viewer** - Capture canvas as image
  - [ ] Wait for model to render
  - [ ] Use canvas.toDataURL()
  - [ ] Handle WebGL context
  - [ ] Provide fallback for WebGL errors

## Phase 3: Technical Implementation
Not sure about these below I think we should look at how squibview handeled each use case above and make sure we know what we are doing.

### 3.1 Core Copy Function
```javascript
async copyRich() {
    // 1. Show progress indicator
    // 2. Clone preview content
    // 3. Process each content type
    // 4. Convert to clipboard-friendly HTML
    // 5. Write to clipboard with fallback
}
```

### 3.2 Helper Functions
- [ ] `svgToPng(svg)` - Convert SVG element to PNG data URL
- [ ] `imageToDataUrl(img)` - Convert image to base64 
- [ ] `waitForRender(element, timeout)` - Wait for async rendering
- [ ] `processCodeBlock(block)` - Format code with inline styles
- [ ] `processMathBlock(block)` - Convert math to image
- [ ] `processMap(container)` - Capture map as image

### 3.3 Canvas Conversion Strategy
```javascript
async svgToPng(svg) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Get SVG dimensions
    const bbox = svg.getBoundingClientRect();
    canvas.width = bbox.width;
    canvas.height = bbox.height;
    
    // Convert SVG to blob
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(svgBlob);
    
    // Draw to canvas
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
    };
    img.src = url;
    
    // Return as data URL
    return canvas.toDataURL('image/png');
}
```

### 3.4 Error Handling
- [ ] Try-catch blocks for each conversion
- [ ] Fallback to original content on error
- [ ] Console warnings for debugging
- [ ] User feedback for failures

## Phase 4: Testing & Validation

### 4.1 Test Cases
- [ ] Copy each content type individually
- [ ] Copy mixed content document
- [ ] Test in Google Docs
- [ ] Test in Microsoft Word
- [ ] Test in email clients
- [ ] Test in other markdown editors

### 4.2 Known Issues to Address
- [ ] Canvas tainted by cross-origin content
- [ ] WebGL context limitations
- [ ] Large image performance
- [ ] Async rendering timing
- [ ] Clipboard API browser support

## Phase 5: Optimization

### 5.1 Performance
- [ ] Batch conversions where possible
- [ ] Use worker threads for heavy processing
- [ ] Cache converted resources
- [ ] Optimize canvas operations

### 5.2 Quality
- [ ] Maintain high DPI for retina displays
- [ ] Preserve original image quality
- [ ] Handle transparent backgrounds
- [ ] Maintain aspect ratios

## Implementation Order
1. Fix basic text and tables (Phase 1)
2. Implement image-to-dataURL conversion
3. Add SVG-to-PNG converter
4. Handle code blocks with proper styling
5. Add math rendering support
6. Implement map capture
7. Add remaining fence types
8. Optimize and test

## Success Criteria
- No "image retrieval error" in Google Docs
- All content types paste correctly
- Fast copy operation (< 2 seconds for typical document)
- Graceful fallbacks for unsupported content
- Works across major browsers

## References
- Squibview implementation: github.com/deftio/squibview 
- Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API