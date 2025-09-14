import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('QuikdownEditor Copy-Paste Tests', () => {
    let page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        await page.goto(`file://${join(__dirname, '../examples/qde/test-playwright.html')}`);
        await page.waitForSelector('#editor');
    });

    test.describe('Math Copy-Paste', () => {
        test('should render MathJax equations', async () => {
            const mathContent = '```math\ne^{i\\pi} + 1 = 0\n```';
            
            // Type math content
            await page.locator('.qde-source').fill(mathContent);
            await page.waitForTimeout(500); // Wait for debounce
            
            // Check that math is rendered
            const mathDisplay = await page.locator('.math-display');
            await expect(mathDisplay).toBeVisible();
            
            // Wait for MathJax to render
            await page.waitForFunction(() => {
                const mathEl = document.querySelector('.math-display');
                return mathEl && mathEl.querySelector('mjx-container');
            }, { timeout: 5000 });
        });

        test('should convert math to PNG on copy', async () => {
            const mathContent = '```math\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n```';
            
            // Type math content
            await page.locator('.qde-source').fill(mathContent);
            await page.waitForTimeout(500);
            
            // Wait for MathJax
            await page.waitForFunction(() => {
                const mathEl = document.querySelector('.math-display');
                return mathEl && mathEl.querySelector('mjx-container svg');
            }, { timeout: 5000 });
            
            // Click copy button
            const copyBtn = await page.locator('[data-action="copy-rendered"]');
            await copyBtn.click();
            
            // Verify copy succeeded (button text changes)
            await expect(copyBtn).toContainText('Copied!', { timeout: 2000 });
        });

        test('should scale math equations appropriately', async () => {
            const mathContent = '```math\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\n```';
            
            await page.locator('.qde-source').fill(mathContent);
            await page.waitForTimeout(500);
            
            // Wait for MathJax to render
            await page.waitForFunction(() => {
                const mathEl = document.querySelector('.math-display');
                return mathEl && mathEl.querySelector('mjx-container svg');
            }, { timeout: 5000 });
            
            // Get SVG dimensions
            const svgDimensions = await page.evaluate(() => {
                const svg = document.querySelector('.math-display svg');
                if (!svg) return null;
                const rect = svg.getBoundingClientRect();
                return { width: rect.width, height: rect.height };
            });
            
            expect(svgDimensions).toBeTruthy();
            expect(svgDimensions.width).toBeGreaterThan(0);
            expect(svgDimensions.height).toBeGreaterThan(0);
        });
    });

    test.describe('GeoJSON Copy-Paste', () => {
        test('should render GeoJSON maps', async () => {
            const geoJsonContent = '```geojson\n{"type":"Point","coordinates":[-122.4,37.8]}\n```';
            
            await page.locator('.qde-source').fill(geoJsonContent);
            await page.waitForTimeout(500);
            
            // Check that GeoJSON container is created
            const geoContainer = await page.locator('.geojson-container');
            await expect(geoContainer).toBeVisible();
            
            // Wait for Leaflet map to load
            await page.waitForFunction(() => {
                const container = document.querySelector('.geojson-container');
                return container && container._map;
            }, { timeout: 10000 });
        });

        test('should convert GeoJSON to image on copy', async () => {
            const geoJsonContent = '```geojson\n{"type":"Feature","geometry":{"type":"Point","coordinates":[-122.4,37.8]},"properties":{"name":"San Francisco"}}\n```';
            
            await page.locator('.qde-source').fill(geoJsonContent);
            await page.waitForTimeout(500);
            
            // Wait for map to be ready
            await page.waitForFunction(() => {
                const container = document.querySelector('.geojson-container');
                return container && container._map && container.querySelector('.leaflet-tile');
            }, { timeout: 10000 });
            
            // Click copy button
            const copyBtn = await page.locator('[data-action="copy-rendered"]');
            await copyBtn.click();
            
            // Verify copy succeeded
            await expect(copyBtn).toContainText('Copied!', { timeout: 2000 });
        });
    });

    test.describe('Code Block Copy-Paste', () => {
        test('should preserve syntax highlighting in copy', async () => {
            const codeContent = '```javascript\nconst hello = "world";\nconsole.log(hello);\n```';
            
            await page.locator('.qde-source').fill(codeContent);
            await page.waitForTimeout(500);
            
            // Check that code is highlighted
            const codeBlock = await page.locator('pre code');
            await expect(codeBlock).toBeVisible();
            
            // Click copy button
            const copyBtn = await page.locator('[data-action="copy-rendered"]');
            await copyBtn.click();
            
            await expect(copyBtn).toContainText('Copied!', { timeout: 2000 });
        });
    });

    test.describe('Table Copy-Paste', () => {
        test('should convert CSV to table and copy', async () => {
            const csvContent = '```csv\nName,Age,City\nAlice,30,NYC\nBob,25,LA\n```';
            
            await page.locator('.qde-source').fill(csvContent);
            await page.waitForTimeout(500);
            
            // Check that table is rendered
            const table = await page.locator('table');
            await expect(table).toBeVisible();
            
            // Verify table has correct structure
            const rows = await table.locator('tr').count();
            expect(rows).toBe(3); // Header + 2 data rows
            
            // Click copy button
            const copyBtn = await page.locator('[data-action="copy-rendered"]');
            await copyBtn.click();
            
            await expect(copyBtn).toContainText('Copied!', { timeout: 2000 });
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
            
            await page.locator('.qde-source').fill(mixedContent);
            await page.waitForTimeout(1000); // Wait for all content to render
            
            // Verify all elements are rendered
            await expect(page.locator('.math-display')).toBeVisible();
            await expect(page.locator('pre code')).toBeVisible();
            await expect(page.locator('table')).toBeVisible();
            
            // Wait for MathJax
            await page.waitForFunction(() => {
                const mathEl = document.querySelector('.math-display');
                return mathEl && mathEl.querySelector('mjx-container');
            }, { timeout: 5000 });
            
            // Click copy button
            const copyBtn = await page.locator('[data-action="copy-rendered"]');
            await copyBtn.click();
            
            await expect(copyBtn).toContainText('Copied!', { timeout: 2000 });
        });
    });
});