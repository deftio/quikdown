import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * quikdown-lex - Lightweight Markdown Parser (Lexer Implementation)
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
  // ESM build
  {
    input: 'src/quikdown-lex.js',
    output: {
      file: 'dist/quikdown-lex.esm.js',
      format: 'es',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // ESM minified
  {
    input: 'src/quikdown-lex.js',
    output: {
      file: 'dist/quikdown-lex.esm.min.js',
      format: 'es',
      banner,
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // CommonJS build
  {
    input: 'src/quikdown-lex.js',
    output: {
      file: 'dist/quikdown-lex.cjs',
      format: 'cjs',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // UMD build
  {
    input: 'src/quikdown-lex.js',
    output: {
      file: 'dist/quikdown-lex.umd.js',
      format: 'umd',
      name: 'quikdown',
      banner
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // UMD minified
  {
    input: 'src/quikdown-lex.js',
    output: {
      file: 'dist/quikdown-lex.umd.min.js',
      format: 'umd',
      name: 'quikdown',
      banner,
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  }
];