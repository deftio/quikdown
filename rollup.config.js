import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * quikdown - Lightweight Markdown Parser
 * @version ${pkg.version}
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */`;

// Simple plugin to replace version placeholder
const replaceVersion = () => ({
  name: 'replace-version',
  transform(code, id) {
    const newCode = code.replace(/'__QUIKDOWN_VERSION__'/g, `'${pkg.version}'`);
    return {
      code: newCode,
      map: null // Return null to indicate no source map changes
    };
  }
});

export default [
  // UMD build (browser)
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.umd.js',
      format: 'umd',
      name: 'quikdown',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // UMD minified
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.umd.min.js',
      format: 'umd',
      name: 'quikdown',
      banner,
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // ESM build
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.esm.js',
      format: 'es',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // ESM minified
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.esm.min.js',
      format: 'es',
      banner,
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // CommonJS build
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.cjs',
      format: 'cjs',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // ========== quikdown_bd (Bidirectional) Builds ==========
  
  // BD UMD build (browser)
  {
    input: 'src/quikdown_bd.js',
    output: {
      file: 'dist/quikdown_bd.umd.js',
      format: 'umd',
      name: 'quikdown_bd',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_bd - Bidirectional')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // BD UMD minified
  {
    input: 'src/quikdown_bd.js',
    output: {
      file: 'dist/quikdown_bd.umd.min.js',
      format: 'umd',
      name: 'quikdown_bd',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_bd - Bidirectional'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // BD ESM build
  {
    input: 'src/quikdown_bd.js',
    output: {
      file: 'dist/quikdown_bd.esm.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_bd - Bidirectional')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // BD ESM minified
  {
    input: 'src/quikdown_bd.js',
    output: {
      file: 'dist/quikdown_bd.esm.min.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_bd - Bidirectional'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // BD CommonJS build
  {
    input: 'src/quikdown_bd.js',
    output: {
      file: 'dist/quikdown_bd.cjs',
      format: 'cjs',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_bd - Bidirectional')
    },
    plugins: [replaceVersion(), nodeResolve()]
  }
];