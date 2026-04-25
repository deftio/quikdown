import { test, expect } from '@playwright/test';

/**
 * E2E tests for the allow_unsafe_html whitelist feature.
 *
 * Covers:
 *  - Safe HTML tag passthrough in the editor preview
 *  - Dangerous tag blocking (<script>, <iframe>, etc.)
 *  - Attribute sanitization (on* handlers stripped, URLs sanitized)
 *  - Badge / inline-image rendering (display: inline, not stacked)
 *  - Editor API: setAllowUnsafeHTML, getAllowUnsafeHTML, cycleAllowUnsafeHTML
 *  - Toolbar HTML-mode toggle button
 */

// Helpers matching the project's existing patterns
async function setMarkdown(page, md) {
    await page.evaluate((m) => window.editor.setMarkdown(m), md);
    await page.waitForTimeout(400);
}

async function getPreviewHTML(page) {
    return page.evaluate(() =>
        document.querySelector('.qde-preview').innerHTML
    );
}

// ── Tests using the whitelist-enabled test page ────────────────────────

test.describe('HTML Whitelist — Editor E2E', () => {
    let page;

    test.beforeEach(async ({ page: p }) => {
        page = p;
        await page.goto('/examples/qde/test-html-whitelist.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    // ── Safe tag passthrough ────────────────────────────────────────

    test.describe('Safe tag passthrough', () => {
        test('should pass through <details>/<summary> tags', async () => {
            await setMarkdown(page,
                '<details><summary>Click me</summary>\nHidden content\n</details>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<details>');
            expect(html).toContain('<summary>');
            expect(html).toContain('Click me');
        });

        test('should pass through <mark> and <kbd> tags', async () => {
            await setMarkdown(page,
                '<mark>highlighted</mark> and <kbd>Ctrl+S</kbd>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<mark>');
            expect(html).toContain('highlighted');
            expect(html).toContain('<kbd>');
            expect(html).toContain('Ctrl+S');
        });

        test('should pass through <img> with attributes', async () => {
            await setMarkdown(page,
                '<img src="https://via.placeholder.com/100x30" alt="badge" width="100">'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<img');
            expect(html).toContain('src="https://via.placeholder.com/100x30"');
            expect(html).toContain('alt="badge"');
            expect(html).toContain('width="100"');
        });

        test('should pass through <a> tags with href', async () => {
            await setMarkdown(page,
                '<a href="https://example.com">link text</a>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<a href="https://example.com"');
            expect(html).toContain('link text');
        });

        test('should pass through semantic tags', async () => {
            await setMarkdown(page,
                '<section><header>Title</header><p>Content</p></section>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<section>');
            expect(html).toContain('<header>');
        });

        test('should pass through <sup> and <sub> tags', async () => {
            await setMarkdown(page,
                'H<sub>2</sub>O and x<sup>2</sup>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<sub>');
            expect(html).toContain('<sup>');
        });
    });

    // ── Dangerous tag blocking ──────────────────────────────────────

    test.describe('Dangerous tag blocking', () => {
        test('should escape <script> tags', async () => {
            await setMarkdown(page,
                '<script>alert("xss")</script>'
            );
            const html = await getPreviewHTML(page);
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        test('should escape <iframe> tags', async () => {
            await setMarkdown(page,
                '<iframe src="https://evil.com"></iframe>'
            );
            const html = await getPreviewHTML(page);
            expect(html).not.toContain('<iframe');
            expect(html).toContain('&lt;iframe');
        });

        test('should escape <style> tags', async () => {
            await setMarkdown(page,
                '<style>body{display:none}</style>'
            );
            const html = await getPreviewHTML(page);
            expect(html).not.toContain('<style>');
            expect(html).toContain('&lt;style&gt;');
        });

        test('should escape <form> and <input> tags', async () => {
            await setMarkdown(page,
                '<form action="/steal"><input type="text"></form>'
            );
            const html = await getPreviewHTML(page);
            expect(html).not.toContain('<form');
            expect(html).not.toContain('<input');
            expect(html).toContain('&lt;form');
        });

        test('should escape <object> and <embed> tags', async () => {
            await setMarkdown(page,
                '<object data="evil.swf"></object><embed src="evil.swf">'
            );
            const html = await getPreviewHTML(page);
            expect(html).not.toContain('<object');
            expect(html).not.toContain('<embed');
        });
    });

    // ── Attribute sanitization ──────────────────────────────────────

    test.describe('Attribute sanitization', () => {
        test('should strip onclick handlers from safe tags', async () => {
            await setMarkdown(page,
                '<div onclick="alert(1)">click me</div>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<div>');
            expect(html).not.toContain('onclick');
        });

        test('should strip onload handler from img', async () => {
            await setMarkdown(page,
                '<img src="x.jpg" onload="alert(1)">'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<img');
            expect(html).toContain('src="x.jpg"');
            expect(html).not.toContain('onload');
        });

        test('should strip onmouseover (case-insensitive)', async () => {
            await setMarkdown(page,
                '<a href="https://example.com" ONMOUSEOVER="alert(1)">link</a>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<a href="https://example.com"');
            expect(html.toLowerCase()).not.toContain('onmouseover');
        });

        test('should sanitize javascript: URLs in href', async () => {
            await setMarkdown(page,
                '<a href="javascript:alert(1)">xss link</a>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<a');
            expect(html).not.toContain('javascript:');
        });

        test('should sanitize javascript: URLs in img src', async () => {
            await setMarkdown(page,
                '<img src="javascript:alert(1)">'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<img');
            expect(html).not.toContain('javascript:');
        });

        test('should preserve safe attributes (class, id, style, width)', async () => {
            await setMarkdown(page,
                '<div class="box" id="main" style="color:red">styled</div>'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('class="box"');
            expect(html).toContain('id="main"');
            expect(html).toContain('style="color:red"');
        });
    });

    // ── Mixed markdown + HTML ───────────────────────────────────────

    test.describe('Mixed markdown and HTML', () => {
        test('should render markdown alongside passthrough HTML', async () => {
            await setMarkdown(page,
                '# Heading\n\n**Bold text** and <mark>highlighted</mark>\n\n- list item'
            );
            const preview = page.locator('.qde-preview');
            await expect(preview.locator('h1')).toContainText('Heading');
            await expect(preview.locator('strong')).toContainText('Bold text');

            const html = await getPreviewHTML(page);
            expect(html).toContain('<mark>');
        });

        test('should not affect fenced code blocks', async () => {
            await setMarkdown(page,
                '```javascript\nconst x = "<script>alert(1)</script>";\n```'
            );
            const preview = page.locator('.qde-preview');
            // Code fence should render as a code block, not execute HTML
            const codeBlock = await preview.locator('pre[data-qd-lang="javascript"]').count();
            expect(codeBlock).toBeGreaterThan(0);
            const html = await getPreviewHTML(page);
            // The <script> inside the code block should be escaped
            expect(html).not.toMatch(/<script>alert/);
        });

        test('should handle inline code with HTML', async () => {
            await setMarkdown(page,
                'Use `<div>` for containers and <kbd>Enter</kbd> to submit'
            );
            const html = await getPreviewHTML(page);
            // <div> inside backticks should be escaped in the code element
            expect(html).toContain('<code');
            // <kbd> outside backticks should pass through
            expect(html).toContain('<kbd>');
        });
    });

    // ── HTML comment handling ───────────────────────────────────────

    test.describe('HTML comments', () => {
        test('comments dissolve in Safe mode (browser renders nothing)', async () => {
            await setMarkdown(page,
                'before <!-- this is a comment --> after'
            );
            const preview = page.locator('.qde-preview');
            const text = await preview.textContent();
            // Comment should not be visible
            expect(text).not.toContain('this is a comment');
            expect(text).not.toContain('<!--');
            // Surrounding text should be visible
            expect(text).toContain('before');
            expect(text).toContain('after');
            // The comment HTML should be in the raw output (not escaped)
            const html = await getPreviewHTML(page);
            expect(html).toContain('<!-- this is a comment -->');
            expect(html).not.toContain('&lt;!--');
        });

        test('comments are escaped in Off mode (visible as text)', async () => {
            await page.evaluate(() => window.editor.setAllowUnsafeHTML(false));
            await setMarkdown(page,
                'before <!-- comment --> after'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('&lt;!--');
            expect(html).not.toContain('<!-- comment -->');
        });

        test('comments pass through in Allow mode (browser hides them)', async () => {
            await page.evaluate(() => window.editor.setAllowUnsafeHTML(true));
            await setMarkdown(page,
                'before <!-- comment --> after'
            );
            const html = await getPreviewHTML(page);
            expect(html).toContain('<!-- comment -->');
            const preview = page.locator('.qde-preview');
            const text = await preview.textContent();
            expect(text).not.toContain('comment');
        });

        test('multiline comments dissolve in Safe mode', async () => {
            await page.evaluate(() => window.editor.setAllowUnsafeHTML('limited'));
            await setMarkdown(page,
                '<!--\nTODO: fix this later\n-->\nvisible paragraph'
            );
            const preview = page.locator('.qde-preview');
            const text = await preview.textContent();
            expect(text).not.toContain('TODO');
            expect(text).toContain('visible paragraph');
        });
    });

    // ── Markdown comments ([//]: #) ────────────────────────────────

    test.describe('Markdown comments', () => {
        test('[//]: # (comment) lines are stripped', async () => {
            await page.evaluate(() => window.editor.setAllowUnsafeHTML('limited'));
            await setMarkdown(page,
                '[//]: # (BEGIN SIZE TABLE)\n# Visible Heading\n[//]: # (END SIZE TABLE)'
            );
            const preview = page.locator('.qde-preview');
            const text = await preview.textContent();
            expect(text).not.toContain('BEGIN SIZE TABLE');
            expect(text).not.toContain('END SIZE TABLE');
            expect(text).not.toContain('[//]');
            expect(text).toContain('Visible Heading');
        });

        test('[//]: # comments work in all HTML modes', async () => {
            const md = '[//]: # (hidden)\nvisible';
            // Off mode
            await page.evaluate(() => window.editor.setAllowUnsafeHTML(false));
            await setMarkdown(page, md);
            let text = await page.locator('.qde-preview').textContent();
            expect(text).not.toContain('hidden');
            expect(text).toContain('visible');

            // Safe mode
            await page.evaluate(() => window.editor.setAllowUnsafeHTML('limited'));
            await setMarkdown(page, md);
            text = await page.locator('.qde-preview').textContent();
            expect(text).not.toContain('hidden');

            // Raw mode
            await page.evaluate(() => window.editor.setAllowUnsafeHTML(true));
            await setMarkdown(page, md);
            text = await page.locator('.qde-preview').textContent();
            expect(text).not.toContain('hidden');
        });
    });

    // ── Badge / inline image rendering ──────────────────────────────

    test.describe('Badge inline rendering', () => {
        test('should render consecutive badge images inline', async () => {
            await setMarkdown(page, [
                '[![npm](https://img.shields.io/badge/npm-v1.0-blue)](https://npmjs.com)',
                '[![build](https://img.shields.io/badge/build-passing-green)](https://github.com)',
                '[![coverage](https://img.shields.io/badge/cov-96-yellow)](https://github.com)'
            ].join('\n'));

            const preview = page.locator('.qde-preview');
            // All three should be in the same <p>
            const paragraphs = await preview.locator('p').count();
            expect(paragraphs).toBe(1);

            // Images should have display: inline (not block)
            const images = preview.locator('img');
            const count = await images.count();
            expect(count).toBe(3);

            const display = await images.first().evaluate(el =>
                getComputedStyle(el).display
            );
            expect(display).toBe('inline');
        });

        test('should render HTML img tags inline', async () => {
            await setMarkdown(page,
                '<img src="https://img.shields.io/badge/a-1-blue"> <img src="https://img.shields.io/badge/b-2-green">'
            );

            const preview = page.locator('.qde-preview');
            const images = preview.locator('img');
            const count = await images.count();
            expect(count).toBe(2);

            const display = await images.first().evaluate(el =>
                getComputedStyle(el).display
            );
            expect(display).toBe('inline');
        });

        test('badge images should not each occupy a full line', async () => {
            await setMarkdown(page, [
                '[![a](https://img.shields.io/badge/a-1-blue)](https://example.com)',
                '[![b](https://img.shields.io/badge/b-2-green)](https://example.com)'
            ].join('\n'));

            const preview = page.locator('.qde-preview');
            await page.waitForTimeout(200);

            // Both images should share vertical space — their top offsets should be equal
            const tops = await preview.locator('img').evaluateAll(els =>
                els.map(el => el.getBoundingClientRect().top)
            );
            expect(tops).toHaveLength(2);
            // Same top position means they're on the same line
            expect(tops[0]).toBe(tops[1]);
        });
    });

    // ── Editor API ──────────────────────────────────────────────────

    test.describe('Editor allowUnsafeHTML API', () => {
        test('getAllowUnsafeHTML should return current mode', async () => {
            const mode = await page.evaluate(() =>
                window.editor.getAllowUnsafeHTML()
            );
            expect(mode).toBe('limited');
        });

        test('setAllowUnsafeHTML(false) should escape all HTML', async () => {
            await page.evaluate(() => window.editor.setAllowUnsafeHTML(false));
            await setMarkdown(page, '<mark>test</mark>');

            const html = await getPreviewHTML(page);
            expect(html).not.toContain('<mark>');
            expect(html).toContain('&lt;mark&gt;');
        });

        test('setAllowUnsafeHTML(true) should pass all HTML', async () => {
            await page.evaluate(() => window.editor.setAllowUnsafeHTML(true));
            await setMarkdown(page, '<script>alert(1)</script><mark>test</mark>');

            const html = await getPreviewHTML(page);
            // Both safe and dangerous tags pass through
            expect(html).toContain('<mark>');
            expect(html).toContain('<script>');
        });

        test('setAllowUnsafeHTML("limited") should use safe whitelist', async () => {
            // Reset to limited after previous tests
            await page.evaluate(() => window.editor.setAllowUnsafeHTML('limited'));
            await setMarkdown(page, '<mark>safe</mark><script>bad</script>');

            const html = await getPreviewHTML(page);
            expect(html).toContain('<mark>');
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        test('setAllowUnsafeHTML rejects invalid values', async () => {
            // The editor API only accepts false, true, or 'limited'
            // Custom objects should be ignored (guard returns early)
            await page.evaluate(() => window.editor.setAllowUnsafeHTML('limited'));
            await page.evaluate(() =>
                window.editor.setAllowUnsafeHTML({ mark: 1, kbd: 1 })
            );
            // Mode should still be 'limited' (custom object was rejected)
            const mode = await page.evaluate(() => window.editor.getAllowUnsafeHTML());
            expect(mode).toBe('limited');
        });

        test('cycleAllowUnsafeHTML should cycle through modes', async () => {
            // Start at 'limited'
            await page.evaluate(() => window.editor.setAllowUnsafeHTML('limited'));

            // Cycle: limited -> true
            await page.evaluate(() => window.editor.cycleAllowUnsafeHTML());
            let mode = await page.evaluate(() => window.editor.getAllowUnsafeHTML());
            expect(mode).toBe(true);

            // Cycle: true -> false
            await page.evaluate(() => window.editor.cycleAllowUnsafeHTML());
            mode = await page.evaluate(() => window.editor.getAllowUnsafeHTML());
            expect(mode).toBe(false);

            // Cycle: false -> limited
            await page.evaluate(() => window.editor.cycleAllowUnsafeHTML());
            mode = await page.evaluate(() => window.editor.getAllowUnsafeHTML());
            expect(mode).toBe('limited');
        });
    });

    // ── Toolbar toggle button ───────────────────────────────────────

    test.describe('Toolbar HTML mode button', () => {
        test('should show HTML mode button when showAllowUnsafeHTML is true', async () => {
            const btn = page.locator('[data-action="toggle-html-mode"]');
            await expect(btn).toBeVisible();
        });

        test('button should show current mode label', async () => {
            const btn = page.locator('[data-action="toggle-html-mode"]');
            // Editor starts with 'limited'
            await expect(btn).toContainText('HTML: Safe');
        });

        test('button should have tooltip describing current mode', async () => {
            const btn = page.locator('[data-action="toggle-html-mode"]');
            const tooltip = await btn.getAttribute('title');
            expect(tooltip).toContain('Safe tags render');

            // Cycle to Raw
            await btn.click();
            const rawTooltip = await btn.getAttribute('title');
            expect(rawTooltip).toContain('no protection');

            // Cycle to Off
            await btn.click();
            const offTooltip = await btn.getAttribute('title');
            expect(offTooltip).toContain('shown as text');
        });

        test('clicking button should cycle modes and update label', async () => {
            const btn = page.locator('[data-action="toggle-html-mode"]');

            // limited -> true
            await btn.click();
            await expect(btn).toContainText('HTML: Raw');

            // true -> false
            await btn.click();
            await expect(btn).toContainText('HTML: Off');

            // false -> limited
            await btn.click();
            await expect(btn).toContainText('HTML: Safe');
        });

        test('cycling mode should re-render preview', async () => {
            await setMarkdown(page, '<mark>highlighted</mark>');

            // Should be visible in 'limited' mode
            let html = await getPreviewHTML(page);
            expect(html).toContain('<mark>');

            // Click to cycle to 'true' — still visible
            await page.click('[data-action="toggle-html-mode"]');
            await page.waitForTimeout(400);
            html = await getPreviewHTML(page);
            expect(html).toContain('<mark>');

            // Click to cycle to 'false' — should be escaped
            await page.click('[data-action="toggle-html-mode"]');
            await page.waitForTimeout(400);
            html = await getPreviewHTML(page);
            expect(html).toContain('&lt;mark&gt;');

            // Click to cycle back to 'limited' — visible again
            await page.click('[data-action="toggle-html-mode"]');
            await page.waitForTimeout(400);
            html = await getPreviewHTML(page);
            expect(html).toContain('<mark>');
        });
    });

    // ── SAFE_HTML_TAGS static property ──────────────────────────────

    test.describe('SAFE_HTML_TAGS export', () => {
        test('should be accessible as a static property', async () => {
            const tags = await page.evaluate(() => window.SAFE_HTML_TAGS);
            expect(tags).toBeDefined();
            expect(typeof tags).toBe('object');
        });

        test('should contain expected safe tags', async () => {
            const tags = await page.evaluate(() => window.SAFE_HTML_TAGS);
            const expected = ['img', 'a', 'div', 'span', 'details', 'summary',
                'mark', 'kbd', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li',
                'h1', 'h2', 'h3', 'blockquote', 'pre', 'code', 'br', 'hr'];
            for (const tag of expected) {
                expect(tags).toHaveProperty(tag);
            }
        });

        test('should NOT contain dangerous tags', async () => {
            const tags = await page.evaluate(() => window.SAFE_HTML_TAGS);
            const dangerous = ['script', 'iframe', 'style', 'form', 'input',
                'object', 'embed', 'svg', 'link', 'meta', 'base', 'textarea'];
            for (const tag of dangerous) {
                expect(tags).not.toHaveProperty(tag);
            }
        });
    });
});

// ── Tests using the standard test page (no whitelist) ───────────────

test.describe('HTML Whitelist — Default editor (off)', () => {
    let page;

    test.beforeEach(async ({ page: p }) => {
        page = p;
        await page.goto('/examples/qde/test-playwright.html');
        await page.waitForSelector('.qde-container', { timeout: 10000 });
    });

    test('should escape all HTML by default', async () => {
        await setMarkdown(page, '<mark>test</mark><script>alert(1)</script>');
        const html = await getPreviewHTML(page);
        expect(html).not.toContain('<mark>');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;mark&gt;');
        expect(html).toContain('&lt;script&gt;');
    });

    test('should not show HTML mode button by default', async () => {
        const btn = page.locator('[data-action="toggle-html-mode"]');
        await expect(btn).toHaveCount(0);
    });

    test('badge images should still render inline', async () => {
        await setMarkdown(page, [
            '[![a](https://img.shields.io/badge/a-1-blue)](https://example.com)',
            '[![b](https://img.shields.io/badge/b-2-green)](https://example.com)'
        ].join('\n'));

        const preview = page.locator('.qde-preview');
        const images = preview.locator('img');
        const count = await images.count();
        expect(count).toBe(2);

        const display = await images.first().evaluate(el =>
            getComputedStyle(el).display
        );
        expect(display).toBe('inline');
    });
});
