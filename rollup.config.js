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
  
  // BD UMD build (browser) - standalone with everything bundled
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
  },
  
  // Quikdown Editor UMD build
  {
    input: 'src/quikdown_edit.js',
    output: {
      file: 'dist/quikdown_edit.umd.js',
      format: 'umd',
      name: 'QuikdownEditor',
      banner: banner.replace('quikdown - Lightweight', 'Quikdown Editor - Drop-in')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // Quikdown Editor UMD minified
  {
    input: 'src/quikdown_edit.js',
    output: {
      file: 'dist/quikdown_edit.umd.min.js',
      format: 'umd',
      name: 'QuikdownEditor',
      banner: banner.replace('quikdown - Lightweight', 'Quikdown Editor - Drop-in'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // Quikdown Editor ESM build
  {
    input: 'src/quikdown_edit.js',
    output: {
      file: 'dist/quikdown_edit.esm.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'Quikdown Editor - Drop-in')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },
  
  // Quikdown Editor ESM minified
  {
    input: 'src/quikdown_edit.js',
    output: {
      file: 'dist/quikdown_edit.esm.min.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'Quikdown Editor - Drop-in'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },
  
  // Quikdown Editor CommonJS build
  {
    input: 'src/quikdown_edit.js',
    output: {
      file: 'dist/quikdown_edit.cjs',
      format: 'cjs',
      banner: banner.replace('quikdown - Lightweight', 'Quikdown Editor - Drop-in')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // ========== quikdown_ast (AST Parser) Builds ==========

  // AST UMD build (browser)
  {
    input: 'src/quikdown_ast.js',
    output: {
      file: 'dist/quikdown_ast.umd.js',
      format: 'umd',
      name: 'quikdown_ast',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast - AST')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // AST UMD minified
  {
    input: 'src/quikdown_ast.js',
    output: {
      file: 'dist/quikdown_ast.umd.min.js',
      format: 'umd',
      name: 'quikdown_ast',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast - AST'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // AST ESM build
  {
    input: 'src/quikdown_ast.js',
    output: {
      file: 'dist/quikdown_ast.esm.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast - AST')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // AST ESM minified
  {
    input: 'src/quikdown_ast.js',
    output: {
      file: 'dist/quikdown_ast.esm.min.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast - AST'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // AST CommonJS build
  {
    input: 'src/quikdown_ast.js',
    output: {
      file: 'dist/quikdown_ast.cjs',
      format: 'cjs',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast - AST')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // ========== quikdown_json (JSON Output) Builds ==========

  // JSON UMD build (browser)
  {
    input: 'src/quikdown_json.js',
    output: {
      file: 'dist/quikdown_json.umd.js',
      format: 'umd',
      name: 'quikdown_json',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_json - JSON')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // JSON UMD minified
  {
    input: 'src/quikdown_json.js',
    output: {
      file: 'dist/quikdown_json.umd.min.js',
      format: 'umd',
      name: 'quikdown_json',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_json - JSON'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // JSON ESM build
  {
    input: 'src/quikdown_json.js',
    output: {
      file: 'dist/quikdown_json.esm.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_json - JSON')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // JSON ESM minified
  {
    input: 'src/quikdown_json.js',
    output: {
      file: 'dist/quikdown_json.esm.min.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_json - JSON'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // JSON CommonJS build
  {
    input: 'src/quikdown_json.js',
    output: {
      file: 'dist/quikdown_json.cjs',
      format: 'cjs',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_json - JSON')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // ========== quikdown_yaml (YAML Output) Builds ==========

  // YAML UMD build (browser)
  {
    input: 'src/quikdown_yaml.js',
    output: {
      file: 'dist/quikdown_yaml.umd.js',
      format: 'umd',
      name: 'quikdown_yaml',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_yaml - YAML')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // YAML UMD minified
  {
    input: 'src/quikdown_yaml.js',
    output: {
      file: 'dist/quikdown_yaml.umd.min.js',
      format: 'umd',
      name: 'quikdown_yaml',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_yaml - YAML'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // YAML ESM build
  {
    input: 'src/quikdown_yaml.js',
    output: {
      file: 'dist/quikdown_yaml.esm.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_yaml - YAML')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // YAML ESM minified
  {
    input: 'src/quikdown_yaml.js',
    output: {
      file: 'dist/quikdown_yaml.esm.min.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_yaml - YAML'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // YAML CommonJS build
  {
    input: 'src/quikdown_yaml.js',
    output: {
      file: 'dist/quikdown_yaml.cjs',
      format: 'cjs',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_yaml - YAML')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // ========== quikdown_ast_html (AST to HTML) Builds ==========

  // AST-HTML UMD build (browser)
  {
    input: 'src/quikdown_ast_html.js',
    output: {
      file: 'dist/quikdown_ast_html.umd.js',
      format: 'umd',
      name: 'quikdown_ast_html',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast_html - AST to HTML')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // AST-HTML UMD minified
  {
    input: 'src/quikdown_ast_html.js',
    output: {
      file: 'dist/quikdown_ast_html.umd.min.js',
      format: 'umd',
      name: 'quikdown_ast_html',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast_html - AST to HTML'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // AST-HTML ESM build
  {
    input: 'src/quikdown_ast_html.js',
    output: {
      file: 'dist/quikdown_ast_html.esm.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast_html - AST to HTML')
    },
    plugins: [replaceVersion(), nodeResolve()]
  },

  // AST-HTML ESM minified
  {
    input: 'src/quikdown_ast_html.js',
    output: {
      file: 'dist/quikdown_ast_html.esm.min.js',
      format: 'es',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast_html - AST to HTML'),
      sourcemap: true
    },
    plugins: [replaceVersion(), nodeResolve(), terser()]
  },

  // AST-HTML CommonJS build
  {
    input: 'src/quikdown_ast_html.js',
    output: {
      file: 'dist/quikdown_ast_html.cjs',
      format: 'cjs',
      banner: banner.replace('quikdown - Lightweight', 'quikdown_ast_html - AST to HTML')
    },
    plugins: [replaceVersion(), nodeResolve()]
  }
];