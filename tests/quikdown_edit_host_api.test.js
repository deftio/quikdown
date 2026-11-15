/**
 * @jest-environment jsdom
 *
 * Editor API for hosts that run the editor headless and draw their own
 * controls (issues #39 and #41): selection and edits in either pane,
 * format(), keyboard shortcuts, events, history, scroll, line mapping,
 * image resolution, mount mode and theming variables.
 */
import QuikdownEditor from '../dist/quikdown_edit.esm.js';
import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false, media: query,
            addEventListener: jest.fn(), removeEventListener: jest.fn()
        })),
    });
});

const DOC = '# Title\n\nsome **bold** text\n\n- one\n- two\n\n```js\nlet x = 1;\n```\n\nlast [link text](http://x.y) here';

let host;
let ed;

async function make(options = {}, markdown = DOC) {
    ed = new QuikdownEditor(host, { showToolbar: false, mode: 'preview', ...options });
    await ed.initPromise;
    if (markdown !== null) await ed.setMarkdown(markdown);
    return ed;
}

/** Put the document selection inside the preview. */
function selectIn(startNode, startOffset, endNode = startNode, endOffset = startOffset) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
}

/** First text node under the first element matching a selector in the preview. */
function text(selector, index = 0) {
    const el = ed.previewPanel.querySelectorAll(selector)[index];
    const walker = document.createTreeWalker(el, 4);
    return walker.nextNode();
}

function key(target, init) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

function type(value) {
    ed.sourceTextarea.value = value;
    ed.sourceTextarea.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
    host = document.createElement('div');
    host.id = 'host';
    document.body.appendChild(host);
});

