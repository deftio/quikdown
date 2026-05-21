/**
 * rollup.config.coverage.js
 *
 * Builds the editor ESM bundle with Istanbul instrumentation so that
 * Playwright E2E tests can collect branch/line/function coverage for
 * browser-only code paths (Canvas, WebGL, clipboard, etc.).
 *
 * Output: dist/quikdown_edit.esm.cov.js  (unminified, instrumented)
 *
 * Usage:
 *   npx rollup -c rollup.config.coverage.js
 *   npm run build:coverage
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const replaceVersion = () => ({
  name: 'replace-version',
  transform(code) {
    return { code: code.replace(/'__QUIKDOWN_VERSION__'/g, `'${pkg.version}'`), map: null };
  }
});

export default {
  input: 'src/quikdown_edit.js',
  output: {
    file: 'dist/quikdown_edit.esm.cov.js',
    format: 'es'
  },
  plugins: [
    replaceVersion(),
    nodeResolve(),
    babel({
      babelHelpers: 'bundled',
      plugins: ['istanbul']
    })
  ]
};
