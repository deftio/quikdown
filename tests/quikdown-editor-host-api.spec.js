import { test, expect } from '@playwright/test';

// Real-browser checks for the editor's host API (issues #39 and #41):
// formatting shortcuts in both panes, selection mapping between the rendered
// pane and the markdown, per-editor keyboard handling, link clicks, theming
// variables and teardown. Tagged @webkit so the same tests run in WebKit
// (Safari's engine, where #39 was reported) with QD_WEBKIT=1.

const DOC = '# Title\n\nsome **bold** text\n\n- one\n- two\n\nlast [a link](https://example.com/page) here';

async function open(page) {
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto('/examples/qde/test-host-api.html');
    await page.waitForFunction(() => window.ready === true);
    return errors;
}

async function create(page, id, options = {}, markdown = DOC) {
    await page.evaluate(async ({ id, options, markdown }) => {
        window.editors = window.editors || {};
        window.log = window.log || {};
        window.log[id] = { changes: [], links: [] };
        const ed = new window.QuikdownEditor('#' + id, {
            showToolbar: false,
            debounceDelay: 0,
            ...options,
            onChange: (md, html, meta) => window.log[id].changes.push(meta.source),
            ...(options.linkHandler ? { onLinkClick: (href) => { window.log[id].links.push(href); } } : {})
        });
        await ed.initPromise;
        await ed.setMarkdown(markdown);
        window.editors[id] = ed;
    }, { id, options, markdown });
}

const md = (page, id) => page.evaluate(id => window.editors[id].getMarkdown(), id);
const selectedText = page => page.evaluate(() => window.getSelection().toString());