afterEach(() => {
    if (ed) ed.destroy();
    ed = null;
    window.getSelection().removeAllRanges();
    document.body.innerHTML = '';
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('getMode', () => {
    test('reports the current mode and follows setMode', async () => {
        await make({ mode: 'split' });
        expect(ed.getMode()).toBe('split');
        expect(ed.mode).toBe('split');
        ed.setMode('source');
        expect(ed.getMode()).toBe('source');
        ed.setMode('bogus');
        expect(ed.getMode()).toBe('source');
    });

    test('an invalid mode option falls back to split', async () => {
        await make({ mode: 'sideways' });
        expect(ed.getMode()).toBe('split');
        expect(host.classList.contains('qde-mode-split')).toBe(true);
    });
});

describe('selection in the source pane', () => {
    beforeEach(() => make({ mode: 'source' }, 'hello world'));

    test('getSelection reports offsets, text and pane', () => {
        ed.sourceTextarea.setSelectionRange(0, 5);
        expect(ed.getSelection()).toEqual({ start: 0, end: 5, text: 'hello', pane: 'source' });
        ed.sourceTextarea.setSelectionRange(3, 3);
        expect(ed.getSelection()).toEqual({ start: 3, end: 3, text: '', pane: 'source' });
    });

    test('setSelection clamps, orders and defaults to a caret', () => {
        expect(ed.setSelection(6, 11)).toEqual({ start: 6, end: 11 });
        expect(ed.getSelection().text).toBe('world');
        expect(ed.setSelection(99, -3)).toEqual({ start: 0, end: 11 });
        expect(ed.setSelection(4)).toEqual({ start: 4, end: 4 });
        expect(ed.sourceTextarea.selectionStart).toBe(4);
        expect(ed.setSelection('x', null)).toEqual({ start: 0, end: 0 });
    });

    test('insertText replaces the selection and leaves the caret after it', () => {
        ed.setSelection(0, 5);
        expect(ed.insertText('goodbye')).toEqual({ start: 7, end: 7 });
        expect(ed.getMarkdown()).toBe('goodbye world');
        expect(ed.sourceTextarea.value).toBe('goodbye world');
        ed.insertText('!');
        expect(ed.getMarkdown()).toBe('goodbye! world');
    });

    test('replaceRange can select what it inserted, and tolerates bad input', () => {
        expect(ed.replaceRange(6, 11, 'there', true)).toEqual({ start: 6, end: 11 });
        expect(ed.getSelection().text).toBe('there');
        ed.replaceRange(99, 5, null);
        expect(ed.getMarkdown()).toBe('hello');
        ed.replaceRange(0, 0, 42);
        expect(ed.getMarkdown()).toBe('42hello');
        ed.replaceRange(undefined, undefined, undefined);
        expect(ed.getMarkdown()).toBe('42hello');
    });

    test('programmatic edits are undoable one step at a time', () => {
        ed.setSelection(0, 5);
        ed.insertText('A');
        ed.insertText('B');
        expect(ed.getMarkdown()).toBe('AB world');
        ed.undo();
        expect(ed.getMarkdown()).toBe('A world');
        ed.undo();
        expect(ed.getMarkdown()).toBe('hello world');
        ed.redo();
        expect(ed.getMarkdown()).toBe('A world');
    });

    test('a stale textarea selection is clamped to the document', async () => {
        ed.sourceTextarea.value = 'a much longer text than the document';
        ed.sourceTextarea.setSelectionRange(30, 34);
        ed._markdown = 'short';
        expect(ed.getSelection()).toEqual({ start: 5, end: 5, text: '', pane: 'source' });
    });
});

describe('selection in the rendered pane', () => {
    beforeEach(() => make());

    test('a selection inside bold text maps to the text between the markers', () => {
        selectIn(text('strong'), 0, text('strong'), 4);
        const at = DOC.indexOf('bold');
        expect(ed.getSelection()).toEqual({ start: at, end: at + 4, text: 'bold', pane: 'preview' });
    });

    test('a caret in a list item, a heading and a code block', () => {
        selectIn(text('li', 1), 1);
        expect(ed.getSelection().start).toBe(DOC.indexOf('two') + 1);
        selectIn(text('h1'), 2);
        expect(ed.getSelection().start).toBe(DOC.indexOf('Title') + 2);
        selectIn(text('pre code'), 4);
        expect(ed.getSelection().start).toBe(DOC.indexOf('let x') + 4);
    });

    test('a selection across elements', () => {
        selectIn(text('p'), 2, text('li', 0), 2);
        const sel = ed.getSelection();
        expect(sel.start).toBe(DOC.indexOf('some') + 2);
        expect(sel.end).toBe(DOC.indexOf('one') + 2);
        expect(sel.text).toBe(DOC.slice(sel.start, sel.end));
    });

    test('boundary points given as element + child index', () => {
        const p = ed.previewPanel.querySelector('p');
        selectIn(p, 0, p, p.childNodes.length);
        expect(ed.getSelection().text).toBe('some **bold** text');
        selectIn(ed.previewPanel, 0);
        expect(ed.getSelection().start).toBe(0);
    });

    test('a selection inside link text', () => {
        const node = text('a');
        selectIn(node, 5, node, 9);
        expect(ed.getSelection().text).toBe('text');
        expect(ed.getSelection().start).toBe(DOC.indexOf('link text') + 5);
    });

    test('offsets refer to the editor markdown even when a round trip would reformat it', async () => {
        const md = '* star item\n\n\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\ntail paragraph\n';
        await ed.setMarkdown(md);
        const paragraphs = ed.previewPanel.querySelectorAll('p');
        const tail = paragraphs[paragraphs.length - 1].firstChild;
        selectIn(tail, 5, tail, 14);
        expect(ed.getSelection().text).toBe('paragraph');
        expect(ed.getSelection().start).toBe(md.indexOf('paragraph'));
        expect(ed.getMarkdown()).toBe(md);
    });

    test('with no selection in the preview, the source selection is used', () => {
        window.getSelection().removeAllRanges();
        ed.sourceTextarea.setSelectionRange(2, 4);
        expect(ed.getSelection()).toEqual({ start: 2, end: 4, text: DOC.slice(2, 4), pane: 'preview' });
    });

    test('the last preview selection is kept when the page selection moves away', () => {
        selectIn(text('strong'), 0, text('strong'), 4);
        const outside = document.createElement('p');
        outside.textContent = 'elsewhere';
        document.body.appendChild(outside);
        selectIn(outside.firstChild, 1, outside.firstChild, 3);
        expect(ed.getSelection().text).toBe('bold');
    });

    test('a selection inside a rendered fence with no editable text falls back', async () => {
        await ed.setMarkdown('intro\n\n```csv\na,b\n1,2\n```\n');
        const cell = ed.previewPanel.querySelector('td');
        selectIn(cell.firstChild, 0);
        const sel = ed.getSelection();
        expect(sel.pane).toBe('preview');
        expect(sel.start).toBeGreaterThanOrEqual(0);
        expect(sel.end).toBeLessThanOrEqual(ed.getMarkdown().length);
    });

    test('a selection inside a read-only rendered fence falls back to the source selection', async () => {
        ed.destroy();
        await make({ customFences: { box: () => '<div class="box" contenteditable="false"><span>generated</span></div>' } },
            'intro\n\n```box\nsource text\n```\n');
        ed.sourceTextarea.setSelectionRange(1, 3);
        selectIn(ed.previewPanel.querySelector('.box span').firstChild, 2, ed.previewPanel.querySelector('.box span').firstChild, 5);
        expect(ed.getSelection()).toEqual({ start: 1, end: 3, text: 'nt', pane: 'preview' });
    });

    test('setSelection selects the matching rendered text', () => {
        const at = DOC.indexOf('bold');
        ed.setSelection(at, at + 4);
        expect(window.getSelection().toString()).toBe('bold');
        expect(ed.getSelection()).toEqual({ start: at, end: at + 4, text: 'bold', pane: 'preview' });
    });

    test('setSelection across blocks and inside code', () => {
        ed.setSelection(DOC.indexOf('some'), DOC.indexOf('one') + 3);
        const range = window.getSelection().getRangeAt(0);
        expect(range.startContainer.data).toBe('some ');
        expect(range.endContainer.data).toBe('one');
        expect(range.endOffset).toBe(3);

        ed.setSelection(DOC.indexOf('x = 1'), DOC.indexOf('x = 1') + 1);
        expect(window.getSelection().toString()).toBe('x');
    });

    test('an offset in a block prefix lands at the start of that block text', () => {
        ed.setSelection(0);
        let range = window.getSelection().getRangeAt(0);
        expect(range.collapsed).toBe(true);
        expect(range.startContainer.data).toBe('Title');
        expect(range.startOffset).toBe(0);

        ed.setSelection(DOC.indexOf('- two'));
        range = window.getSelection().getRangeAt(0);
        expect(range.startContainer.data).toBe('two');
        expect(range.startOffset).toBe(0);
    });

    test('an offset between two inline elements resolves to the boundary', async () => {
        await ed.setMarkdown('**a***b*');
        ed.setSelection(5);
        const range = window.getSelection().getRangeAt(0);
        expect(ed.previewPanel.contains(range.startContainer)).toBe(true);
        expect(ed.getSelection().start).toBe(5);
    });

    test('an offset inside syntax falls back to the start of its block', () => {
        const inMarker = DOC.indexOf('**bold') + 1;
        ed.setSelection(inMarker);
        const range = window.getSelection().getRangeAt(0);
        expect(ed.previewPanel.contains(range.startContainer)).toBe(true);
        expect(range.startContainer.parentNode.closest('p')).toBe(ed.previewPanel.querySelector('p'));

        // inside a link target
        ed.setSelection(DOC.indexOf('http://x.y') + 3, DOC.indexOf('http://x.y') + 6);
        expect(ed.previewPanel.contains(window.getSelection().getRangeAt(0).startContainer)).toBe(true);
    });

    test('an offset on a fence line or in an empty document does not throw', async () => {
        ed.setSelection(DOC.indexOf('```js') + 1);
        expect(ed.previewPanel.contains(window.getSelection().getRangeAt(0).startContainer)).toBe(true);
        await ed.setMarkdown('');
        expect(ed.setSelection(0)).toEqual({ start: 0, end: 0 });
        expect(ed.previewPanel.contains(window.getSelection().getRangeAt(0).startContainer)).toBe(true);
    });

    test('setSelection after the user edited the preview re-renders it first', () => {
        text('h1').data = 'Changed';
        ed.previewPanel.dispatchEvent(new Event('input', { bubbles: true }));
        ed.flush();
        expect(ed.getMarkdown()).toContain('# Changed');
        const at = ed.getMarkdown().indexOf('bold');
        ed.setSelection(at, at + 4);
        expect(window.getSelection().toString()).toBe('bold');
    });

    test('the source pane carries the same selection for a later mode switch', () => {
        const at = DOC.indexOf('bold');
        ed.setSelection(at, at + 4);
        ed.setMode('source');
        expect(ed.getSelection()).toEqual({ start: at, end: at + 4, text: 'bold', pane: 'source' });
    });

    test('insertText at a preview caret, with markdown in the inserted text', () => {
        selectIn(text('p'), 4);
        const caret = ed.insertText(' *new*');
        expect(ed.getMarkdown()).toContain('some *new* **bold** text');
        expect(ed.previewPanel.querySelector('p em').textContent).toBe('new');
        expect(caret.start).toBe(DOC.indexOf('some') + 4 + 6);
        expect(ed.previewPanel.contains(window.getSelection().getRangeAt(0).startContainer)).toBe(true);
    });

    test('replaceRange with select in the preview selects the new rendered text', () => {
        const at = DOC.indexOf('Title');
        ed.replaceRange(at, at + 5, 'Heading', true);
        expect(ed.getMarkdown().startsWith('# Heading')).toBe(true);
        expect(window.getSelection().toString()).toBe('Heading');
    });
});

describe('pane tracking in split mode', () => {
    beforeEach(() => make({ mode: 'split' }));

    test('defaults to the source pane', () => {
        expect(ed.getFocusedPane()).toBeNull();
        expect(ed.getSelection().pane).toBe('source');
    });

    test('follows the pane the user last touched, even after focus moves to a host button', () => {
        selectIn(text('strong'), 0, text('strong'), 4);
        ed.previewPanel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();
        expect(ed.getFocusedPane()).toBeNull();
        expect(ed.getSelection()).toMatchObject({ text: 'bold', pane: 'preview' });

        ed.sourceTextarea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        ed.sourceTextarea.setSelectionRange(2, 7);
        expect(ed.getSelection()).toMatchObject({ text: 'Title', pane: 'source' });
    });

    test('focus wins over the last touched pane', () => {
        ed.previewPanel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        ed.sourceTextarea.focus();
        expect(ed.getFocusedPane()).toBe('source');
        expect(ed.getSelection().pane).toBe('source');
    });

    test('a selection change inside the preview marks it as the working pane', () => {
        selectIn(text('li', 0), 1);
        expect(ed.getSelection().pane).toBe('preview');
    });

    test('a preview selection does not steal the pane while the textarea has focus', () => {
        ed.sourceTextarea.focus();
        selectIn(text('li', 0), 1);
        expect(ed.getSelection().pane).toBe('source');
    });

    test('an explicit pane argument overrides the working pane', () => {
        const at = DOC.indexOf('bold');
        ed.setSelection(at, at + 4, 'preview');
        expect(window.getSelection().toString()).toBe('bold');
        window.getSelection().removeAllRanges();
        ed.setSelection(at, at + 4, 'source');
        expect(window.getSelection().rangeCount).toBe(0);
        expect(ed.sourceTextarea.selectionStart).toBe(at);
    });

    test('setSelection for the preview is skipped while the preview is hidden', () => {
        ed.setMode('source');
        window.getSelection().removeAllRanges();
        expect(ed.setSelection(2, 4, 'preview')).toEqual({ start: 2, end: 4 });
        expect(window.getSelection().rangeCount).toBe(0);
    });
});

describe('focus', () => {
    test('focuses the requested pane and reports it', async () => {
        await make({ mode: 'split' });
        ed.previewPanel.tabIndex = 0; // jsdom does not treat contenteditable as focusable
        ed.focus('source');
        expect(ed.getFocusedPane()).toBe('source');
        ed.focus('preview');
        expect(ed.getFocusedPane()).toBe('preview');
        expect(ed.getSelection().pane).toBe('preview');
        ed.focus();
        expect(ed.getFocusedPane()).toBe('preview');
    });

    test('a pane hidden by the mode falls back to the visible one', async () => {
        await make({ mode: 'source' });
        ed.previewPanel.tabIndex = 0;
        ed.focus('preview');
        expect(ed.getFocusedPane()).toBe('source');
        ed.setMode('preview');
        ed.focus('source');
        expect(ed.getFocusedPane()).toBe('preview');
    });

    test('focusing the preview restores its last selection', async () => {
        await make({ mode: 'split' });
        ed.previewPanel.tabIndex = 0;
        selectIn(text('strong'), 1, text('strong'), 3);
        window.getSelection().removeAllRanges();
        ed.focus('preview');
        expect(window.getSelection().toString()).toBe('ol');
    });

    test('focus inside a child of the preview counts as the preview', async () => {
        await make({ mode: 'split' }, '[a link](http://x.y)');
        ed.previewPanel.querySelector('a').focus();
        expect(ed.getFocusedPane()).toBe('preview');
    });
});

describe('format()', () => {
    test('source pane: toggles bold on the selection and keeps it selected', async () => {
        await make({ mode: 'source' }, 'plain words here');
        ed.setSelection(6, 11);
        expect(ed.format('bold')).toBe(true);
        expect(ed.getMarkdown()).toBe('plain **words** here');
        expect(ed.getSelection().text).toBe('words');
        ed.format('bold');
        expect(ed.getMarkdown()).toBe('plain words here');
    });

    test('rendered pane: bold, then italic, then both off, selection kept on the same text', async () => {
        await make();
        selectIn(text('p'), 0, text('p'), 4);
        ed.format('bold');
        expect(ed.getMarkdown()).toContain('**some** **bold** text');
        expect(window.getSelection().toString()).toBe('some');
        expect(ed.previewPanel.querySelector('p strong').textContent).toBe('some');

        ed.format('italic');
        expect(ed.getMarkdown()).toContain('***some*** **bold** text');
        expect(window.getSelection().toString()).toBe('some');

        ed.format('italic');
        ed.format('bold');
        expect(ed.getMarkdown()).toBe(DOC);
        expect(window.getSelection().toString()).toBe('some');
    });

    test('rendered pane: selecting all of a bold word and pressing bold removes it', async () => {
        await make();
        selectIn(text('strong'), 0, text('strong'), 4);
        ed.format('bold');
        expect(ed.getMarkdown()).toContain('some bold text');
        expect(ed.previewPanel.querySelector('p strong')).toBeNull();
    });

    test('rendered pane: formatting inside link text keeps the link', async () => {
        await make();
        const node = text('a');
        selectIn(node, 5, node, 9);
        ed.format('italic');
        expect(ed.getMarkdown()).toContain('[link *text*](http://x.y)');
        expect(ed.previewPanel.querySelector('a em').textContent).toBe('text');
    });

    test('rendered pane: block commands act on the line under the caret', async () => {
        await make();
        selectIn(text('p'), 2);
        ed.format('h2');
        expect(ed.getMarkdown()).toContain('## some **bold** text');
        expect(ed.previewPanel.querySelector('h2')).not.toBeNull();
        ed.format('quote');
        expect(ed.getMarkdown()).toContain('> ## some **bold** text');
    });

    test('commands with values: link, heading, codeblock, table', async () => {
        await make({ mode: 'source' }, 'word');
        ed.setSelection(0, 4);
        ed.format('link', 'https://x.y');
        expect(ed.getMarkdown()).toBe('[word](https://x.y)');
        ed.format('link', null);
        expect(ed.getMarkdown()).toBe('word');
        ed.format('heading', 3);
        expect(ed.getMarkdown()).toBe('### word');
        ed.format('paragraph');
        ed.format('codeblock', 'txt');
        expect(ed.getMarkdown()).toBe('```txt\nword\n```');
        await ed.setMarkdown('');
        ed.format('table', { rows: 1, cols: 2 });
        expect(ed.getMarkdown()).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|   |   |\n');
        expect(ed.getSelection().text).toBe('Column 1');
    });

    test('an unknown command returns false and changes nothing', async () => {
        const onChange = jest.fn();
        await make({ mode: 'source', onChange }, 'text');
        onChange.mockClear();
        expect(ed.format('sparkle')).toBe(false);
        expect(ed.getMarkdown()).toBe('text');
        expect(onChange).not.toHaveBeenCalled();
    });

    test('a command that changes only the selection does not report a change', async () => {
        const onChange = jest.fn();
        await make({ mode: 'source', onChange }, 'a [text](http://u) b');
        onChange.mockClear();
        ed.setSelection(5);
        expect(ed.format('link')).toBe(true);
        expect(ed.getSelection().text).toBe('text');
        expect(onChange).not.toHaveBeenCalled();
        expect(ed.canUndo()).toBe(false);
    });

    test('each format is one undo step and reports source "format"', async () => {
        const onChange = jest.fn();
        await make({ mode: 'source', onChange }, 'word');
        onChange.mockClear();
        ed.setSelection(0, 4);
        ed.format('bold');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith('**word**', expect.any(String), { source: 'format' });
        ed.undo();
        expect(ed.getMarkdown()).toBe('word');
    });

    test('getFormatState follows the selection in either pane', async () => {
        await make();
        selectIn(text('strong'), 2);
        expect(ed.getFormatState()).toMatchObject({ bold: true, italic: false, heading: 0, list: null });
        selectIn(text('h1'), 1);
        expect(ed.getFormatState()).toMatchObject({ heading: 1, bold: false });
        selectIn(text('li', 1), 1);
        expect(ed.getFormatState()).toMatchObject({ list: 'ul' });
        selectIn(text('a'), 2);
        expect(ed.getFormatState()).toMatchObject({ link: true });
        ed.setMode('source');
        ed.setSelection(DOC.indexOf('let x'));
        expect(ed.getFormatState()).toMatchObject({ codeblock: true });
    });

    test('scroll positions survive a format', async () => {
        await make({ mode: 'split' }, 'one two');
        ed.sourceTextarea.scrollTop = 40;
        ed.previewPanel.scrollTop = 25;
        ed.setSelection(0, 3, 'source');
        ed.format('bold');
        expect(ed.getScroll()).toEqual({ source: 40, preview: 25 });
    });
});

describe('keyboard shortcuts', () => {
    test('Ctrl+B and Cmd+I format the source selection and cancel the browser default', async () => {
        await make({ mode: 'source' }, 'word');
        ed.setSelection(0, 4);
        const b = key(ed.sourceTextarea, { key: 'b', ctrlKey: true });
        expect(b.defaultPrevented).toBe(true);
        expect(ed.getMarkdown()).toBe('**word**');
        const i = key(ed.sourceTextarea, { key: 'I', metaKey: true });
        expect(i.defaultPrevented).toBe(true);
        expect(ed.getMarkdown()).toBe('***word***');
    });

    test('Cmd+B and Cmd+I work in the rendered pane (the WebKit case from #39)', async () => {
        await make();
        selectIn(text('p'), 0, text('p'), 4);
        const b = key(ed.previewPanel, { key: 'b', metaKey: true });
        expect(b.defaultPrevented).toBe(true);
        expect(ed.getMarkdown()).toContain('**some**');
        key(ed.previewPanel, { key: 'i', metaKey: true });
        expect(ed.getMarkdown()).toContain('***some***');
        expect(ed.sourceTextarea.value).toBe(ed.getMarkdown());
    });

    test('Shift and Alt variants are left to the browser', async () => {
        await make({ mode: 'source' }, 'word');
        ed.setSelection(0, 4);
        expect(key(ed.sourceTextarea, { key: 'B', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: 'I', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: 'b', ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: 'b' }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: 'q', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(ed.getMarkdown()).toBe('word');
    });

    test('Tab and Shift+Tab indent and outdent a list item in the source pane', async () => {
        await make({ mode: 'source' }, '- one\n- two');
        ed.setSelection(9);
        const tab = key(ed.sourceTextarea, { key: 'Tab' });
        expect(tab.defaultPrevented).toBe(true);
        expect(ed.getMarkdown()).toBe('- one\n  - two');
        key(ed.sourceTextarea, { key: 'Tab', shiftKey: true });
        expect(ed.getMarkdown()).toBe('- one\n- two');
    });

    test('Tab indents a list item in the rendered pane and nests it', async () => {
        await make();
        selectIn(text('li', 1), 1);
        key(ed.previewPanel, { key: 'Tab' });
        expect(ed.getMarkdown()).toContain('- one\n  - two');
        expect(ed.previewPanel.querySelector('ul ul li').textContent).toBe('two');
        selectIn(text('ul ul li'), 1);
        key(ed.previewPanel, { key: 'Tab', shiftKey: true });
        expect(ed.getMarkdown()).toContain('- one\n- two');
    });

    test('Tab outside a list keeps its normal meaning', async () => {
        await make({ mode: 'source' }, 'paragraph');
        ed.setSelection(3);
        expect(key(ed.sourceTextarea, { key: 'Tab' }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: 'Tab', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: 'Tab', altKey: true }).defaultPrevented).toBe(false);
        expect(ed.getMarkdown()).toBe('paragraph');
    });

    test('mode and history shortcuts work from either pane', async () => {
        await make({ mode: 'split' }, 'one');
        await ed.setMarkdown('two', { history: 'push' });
        key(ed.previewPanel, { key: 'z', metaKey: true });
        expect(ed.getMarkdown()).toBe('one');
        key(ed.sourceTextarea, { key: 'Z', metaKey: true, shiftKey: true });
        expect(ed.getMarkdown()).toBe('two');
        key(ed.sourceTextarea, { key: 'z', ctrlKey: true });
        key(ed.sourceTextarea, { key: 'y', ctrlKey: true });
        expect(ed.getMarkdown()).toBe('two');
        key(ed.sourceTextarea, { key: '1', ctrlKey: true });
        expect(ed.getMode()).toBe('source');
        key(ed.sourceTextarea, { key: '3', ctrlKey: true });
        expect(ed.getMode()).toBe('preview');
        key(ed.previewPanel, { key: '2', ctrlKey: true });
        expect(ed.getMode()).toBe('split');
    });

    test('keys pressed elsewhere on the page are not handled', async () => {
        await make({ mode: 'split' }, 'one');
        await ed.setMarkdown('two', { history: 'push' });
        const other = document.createElement('textarea');
        document.body.appendChild(other);
        expect(key(other, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(key(document.body, { key: '1', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(key(document, { key: 'b', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(ed.getMarkdown()).toBe('two');
        expect(ed.getMode()).toBe('split');
    });

    test('shortcuts: false turns all of them off', async () => {
        await make({ mode: 'source', shortcuts: false }, 'word');
        ed.setSelection(0, 4);
        expect(key(ed.sourceTextarea, { key: 'b', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(key(ed.sourceTextarea, { key: '3', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(ed.getMarkdown()).toBe('word');
        expect(ed.getMode()).toBe('source');
        expect(ed.format('bold')).toBe(true); // the API still works
    });
});

describe('events', () => {
    test('onChange meta.source names where each change came from', async () => {
        const sources = [];
        await make({ mode: 'source', debounceDelay: 0, onChange: (md, html, meta) => sources.push(meta.source) }, null);
        await ed.setMarkdown('one');
        type('one two');
        ed.flush();
        ed.setSelection(0, 3);
        ed.format('bold');
        ed.insertText('x');
        ed.undo();
        ed.redo();
        await ed.setMarkdown('loaded', { source: 'load' });
        ed.setLazyLinefeeds(true);
        expect(sources).toEqual(['api', 'user', 'format', 'edit', 'undo', 'redo', 'load', 'api']);
    });

    test('an edit typed in the rendered pane reports source "user"', async () => {
        const onChange = jest.fn();
        await make({ onChange });
        onChange.mockClear();
        text('h1').data = 'Edited';
        ed.previewPanel.dispatchEvent(new Event('input', { bubbles: true }));
        ed.flush();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toContain('# Edited');
        expect(onChange.mock.calls[0][2]).toEqual({ source: 'user' });
    });

    test('initialContent reports source "api"', async () => {
        const onChange = jest.fn();
        ed = new QuikdownEditor(host, { showToolbar: false, initialContent: '# hi', onChange });
        await ed.initPromise;
        expect(onChange).toHaveBeenCalledWith('# hi', expect.stringContaining('<h1'), { source: 'api' });
    });

    test('onRender fires after every preview render with the preview element', async () => {
        const onRender = jest.fn();
        await make({ onRender }, null);
        await ed.setMarkdown('# one');
        expect(onRender).toHaveBeenCalledTimes(1);
        expect(onRender).toHaveBeenLastCalledWith(ed.previewPanel);
        expect(onRender.mock.calls[0][0].querySelector('h1').textContent).toBe('one');
        await ed.setMarkdown('');
        expect(onRender).toHaveBeenCalledTimes(2);
    });

    test('onRender does not fire while the preview is hidden, and fires when it is shown', async () => {
        const onRender = jest.fn();
        await make({ mode: 'source', onRender }, '# one');
        expect(onRender).not.toHaveBeenCalled();
        ed.setMode('split');
        expect(onRender).toHaveBeenCalledTimes(1);
        expect(ed.previewPanel.querySelector('h1')).not.toBeNull();
        ed.setMode('preview');
        expect(onRender).toHaveBeenCalledTimes(1);
    });

    test('onSelectionChange reports the selection with its format state, once per change', async () => {
        const onSelectionChange = jest.fn();
        await make({ onSelectionChange });
        selectIn(text('strong'), 1, text('strong'), 3);
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
        expect(onSelectionChange).toHaveBeenLastCalledWith({
            start: DOC.indexOf('bold') + 1, end: DOC.indexOf('bold') + 3, text: 'ol', pane: 'preview',
            format: expect.objectContaining({ bold: true, heading: 0 })
        });
        document.dispatchEvent(new Event('selectionchange'));
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
        selectIn(text('h1'), 0);
        expect(onSelectionChange).toHaveBeenCalledTimes(2);
        expect(onSelectionChange.mock.calls[1][0].format.heading).toBe(1);
    });

    test('onSelectionChange follows the textarea caret', async () => {
        const onSelectionChange = jest.fn();
        await make({ mode: 'source', onSelectionChange }, '# head\n\nbody');
        ed.sourceTextarea.focus();
        ed.sourceTextarea.setSelectionRange(3, 3);
        ed.sourceTextarea.dispatchEvent(new Event('keyup', { bubbles: true }));
        expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ start: 3, end: 3, pane: 'source' }));
        expect(onSelectionChange.mock.calls.pop()[0].format.heading).toBe(1);
        ed.sourceTextarea.setSelectionRange(9, 11);
        ed.sourceTextarea.dispatchEvent(new Event('mouseup', { bubbles: true }));
        expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ start: 9, end: 11, text: 'od' }));
        ed.sourceTextarea.setSelectionRange(0, 6);
        ed.sourceTextarea.dispatchEvent(new Event('select', { bubbles: true }));
        expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ text: '# head' }));
    });

    test('onSelectionChange ignores selections elsewhere on the page and waits out pending edits', async () => {
        const onSelectionChange = jest.fn();
        await make({ mode: 'source', debounceDelay: 50, onSelectionChange }, 'text');
        const outside = document.createElement('p');
        outside.textContent = 'elsewhere';
        document.body.appendChild(outside);
        selectIn(outside.firstChild, 1, outside.firstChild, 4);
        expect(onSelectionChange).not.toHaveBeenCalled();

        ed.sourceTextarea.focus();
        type('text more');
        ed.sourceTextarea.setSelectionRange(9, 9);
        ed.sourceTextarea.dispatchEvent(new Event('keyup', { bubbles: true }));
        expect(onSelectionChange).not.toHaveBeenCalled();
        expect(ed._markdown).toBe('text');
        ed.flush();
        ed.sourceTextarea.dispatchEvent(new Event('keyup', { bubbles: true }));
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
        expect(onSelectionChange.mock.calls[0][0].start).toBe(9);
    });

    test('a change at the same offsets is reported again after the document changes', async () => {
        const onSelectionChange = jest.fn();
        await make({ mode: 'source', onSelectionChange }, 'abcdef');
        ed.sourceTextarea.focus();
        ed.sourceTextarea.setSelectionRange(2, 2);
        ed.sourceTextarea.dispatchEvent(new Event('keyup'));
        await ed.setMarkdown('ABCDEF');
        ed.sourceTextarea.setSelectionRange(2, 2);
        ed.sourceTextarea.dispatchEvent(new Event('keyup'));
        expect(onSelectionChange).toHaveBeenCalledTimes(2);
    });

    test('onLinkClick receives the href and cancels navigation unless it returns true', async () => {
        const onLinkClick = jest.fn();
        await make({ onLinkClick });
        const link = ed.previewPanel.querySelector('a');
        let click = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(click);
        expect(onLinkClick).toHaveBeenCalledWith('http://x.y', click);
        expect(click.defaultPrevented).toBe(true);

        onLinkClick.mockReturnValue(true);
        click = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.firstChild.parentNode.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
    });

    test('onLinkClick fires for a click on an element inside the link, and not for other clicks', async () => {
        const onLinkClick = jest.fn();
        await make({ onLinkClick }, '[**bold link**](rel/path.md) and text');
        ed.previewPanel.querySelector('a strong').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(onLinkClick).toHaveBeenCalledWith('rel/path.md', expect.any(MouseEvent));
        onLinkClick.mockClear();
        ed.previewPanel.querySelector('p').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        ed.previewPanel.querySelector('p').lastChild.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(onLinkClick).not.toHaveBeenCalled();
    });

    test('without onLinkClick, clicks are left alone', async () => {
        await make();
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        ed.previewPanel.querySelector('a').dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
    });
});

describe('flush', () => {
    test('getMarkdown and getHTML include text typed within the debounce window', async () => {
        jest.useFakeTimers();
        const onChange = jest.fn();
        ed = new QuikdownEditor(host, { showToolbar: false, mode: 'split', debounceDelay: 500, onChange });
        await ed.initPromise;
        type('# typed');
        expect(onChange).not.toHaveBeenCalled();
        expect(ed.getMarkdown()).toBe('# typed');
        expect(ed.getHTML()).toContain('<h1');
        expect(onChange).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    test('a pending preview edit is applied by flush()', async () => {
        jest.useFakeTimers();
        await make({ debounceDelay: 500 });
        text('h1').data = 'Fresh';
        ed.previewPanel.dispatchEvent(new Event('input', { bubbles: true }));
        expect(ed._markdown).toContain('# Title');
        ed.flush();
        expect(ed.getMarkdown()).toContain('# Fresh');
        ed.flush(); // nothing pending: no-op
        expect(ed.getMarkdown()).toContain('# Fresh');
    });

    test('the debounce still applies the edit on its own', async () => {
        jest.useFakeTimers();
        await make({ mode: 'source', debounceDelay: 30 }, 'a');
        type('ab');
        expect(ed._markdown).toBe('a');
        jest.advanceTimersByTime(30);
        expect(ed._markdown).toBe('ab');
    });

    test('switching mode, undo and copy see pending text', async () => {
        jest.useFakeTimers();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true, writable: true,
            value: { writeText: jest.fn().mockResolvedValue(undefined) }
        });
        await make({ mode: 'source', debounceDelay: 500 }, 'a');
        type('ab');
        ed.setMode('split');
        expect(ed.previewPanel.textContent).toBe('ab');
        type('abc');
        ed.undo();
        expect(ed.getMarkdown()).toBe('ab');
        type('abcd');
        await ed.copy('markdown');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abcd');
        type('abcde');
        expect(ed.getHistory().undo.pop()).toBe('abcd');
    });

    test('setMarkdown discards a pending edit instead of applying it afterwards', async () => {
        jest.useFakeTimers();
        await make({ mode: 'source', debounceDelay: 500 }, 'a');
        type('typed but replaced');
        await ed.setMarkdown('loaded');
        jest.advanceTimersByTime(1000);
        expect(ed.getMarkdown()).toBe('loaded');
    });
});

describe('copy without a toolbar', () => {
    test('copies and does not log a failure', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText } });
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        await make({ mode: 'source' }, '# x');
        await ed.copy('markdown');
        await ed.copy('html');
        expect(writeText).toHaveBeenNthCalledWith(1, '# x');
        expect(writeText.mock.calls[1][0]).toContain('<h1');
        expect(error).not.toHaveBeenCalled();
    });
});

describe('history', () => {
    test('setMarkdown keeps history by default, and can reset it or push a step', async () => {
        await make({ mode: 'source' }, 'one');
        ed.replaceRange(3, 3, ' two');
        expect(ed.getHistory()).toEqual({ undo: ['one'], redo: [] });

        await ed.setMarkdown('other');
        expect(ed.getHistory().undo).toEqual(['one']);

        await ed.setMarkdown('third', { history: 'push' });
        expect(ed.getHistory().undo).toEqual(['one', 'other']);
        ed.undo();
        expect(ed.getMarkdown()).toBe('other');
        expect(ed.canRedo()).toBe(true);

        await ed.setMarkdown('fresh', { history: 'reset' });
        expect(ed.getHistory()).toEqual({ undo: [], redo: [] });
        expect(ed.canUndo()).toBe(false);
        expect(ed.canRedo()).toBe(false);
    });

    test('getHistory returns copies', async () => {
        await make({ mode: 'source' }, 'one');
        ed.replaceRange(0, 0, 'x');
        const h = ed.getHistory();
        h.undo.push('tampered');
        h.redo.push('tampered');
        expect(ed.getHistory()).toEqual({ undo: ['one'], redo: [] });
    });

    test('one undo stack per document when a host switches tabs', async () => {
        await make({ mode: 'source' }, null);
        const tabs = { a: { text: 'doc A', history: null }, b: { text: 'doc B', history: null } };
        const open = async (name, from) => {
            if (from) {
                tabs[from].text = ed.getMarkdown();
                tabs[from].history = ed.getHistory();
            }
            await ed.setMarkdown(tabs[name].text, { history: 'reset' });
            ed.setHistory(tabs[name].history);
        };
        await open('a');
        ed.replaceRange(5, 5, ' edited');
        await open('b', 'a');
        expect(ed.canUndo()).toBe(false);
        ed.undo();
        expect(ed.getMarkdown()).toBe('doc B');
        ed.replaceRange(5, 5, ' changed');
        ed.replaceRange(0, 0, '> ');
        ed.undo();
        await open('a', 'b');
        expect(ed.getMarkdown()).toBe('doc A edited');
        ed.undo();
        expect(ed.getMarkdown()).toBe('doc A');
        ed.redo();
        await open('b', 'a');
        expect(ed.getMarkdown()).toBe('doc B changed');
        ed.redo();
        expect(ed.getMarkdown()).toBe('> doc B changed');
        ed.undo();
        ed.undo();
        expect(ed.getMarkdown()).toBe('doc B');
    });

    test('setHistory ignores invalid input and respects undoStackSize', async () => {
        await make({ mode: 'source', undoStackSize: 3 }, 'x');
        ed.setHistory({ undo: ['a', 1, null, 'b', 'c', 'd'], redo: 'nope' });
        expect(ed.getHistory()).toEqual({ undo: ['b', 'c', 'd'], redo: [] });
        ed.setHistory(null);
        expect(ed.getHistory()).toEqual({ undo: [], redo: [] });
        ed.setHistory({});
        expect(ed.getHistory()).toEqual({ undo: [], redo: [] });
        ed.setHistory({ redo: ['r'] });
        expect(ed.canRedo()).toBe(true);
        ed.redo();
        expect(ed.getMarkdown()).toBe('r');
    });

    test('setHistory falls back to 100 entries when undoStackSize is 0', async () => {
        await make({ mode: 'source', undoStackSize: 0 }, 'x');
        ed.setHistory({ undo: Array.from({ length: 150 }, (_, i) => `s${i}`) });
        expect(ed.getHistory().undo.length).toBe(100);
        expect(ed.getHistory().undo[0]).toBe('s50');
    });

    test('toolbar undo/redo buttons follow history set through the API', async () => {
        ed = new QuikdownEditor(host, { showUndoRedo: true, mode: 'source' });
        await ed.initPromise;
        await ed.setMarkdown('x');
        const undoBtn = host.querySelector('[data-action="undo"]');
        const redoBtn = host.querySelector('[data-action="redo"]');
        expect(undoBtn.classList.contains('disabled')).toBe(true);
        ed.setHistory({ undo: ['a'], redo: ['b'] });
        expect(undoBtn.classList.contains('disabled')).toBe(false);
        expect(redoBtn.classList.contains('disabled')).toBe(false);
        ed.clearHistory();
        expect(undoBtn.classList.contains('disabled')).toBe(true);
        await ed.setMarkdown('y', { history: 'push' });
        expect(undoBtn.classList.contains('disabled')).toBe(false);
    });

    test('setMarkdown converts null, undefined and non-strings', async () => {
        await make({ mode: 'source' }, 'x');
        await ed.setMarkdown(null);
        expect(ed.getMarkdown()).toBe('');
        await ed.setMarkdown(undefined);
        expect(ed.getMarkdown()).toBe('');
        await ed.setMarkdown(12345);
        expect(ed.getMarkdown()).toBe('12345');
        expect(ed.sourceTextarea.value).toBe('12345');
    });

    test('the markdown setter still works', async () => {
        await make({ mode: 'source' }, 'x');
        ed.markdown = '# set';
        await Promise.resolve();
        await Promise.resolve();
        expect(ed.markdown).toBe('# set');
        expect(ed.html).toContain('<h1');
    });
});

describe('preview-only editing keeps the source in step', () => {
    test('text edited in preview mode shows in the source after a mode switch', async () => {
        await make({ mode: 'preview' });
        text('h1').data = 'Renamed';
        ed.previewPanel.dispatchEvent(new Event('input', { bubbles: true }));
        ed.setMode('source');
        expect(ed.sourceTextarea.value).toContain('# Renamed');
        expect(ed.sourceTextarea.value).toBe(ed.getMarkdown());
    });
});

describe('scroll', () => {
    function sized(el, scrollHeight, clientHeight) {
        Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
        Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
    }

    test('getScroll and setScroll round-trip both panes; partial and invalid values are ignored', async () => {
        await make({ mode: 'split' });
        ed.setScroll({ source: 120, preview: 80 });
        expect(ed.getScroll()).toEqual({ source: 120, preview: 80 });
        ed.setScroll({ preview: 10 });
        expect(ed.getScroll()).toEqual({ source: 120, preview: 10 });
        ed.setScroll({ source: 'x', preview: NaN });
        ed.setScroll(null);
        ed.setScroll();
        expect(ed.getScroll()).toEqual({ source: 120, preview: 10 });
    });

    test('syncScroll mirrors the relative position in both directions without echoing', async () => {
        await make({ mode: 'split', syncScroll: true });
        sized(ed.sourceTextarea, 1100, 100);
        sized(ed.previewPanel, 2100, 100);

        ed.sourceTextarea.scrollTop = 500;
        ed.sourceTextarea.dispatchEvent(new Event('scroll'));
        expect(ed.previewPanel.scrollTop).toBe(1000);

        // the scroll event our own write causes must not bounce back
        ed.sourceTextarea.scrollTop = 501;
        ed.previewPanel.dispatchEvent(new Event('scroll'));
        expect(ed.sourceTextarea.scrollTop).toBe(501);

        ed.previewPanel.scrollTop = 2000;
        ed.previewPanel.dispatchEvent(new Event('scroll'));
        expect(ed.sourceTextarea.scrollTop).toBe(1000);
    });

    test('syncScroll does nothing when already aligned, when a pane cannot scroll, or outside split mode', async () => {
        await make({ mode: 'split', syncScroll: true });
        sized(ed.sourceTextarea, 1100, 100);
        sized(ed.previewPanel, 2100, 100);
        ed.sourceTextarea.scrollTop = 500;
        ed.previewPanel.scrollTop = 1000;
        ed.sourceTextarea.dispatchEvent(new Event('scroll'));
        expect(ed.previewPanel.scrollTop).toBe(1000);

        sized(ed.sourceTextarea, 100, 100);
        ed.sourceTextarea.dispatchEvent(new Event('scroll'));
        expect(ed.previewPanel.scrollTop).toBe(0);

        sized(ed.sourceTextarea, 1100, 100);
        sized(ed.previewPanel, 100, 100);
        ed.previewPanel.scrollTop = 0;
        ed.sourceTextarea.scrollTop = 700;
        ed.sourceTextarea.dispatchEvent(new Event('scroll'));
        expect(ed.previewPanel.scrollTop).toBe(0);

        sized(ed.previewPanel, 2100, 100);
        ed.setMode('preview');
        ed.previewPanel.scrollTop = 900;
        ed.previewPanel.dispatchEvent(new Event('scroll'));
        expect(ed.sourceTextarea.scrollTop).toBe(700);
    });

    test('syncScroll is off by default, and setScroll is not treated as an echo', async () => {
        await make({ mode: 'split' });
        sized(ed.sourceTextarea, 1100, 100);
        sized(ed.previewPanel, 2100, 100);
        ed.sourceTextarea.scrollTop = 500;
        ed.sourceTextarea.dispatchEvent(new Event('scroll'));
        expect(ed.previewPanel.scrollTop).toBe(0);

        ed.options.syncScroll = true;
        ed.sourceTextarea.dispatchEvent(new Event('scroll'));
        expect(ed.previewPanel.scrollTop).toBe(1000);
        ed.setScroll({ preview: 400 });
        ed.previewPanel.dispatchEvent(new Event('scroll'));
        expect(ed.sourceTextarea.scrollTop).toBe(200);
    });
});

describe('line mapping', () => {
    const lineOfText = (md, needle) => md.slice(0, md.indexOf(needle)).split('\n').length - 1;

    test('lineOf returns the zero-based source line of rendered elements', async () => {
        await make();
        const q = (s, i = 0) => ed.previewPanel.querySelectorAll(s)[i];
        expect(ed.lineOf(q('h1'))).toBe(0);
        expect(ed.lineOf(q('p'))).toBe(2);
        expect(ed.lineOf(q('strong'))).toBe(2);
        expect(ed.lineOf(q('li', 0))).toBe(4);
        expect(ed.lineOf(q('li', 1))).toBe(5);
        expect(ed.lineOf(q('ul'))).toBe(4);
        expect(ed.lineOf(q('pre'))).toBe(lineOfText(DOC, '```js'));
        expect(ed.lineOf(q('a'))).toBe(lineOfText(DOC, 'last'));
    });

    test('lineOf handles tables, rules and images through their block', async () => {
        const md = 'intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n---\n\n![pic](a.png)\n\nend';
        await make({}, md);
        const q = (s) => ed.previewPanel.querySelector(s);
        expect(ed.lineOf(q('table'))).toBe(2);
        expect(ed.lineOf(q('td'))).toBeGreaterThanOrEqual(2);
        expect(ed.lineOf(q('td'))).toBeLessThanOrEqual(4);
        expect(ed.lineOf(q('hr'))).toBe(6);
        expect(ed.lineOf(q('img'))).toBe(8);
    });

    test('lineOf is correct when a round trip would reformat earlier lines', async () => {
        const md = '* a\n* b\n\n\n\n|x|y|\n|---|---|\n|1|2|\n\n## Target\n\ntail\n';
        await make({}, md);
        expect(ed.lineOf(ed.previewPanel.querySelector('h2'))).toBe(lineOfText(md, '## Target'));
        const ps = ed.previewPanel.querySelectorAll('p');
        expect(ed.lineOf(ps[ps.length - 1])).toBe(lineOfText(md, 'tail'));
    });

    test('lineOf returns -1 for elements outside the preview, the preview itself and nothing', async () => {
        await make();
        expect(ed.lineOf(document.body)).toBe(-1);
        expect(ed.lineOf(ed.previewPanel)).toBe(-1);
        expect(ed.lineOf(null)).toBe(-1);
        expect(ed.lineOf(ed.sourceTextarea)).toBe(-1);
    });

    test('lineOf for an element whose text is not in the markdown uses its block, else -1', async () => {
        await make({ customFences: { box: () => '<div class="box"><span class="inner">generated</span></div>' } },
            'first\n\n```box\nsource text\n```\n\nlast');
        const box = ed.previewPanel.querySelector('.box');
        box.setAttribute('contenteditable', 'false');
        expect(ed.lineOf(box.querySelector('.inner'))).toBe(2);
        expect(ed.lineOf(box)).toBe(2);

        await ed.setMarkdown('');
        const placeholder = ed.previewPanel.firstElementChild;
        expect(ed.lineOf(placeholder)).toBe(0);
    });

    test('scrollToLine scrolls the preview to the block holding the line and returns it', async () => {
        await make();
        const top = { h1: 0, p: 40, ul: 90, pre: 160 };
        ed.previewPanel.getBoundingClientRect = () => ({ top: 10 });
        Object.entries(top).forEach(([sel, y]) => {
            ed.previewPanel.querySelector(sel).getBoundingClientRect = () => ({ top: 10 + y });
        });
        const block = ed.scrollToLine(5, 'preview');
        expect(block).toBe(ed.previewPanel.querySelector('ul'));
        expect(ed.previewPanel.scrollTop).toBe(90);
        expect(ed.scrollToLine(lineOfText(DOC, 'let x'), 'preview').tagName).toBe('PRE');
        expect(ed.scrollToLine(0, 'preview').tagName).toBe('H1');
        expect(ed.scrollToLine(1, 'preview').tagName).toBe('H1');
        expect(ed.scrollToLine(9999, 'preview').tagName).toBe('P');
        expect(ed.scrollToLine(-7, 'preview').tagName).toBe('H1');
        expect(ed.scrollToLine('junk', 'preview').tagName).toBe('H1');
    });

    test('scrollToLine scrolls the source by line height, or proportionally without one', async () => {
        await make({ mode: 'split' });
        ed.sourceTextarea.style.lineHeight = '20px';
        ed.scrollToLine(5, 'source');
        expect(ed.sourceTextarea.scrollTop).toBe(100);
        expect(ed.previewPanel.scrollTop).toBe(0);

        ed.sourceTextarea.style.lineHeight = 'normal';
        Object.defineProperty(ed.sourceTextarea, 'scrollHeight', { configurable: true, value: 1200 });
        const total = DOC.split('\n').length;
        ed.scrollToLine(6, 'source');
        expect(ed.sourceTextarea.scrollTop).toBeCloseTo((6 / total) * 1200, 0);
    });

    test('scrollToLine with no pane scrolls both; with the preview hidden it returns null', async () => {
        await make({ mode: 'split' });
        ed.sourceTextarea.style.lineHeight = '10px';
        ed.previewPanel.getBoundingClientRect = () => ({ top: 0 });
        ed.previewPanel.querySelector('ul').getBoundingClientRect = () => ({ top: 70 });
        const block = ed.scrollToLine(4);
        expect(block.tagName).toBe('UL');
        expect(ed.getScroll()).toEqual({ source: 40, preview: 70 });

        ed.setMode('source');
        expect(ed.scrollToLine(4)).toBeNull();
        expect(ed.scrollToLine(4, 'preview')).toBeNull();
    });

    test('with nothing rendered there is no block to scroll to or look up', async () => {
        await make({}, '');
        expect(ed.scrollToLine(0, 'preview')).toBeNull();
        ed.destroy();
        await make({ mode: 'split', customFences: { box: () => '<div class="box" contenteditable="false"><span>generated</span></div>' } },
            'first\n\n```box\nsource\n```');
        const inner = ed.previewPanel.querySelector('.box span');
        ed.setMode('source');
        expect(ed.lineOf(inner)).toBe(-1);
    });

    test('the block map is rebuilt after an edit', async () => {
        await make();
        expect(ed.scrollToLine(2, 'preview').tagName).toBe('P');
        ed.replaceRange(0, 0, 'new first paragraph\n\n');
        expect(ed.scrollToLine(0, 'preview').tagName).toBe('P');
        expect(ed.scrollToLine(2, 'preview').tagName).toBe('H1');
        expect(ed.lineOf(ed.previewPanel.querySelector('h1'))).toBe(2);
    });
});

describe('resolveImageSrc', () => {
    const md = 'text ![a pic](images/a.png "The title") and ![](b.png)';

    test('rewrites the displayed src and keeps the markdown URL', async () => {
        const resolveImageSrc = jest.fn(src => 'asset://root/' + src);
        await make({ resolveImageSrc }, md);
        const imgs = ed.previewPanel.querySelectorAll('img');
        expect(imgs[0].getAttribute('src')).toBe('asset://root/images/a.png');
        expect(imgs[1].getAttribute('src')).toBe('asset://root/b.png');
        expect(resolveImageSrc).toHaveBeenCalledWith('images/a.png', { alt: 'a pic', title: 'The title' });
        expect(resolveImageSrc).toHaveBeenCalledWith('b.png', { alt: '', title: '' });
        expect(ed.getMarkdown()).toBe(md);
        expect(ed.getHTML()).toContain('src="images/a.png"');
        expect(ed.getHTML()).not.toContain('asset://');
    });

    test('the original URL survives an edit made in the rendered pane', async () => {
        await make({ resolveImageSrc: src => 'asset://root/' + src }, md);
        ed.previewPanel.querySelector('p').firstChild.data = 'changed ';
        ed.previewPanel.dispatchEvent(new Event('input', { bubbles: true }));
        ed.flush();
        expect(ed.getMarkdown()).toBe('changed ![a pic](images/a.png) and ![](b.png)');
    });

    test('runs again on every render and is not applied twice', async () => {
        const resolveImageSrc = jest.fn(src => 'asset://' + src);
        await make({ resolveImageSrc }, md);
        await ed.setMarkdown(md + '\n\nmore');
        expect(ed.previewPanel.querySelector('img').getAttribute('src')).toBe('asset://images/a.png');
        ed.setMode('source');
        ed.setMode('split');
        expect(ed.previewPanel.querySelector('img').getAttribute('src')).toBe('asset://images/a.png');
        resolveImageSrc.mock.calls.forEach(call => expect(call[0]).not.toContain('asset://'));
    });

    test('a resolver that returns nothing, a non-string or the same URL leaves the image alone', async () => {
        const values = [undefined, 42, 'images/a.png'];
        for (const value of values) {
            if (ed) ed.destroy();
            await make({ resolveImageSrc: () => value }, '![x](images/a.png)');
            expect(ed.previewPanel.querySelector('img').getAttribute('src')).toBe('images/a.png');
        }
    });

    test('raw HTML images are resolved too, and a non-function option is ignored', async () => {
        await make({ allowUnsafeHTML: true, resolveImageSrc: src => 'asset://' + src }, '<img src="raw.png">\n\n<img alt="none">');
        const imgs = ed.previewPanel.querySelectorAll('img');
        expect(imgs[0].getAttribute('src')).toBe('asset://raw.png');
        expect(imgs[0].getAttribute('data-qd-src')).toBe('raw.png');
        expect(imgs[1].getAttribute('src')).toBe('asset://');
        ed.destroy();
        await make({ resolveImageSrc: 'not a function' }, '![x](a.png)');
        expect(ed.previewPanel.querySelector('img').getAttribute('src')).toBe('a.png');
    });
});

describe('mount', () => {
    test('"replace" (default) takes over the container but keeps the host\'s own classes', async () => {
        host.className = 'my-host panel';
        host.innerHTML = '<p>old content</p>';
        await make({ mode: 'split' });
        expect(host.querySelector('p.old')).toBeNull();
        expect(host.textContent).not.toContain('old content');
        expect(ed.container).toBe(host);
        expect(ed.host).toBe(host);
        ed.setMode('source');
        ed.setTheme('dark');
        ed.setMode('preview');
        expect(host.className.split(' ').sort()).toEqual(['my-host', 'panel', 'qde-container', 'qde-dark', 'qde-mode-preview'].sort());
        ed.destroy();
        expect(host.className).toBe('my-host panel');
        expect(host.innerHTML).toBe('');
    });

    test('"append" adds the editor beside existing children and removes only itself', async () => {
        host.className = 'frame';
        host.innerHTML = '<div class="pull-tab">tab</div>';
        await make({ mount: 'append', mode: 'split' });
        expect(host.querySelector('.pull-tab').textContent).toBe('tab');
        expect(ed.container.parentNode).toBe(host);
        expect(ed.container).not.toBe(host);
        expect(ed.host).toBe(host);
        expect(ed.container.classList.contains('qde-container')).toBe(true);
        expect(host.classList.contains('qde-container')).toBe(false);
        expect(host.children.length).toBe(2);
        ed.setTheme('dark');
        expect(host.className).toBe('frame');
        ed.destroy();
        expect(host.innerHTML).toBe('<div class="pull-tab">tab</div>');
        expect(host.className).toBe('frame');
    });

    test('a selector string and a missing container', async () => {
        ed = new QuikdownEditor('#host', { showToolbar: false });
        await ed.initPromise;
        expect(ed.host).toBe(host);
        expect(() => new QuikdownEditor('#nope')).toThrow('Invalid container');
        expect(() => new QuikdownEditor(null)).toThrow('Invalid container');
    });

    test('the mobile split toggle class is cleared by a mode change', async () => {
        ed = new QuikdownEditor(host, { mode: 'split' });
        await ed.initPromise;
        const toggle = host.querySelector('.qde-split-toggle');
        toggle.click();
        expect(host.classList.contains('qde-split-preview')).toBe(true);
        expect(toggle.textContent).toBe('Source');
        toggle.click();
        expect(toggle.textContent).toBe('Preview');
        toggle.click();
        ed.setMode('split');
        expect(host.classList.contains('qde-split-preview')).toBe(false);
        expect(toggle.textContent).toBe('Preview');
    });

    test('setSplitPane and getSplitPane do what the toolbar toggle does', async () => {
        ed = new QuikdownEditor(host, { mode: 'split' });
        await ed.initPromise;
        const toggle = host.querySelector('.qde-split-toggle');
        expect(ed.getSplitPane()).toBe('source');

        ed.setSplitPane('preview');
        expect(ed.getSplitPane()).toBe('preview');
        expect(host.classList.contains('qde-split-preview')).toBe(true);
        expect(toggle.textContent).toBe('Source');

        // The toolbar button and the API share one state
        toggle.click();
        expect(ed.getSplitPane()).toBe('source');
        expect(toggle.textContent).toBe('Preview');

        ed.setSplitPane('preview');
        ed.setSplitPane('sideways');
        expect(ed.getSplitPane()).toBe('preview');

        ed.setMode('source');
        expect(ed.getSplitPane()).toBe('source');
    });

    test('setSplitPane works without a toolbar', async () => {
        ed = new QuikdownEditor(host, { mode: 'split', showToolbar: false });
        await ed.initPromise;
        ed.setSplitPane('preview');
        expect(ed.getSplitPane()).toBe('preview');
        expect(host.classList.contains('qde-split-preview')).toBe(true);
        ed.setSplitPane('source');
        expect(host.classList.contains('qde-split-preview')).toBe(false);
    });
});

describe('theming variables', () => {
    test('the injected stylesheet reads CSS custom properties with the old values as fallbacks', async () => {
        await make();
        const css = document.getElementById('qde-styles').textContent;
        [
            'var(--qde-bg, white)', 'var(--qde-fg, #1f2937)', 'var(--qde-border, #ddd)',
            'var(--qde-font,', 'var(--qde-preview-font-size, var(--qde-font-size, 16px))',
            'var(--qde-source-font-size, var(--qde-font-size, 14px))', 'var(--qde-source-font,',
            'var(--qde-code-bg, #f4f4f4)', 'var(--qde-code-font,', 'var(--qde-toolbar-bg, #f5f5f5)',
            'var(--qde-accent, #007bff)', 'var(--qde-padding, 16px)', 'var(--qde-line-height, 1.6)',
            'var(--qde-table-header-bg, #f5f5f5)', 'var(--qde-bg, #1e1e1e)', 'var(--qde-fg, #e0e0e0)'
        ].forEach(piece => expect(css).toContain(piece));
    });

    test('no hard-coded page colours remain outside var() fallbacks for the main surfaces', async () => {
        await make();
        const css = document.getElementById('qde-styles').textContent;
        const container = css.slice(css.indexOf('.qde-container {'), css.indexOf('}', css.indexOf('.qde-container {')));
        expect(container).not.toMatch(/background:\s*white;/);
        expect(container).not.toMatch(/color:\s*#1f2937;/);
    });
});

describe('statics', () => {
    test('formatting helpers are available without an editor', () => {
        expect(QuikdownEditor.formatMarkdown('x', 0, 1, 'bold').markdown).toBe('**x**');
        expect(QuikdownEditor.getFormatState('**x**', 3, 3).bold).toBe(true);
        expect(QuikdownEditor.mapOffset('ab', 'ab', 1)).toBe(1);
        expect(Array.isArray(QuikdownEditor.FORMAT_COMMANDS)).toBe(true);
    });
});

describe('related fixes', () => {
    test('link text edited in the rendered pane is kept (was reverted to the original)', async () => {
        await make({}, 'see [old text](http://x.y) now');
        text('a').data = 'new text';
        ed.previewPanel.dispatchEvent(new Event('input', { bubbles: true }));
        ed.flush();
        expect(ed.getMarkdown()).toBe('see [new text](http://x.y) now');
    });

    test('toMarkdown keeps formatting inside link text and falls back to the stored text when empty', () => {
        expect(quikdown_bd.toMarkdown(quikdown_bd('[a **b** c](http://x.y)'))).toBe('[a **b** c](http://x.y)');
        expect(quikdown_bd.toMarkdown('<a href="http://x.y" data-qd="[" data-qd-text="stored"></a>')).toBe('[stored](http://x.y)');
        expect(quikdown_bd.toMarkdown('<a href="http://x.y" data-qd="["></a>')).toBe('[](http://x.y)');
        const html = quikdown_bd('[Text][ref]\n\n[ref]: http://x.y', { reference_links: true });
        const div = document.createElement('div');
        div.innerHTML = html;
        div.querySelector('a').textContent = 'Edited';
        expect(quikdown_bd.toMarkdown(div)).toContain('[Edited][ref]');
    });

    test('"$" sequences in code survive rendering', () => {
        expect(quikdown('```bash\necho $$ and $& done $1 $\' $`\n```'))
            .toContain('echo $$ and $&amp; done $1 $&#39; $`');
        expect(quikdown('x `$$` y `$&` z')).toContain('<code class="quikdown-code">$$</code>');
        expect(quikdown('x `$$` y `$&` z')).toContain('<code class="quikdown-code">$&amp;</code>');
        expect(quikdown('a <b>$$</b> c', { allow_unsafe_html: { b: 1 } })).toContain('<b>$$</b>');
        expect(quikdown('line $& one\nline $$ two', { lazy_linefeeds: true })).toContain('$$ two');
    });

    test('"$" sequences survive a fence plugin and the bidirectional source attribute', () => {
        const plugin = { render: code => `<div class="x">${code}</div>` };
        const html = quikdown_bd('```x\ncost $1 and $$ and $&\n```', { fence_plugin: plugin });
        expect(html).toContain('<div data-qd-fence="```" data-qd-lang="x" data-qd-source="cost $1 and $$ and $&amp;" class="x">cost $1 and $$ and $&</div>');
    });

    test('"$" sequences survive a round trip through the editor', async () => {
        const md = '```bash\necho $$ $& $1\n```\n\ninline `$$` done';
        await make({}, md);
        expect(ed.previewPanel.querySelector('pre code').textContent).toBe('echo $$ $& $1');
        ed.updateFromHTML();
        expect(ed.getMarkdown()).toBe(md);
    });

    test('event handlers on the root <svg> of an svg fence are removed', async () => {
        await make({}, '```svg\n<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" onclick="x()"><rect onmouseover="y()" width="1" height="1"/><a href="javascript:z()">t</a></svg>\n```');
        const svg = ed.previewPanel.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.hasAttribute('onload')).toBe(false);
        expect(svg.hasAttribute('onclick')).toBe(false);
        expect(svg.querySelector('rect').hasAttribute('onmouseover')).toBe(false);
        expect(svg.querySelector('a').hasAttribute('href')).toBe(false);
        expect(ed.previewPanel.querySelectorAll('[onload], [onclick], [onmouseover]').length).toBe(0);
    });
});
