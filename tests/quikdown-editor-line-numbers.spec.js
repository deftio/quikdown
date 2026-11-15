import { test, expect } from '@playwright/test';

// Real-browser checks for source-pane line numbers (issue #45). The numbers
// live in a layer over the textarea that repeats each line invisibly, so a
// row is as tall as its (possibly wrapped) line. jsdom has no layout, so the
// claim that the layer wraps exactly like the textarea is tested here, in
// Chromium and (with QD_WEBKIT=1) WebKit.

const LINES = [
    '# Title',
    '',
    'A short line.',
    'A long line of ordinary prose that is certain to wrap at least once or twice in a pane of this width, because it keeps going well past the right edge of the source pane and then some more.',
    '',
    '- a list item with enough words in it to wrap onto a second visual line in the pane, perhaps a third',
    '\tindented with a tab, followed by text that is long enough to wrap around to the next visual line here',
    'averyveryverylongunbrokenwordwithoutanyspacesatallthathastobebrokeninthemiddlebecausenothingelsecanbedonewithitinanarrowpane',
    'trailing spaces at the end of this line           ',
    '    four leading spaces and then    several    runs    of    spaces    inside    the    line    to    wrap',
    'CJK 文字が含まれている行で、折り返しが発生するくらいの長さがあるテキストです。日本語の文章はどこでも折り返せます。',
    'emoji 😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎',
    'https://example.com/a/very/long/url/that/has/no/spaces/and/keeps/going/and/going/until/it/must/wrap/somewhere?query=1&other=2',
    '',
    'last line'
];
const DOC = LINES.join('\n');

async function open(page) {
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto('/examples/qde/test-host-api.html');
    await page.waitForFunction(() => window.ready === true);
    return errors;
}

async function create(page, options = {}, markdown = DOC) {
    await page.evaluate(async ({ options, markdown }) => {
        const ed = new window.QuikdownEditor('#a', { showToolbar: false, debounceDelay: 0, mode: 'source', ...options });
        await ed.initPromise;
        await ed.setMarkdown(markdown);
        window.ed = ed;
    }, { options, markdown });
}

// Heights of the textarea's content and of the number layer's content
const heights = page => page.evaluate(() => ({
    textarea: window.ed.sourceTextarea.scrollHeight,
    layer: window.ed.lineNumbersEl.scrollHeight,
    textareaWidth: window.ed.sourceTextarea.clientWidth,
    layerWidth: window.ed.lineNumbersEl.clientWidth
}));

