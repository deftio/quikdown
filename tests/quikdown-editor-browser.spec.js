import { test, expect } from '@playwright/test';

// Tests that require real browser APIs (script/CSS loading, contentEditable, matchMedia)
// Migrated from skipped Jest tests in quikdown_edit.test.js
test.describe('QuikdownEditor Browser API Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/examples/qde/test-playwright.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test('should load external script via loadScript()', async ({ page }) => {
        const result = await page.evaluate(async () => {
            await window.editor.loadScript('data:text/javascript,window.__testScriptLoaded=true');
            return window.__testScriptLoaded;
        });
        expect(result).toBe(true);
    });

    test('should load external CSS via loadCSS()', async ({ page }) => {
        await page.evaluate(async () => {
            await window.editor.loadCSS('data:text/css,body{background-color:rgb(255,0,0)}');
        });
        // Allow time for CSS to apply
        await page.waitForTimeout(200);
        const bgColor = await page.evaluate(() => {
            return getComputedStyle(document.body).backgroundColor;
        });
        expect(bgColor).toBe('rgb(255, 0, 0)');
    });

    test('should handle script load failure', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.evaluate(async () => {
            try {
                await window.editor.loadLibrary(
                    'nonexistent',
                    () => false,
                    'http://localhost:9999/nonexistent.js'
                );
            } catch {
                // expected to fail
            }
        });
        // loadLibrary should have logged an error or thrown
        // The important thing is the editor didn't crash
        const container = page.locator('.qde-container');
        await expect(container).toBeVisible();
    });

    test('should make fences non-editable in preview', async ({ page }) => {
        await page.evaluate(async () => {
            await window.editor.setMarkdown('```svg\n<svg><circle cx="50" cy="50" r="40" fill="blue"/></svg>\n```');
        });
        await page.waitForTimeout(400);

        // Switch to preview mode
        await page.click('.qde-btn[data-mode="preview"]');
        await page.waitForTimeout(200);

        const isNonEditable = await page.evaluate(() => {
            const svg = document.querySelector('.qde-svg-container');
            return svg ? svg.contentEditable === 'false' : false;
        });
        expect(isNonEditable).toBe(true);
    });

    test('should apply dark theme from system preference', async ({ page }) => {
        // Emulate dark color scheme
        await page.emulateMedia({ colorScheme: 'dark' });

        // Create a new editor with theme: 'auto' in a fresh container
        const hasDarkClass = await page.evaluate(async () => {
            const container = document.createElement('div');
            container.id = 'test-dark-editor';
            container.style.height = '300px';
            document.body.appendChild(container);

            const { default: QuikdownEditor } = await import('/dist/quikdown_edit.esm.min.js');
            const darkEditor = new QuikdownEditor('#test-dark-editor', { theme: 'auto' });
            await darkEditor.initPromise;

            const result = darkEditor.container.classList.contains('qde-dark');
            darkEditor.destroy();
            container.remove();
            return result;
        });
        expect(hasDarkClass).toBe(true);
    });
});
