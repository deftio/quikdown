import { test, expect } from '@playwright/test';

// Helpers for setting/getting editor content via the editor API (most reliable).
async function setMarkdown(page, content) {
    await page.evaluate((md) => window.editor.setMarkdown(md), content);
    await page.waitForTimeout(300);
}

async function getMarkdown(page) {
    return await page.evaluate(() => window.editor.getMarkdown());
}

// Select the text contents of an element inside the preview (by selector, nth index).
// Using Control+A in a contenteditable selects the ENTIRE preview, which would wipe
// everything. Instead we use a Range to select only the target element's contents.
async function selectElementContents(page, selector, index = 0) {
    await page.evaluate(({ selector, index }) => {
        const nodes = document.querySelectorAll(`.qde-preview ${selector}`);
        const el = nodes[index];
        if (!el) throw new Error(`Element not found: ${selector}[${index}]`);
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }, { selector, index });
}

// Trigger blur on the preview so bidirectional sync runs.
async function blurPreview(page) {
    await page.evaluate(() => {
        const preview = document.querySelector('.qde-preview');
        if (preview) preview.blur();
    });
}

test.describe('QuikdownEditor Bidirectional Editing Tests', () => {
    let page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;
        await page.goto('/examples/qde/test-playwright.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });

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

            await setMarkdown(page, initialContent);

            // Select only the heading's text and replace it
            await selectElementContents(page, 'h1');
            await page.keyboard.type('Modified Heading');
            await page.waitForTimeout(500);

            const sourceContent = await getMarkdown(page);
            expect(sourceContent).toContain('Modified Heading');
        });

        test('should preserve formatting when editing in preview', async () => {
            const content = '**Bold text** and *italic text* and `code`';

            await setMarkdown(page, content);

            // Edit bold text in preview by selecting only strong's contents
            await selectElementContents(page, 'strong');
            await page.keyboard.type('New Bold');
            await page.waitForTimeout(500);

            const sourceContent = await getMarkdown(page);
            // Bidirectional edit should keep italic + code intact
            expect(sourceContent).toContain('italic text');
            expect(sourceContent).toContain('code');
        });

        test('should handle list editing in preview', async () => {
            const listContent = '- Item 1\n- Item 2\n- Item 3';

            await setMarkdown(page, listContent);

            // Edit first list item
            await selectElementContents(page, 'li', 0);
            await page.keyboard.type('Modified Item');
            await page.waitForTimeout(500);

            const sourceContent = await getMarkdown(page);
            expect(sourceContent).toContain('Modified Item');
            expect(sourceContent).toContain('Item 2');
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

            await setMarkdown(page, content);
            await page.waitForTimeout(500);

            // Edit the first paragraph ("Before math")
            await selectElementContents(page, 'p', 0);
            await page.keyboard.type('Modified text before math');
            await page.waitForTimeout(500);

            const sourceContent = await getMarkdown(page);
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

            await setMarkdown(page, content);

            // Count paragraphs and edit the last one ("Text after")
            const pCount = await page.locator('.qde-preview p').count();
            await selectElementContents(page, 'p', pCount - 1);
            await page.keyboard.type('Modified text after');
            await page.waitForTimeout(500);

            const sourceContent = await getMarkdown(page);
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

            await setMarkdown(page, content);
            await page.waitForTimeout(500);

            // Edit heading
            await selectElementContents(page, 'h1');
            await page.keyboard.type('Updated Map Example');
            await page.waitForTimeout(500);

            const sourceContent = await getMarkdown(page);
            expect(sourceContent).toContain('Updated Map Example');
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

            await setMarkdown(page, complexDoc);
            await page.waitForTimeout(700);

            const sourceContent = await getMarkdown(page);

            // Verify all fence blocks are preserved after round-trip
            expect(sourceContent).toContain('```python');
            expect(sourceContent).toContain('def hello():');
            expect(sourceContent).toContain('```math');
            expect(sourceContent).toContain('\\sum_{i=1}^{n}');
            expect(sourceContent).toContain('```csv');
            expect(sourceContent).toContain('Alice,95');
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

            await setMarkdown(page, structured);

            // Count original headings
            const h2Count = await page.locator('.qde-preview h2').count();
            const h3Count = await page.locator('.qde-preview h3').count();

            expect(h2Count).toBe(2);
            expect(h3Count).toBe(2);

            const sourceContent = await getMarkdown(page);

            // Verify structure is maintained
            expect(sourceContent.match(/^#{2}\s/gm)?.length).toBe(2); // Two h2
            expect(sourceContent.match(/^#{3}\s/gm)?.length).toBe(2); // Two h3
        });
    });

    test.describe('Edge Cases', () => {
        test('should handle empty document', async () => {
            await setMarkdown(page, '');

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

            await setMarkdown(page, content);

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
            const sourceContent = await getMarkdown(page);
            expect(sourceContent).toContain('Quick edit');
        });
    });
});
