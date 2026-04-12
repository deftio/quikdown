/**
 * Rollup config for the standalone (offline) editor bundle.
 *
 * Bundles ALL fence-rendering libraries into a single file:
 *   highlight.js, mermaid, DOMPurify, Leaflet, Three.js
 *
 * Produces 4 files:
 *   dist/quikdown_edit_standalone.esm.js       (unminified ESM)
 *   dist/quikdown_edit_standalone.esm.min.js   (minified ESM)
 *   dist/quikdown_edit_standalone.umd.js       (unminified UMD)
 *   dist/quikdown_edit_standalone.umd.min.js   (minified UMD)
 *
 * Run:  npx rollup -c rollup.config.standalone.js
 * Or:   npm run build:standalone
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import polyfillNode from 'rollup-plugin-polyfill-node';
import postcss from 'rollup-plugin-postcss';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * quikdown_edit_standalone — Offline editor with all fence renderers
 * @version ${pkg.version}
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 *
 * Bundled libraries: highlight.js, mermaid, DOMPurify, Leaflet, Three.js
 * MathJax is NOT bundled (requires network).
 */`;

const replaceVersion = () => ({
    name: 'replace-version',
    transform(code) {
        return {
            code: code.replace(/'__QUIKDOWN_VERSION__'/g, `'${pkg.version}'`),
            map: null
        };
    }
});

// Shared plugins for standalone builds
const standalonePlugins = (minify = false) => [
    replaceVersion(),
    polyfillNode(),
    nodeResolve({
        browser: true,
        preferBuiltins: false,
        extensions: ['.js', '.mjs', '.json']
    }),
    commonjs({
        include: /node_modules/
    }),
    postcss({
        inject: true,       // Inject CSS into JS (no external CSS file needed)
        minimize: minify
    }),
    ...(minify ? [terser({
        output: { comments: /^\/\*\*/ }  // Keep the banner comment
    })] : [])
];

export default [
    // ESM build
    {
        input: 'src/quikdown_edit_standalone.js',
        output: {
            file: 'dist/quikdown_edit_standalone.esm.js',
            format: 'es',
            banner,
            inlineDynamicImports: true
        },
        plugins: standalonePlugins(false)
    },

    // ESM minified
    {
        input: 'src/quikdown_edit_standalone.js',
        output: {
            file: 'dist/quikdown_edit_standalone.esm.min.js',
            format: 'es',
            banner,
            sourcemap: true,
            inlineDynamicImports: true
        },
        plugins: standalonePlugins(true)
    },

    // UMD build
    {
        input: 'src/quikdown_edit_standalone.js',
        output: {
            file: 'dist/quikdown_edit_standalone.umd.js',
            format: 'umd',
            name: 'QuikdownEditor',
            banner,
            inlineDynamicImports: true
        },
        plugins: standalonePlugins(false)
    },

    // UMD minified
    {
        input: 'src/quikdown_edit_standalone.js',
        output: {
            file: 'dist/quikdown_edit_standalone.umd.min.js',
            format: 'umd',
            name: 'QuikdownEditor',
            banner,
            sourcemap: true,
            inlineDynamicImports: true
        },
        plugins: standalonePlugins(true)
    }
];
