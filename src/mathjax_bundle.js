/**
 * MathJax bundle shim for the standalone editor.
 *
 * Pre-configures window.MathJax then evaluates the pre-built tex-svg
 * component so it can run in a bundled context (no network, no script tags).
 *
 * This file is imported for its side effects — it populates window.MathJax
 * with a fully-functional tex-svg renderer.
 */

// Pre-configure MathJax before the component initializes
if (typeof window !== 'undefined' && !window.MathJax) {
    window.MathJax = {
        loader: { load: ['input/tex', 'output/svg'] },
        tex: {
            packages: { '[+]': ['ams'] },
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            processEnvironments: true
        },
        options: {
            renderActions: { addMenu: [] },
            ignoreHtmlClass: 'tex2jax_ignore',
            processHtmlClass: 'tex2jax_process'
        },
        svg: {
            fontCache: 'none'  // self-contained SVGs (required for copy-rendered)
        },
        startup: { typeset: false }
    };
}

// Import the pre-built tex-svg component (side-effect: configures MathJax on window)
import 'mathjax-full/es5/tex-svg.js';
