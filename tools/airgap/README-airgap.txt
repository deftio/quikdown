quikdown offline / air-gapped bundle
====================================

Contents:
  quikdown_edit_standalone.umd.min.js   — drop-in editor (all fence libs bundled)
  quikdown_edit_standalone.esm.min.js   — ES module variant
  quikdown.light.min.css                — light theme
  quikdown.dark.min.css                 — dark theme
  offline-demo.html                     — open in a browser to try it

Quick start (no network):
  1. Unzip this folder anywhere.
  2. Open offline-demo.html in Chrome, Firefox, or Edge.
  3. Edit markdown on the left; preview renders on the right.

UMD script tag:
  <script src="quikdown_edit_standalone.umd.min.js"></script>
  <script>
    const editor = new QuikdownEditor('#container', { mode: 'split' });
  </script>

ES module:
  import QuikdownEditor from './quikdown_edit_standalone.esm.min.js';

Bundled offline: highlight.js, Mermaid, DOMPurify, Leaflet, Three.js
Not bundled: MathJax (requires network for fonts)

Docs: https://github.com/deftio/quikdown/blob/main/docs/standalone-editor.md
