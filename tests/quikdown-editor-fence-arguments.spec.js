import { test, expect } from '@playwright/test';

// Real-browser checks for fence arguments (issue #49): ```csv #sales still
// renders as a table, and editing it in the preview pane writes the fence
// line back unchanged. The unit tests cover every renderer in jsdom; this
// confirms the preview round trip in Chromium and (with QD_WEBKIT=1) WebKit.

async function open(page) {
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto('/examples/qde/test-host-api.html');
    await page.waitForFunction(() => window.ready === true);
    return errors;
}

async function create(page, markdown, options = {}) {
    await page.evaluate(async ({ markdown, options }) => {
        const ed = new window.QuikdownEditor('#a', { showToolbar: false, debounceDelay: 0, mode: 'split', ...options });
        await ed.initPromise;
        await ed.setMarkdown(markdown);
        window.ed = ed;
    }, { markdown, options });
}

test.describe('fence arguments @webkit', () => {
    test('a CSV fence with arguments renders and round-trips through preview editing', async ({ page }) => {
        const errors = await open(page);
        const md = '```csv #sales title="Q1 & Q2"\nregion,q1\nwest,120\n```';
        await create(page, md);

        const table = page.locator('#a .qde-preview table.qde-csv-table');
        await expect(table).toHaveCount(1);
        await expect(table).toHaveAttribute('data-qd-lang', 'csv #sales title="Q1 & Q2"');

        await page.evaluate(() => {
            const cell = document.querySelector('#a .qde-preview tbody td');
            cell.textContent = 'east';
            window.ed.updateFromHTML('user');
        });
        expect(await page.evaluate(() => window.ed.getMarkdown()))
            .toBe('```csv #sales title="Q1 & Q2"\nregion,q1\neast,120\n```');
        expect(errors).toEqual([]);
    });

    test('customFences handlers get (code, lang, info) and keep the info string', async ({ page }) => {
        const errors = await open(page);
        await page.evaluate(async () => {
            window.calls = [];
            const ed = new window.QuikdownEditor('#a', {
                showToolbar: false, debounceDelay: 0, mode: 'split',
                customFences: {
                    js: (code, lang, info) => {
                        window.calls.push([code, lang, info]);
                        return `<div class="cell"><pre>${code}</pre></div>`;
                    },
                },
            });
            await ed.initPromise;
            await ed.setMarkdown('```js run #cell1\nreturn 1;\n```\n\nafter');
            window.ed = ed;
        });

        expect(await page.evaluate(() => window.calls[0])).toEqual(['return 1;', 'js', 'js run #cell1']);
        await expect(page.locator('#a .qde-preview .cell')).toHaveAttribute('data-qd-lang', 'js run #cell1');

        // Edit the paragraph after the cell; the cell's fence line is unchanged.
        await page.evaluate(() => {
            const p = Array.from(document.querySelectorAll('#a .qde-preview p')).pop();
            p.textContent = 'after, edited';
            window.ed.updateFromHTML('user');
        });
        expect(await page.evaluate(() => window.ed.getMarkdown()))
            .toBe('```js run #cell1\nreturn 1;\n```\n\nafter, edited');
        expect(errors).toEqual([]);
    });
});
