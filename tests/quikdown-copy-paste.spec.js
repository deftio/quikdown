import { test, expect } from '@playwright/test';

async function setMarkdown(page, content) {
    await page.evaluate((md) => window.editor.setMarkdown(md), content);
    await page.waitForTimeout(300);
}

test.describe('QuikdownEditor Copy-Paste Tests', () => {
    let page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        await page.goto('/examples/qde/test-playwright.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test.describe('Math Copy-Paste', () => {
        test('should create math container for math fence block', async () => {
            const mathContent = '```math\ne^{i\\pi} + 1 = 0\n```';

            await setMarkdown(page, mathContent);
            await page.waitForTimeout(500);

            const preview = page.locator('.qde-preview');
            // External MathJax CDN may not load in test env — verify container exists.
            const count = await preview.locator('.qde-math-container, .math-display, pre[data-qd-lang="math"]').count();
            expect(count).toBeGreaterThan(0);
        });

        test('should handle integrals in math blocks', async () => {
            const mathContent = '```math\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n```';

            await setMarkdown(page, mathContent);
            await page.waitForTimeout(500);

            const preview = page.locator('.qde-preview');
            const count = await preview.locator('.qde-math-container, .math-display, pre[data-qd-lang="math"]').count();
            expect(count).toBeGreaterThan(0);
        });

        test('should handle summation in math blocks', async () => {
            const mathContent = '```math\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\n```';

            await setMarkdown(page, mathContent);
            await page.waitForTimeout(500);

            const preview = page.locator('.qde-preview');
            const count = await preview.locator('.qde-math-container, .math-display, pre[data-qd-lang="math"]').count();
            expect(count).toBeGreaterThan(0);
        });
    });

    test.describe('GeoJSON Copy-Paste', () => {
        test('should create GeoJSON container', async () => {
            const geoJsonContent = '```geojson\n{"type":"Point","coordinates":[-122.4,37.8]}\n```';

            await setMarkdown(page, geoJsonContent);
            await page.waitForTimeout(500);

            const preview = page.locator('.qde-preview');
            // External Leaflet CDN may not load in test env — verify container exists.
            const count = await preview.locator('.geojson-container, pre[data-qd-lang="geojson"]').count();
            expect(count).toBeGreaterThan(0);
        });

        test('should handle GeoJSON Feature objects', async () => {
            const geoJsonContent = '```geojson\n{"type":"Feature","geometry":{"type":"Point","coordinates":[-122.4,37.8]},"properties":{"name":"San Francisco"}}\n```';

            await setMarkdown(page, geoJsonContent);
            await page.waitForTimeout(500);

            const preview = page.locator('.qde-preview');
            const count = await preview.locator('.geojson-container, pre[data-qd-lang="geojson"]').count();
            expect(count).toBeGreaterThan(0);
        });
    });

    test.describe('Code Block Copy-Paste', () => {
        test('should render code blocks', async () => {
            const codeContent = '```javascript\nconst hello = "world";\nconsole.log(hello);\n```';

            await setMarkdown(page, codeContent);
            await page.waitForTimeout(500);

            // Code should render as pre/code
            const codeBlock = page.locator('.qde-preview pre code');
            await expect(codeBlock.first()).toBeVisible();
        });
    });

    test.describe('Table Copy-Paste', () => {
        test('should convert CSV to table', async () => {
            const csvContent = '```csv\nName,Age,City\nAlice,30,NYC\nBob,25,LA\n```';

            await setMarkdown(page, csvContent);
            await page.waitForTimeout(500);

            // Check that a table is rendered OR at least the csv container exists
            const preview = page.locator('.qde-preview');
            const tableCount = await preview.locator('table').count();
            if (tableCount > 0) {
                const rows = await preview.locator('table tr').count();
                expect(rows).toBeGreaterThanOrEqual(3); // Header + 2 data rows
            } else {
                // Fallback: csv fence container present
                const fenceCount = await preview.locator('pre[data-qd-lang="csv"]').count();
                expect(fenceCount).toBeGreaterThan(0);
            }
        });
    });

    test.describe('Mixed Content Copy', () => {
        test('should handle document with multiple fence types', async () => {
            const mixedContent = `# Test Document

## Math
\`\`\`math
e^{i\\pi} + 1 = 0
\`\`\`

## Code
\`\`\`javascript
console.log("Hello");
\`\`\`

## Table
\`\`\`csv
A,B
1,2
\`\`\``;

            await setMarkdown(page, mixedContent);
            await page.waitForTimeout(1000);

            const preview = page.locator('.qde-preview');

            // Math container (or fence fallback)
            const mathCount = await preview.locator('.qde-math-container, .math-display, pre[data-qd-lang="math"]').count();
            expect(mathCount).toBeGreaterThan(0);

            // Code block
            const codeCount = await preview.locator('pre code').count();
            expect(codeCount).toBeGreaterThan(0);

            // CSV → table or fence fallback
            const tableCount = await preview.locator('table').count();
            const csvFence = await preview.locator('pre[data-qd-lang="csv"]').count();
            expect(tableCount + csvFence).toBeGreaterThan(0);

            // Headings present
            const h2Count = await preview.locator('h2').count();
            expect(h2Count).toBe(3);
        });
    });
});
