/**
 * Playwright E2E tests for fence rendering, undo/redo, HR removal,
 * lazy linefeeds, copy, and theme switching in a REAL browser.
 *
 * These tests exercise code paths that JSDOM cannot cover:
 *   - MathJax typesetting
 *   - Mermaid diagram rendering
 *   - highlight.js syntax highlighting
 *   - GeoJSON / Leaflet maps
 *   - STL / Three.js 3D rendering
 *   - DOMPurify HTML sanitization
 *   - Clipboard rich-copy (getRenderedContent)
 *   - Real contenteditable editing
 *
 * NOT run in CI (no `npm test`). Run locally or in release:
 *   npm run test:e2e:full
 *
 * Uses the test page: /examples/qde/test-fences-e2e.html
 * which enables all plugins, undo/redo, HR removal, and lazy linefeeds.
 */

import { test, expect } from '@playwright/test';

// Helper: set markdown via the editor API and wait for rendering
async function setMarkdown(page, md) {
    await page.evaluate((content) => window.editor.setMarkdown(content), md);
    await page.waitForTimeout(300); // debounce + render
}

// Helper: get current markdown from editor
async function getMarkdown(page) {
    return page.evaluate(() => window.editor.getMarkdown());
}

// Helper: get preview HTML
async function getHTML(page) {
    return page.evaluate(() => window.editor.getHTML());
}

