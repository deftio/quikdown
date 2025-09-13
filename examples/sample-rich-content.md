# Welcome to Quikdown 

**Quikdown** is a compact markdown parser/editor. This document shows various features such as html preview, Mermaid diagrams, syntax-highlighted code blocks, tables, and inline SVG graphics.

[Code is Here on GitHub](www.github.com/deftio/quikdown)

Quikdown allows live view of source (mixed markdown), rendered (html), or split-view for debugging.  It can be used as a lightweight editor or as a headless component which can be deployed in apps. Quikdown supports running headless (no controls) and can be styled or themed with CSS.

## Diagram Example

Below is a Mermaid diagram demonstrating a simple flow:

```mermaid
graph TD;
A[Start] --> B{Is it working?};
B -- Yes --> C[Great!];
B -- No --> D[Fix it!];
D --> B;
style A fill:#39f,stroke:#333,stroke-width:4px;
style B fill:#fef,stroke:#03e,stroke-width:2px;
style C fill:#de0f,stroke:#333,stroke-width:4px;
style D fill:#8f2,stroke:#333,stroke-width:4px;



id1(Begin)-->id2(End)
style id1 fill:#f9f,stroke:#333,stroke-width:4px
style id2 fill:#bbf,stroke:#f66,stroke-width:3px,color:#fff,stroke-dasharray: 5;
```

## Code Example

Here's a JavaScript code snippet with syntax highlighting:

```javascript
// A simple greeting function
let name="World";
function greet(name) {
    console.log(\`Hello, \${name}!\`);
}

greet("World");

let x = {
      "key one" : "this is a value",
      "many things" : [1,2,3,34],
      "and more" : {
        "x" : 1,
        "y" : 2
      }
}

```

## Basic Table Example

The table below lists some features and their statuses:

| Feature           | Supported |
| ----------------- | --------- |
| Live Preview      | Yes       |
| Mermaid Diagrams  | Yes       |
| Syntax Highlight  | Yes       |
| Table Styling     | Yes       |
| SVG Rendering     | Yes       |


## Inline SVG Example

Below is an inline SVG graphic rendered directly from Markdown:

```svg
<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
    <rect x="150" y="10"  width="80" height="80" stroke="orange" stroke-width="4" fill="blue" /> 
</svg>
```

## CSV / TSV / PSV Support
Quikdown allows inline tables via CSV, TSV, or PSV separated entries

### CSV Example

```csv
Name,Age,City
Alice,30,New York
Bob,24,Paris
Charlie,35,London
David,29,Berlin
Eve,42,Tokyo
```

### TSV Example

```tsv
Fruit	Color	Taste
Apple	Red	Sweet
Banana	Yellow	Sweet
Lemon	Yellow	Sour
Orange	Orange	Sweet
Grape	Purple	Sweet
```

### PSV (Pipe-Separated Values) Example

```psv
ID|Product|Price|InStock
101|Laptop|1200|Yes
102|Mouse|25|Yes
103|Keyboard|75|No
104|Monitor|300|Yes
105|Webcam|50|No
```

## Additional Content

You can also include regular text, lists, images, and more:

- Bullet points are supported.
- **Bold** and *italic* text work seamlessly.
- [Links](https://github.com/quikdown) can be included.

## Image Support

With regular image (md):

![Image](palm.png)

Image with embedded html:

```html
<img src="sample.webp" alt="drawing" width="250"/>
```

## Fenced Math Block Example

This demonstrates a fenced math block using MathJax:

```math
e^{i\pi} + 1 = 0
```

A more complex one:

```math
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix} = \mathbf{X}
```

And an integral example:

```math
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
```

And a summation example:

```math
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
```

## GeoJSON Map Example

This demonstrates a fenced GeoJSON block that renders an interactive map:

```geojson
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-74.0445, 40.6892]
  },
  "properties": {
    "name": "Statue of Liberty"
  }
}
```

A more complex GeoJSON example with multiple features:

```geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      },
      "properties": {
        "name": "San Francisco",
        "population": 884363
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-74.0060, 40.7128]
      },
      "properties": {
        "name": "New York City",
        "population": 8336817
      }
    }
  ]
}
```

## STL 3D Model Example

This demonstrates a fenced STL block that renders an interactive 3D model:

```stl
solid cube
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 0 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 1 1
      vertex 0 1 1
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 1 0
      vertex 1 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 0 1 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 1 1 1
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 1 0 1
      vertex 0 0 1
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 0 1
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 1 0
      vertex 1 1 1
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 1 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 1 1
      vertex 0 1 0
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 0 1
      vertex 0 1 1
    endloop
  endfacet
endsolid cube
```

