/**
 * Package contract tests for quikdown v1.2.14+
 *
 * These tests verify that the package.json exports map, TypeScript definitions,
 * and dist bundles are internally consistent and that forward→reverse roundtrip
 * contracts hold for bidirectional conversion.
 *
 * They complement coverage metrics — 100 % line coverage cannot catch a missing
 * .d.ts or a silent alignment-data regression.
 */

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';

const ROOT = path.resolve(process.cwd());
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// 1. Package structure contracts
// ---------------------------------------------------------------------------
describe('package.json exports contract', () => {
  test('every exports.types file exists on disk', () => {
    const exportsMap = pkg.exports || {};
    for (const [subpath, conditions] of Object.entries(exportsMap)) {
      if (subpath === './package.json') continue;
      if (typeof conditions !== 'object' || conditions === null) continue;
      if (conditions.types) {
        const abs = path.join(ROOT, conditions.types);
        expect(fs.existsSync(abs)).toBe(true);
      }
    }
  });

  test('root "types" entry exists on disk', () => {
    expect(pkg.types).toBeDefined();
    const abs = path.join(ROOT, pkg.types);
    expect(fs.existsSync(abs)).toBe(true);
  });

  test('every exports.import file exists on disk', () => {
    for (const [subpath, conditions] of Object.entries(pkg.exports || {})) {
      if (subpath === './package.json') continue;
      if (typeof conditions !== 'object' || conditions === null) continue;
      if (conditions.import) {
        const abs = path.join(ROOT, conditions.import);
        expect(fs.existsSync(abs)).toBe(true);
      }
    }
  });

  test('every exports.require file exists on disk', () => {
    for (const [subpath, conditions] of Object.entries(pkg.exports || {})) {
      if (subpath === './package.json') continue;
      if (typeof conditions !== 'object' || conditions === null) continue;
      if (conditions.require) {
        const abs = path.join(ROOT, conditions.require);
        expect(fs.existsSync(abs)).toBe(true);
      }
    }
  });

  test('every exports.browser file exists on disk', () => {
    for (const [subpath, conditions] of Object.entries(pkg.exports || {})) {
      if (subpath === './package.json') continue;
      if (typeof conditions !== 'object' || conditions === null) continue;
      if (conditions.browser) {
        const abs = path.join(ROOT, conditions.browser);
        expect(fs.existsSync(abs)).toBe(true);
      }
    }
  });

  test('main / module / browser top-level fields exist on disk', () => {
    if (pkg.main) expect(fs.existsSync(path.join(ROOT, pkg.main))).toBe(true);
    if (pkg.module) expect(fs.existsSync(path.join(ROOT, pkg.module))).toBe(true);
    if (pkg.browser) expect(fs.existsSync(path.join(ROOT, pkg.browser))).toBe(true);
  });

  test('.d.ts files are non-empty and declare exports', () => {
    for (const [subpath, conditions] of Object.entries(pkg.exports || {})) {
      if (subpath === './package.json') continue;
      if (typeof conditions !== 'object' || conditions === null) continue;
      if (conditions.types) {
        const abs = path.join(ROOT, conditions.types);
        const content = fs.readFileSync(abs, 'utf8');
        expect(content.length).toBeGreaterThan(0);
        // Should declare at least one export
        expect(content).toMatch(/export\s/);
      }
    }
  });

  test('package version matches semver pattern', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// 2. Core dist bundle smoke tests
// ---------------------------------------------------------------------------
describe('dist bundle smoke tests', () => {
  const coreBundles = [
    'dist/quikdown.esm.js',
    'dist/quikdown.cjs',
    'dist/quikdown_bd.esm.js',
    'dist/quikdown_bd.cjs',
    'dist/quikdown_edit.esm.js',
    'dist/quikdown_edit.cjs',
    'dist/quikdown_ast.esm.js',
    'dist/quikdown_ast.cjs',
    'dist/quikdown_json.esm.js',
    'dist/quikdown_json.cjs',
    'dist/quikdown_yaml.esm.js',
    'dist/quikdown_yaml.cjs',
    'dist/quikdown_ast_html.esm.js',
    'dist/quikdown_ast_html.cjs',
  ];

  test.each(coreBundles)('%s exists and is non-empty', (bundle) => {
    const abs = path.join(ROOT, bundle);
    expect(fs.existsSync(abs)).toBe(true);
    const stat = fs.statSync(abs);
    expect(stat.size).toBeGreaterThan(100); // not a stub
  });

  test('minified UMD bundles exist for all modules', () => {
    const modules = [
      'quikdown', 'quikdown_bd', 'quikdown_edit',
      'quikdown_ast', 'quikdown_json', 'quikdown_yaml', 'quikdown_ast_html',
    ];
    for (const mod of modules) {
      const abs = path.join(ROOT, `dist/${mod}.umd.min.js`);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Bidirectional roundtrip contracts
// ---------------------------------------------------------------------------
describe('bidirectional roundtrip contracts', () => {

  test('aligned table roundtrip preserves separator syntax', () => {
    const md = '| L | C | R |\n|:--|:--:|--:|\n| a | b | c |';
    const html = quikdown_bd(md);
    expect(html).toMatch(/data-qd-align=/);

    const back = quikdown_bd.toMarkdown(html);
    // left alignment
    expect(back).toMatch(/:--[^:]/);
    // center alignment
    expect(back).toMatch(/:--+:/);
    // right alignment
    expect(back).toMatch(/[^:]-+:/);
  });

  test('heading levels roundtrip correctly', () => {
    for (let level = 1; level <= 6; level++) {
      const prefix = '#'.repeat(level);
      const md = `${prefix} heading ${level}`;
      const html = quikdown_bd(md);
      const back = quikdown_bd.toMarkdown(html);
      expect(back.trim()).toContain(`${prefix} heading ${level}`);
    }
  });

  test('bold and italic roundtrip correctly', () => {
    const md = '**bold** and *italic* text';
    const html = quikdown_bd(md);
    expect(html).toContain('data-qd="**"');
    expect(html).toContain('data-qd="*"');

    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('**bold**');
    expect(back).toContain('*italic*');
  });

  test('strikethrough roundtrips correctly', () => {
    const md = '~~deleted~~';
    const html = quikdown_bd(md);
    expect(html).toContain('data-qd="~~"');

    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('~~deleted~~');
  });

  test('inline code roundtrips correctly', () => {
    const md = 'use `console.log()` here';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('`console.log()`');
  });

  test('links roundtrip correctly', () => {
    const md = '[click here](https://example.com)';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('[click here](https://example.com)');
  });

  test('images roundtrip correctly', () => {
    const md = '![alt text](https://example.com/img.png)';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('![alt text](https://example.com/img.png)');
  });

  test('unordered list roundtrips correctly', () => {
    const md = '- item one\n- item two\n- item three';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('- item one');
    expect(back).toContain('- item two');
    expect(back).toContain('- item three');
  });

  test('ordered list roundtrips correctly', () => {
    const md = '1. first\n2. second\n3. third';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toMatch(/1\.\s*first/);
    expect(back).toMatch(/2\.\s*second/);
    expect(back).toMatch(/3\.\s*third/);
  });

  test('task list roundtrips correctly', () => {
    const md = '- [x] done\n- [ ] not done';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('[x]');
    expect(back).toContain('[ ]');
  });

  test('blockquote roundtrips correctly', () => {
    const md = '> quoted text here';
    const html = quikdown_bd(md);
    expect(html).toContain('data-qd="&gt;"');
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('> quoted text here');
  });

  test('fenced code block roundtrips correctly', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('```');
    expect(back).toContain('const x = 1;');
  });

  test('horizontal rule roundtrips correctly', () => {
    const md = '---';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back.trim()).toContain('---');
  });

  test('table with no alignment roundtrips correctly', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = quikdown_bd(md);
    const back = quikdown_bd.toMarkdown(html);
    expect(back).toContain('| A |');
    expect(back).toContain('| 1 |');
  });
});

// ---------------------------------------------------------------------------
// 4. Parser consistency contracts
// ---------------------------------------------------------------------------
describe('parser consistency contracts', () => {

  test('underscore emphasis is consistent between paragraph and table cell', () => {
    // foo_bar_baz should NOT become italic in either context
    const paraHtml = quikdown('foo_bar_baz');
    const tableHtml = quikdown('| foo_bar_baz |\n|---|\n| x |');

    // Neither context should produce <em>
    expect(paraHtml).not.toContain('<em');
    expect(tableHtml).not.toContain('<em');
  });

  test('underscore emphasis works at word boundaries', () => {
    const html = quikdown('_italic_ word');
    expect(html).toContain('<em');
  });

  test('version in module matches package.json', () => {
    // quikdown.version should match pkg.version
    expect(quikdown.version).toBe(pkg.version);
  });

  test('quikdown_bd.version matches package.json', () => {
    expect(quikdown_bd.version).toBe(pkg.version);
  });

  test('XSS protection: script tags are escaped by default', () => {
    const html = quikdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('XSS protection: event handlers are escaped by default', () => {
    const html = quikdown('<img onerror="alert(1)" src=x>');
    expect(html).not.toMatch(/<img[^>]*onerror/);
  });

  test('quikdown_bd forward pass emits data-qd attributes', () => {
    const html = quikdown_bd('**bold**');
    expect(html).toContain('data-qd="**"');
  });

  test('quikdown_bd forward pass emits quikdown- classes', () => {
    const html = quikdown_bd('**bold**');
    expect(html).toContain('class="quikdown-strong"');
  });
});
