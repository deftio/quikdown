import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * QuikDown - Lightweight Markdown Parser
 * @version ${pkg.version}
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */`;

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
    plugins: [nodeResolve()]
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
    plugins: [nodeResolve(), terser()]
  },
  
  // ESM build
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.esm.js',
      format: 'es',
      banner
    },
    plugins: [nodeResolve()]
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
    plugins: [nodeResolve(), terser()]
  },
  
  // CommonJS build
  {
    input: 'src/quikdown.js',
    output: {
      file: 'dist/quikdown.cjs',
      format: 'cjs',
      banner
    },
    plugins: [nodeResolve()]
  }
];