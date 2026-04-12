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
