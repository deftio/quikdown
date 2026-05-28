/**
 * MathJax bundle shim for the standalone editor.
 *
 * Pre-configures window.MathJax then evaluates the pre-built tex-svg
 * component so it can run in a bundled context (no network, no script tags).
 *
 * This file is imported for its side effects — it populates window.MathJax
 * with a fully-functional tex-svg renderer.
 *
 * NOTE: The config lives in mathjax_config.js (a separate module) because
 * ES `import` statements are hoisted above module-body code.  By importing
 * the config module, Rollup inlines its side-effects BEFORE the tex-svg
 * IIFE, ensuring window.MathJax is set when tex-svg initializes.
 */

// 1. Pre-configure — must run before tex-svg.js
import './mathjax_config.js';

// 2. Import the pre-built tex-svg component (side-effect: initializes MathJax)
import 'mathjax-full/es5/tex-svg.js';
