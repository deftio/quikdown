/**
 * Playwright smoke tests for the offline standalone editor bundle.
 *
 * NOT part of the normal `npm test` / pre-commit cycle.
 * Run during release preflight and publish CI:
 *   npm run test:standalone:e2e
 *
 * Requires standalone artifacts in dist/ (npm run build:standalone).
 * Page: /pages/examples/test-standalone.html
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 60000 });

test.describe('Standalone offline editor', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/examples/test-standalone.html');
        await page.waitForSelector('.qde-container', { timeout: 20000 });
        await page.waitForFunction(() => window.editor && typeof window.editor.getHTML === 'function');
        await page.waitForTimeout(800);
    });

    test('loads the bundled editor without CDN dependencies', async ({ page }) => {
        const hasEditor = await page.evaluate(() => typeof window.editor?.getMarkdown === 'function');
        expect(hasEditor).toBe(true);

        const md = await page.evaluate(() => window.editor.getMarkdown());
        expect(md).toContain('Quikdown Standalone Editor');
    });

    test('renders syntax-highlighted code from the bundled highlight.js', async ({ page }) => {
        const preview = page.locator('.qde-preview');
        await expect(preview.locator('pre code.hljs').first()).toBeVisible({ timeout: 15000 });
        await expect(preview.locator('.hljs-keyword, .hljs-function, .hljs-string').first()).toBeVisible();
    });

    test('renders a Mermaid diagram from the bundled mermaid', async ({ page }) => {
        const preview = page.locator('.qde-preview');
        await expect(preview.locator('.mermaid svg, svg[aria-roledescription]').first()).toBeVisible({ timeout: 20000 });
    });

    test('renders sanitized HTML fence content from bundled DOMPurify', async ({ page }) => {
        const preview = page.locator('.qde-preview');
        await expect(preview.getByText('HTML fence', { exact: true })).toBeVisible();
        expect(await preview.locator('script').count()).toBe(0);
    });
});
