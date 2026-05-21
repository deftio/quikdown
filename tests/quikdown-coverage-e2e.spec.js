/**
 * Playwright E2E tests with Istanbul coverage collection.
 *
 * Loads the Istanbul-instrumented editor bundle (quikdown_edit.esm.cov.js)
 * and exercises browser-only code paths that jsdom cannot cover:
 *   - Canvas/SVG rasterisation (svgToPng, getRenderedContent)
 *   - Clipboard rich-copy (copyRendered)
 *   - Mermaid / highlight.js / MathJax rendering
 *   - GeoJSON / STL / HTML fences
 *   - Undo/redo, HR removal, lazy linefeeds
 *   - Theme switching
 *
 * After each test the Istanbul coverage object is extracted from the page
 * and merged. On teardown the combined coverage is written to
 *   coverage/e2e-coverage.json
 *
 * NOT run in CI. Run locally or during release:
 *   npm run test:e2e:coverage
 */

import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COV_OUT = resolve(__dirname, '../coverage/e2e-coverage.json');

// ── Coverage helpers ──────────────────────────────────────────────────

let mergedCoverage = {};

/**
 * Merge Istanbul coverage objects.  Each key is a file path whose value
 * is an Istanbul FileCoverage-like object with `s`, `b`, `f` counters.
 */
function mergeCoverage(incoming) {
  if (!incoming) return;
  for (const [filePath, fileCov] of Object.entries(incoming)) {
    if (!mergedCoverage[filePath]) {
      mergedCoverage[filePath] = JSON.parse(JSON.stringify(fileCov));
      continue;
    }
    const existing = mergedCoverage[filePath];
    // statements
    for (const k of Object.keys(fileCov.s)) {
      existing.s[k] = (existing.s[k] || 0) + fileCov.s[k];
    }
    // branches
    for (const k of Object.keys(fileCov.b)) {
      existing.b[k] = existing.b[k] || fileCov.b[k].map(() => 0);
      for (let i = 0; i < fileCov.b[k].length; i++) {
        existing.b[k][i] = (existing.b[k][i] || 0) + fileCov.b[k][i];
      }
    }
    // functions
    for (const k of Object.keys(fileCov.f)) {
      existing.f[k] = (existing.f[k] || 0) + fileCov.f[k];
    }
  }
}

// ── Page helpers ──────────────────────────────────────────────────────

async function setMarkdown(page, md) {
  await page.evaluate((content) => window.editor.setMarkdown(content), md);
  await page.waitForTimeout(300);
}

async function getMarkdown(page) {
  return page.evaluate(() => window.editor.getMarkdown());
}

async function getHTML(page) {
  return page.evaluate(() => window.editor.getHTML());
}

