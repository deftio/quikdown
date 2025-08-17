import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * quikdown - Lightweight Markdown Parser (Ultra Lexer)
 * @version ${pkg.version}
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */`;

// Simple plugin to replace version placeholder
const replaceVersion = () => ({
  name: 'replace-version',
  transform(code) {
    return code.replace(/'__QUIKDOWN_VERSION__'/g, `'${pkg.version}'`);
  }
});

export default [
  // ESM build
  {
    input: 'src/quikdown-ultra.js',
    output: {
      file: 'dist/quikdown-ultra.esm.js',
      format: 'es',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // ESM minified
  {
    input: 'src/quikdown-ultra.js',
    output: {
      file: 'dist/quikdown-ultra.esm.min.js',
      format: 'es',
      banner,
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  }
];