test.describe('Editor host API @webkit', () => {
    test('Cmd/Ctrl+B and I format a word selected in the rendered pane', async ({ page }) => {
        const errors = await open(page);
        await create(page, 'a', { mode: 'preview' });
        await page.locator('#a .qde-preview p').first().dblclick({ position: { x: 12, y: 8 } });
        expect(await selectedText(page)).toContain('some');

        await page.keyboard.press('ControlOrMeta+b');
        expect(await md(page, 'a')).toContain('**some** **bold** text');
        expect((await selectedText(page)).trim()).toBe('some');
        await expect(page.locator('#a .qde-preview p strong').first()).toHaveText('some');

        await page.keyboard.press('ControlOrMeta+i');
        expect(await md(page, 'a')).toContain('***some*** **bold** text');

        await page.keyboard.press('ControlOrMeta+i');
        await page.keyboard.press('ControlOrMeta+b');
        expect(await md(page, 'a')).toBe(DOC);
        expect(errors).toEqual([]);
    });

    test('typing continues at the caret after a format in the rendered pane', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'preview' });
        await page.evaluate(() => {
            const ed = window.editors.a;
            ed.focus('preview');
            const at = ed.getMarkdown().indexOf('text');
            ed.setSelection(at, at + 4);
            ed.format('bold');
        });
        expect((await selectedText(page)).trim()).toBe('text');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.type('!');
        await page.evaluate(() => window.editors.a.flush());
        const result = await md(page, 'a');
        expect(result).toMatch(/\*\*text!?\*\*!?/);
        expect(result).toContain('!');
        expect(result).not.toContain('# Title!');
    });

    test('Cmd/Ctrl+B and I format the selection in the source pane', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'source' }, 'plain words');
        const ta = page.locator('#a .qde-textarea');
        await ta.click();
        await page.evaluate(() => window.editors.a.sourceTextarea.setSelectionRange(6, 11));
        await page.keyboard.press('ControlOrMeta+b');
        await expect(ta).toHaveValue('plain **words**');
        await page.keyboard.press('ControlOrMeta+i');
        await expect(ta).toHaveValue('plain ***words***');
        const sel = await page.evaluate(() => window.editors.a.getSelection());
        expect(sel.text).toBe('words');
        expect(sel.pane).toBe('source');
    });

    test('a click in the rendered pane gives a caret that maps to the markdown', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'preview' });
        await page.locator('#a .qde-preview li').nth(1).click();
        const sel = await page.evaluate(() => window.editors.a.getSelection());
        expect(sel.pane).toBe('preview');
        expect(sel.start).toBeGreaterThanOrEqual(DOC.indexOf('two'));
        expect(sel.start).toBeLessThanOrEqual(DOC.indexOf('two') + 3);
        const state = await page.evaluate(() => window.editors.a.getFormatState());
        expect(state.list).toBe('ul');
        expect(await page.evaluate(() => window.editors.a.getFocusedPane())).toBe('preview');
    });

    test('Tab and Shift+Tab nest and un-nest a list item in the rendered pane', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'preview' });
        await page.locator('#a .qde-preview li').nth(1).click();
        await page.keyboard.press('Tab');
        expect(await md(page, 'a')).toContain('- one\n  - two');
        await expect(page.locator('#a .qde-preview ul ul li')).toHaveText('two');
        expect(await page.evaluate(() => window.editors.a.getFocusedPane())).toBe('preview');
        await page.keyboard.press('Shift+Tab');
        expect(await md(page, 'a')).toContain('- one\n- two');
    });

    test('a host button keeps acting on the pane the user was in', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'split' });
        await page.evaluate(() => {
            document.getElementById('host-button').addEventListener('click', () => window.editors.a.format('strike'));
        });
        await page.locator('#a .qde-preview p').first().dblclick({ position: { x: 12, y: 8 } });
        await page.locator('#host-button').click();
        expect(await md(page, 'a')).toContain('~~some~~ **bold** text');
        await expect(page.locator('#a .qde-textarea')).toHaveValue(/~~some~~/);
    });

    test('shortcuts act only on the editor that has focus; other inputs keep theirs', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'split' }, 'a1');
        await create(page, 'b', { mode: 'split' }, 'b1');
        await page.evaluate(async () => {
            await window.editors.a.setMarkdown('a2', { history: 'push' });
            await window.editors.b.setMarkdown('b2', { history: 'push' });
        });

        await page.locator('#b .qde-textarea').click();
        await page.keyboard.press('ControlOrMeta+z');
        expect(await md(page, 'b')).toBe('b1');
        expect(await md(page, 'a')).toBe('a2');

        await page.keyboard.press('ControlOrMeta+1');
        expect(await page.evaluate(() => [window.editors.a.getMode(), window.editors.b.getMode()])).toEqual(['split', 'source']);

        const plain = page.locator('#plain');
        await plain.click();
        await page.keyboard.type('hello');
        await page.keyboard.press('ControlOrMeta+z');
        await expect(plain).not.toHaveValue('hello');
        expect(await md(page, 'a')).toBe('a2');
        expect(await md(page, 'b')).toBe('b1');
    });

    test('onLinkClick gets the href and the page does not navigate', async ({ page }) => {
        await open(page);
        await create(page, 'a', { mode: 'preview', linkHandler: true });
        const url = page.url();
        await page.locator('#a .qde-preview a').click();
        expect(await page.evaluate(() => window.log.a.links)).toEqual(['https://example.com/page']);
        expect(page.url()).toBe(url);
    });

    test('CSS custom properties on the host theme the editor', async ({ page }) => {
        await open(page);
        await create(page, 'themed', { mode: 'split', theme: 'light' });
        const styles = await page.evaluate(() => {
            const root = document.querySelector('#themed');
            const preview = root.querySelector('.qde-preview');
            return {
                bg: getComputedStyle(root).backgroundColor,
                fg: getComputedStyle(root).color,
                size: getComputedStyle(preview).fontSize
            };
        });
        expect(styles).toEqual({ bg: 'rgb(250, 240, 230)', fg: 'rgb(10, 20, 30)', size: '21px' });

        await create(page, 'a', { mode: 'split', theme: 'light' });
        const plain = await page.evaluate(() => getComputedStyle(document.querySelector('#a')).backgroundColor);
        expect(plain).toBe('rgb(255, 255, 255)');
    });

    test('scrollToLine and getScroll/setScroll move the real panes', async ({ page }) => {
        await open(page);
        const long = Array.from({ length: 80 }, (_, i) => `## Section ${i}\n\nparagraph ${i}`).join('\n\n');
        await create(page, 'a', { mode: 'split' }, long);
        const line = long.slice(0, long.indexOf('## Section 40')).split('\n').length - 1;
        const result = await page.evaluate((line) => {
            const ed = window.editors.a;
            const block = ed.scrollToLine(line);
            const panel = ed.previewPanel.getBoundingClientRect();
            const rect = block.getBoundingClientRect();
            const scroll = ed.getScroll();
            ed.setScroll({ source: 0, preview: 0 });
            const reset = ed.getScroll();
            ed.setScroll(scroll);
            return { text: block.textContent, delta: Math.abs(rect.top - panel.top), scroll, reset, back: ed.getScroll(), lineOf: ed.lineOf(block) };
        }, line);
        expect(result.text).toBe('Section 40');
        expect(result.delta).toBeLessThan(40);
        expect(result.scroll.source).toBeGreaterThan(0);
        expect(result.scroll.preview).toBeGreaterThan(0);
        expect(result.reset).toEqual({ source: 0, preview: 0 });
        expect(result.back).toEqual(result.scroll);
        expect(result.lineOf).toBe(line);
    });

    test('destroying one of two editors leaves the other working and the page clean', async ({ page }) => {
        const errors = await open(page);
        await create(page, 'a', { mode: 'split' }, 'first');
        await create(page, 'b', { mode: 'split' }, 'second');
        await page.evaluate(() => window.editors.a.destroy());
        await expect(page.locator('#a')).toBeEmpty();
        await expect(page.locator('#a')).not.toHaveClass(/qde-container/);

        await page.locator('#b .qde-textarea').click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('ControlOrMeta+b');
        expect(await md(page, 'b')).toBe('**second**');
        await expect(page.locator('#b .qde-preview strong')).toHaveText('second');

        await page.evaluate(() => window.editors.b.destroy());
        expect(await page.evaluate(() => document.getElementById('qde-styles'))).toBeNull();
        await page.locator('#plain').click();
        await page.keyboard.press('ControlOrMeta+z');
        expect(errors).toEqual([]);
    });
});
