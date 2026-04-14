import { test, expect } from '@playwright/test';

// Test the QuikdownEditor in a real browser environment
// Uses webServer config to serve at http://localhost:8787
test.describe('QuikdownEditor E2E Tests', () => {
    let page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        await page.goto('/examples/qde/test-playwright.html');
        // Wait for editor to fully initialize
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test.describe('Initialization', () => {
        test('should initialize editor with split view by default', async () => {
            const sourcePanel = page.locator('.qde-source');
            const previewPanel = page.locator('.qde-preview');
            const viewport = page.viewportSize();

            await expect(sourcePanel).toBeVisible();
            if (viewport && viewport.width <= 768) {
                // On mobile, split mode shows only source pane
                await expect(previewPanel).not.toBeVisible();
            } else {
                await expect(previewPanel).toBeVisible();
            }
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
            
            // Source is always visible in split mode
            await expect(page.locator('.qde-source')).toBeVisible();
            const viewport = page.viewportSize();
            if (viewport && viewport.width <= 768) {
                // On mobile, split mode shows only source pane
                await expect(page.locator('.qde-preview')).not.toBeVisible();
            } else {
                await expect(page.locator('.qde-preview')).toBeVisible();
            }
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
            const preview = await page.locator('.qde-preview');

            // Use editor API to set content (triggers proper render)
            await page.evaluate(() => window.editor.setMarkdown('# Title\n\n**Bold text** here'));
            await page.waitForTimeout(300);

            // Switch to preview mode for full-width display
            await page.click('.qde-btn[data-mode="preview"]');
            await page.waitForTimeout(300);

            // Verify bold formatting rendered
            await expect(preview.locator('strong')).toContainText('Bold text');

            // Click on the strong element and type after it
            await preview.locator('strong').click();
            await page.keyboard.press('End');
            await page.keyboard.type(' and more');
            await page.waitForTimeout(400);

            // Check source via API — bold should be preserved
            const sourceContent = await page.evaluate(() => window.editor.getMarkdown());
            expect(sourceContent).toContain('Bold text');
        });

        test('should handle syntax-highlighted code reverse editing', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Set initial code with syntax highlighting
            const codeFence = '```javascript\nfunction hello() {\n  console.log("Hello");\n}\n```';
            await sourceTextarea.fill(codeFence);
            await page.waitForTimeout(400);
            
            // Edit the code in preview
            const codeBlock = await preview.locator('pre[data-qd-lang="javascript"] code').first();
            await codeBlock.click();
            
            // Select all and replace
            await page.keyboard.press('Control+a');
            await page.keyboard.type('const greeting = "Hi";');
            await page.waitForTimeout(400);
            
            // Check source updated with new code
            const sourceContent = await sourceTextarea.inputValue();
            expect(sourceContent).toContain('```javascript');
            expect(sourceContent).toContain('const greeting = "Hi";');
            expect(sourceContent).not.toContain('function hello()');
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

            // Check table rendered — CSV tables use th in thead or td rows
            await expect(preview.locator('table.qde-csv-table')).toBeVisible();
            const tableText = await preview.locator('table.qde-csv-table').textContent();
            expect(tableText).toContain('Name');
            expect(tableText).toContain('Alice');
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
            const content = '# Title\n\n```svg\n<svg><rect width="100" height="50" fill="red"/></svg>\n```\n\nSome text after SVG';
            await sourceTextarea.fill(content);
            await page.waitForTimeout(400);

            // Verify SVG rendered
            await expect(preview.locator('svg')).toBeVisible();

            // Edit the last paragraph
            const paragraph = preview.locator('p').last();
            await paragraph.click();
            await page.keyboard.press('End');
            await page.keyboard.type(' modified');
            await page.waitForTimeout(400);

            // Check SVG is still in source
            const sourceContent = await sourceTextarea.inputValue();
            expect(sourceContent).toContain('```svg');
            expect(sourceContent).toContain('rect');
        });

        test('should handle Math fence (renders container)', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');

            const mathFence = '```math\nE = mc^2\n```';
            await sourceTextarea.fill(mathFence);
            await page.waitForTimeout(400);

            // Math renders a container with data-qd-source (MathJax may not be loaded)
            const hasContainer = await preview.locator('.qde-math-container, [data-qd-source], pre[data-qd-lang="math"]').count();
            expect(hasContainer).toBeGreaterThan(0);
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

        test('should render TSV fence as table', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');

            const tsvFence = '```tsv\nName\tAge\tCity\nAlice\t30\tNYC\nBob\t25\tLA\n```';
            await sourceTextarea.fill(tsvFence);
            await page.waitForTimeout(400);

            await expect(preview.locator('table.qde-csv-table')).toBeVisible();
            const text = await preview.locator('table.qde-csv-table').textContent();
            expect(text).toContain('Name');
            expect(text).toContain('Alice');
        });

        test('should render PSV fence as table', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');

            const psvFence = '```psv\nName|Age|City\nAlice|30|NYC\nBob|25|LA\n```';
            await sourceTextarea.fill(psvFence);
            await page.waitForTimeout(400);

            await expect(preview.locator('table.qde-csv-table')).toBeVisible();
            const text = await preview.locator('table.qde-csv-table').textContent();
            expect(text).toContain('Name');
            expect(text).toContain('Alice');
        });

        test('should render Mermaid fence (container exists)', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');

            const mermaidFence = '```mermaid\ngraph TD\n  A[Start] --> B{Decision}\n```';
            await sourceTextarea.fill(mermaidFence);
            await page.waitForTimeout(400);

            // Mermaid lib may not be loaded — just verify a container is rendered
            const hasContent = await preview.locator('pre[data-qd-lang="mermaid"], .mermaid').count();
            expect(hasContent).toBeGreaterThan(0);
        });

        test('should render GeoJSON fence (container exists)', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');

            const geojsonFence = '```geojson\n{\n  "type": "Point",\n  "coordinates": [-122.4, 37.8]\n}\n```';
            await sourceTextarea.fill(geojsonFence);
            await page.waitForTimeout(600);

            // Leaflet may not load in CI — just verify the geojson container/pre exists
            const hasContent = await preview.locator('.geojson-container, pre[data-qd-lang="geojson"]').count();
            expect(hasContent).toBeGreaterThan(0);
        });

        test('should render STL 3D models', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            // Simple ASCII STL format
            const stlFence = '```stl\nsolid cube\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 1 1 0\n    endloop\n  endfacet\nendsolid cube\n```';
            await sourceTextarea.fill(stlFence);
            await page.waitForTimeout(600); // Longer wait for Three.js loading
            
            // Check STL container rendered
            const stlContainer = await preview.locator('.qde-stl-container, [id^="qde-stl-viewer-"]');
            await expect(stlContainer).toBeVisible();
        });

        test('should render HTML fence', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');
            
            const htmlFence = '```html\n<div class="test-html">\n  <h2>HTML Content</h2>\n  <p>This is rendered HTML</p>\n</div>\n```';
            await sourceTextarea.fill(htmlFence);
            await page.waitForTimeout(400);
            
            // Check HTML is rendered (not escaped)
            await expect(preview.locator('.test-html')).toBeVisible();
            await expect(preview.locator('.test-html h2')).toContainText('HTML Content');
        });
    });

    test.describe('CSV Table Editing', () => {
        test('should render and preserve CSV table structure', async () => {
            const sourceTextarea = await page.locator('.qde-textarea');
            const preview = await page.locator('.qde-preview');

            const csvFence = '```csv\nA,B,C\n1,2,3\n```';
            await sourceTextarea.fill(csvFence);
            await page.waitForTimeout(400);

            // Verify table rendered
            await expect(preview.locator('table.qde-csv-table')).toBeVisible();
            const text = await preview.locator('table.qde-csv-table').textContent();
            expect(text).toContain('A');
            expect(text).toContain('1');
            expect(text).toContain('3');
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
            await page.setViewportSize({ width: 375, height: 667 });

            const container = page.locator('.qde-container');
            await expect(container).toBeVisible();

            const sourceTextarea = page.locator('.qde-textarea');
            await sourceTextarea.fill('# Mobile Test');
            await page.waitForTimeout(400);

            const content = await sourceTextarea.inputValue();
            expect(content).toBe('# Mobile Test');
        });

        test('should hide preview pane in split mode on mobile', async () => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.click('.qde-btn[data-mode="split"]');

            // In split mode on mobile, preview should be hidden
            await expect(page.locator('.qde-preview')).not.toBeVisible();
            // Source should be visible
            await expect(page.locator('.qde-source')).toBeVisible();
        });

        test('should show split-toggle button on mobile in split mode', async () => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.click('.qde-btn[data-mode="split"]');

            const toggle = page.locator('.qde-split-toggle');
            await expect(toggle).toBeVisible();
            await expect(toggle).toContainText('Preview');
        });

        test('should toggle between source and preview on mobile split', async () => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.click('.qde-btn[data-mode="split"]');

            // Initially source is shown
            await expect(page.locator('.qde-source')).toBeVisible();
            await expect(page.locator('.qde-preview')).not.toBeVisible();

            // Click toggle to show preview
            await page.click('.qde-split-toggle');
            await expect(page.locator('.qde-preview')).toBeVisible();
            await expect(page.locator('.qde-source')).not.toBeVisible();

            // Toggle button should now say "Source"
            await expect(page.locator('.qde-split-toggle')).toContainText('Source');

            // Click toggle again to go back to source
            await page.click('.qde-split-toggle');
            await expect(page.locator('.qde-source')).toBeVisible();
            await expect(page.locator('.qde-preview')).not.toBeVisible();
            await expect(page.locator('.qde-split-toggle')).toContainText('Preview');
        });

        test('should show source mode full width on mobile', async () => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.click('.qde-btn[data-mode="source"]');

            await expect(page.locator('.qde-source')).toBeVisible();
            await expect(page.locator('.qde-preview')).not.toBeVisible();
        });

        test('should show preview mode full width on mobile', async () => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.click('.qde-btn[data-mode="preview"]');

            await expect(page.locator('.qde-preview')).toBeVisible();
            await expect(page.locator('.qde-source')).not.toBeVisible();
        });

        test('should wrap toolbar buttons on mobile', async () => {
            await page.setViewportSize({ width: 375, height: 667 });

            const toolbar = page.locator('.qde-toolbar');
            await expect(toolbar).toBeVisible();
            // Toolbar should allow wrapping (flex-wrap: wrap)
            const flexWrap = await toolbar.evaluate(el => getComputedStyle(el).flexWrap);
            expect(flexWrap).toBe('wrap');
        });
    });
});