/**
 * quikdown_edit_standalone — Offline-capable editor bundle
 * ═══════════════════════════════════════════════════════
 *
 * This entry point bundles ALL fence-rendering libraries into a single
 * file so the editor works fully offline with zero CDN dependencies.
 *
 * Bundled libraries:
 *   - highlight.js  (core + 12 common languages)
 *   - mermaid        (diagram rendering)
 *   - DOMPurify      (HTML sanitization for html fences)
 *   - Leaflet        (GeoJSON map rendering + base64 marker icons)
 *   - Three.js       (STL 3D model rendering)
 *   - ABCJS          (ABC music notation rendering)
 *   - Vega + Vega-Lite + Vega-Embed (data visualization)
 *   - MathJax        (tex-svg math rendering)
 *   - Natural Earth  (110m vector basemap for offline maps)
 *
 * Defaults `allowExternalFetch: false` — all rendering is local.
 * Pass `allowExternalFetch: true` to re-enable OSM tiles and CDN loads.
 *
 * Usage:
 *   <script src="quikdown_edit_standalone.umd.min.js"></script>
 *   <script>
 *     const editor = new QuikdownEditor('#container', { mode: 'split' });
 *   </script>
 *
 * Or ESM:
 *   import QuikdownEditor from './quikdown_edit_standalone.esm.min.js';
 *
 * @version __QUIKDOWN_VERSION__
 * @license BSD-2-Clause
 */

// ── Import fence-rendering libraries and assign to window ──────────

// highlight.js — core + selectively registered languages
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python    from 'highlight.js/lib/languages/python';
import java      from 'highlight.js/lib/languages/java';
import cpp       from 'highlight.js/lib/languages/cpp';
import c         from 'highlight.js/lib/languages/c';
import css       from 'highlight.js/lib/languages/css';
import xml       from 'highlight.js/lib/languages/xml';
import json      from 'highlight.js/lib/languages/json';
import bash      from 'highlight.js/lib/languages/bash';
import shell     from 'highlight.js/lib/languages/shell';
import sql       from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('c', c);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', shell);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);

window.hljs = hljs;

// Mermaid — diagram rendering
import mermaid from 'mermaid';
window.mermaid = mermaid;
mermaid.initialize({ startOnLoad: false });

// DOMPurify — HTML sanitization for html fence blocks
import DOMPurify from 'dompurify';
window.DOMPurify = DOMPurify;

// Leaflet — GeoJSON map rendering
import * as L from 'leaflet';
window.L = L;

// Fix Leaflet default marker icons — use base64 data URIs for offline support
import { markerIcon, markerIcon2x, markerShadow } from './leaflet_marker_icons.js';
if (L.Icon && L.Icon.Default) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconUrl: markerIcon,
        iconRetinaUrl: markerIcon2x,
        shadowUrl: markerShadow
    });
}

// Three.js — STL 3D model rendering
import * as THREE from 'three';
window.THREE = THREE;

// ABCJS — Music notation rendering
import ABCJS from 'abcjs';
window.ABCJS = ABCJS;

// Vega / Vega-Lite / Vega-Embed — Data visualization
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import vegaEmbed from 'vega-embed';
window.vega = vega;
window.vegaLite = vegaLite;
window.vegaEmbed = vegaEmbed;

// Natural Earth vector basemap — offline country boundaries for GeoJSON maps
import { worldGeoJSON } from './basemap_world.js';
window._qde_worldGeoJSON = worldGeoJSON;

// MathJax — tex-svg math rendering (side-effect import, configures window.MathJax)
import './mathjax_bundle.js';

// ── Import and re-export the editor with offline defaults ──────────

import _QuikdownEditor from './quikdown_edit.js';

/**
 * Standalone version of QuikdownEditor that defaults allowExternalFetch to false.
 * All fence renderers are bundled — no CDN requests needed.
 */
class QuikdownEditor extends _QuikdownEditor {
    constructor(container, options = {}) {
        super(container, { allowExternalFetch: false, ...options });
    }
}

export default QuikdownEditor;