test.describe('Editor line numbers @webkit', () => {
    test('off by default: the layer is hidden and the textarea padding is unchanged', async ({ page }) => {
        const errors = await open(page);
        await create(page, {});
        const state = await page.evaluate(() => ({
            on: window.ed.getLineNumbers(),
            display: getComputedStyle(window.ed.lineNumbersEl).display,
            rows: window.ed.lineNumbersEl.children.length,
            padLeft: getComputedStyle(window.ed.sourceTextarea).paddingLeft,
            padRight: getComputedStyle(window.ed.sourceTextarea).paddingRight
        }));
        expect(state.on).toBe(false);
        expect(state.display).toBe('none');
        expect(state.rows).toBe(0);
        expect(state.padLeft).toBe(state.padRight);
        expect(errors).toEqual([]);
    });

    test('one numbered row per line, visible beside the text', async ({ page }) => {
        await open(page);
        await create(page, { lineNumbers: true });
        const state = await page.evaluate(() => {
            const layer = window.ed.lineNumbersEl;
            const first = layer.querySelector('.qde-ln').getBoundingClientRect();
            const box = window.ed.sourceTextarea.getBoundingClientRect();
            return {
                numbers: Array.from(layer.querySelectorAll('.qde-ln')).map(el => el.textContent),
                display: getComputedStyle(layer).display,
                numberLeft: first.left - box.left,
                numberRight: first.right - box.left,
                textLeft: parseFloat(getComputedStyle(window.ed.sourceTextarea).paddingLeft),
                numberColor: getComputedStyle(layer.querySelector('.qde-ln')).color,
                textColor: getComputedStyle(layer).color,
                pointerEvents: getComputedStyle(layer).pointerEvents
            };
        });
        expect(state.numbers).toEqual(LINES.map((_, i) => String(i + 1)));
        expect(state.display).toBe('block');
        // The number sits inside the pane, to the left of where the text starts
        expect(state.numberLeft).toBeGreaterThanOrEqual(0);
        expect(state.numberRight).toBeLessThan(state.textLeft);
        // The copied line text is invisible; the number is not
        expect(state.textColor).toBe('rgba(0, 0, 0, 0)');
        expect(state.numberColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(state.pointerEvents).toBe('none');
    });

    test('rows are as tall as the wrapped lines in the textarea', async ({ page }) => {
        await open(page);
        // A narrow pane, so that most of the lines wrap
        await page.evaluate(() => { document.getElementById('a').style.width = '360px'; });
        await create(page, { lineNumbers: true });
        const all = await heights(page);
        expect(all.layer).toBe(all.textarea);
        expect(all.layerWidth).toBe(all.textareaWidth);

        // Wrapping must really be happening for this to mean anything
        const wrapped = await page.evaluate(() => {
            const rows = Array.from(window.ed.lineNumbersEl.children).map(r => r.getBoundingClientRect().height);
            const single = Math.min(...rows);
            return rows.filter(h => h > single * 1.5).length;
        });
        expect(wrapped).toBeGreaterThanOrEqual(6);

        // Every prefix of the document: if any one line wrapped differently
        // in the layer, the heights would differ from that line on.
        for (let n = 1; n <= LINES.length; n++) {
            await page.evaluate(async (text) => { await window.ed.setMarkdown(text); }, LINES.slice(0, n).join('\n'));
            const h = await heights(page);
            expect(h.layer, `first ${n} lines`).toBe(h.textarea);
        }
    });

    test('each number is at the top of its line', async ({ page }) => {
        await open(page);
        // Short lines only, so the expected top of line n is (n - 1) line heights
        const doc = Array.from({ length: 12 }, (_, i) => 'line ' + (i + 1)).join('\n');
        await create(page, { lineNumbers: true }, doc);
        const tops = await page.evaluate(() => {
            const layer = window.ed.lineNumbersEl;
            const style = getComputedStyle(window.ed.sourceTextarea);
            const lineHeight = parseFloat(style.lineHeight);
            const origin = layer.getBoundingClientRect().top + parseFloat(style.paddingTop);
            return Array.from(layer.querySelectorAll('.qde-ln')).map((el, i) =>
                Math.abs((el.getBoundingClientRect().top - origin) - i * lineHeight));
        });
        tops.forEach(delta => expect(delta).toBeLessThan(1));
    });

    test('stays aligned when the pane is resized and when a scrollbar appears', async ({ page }) => {
        await open(page);
        await create(page, { lineNumbers: true });
        for (const width of [260, 420, 700]) {
            await page.evaluate(w => { document.getElementById('a').style.width = w + 'px'; }, width);
            await expect.poll(async () => {
                const h = await heights(page);
                return h.layer === h.textarea && h.layerWidth === h.textareaWidth;
            }, { message: `width ${width}` }).toBe(true);
        }
        // Enough text to overflow the pane vertically
        await page.evaluate(async (text) => { await window.ed.setMarkdown(text); }, Array(12).fill(DOC).join('\n'));
        const h = await heights(page);
        expect(h.textarea).toBeGreaterThan(await page.evaluate(() => window.ed.sourceTextarea.clientHeight));
        expect(h.layer).toBe(h.textarea);
        expect(h.layerWidth).toBe(h.textareaWidth);
    });

    test('follows the textarea when it scrolls', async ({ page }) => {
        await open(page);
        await create(page, { lineNumbers: true }, Array(12).fill(DOC).join('\n'));
        await page.evaluate(() => { window.ed.sourceTextarea.scrollTop = 333; });
        await expect.poll(() => page.evaluate(() => window.ed.lineNumbersEl.scrollTop)).toBe(333);
        await page.evaluate(() => { window.ed.sourceTextarea.scrollTop = window.ed.sourceTextarea.scrollHeight; });
        await expect.poll(() => page.evaluate(() =>
            window.ed.lineNumbersEl.scrollTop === window.ed.sourceTextarea.scrollTop)).toBe(true);
    });

    test('typing updates the numbers and the gutter widens at 100 lines', async ({ page }) => {
        await open(page);
        await create(page, { lineNumbers: true }, 'one\ntwo');
        const count = () => page.evaluate(() => window.ed.lineNumbersEl.children.length);
        const pad = () => page.evaluate(() => parseFloat(getComputedStyle(window.ed.sourceTextarea).paddingLeft));

        await page.locator('#a textarea').focus();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('three');
        expect(await count()).toBe(3);
        expect(await page.evaluate(() => window.ed.getMarkdown())).toBe('one\ntwo\nthree');

        const narrow = await pad();
        await page.evaluate(async () => { await window.ed.setMarkdown(Array(120).fill('x').join('\n')); });
        expect(await count()).toBe(120);
        expect(await pad()).toBeGreaterThan(narrow);
        const h = await heights(page);
        expect(h.layer).toBe(h.textarea);
    });

    test('setLineNumbers turns them on and off, and clicks still reach the textarea', async ({ page }) => {
        await open(page);
        await create(page, {}, 'one\ntwo\nthree');
        const padOff = await page.evaluate(() => getComputedStyle(window.ed.sourceTextarea).paddingLeft);

        await page.evaluate(() => window.ed.setLineNumbers(true));
        expect(await page.evaluate(() => window.ed.lineNumbersEl.children.length)).toBe(3);
        const h = await heights(page);
        expect(h.layer).toBe(h.textarea);

        // The layer covers the textarea but lets the pointer through
        const box = await page.locator('#a textarea').boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + 30);
        expect(await page.evaluate(() => document.activeElement === window.ed.sourceTextarea)).toBe(true);
        await page.keyboard.type('Z');
        expect(await page.evaluate(() => window.ed.getMarkdown())).toContain('Z');

        await page.evaluate(() => window.ed.setLineNumbers(false));
        const off = await page.evaluate(() => ({
            display: getComputedStyle(window.ed.lineNumbersEl).display,
            rows: window.ed.lineNumbersEl.children.length,
            pad: getComputedStyle(window.ed.sourceTextarea).paddingLeft
        }));
        expect(off.display).toBe('none');
        expect(off.rows).toBe(0);
        expect(off.pad).toBe(padOff);
    });

    test('split mode and the dark theme', async ({ page }) => {
        await open(page);
        await create(page, { lineNumbers: true, mode: 'split', theme: 'dark' });
        const h = await heights(page);
        expect(h.layer).toBe(h.textarea);
        const colors = await page.evaluate(() => ({
            number: getComputedStyle(window.ed.lineNumbersEl.querySelector('.qde-ln')).color,
            background: getComputedStyle(window.ed.lineNumbersEl).backgroundImage
        }));
        expect(colors.number).toBe('rgb(119, 119, 119)');
        expect(colors.background).toContain('rgb(37, 37, 37)');

        // Hidden in preview mode, correct again when the source pane returns
        await page.evaluate(() => window.ed.setMode('preview'));
        await page.evaluate(() => window.ed.setMode('source'));
        await expect.poll(async () => { const x = await heights(page); return x.layer === x.textarea; }).toBe(true);
    });
});
