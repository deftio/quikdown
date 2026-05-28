/**
 * MathJax pre-configuration for the standalone editor bundle.
 *
 * IMPORTANT: This must be imported (and thus evaluated) BEFORE
 * mathjax-full/es5/tex-svg.js runs.  Rollup hoists `import` statements
 * above module-body code, so the config must live in a separate file
 * that is itself imported before tex-svg.
 */

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
