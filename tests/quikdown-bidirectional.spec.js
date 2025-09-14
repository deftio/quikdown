import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('QuikdownEditor Bidirectional Editing Tests', () => {
    let page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        await page.goto(`file://${join(__dirname, '../examples/qde/test-playwright.html')}`);
        await page.waitForSelector('#editor');
        
        // Enable bidirectional mode
        await page.evaluate(() => {
            if (window.editor) {
                window.editor.options.bidirectional = true;
            }
        });
    });

    test.describe('Preview to Source Sync', () => {
        test('should update source when editing text in preview', async () => {
            const initialContent = '# Hello World\n\nThis is a paragraph.';
            
            // Set initial content
            await page.locator('.qde-source').fill(initialContent);
            await page.waitForTimeout(500);
            
            // Enable bidirectional mode if not already
            const bidirectionalBtn = await page.locator('[data-action="toggle-bidirectional"]');
            if (bidirectionalBtn) {
                await bidirectionalBtn.click();
            }
            
            // Edit the heading in preview
            const heading = await page.locator('.qde-preview h1');
            await heading.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Modified Heading');
            
            // Click outside to trigger update
            await page.locator('.qde-preview').click({ position: { x: 10, y: 100 } });
            await page.waitForTimeout(500);
            
            // Check that source updated
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('# Modified Heading');
        });

        test('should preserve formatting when editing in preview', async () => {
            const content = '**Bold text** and *italic text* and `code`';
            
            await page.locator('.qde-source').fill(content);
            await page.waitForTimeout(500);
            
            // Edit bold text in preview
            const boldElement = await page.locator('.qde-preview strong');
            await boldElement.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('New Bold');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 100 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('**New Bold**');
            expect(sourceContent).toContain('*italic text*');
            expect(sourceContent).toContain('`code`');
        });

        test('should handle list editing in preview', async () => {
            const listContent = '- Item 1\n- Item 2\n- Item 3';
            
            await page.locator('.qde-source').fill(listContent);
            await page.waitForTimeout(500);
            
            // Edit first list item
            const firstItem = await page.locator('.qde-preview li').first();
            await firstItem.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Modified Item');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 100 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('- Modified Item');
            expect(sourceContent).toContain('- Item 2');
        });
    });

    test.describe('Fence Block Preservation', () => {
        test('should preserve math blocks during bidirectional edit', async () => {
            const content = `# Document

Before math

\`\`\`math
e^{i\\pi} + 1 = 0
\`\`\`

After math`;
            
            await page.locator('.qde-source').fill(content);
            await page.waitForTimeout(1000);
            
            // Edit text before math
            const para = await page.locator('.qde-preview p').first();
            await para.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Modified text before math');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 300 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('Modified text before math');
            expect(sourceContent).toContain('```math');
            expect(sourceContent).toContain('e^{i\\pi} + 1 = 0');
            expect(sourceContent).toContain('After math');
        });

        test('should preserve code blocks during edit', async () => {
            const content = `Text before

\`\`\`javascript
const x = 42;
console.log(x);
\`\`\`

Text after`;
            
            await page.locator('.qde-source').fill(content);
            await page.waitForTimeout(500);
            
            // Edit text after code block
            const lastPara = await page.locator('.qde-preview p').last();
            await lastPara.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Modified text after');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 10 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('```javascript');
            expect(sourceContent).toContain('const x = 42;');
            expect(sourceContent).toContain('Modified text after');
        });

        test('should preserve GeoJSON blocks', async () => {
            const content = `# Map Example

\`\`\`geojson
{"type":"Point","coordinates":[-122.4,37.8]}
\`\`\`

Description text`;
            
            await page.locator('.qde-source').fill(content);
            await page.waitForTimeout(1000);
            
            // Edit heading
            const heading = await page.locator('.qde-preview h1');
            await heading.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Updated Map Example');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 400 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('# Updated Map Example');
            expect(sourceContent).toContain('```geojson');
            expect(sourceContent).toContain('"type":"Point"');
        });
    });

    test.describe('Complex Document Editing', () => {
        test('should handle mixed content document editing', async () => {
            const complexDoc = `# Technical Document

## Introduction
This is the **introduction** with *emphasis*.

## Code Example
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

## Math Section
The equation is:

\`\`\`math
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
\`\`\`

## Data Table
\`\`\`csv
Name,Score
Alice,95
Bob,87
\`\`\`

## Conclusion
Final thoughts here.`;
            
            await page.locator('.qde-source').fill(complexDoc);
            await page.waitForTimeout(1500);
            
            // Edit introduction
            const intro = await page.locator('.qde-preview p').first();
            await intro.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('This is the updated introduction with emphasis.');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 10 } });
            await page.waitForTimeout(500);
            
            // Edit conclusion
            const conclusion = await page.locator('.qde-preview p').last();
            await conclusion.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Updated final thoughts.');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 10 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            
            // Verify all fence blocks are preserved
            expect(sourceContent).toContain('```python');
            expect(sourceContent).toContain('def hello():');
            expect(sourceContent).toContain('```math');
            expect(sourceContent).toContain('\\sum_{i=1}^{n}');
            expect(sourceContent).toContain('```csv');
            expect(sourceContent).toContain('Alice,95');
            
            // Verify edits were applied
            expect(sourceContent).toContain('updated introduction');
            expect(sourceContent).toContain('Updated final thoughts');
        });

        test('should maintain document structure during edits', async () => {
            const structured = `# Main Title

## Section 1
Content 1

### Subsection 1.1
Nested content

## Section 2
Content 2

### Subsection 2.1
More nested content`;
            
            await page.locator('.qde-source').fill(structured);
            await page.waitForTimeout(500);
            
            // Count original headings
            const h2Count = await page.locator('.qde-preview h2').count();
            const h3Count = await page.locator('.qde-preview h3').count();
            
            expect(h2Count).toBe(2);
            expect(h3Count).toBe(2);
            
            // Edit a subsection
            const subsection = await page.locator('.qde-preview h3').first();
            await subsection.click();
            await page.keyboard.selectAll();
            await page.keyboard.type('Updated Subsection 1.1');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 10 } });
            await page.waitForTimeout(500);
            
            const sourceContent = await page.locator('.qde-source').inputValue();
            
            // Verify structure is maintained
            expect(sourceContent.match(/^#{2}\s/gm)?.length).toBe(2); // Two h2
            expect(sourceContent.match(/^#{3}\s/gm)?.length).toBe(2); // Two h3
            expect(sourceContent).toContain('### Updated Subsection 1.1');
        });
    });

    test.describe('Edge Cases', () => {
        test('should handle empty document', async () => {
            await page.locator('.qde-source').fill('');
            await page.waitForTimeout(500);
            
            // Try to edit in preview (should handle gracefully)
            await page.locator('.qde-preview').click();
            await page.keyboard.type('New content');
            
            // Should not cause errors
            const hasError = await page.evaluate(() => {
                return window.lastError !== undefined;
            });
            expect(hasError).toBe(false);
        });

        test('should handle rapid edits', async () => {
            const content = '# Test\n\nParagraph 1\n\nParagraph 2';
            
            await page.locator('.qde-source').fill(content);
            await page.waitForTimeout(500);
            
            // Make rapid edits
            const p1 = await page.locator('.qde-preview p').first();
            await p1.click();
            await page.keyboard.type('Quick edit 1');
            
            const p2 = await page.locator('.qde-preview p').last();
            await p2.click();
            await page.keyboard.type('Quick edit 2');
            
            await page.locator('.qde-preview').click({ position: { x: 10, y: 10 } });
            await page.waitForTimeout(1000);
            
            // Should handle all edits
            const sourceContent = await page.locator('.qde-source').inputValue();
            expect(sourceContent).toContain('Quick edit');
        });
    });
});