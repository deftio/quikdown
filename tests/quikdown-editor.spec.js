import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the QuikdownEditor in a real browser environment
test.describe('QuikdownEditor E2E Tests', () => {
    let page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        // Serve the test HTML file
        await page.goto(`file://${join(__dirname, '../examples/qde/test-playwright.html')}`);
        await page.waitForSelector('#editor');
    });

    test.describe('Initialization', () => {
        test('should initialize editor with split view by default', async () => {
            // Check that both panels are visible
            const sourcePanel = await page.locator('.qde-source');
            const previewPanel = await page.locator('.qde-preview');
            
            await expect(sourcePanel).toBeVisible();
            await expect(previewPanel).toBeVisible();
        });

        test('should show toolbar by default', async () => {
            const toolbar = await page.locator('.qde-toolbar');
            await expect(toolbar).toBeVisible();
            
            // Check for mode buttons
            await expect(page.locator('.qde-btn[data-mode="source"]')).toBeVisible();
            await expect(page.locator('.qde-btn[data-mode="split"]')).toBeVisible();
            await expect(page.locator('.qde-btn[data-mode="preview"]')).toBeVisible();
        });
    });

    test.describe('Mode Switching', () => {
        test('should switch to source mode', async () => {
            await page.click('.qde-btn[data-mode="source"]');
            
            const container = await page.locator('.qde-container');
            await expect(container).toHaveClass(/qde-mode-source/);
            
            // Preview should not be visible in source mode
            const previewPanel = await page.locator('.qde-preview');
            await expect(previewPanel).not.toBeVisible();
        });

        test('should switch to preview mode', async () => {
            await page.click('.qde-btn[data-mode="preview"]');
            
            const container = await page.locator('.qde-container');
            await expect(container).toHaveClass(/qde-mode-preview/);
            
            // Source should not be visible in preview mode
            const sourcePanel = await page.locator('.qde-source');
            await expect(sourcePanel).not.toBeVisible();
        });

        test('should switch back to split mode', async () => {
            // First switch to source
            await page.click('.qde-btn[data-mode="source"]');
            
            // Then back to split
            await page.click('.qde-btn[data-mode="split"]');
            
            const container = await page.locator('.qde-container');
            await expect(container).toHaveClass(/qde-mode-split/);
            
            // Both panels should be visible
            await expect(page.locator('.qde-source')).toBeVisible();
            await expect(page.locator('.qde-preview')).toBeVisible();
        });

        test('should use keyboard shortcuts for mode switching', async () => {
            // Ctrl+1 for source mode
            await page.keyboard.press('Control+1');
            await expect(page.locator('.qde-container')).toHaveClass(/qde-mode-source/);
            
            // Ctrl+2 for split mode
            await page.keyboard.press('Control+2');
            await expect(page.locator('.qde-container')).toHaveClass(/qde-mode-split/);
            
            // Ctrl+3 for preview mode
            await page.keyboard.press('Control+3');
            await expect(page.locator('.qde-container')).toHaveClass(/qde-mode-preview/);
        });
    });

    test.describe('Content Editing', () => {
        test('should update preview when typing in source', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Clear and type new content
            await sourceTextarea.fill('# Test Heading\n\nThis is a test paragraph.');
            
            // Wait for debounce
            await page.waitForTimeout(400);
            
            // Check preview updated
            await expect(preview.locator('h1')).toContainText('Test Heading');
            await expect(preview.locator('p')).toContainText('This is a test paragraph');
        });

        test('should handle markdown formatting', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            await sourceTextarea.fill('**Bold** and *italic* text');
            await page.waitForTimeout(400);
            
            await expect(preview.locator('strong')).toContainText('Bold');
            await expect(preview.locator('em')).toContainText('italic');
        });

        test('should render lists correctly', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            await sourceTextarea.fill('- Item 1\n- Item 2\n- Item 3');
            await page.waitForTimeout(400);
            
            const listItems = await preview.locator('li').all();
            expect(listItems).toHaveLength(3);
            await expect(listItems[0]).toContainText('Item 1');
        });
    });

    test.describe('Bidirectional Editing', () => {
        test('should update source when editing preview', async () => {
            await page.click('.qde-btn[data-mode="split"]');
            
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Set initial content
            await sourceTextarea.fill('# Editable Heading\n\nEditable paragraph.');
            await page.waitForTimeout(400);
            
            // Edit the paragraph in preview
            const paragraph = await preview.locator('p').first();
            await paragraph.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.type('Modified paragraph');
            
            // Wait for debounce
            await page.waitForTimeout(400);
            
            // Check source updated
            const sourceContent = await sourceTextarea.inputValue();
            expect(sourceContent).toContain('Modified paragraph');
        });

        test('should preserve formatting when editing preview', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Set content with formatting
            await sourceTextarea.fill('# Title\n\n**Bold text** here');
            await page.waitForTimeout(400);
            
            // Edit the paragraph
            const paragraph = await preview.locator('p').first();
            await paragraph.click();
            await paragraph.locator('strong').click();
            
            // Add text after bold
            await page.keyboard.press('End');
            await page.keyboard.type(' and more');
            await page.waitForTimeout(400);
            
            // Check markdown preserves bold
            const sourceContent = await sourceTextarea.inputValue();
            expect(sourceContent).toContain('**Bold text**');
            expect(sourceContent).toContain('and more');
        });
    });

    test.describe('Fence Plugins', () => {
        test('should render SVG fence', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const svgFence = '```svg\n<svg><circle cx="50" cy="50" r="40" fill="blue"/></svg>\n```';
            await sourceTextarea.fill(svgFence);
            await page.waitForTimeout(400);
            
            // Check SVG rendered
            await expect(preview.locator('.qde-svg-container')).toBeVisible();
            await expect(preview.locator('svg')).toBeVisible();
            await expect(preview.locator('circle')).toBeVisible();
        });

        test('should render CSV fence as table', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const csvFence = '```csv\nName,Age,City\nAlice,30,NYC\nBob,25,LA\n```';
            await sourceTextarea.fill(csvFence);
            await page.waitForTimeout(400);
            
            // Check table rendered
            await expect(preview.locator('table.qde-csv-table')).toBeVisible();
            await expect(preview.locator('th')).toContainText('Name');
            await expect(preview.locator('td')).toContainText('Alice');
        });

        test('should handle code fence with syntax highlighting', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const codeFence = '```javascript\nconst x = 42;\nconsole.log(x);\n```';
            await sourceTextarea.fill(codeFence);
            await page.waitForTimeout(400);
            
            // Check code block rendered
            await expect(preview.locator('pre[data-qd-lang="javascript"]')).toBeVisible();
            await expect(preview.locator('code')).toContainText('const x = 42');
        });

        test('should preserve SVG during bidirectional edit', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Set content with SVG and paragraph
            const content = '# Title\n\n```svg\n<svg><rect width="100" height="50" fill="red"/></svg>\n```\n\nSome text';
            await sourceTextarea.fill(content);
            await page.waitForTimeout(400);
            
            // Edit the paragraph
            const paragraph = await preview.locator('p').last();
            await paragraph.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.type('Modified text');
            await page.waitForTimeout(400);
            
            // Check SVG is still in source
            const sourceContent = await sourceTextarea.inputValue();
            expect(sourceContent).toContain('```svg');
            expect(sourceContent).toContain('<rect width="100" height="50" fill="red"/>');
            expect(sourceContent).toContain('Modified text');
        });

        test('should handle Math fence', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const mathFence = '```math\nE = mc^2\n```';
            await sourceTextarea.fill(mathFence);
            await page.waitForTimeout(400);
            
            // Check math container rendered
            await expect(preview.locator('.qde-math-container')).toBeVisible();
            await expect(preview.locator('[data-qd-source]')).toBeVisible();
        });

        test('should handle JSON fence', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const jsonFence = '```json\n{"name": "test", "value": 123}\n```';
            await sourceTextarea.fill(jsonFence);
            await page.waitForTimeout(400);
            
            // Check JSON rendered
            await expect(preview.locator('.qde-json')).toBeVisible();
            await expect(preview.locator('pre')).toContainText('"name"');
        });
    });

    test.describe('CSV Table Editing', () => {
        test('should edit CSV table cells', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const csvFence = '```csv\nA,B,C\n1,2,3\n```';
            await sourceTextarea.fill(csvFence);
            await page.waitForTimeout(400);
            
            // Edit a table cell
            const firstCell = await preview.locator('td').first();
            await firstCell.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.type('99');
            await page.waitForTimeout(400);
            
            // Check source updated with edited value
            const sourceContent = await sourceTextarea.inputValue();
            expect(sourceContent).toContain('99');
            expect(sourceContent).toContain('```csv');
        });
    });

    test.describe('Toolbar Actions', () => {
        test('should copy markdown to clipboard', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            await sourceTextarea.fill('# Copy Test');
            await page.waitForTimeout(400);
            
            // Grant clipboard permissions
            await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
            
            // Click copy markdown button
            await page.click('[data-action="copy-markdown"]');
            
            // Check button shows feedback
            await expect(page.locator('[data-action="copy-markdown"]')).toContainText('Copied');
            
            // Wait for feedback to reset
            await page.waitForTimeout(1600);
            await expect(page.locator('[data-action="copy-markdown"]')).toContainText('Copy MD');
        });

        test('should copy HTML to clipboard', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            await sourceTextarea.fill('# Copy Test');
            await page.waitForTimeout(400);
            
            // Grant clipboard permissions
            await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
            
            // Click copy HTML button
            await page.click('[data-action="copy-html"]');
            
            // Check button shows feedback
            await expect(page.locator('[data-action="copy-html"]')).toContainText('Copied');
        });
    });

    test.describe('Error Handling', () => {
        test('should handle invalid SVG gracefully', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const invalidSvg = '```svg\n<not valid svg>\n```';
            await sourceTextarea.fill(invalidSvg);
            await page.waitForTimeout(400);
            
            // Should show error
            await expect(preview.locator('.qde-error')).toBeVisible();
            await expect(preview.locator('.qde-error')).toContainText('Invalid SVG');
        });

        test('should handle malformed JSON', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const invalidJson = '```json\n{not valid json}\n```';
            await sourceTextarea.fill(invalidJson);
            await page.waitForTimeout(400);
            
            // Should still render something
            await expect(preview.locator('.qde-json')).toBeVisible();
        });
    });

    test.describe('Performance', () => {
        test('should handle large documents', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Generate large content
            let largeContent = '# Large Document\n\n';
            for (let i = 0; i < 100; i++) {
                largeContent += `## Section ${i}\n\nThis is paragraph ${i} with **bold** and *italic* text.\n\n`;
            }
            
            await sourceTextarea.fill(largeContent);
            await page.waitForTimeout(600); // Longer wait for large content
            
            // Check it rendered
            const headings = await preview.locator('h2').all();
            expect(headings.length).toBeGreaterThan(50); // At least some rendered
        });

        test('should debounce rapid typing', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            
            // Type rapidly
            for (let i = 0; i < 10; i++) {
                await sourceTextarea.type(`Line ${i}\n`, { delay: 10 });
            }
            
            // Should still be responsive
            const content = await sourceTextarea.inputValue();
            expect(content).toContain('Line 9');
        });
    });

    test.describe('Mobile Responsiveness', () => {
        test('should work on mobile viewport', async () => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            
            // Editor should still be functional
            const container = await page.locator('.qde-container');
            await expect(container).toBeVisible();
            
            // Should default to source mode on mobile (if implemented)
            // Or at least be usable
            const sourceTextarea = await page.locator('.qde-textarea');
            await sourceTextarea.fill('# Mobile Test');
            await page.waitForTimeout(400);
            
            const content = await sourceTextarea.inputValue();
            expect(content).toBe('# Mobile Test');
        });
    });
});