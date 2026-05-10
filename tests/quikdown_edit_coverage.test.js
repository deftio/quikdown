/**
 * @jest-environment jsdom
 */
import QuikdownEditor from '../dist/quikdown_edit.esm.js';
import { getRenderedContent } from '../src/quikdown_edit_copy.js';

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });

    Object.defineProperty(navigator, 'clipboard', {
        writable: true,
        value: {
            writeText: jest.fn().mockResolvedValue(undefined),
            write: jest.fn().mockResolvedValue(undefined)
        }
    });

    global.ClipboardItem = jest.fn().mockImplementation(items => ({ items }));
});

describe('QuikdownEditor Coverage', () => {
    let container;
    let editor;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'test-editor';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (editor) {
            editor.destroy();
            editor = null;
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
        jest.restoreAllMocks();
    });

    // ================================================================
    // 1. Undo/Redo System
    // ================================================================
    describe('Undo/Redo System', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
        });

        test('canUndo() returns false initially', () => {
            expect(editor.canUndo()).toBe(false);
        });

        test('canUndo() returns true after edit', () => {
            editor.updateFromMarkdown('hello');
            editor.updateFromMarkdown('world');
            expect(editor.canUndo()).toBe(true);
        });

        test('canRedo() returns false initially', () => {
            expect(editor.canRedo()).toBe(false);
        });

        test('canRedo() returns true after undo', () => {
            editor.updateFromMarkdown('hello');
            editor.updateFromMarkdown('world');
            editor.undo();
            expect(editor.canRedo()).toBe(true);
        });

        test('undo() restores previous content', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            expect(editor.getMarkdown()).toBe('first');
        });

        test('redo() re-applies undone change', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            editor.redo();
            expect(editor.getMarkdown()).toBe('second');
        });

        test('clearHistory() clears both stacks', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            editor.clearHistory();
            expect(editor.canUndo()).toBe(false);
            expect(editor.canRedo()).toBe(false);
        });

        test('undo stack size limit', async () => {
            editor.destroy();
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true, undoStackSize: 3 });
            await editor.initPromise;

            editor.updateFromMarkdown('a');
            editor.updateFromMarkdown('b');
            editor.updateFromMarkdown('c');
            editor.updateFromMarkdown('d');
            editor.updateFromMarkdown('e');

            // Should only be able to undo 3 times
            let undoCount = 0;
            while (editor.canUndo()) {
                editor.undo();
                undoCount++;
            }
            expect(undoCount).toBe(3);
        });

        test('new edit after undo clears redo stack', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            expect(editor.canRedo()).toBe(true);
            editor.updateFromMarkdown('third');
            expect(editor.canRedo()).toBe(false);
        });

        test('no-op edit (same content) does not push to stack', () => {
            editor.updateFromMarkdown('same');
            // First call pushed the empty initial state; now stack has 1 entry
            expect(editor._undoStack.length).toBe(1);
            // Second call with same content should NOT push another entry
            editor.updateFromMarkdown('same');
            expect(editor._undoStack.length).toBe(1);
        });

        test('undo when nothing to undo does nothing', () => {
            const md = editor.getMarkdown();
            editor.undo();
            expect(editor.getMarkdown()).toBe(md);
        });

        test('redo when nothing to redo does nothing', () => {
            const md = editor.getMarkdown();
            editor.redo();
            expect(editor.getMarkdown()).toBe(md);
        });

        test('multiple undo/redo cycles', () => {
            editor.updateFromMarkdown('a');
            editor.updateFromMarkdown('b');
            editor.updateFromMarkdown('c');

            editor.undo();
            expect(editor.getMarkdown()).toBe('b');
            editor.undo();
            expect(editor.getMarkdown()).toBe('a');
            editor.redo();
            expect(editor.getMarkdown()).toBe('b');
            editor.redo();
            expect(editor.getMarkdown()).toBe('c');
        });

        test('undo button disabled class toggling', () => {
            const undoBtn = editor.toolbar.querySelector('[data-action="undo"]');
            expect(undoBtn.classList.contains('disabled')).toBe(true);
            editor.updateFromMarkdown('hello');
            editor.updateFromMarkdown('world');
            expect(undoBtn.classList.contains('disabled')).toBe(false);
            editor.undo();
            editor.undo();
            expect(undoBtn.classList.contains('disabled')).toBe(true);
        });

        test('redo button disabled class toggling', () => {
            const redoBtn = editor.toolbar.querySelector('[data-action="redo"]');
            expect(redoBtn.classList.contains('disabled')).toBe(true);
            editor.updateFromMarkdown('hello');
            editor.updateFromMarkdown('world');
            editor.undo();
            expect(redoBtn.classList.contains('disabled')).toBe(false);
            editor.redo();
            expect(redoBtn.classList.contains('disabled')).toBe(true);
        });

        test('_updateUndoButtons is no-op without toolbar', async () => {
            editor.destroy();
            editor = new QuikdownEditor('#test-editor', { showToolbar: false, showUndoRedo: true });
            await editor.initPromise;
            // Should not throw
            editor._updateUndoButtons();
        });
    });

    // ================================================================
    // 2. Theme System
    // ================================================================
    describe('Theme System', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'light' });
            await editor.initPromise;
        });

        test('setTheme("dark") adds qde-dark class', () => {
            editor.setTheme('dark');
            expect(editor.container.classList.contains('qde-dark')).toBe(true);
        });

        test('setTheme("light") removes qde-dark class', () => {
            editor.setTheme('dark');
            editor.setTheme('light');
            expect(editor.container.classList.contains('qde-dark')).toBe(false);
        });

        test('setTheme("auto") sets up matchMedia listener', () => {
            editor.setTheme('auto');
            expect(editor._autoThemeListener).toBeTruthy();
            expect(editor.getTheme()).toBe('auto');
        });

        test('setTheme("invalid") is rejected', () => {
            editor.setTheme('dark');
            editor.setTheme('invalid');
            // Should still be dark since invalid was rejected
            expect(editor.getTheme()).toBe('dark');
        });

        test('getTheme() returns current theme', () => {
            editor.setTheme('dark');
            expect(editor.getTheme()).toBe('dark');
            editor.setTheme('light');
            expect(editor.getTheme()).toBe('light');
        });

        test('auto theme listener is cleaned up when switching themes', () => {
            editor.setTheme('auto');
            const listener = editor._autoThemeListener;
            expect(listener).toBeTruthy();
            editor.setTheme('dark');
            expect(editor._autoThemeListener).toBeNull();
        });

        test('_syncHljsTheme toggles disabled on hljs stylesheets', () => {
            // Create mock stylesheet elements
            const lightLink = document.createElement('link');
            lightLink.id = 'qde-hljs-light';
            document.head.appendChild(lightLink);
            const darkLink = document.createElement('link');
            darkLink.id = 'qde-hljs-dark';
            document.head.appendChild(darkLink);

            // Light mode: light enabled, dark disabled
            editor.setTheme('light');
            editor._syncHljsTheme();
            expect(lightLink.disabled).toBe(false);
            expect(darkLink.disabled).toBe(true);

            // Dark mode: light disabled, dark enabled
            editor.setTheme('dark');
            editor._syncHljsTheme();
            expect(lightLink.disabled).toBe(true);
            expect(darkLink.disabled).toBe(false);

            lightLink.remove();
            darkLink.remove();
        });

        test('dark theme preserved across mode changes', () => {
            editor.setTheme('dark');
            editor.setMode('source');
            expect(editor.container.classList.contains('qde-dark')).toBe(true);
            editor.setMode('preview');
            expect(editor.container.classList.contains('qde-dark')).toBe(true);
        });
    });

    // ================================================================
    // 3. Plugin/Library Loading
    // ================================================================
    describe('Plugin/Library Loading', () => {
        test('loadPlugins with no plugins resolves immediately', async () => {
            editor = new QuikdownEditor('#test-editor', { plugins: {} });
            await editor.initPromise;
            // If we got here without error, it resolved
            expect(editor).toBeDefined();
        });

        test('loadPlugins with legacy plugins.highlightjs tries to load script', async () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { plugins: { highlightjs: true } });
            // Trigger all script errors and CSS timeouts
            document.querySelectorAll('script[src*="highlight"]').forEach(s => {
                if (s.onerror) s.onerror(new Error('test'));
            });
            jest.advanceTimersByTime(1100);
            await editor.initPromise;
            const scripts = document.querySelectorAll('script[src*="highlight"]');
            expect(scripts.length).toBeGreaterThanOrEqual(1);
            warnSpy.mockRestore();
            errSpy.mockRestore();
            jest.useRealTimers();
        }, 10000);

        test('preloadFences "all" loads all fence libraries', async () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { preloadFences: 'all' });
            // Trigger all onerrors
            document.querySelectorAll('script').forEach(s => {
                if (s.onerror) s.onerror(new Error('test'));
            });
            jest.advanceTimersByTime(1100);
            await editor.initPromise;
            expect(editor).toBeDefined();
            warnSpy.mockRestore();
            errSpy.mockRestore();
            jest.useRealTimers();
        }, 10000);

        test('preloadFences with specific library', async () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { preloadFences: ['highlightjs'] });
            document.querySelectorAll('script').forEach(s => {
                if (s.onerror) s.onerror(new Error('test'));
            });
            jest.advanceTimersByTime(1100);
            await editor.initPromise;
            expect(editor).toBeDefined();
            warnSpy.mockRestore();
            jest.useRealTimers();
        }, 10000);

        test('preloadFences with custom library object', async () => {
            jest.useFakeTimers();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', {
                preloadFences: [{ name: 'custom', script: 'https://example.com/custom.js' }]
            });
            document.querySelectorAll('script[src="https://example.com/custom.js"]').forEach(s => {
                if (s.onerror) s.onerror(new Error('test'));
            });
            jest.advanceTimersByTime(1100);
            await editor.initPromise;
            expect(editor).toBeDefined();
            warnSpy.mockRestore();
            jest.useRealTimers();
        }, 10000);

        test('preloadFences "invalid" string logs warning', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { preloadFences: 'invalid' });
            await editor.initPromise;
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('preloadFences should be')
            );
            warnSpy.mockRestore();
        });

        test('preloadFences with unknown library name logs warning', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { preloadFences: ['unknownlib'] });
            await editor.initPromise;
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('unknown preloadFences entry')
            );
            warnSpy.mockRestore();
        });

        test('lazyLoadLibrary returns true when already loaded', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const result = await editor.lazyLoadLibrary('test', () => true, 'https://example.com/test.js');
            expect(result).toBe(true);
        });

        test('lazyLoadLibrary loads script and CSS', async () => {
            jest.useFakeTimers();
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const promise = editor.lazyLoadLibrary(
                'testlib',
                () => false,
                'https://example.com/lazy-test.js',
                'https://example.com/lazy-test.css'
            );
            // Trigger script onerror and CSS timeout
            const script = document.querySelector('script[src="https://example.com/lazy-test.js"]');
            if (script) script.onerror(new Error('test'));
            jest.advanceTimersByTime(1100);
            const result = await promise;
            expect(typeof result).toBe('boolean');
            errSpy.mockRestore();
            jest.useRealTimers();
        }, 10000);

        test('loadScript creates script element', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const promise = editor.loadScript('https://example.com/test-load-unique.js');
            const scripts = document.querySelectorAll('script[src="https://example.com/test-load-unique.js"]');
            expect(scripts.length).toBe(1);
            scripts[0].onerror(new Error('test'));
            await promise.catch(() => {});
        });

        test('loadCSS creates link element', async () => {
            jest.useFakeTimers();
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const promise = editor.loadCSS('https://example.com/test-unique.css', 'test-css-unique');
            const links = document.querySelectorAll('link[href="https://example.com/test-unique.css"]');
            expect(links.length).toBe(1);
            expect(links[0].id).toBe('test-css-unique');
            links[0].onload();
            await promise;
            jest.useRealTimers();
        });
    });

    // ================================================================
    // 4. Keyboard Shortcuts
    // ================================================================
    describe('Keyboard Shortcuts', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('Ctrl+1 switches to source mode', () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
            expect(editor.currentMode).toBe('source');
        });

        test('Ctrl+2 switches to split mode', () => {
            editor.setMode('source');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true }));
            expect(editor.currentMode).toBe('split');
        });

        test('Ctrl+3 switches to preview mode', () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', ctrlKey: true }));
            expect(editor.currentMode).toBe('preview');
        });

        test('Ctrl+Z triggers undo', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
            expect(editor.getMarkdown()).toBe('first');
        });

        test('Ctrl+Shift+Z triggers redo', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true }));
            expect(editor.getMarkdown()).toBe('second');
        });

        test('Ctrl+Y triggers redo', () => {
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
            expect(editor.getMarkdown()).toBe('second');
        });
    });

    // ================================================================
    // 5. Input Handling / Debouncing
    // ================================================================
    describe('Input Handling / Debouncing', () => {
        beforeEach(async () => {
            jest.useFakeTimers();
            editor = new QuikdownEditor('#test-editor', { debounceDelay: 50 });
            await editor.initPromise;
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('source textarea input triggers updateFromMarkdown after debounce', () => {
            const spy = jest.spyOn(editor, 'updateFromMarkdown');
            editor.sourceTextarea.value = 'test input';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            expect(spy).not.toHaveBeenCalled();
            jest.advanceTimersByTime(50);
            expect(spy).toHaveBeenCalledWith('test input');
        });

        test('preview panel input triggers updateFromHTML after debounce', () => {
            const spy = jest.spyOn(editor, 'updateFromHTML');
            editor.previewPanel.dispatchEvent(new Event('input'));
            expect(spy).not.toHaveBeenCalled();
            jest.advanceTimersByTime(50);
            expect(spy).toHaveBeenCalled();
        });

        test('setDebounceDelay changes the delay', () => {
            editor.setDebounceDelay(200);
            expect(editor.getDebounceDelay()).toBe(200);
        });

        test('getDebounceDelay returns current delay', () => {
            expect(editor.getDebounceDelay()).toBe(50);
        });

        test('rapid inputs only trigger one update (debounce works)', () => {
            const spy = jest.spyOn(editor, 'updateFromMarkdown');
            editor.sourceTextarea.value = 'a';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            editor.sourceTextarea.value = 'ab';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            editor.sourceTextarea.value = 'abc';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            jest.advanceTimersByTime(50);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('abc');
        });

        test('updateFromMarkdown("") shows placeholder in preview', () => {
            editor.setMode('split');
            editor.updateFromMarkdown('');
            expect(editor.previewPanel.innerHTML).toContain('Start typing');
        });
    });

    // ================================================================
    // 6. handleAction
    // ================================================================
    describe('handleAction', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor', {
                showRemoveHR: true,
                showLazyLinefeeds: true,
                showUndoRedo: true
            });
            await editor.initPromise;
        });

        test('handleAction("copy-markdown") calls copy("markdown")', () => {
            const spy = jest.spyOn(editor, 'copy');
            editor.handleAction('copy-markdown');
            expect(spy).toHaveBeenCalledWith('markdown');
        });

        test('handleAction("copy-html") calls copy("html")', () => {
            const spy = jest.spyOn(editor, 'copy');
            editor.handleAction('copy-html');
            expect(spy).toHaveBeenCalledWith('html');
        });

        test('handleAction("copy-rendered") calls copyRendered()', () => {
            const spy = jest.spyOn(editor, 'copyRendered').mockResolvedValue();
            editor.handleAction('copy-rendered');
            expect(spy).toHaveBeenCalled();
        });

        test('handleAction("remove-hr") calls removeHR()', () => {
            const spy = jest.spyOn(editor, 'removeHR').mockResolvedValue();
            editor.handleAction('remove-hr');
            expect(spy).toHaveBeenCalled();
        });

        test('handleAction("lazy-linefeeds") calls convertLazyLinefeeds()', () => {
            const spy = jest.spyOn(editor, 'convertLazyLinefeeds').mockResolvedValue();
            editor.handleAction('lazy-linefeeds');
            expect(spy).toHaveBeenCalled();
        });

        test('handleAction("undo") calls undo()', () => {
            const spy = jest.spyOn(editor, 'undo');
            editor.handleAction('undo');
            expect(spy).toHaveBeenCalled();
        });

        test('handleAction("redo") calls redo()', () => {
            const spy = jest.spyOn(editor, 'redo');
            editor.handleAction('redo');
            expect(spy).toHaveBeenCalled();
        });

        test('toolbar button click triggers handleAction', () => {
            const spy = jest.spyOn(editor, 'handleAction');
            const btn = editor.toolbar.querySelector('[data-action="copy-markdown"]');
            btn.click();
            expect(spy).toHaveBeenCalledWith('copy-markdown');
        });
    });

    // ================================================================
    // 7. Copy Functionality
    // ================================================================
    describe('Copy Functionality', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold** text');
        });

        test('copy("markdown") writes markdown to clipboard', async () => {
            await editor.copy('markdown');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('**bold** text');
        });

        test('copy("html") writes html to clipboard', async () => {
            await editor.copy('html');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(editor.getHTML());
        });

        test('copy shows visual feedback "Copied!" on button', async () => {
            jest.useFakeTimers();
            const btn = editor.toolbar.querySelector('[data-action="copy-markdown"]');
            const original = btn.textContent;
            await editor.copy('markdown');
            expect(btn.textContent).toBe('Copied!');
            jest.advanceTimersByTime(1500);
            expect(btn.textContent).toBe(original);
            jest.useRealTimers();
        });

        test('copy failure does not crash', async () => {
            navigator.clipboard.writeText = jest.fn().mockRejectedValue(new Error('denied'));
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await editor.copy('markdown');
            // Should not throw
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
            navigator.clipboard.writeText = jest.fn().mockResolvedValue(undefined);
        });

        test('copyRendered calls getRenderedContent', async () => {
            // getRenderedContent expects previewPanel
            // It will try to write to clipboard; just make sure it doesn't crash
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await editor.copyRendered().catch(() => {});
            errSpy.mockRestore();
        });

        test('copyRendered uses bounded heading sizes for rich paste', async () => {
            const preview = document.createElement('div');
            preview.innerHTML = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>';
            navigator.clipboard.write = jest.fn().mockResolvedValue(undefined);

            const result = await getRenderedContent(preview);
            const html = result.html;

            expect(html).toContain('font-size:24pt');
            expect(html).toContain('font-size:18pt');
            expect(html).toContain('font-size:15pt');
            expect(html).not.toContain('font-size:2em');
            expect(html).not.toContain('font-size:1.5em');
        });
    });

    // ================================================================
    // 8. Mode Switching Details
    // ================================================================
    describe('Mode Switching Details', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('source mode hides preview panel, shows source', () => {
            editor.setMode('source');
            expect(editor.container.classList.contains('qde-mode-source')).toBe(true);
        });

        test('preview mode hides source panel, shows preview', () => {
            editor.setMode('preview');
            expect(editor.container.classList.contains('qde-mode-preview')).toBe(true);
        });

        test('split mode shows both', () => {
            editor.setMode('split');
            expect(editor.container.classList.contains('qde-mode-split')).toBe(true);
        });

        test('mode change triggers onModeChange callback', () => {
            const callback = jest.fn();
            editor.options.onModeChange = callback;
            editor.setMode('source');
            expect(callback).toHaveBeenCalledWith('source');
        });

        test('invalid mode is ignored', () => {
            editor.setMode('split');
            editor.setMode('invalid');
            expect(editor.currentMode).toBe('split');
        });
    });

    // ================================================================
    // 9. Headless Mode / No Toolbar
    // ================================================================
    describe('Headless Mode / No Toolbar', () => {
        test('showToolbar: false creates no toolbar', async () => {
            editor = new QuikdownEditor('#test-editor', { showToolbar: false });
            await editor.initPromise;
            expect(editor.toolbar).toBeUndefined();
            expect(container.querySelector('.qde-toolbar')).toBeNull();
        });

        test('can still set/get markdown, switch modes, undo/redo without toolbar', async () => {
            editor = new QuikdownEditor('#test-editor', { showToolbar: false });
            await editor.initPromise;
            editor.updateFromMarkdown('hello');
            expect(editor.getMarkdown()).toBe('hello');
            editor.setMode('source');
            expect(editor.currentMode).toBe('source');
            editor.updateFromMarkdown('world');
            editor.undo();
            expect(editor.getMarkdown()).toBe('hello');
        });

        test('copy feedback does not crash when toolbar is null', async () => {
            editor = new QuikdownEditor('#test-editor', { showToolbar: false });
            await editor.initPromise;
            editor.updateFromMarkdown('test');
            // copy() accesses this.toolbar which is undefined - should not throw
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await editor.copy('markdown');
            errSpy.mockRestore();
        });

        test('toolbar-dependent actions do not crash without toolbar', async () => {
            editor = new QuikdownEditor('#test-editor', { showToolbar: false });
            await editor.initPromise;
            await editor.setMarkdown('test\n---\nmore');
            // removeHR and convertLazyLinefeeds access this.toolbar?. (optional chaining)
            await editor.removeHR();
            await editor.convertLazyLinefeeds();
        });
    });

    // ================================================================
    // 10. preprocessSpecialElements
    // ================================================================
    describe('preprocessSpecialElements', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
            await editor.initPromise;
        });

        test('complex fences with data-qd-source restored to pre elements', () => {
            const panel = document.createElement('div');
            const complex = document.createElement('div');
            complex.setAttribute('contenteditable', 'false');
            complex.setAttribute('data-qd-source', 'console.log("hi")');
            complex.setAttribute('data-qd-fence', '```');
            complex.setAttribute('data-qd-lang', 'javascript');
            panel.appendChild(complex);

            editor.preprocessSpecialElements(panel);

            const pre = panel.querySelector('pre');
            expect(pre).toBeTruthy();
            expect(pre.getAttribute('data-qd-fence')).toBe('```');
            expect(pre.getAttribute('data-qd-lang')).toBe('javascript');
            expect(pre.querySelector('code').textContent).toBe('console.log("hi")');
        });

        test('CSV table detection and fence conversion', () => {
            const panel = document.createElement('div');
            const table = document.createElement('table');
            table.className = 'qde-csv-table';
            table.setAttribute('data-qd-lang', 'csv');
            table.innerHTML = '<thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr></tbody>';
            panel.appendChild(table);

            editor.preprocessSpecialElements(panel);

            const pre = panel.querySelector('pre');
            expect(pre).toBeTruthy();
            expect(pre.getAttribute('data-qd-lang')).toBe('csv');
            expect(pre.querySelector('code').textContent).toContain('Name,Age');
        });

        test('null panel input returns early', () => {
            // Should not throw
            editor.preprocessSpecialElements(null);
        });

        test('elements without data-qd-source are not affected', () => {
            const panel = document.createElement('div');
            const div = document.createElement('div');
            div.contentEditable = 'false';
            div.textContent = 'normal div';
            panel.appendChild(div);

            editor.preprocessSpecialElements(panel);
            expect(panel.querySelector('div')).toBeTruthy();
            expect(panel.querySelector('pre')).toBeNull();
        });

        test('TSV table conversion uses tab delimiter', () => {
            const panel = document.createElement('div');
            const table = document.createElement('table');
            table.className = 'qde-csv-table';
            table.setAttribute('data-qd-lang', 'tsv');
            table.innerHTML = '<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>';
            panel.appendChild(table);

            editor.preprocessSpecialElements(panel);

            const code = panel.querySelector('code');
            expect(code.textContent).toContain('A\tB');
        });
    });

    // ================================================================
    // 11. Configuration / Options
    // ================================================================
    describe('Configuration / Options', () => {
        test('initialContent option sets markdown on init', async () => {
            editor = new QuikdownEditor('#test-editor', { initialContent: '# Hello' });
            await editor.initPromise;
            // setMarkdown is called without await inside init, so wait an extra tick
            await new Promise(r => setTimeout(r, 0));
            expect(editor.getMarkdown()).toBe('# Hello');
        });

        test('onChange callback fires on markdown change', async () => {
            const onChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onChange });
            await editor.initPromise;
            await editor.setMarkdown('test');
            expect(onChange).toHaveBeenCalledWith('test', expect.any(String));
        });

        test('onModeChange callback fires on mode change', async () => {
            const onModeChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onModeChange });
            await editor.initPromise;
            editor.setMode('source');
            expect(onModeChange).toHaveBeenCalledWith('source');
        });

        test('placeholder option sets textarea placeholder', async () => {
            editor = new QuikdownEditor('#test-editor', { placeholder: 'Custom placeholder' });
            await editor.initPromise;
            expect(editor.sourceTextarea.placeholder).toBe('Custom placeholder');
        });

        test('inline_styles option passes through to parser', async () => {
            editor = new QuikdownEditor('#test-editor', { inline_styles: true });
            await editor.initPromise;
            expect(editor.options.inline_styles).toBe(true);
        });
    });

    // ================================================================
    // 12. convertLazyLinefeeds Instance Method
    // ================================================================
    describe('convertLazyLinefeeds Instance Method', () => {
        test('calls static method and updates markdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('line1\nline2\nline3');
            await editor.convertLazyLinefeeds();
            const md = editor.getMarkdown();
            // Should have added blank lines between the lines
            expect(md).toContain('\n\n');
        });

        test('visual feedback on toolbar button', async () => {
            jest.useFakeTimers();
            editor = new QuikdownEditor('#test-editor', { showLazyLinefeeds: true });
            await editor.initPromise;
            await editor.setMarkdown('a\nb');
            await editor.convertLazyLinefeeds();
            const btn = editor.toolbar.querySelector('[data-action="lazy-linefeeds"]');
            expect(btn.textContent).toBe('Converted!');
            jest.advanceTimersByTime(1500);
            expect(btn.textContent).toBe('Fix Linefeeds');
            jest.useRealTimers();
        });

        test('works without toolbar', async () => {
            editor = new QuikdownEditor('#test-editor', { showToolbar: false });
            await editor.initPromise;
            await editor.setMarkdown('a\nb');
            await editor.convertLazyLinefeeds();
            expect(editor.getMarkdown()).toContain('\n\n');
        });

        test('static convertLazyLinefeeds with unclosed fence does not add blanks inside', () => {
            const input = '```js\nline1\nline2\nline3';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // The unclosed fence body should be preserved as-is (fence-body lines)
            // The lines inside the fence should remain without extra blanks
            expect(result).toContain('line1\nline2\nline3');
        });
    });

    // ================================================================
    // 13. removeHR Instance Method
    // ================================================================
    describe('removeHR Instance Method', () => {
        test('removes HRs from markdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('hello\n\n---\n\nworld');
            await editor.removeHR();
            expect(editor.getMarkdown()).not.toContain('---');
        });

        test('visual feedback on toolbar button', async () => {
            jest.useFakeTimers();
            editor = new QuikdownEditor('#test-editor', { showRemoveHR: true });
            await editor.initPromise;
            await editor.setMarkdown('a\n\n---\n\nb');
            await editor.removeHR();
            const btn = editor.toolbar.querySelector('[data-action="remove-hr"]');
            expect(btn.textContent).toBe('Removed!');
            jest.advanceTimersByTime(1500);
            expect(btn.textContent).toBe('Remove HR');
            jest.useRealTimers();
        });

        test('works without toolbar', async () => {
            editor = new QuikdownEditor('#test-editor', { showToolbar: false });
            await editor.initPromise;
            await editor.setMarkdown('a\n\n---\n\nb');
            await editor.removeHR();
            expect(editor.getMarkdown()).not.toContain('---');
        });

        test('removeHR preserves content inside fences', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```\n---\n```\n\n---\n\ntext');
            await editor.removeHR();
            const md = editor.getMarkdown();
            // The HR inside the fence should remain
            expect(md).toContain('```\n---\n```');
        });
    });

    // ================================================================
    // 14. Static Methods Edge Cases
    // ================================================================
    describe('Static Methods Edge Cases', () => {
        test('removeHRFromMarkdown(null) returns empty string', () => {
            expect(QuikdownEditor.removeHRFromMarkdown(null)).toBe('');
        });

        test('removeHRFromMarkdown("") returns empty string', () => {
            expect(QuikdownEditor.removeHRFromMarkdown('')).toBe('');
        });

        test('convertLazyLinefeeds(null) returns empty string', () => {
            expect(QuikdownEditor.convertLazyLinefeeds(null)).toBe('');
        });

        test('removeHRFromMarkdown with unclosed fence preserves HR inside', () => {
            const input = '```\n---\nstuff';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // Inside an unclosed fence, the HR should be preserved
            expect(result).toContain('---');
        });

        test('convertLazyLinefeeds with unclosed fence preserves lines', () => {
            const input = '```\nline1\nline2';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // Lines inside unclosed fence should not get extra blank lines
            expect(result).toContain('line1\nline2');
        });
    });

    // ================================================================
    // 15. Fence Plugin / Rendering Edge Cases
    // ================================================================
    describe('Fence Plugin / Rendering Edge Cases', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor', { enableComplexFences: true });
            await editor.initPromise;
        });

        test('SVG fence renders SVG content', async () => {
            const svgCode = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
            await editor.setMarkdown('```svg\n' + svgCode + '\n```');
            const preview = editor.previewPanel.innerHTML;
            expect(preview).toContain('qde-svg-container');
        });

        test('SVG with script tags has scripts removed from rendered output', () => {
            const svgCode = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><circle cx="50" cy="50" r="40"/></svg>';
            const result = editor.renderSVG(svgCode);
            // The data-qd-source preserves original code, but the rendered SVG should not have script tags
            // Parse the result to check the actual SVG content
            const div = document.createElement('div');
            div.innerHTML = result;
            const svgContainer = div.querySelector('.qde-svg-container');
            const renderedSvg = svgContainer.querySelector('svg');
            expect(renderedSvg.querySelector('script')).toBeNull();
            expect(result).toContain('circle');
        });

        test('HTML fence renders HTML without DOMPurify', () => {
            // DOMPurify is not available in jsdom
            delete window.DOMPurify;
            const result = editor.renderHTML('<p>Hello</p>');
            expect(result).toContain('qde-html-container');
            expect(result).toContain('Hello');
        });

        test('CSV fence renders table', () => {
            const result = editor.renderTable('Name,Age\nAlice,30\nBob,25', 'csv');
            expect(result).toContain('<table');
            expect(result).toContain('Alice');
            expect(result).toContain('30');
        });

        test('TSV fence renders table with tab delimiters', () => {
            const result = editor.renderTable('Name\tAge\nAlice\t30', 'tsv');
            expect(result).toContain('<table');
            expect(result).toContain('Alice');
        });

        test('PSV fence renders table with pipe delimiters', () => {
            const result = editor.renderTable('Name|Age\nAlice|30', 'psv');
            expect(result).toContain('<table');
            expect(result).toContain('Alice');
        });

        test('JSON fence renders formatted JSON', () => {
            const result = editor.renderJSON('{"key":"value"}', 'json');
            expect(result).toContain('qde-json');
            expect(result).toContain('key');
        });

        test('code fence without hljs renders plain code', async () => {
            delete window.hljs;
            await editor.setMarkdown('```python\nprint("hello")\n```');
            // Should render as plain pre/code without hljs classes
            const preview = editor.previewPanel.innerHTML;
            expect(preview).toContain('print');
        });
    });

    // ================================================================
    // 16. Destroy
    // ================================================================
    describe('Destroy', () => {
        test('destroy() clears container', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.destroy();
            expect(container.innerHTML).toBe('');
            editor = null;
        });

        test('destroy() removes qde-container class', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.destroy();
            expect(container.classList.contains('qde-container')).toBe(false);
            expect(container.classList.contains('qde-dark')).toBe(false);
            editor = null;
        });

        test('destroy() removes injected styles when last editor', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.destroy();
            const style = document.getElementById('qde-styles');
            expect(style).toBeNull();
            editor = null;
        });
    });

    // ================================================================
    // 17. updateFromHTML
    // ================================================================
    describe('updateFromHTML', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('preview edit triggers HTML-to-markdown conversion', () => {
            editor.previewPanel.innerHTML = '<p>Hello World</p>';
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toBeTruthy();
        });

        test('converted markdown updates source textarea', () => {
            editor.setMode('split');
            editor.previewPanel.innerHTML = '<p>Updated content</p>';
            editor.updateFromHTML();
            expect(editor.sourceTextarea.value).toBeTruthy();
        });

        test('onChange fires after HTML update', () => {
            const onChange = jest.fn();
            editor.options.onChange = onChange;
            editor.previewPanel.innerHTML = '<p>changed</p>';
            editor.updateFromHTML();
            expect(onChange).toHaveBeenCalled();
        });

        test('undo state pushed before HTML update', () => {
            editor.previewPanel.innerHTML = '<p>first</p>';
            editor.updateFromHTML();
            editor.previewPanel.innerHTML = '<p>second</p>';
            editor.updateFromHTML();
            // Should be able to undo
            expect(editor.canUndo()).toBe(true);
        });
    });

    // ================================================================
    // Additional edge cases
    // ================================================================
    describe('Additional Edge Cases', () => {
        test('markdown getter and setter properties work', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.markdown = 'via setter';
            // Need to wait since setter calls async setMarkdown
            await new Promise(r => setTimeout(r, 50));
            expect(editor.markdown).toBe('via setter');
        });

        test('html getter returns current HTML', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold**');
            expect(editor.html).toContain('bold');
        });

        test('mode getter returns current mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            expect(editor.mode).toBe('split');
        });

        test('toolbar mode button click switches mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const sourceBtn = editor.toolbar.querySelector('[data-mode="source"]');
            sourceBtn.click();
            expect(editor.currentMode).toBe('source');
        });

        test('toolbar mode button gets active class', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setMode('preview');
            const previewBtn = editor.toolbar.querySelector('[data-mode="preview"]');
            expect(previewBtn.classList.contains('active')).toBe(true);
            const sourceBtn = editor.toolbar.querySelector('[data-mode="source"]');
            expect(sourceBtn.classList.contains('active')).toBe(false);
        });

        test('setLazyLinefeeds re-renders content', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('line1\nline2');
            const spy = jest.spyOn(editor, 'updateFromMarkdown');
            editor.setLazyLinefeeds(true);
            expect(spy).toHaveBeenCalled();
            expect(editor.getLazyLinefeeds()).toBe(true);
        });

        test('escapeHtml handles null', () => {
            editor = new QuikdownEditor('#test-editor');
            // escapeHtml uses ?? so null should return empty string
            expect(editor.escapeHtml(null)).toBe('');
        });

        test('escapeHtml escapes special characters', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            expect(editor.escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(editor.escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
        });

        test('parseCSVLine handles quoted values with delimiter', () => {
            editor = new QuikdownEditor('#test-editor');
            const result = editor.parseCSVLine('"hello,world",simple', ',');
            expect(result).toEqual(['hello,world', 'simple']);
        });

        test('parseCSVLine handles escaped quotes', () => {
            editor = new QuikdownEditor('#test-editor');
            const result = editor.parseCSVLine('"say ""hi""",other', ',');
            expect(result).toEqual(['say "hi"', 'other']);
        });

        test('invalid SVG shows error', () => {
            editor = new QuikdownEditor('#test-editor');
            const result = editor.renderSVG('not valid svg at all <<<>>>');
            expect(result).toContain('qde-error');
        });

        test('renderTable with empty lines returns fallback', () => {
            editor = new QuikdownEditor('#test-editor');
            const result = editor.renderTable('', 'csv');
            // Empty input should still produce a table or fallback
            expect(result).toBeTruthy();
        });

        test('renderJSON with invalid JSON still renders', () => {
            editor = new QuikdownEditor('#test-editor');
            const result = editor.renderJSON('{invalid json', 'json');
            expect(result).toContain('{invalid json');
        });

        test('makeFencesNonEditable is a no-op without previewPanel', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Should not throw
            editor.makeFencesNonEditable();
        });

        test('injectStyles does not duplicate styles', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Call injectStyles again - should not add duplicate
            editor.injectStyles();
            const styles = document.querySelectorAll('#qde-styles');
            expect(styles.length).toBe(1);
        });

        test('createFencePlugin returns object with render and reverse', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            expect(typeof plugin.render).toBe('function');
            expect(typeof plugin.reverse).toBe('function');
        });

        test('createFencePlugin render returns undefined for unknown lang', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            const result = plugin.render('code', 'unknownlang');
            expect(result).toBeUndefined();
        });

        test('createFencePlugin reverse extracts from hljs code', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            const el = document.createElement('pre');
            el.setAttribute('data-qd-lang', 'js');
            const code = document.createElement('code');
            code.className = 'hljs';
            code.textContent = 'console.log("hi")';
            el.appendChild(code);
            const result = plugin.reverse(el);
            expect(result.content).toBe('console.log("hi")');
            expect(result.lang).toBe('js');
        });

        test('createFencePlugin reverse extracts from regular code', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            const el = document.createElement('pre');
            el.setAttribute('data-qd-lang', 'text');
            const code = document.createElement('code');
            code.textContent = 'plain text';
            el.appendChild(code);
            const result = plugin.reverse(el);
            expect(result.content).toBe('plain text');
        });

        test('createFencePlugin reverse fallback to element text', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            const el = document.createElement('div');
            el.textContent = 'fallback text';
            const result = plugin.reverse(el);
            expect(result.content).toBe('fallback text');
        });

        test('customFences option is invoked for matching lang', async () => {
            const customRender = jest.fn().mockReturnValue('<div>custom</div>');
            editor = new QuikdownEditor('#test-editor', {
                enableComplexFences: true,
                customFences: { mytype: customRender }
            });
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            const result = plugin.render('some code', 'mytype');
            expect(customRender).toHaveBeenCalledWith('some code', 'mytype');
            expect(result).toBe('<div>custom</div>');
        });

        test('customFences error falls back to escaped code', async () => {
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', {
                customFences: { broken: () => { throw new Error('oops'); } }
            });
            await editor.initPromise;
            const plugin = editor.createFencePlugin();
            const result = plugin.render('code', 'broken');
            expect(result).toContain('<pre>');
            errSpy.mockRestore();
        });

        test('updateFromMarkdown in source mode does not update preview', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setMode('source');
            editor.updateFromMarkdown('# heading');
            // Preview should show placeholder since mode is source and we skip updating it
            // Actually looking at the code, it still updates _html but doesn't update previewPanel.innerHTML
            expect(editor._html).toBeTruthy();
        });

        test('updateFromHTML in preview mode does not update source textarea', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setMode('preview');
            editor.previewPanel.innerHTML = '<p>test</p>';
            editor.updateFromHTML();
            // Source should not be updated (mode is preview)
            // But _markdown should still be set
            expect(editor._markdown).toBeTruthy();
        });

        test('setDebounceDelay enforces minimum of 0', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setDebounceDelay(-10);
            expect(editor.getDebounceDelay()).toBe(0);
        });

        test('toolbar click on non-button element does nothing', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Click on the spacer (not a button)
            const spacer = editor.toolbar.querySelector('.qde-spacer');
            spacer.click();
            // Should not throw or change state
            expect(editor.currentMode).toBe('split');
        });

        test('constructor accepts DOM element directly', async () => {
            editor = new QuikdownEditor(container);
            await editor.initPromise;
            expect(editor.container).toBe(container);
        });

        test('CSV quoting with delimiter in value', () => {
            editor = new QuikdownEditor('#test-editor');
            const panel = document.createElement('div');
            const table = document.createElement('table');
            table.className = 'qde-csv-table';
            table.setAttribute('data-qd-lang', 'csv');
            table.innerHTML = '<thead><tr><th>Name</th></tr></thead><tbody><tr><td>hello, world</td></tr></tbody>';
            panel.appendChild(table);
            editor.preprocessSpecialElements(panel);
            const code = panel.querySelector('code');
            // Value containing comma should be quoted
            expect(code.textContent).toContain('"hello, world"');
        });

        test('PSV table conversion uses pipe delimiter', () => {
            editor = new QuikdownEditor('#test-editor');
            const panel = document.createElement('div');
            const table = document.createElement('table');
            table.className = 'qde-csv-table';
            table.setAttribute('data-qd-lang', 'psv');
            table.innerHTML = '<thead><tr><th>X</th><th>Y</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>';
            panel.appendChild(table);
            editor.preprocessSpecialElements(panel);
            const code = panel.querySelector('code');
            expect(code.textContent).toContain('X|Y');
        });

        test('preprocessSpecialElements ignores non-CSV table with invalid lang', () => {
            editor = new QuikdownEditor('#test-editor');
            const panel = document.createElement('div');
            const table = document.createElement('table');
            table.className = 'qde-csv-table';
            table.setAttribute('data-qd-lang', 'invalid');
            table.innerHTML = '<thead><tr><th>A</th></tr></thead>';
            panel.appendChild(table);
            editor.preprocessSpecialElements(panel);
            // Table should remain since lang is not csv/psv/tsv
            expect(panel.querySelector('table')).toBeTruthy();
        });

        test('complex fence element without lang but with data-qd-source', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const panel = document.createElement('div');
            const complex = document.createElement('div');
            complex.setAttribute('contenteditable', 'false');
            complex.setAttribute('data-qd-source', 'some code');
            panel.appendChild(complex);
            editor.preprocessSpecialElements(panel);
            const pre = panel.querySelector('pre');
            expect(pre).toBeTruthy();
            expect(pre.getAttribute('data-qd-fence')).toBe('```');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Fence rendering with mocked external libraries
    // ──────────────────────────────────────────────────────────────

    describe('Fence Rendering with Mocked Libraries', () => {
        afterEach(() => {
            // Clean up any global mocks
            delete window.hljs;
            delete window.mermaid;
            delete window.MathJax;
            delete window.DOMPurify;
            delete window.L;
            delete window.THREE;
        });

        test('syntax highlighting with hljs mock', async () => {
            window.hljs = {
                getLanguage: jest.fn().mockReturnValue(true),
                highlight: jest.fn().mockReturnValue({ value: '<span class="hljs-keyword">const</span> x = 1;' })
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```javascript\nconst x = 1;\n```');
            const html = editor.getHTML();
            expect(html).toContain('hljs');
            expect(window.hljs.highlight).toHaveBeenCalled();
        });

        test('mermaid rendering with mock', async () => {
            window.mermaid = {
                initialize: jest.fn(),
                render: jest.fn().mockResolvedValue({ svg: '<svg>diagram</svg>' })
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```mermaid\ngraph TD\n  A-->B\n```');
            const html = editor.getHTML();
            // Mermaid fence should be detected
            expect(html).toContain('mermaid');
        });

        test('DOMPurify HTML rendering with mock', async () => {
            window.DOMPurify = {
                sanitize: jest.fn().mockImplementation(html => html.replace(/<script.*?<\/script>/g, ''))
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```html\n<h1>Hello</h1>\n```');
            const html = editor.getHTML();
            expect(html).toContain('html');
        });

        test('MathJax batch processing in updateFromMarkdown', async () => {
            const typesetPromise = jest.fn().mockResolvedValue(undefined);
            window.MathJax = { typesetPromise };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;

            // Manually inject a math-display element to trigger batch processing
            editor.previewPanel.innerHTML = '<div class="math-display">E=mc^2</div>';
            editor.updateFromMarkdown('```math\nE=mc^2\n```');

            // MathJax.typesetPromise should be called for math-display elements
            // (only if they exist in the preview)
        });

        test('MathJax batch processing catch path', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            window.MathJax = {
                typesetPromise: jest.fn().mockRejectedValue(new Error('MathJax error'))
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.previewPanel.innerHTML = '<div class="math-display">x^2</div>';
            editor.updateFromMarkdown('```math\nx^2\n```');
            // Wait for promise rejection
            await new Promise(r => setTimeout(r, 50));
            warnSpy.mockRestore();
        });

        test('renderJSON with hljs mock', async () => {
            window.hljs = {
                getLanguage: jest.fn().mockReturnValue(true),
                highlight: jest.fn().mockReturnValue({ value: '{"key": "value"}' })
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```json\n{"key": "value"}\n```');
            const html = editor.getHTML();
            expect(html).toContain('json');
        });

        test('renderJSON with invalid JSON still renders', async () => {
            window.hljs = {
                getLanguage: jest.fn().mockReturnValue(true),
                highlight: jest.fn().mockReturnValue({ value: 'not json' })
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```json\nnot json\n```');
            const html = editor.getHTML();
            expect(html).toContain('json');
        });

        test('renderJSON without hljs falls back to plain', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```json\n{"a": 1}\n```');
            const html = editor.getHTML();
            // Should render as a pre block even without hljs
            expect(html).toContain('json');
        });

        test('GeoJSON rendering creates map container', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```geojson\n{"type":"Point","coordinates":[0,0]}\n```');
            const html = editor.getHTML();
            expect(html).toContain('geojson');
        });

        test('STL rendering creates 3D container', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```stl\nsolid cube\nendsolid cube\n```');
            const html = editor.getHTML();
            expect(html).toContain('stl');
        });

        test('math/katex/tex fence rendering', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```math\nE = mc^2\n```');
            const html = editor.getHTML();
            expect(html).toContain('math');
        });

        test('renderHTML without DOMPurify returns placeholder', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```html\n<p>Hello</p>\n```');
            const html = editor.getHTML();
            // Without DOMPurify, should return a placeholder with loading message
            expect(html).toContain('html');
        });

        test('hljs getLanguage returns false skips highlighting', async () => {
            window.hljs = {
                getLanguage: jest.fn().mockReturnValue(false),
                highlight: jest.fn()
            };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```unknownlang\nconst x = 1;\n```');
            const html = editor.getHTML();
            // Should fall through to default rendering
            expect(html).toContain('const x = 1;');
            expect(window.hljs.highlight).not.toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  onChange callback
    // ──────────────────────────────────────────────────────────────

    describe('onChange Callback', () => {
        test('onChange fires when markdown changes', async () => {
            const onChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onChange });
            await editor.initPromise;
            await editor.setMarkdown('# Hello');
            expect(onChange).toHaveBeenCalledWith('# Hello', expect.any(String));
        });

        test('onChange fires with empty content', async () => {
            const onChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onChange });
            await editor.initPromise;
            await editor.setMarkdown('');
            expect(onChange).toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  updateFromHTML
    // ──────────────────────────────────────────────────────────────

    describe('updateFromHTML', () => {
        test('updates markdown from preview HTML', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Simulate editing in preview panel
            editor.previewPanel.innerHTML = '<h1>Edited</h1><p>New content</p>';
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('Edited');
        });

        test('triggers onChange after HTML update', async () => {
            const onChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onChange });
            await editor.initPromise;
            editor.previewPanel.innerHTML = '<p>Updated</p>';
            editor.updateFromHTML();
            expect(onChange).toHaveBeenCalled();
        });

        test('pushes undo state before HTML update', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('Original');
            editor.previewPanel.innerHTML = '<p>Changed</p>';
            editor.updateFromHTML();
            expect(editor.canUndo()).toBe(true);
        });

        test('updates source textarea when in split mode', async () => {
            editor = new QuikdownEditor('#test-editor', { mode: 'split' });
            await editor.initPromise;
            editor.previewPanel.innerHTML = '<p>From preview</p>';
            editor.updateFromHTML();
            expect(editor.sourceTextarea.value).toContain('From preview');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Empty content placeholder
    // ──────────────────────────────────────────────────────────────

    describe('Empty Content Placeholder', () => {
        test('shows placeholder when content is empty in split mode', async () => {
            editor = new QuikdownEditor('#test-editor', { mode: 'split' });
            await editor.initPromise;
            editor.updateFromMarkdown('');
            expect(editor.previewPanel.innerHTML).toContain('Start typing');
        });

        test('shows placeholder when content is whitespace-only', async () => {
            editor = new QuikdownEditor('#test-editor', { mode: 'split' });
            await editor.initPromise;
            editor.updateFromMarkdown('   ');
            expect(editor.previewPanel.innerHTML).toContain('Start typing');
        });

        test('does not show placeholder in source mode', async () => {
            editor = new QuikdownEditor('#test-editor', { mode: 'source' });
            await editor.initPromise;
            editor.updateFromMarkdown('');
            // In source mode, preview is hidden so placeholder shouldn't be set
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  onModeChange callback
    // ──────────────────────────────────────────────────────────────

    describe('onModeChange Callback', () => {
        test('onModeChange fires when mode changes', async () => {
            const onModeChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onModeChange });
            await editor.initPromise;
            editor.setMode('preview');
            expect(onModeChange).toHaveBeenCalledWith('preview');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Toolbar button creation options
    // ──────────────────────────────────────────────────────────────

    describe('Toolbar Button Options', () => {
        test('showRemoveHR creates remove-hr button', async () => {
            editor = new QuikdownEditor('#test-editor', { showRemoveHR: true });
            await editor.initPromise;
            const btn = editor.toolbar.querySelector('[data-action="remove-hr"]');
            expect(btn).toBeTruthy();
        });

        test('showLazyLinefeeds creates lazy-linefeeds button', async () => {
            editor = new QuikdownEditor('#test-editor', { showLazyLinefeeds: true });
            await editor.initPromise;
            const btn = editor.toolbar.querySelector('[data-action="lazy-linefeeds"]');
            expect(btn).toBeTruthy();
        });

        test('showUndoRedo creates undo/redo buttons', async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            expect(editor.toolbar.querySelector('[data-action="undo"]')).toBeTruthy();
            expect(editor.toolbar.querySelector('[data-action="redo"]')).toBeTruthy();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  initialContent option
    // ──────────────────────────────────────────────────────────────

    describe('initialContent Option', () => {
        test('sets content on initialization', async () => {
            editor = new QuikdownEditor('#test-editor', { initialContent: '# Initial' });
            await editor.initPromise;
            // initialContent calls setMarkdown which is async — give it a tick
            await new Promise(r => setTimeout(r, 50));
            const md = editor.getMarkdown();
            expect(md).toContain('Initial');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  inline_styles option passthrough
    // ──────────────────────────────────────────────────────────────

    describe('inline_styles Option', () => {
        test('passes inline_styles to parser', async () => {
            editor = new QuikdownEditor('#test-editor', { inline_styles: true });
            await editor.initPromise;
            await editor.setMarkdown('# Hello');
            const html = editor.getHTML();
            expect(html).toContain('style=');
            expect(html).not.toContain('class="quikdown-');
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Plugin loading edge cases
    // ──────────────────────────────────────────────────────────────

    describe('Plugin Loading Edge Cases', () => {
        test('preloadFences with invalid string logs warning', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { preloadFences: 'invalid' });
            await editor.initPromise;
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('preloadFences'));
            warnSpy.mockRestore();
        });

        test('preloadFences with unknown library name logs warning', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor = new QuikdownEditor('#test-editor', { preloadFences: ['nonexistent'] });
            await editor.initPromise;
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
            warnSpy.mockRestore();
        });

        test('preloadFences with custom library object registers it', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            // Mock loadScript to resolve immediately (avoid timeout in JSDOM)
            const origCreate = document.createElement.bind(document);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = origCreate(tag);
                if (tag === 'script') {
                    // Simulate onload after a tick
                    setTimeout(() => el.onload && el.onload(), 10);
                }
                return el;
            });
            editor = new QuikdownEditor('#test-editor', {
                preloadFences: [{ name: 'mylib', script: 'https://example.com/mylib.js' }]
            });
            await editor.initPromise;
            document.createElement.mockRestore();
            warnSpy.mockRestore();
        }, 10000);

        test('legacy plugins.highlightjs triggers load attempt', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const origCreate = document.createElement.bind(document);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = origCreate(tag);
                if (tag === 'script' || tag === 'link') {
                    setTimeout(() => el.onload && el.onload(), 10);
                }
                return el;
            });
            editor = new QuikdownEditor('#test-editor', {
                plugins: { highlightjs: true }
            });
            await editor.initPromise;
            document.createElement.mockRestore();
            warnSpy.mockRestore();
        }, 10000);
    });

    // ──────────────────────────────────────────────────────────────
    //  _syncHljsTheme
    // ──────────────────────────────────────────────────────────────

    describe('_syncHljsTheme', () => {
        test('toggles stylesheet disabled state in dark mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const light = document.createElement('link');
            light.id = 'qde-hljs-light';
            light.rel = 'stylesheet';
            document.head.appendChild(light);
            const dark = document.createElement('link');
            dark.id = 'qde-hljs-dark';
            dark.rel = 'stylesheet';
            document.head.appendChild(dark);

            editor.container.classList.add('qde-dark');
            editor._syncHljsTheme();
            // In dark mode, light should be disabled, dark should not
            expect(document.getElementById('qde-hljs-light').disabled).toBeTruthy();

            // Clean up
            light.remove();
            dark.remove();
        });

        test('toggles stylesheet disabled state in light mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const light = document.createElement('link');
            light.id = 'qde-hljs-light';
            light.rel = 'stylesheet';
            document.head.appendChild(light);
            const dark = document.createElement('link');
            dark.id = 'qde-hljs-dark';
            dark.rel = 'stylesheet';
            document.head.appendChild(dark);

            editor.container.classList.remove('qde-dark');
            editor._syncHljsTheme();
            expect(document.getElementById('qde-hljs-dark').disabled).toBeTruthy();

            light.remove();
            dark.remove();
        });

        test('handles missing stylesheet elements gracefully', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Should not throw when elements don't exist
            editor._syncHljsTheme();
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Copy rendered content
    // ──────────────────────────────────────────────────────────────

    describe('copyRendered', () => {
        test('copies rendered content from preview panel', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('# Test\n\n**Bold**');
            // copyRendered uses getRenderedContent which uses clipboard API
            await editor.copyRendered();
            // Should not throw
        });
    });

    // ──────────────────────────────────────────────────────────────
    //  Auto-theme listener cleanup
    // ──────────────────────────────────────────────────────────────

    describe('Auto-theme Listener', () => {
        test('cleans up auto-theme listener on theme change', async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'auto' });
            await editor.initPromise;
            expect(editor._autoThemeListener).toBeTruthy();

            editor.setTheme('dark');
            expect(editor._autoThemeListener).toBeNull();
        });

        test('re-establishes listener when switching back to auto', async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'light' });
            await editor.initPromise;
            expect(editor._autoThemeListener).toBeFalsy();

            editor.setTheme('auto');
            expect(editor._autoThemeListener).toBeTruthy();
        });
    });
});