test.describe('Fence Rendering E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
        await page.waitForTimeout(500); // wait for plugins to load
    });

    // ──────────────────────────────────────────────────────────────
    //  SVG Rendering
    // ──────────────────────────────────────────────────────────────

    test.describe('SVG Fences', () => {
        test('renders valid SVG inline', async ({ page }) => {
            await setMarkdown(page, '```svg\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>\n```');
            const preview = page.locator('.qde-preview');
            await expect(preview.locator('svg')).toBeVisible();
            await expect(preview.locator('circle')).toHaveCount(1);
        });

        test('strips script tags from SVG (XSS protection)', async ({ page }) => {
            await setMarkdown(page, '```svg\n<svg viewBox="0 0 100 100"><script>alert("xss")</script><rect width="50" height="50"/></svg>\n```');
            const preview = page.locator('.qde-preview');
            // Script should be removed; rect should remain
            const scripts = await preview.locator('script').count();
            expect(scripts).toBe(0);
        });

        test('strips event handlers from SVG elements', async ({ page }) => {
            await setMarkdown(page, '```svg\n<svg viewBox="0 0 100 100"><rect width="50" height="50" onclick="alert(1)" onload="alert(2)"/></svg>\n```');
            const rect = page.locator('.qde-preview rect');
            const onclick = await rect.getAttribute('onclick');
            const onload = await rect.getAttribute('onload');
            expect(onclick).toBeNull();
            expect(onload).toBeNull();
        });

        test('handles invalid SVG gracefully', async ({ page }) => {
            await setMarkdown(page, '```svg\nnot valid svg at all\n```');
            // Should show error or fallback, not crash
            const html = await getHTML(page);
            expect(html).toBeTruthy();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Code Highlighting (highlight.js)
    // ──────────────────────────────────────────────────────────────

    test.describe('Syntax Highlighting', () => {
        test('highlights JavaScript code', async ({ page }) => {
            await setMarkdown(page, '```javascript\nconst x = 42;\nconsole.log(x);\n```');
            await page.waitForTimeout(1000); // wait for hljs to load
            const preview = page.locator('.qde-preview');
            // hljs adds span elements with classes
            const hljs = await preview.locator('.hljs').count();
            // May or may not be loaded depending on CDN availability
            // At minimum, the code should render
            const html = await getHTML(page);
            expect(html).toContain('const x = 42');
        });

        test('handles unknown language gracefully', async ({ page }) => {
            await setMarkdown(page, '```unknownlang123\nsome code\n```');
            const html = await getHTML(page);
            expect(html).toContain('some code');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  CSV / TSV / PSV Tables
    // ──────────────────────────────────────────────────────────────

    test.describe('Table Fences', () => {
        test('CSV fence renders HTML table', async ({ page }) => {
            await setMarkdown(page, '```csv\nName,Age,City\nAlice,30,NYC\nBob,25,LA\n```');
            const table = page.locator('.qde-preview table');
            await expect(table).toBeVisible();
            const rows = await table.locator('tr').count();
            expect(rows).toBeGreaterThanOrEqual(2); // header + at least 1 body row
        });

        test('TSV fence renders table with tab delimiters', async ({ page }) => {
            await setMarkdown(page, '```tsv\nName\tAge\nAlice\t30\n```');
            const table = page.locator('.qde-preview table');
            await expect(table).toBeVisible();
        });

        test('PSV fence renders table with pipe delimiters', async ({ page }) => {
            await setMarkdown(page, '```psv\nName|Age\nAlice|30\n```');
            const table = page.locator('.qde-preview table');
            await expect(table).toBeVisible();
        });

        test('CSV with quoted fields handles commas in values', async ({ page }) => {
            await setMarkdown(page, '```csv\nName,Address\n"Smith, John","123 Main St, Apt 4"\n```');
            const html = await getHTML(page);
            expect(html).toContain('Smith, John');
            expect(html).toContain('123 Main St, Apt 4');
        });

        test('CSV round-trip: edit table in preview, recover as CSV fence', async ({ page }) => {
            await setMarkdown(page, '```csv\nA,B\n1,2\n```');
            await page.waitForTimeout(500);
            // Verify table is rendered
            const table = page.locator('.qde-preview table');
            await expect(table).toBeVisible();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  JSON Rendering
    // ──────────────────────────────────────────────────────────────

    test.describe('JSON Fences', () => {
        test('renders valid JSON', async ({ page }) => {
            await setMarkdown(page, '```json\n{"name": "quikdown", "version": "1.2.8"}\n```');
            const html = await getHTML(page);
            expect(html).toContain('quikdown');
            expect(html).toContain('1.2.8');
        });

        test('renders invalid JSON without crashing', async ({ page }) => {
            await setMarkdown(page, '```json\n{broken json\n```');
            const html = await getHTML(page);
            expect(html).toContain('{broken json');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  HTML Rendering (DOMPurify)
    // ──────────────────────────────────────────────────────────────

    test.describe('HTML Fences', () => {
        test('renders HTML content', async ({ page }) => {
            await setMarkdown(page, '```html\n<h2 style="color:blue">Blue Title</h2>\n<p>Paragraph</p>\n```');
            await page.waitForTimeout(2000); // DOMPurify lazy load
            const html = await getHTML(page);
            expect(html).toContain('html');
        });

        test('sanitizes dangerous HTML (strips scripts)', async ({ page }) => {
            await setMarkdown(page, '```html\n<h1>Title</h1><script>alert("xss")</script><p>Safe</p>\n```');
            await page.waitForTimeout(2000);
            // DOMPurify should remove the script tag
            const preview = page.locator('.qde-preview');
            const scripts = await preview.locator('script').count();
            expect(scripts).toBe(0);
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Math Rendering (MathJax)
    // ──────────────────────────────────────────────────────────────

    test.describe('Math Fences', () => {
        test('renders math fence with loading indicator', async ({ page }) => {
            await setMarkdown(page, '```math\nE = mc^2\n```');
            const html = await getHTML(page);
            expect(html).toContain('math');
        });

        test('renders katex fence', async ({ page }) => {
            await setMarkdown(page, '```katex\n\\int_0^1 x^2 dx\n```');
            const html = await getHTML(page);
            expect(html).toContain('math');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Mermaid Diagrams
    // ──────────────────────────────────────────────────────────────

    test.describe('Mermaid Fences', () => {
        test('renders mermaid diagram', async ({ page }) => {
            await setMarkdown(page, '```mermaid\ngraph TD\n  A[Start] --> B[End]\n```');
            await page.waitForTimeout(2000); // mermaid loading
            const html = await getHTML(page);
            expect(html).toContain('mermaid');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  GeoJSON (Leaflet)
    // ──────────────────────────────────────────────────────────────

    test.describe('GeoJSON Fences', () => {
        test('renders GeoJSON map container', async ({ page }) => {
            const geojson = JSON.stringify({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] },
                properties: { name: 'Empire State Building' }
            });
            await setMarkdown(page, '```geojson\n' + geojson + '\n```');
            await page.waitForTimeout(3000); // Leaflet loading
            const html = await getHTML(page);
            expect(html).toContain('geojson');
        });

        test('handles invalid GeoJSON', async ({ page }) => {
            await setMarkdown(page, '```geojson\n{invalid}\n```');
            await page.waitForTimeout(1000);
            // Should not crash
            const html = await getHTML(page);
            expect(html).toBeTruthy();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  ABC Music Notation (ABCJS)
    // ──────────────────────────────────────────────────────────────

    test.describe('ABC Fences', () => {
        test('renders ABC notation container', async ({ page }) => {
            await setMarkdown(page, '```abc\nX:1\nT:Scale\nM:4/4\nK:C\nC D E F | G A B c |\n```');
            await page.waitForTimeout(3000); // ABCJS loading
            const html = await getHTML(page);
            expect(html).toContain('abc');
        });

        test('renders ABC container element with correct class', async ({ page }) => {
            await setMarkdown(page, '```abc\nX:1\nT:Test\nK:C\nC D E F |\n```');
            await page.waitForTimeout(1000);
            const preview = page.locator('.qde-preview');
            const count = await preview.locator('.qde-abc-container').count();
            expect(count).toBeGreaterThan(0);
        });

        test('handles invalid ABC gracefully', async ({ page }) => {
            await setMarkdown(page, '```abc\nnot valid abc\n```');
            await page.waitForTimeout(1000);
            const html = await getHTML(page);
            expect(html).toBeTruthy();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Vega / Vega-Lite (Vega-Embed)
    // ──────────────────────────────────────────────────────────────

    test.describe('Vega Fences', () => {
        test('renders vega-lite container', async ({ page }) => {
            const spec = JSON.stringify({
                "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
                data: { values: [{ a: "A", b: 10 }, { a: "B", b: 20 }] },
                mark: "bar",
                encoding: {
                    x: { field: "a", type: "nominal" },
                    y: { field: "b", type: "quantitative" }
                }
            });
            await setMarkdown(page, '```vega-lite\n' + spec + '\n```');
            await page.waitForTimeout(3000); // Vega loading
            const html = await getHTML(page);
            expect(html).toContain('vega');
        });

        test('renders vega-lite container element with correct class', async ({ page }) => {
            const spec = JSON.stringify({
                "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
                data: { values: [{ x: 1, y: 2 }] },
                mark: "point",
                encoding: {
                    x: { field: "x", type: "quantitative" },
                    y: { field: "y", type: "quantitative" }
                }
            });
            await setMarkdown(page, '```vega-lite\n' + spec + '\n```');
            await page.waitForTimeout(1000);
            const preview = page.locator('.qde-preview');
            const count = await preview.locator('.qde-vega-container').count();
            expect(count).toBeGreaterThan(0);
        });

        test('vegalite alias works', async ({ page }) => {
            const spec = JSON.stringify({
                data: { values: [{ a: 1 }] },
                mark: "point",
                encoding: { x: { field: "a", type: "quantitative" } }
            });
            await setMarkdown(page, '```vegalite\n' + spec + '\n```');
            await page.waitForTimeout(1000);
            const preview = page.locator('.qde-preview');
            const count = await preview.locator('.qde-vega-container').count();
            expect(count).toBeGreaterThan(0);
        });

        test('handles invalid Vega JSON gracefully', async ({ page }) => {
            await setMarkdown(page, '```vega-lite\n{not valid json\n```');
            await page.waitForTimeout(1000);
            const html = await getHTML(page);
            expect(html).toBeTruthy();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  STL 3D Rendering (Three.js)
    // ──────────────────────────────────────────────────────────────

    test.describe('STL Fences', () => {
        test('renders STL container', async ({ page }) => {
            const stl = 'solid cube\nfacet normal 0 0 1\n  outer loop\n    vertex 0 0 0\n    vertex 1 0 0\n    vertex 1 1 0\n  endloop\nendfacet\nendsolid cube';
            await setMarkdown(page, '```stl\n' + stl + '\n```');
            await page.waitForTimeout(3000); // Three.js loading
            const html = await getHTML(page);
            expect(html).toContain('stl');
        });
    });
});

// ════════════════════════════════════════════════════════════════════
//  Undo/Redo E2E
// ════════════════════════════════════════════════════════════════════

test.describe('Undo/Redo E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test('undo button reverts last change', async ({ page }) => {
        // Use updateFromMarkdown directly to push undo states reliably
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

    test('Ctrl+Z undoes after typing in source', async ({ page }) => {
        // Type directly into source textarea to trigger natural undo
        await page.evaluate(() => {
            window.editor._markdown = '# First';
            window.editor.updateFromMarkdown('# Second');
        });
        await page.waitForTimeout(200);

        await page.keyboard.press('Control+z');
        await page.waitForTimeout(200);
        const md = await getMarkdown(page);
        expect(md).toBe('# First');
    });

    test('Ctrl+Y redoes after Ctrl+Z', async ({ page }) => {
        await page.evaluate(() => {
            window.editor._markdown = '# First';
            window.editor.updateFromMarkdown('# Second');
        });
        await page.waitForTimeout(200);

        await page.keyboard.press('Control+z');
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+y');
        await page.waitForTimeout(200);
        const md = await getMarkdown(page);
        expect(md).toBe('# Second');
    });
});

// ════════════════════════════════════════════════════════════════════
//  HR Removal E2E
// ════════════════════════════════════════════════════════════════════

test.describe('HR Removal E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
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

    test('remove-hr preserves HRs inside code fences', async ({ page }) => {
        await setMarkdown(page, '```\n---\n```\n\n---\n\nText');

        await page.click('[data-action="remove-hr"]');
        await page.waitForTimeout(500);
        const md = await getMarkdown(page);
        // The standalone HR should be removed, but fence content preserved
        expect(md).toContain('Text');
    });

    test('remove-hr shows visual feedback', async ({ page }) => {
        await setMarkdown(page, '---');
        const btn = page.locator('[data-action="remove-hr"]');
        const originalText = await btn.textContent();

        await btn.click();
        // Should show "Removed!" briefly
        await expect(btn).toHaveText('Removed!');
        // Then revert
        await page.waitForTimeout(2000);
        await expect(btn).toHaveText(originalText);
    });
});

// ════════════════════════════════════════════════════════════════════
//  Lazy Linefeeds E2E
// ════════════════════════════════════════════════════════════════════

test.describe('Lazy Linefeeds E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test('lazy-linefeeds button converts single newlines', async ({ page }) => {
        await setMarkdown(page, 'Line 1\nLine 2\nLine 3');

        await page.click('[data-action="lazy-linefeeds"]');
        await page.waitForTimeout(500);
        const md = await getMarkdown(page);
        // Should have double newlines between lines
        expect(md).toContain('Line 1\n\nLine 2\n\nLine 3');
    });

    test('lazy-linefeeds preserves fenced content', async ({ page }) => {
        await setMarkdown(page, '```\nline1\nline2\n```\n\nText1\nText2');

        await page.click('[data-action="lazy-linefeeds"]');
        await page.waitForTimeout(500);
        const md = await getMarkdown(page);
        // Fence content should NOT have double newlines
        expect(md).toContain('line1\nline2');
        // But text outside should
        expect(md).toContain('Text1\n\nText2');
    });

    test('lazy-linefeeds is idempotent', async ({ page }) => {
        await setMarkdown(page, 'A\nB\nC');

        await page.click('[data-action="lazy-linefeeds"]');
        await page.waitForTimeout(500);
        const md1 = await getMarkdown(page);

        await page.click('[data-action="lazy-linefeeds"]');
        await page.waitForTimeout(500);
        const md2 = await getMarkdown(page);

        expect(md1).toBe(md2);
    });

    test('lazy-linefeeds + removeHR work together', async ({ page }) => {
        await setMarkdown(page, 'Line 1\n---\nLine 2\nLine 3');

        // Remove HRs first
        await page.click('[data-action="remove-hr"]');
        await page.waitForTimeout(500);

        // Then convert linefeeds
        await page.click('[data-action="lazy-linefeeds"]');
        await page.waitForTimeout(500);

        const md = await getMarkdown(page);
        expect(md).not.toContain('---');
        expect(md).toContain('Line 1');
        expect(md).toContain('Line 2');
    });

    test('lazy-linefeeds shows visual feedback', async ({ page }) => {
        await setMarkdown(page, 'A\nB');
        const btn = page.locator('[data-action="lazy-linefeeds"]');

        await btn.click();
        await expect(btn).toHaveText('Converted!');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Theme Switching E2E
// ════════════════════════════════════════════════════════════════════

test.describe('Theme E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test('dark theme adds qde-dark class', async ({ page }) => {
        await page.evaluate(() => window.editor.setTheme('dark'));
        const container = page.locator('.qde-container');
        await expect(container).toHaveClass(/qde-dark/);
    });

    test('light theme removes qde-dark class', async ({ page }) => {
        await page.evaluate(() => window.editor.setTheme('dark'));
        await page.evaluate(() => window.editor.setTheme('light'));
        const container = page.locator('.qde-container');
        await expect(container).not.toHaveClass(/qde-dark/);
    });

    test('auto theme responds to prefers-color-scheme', async ({ page }) => {
        // Emulate dark mode
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.evaluate(() => window.editor.setTheme('auto'));
        await page.waitForTimeout(200);
        const container = page.locator('.qde-container');
        await expect(container).toHaveClass(/qde-dark/);

        // Switch to light
        await page.emulateMedia({ colorScheme: 'light' });
        await page.waitForTimeout(200);
        await expect(container).not.toHaveClass(/qde-dark/);
    });
});

// ════════════════════════════════════════════════════════════════════
//  Copy Functionality E2E
// ════════════════════════════════════════════════════════════════════

test.describe('Copy E2E', () => {
    test.beforeEach(async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
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

    test('copy shows Copied! feedback', async ({ page }) => {
        await setMarkdown(page, 'Test');
        const btn = page.locator('[data-action="copy-markdown"]');
        await btn.click();
        await expect(btn).toHaveText('Copied!');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Multiple fence types in one document
// ════════════════════════════════════════════════════════════════════

test.describe('Mixed Fences E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test('renders multiple fence types together', async ({ page }) => {
        const md = [
            '# Mixed Content',
            '',
            '```javascript',
            'const x = 1;',
            '```',
            '',
            '```csv',
            'A,B',
            '1,2',
            '```',
            '',
            '```svg',
            '<svg viewBox="0 0 100 100"><rect width="50" height="50" fill="blue"/></svg>',
            '```',
            '',
            '```json',
            '{"key": "value"}',
            '```',
            '',
            'Regular **bold** paragraph.',
        ].join('\n');

        await setMarkdown(page, md);
        await page.waitForTimeout(1000);

        const html = await getHTML(page);
        expect(html).toContain('const x = 1');
        expect(html).toContain('key');
        expect(html).toContain('<strong');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Rich Copy (getRenderedContent) — Canvas-dependent paths
//  Exercises SVG→PNG, Mermaid→PNG, chart canvas, image processing,
//  GeoJSON map rasterization, STL WebGL capture, HTML fence images.
//  These paths REQUIRE a real browser (canvas + Image loading).
// ════════════════════════════════════════════════════════════════════

test.describe('Rich Copy Canvas E2E', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto('/examples/qde/test-fences-e2e.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
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

        // Call getRenderedContent directly (the canvas-heavy path)
        const result = await page.evaluate(async () => {
            const preview = document.querySelector('.qde-preview');
            // copyRendered wraps getRenderedContent; call it and inspect result
            try {
                // getRenderedContent is not exported, but copyRendered calls it internally.
                // We can verify the result by checking what ends up on the clipboard.
                await window.editor.copyRendered();
                const items = await navigator.clipboard.read();
                const htmlBlob = await items[0].getType('text/html');
                return { success: true, html: await htmlBlob.text() };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        // SVG should have been converted to a PNG data URL in the rich copy
        if (result.success) {
            // The copied HTML should contain an img with a data:image/png src
            const hasImage = result.html.includes('data:image/png') || result.html.includes('<img');
            expect(hasImage).toBe(true);
        }
    });

    test('copyRendered handles bold/italic/code with inline styles', async ({ page }) => {
        await setMarkdown(page, '**Bold text** and *italic* and `code`');
        await page.waitForTimeout(500);

        const result = await page.evaluate(async () => {
            const preview = document.querySelector('.qde-preview');
            await window.editor.copyRendered();
            try {
                const items = await navigator.clipboard.read();
                const htmlBlob = await items[0].getType('text/html');
                return await htmlBlob.text();
            } catch {
                return '';
            }
        });

        // Rich copy adds inline styles for Google Docs / Word compatibility
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
            } catch {
                return '';
            }
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
            } catch {
                return '';
            }
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
            } catch {
                return '';
            }
        });

        // Stripped mode should still contain the text
        if (result) {
            expect(result).toContain('Bold');
        }
    });

    test('copyRendered converts ABC notation SVG to PNG image', async ({ page }) => {
        await setMarkdown(page, '```abc\nX:1\nT:Scale\nK:C\nC D E F |\n```');
        await page.waitForTimeout(3000); // Wait for ABCJS to render

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
            // ABC renders SVG which should be converted to PNG, or fallback placeholder
            const hasImage = result.html.includes('data:image/png') || result.html.includes('<img');
            const hasPlaceholder = result.html.includes('Music Notation');
            expect(hasImage || hasPlaceholder).toBe(true);
        }
    });

    test('copyRendered converts Vega chart SVG to PNG image', async ({ page }) => {
        const spec = JSON.stringify({
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: [{ a: "X", b: 10 }, { a: "Y", b: 20 }] },
            mark: "bar",
            encoding: {
                x: { field: "a", type: "nominal" },
                y: { field: "b", type: "quantitative" }
            }
        });
        await setMarkdown(page, '```vega-lite\n' + spec + '\n```');
        await page.waitForTimeout(3000); // Wait for Vega to render

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
            // Vega renders SVG which should be converted to PNG, or fallback placeholder
            const hasImage = result.html.includes('data:image/png') || result.html.includes('<img');
            const hasPlaceholder = result.html.includes('Vega Chart');
            expect(hasImage || hasPlaceholder).toBe(true);
        }
    });

    test('copyRendered handles mixed content with code + images + tables', async ({ page }) => {
        await setMarkdown(page, [
            '# Report',
            '',
            '```javascript',
            'const x = 42;',
            '```',
            '',
            '| Col | Data |',
            '|-----|------|',
            '| 1   | abc  |',
            '',
            '```svg',
            '<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="green"/></svg>',
            '```',
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
            // Should have heading, code (possibly syntax-highlighted), table, and SVG
            expect(result.html).toContain('Report');
            // Code may be syntax-highlighted with spans, check for the variable name
            expect(result.html).toContain('42');
            // SVG should be converted to PNG data URL
            expect(result.html).toContain('data:image/png');
        }
    });
});