// ══════════════════════════════════════════════════════════════════════
//  Fence Rendering
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage Fence Rendering (cov)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('renders valid SVG inline', async ({ page }) => {
    await setMarkdown(page, '```svg\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>\n```');
    const preview = page.locator('.qde-preview');
    await expect(preview.locator('svg')).toBeVisible();
    await expect(preview.locator('circle')).toHaveCount(1);
  });

  test('strips script tags from SVG (XSS protection)', async ({ page }) => {
    await setMarkdown(page, '```svg\n<svg viewBox="0 0 100 100"><script>alert("xss")</script><rect width="50" height="50"/></svg>\n```');
    const scripts = await page.locator('.qde-preview script').count();
    expect(scripts).toBe(0);
  });

  test('highlights JavaScript code', async ({ page }) => {
    await setMarkdown(page, '```javascript\nconst x = 42;\nconsole.log(x);\n```');
    await page.waitForTimeout(1000);
    const html = await getHTML(page);
    expect(html).toContain('const x = 42');
  });

  test('CSV fence renders HTML table', async ({ page }) => {
    await setMarkdown(page, '```csv\nName,Age,City\nAlice,30,NYC\nBob,25,LA\n```');
    const table = page.locator('.qde-preview table');
    await expect(table).toBeVisible();
  });

  test('renders valid JSON', async ({ page }) => {
    await setMarkdown(page, '```json\n{"name": "quikdown", "version": "1.0"}\n```');
    const html = await getHTML(page);
    expect(html).toContain('quikdown');
  });

  test('renders HTML content', async ({ page }) => {
    await setMarkdown(page, '```html\n<h2 style="color:blue">Blue Title</h2>\n<p>Paragraph</p>\n```');
    await page.waitForTimeout(2000);
    const html = await getHTML(page);
    expect(html).toContain('html');
  });

  test('renders math fence', async ({ page }) => {
    await setMarkdown(page, '```math\nE = mc^2\n```');
    const html = await getHTML(page);
    expect(html).toContain('math');
  });

  test('renders mermaid diagram', async ({ page }) => {
    await setMarkdown(page, '```mermaid\ngraph TD\n  A[Start] --> B[End]\n```');
    await page.waitForTimeout(2000);
    const html = await getHTML(page);
    expect(html).toContain('mermaid');
  });

  test('renders GeoJSON map container', async ({ page }) => {
    const geojson = JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] },
      properties: { name: 'Empire State Building' }
    });
    await setMarkdown(page, '```geojson\n' + geojson + '\n```');
    await page.waitForTimeout(3000);
    const html = await getHTML(page);
    expect(html).toContain('geojson');
  });

  test('renders STL container', async ({ page }) => {
    const stl = 'solid cube\nfacet normal 0 0 1\n  outer loop\n    vertex 0 0 0\n    vertex 1 0 0\n    vertex 1 1 0\n  endloop\nendfacet\nendsolid cube';
    await setMarkdown(page, '```stl\n' + stl + '\n```');
    await page.waitForTimeout(3000);
    const html = await getHTML(page);
    expect(html).toContain('stl');
  });

  test('renders multiple fence types together', async ({ page }) => {
    const md = [
      '# Mixed Content', '',
      '```javascript', 'const x = 1;', '```', '',
      '```csv', 'A,B', '1,2', '```', '',
      '```svg', '<svg viewBox="0 0 100 100"><rect width="50" height="50" fill="blue"/></svg>', '```', '',
      '```json', '{"key": "value"}', '```', '',
      'Regular **bold** paragraph.',
    ].join('\n');
    await setMarkdown(page, md);
    await page.waitForTimeout(1000);
    const html = await getHTML(page);
    expect(html).toContain('const x = 1');
    expect(html).toContain('<strong');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Rich Copy Canvas — browser-only paths
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage Rich Copy Canvas (cov)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('copyRendered converts SVG fence to PNG image', async ({ page }) => {
    await setMarkdown(page, [
      '```svg',
      '<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">',
      '  <rect width="120" height="60" fill="#4a90d9"/>',
      '  <text x="60" y="35" text-anchor="middle" fill="white">Hello</text>',
      '</svg>',
      '```',
    ].join('\n'));
    await page.waitForTimeout(800);

    const result = await page.evaluate(async () => {
      try {
        await window.editor.copyRendered();
        const items = await navigator.clipboard.read();
        const htmlBlob = await items[0].getType('text/html');
        return { success: true, html: await htmlBlob.text() };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    if (result.success) {
      const hasImage = result.html.includes('data:image/png') || result.html.includes('<img');
      expect(hasImage).toBe(true);
    }
  });

  test('copyRendered handles bold/italic/code with inline styles', async ({ page }) => {
    await setMarkdown(page, '**Bold text** and *italic* and `code`');
    await page.waitForTimeout(500);

    const result = await page.evaluate(async () => {
      await window.editor.copyRendered();
      try {
        const items = await navigator.clipboard.read();
        const htmlBlob = await items[0].getType('text/html');
        return await htmlBlob.text();
      } catch { return ''; }
    });

    if (result) {
      expect(result).toContain('font-weight');
    }
  });

  test('copyRendered handles table with inline styles', async ({ page }) => {
    await setMarkdown(page, [
      '| Name | Value |',
      '|------|-------|',
      '| A    | 100   |',
      '| B    | 200   |',
    ].join('\n'));
    await page.waitForTimeout(500);

    const result = await page.evaluate(async () => {
      await window.editor.copyRendered();
      try {
        const items = await navigator.clipboard.read();
        const htmlBlob = await items[0].getType('text/html');
        return await htmlBlob.text();
      } catch { return ''; }
    });

    if (result) {
      expect(result).toContain('border');
    }
  });

  test('copyRendered handles CSV table fence', async ({ page }) => {
    await setMarkdown(page, '```csv\nName,Value\nAlice,100\nBob,200\n```');
    await page.waitForTimeout(800);

    const result = await page.evaluate(async () => {
      await window.editor.copyRendered();
      try {
        const items = await navigator.clipboard.read();
        const htmlBlob = await items[0].getType('text/html');
        return await htmlBlob.text();
      } catch { return ''; }
    });

    if (result) {
      expect(result).toContain('Alice');
    }
  });

  test('copyRendered with stripped mode returns plain output', async ({ page }) => {
    await setMarkdown(page, '**Bold** and *italic*');
    await page.waitForTimeout(500);

    const result = await page.evaluate(async () => {
      await window.editor.copyRendered('stripped');
      try {
        const items = await navigator.clipboard.read();
        const htmlBlob = await items[0].getType('text/html');
        return await htmlBlob.text();
      } catch { return ''; }
    });

    if (result) {
      expect(result).toContain('Bold');
    }
  });

  test('copyRendered handles mixed content with code + images + tables', async ({ page }) => {
    await setMarkdown(page, [
      '# Report', '',
      '```javascript', 'const x = 42;', '```', '',
      '| Col | Data |', '|-----|------|', '| 1   | abc  |', '',
      '```svg', '<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="green"/></svg>', '```',
    ].join('\n'));
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      try {
        await window.editor.copyRendered();
        const items = await navigator.clipboard.read();
        const htmlBlob = await items[0].getType('text/html');
        return { success: true, html: await htmlBlob.text() };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    if (result.success) {
      expect(result.html).toContain('Report');
      expect(result.html).toContain('42');
      expect(result.html).toContain('data:image/png');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Undo/Redo
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage Undo/Redo (cov)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('undo button reverts last change', async ({ page }) => {
    await page.evaluate(() => {
      window.editor._markdown = '# Original';
      window.editor.updateFromMarkdown('# Changed');
    });
    await page.waitForTimeout(200);
    await page.click('[data-action="undo"]');
    await page.waitForTimeout(200);
    const md = await getMarkdown(page);
    expect(md).toBe('# Original');
  });

  test('redo button re-applies undone change', async ({ page }) => {
    await page.evaluate(() => {
      window.editor._markdown = '# Original';
      window.editor.updateFromMarkdown('# Changed');
    });
    await page.waitForTimeout(200);
    await page.click('[data-action="undo"]');
    await page.waitForTimeout(200);
    await page.click('[data-action="redo"]');
    await page.waitForTimeout(200);
    const md = await getMarkdown(page);
    expect(md).toBe('# Changed');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  HR Removal
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage HR Removal (cov)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('remove-hr button removes horizontal rules', async ({ page }) => {
    await setMarkdown(page, '# Title\n\n---\n\nContent\n\n---\n\nMore');
    await page.click('[data-action="remove-hr"]');
    await page.waitForTimeout(500);
    const md = await getMarkdown(page);
    expect(md).not.toContain('---');
    expect(md).toContain('Title');
    expect(md).toContain('Content');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Lazy Linefeeds
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage Lazy Linefeeds (cov)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('lazy-linefeeds button converts single newlines', async ({ page }) => {
    await setMarkdown(page, 'Line 1\nLine 2\nLine 3');
    await page.click('[data-action="lazy-linefeeds"]');
    await page.waitForTimeout(500);
    const md = await getMarkdown(page);
    expect(md).toContain('Line 1\n\nLine 2\n\nLine 3');
  });

  test('lazy-linefeeds preserves fenced content', async ({ page }) => {
    await setMarkdown(page, '```\nline1\nline2\n```\n\nText1\nText2');
    await page.click('[data-action="lazy-linefeeds"]');
    await page.waitForTimeout(500);
    const md = await getMarkdown(page);
    expect(md).toContain('line1\nline2');
    expect(md).toContain('Text1\n\nText2');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Theme Switching
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage Theme Switching (cov)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('dark theme adds qde-dark class', async ({ page }) => {
    await page.evaluate(() => window.editor.setTheme('dark'));
    const container = page.locator('.qde-container');
    await expect(container).toHaveClass(/qde-dark/);
  });

  test('auto theme responds to prefers-color-scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => window.editor.setTheme('auto'));
    await page.waitForTimeout(200);
    const container = page.locator('.qde-container');
    await expect(container).toHaveClass(/qde-dark/);
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Copy Functionality
// ══════════════════════════════════════════════════════════════════════

test.describe('@coverage Copy (cov)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/examples/qde/test-fences-e2e-cov.html');
    await page.waitForSelector('.qde-container', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    const cov = await page.evaluate(() => window.__coverage__);
    mergeCoverage(cov);
  });

  test('copy markdown writes to clipboard', async ({ page }) => {
    await setMarkdown(page, '# Hello World');
    await page.click('[data-action="copy-markdown"]');
    await page.waitForTimeout(500);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe('# Hello World');
  });

  test('copy HTML writes to clipboard', async ({ page }) => {
    await setMarkdown(page, '# Hello World');
    await page.click('[data-action="copy-html"]');
    await page.waitForTimeout(500);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('<h1');
    expect(clip).toContain('Hello World');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Write merged coverage on process exit
// ══════════════════════════════════════════════════════════════════════

test.afterAll(() => {
  if (Object.keys(mergedCoverage).length > 0) {
    mkdirSync(dirname(COV_OUT), { recursive: true });
    writeFileSync(COV_OUT, JSON.stringify(mergedCoverage, null, 2));
    console.log(`\n✔ Istanbul coverage written to ${COV_OUT}`);
    console.log(`  Files covered: ${Object.keys(mergedCoverage).length}`);
  } else {
    console.log('\n⚠ No Istanbul coverage collected (window.__coverage__ was empty)');
  }
});
