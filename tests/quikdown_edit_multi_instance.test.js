/**
 * @jest-environment jsdom
 *
 * Several editors on one page, created and destroyed independently: the
 * shape of an assistant UI where each chat turn is rendered by its own
 * editor. Every instance must own its state, listeners and timers, and
 * destroying one must leave nothing behind and not disturb the others.
 */
import QuikdownEditor from '../dist/quikdown_edit.esm.js';

let mediaListeners;

beforeEach(() => {
    mediaListeners = [];
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            addEventListener: jest.fn((type, fn) => mediaListeners.push(fn)),
            removeEventListener: jest.fn((type, fn) => {
                const i = mediaListeners.indexOf(fn);
                if (i !== -1) mediaListeners.splice(i, 1);
            }),
        })),
    });
    document.body.innerHTML = '<div id="chat"></div>';
});

afterEach(() => {
    window.getSelection().removeAllRanges();
    document.body.innerHTML = '';
    document.getElementById('qde-styles')?.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

/** Add one chat turn: a container in #chat with its own editor. */
async function addTurn(markdown, options = {}) {
    const el = document.createElement('div');
    el.className = 'turn';
    document.getElementById('chat').appendChild(el);
    const editor = new QuikdownEditor(el, { showToolbar: false, mode: 'preview', ...options });
    await editor.initPromise;
    await editor.setMarkdown(markdown);
    return { el, editor };
}

function key(target, init) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** Count listeners added to and removed from a target while fn runs. */
function trackListeners(target) {
    const live = new Map();
    const add = jest.spyOn(target, 'addEventListener').mockImplementation(function (type, fn, opts) {
        live.set(fn, type);
        return EventTarget.prototype.addEventListener.call(this, type, fn, opts);
    });
    const remove = jest.spyOn(target, 'removeEventListener').mockImplementation(function (type, fn, opts) {
        live.delete(fn);
        return EventTarget.prototype.removeEventListener.call(this, type, fn, opts);
    });
    return { live, restore: () => { add.mockRestore(); remove.mockRestore(); } };
}

describe('independent state', () => {
    test('each chat turn renders its own content', async () => {
        const turns = [];
        for (let i = 0; i < 6; i++) {
            turns.push(await addTurn(`## Turn ${i}\n\nmessage **${i}**`));
        }
        turns.forEach(({ el, editor }, i) => {
            expect(el.querySelector('h2').textContent).toBe(`Turn ${i}`);
            expect(el.querySelector('strong').textContent).toBe(String(i));
            expect(editor.getMarkdown()).toBe(`## Turn ${i}\n\nmessage **${i}**`);
            expect(el.querySelectorAll('.qde-preview').length).toBe(1);
        });
        expect(document.querySelectorAll('.qde-container').length).toBe(6);
        expect(document.querySelectorAll('#qde-styles').length).toBe(1);
        turns.forEach(t => t.editor.destroy());
    });

    test('changing one editor does not change another: text, mode, theme, history, options', async () => {
        const a = await addTurn('alpha', { mode: 'split' });
        const b = await addTurn('beta', { mode: 'split' });

        a.editor.replaceRange(5, 5, ' one');
        a.editor.setMode('source');
        a.editor.setTheme('dark');
        a.editor.setLazyLinefeeds(true);
        a.editor.setDebounceDelay(999);
        a.editor.setAllowUnsafeHTML('limited');

        expect(b.editor.getMarkdown()).toBe('beta');
        expect(b.editor.getMode()).toBe('split');
        expect(b.el.classList.contains('qde-dark')).toBe(false);
        expect(b.editor.canUndo()).toBe(false);
        expect(b.editor.getLazyLinefeeds()).toBe(false);
        expect(b.editor.getDebounceDelay()).toBe(20);
        expect(b.editor.getAllowUnsafeHTML()).toBe(false);

        a.editor.undo();
        expect(a.editor.getMarkdown()).toBe('alpha');
        expect(b.editor.canRedo()).toBe(false);
        a.editor.destroy();
        b.editor.destroy();
    });

    test('default option objects are not shared between instances', async () => {
        const a = await addTurn('a');
        const b = await addTurn('b');
        expect(a.editor.options).not.toBe(b.editor.options);
        expect(a.editor.options.customFences).not.toBe(b.editor.options.customFences);
        expect(a.editor.options.plugins).not.toBe(b.editor.options.plugins);

        a.editor.options.customFences.shout = code => `<p class="shout">${code.toUpperCase()}</p>`;
        a.editor.options.plugins.mermaid = true;
        await a.editor.setMarkdown('```shout\nhi\n```');
        await b.editor.setMarkdown('```shout\nhi\n```');
        expect(a.el.querySelector('.shout').textContent).toBe('HI');
        expect(b.el.querySelector('.shout')).toBeNull();
        expect(b.editor.options.plugins.mermaid).toBe(false);

        const c = await addTurn('```shout\nhi\n```');
        expect(c.el.querySelector('.shout')).toBeNull();
        expect(c.editor.options.plugins).toEqual({ highlightjs: false, mermaid: false });
        [a, b, c].forEach(t => t.editor.destroy());
    });

    test('option objects passed by the host are used as given', async () => {
        const customFences = { tag: code => `<p class="tag">${code}</p>` };
        const plugins = { highlightjs: false, mermaid: false };
        const a = await addTurn('```tag\nx\n```', { customFences, plugins });
        expect(a.editor.options.customFences).toBe(customFences);
        expect(a.editor.options.plugins).toBe(plugins);
        expect(a.el.querySelector('.tag').textContent).toBe('x');
        a.editor.destroy();
    });

    test('a fence library registered by one editor is not known to another', async () => {
        const appended = [];
        jest.spyOn(document.head, 'appendChild').mockImplementation(node => {
            appended.push(node);
            if (node.tagName === 'SCRIPT') setTimeout(() => node.onload && node.onload(), 0);
            return node;
        });
        const el = document.createElement('div');
        document.getElementById('chat').appendChild(el);
        const a = new QuikdownEditor(el, { showToolbar: false, preloadFences: [{ name: 'mine', script: 'https://example.test/mine.js' }] });
        await a.initPromise;
        const b = await addTurn('b');
        expect(Object.keys(a._fenceLibraries)).toContain('__custom__:mine');
        expect(Object.keys(b.editor._fenceLibraries)).not.toContain('__custom__:mine');
        expect(appended.filter(n => n.tagName === 'SCRIPT').length).toBe(1);
        a.destroy();
        b.editor.destroy();
    });

    test('callbacks fire only for the editor that changed', async () => {
        const calls = { a: [], b: [] };
        const a = await addTurn('a', { onChange: md => calls.a.push(md), onRender: () => calls.a.push('render') });
        const b = await addTurn('b', { onChange: md => calls.b.push(md), onRender: () => calls.b.push('render') });
        calls.a.length = 0;
        calls.b.length = 0;
        await b.editor.setMarkdown('b2');
        expect(calls.a).toEqual([]);
        expect(calls.b).toEqual(['render', 'b2']);
        a.editor.destroy();
        b.editor.destroy();
    });
});

describe('keyboard and selection stay with the editor that has them', () => {
    test('undo and mode shortcuts act on one editor only (was page-wide)', async () => {
        const a = await addTurn('a1', { mode: 'split' });
        const b = await addTurn('b1', { mode: 'split' });
        await a.editor.setMarkdown('a2', { history: 'push' });
        await b.editor.setMarkdown('b2', { history: 'push' });

        key(a.editor.sourceTextarea, { key: 'z', ctrlKey: true });
        expect(a.editor.getMarkdown()).toBe('a1');
        expect(b.editor.getMarkdown()).toBe('b2');

        key(b.editor.previewPanel, { key: '1', metaKey: true });
        expect(b.editor.getMode()).toBe('source');
        expect(a.editor.getMode()).toBe('split');

        key(a.editor.sourceTextarea, { key: 'y', ctrlKey: true });
        expect(a.editor.getMarkdown()).toBe('a2');
        expect(b.editor.canRedo()).toBe(false);
        a.editor.destroy();
        b.editor.destroy();
    });

    test('a shortcut pressed in a plain input next to the editors is not swallowed', async () => {
        const a = await addTurn('a1', { mode: 'split' });
        await a.editor.setMarkdown('a2', { history: 'push' });
        const input = document.createElement('input');
        document.body.appendChild(input);
        const event = key(input, { key: 'z', metaKey: true });
        expect(event.defaultPrevented).toBe(false);
        expect(a.editor.getMarkdown()).toBe('a2');
        a.editor.destroy();
    });

    test('formatting applies to the editor that holds the selection', async () => {
        const a = await addTurn('first words');
        const b = await addTurn('second words');
        const node = b.el.querySelector('p').firstChild;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, 6);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.dispatchEvent(new Event('selectionchange'));

        key(b.editor.previewPanel, { key: 'b', metaKey: true });
        expect(b.editor.getMarkdown()).toBe('**second** words');
        expect(a.editor.getMarkdown()).toBe('first words');
        expect(a.editor.canUndo()).toBe(false);
        a.editor.destroy();
        b.editor.destroy();
    });

    test('a selection in one editor is reported by that editor only', async () => {
        const seen = { a: 0, b: 0 };
        const a = await addTurn('first words', { onSelectionChange: () => seen.a++ });
        const b = await addTurn('second words', { onSelectionChange: () => seen.b++ });
        const node = a.el.querySelector('p').firstChild;
        const range = document.createRange();
        range.setStart(node, 1);
        range.setEnd(node, 4);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        expect(seen).toEqual({ a: 1, b: 0 });
        expect(a.editor.getSelection().text).toBe('irs');
        expect(b.editor._savedRange).toBeNull();
        a.editor.destroy();
        b.editor.destroy();
    });
});

describe('destroy', () => {
    test('destroying turns in the middle leaves the others working', async () => {
        const turns = [];
        for (let i = 0; i < 5; i++) turns.push(await addTurn(`turn ${i}`, { mode: 'split' }));
        turns[1].editor.destroy();
        turns[3].editor.destroy();
        turns[1].el.remove();
        turns[3].el.remove();

        expect(document.querySelectorAll('.qde-container').length).toBe(3);
        expect(document.getElementById('qde-styles')).not.toBeNull();
        for (const i of [0, 2, 4]) {
            const { el, editor } = turns[i];
            await editor.setMarkdown(`# updated ${i}`);
            expect(el.querySelector('h1').textContent).toBe(`updated ${i}`);
            editor.setSelection(2, 9);
            editor.format('italic');
            expect(editor.getMarkdown()).toBe(`# *updated* ${i}`);
            key(editor.sourceTextarea, { key: 'z', ctrlKey: true });
            expect(editor.getMarkdown()).toBe(`# updated ${i}`);
        }
        [0, 2, 4].forEach(i => turns[i].editor.destroy());
        expect(document.getElementById('qde-styles')).toBeNull();
    });

    test('the shared stylesheet stays until the last editor is destroyed, and comes back for a new one', async () => {
        const a = await addTurn('a');
        const b = await addTurn('b');
        a.editor.destroy();
        expect(document.getElementById('qde-styles')).not.toBeNull();
        b.editor.destroy();
        expect(document.getElementById('qde-styles')).toBeNull();
        const c = await addTurn('c');
        expect(document.getElementById('qde-styles')).not.toBeNull();
        c.editor.destroy();
    });

    test('every listener added to the document and to media queries is removed', async () => {
        const doc = trackListeners(document);
        const before = doc.live.size;
        const turns = [];
        for (let i = 0; i < 4; i++) turns.push(await addTurn(`t${i}`, { theme: 'auto', mode: 'split' }));
        expect(doc.live.size).toBe(before + 4);
        expect([...doc.live.values()].every(type => type === 'selectionchange')).toBe(true);
        expect(mediaListeners.length).toBe(8); // per editor: portrait query + auto theme

        turns.forEach(t => t.editor.destroy());
        expect(doc.live.size).toBe(before);
        expect(mediaListeners.length).toBe(0);
        doc.restore();
    });

    test('no editor adds a keydown listener to the document', async () => {
        const doc = trackListeners(document);
        const a = await addTurn('a', { mode: 'split' });
        expect([...doc.live.values()]).not.toContain('keydown');
        a.editor.destroy();
        doc.restore();
    });

    test('switching theme repeatedly does not stack media listeners', async () => {
        const a = await addTurn('a', { theme: 'auto' });
        const base = mediaListeners.length;
        for (let i = 0; i < 5; i++) {
            a.editor.setTheme('dark');
            a.editor.setTheme('auto');
        }
        expect(mediaListeners.length).toBe(base);
        a.editor.setTheme('light');
        expect(mediaListeners.length).toBe(base - 1);
        a.editor.destroy();
        expect(mediaListeners.length).toBe(0);
    });

    test('a destroyed editor ignores keys, input, selection changes and timers', async () => {
        jest.useFakeTimers();
        const onChange = jest.fn();
        const onSelectionChange = jest.fn();
        const a = await addTurn('one', { mode: 'split', debounceDelay: 100, onChange, onSelectionChange });
        await a.editor.setMarkdown('two', { history: 'push' });
        const { sourceTextarea, previewPanel, container } = a.editor;

        sourceTextarea.value = 'typed just before destroy';
        sourceTextarea.dispatchEvent(new Event('input'));
        a.editor.destroy();
        onChange.mockClear();

        jest.advanceTimersByTime(5000);
        sourceTextarea.dispatchEvent(new Event('input'));
        previewPanel.dispatchEvent(new Event('input'));
        key(container, { key: 'z', ctrlKey: true });
        key(sourceTextarea, { key: 'b', ctrlKey: true });
        previewPanel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        document.dispatchEvent(new Event('selectionchange'));
        mediaListeners.forEach(fn => fn({ matches: true }));
        jest.advanceTimersByTime(5000);

        expect(onChange).not.toHaveBeenCalled();
        expect(onSelectionChange).not.toHaveBeenCalled();
        expect(a.editor.getMarkdown()).toBe('two');
        expect(jest.getTimerCount()).toBe(0);
    });

    test('API calls after destroy are harmless no-ops', async () => {
        const onChange = jest.fn();
        const a = await addTurn('text', { onChange });
        a.editor.destroy();
        onChange.mockClear();
        await a.editor.setMarkdown('after');
        a.editor.updateFromMarkdown('after');
        a.editor.updateFromHTML();
        a.editor.undo();
        a.editor.redo();
        a.editor.flush();
        a.editor.destroy();
        expect(onChange).not.toHaveBeenCalled();
        expect(a.editor.getMarkdown()).toBe('text');
        expect(a.editor.canUndo()).toBe(false);
        expect(a.el.innerHTML).toBe('');
        expect(a.el.className).toBe('turn');
    });

    test('toolbar feedback timers are cancelled', async () => {
        jest.useFakeTimers();
        const el = document.createElement('div');
        document.getElementById('chat').appendChild(el);
        const editor = new QuikdownEditor(el, { showRemoveHR: true, showLazyLinefeeds: true, mode: 'split' });
        await editor.initPromise;
        await editor.setMarkdown('a\n\n---\n\nb');
        await editor.removeHR();
        await editor.convertLazyLinefeeds();
        const btn = el.querySelector('[data-action="remove-hr"]');
        expect(btn.textContent).toBe('Removed!');
        expect(jest.getTimerCount()).toBeGreaterThan(0);
        editor.destroy();
        expect(jest.getTimerCount()).toBe(0);
        jest.advanceTimersByTime(5000);
        expect(btn.textContent).toBe('Removed!');
    });

    test('feedback timers that run normally restore the label and forget themselves', async () => {
        jest.useFakeTimers();
        const el = document.createElement('div');
        document.getElementById('chat').appendChild(el);
        const editor = new QuikdownEditor(el, { showRemoveHR: true, mode: 'split' });
        await editor.initPromise;
        await editor.setMarkdown('a\n\n---\n\nb');
        await editor.removeHR();
        const btn = el.querySelector('[data-action="remove-hr"]');
        jest.advanceTimersByTime(1500);
        expect(btn.textContent).toBe('Remove HR');
        expect(editor._timers.size).toBe(0);
        editor.destroy();
    });

    test('destroy while fence libraries are still loading builds nothing', async () => {
        let finishLoad;
        jest.spyOn(document.head, 'appendChild').mockImplementation(node => {
            if (node.tagName === 'SCRIPT') finishLoad = () => node.onload();
            return node;
        });
        const el = document.createElement('div');
        el.innerHTML = '<p>host content</p>';
        document.getElementById('chat').appendChild(el);
        const onChange = jest.fn();
        const editor = new QuikdownEditor(el, {
            preloadFences: [{ name: 'slow', script: 'https://example.test/slow.js' }],
            initialContent: '# never shown', onChange
        });
        editor.destroy();
        finishLoad();
        await editor.initPromise;
        await editor.setMarkdown('# late');

        expect(el.querySelector('.qde-editor')).toBeNull();
        expect(el.classList.contains('qde-container')).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
        expect(document.getElementById('qde-styles')).toBeNull();
    });

    test('destroy releases Leaflet maps created by geojson fences', async () => {
        const a = await addTurn('text');
        const remove = jest.fn();
        const failing = jest.fn(() => { throw new Error('already removed'); });
        a.editor.previewPanel.innerHTML = '<div id="map-1-container"></div><div id="map-2-container"></div><div id="other-container"></div>';
        const [m1, m2] = a.editor.previewPanel.children;
        m1._map = { remove };
        m2._map = { remove: failing };
        expect(() => a.editor.destroy()).not.toThrow();
        expect(remove).toHaveBeenCalledTimes(1);
        expect(failing).toHaveBeenCalledTimes(1);
        expect(m1._map).toBeNull();
    });
});

describe('create and destroy over time', () => {
    test('a container can be reused for a new editor after destroy', async () => {
        const first = await addTurn('first version', { mode: 'split' });
        first.editor.destroy();
        const second = new QuikdownEditor(first.el, { showToolbar: false, mode: 'preview' });
        await second.initPromise;
        await second.setMarkdown('second version');
        expect(first.el.querySelectorAll('.qde-editor').length).toBe(1);
        expect(first.el.querySelector('p').textContent).toBe('second version');
        expect(first.el.classList.contains('qde-mode-preview')).toBe(true);
        expect(first.el.classList.contains('qde-mode-split')).toBe(false);
        expect(first.editor.getMarkdown()).toBe('first version');
        second.destroy();
    });

    test('many create/destroy cycles leave no listeners, timers, styles or DOM behind', async () => {
        const doc = trackListeners(document);
        const before = doc.live.size;
        for (let i = 0; i < 40; i++) {
            const t = await addTurn(`cycle ${i}\n\n- a\n- b`, { theme: 'auto', mode: i % 2 ? 'split' : 'preview' });
            t.editor.setSelection(0, 5);
            t.editor.format('bold');
            t.editor.destroy();
            t.el.remove();
        }
        expect(doc.live.size).toBe(before);
        expect(mediaListeners.length).toBe(0);
        expect(document.getElementById('qde-styles')).toBeNull();
        expect(document.querySelectorAll('.qde-container, .qde-preview, .qde-textarea').length).toBe(0);
        expect(document.getElementById('chat').children.length).toBe(0);
        doc.restore();
    });

    test('a streaming last turn updates while earlier turns stay untouched', async () => {
        const renders = [0, 0, 0];
        const turns = [];
        for (let i = 0; i < 3; i++) {
            turns.push(await addTurn(`settled ${i}`, { onRender: () => renders[i]++ }));
        }
        const settled = turns.slice(0, 2).map(t => t.el.innerHTML);
        const base = renders.slice();
        const chunks = ['Here', ' is a **list**:\n\n', '- one\n', '- two\n\n', '```js\nlet x = 1;\n```\n'];
        let text = '';
        for (const chunk of chunks) {
            text += chunk;
            await turns[2].editor.setMarkdown(text);
        }
        expect(turns[2].el.querySelectorAll('li').length).toBe(2);
        expect(turns[2].el.querySelector('pre code').textContent).toBe('let x = 1;');
        expect(turns[2].editor.canUndo()).toBe(false);
        expect(renders[2] - base[2]).toBe(chunks.length);
        expect(renders.slice(0, 2)).toEqual(base.slice(0, 2));
        expect(turns.slice(0, 2).map(t => t.el.innerHTML)).toEqual(settled);
        turns.forEach(t => t.editor.destroy());
    });

    test('mixed mount modes on one page clean up independently', async () => {
        const frame = document.createElement('div');
        frame.innerHTML = '<span class="avatar">A</span>';
        document.getElementById('chat').appendChild(frame);
        const inner = new QuikdownEditor(frame, { showToolbar: false, mount: 'append', mode: 'preview' });
        await inner.initPromise;
        await inner.setMarkdown('appended');
        const other = await addTurn('replaced');

        other.editor.destroy();
        expect(frame.querySelector('.qde-container p').textContent).toBe('appended');
        inner.destroy();
        expect(frame.innerHTML).toBe('<span class="avatar">A</span>');
        expect(document.getElementById('qde-styles')).toBeNull();
    });

    test('two editors with toolbars keep their own buttons and feedback', async () => {
        const make = async () => {
            const el = document.createElement('div');
            document.getElementById('chat').appendChild(el);
            const editor = new QuikdownEditor(el, { showUndoRedo: true, mode: 'split' });
            await editor.initPromise;
            return { el, editor };
        };
        const a = await make();
        const b = await make();
        await a.editor.setMarkdown('a1');
        await a.editor.setMarkdown('a2', { history: 'push' });
        expect(a.el.querySelector('[data-action="undo"]').classList.contains('disabled')).toBe(false);
        expect(b.el.querySelector('[data-action="undo"]').classList.contains('disabled')).toBe(true);

        b.el.querySelector('[data-mode="source"]').click();
        expect(b.editor.getMode()).toBe('source');
        expect(a.editor.getMode()).toBe('split');
        expect(a.el.querySelector('[data-mode="split"]').classList.contains('active')).toBe(true);

        a.el.querySelector('[data-action="undo"]').click();
        expect(a.editor.getMarkdown()).toBe('a1');
        a.el.querySelector('[data-action="redo"]').click();
        expect(a.editor.getMarkdown()).toBe('a2');
        a.el.querySelector('.qde-toolbar').click(); // not on a button: ignored
        a.editor.destroy();
        b.editor.destroy();
    });
});
