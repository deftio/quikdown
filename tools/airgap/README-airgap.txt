quikdown offline / air-gapped bundle
====================================

Contents:
  quikdown_edit_standalone.umd.min.js   — drop-in editor (all fence libs bundled)
  quikdown_edit_standalone.esm.min.js   — ES module variant
  basemap_countries_110m.topojson       — country fills (110m)
  basemap_admin1_lines.topojson         — global state/province borders (10m lines)
  quikdown.light.min.css                — light theme
  quikdown.dark.min.css                 — dark theme
  offline-demo.html                     — open in a browser to try it

Offline core (JS + both basemap files) is capped at 9 MB uncompressed.

Quick start (no network):
  1. Unzip this folder anywhere.
  2. Open offline-demo.html in Chrome, Firefox, or Edge.
  3. Edit markdown on the left; preview renders on the right.

Keep basemap_*.topojson in the same folder as the standalone .js files.

UMD script tag:
  <script src="quikdown_edit_standalone.umd.min.js"></script>
  <script>
    const editor = new QuikdownEditor('#container', { mode: 'split' });
  </script>

ES module:
  import QuikdownEditor from './quikdown_edit_standalone.esm.min.js';

Bundled offline: highlight.js, Mermaid, DOMPurify, Leaflet, Three.js, ABCJS, Vega, MathJax
Basemap: basemap_countries_110m.topojson + basemap_admin1_lines.topojson (loaded at runtime)

Docs: https://github.com/deftio/quikdown/blob/main/docs/standalone-editor.md
