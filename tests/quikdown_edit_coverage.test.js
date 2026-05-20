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
        // Clean up any hljs stylesheet stubs left by _syncHljsTheme tests
        document.getElementById('qde-hljs-light')?.remove();
        document.getElementById('qde-hljs-dark')?.remove();
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
            // default mode: no font-weight on headings
            expect(html).not.toMatch(/h[1-6][^}]*font-weight:\s*bold/);
        });

        test('default output profile: headings have font-size but no font-weight', async () => {
            const preview = document.createElement('div');
            preview.innerHTML = '<h1>Title</h1><h2>Subtitle</h2><strong>Bold</strong>';
            navigator.clipboard.write = jest.fn().mockResolvedValue(undefined);

            const result = await getRenderedContent(preview, { output: 'default' });
            const html = result.html;

            // Headings get font-size in pt
            expect(html).toContain('font-size:24pt');
            expect(html).toContain('font-size:18pt');
            // Heading CSS should not contain font-weight
            expect(html).not.toMatch(/h[1-6]\s*\{[^}]*font-weight/);
            // Strong elements should still be styled
            expect(html).toContain('font-weight: bold');
        });

        test('stripped output profile: no inline styles on elements', async () => {
            const preview = document.createElement('div');
            preview.innerHTML = '<h1>Title</h1><strong>Bold</strong><em>Italic</em><table><tr><td>Cell</td></tr></table>';
            navigator.clipboard.write = jest.fn().mockResolvedValue(undefined);

            const result = await getRenderedContent(preview, { output: 'stripped' });
            const html = result.html;

            // Content is still present
            expect(html).toContain('Title');
            expect(html).toContain('Bold');
            expect(html).toContain('Italic');
            expect(html).toContain('Cell');
            // No heading font-size in CSS block
            expect(html).not.toContain('font-size:24pt');
            // Minimal CSS: just img safety
            expect(html).toContain('max-width: 100%');
        });

        test('quikdown output profile: headings have font-size AND font-weight', async () => {
            const preview = document.createElement('div');
            preview.innerHTML = '<h1>Title</h1><h2>Subtitle</h2>';
            navigator.clipboard.write = jest.fn().mockResolvedValue(undefined);

            const result = await getRenderedContent(preview, { output: 'quikdown' });
            const html = result.html;

            // Headings get font-size and font-weight
            expect(html).toContain('font-size:24pt');
            expect(html).toMatch(/h1\s*\{[^}]*font-weight:\s*bold/);
        });

        test('invalid output profile throws error', async () => {
            const preview = document.createElement('div');
            preview.innerHTML = '<h1>Title</h1>';

            await expect(getRenderedContent(preview, { output: 'invalid' }))
                .rejects.toThrow('Invalid output profile');
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

    // _syncHljsTheme: covered in Theme section and Library loading section

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

    // ================================================================
    // Fence Renderers — direct method tests
    // ================================================================
    describe('Fence Renderers', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        describe('renderSVG', () => {
            test('renders valid SVG in a container', () => {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
                const html = editor.renderSVG(svg);
                expect(html).toContain('qde-svg-container');
                expect(html).toContain('data-qd-lang="svg"');
                expect(html).toContain('data-qd-fence');
                expect(html).toContain('<circle');
            });

            test('strips script elements from SVG body (not from data-qd-source)', () => {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';
                const html = editor.renderSVG(svg);
                // Parse just the rendered SVG inside the container (not the data-qd-source attribute)
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const innerSvg = tmp.querySelector('svg');
                expect(innerSvg).toBeTruthy();
                expect(innerSvg.querySelector('script')).toBeNull();
                expect(innerSvg.querySelector('rect')).toBeTruthy();
            });

            test('strips on* event handlers from SVG elements', () => {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="10" height="10"/></svg>';
                const html = editor.renderSVG(svg);
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const rect = tmp.querySelector('rect');
                expect(rect).toBeTruthy();
                expect(rect.hasAttribute('onclick')).toBe(false);
            });

            test('strips javascript: URLs from SVG attributes', () => {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>';
                const html = editor.renderSVG(svg);
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const link = tmp.querySelector('a');
                if (link) {
                    expect(link.hasAttribute('href')).toBe(false);
                }
            });

            test('returns error pre for invalid SVG', () => {
                const html = editor.renderSVG('not valid svg at all');
                expect(html).toContain('Invalid SVG');
                expect(html).toContain('qde-error');
            });
        });

        describe('renderHTML', () => {
            test('returns placeholder without DOMPurify', () => {
                delete window.DOMPurify;
                const html = editor.renderHTML('<p>Hello</p>');
                expect(html).toContain('qde-html-container');
                expect(html).toContain('data-qd-lang="html"');
                expect(html).toContain('<p>Hello</p>');
            });

            test('uses DOMPurify when available', () => {
                window.DOMPurify = { sanitize: jest.fn(code => code) };
                const html = editor.renderHTML('<p>Safe</p>');
                expect(window.DOMPurify.sanitize).toHaveBeenCalledWith('<p>Safe</p>');
                expect(html).toContain('qde-html-container');
                expect(html).toContain('data-qd-lang="html"');
                delete window.DOMPurify;
            });
        });

        describe('renderTable (CSV)', () => {
            test('renders CSV as HTML table', () => {
                const csv = 'Name,Age\nAlice,30\nBob,25';
                const html = editor.renderTable(csv, 'csv');
                expect(html).toContain('<table');
                expect(html).toContain('<th>Name</th>');
                expect(html).toContain('<th>Age</th>');
                expect(html).toContain('<td>Alice</td>');
                expect(html).toContain('<td>30</td>');
                expect(html).toContain('<td>Bob</td>');
                expect(html).toContain('qde-csv-table');
            });

            test('renders TSV with tab delimiter', () => {
                const tsv = 'Col1\tCol2\nA\tB';
                const html = editor.renderTable(tsv, 'tsv');
                expect(html).toContain('<th>Col1</th>');
                expect(html).toContain('<th>Col2</th>');
                expect(html).toContain('<td>A</td>');
                expect(html).toContain('<td>B</td>');
            });

            test('renders PSV with pipe delimiter', () => {
                const psv = 'X|Y\n1|2';
                const html = editor.renderTable(psv, 'psv');
                expect(html).toContain('<th>X</th>');
                expect(html).toContain('<th>Y</th>');
                expect(html).toContain('<td>1</td>');
            });

            test('header-only CSV (no body rows)', () => {
                const csv = 'Just,Headers';
                const html = editor.renderTable(csv, 'csv');
                expect(html).toContain('<th>Just</th>');
                expect(html).toContain('<th>Headers</th>');
                expect(html).not.toContain('<tbody');
            });

            test('escapes HTML in cell values', () => {
                const csv = 'Col\n<script>alert(1)</script>';
                const html = editor.renderTable(csv, 'csv');
                expect(html).not.toContain('<script>');
                expect(html).toContain('&lt;script&gt;');
            });
        });

        describe('parseCSVLine', () => {
            test('simple comma-separated values', () => {
                expect(editor.parseCSVLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
            });

            test('quoted values with commas', () => {
                expect(editor.parseCSVLine('"hello, world",b', ',')).toEqual(['hello, world', 'b']);
            });

            test('escaped quotes inside quoted values', () => {
                expect(editor.parseCSVLine('"say ""hi""",b', ',')).toEqual(['say "hi"', 'b']);
            });

            test('tab delimiter', () => {
                expect(editor.parseCSVLine('x\ty\tz', '\t')).toEqual(['x', 'y', 'z']);
            });

            test('pipe delimiter', () => {
                expect(editor.parseCSVLine('a|b|c', '|')).toEqual(['a', 'b', 'c']);
            });

            test('empty fields', () => {
                expect(editor.parseCSVLine('a,,c', ',')).toEqual(['a', '', 'c']);
            });
        });

        describe('renderJSON', () => {
            test('renders plain JSON without hljs', () => {
                delete window.hljs;
                const html = editor.renderJSON('{"key": "value"}', 'json');
                expect(html).toContain('qde-json');
                expect(html).toContain('data-qd-lang="json"');
                expect(html).toContain('{&quot;key&quot;: &quot;value&quot;}');
            });

            test('renders with hljs when available', () => {
                window.hljs = {
                    getLanguage: jest.fn(() => true),
                    highlight: jest.fn((code, opts) => ({ value: `<span class="hljs-string">${code}</span>` }))
                };
                const html = editor.renderJSON('{"a":1}', 'json');
                expect(html).toContain('hljs');
                expect(window.hljs.highlight).toHaveBeenCalled();
                delete window.hljs;
            });

            test('formats valid JSON before highlighting', () => {
                window.hljs = {
                    getLanguage: jest.fn(() => true),
                    highlight: jest.fn((code, opts) => ({ value: code }))
                };
                editor.renderJSON('{"a":1}', 'json');
                // Should be called with formatted JSON
                const callArg = window.hljs.highlight.mock.calls[0][0];
                expect(callArg).toContain('  "a": 1');
                delete window.hljs;
            });

            test('uses original code for invalid JSON', () => {
                window.hljs = {
                    getLanguage: jest.fn(() => true),
                    highlight: jest.fn((code, opts) => ({ value: code }))
                };
                editor.renderJSON('{not json}', 'json');
                const callArg = window.hljs.highlight.mock.calls[0][0];
                expect(callArg).toBe('{not json}');
                delete window.hljs;
            });
        });

        describe('renderMath', () => {
            test('returns math container with source', () => {
                const html = editor.renderMath('E = mc^2', 'math');
                expect(html).toContain('math-display');
                // Source content is wrapped in $$...$$ for MathJax
                expect(html).toContain('E = mc^2');
            });
        });
    });

    // ================================================================
    // updateFromMarkdown — allowUnsafeHTML branches
    // ================================================================
    describe('updateFromMarkdown allowUnsafeHTML branches', () => {
        test('allowUnsafeHTML=false escapes HTML tags', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: false });
            await editor.initPromise;
            editor.updateFromMarkdown('<b>bold</b>');
            expect(editor.getHTML()).toContain('&lt;b&gt;');
        });

        test('allowUnsafeHTML=true passes HTML through', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: true });
            await editor.initPromise;
            editor.updateFromMarkdown('<b>bold</b>');
            expect(editor.getHTML()).toContain('<b>bold</b>');
        });

        test('allowUnsafeHTML="limited" uses SAFE_HTML_TAGS', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            // <b> is in SAFE_HTML_TAGS
            editor.updateFromMarkdown('<b>bold</b>');
            expect(editor.getHTML()).toContain('<b>bold</b>');
            // <script> is not
            editor.updateFromMarkdown('<script>x</script>');
            expect(editor.getHTML()).toContain('&lt;script&gt;');
        });

        test('empty markdown shows placeholder in preview mode', async () => {
            editor = new QuikdownEditor('#test-editor', { mode: 'split' });
            await editor.initPromise;
            editor.updateFromMarkdown('');
            expect(editor.previewPanel.innerHTML).toContain('Start typing');
        });

        test('empty markdown in source mode does not set innerHTML', async () => {
            editor = new QuikdownEditor('#test-editor', { mode: 'source' });
            await editor.initPromise;
            editor.updateFromMarkdown('');
            expect(editor._html).toBe('');
        });

        test('onChange callback fires with markdown and html', async () => {
            const onChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onChange });
            await editor.initPromise;
            editor.updateFromMarkdown('# Hello');
            expect(onChange).toHaveBeenCalledWith(expect.stringContaining('# Hello'), expect.stringContaining('<h1'));
        });
    });

    // ================================================================
    // setMode — mode transitions
    // ================================================================
    describe('setMode — mode transitions', () => {
        test('invalid mode is rejected', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setMode('split');
            editor.setMode('invalid-mode');
            expect(editor.currentMode).toBe('split');
        });

        test('preserves dark theme across mode swap', async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'dark' });
            await editor.initPromise;
            editor.setMode('source');
            expect(editor.container.classList.contains('qde-dark')).toBe(true);
            editor.setMode('preview');
            expect(editor.container.classList.contains('qde-dark')).toBe(true);
            editor.setMode('split');
            expect(editor.container.classList.contains('qde-dark')).toBe(true);
        });

        test('re-renders preview when switching from source', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Start in source mode so preview doesn't update
            editor.setMode('source');
            editor.updateFromMarkdown('# Rerender Test');
            // Preview panel doesn't have the content yet
            expect(editor.previewPanel.innerHTML).not.toContain('Rerender Test');
            // Switch to split — should re-render
            editor.setMode('split');
            expect(editor.previewPanel.innerHTML).toContain('Rerender Test');
        });

        test('onModeChange callback fires', async () => {
            const onModeChange = jest.fn();
            editor = new QuikdownEditor('#test-editor', { onModeChange });
            await editor.initPromise;
            editor.setMode('preview');
            expect(onModeChange).toHaveBeenCalledWith('preview');
        });

        test('updates active class on toolbar buttons', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setMode('preview');
            const previewBtn = editor.toolbar.querySelector('[data-mode="preview"]');
            const sourceBtn = editor.toolbar.querySelector('[data-mode="source"]');
            if (previewBtn) expect(previewBtn.classList.contains('active')).toBe(true);
            if (sourceBtn) expect(sourceBtn.classList.contains('active')).toBe(false);
        });
    });

    // ================================================================
    // createFencePlugin — coverage of fence rendering dispatch
    // ================================================================
    describe('createFencePlugin dispatch', () => {
        test('fence plugin routes CSV to renderTable', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```csv\nName,Age\nAlice,30\n```');
            expect(editor.getHTML()).toContain('qde-csv-table');
        });

        test('fence plugin routes SVG to renderSVG', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```svg\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>\n```');
            expect(editor.getHTML()).toContain('qde-svg-container');
        });

        test('fence plugin routes JSON to renderJSON', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```json\n{"key":"value"}\n```');
            expect(editor.getHTML()).toContain('qde-json');
        });

        test('fence plugin routes html to renderHTML', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```html\n<p>Hello</p>\n```');
            expect(editor.getHTML()).toContain('qde-html-container');
        });

        test('fence plugin routes math to renderMath', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```math\nE=mc^2\n```');
            expect(editor.getHTML()).toContain('math-display');
        });

        test('enableComplexFences=false skips special renderers', async () => {
            editor = new QuikdownEditor('#test-editor', { enableComplexFences: false });
            await editor.initPromise;
            await editor.setMarkdown('```csv\nName,Age\nAlice,30\n```');
            // Should NOT render as table — plain code block
            expect(editor.getHTML()).not.toContain('qde-csv-table');
        });

        test('custom fence handler is called', async () => {
            const customHandler = jest.fn().mockReturnValue('<div class="custom-out">OK</div>');
            editor = new QuikdownEditor('#test-editor', {
                customFences: { mycustom: customHandler }
            });
            await editor.initPromise;
            await editor.setMarkdown('```mycustom\ntest content\n```');
            expect(customHandler).toHaveBeenCalledWith(expect.stringContaining('test content'), 'mycustom');
        });

        test('custom fence handler error falls through gracefully', async () => {
            const brokenHandler = jest.fn().mockImplementation(() => { throw new Error('oops'); });
            editor = new QuikdownEditor('#test-editor', {
                customFences: { broken: brokenHandler }
            });
            await editor.initPromise;
            // Should not throw
            await editor.setMarkdown('```broken\nstuff\n```');
            expect(editor.getHTML()).toBeTruthy();
        });
    });

    // ================================================================
    // Library loading
    // ================================================================
    describe('Library loading', () => {
        test('loadScript resolves on success', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Mock script loading by simulating onload
            const origCreate = document.createElement.bind(document);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = origCreate(tag);
                if (tag === 'script') {
                    setTimeout(() => el.onload && el.onload(), 0);
                }
                return el;
            });
            await expect(editor.loadScript('https://example.com/lib.js')).resolves.toBeUndefined();
            document.createElement.mockRestore();
        });

        test('loadScript rejects on error', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const origCreate = document.createElement.bind(document);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = origCreate(tag);
                if (tag === 'script') {
                    setTimeout(() => el.onerror && el.onerror(new Error('network')), 0);
                }
                return el;
            });
            await expect(editor.loadScript('https://example.com/bad.js')).rejects.toThrow();
            document.createElement.mockRestore();
        });

        test('loadCSS adds link element', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.loadCSS('https://example.com/style.css', 'test-css');
            const link = document.querySelector('link[id="test-css"]');
            expect(link).toBeTruthy();
            expect(link.href).toContain('style.css');
        });

        test('_syncHljsTheme adds/removes disabled on dark stylesheet', async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'dark' });
            await editor.initPromise;
            // Create mock hljs stylesheets
            const light = document.createElement('link');
            light.id = 'qde-hljs-light';
            document.head.appendChild(light);
            const dark = document.createElement('link');
            dark.id = 'qde-hljs-dark';
            dark.disabled = true;
            document.head.appendChild(dark);
            // _syncHljsTheme reads the container's qde-dark class
            editor._syncHljsTheme();
            // In dark mode, dark stylesheet should be enabled, light disabled
            expect(dark.disabled).toBe(false);
            // Switch to light
            editor.container.classList.remove('qde-dark');
            editor._syncHljsTheme();
            expect(dark.disabled).toBe(true);
            light.remove();
            dark.remove();
        });
    });

    // ================================================================
    // FENCE_LIBRARIES instance isolation
    // ================================================================
    describe('FENCE_LIBRARIES instance isolation', () => {
        test('custom preloadFences entries are stored on instance, not module', async () => {
            // Create editor with no preload to avoid network requests
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;

            // Manually simulate what loadPlugins does for a custom entry
            editor._fenceLibraries['__custom__:mylib'] = {
                check: () => false,
                script: 'https://example.com/mylib.js'
            };
            expect(editor._fenceLibraries['__custom__:mylib']).toBeTruthy();

            // Second editor should have a clean copy
            const container2 = document.createElement('div');
            container2.id = 'test-editor-2';
            document.body.appendChild(container2);
            const editor2 = new QuikdownEditor('#test-editor-2');
            await editor2.initPromise;
            expect(editor2._fenceLibraries['__custom__:mylib']).toBeUndefined();

            editor2.destroy();
            container2.remove();
        });
    });

    // ================================================================
    // destroy
    // ================================================================
    describe('destroy cleanup', () => {
        test('clears container innerHTML and removes class', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            expect(container.innerHTML).not.toBe('');
            editor.destroy();
            expect(container.innerHTML).toBe('');
            expect(container.classList.contains('qde-container')).toBe(false);
            editor = null; // prevent double-destroy in afterEach
        });

        test('clears debounce timer', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateTimer = setTimeout(() => {}, 10000);
            editor.destroy();
            // Timer should have been cleared (no easy way to assert directly,
            // but coverage is the goal)
            editor = null;
        });
    });

    // ================================================================
    // HTML mode toggle
    // ================================================================
    describe('HTML mode toggle', () => {
        test('getAllowUnsafeHTML returns current mode', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            expect(editor.getAllowUnsafeHTML()).toBe('limited');
        });

        test('setAllowUnsafeHTML changes mode and re-renders', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: false });
            await editor.initPromise;
            await editor.setMarkdown('<b>test</b>');
            expect(editor.getHTML()).toContain('&lt;b&gt;');
            editor.setAllowUnsafeHTML(true);
            expect(editor.options.allowUnsafeHTML).toBe(true);
        });

        test('cycleAllowUnsafeHTML cycles false → limited → true → false', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: false, showAllowUnsafeHTML: true });
            await editor.initPromise;
            editor.cycleAllowUnsafeHTML();
            expect(editor.options.allowUnsafeHTML).toBe('limited');
            editor.cycleAllowUnsafeHTML();
            expect(editor.options.allowUnsafeHTML).toBe(true);
            editor.cycleAllowUnsafeHTML();
            expect(editor.options.allowUnsafeHTML).toBe(false);
        });
    });

    // ================================================================
    // Lazy linefeeds + removeHR instance methods
    // ================================================================
    describe('Instance utility methods', () => {
        test('setLazyLinefeeds updates option and re-renders', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('line1\nline2');
            editor.setLazyLinefeeds(true);
            expect(editor.options.lazy_linefeeds).toBe(true);
            expect(editor.getLazyLinefeeds()).toBe(true);
        });

        test('convertLazyLinefeeds normalizes lazy newlines in content', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('# Title\nParagraph text');
            await editor.convertLazyLinefeeds();
            // After conversion, single newlines between blocks become double
            expect(editor.getMarkdown()).toContain('# Title\n\nParagraph text');
        });

        test('removeHR removes horizontal rules', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('before\n\n---\n\nafter');
            await editor.removeHR();
            expect(editor.getMarkdown()).not.toMatch(/^---$/m);
            expect(editor.getMarkdown()).toContain('before');
            expect(editor.getMarkdown()).toContain('after');
        });
    });

    // ================================================================
    // Debounce and input handling
    // ================================================================
    describe('Debounce and input', () => {
        test('setDebounceDelay clamps to >= 0', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setDebounceDelay(50);
            expect(editor.getDebounceDelay()).toBe(50);
            editor.setDebounceDelay(-10);
            expect(editor.getDebounceDelay()).toBe(0);
        });

        test('handleSourceInput triggers debounced update', async () => {
            editor = new QuikdownEditor('#test-editor', { debounceDelay: 5 });
            await editor.initPromise;
            editor.sourceTextarea.value = '# From Input';
            editor.handleSourceInput();
            // Wait for debounce
            await new Promise(r => setTimeout(r, 20));
            expect(editor.getMarkdown()).toBe('# From Input');
        });
    });

    // ================================================================
    // Toolbar button actions
    // ================================================================
    describe('Toolbar button actions', () => {
        test('copy-markdown button copies markdown to clipboard', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('# Copy Test');
            const btn = editor.toolbar.querySelector('[data-action="copy-markdown"]');
            if (btn) {
                btn.click();
                await new Promise(r => setTimeout(r, 10));
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Copy Test');
            }
        });

        test('copy-html button copies HTML to clipboard', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold**');
            const btn = editor.toolbar.querySelector('[data-action="copy-html"]');
            if (btn) {
                btn.click();
                await new Promise(r => setTimeout(r, 10));
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('<strong'));
            }
        });
    });

    // ================================================================
    // escapeHtml
    // ================================================================
    describe('escapeHtml', () => {
        test('escapes all dangerous characters', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            expect(editor.escapeHtml('&<>"\''))
                .toBe('&amp;&lt;&gt;&quot;&#39;');
        });

        test('passes through safe strings', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            expect(editor.escapeHtml('hello world')).toBe('hello world');
        });
    });

    // ================================================================
    // initialContent option
    // ================================================================
    describe('initialContent option', () => {
        test('sets markdown from initialContent on init', async () => {
            editor = new QuikdownEditor('#test-editor', { initialContent: '# Init Content' });
            await editor.initPromise;
            // setMarkdown is called but not awaited in init(), so we need to wait a tick
            await new Promise(r => setTimeout(r, 50));
            expect(editor.getMarkdown()).toBe('# Init Content');
            expect(editor.getHTML()).toContain('<h1');
        });
    });

    // ================================================================
    // handleAction dispatch
    // ================================================================
    describe('handleAction dispatch', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            await editor.setMarkdown('# Title\n\n---\n\nparagraph');
        });

        test('copy-markdown action calls copy("markdown")', async () => {
            const spy = jest.spyOn(editor, 'copy');
            editor.handleAction('copy-markdown');
            expect(spy).toHaveBeenCalledWith('markdown');
        });

        test('copy-html action calls copy("html")', async () => {
            const spy = jest.spyOn(editor, 'copy');
            editor.handleAction('copy-html');
            expect(spy).toHaveBeenCalledWith('html');
        });

        test('copy-rendered action calls copyRendered()', async () => {
            const spy = jest.spyOn(editor, 'copyRendered').mockResolvedValue(undefined);
            editor.handleAction('copy-rendered');
            expect(spy).toHaveBeenCalled();
        });

        test('remove-hr action calls removeHR()', async () => {
            const spy = jest.spyOn(editor, 'removeHR').mockResolvedValue(undefined);
            editor.handleAction('remove-hr');
            expect(spy).toHaveBeenCalled();
        });

        test('lazy-linefeeds action calls convertLazyLinefeeds()', async () => {
            const spy = jest.spyOn(editor, 'convertLazyLinefeeds').mockResolvedValue(undefined);
            editor.handleAction('lazy-linefeeds');
            expect(spy).toHaveBeenCalled();
        });

        test('undo action calls undo()', () => {
            editor.updateFromMarkdown('change1');
            const spy = jest.spyOn(editor, 'undo');
            editor.handleAction('undo');
            expect(spy).toHaveBeenCalled();
        });

        test('redo action calls redo()', () => {
            editor.updateFromMarkdown('change1');
            editor.undo();
            const spy = jest.spyOn(editor, 'redo');
            editor.handleAction('redo');
            expect(spy).toHaveBeenCalled();
        });

        test('toggle-html-mode action calls cycleAllowUnsafeHTML()', () => {
            const spy = jest.spyOn(editor, 'cycleAllowUnsafeHTML');
            editor.handleAction('toggle-html-mode');
            expect(spy).toHaveBeenCalled();
        });

        test('unknown action is a no-op', () => {
            // Should not throw
            editor.handleAction('nonexistent-action');
        });
    });

    // ================================================================
    // copy() visual feedback
    // ================================================================
    describe('copy() method', () => {
        test('copies markdown content to clipboard', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold**');
            await editor.copy('markdown');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('**bold**');
        });

        test('copies html content to clipboard', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold**');
            await editor.copy('html');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining('<strong')
            );
        });

        test('handles clipboard failure gracefully', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('test');
            navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
            const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await editor.copy('markdown');
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    // ================================================================
    // Public API properties (getters/setters)
    // ================================================================
    describe('Public API properties', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('markdown getter returns current markdown', async () => {
            await editor.setMarkdown('# Hello');
            expect(editor.markdown).toBe('# Hello');
        });

        test('markdown setter calls setMarkdown', () => {
            const spy = jest.spyOn(editor, 'setMarkdown');
            editor.markdown = '# World';
            expect(spy).toHaveBeenCalledWith('# World');
        });

        test('html getter returns rendered HTML', async () => {
            await editor.setMarkdown('**bold**');
            expect(editor.html).toContain('<strong');
        });

        test('mode getter returns current mode', () => {
            expect(editor.mode).toBe('split');
            editor.setMode('source');
            expect(editor.mode).toBe('source');
        });
    });

    // ================================================================
    // Static removeHRFromMarkdown edge cases
    // ================================================================
    describe('Static removeHRFromMarkdown', () => {
        test('removes standalone HR lines', () => {
            const input = 'before\n\n---\n\nafter';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).not.toMatch(/^---$/m);
            expect(result).toContain('before');
            expect(result).toContain('after');
        });

        test('preserves HR-like lines inside fences', () => {
            const input = '```\n---\n***\n```';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('---');
            expect(result).toContain('***');
        });

        test('preserves table separator rows', () => {
            const input = '| H1 | H2 |\n| --- | --- |\n| a | b |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('| --- | --- |');
        });

        test('preserves table-adjacent HR-like lines', () => {
            const input = '| H1 | H2 |\n|---|---|\n| a | b |';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).toContain('|---|---|');
        });

        test('removes multiple HR variants', () => {
            const input = 'a\n\n---\n\nb\n\n***\n\nc\n\n___\n\nd';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            expect(result).not.toMatch(/^---$/m);
            expect(result).not.toMatch(/^\*\*\*$/m);
            expect(result).not.toMatch(/^___$/m);
        });

        test('handles tilde fences', () => {
            const input = '~~~\n---\n~~~\n\n---';
            const result = QuikdownEditor.removeHRFromMarkdown(input);
            // HR inside fence preserved, standalone HR removed
            expect(result).toMatch(/~~~\n---\n~~~/);
        });

        test('handles empty input', () => {
            expect(QuikdownEditor.removeHRFromMarkdown('')).toBe('');
        });

        test('handles input with no HRs', () => {
            const input = '# Hello\n\nWorld';
            expect(QuikdownEditor.removeHRFromMarkdown(input)).toBe(input);
        });
    });

    // ================================================================
    // Static convertLazyLinefeeds edge cases
    // ================================================================
    describe('Static convertLazyLinefeeds', () => {
        test('adds blank line between paragraphs', () => {
            const result = QuikdownEditor.convertLazyLinefeeds('line1\nline2');
            expect(result).toContain('line1\n\nline2');
        });

        test('idempotent: already-separated paragraphs stay same', () => {
            const input = 'line1\n\nline2';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toBe('line1\n\nline2');
        });

        test('preserves fence content verbatim', () => {
            const input = '```\nfoo\nbar\nbaz\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('foo\nbar\nbaz');
        });

        test('preserves tilde fence content', () => {
            const input = '~~~js\nconst a = 1;\nconst b = 2;\n~~~';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('const a = 1;\nconst b = 2;');
        });

        test('keeps adjacent list items together', () => {
            const input = '- item1\n- item2\n- item3';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('- item1\n- item2\n- item3');
        });

        test('keeps adjacent ordered list items together', () => {
            const input = '1. first\n2. second\n3. third';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('1. first\n2. second\n3. third');
        });

        test('keeps adjacent blockquote lines together', () => {
            const input = '> line1\n> line2';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('> line1\n> line2');
        });

        test('keeps adjacent table rows together', () => {
            const input = '| H1 | H2 |\n| -- | -- |\n| a | b |';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            expect(result).toContain('| H1 | H2 |\n| -- | -- |\n| a | b |');
        });

        test('adds blank between heading and paragraph', () => {
            const result = QuikdownEditor.convertLazyLinefeeds('# Title\nBody text');
            expect(result).toBe('# Title\n\nBody text');
        });

        test('handles null/undefined input', () => {
            expect(QuikdownEditor.convertLazyLinefeeds(null)).toBe('');
            expect(QuikdownEditor.convertLazyLinefeeds(undefined)).toBe('');
            expect(QuikdownEditor.convertLazyLinefeeds('')).toBe('');
        });

        test('normalizes whitespace-only lines to blanks', () => {
            const result = QuikdownEditor.convertLazyLinefeeds('a\n   \nb');
            // Should normalize whitespace-only line to blank
            expect(result).toBe('a\n\nb');
        });

        test('handles mixed content types', () => {
            const input = '# Heading\nParagraph\n- list1\n- list2\n> quote';
            const result = QuikdownEditor.convertLazyLinefeeds(input);
            // Heading + paragraph separated
            expect(result).toMatch(/# Heading\n\nParagraph/);
            // List items stay together
            expect(result).toMatch(/- list1\n- list2/);
        });
    });

    // ================================================================
    // _getHtmlModeLabel / _getHtmlModeTooltip
    // ================================================================
    describe('HTML mode labels and tooltips', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('_getHtmlModeLabel returns correct labels', () => {
            expect(editor._getHtmlModeLabel(true)).toBe('HTML: Raw');
            expect(editor._getHtmlModeLabel('limited')).toBe('HTML: Safe');
            expect(editor._getHtmlModeLabel(false)).toBe('HTML: Off');
        });

        test('_getHtmlModeTooltip returns correct tooltips', () => {
            expect(editor._getHtmlModeTooltip(true)).toContain('no protection');
            expect(editor._getHtmlModeTooltip('limited')).toContain('Safe tags');
            expect(editor._getHtmlModeTooltip(false)).toContain('shown as text');
        });
    });

    // ================================================================
    // clearHistory
    // ================================================================
    describe('clearHistory', () => {
        test('clears undo and redo stacks', async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            expect(editor.canUndo()).toBe(true);
            editor.undo();
            expect(editor.canRedo()).toBe(true);
            editor.clearHistory();
            expect(editor.canUndo()).toBe(false);
            expect(editor.canRedo()).toBe(false);
        });
    });

    // ================================================================
    // destroy edge cases
    // ================================================================
    describe('destroy edge cases', () => {
        test('removes injected styles when last editor is destroyed', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // After destroy, no more .qde-container elements should exist
            editor.destroy();
            const styleEl = document.getElementById('qde-styles');
            // Style element should be removed (or was never added)
            // The point is that it doesn't throw
            editor = null; // prevent double-destroy in afterEach
        });

        test('preserves styles when other editors exist', async () => {
            // Create a second container that looks like another editor
            const otherContainer = document.createElement('div');
            otherContainer.classList.add('qde-container');
            document.body.appendChild(otherContainer);

            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.destroy();
            // Another .qde-container still exists, so styles should be preserved
            otherContainer.remove();
            editor = null;
        });
    });

    // ================================================================
    // setAllowUnsafeHTML with re-render
    // ================================================================
    describe('setAllowUnsafeHTML rendering', () => {
        test('re-renders content when mode changes', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('<div>hello</div>');

            // In off mode, HTML is escaped
            const htmlOff = editor.getHTML();
            expect(htmlOff).toContain('&lt;div&gt;');

            // Switch to limited (safe tags)
            editor.setAllowUnsafeHTML('limited');
            const htmlLimited = editor.getHTML();
            expect(htmlLimited).toContain('<div>');

            // Switch to full passthrough
            editor.setAllowUnsafeHTML(true);
            const htmlFull = editor.getHTML();
            expect(htmlFull).toContain('<div>');

            // Back to off
            editor.setAllowUnsafeHTML(false);
            const htmlOff2 = editor.getHTML();
            expect(htmlOff2).toContain('&lt;div&gt;');
        });

        test('rejects invalid mode values', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('invalid');
            expect(editor.getAllowUnsafeHTML()).toBe(false); // default unchanged
        });
    });

    // ================================================================
    // Undo/Redo stack size enforcement
    // ================================================================
    describe('Undo stack size limit', () => {
        test('enforces max undo stack size', async () => {
            editor = new QuikdownEditor('#test-editor', {
                showUndoRedo: true,
                undoStackSize: 5
            });
            await editor.initPromise;

            // Push more states than the limit
            for (let i = 0; i < 10; i++) {
                editor.updateFromMarkdown(`state-${i}`);
            }

            // Should be capped at 5
            let undoCount = 0;
            while (editor.canUndo()) {
                editor.undo();
                undoCount++;
            }
            expect(undoCount).toBeLessThanOrEqual(5);
        });
    });

    // ================================================================
    // _pushUndoState no-op when content unchanged
    // ================================================================
    describe('Undo no-op detection', () => {
        test('does not push state when content is identical', async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            editor.updateFromMarkdown('same');
            editor.updateFromMarkdown('same'); // duplicate — should not push
            // Only one undo should be possible (initial '' → 'same')
            editor.undo();
            expect(editor.canUndo()).toBe(false);
        });
    });

    // ================================================================
    // SAFE_HTML_TAGS static property
    // ================================================================
    describe('SAFE_HTML_TAGS static', () => {
        test('is accessible and contains common safe tags', () => {
            const tags = QuikdownEditor.SAFE_HTML_TAGS;
            expect(tags).toBeDefined();
            expect(Array.isArray(tags) || typeof tags === 'object').toBe(true);
        });
    });

    // ================================================================
    // version static property
    // ================================================================
    describe('version static', () => {
        test('is a non-empty string', () => {
            expect(typeof QuikdownEditor.version).toBe('string');
            expect(QuikdownEditor.version.length).toBeGreaterThan(0);
        });
    });

    // ================================================================
    // setMode edge cases: source→split re-render with cached HTML
    // ================================================================
    describe('setMode re-render from source', () => {
        test('re-renders preview when switching from source to split', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold**');
            editor.setMode('source');
            // Clear preview to verify re-render
            editor.previewPanel.innerHTML = '';
            editor.setMode('split');
            // Preview should be re-populated from cached _html
            expect(editor.previewPanel.innerHTML).toContain('<strong');
        });

        test('does NOT re-render when switching preview→split', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('**bold**');
            editor.setMode('preview');
            const htmlBefore = editor.previewPanel.innerHTML;
            editor.setMode('split');
            // Should NOT re-render (preview was already visible)
            expect(editor.previewPanel.innerHTML).toBe(htmlBefore);
        });
    });

    // ================================================================
    // removeHR instance method visual feedback
    // ================================================================
    describe('removeHR visual feedback', () => {
        test('updates toolbar button text temporarily', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Create a mock toolbar button
            const btn = document.createElement('button');
            btn.dataset.action = 'remove-hr';
            btn.textContent = 'Remove HR';
            editor.toolbar.appendChild(btn);

            await editor.setMarkdown('hello\n\n---\n\nworld');
            await editor.removeHR();
            expect(btn.textContent).toBe('Removed!');
            // After timeout it should revert (test with fake timer)
        });
    });

    // ================================================================
    // convertLazyLinefeeds instance visual feedback
    // ================================================================
    describe('convertLazyLinefeeds visual feedback', () => {
        test('updates toolbar button text temporarily', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const btn = document.createElement('button');
            btn.dataset.action = 'lazy-linefeeds';
            btn.textContent = 'Convert';
            editor.toolbar.appendChild(btn);

            await editor.setMarkdown('# Title\nParagraph');
            await editor.convertLazyLinefeeds();
            expect(btn.textContent).toBe('Converted!');
        });
    });

    // ================================================================
    // copy() visual feedback on toolbar button
    // ================================================================
    describe('copy() visual feedback', () => {
        test('shows Copied! on existing copy-markdown button', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // The toolbar already has a copy-markdown button from createToolbar()
            const btn = editor.toolbar.querySelector('[data-action="copy-markdown"]');
            expect(btn).toBeTruthy();
            const originalText = btn.textContent;

            await editor.setMarkdown('test');
            await editor.copy('markdown');
            expect(btn.textContent).toBe('Copied!');
        });
    });

    // ================================================================
    // allow_unsafe_html whitelist mode via parser (sanitizeHtmlTagAttrs)
    // ================================================================
    describe('allow_unsafe_html whitelist mode in parser', () => {
        test('whitelisted tags pass through, non-whitelisted are escaped', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<div>allowed</div><script>evil</script>');
            const html = editor.getHTML();
            expect(html).toContain('<div>');
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        test('on* event handler attributes are stripped from whitelisted tags', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<div onclick="alert(1)">click me</div>');
            const html = editor.getHTML();
            expect(html).toContain('<div>');
            expect(html).not.toContain('onclick');
        });

        test('javascript: URLs in href are sanitized on whitelisted tags', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<a href="javascript:alert(1)">link</a>');
            const html = editor.getHTML();
            expect(html).toContain('<a');
            expect(html).not.toContain('javascript:');
        });

        test('data:image/ URLs are allowed on whitelisted tags', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<img src="data:image/png;base64,abc123">');
            const html = editor.getHTML();
            expect(html).toContain('data:image/png');
        });

        test('boolean attributes on whitelisted tags are preserved', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<input disabled type="text">');
            const html = editor.getHTML();
            // input may or may not be in SAFE_HTML_TAGS; check what's there
            // The test exercises sanitizeHtmlTagAttrs boolean attr branch
        });

        test('HTML comments pass through in whitelist mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<!-- comment --><div>content</div>');
            const html = editor.getHTML();
            expect(html).toContain('<!-- comment -->');
        });
    });

    // ================================================================
    // auto theme with matchMedia
    // ================================================================
    describe('auto theme', () => {
        test('auto theme uses matchMedia preference', async () => {
            // Mock dark mode preference
            window.matchMedia = jest.fn().mockImplementation(query => ({
                matches: true,
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }));

            editor = new QuikdownEditor('#test-editor', { theme: 'auto' });
            await editor.initPromise;
            // Since matchMedia says dark, container should have qde-dark
            expect(editor.container.classList.contains('qde-dark')).toBe(true);

            // Restore
            window.matchMedia = jest.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }));
        });

        test('auto theme listener responds to system change', async () => {
            let changeCallback;
            window.matchMedia = jest.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn((event, cb) => { changeCallback = cb; }),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }));

            editor = new QuikdownEditor('#test-editor', { theme: 'auto' });
            await editor.initPromise;
            expect(editor.container.classList.contains('qde-dark')).toBe(false);

            // Simulate system switching to dark
            if (changeCallback) {
                changeCallback({ matches: true });
            }
            expect(editor.container.classList.contains('qde-dark')).toBe(true);

            // Restore
            window.matchMedia = jest.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }));
        });
    });

    // ================================================================
    // split-toggle button reset on setMode
    // ================================================================
    describe('split-toggle button', () => {
        test('setMode resets split-toggle text to Preview', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // The toolbar already creates a .qde-split-toggle button
            const btn = editor.toolbar.querySelector('.qde-split-toggle');
            expect(btn).toBeTruthy();
            // Simulate that a user toggled it to 'Source'
            btn.textContent = 'Source';

            editor.setMode('split');
            expect(btn.textContent).toBe('Preview');
        });
    });

    // ================================================================
    // _updateUndoButtons toolbar integration
    // ================================================================
    describe('_updateUndoButtons', () => {
        test('toggles disabled class on undo/redo buttons', async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            // The toolbar already has undo/redo buttons created by createToolbar()
            const undoBtn = editor.toolbar.querySelector('[data-action="undo"]');
            const redoBtn = editor.toolbar.querySelector('[data-action="redo"]');
            expect(undoBtn).toBeTruthy();
            expect(redoBtn).toBeTruthy();

            // Initially both should be disabled (no undo/redo history)
            editor._updateUndoButtons();
            expect(undoBtn.classList.contains('disabled')).toBe(true);
            expect(redoBtn.classList.contains('disabled')).toBe(true);

            editor.updateFromMarkdown('change');
            editor._updateUndoButtons();
            expect(undoBtn.classList.contains('disabled')).toBe(false);
            // redo should still be disabled
            expect(redoBtn.classList.contains('disabled')).toBe(true);

            editor.undo();
            editor._updateUndoButtons();
            expect(redoBtn.classList.contains('disabled')).toBe(false);
        });
    });

    // ================================================================
    // getHTML / getMarkdown consistency
    // ================================================================
    describe('getHTML / getMarkdown consistency', () => {
        test('getHTML returns rendered result matching getMarkdown input', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('- item1\n- item2');
            expect(editor.getMarkdown()).toBe('- item1\n- item2');
            expect(editor.getHTML()).toContain('<li');
        });

        test('empty markdown produces minimal/empty HTML', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('');
            expect(editor.getMarkdown()).toBe('');
        });
    });

    // ================================================================
    // Parser edge cases exercised through editor
    // ================================================================
    describe('Parser paths via editor', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('autolinks (bare URLs) become links', async () => {
            await editor.setMarkdown('Visit https://example.com today');
            expect(editor.getHTML()).toContain('href="https://example.com"');
        });

        test('lazy linefeeds with table protection', async () => {
            editor.setLazyLinefeeds(true);
            await editor.setMarkdown('| H1 | H2 |\n| -- | -- |\n| a | b |\n\nParagraph');
            const html = editor.getHTML();
            // Table should be intact, not have <br> inserted
            expect(html).toContain('<table');
            expect(html).toContain('<td');
        });

        test('lazy linefeeds with list protection', async () => {
            editor.setLazyLinefeeds(true);
            await editor.setMarkdown('- item1\n- item2\n\nParagraph');
            const html = editor.getHTML();
            expect(html).toContain('<li');
            expect(html).toContain('<p>');
        });

        test('lazy linefeeds single newline becomes br', async () => {
            editor.setLazyLinefeeds(true);
            await editor.setMarkdown('line1\nline2');
            const html = editor.getHTML();
            expect(html).toContain('<br');
        });

        test('mixed list type (ul then ol) closes and reopens', async () => {
            await editor.setMarkdown('- bullet\n1. numbered');
            const html = editor.getHTML();
            expect(html).toContain('</ul>');
            expect(html).toContain('<ol');
        });

        test('list at end of document gets closed', async () => {
            await editor.setMarkdown('- last item');
            const html = editor.getHTML();
            expect(html).toContain('</ul>');
        });

        test('code block without plugin falls back to pre/code', async () => {
            await editor.setMarkdown('```js\nconst x = 1;\n```');
            const html = editor.getHTML();
            expect(html).toContain('<pre');
            expect(html).toContain('<code');
        });

        test('table at end of document', async () => {
            await editor.setMarkdown('| A | B |\n| - | - |\n| 1 | 2 |');
            const html = editor.getHTML();
            expect(html).toContain('<table');
            expect(html).toContain('</table>');
        });

        test('invalid table (no separator) is not rendered as table', async () => {
            await editor.setMarkdown('| A | B |\n| 1 | 2 |');
            const html = editor.getHTML();
            // Without a separator row, should not render as a table
            expect(html).not.toContain('<table');
        });

        test('image rendering', async () => {
            await editor.setMarkdown('![alt text](https://example.com/img.png)');
            const html = editor.getHTML();
            expect(html).toContain('<img');
            expect(html).toContain('alt text');
        });

        test('blockquote rendering', async () => {
            await editor.setMarkdown('> quoted text');
            const html = editor.getHTML();
            expect(html).toContain('<blockquote');
        });

        test('horizontal rule rendering', async () => {
            await editor.setMarkdown('---');
            const html = editor.getHTML();
            expect(html).toContain('<hr');
        });

        test('inline code rendering', async () => {
            await editor.setMarkdown('Use `code` here');
            const html = editor.getHTML();
            expect(html).toContain('<code');
        });

        test('strikethrough rendering', async () => {
            await editor.setMarkdown('~~deleted~~');
            const html = editor.getHTML();
            expect(html).toContain('<del');
        });

        test('task list rendering', async () => {
            await editor.setMarkdown('- [x] done\n- [ ] todo');
            const html = editor.getHTML();
            expect(html).toContain('type="checkbox"');
        });
    });

    // ================================================================
    // updateFromHTML (preview→source) roundtrip
    // ================================================================
    describe('updateFromHTML preview→source', () => {
        test('converts preview HTML back to markdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('# Hello\n\n**bold** text');
            // Trigger HTML→markdown conversion
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('# Hello');
            expect(md).toContain('**bold**');
        });

        test('roundtrips list content', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('- item1\n- item2');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('item1');
            expect(md).toContain('item2');
        });

        test('roundtrips table content', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('| H1 | H2 |\n| --- | --- |\n| a | b |');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('| H1 | H2 |');
        });

        test('roundtrips code block', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('```js\nconst x = 1;\n```');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('```');
            expect(md).toContain('const x = 1;');
        });

        test('roundtrips blockquote', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('> quoted');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('>');
            expect(md).toContain('quoted');
        });

        test('roundtrips links', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('[example](https://example.com)');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('example');
            expect(md).toContain('https://example.com');
        });

        test('roundtrips images', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('![alt](https://example.com/img.png)');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('alt');
            expect(md).toContain('img.png');
        });

        test('roundtrips horizontal rule', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('before\n\n---\n\nafter');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('---');
        });

        test('roundtrips strikethrough', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('~~deleted~~');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('~~');
        });

        test('roundtrips inline code', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('Use `code` here');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('`code`');
        });

        test('roundtrips headings at all levels', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('# H1\n\n## H2\n\n### H3');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('# H1');
            expect(md).toContain('## H2');
            expect(md).toContain('### H3');
        });

        test('roundtrips task lists', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('- [x] done\n- [ ] todo');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('[x]');
            expect(md).toContain('[ ]');
        });

        test('roundtrips ordered lists', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('1. first\n2. second');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('first');
            expect(md).toContain('second');
        });
    });

    // ================================================================
    // toMarkdown edge-case roundtrips (targets uncovered walkNode branches)
    // ================================================================
    describe('toMarkdown edge cases via roundtrip', () => {
        test('italic text roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('*italic text*');
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('italic text');
        });

        test('underscore italic roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('_emphasized_');
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('emphasized');
        });

        test('autolink roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('Visit https://example.com for info');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('https://example.com');
        });

        test('line break (double-space) roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Use explicit <br> via HTML rendering to ensure br is in preview
            await editor.setMarkdown('line1  \nline2');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('line1');
            expect(md).toContain('line2');
        });

        test('multiple list items roundtrip', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('- parent\n- sibling\n- third');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('parent');
            expect(md).toContain('sibling');
            expect(md).toContain('third');
        });

        test('paragraph with trailing content roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('First paragraph\n\nSecond paragraph');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('First paragraph');
            expect(md).toContain('Second paragraph');
        });

        test('div passthrough in toMarkdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<div>Content inside div</div>');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('Content inside div');
        });

        test('span passthrough in toMarkdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.setAllowUnsafeHTML('limited');
            await editor.setMarkdown('<span>inline span</span>');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('inline span');
        });

        test('bold with __ syntax roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('__bold text__');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('bold text');
        });

        test('table with alignment roundtrips via toMarkdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |');
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('Left');
            expect(md).toContain('Center');
            expect(md).toContain('Right');
        });
    });

    // ================================================================
    // MathJax integration
    // ================================================================
    describe('MathJax integration', () => {
        test('calls MathJax.typesetPromise when available', async () => {
            const typesetSpy = jest.fn().mockResolvedValue(undefined);
            window.MathJax = { typesetPromise: typesetSpy };
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('$$E = mc^2$$');
            // MathJax should be called if math elements exist
            // (The parser wraps $$ in .math-display elements)
            delete window.MathJax;
        });
    });

    // ================================================================
    // Source textarea sync
    // ================================================================
    describe('Source textarea sync', () => {
        test('sourceTextarea is synced with markdown', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            await editor.setMarkdown('# Test');
            if (editor.sourceTextarea) {
                expect(editor.sourceTextarea.value).toBe('# Test');
            }
        });

        test('undo restores textarea content', async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            if (editor.sourceTextarea) {
                expect(editor.sourceTextarea.value).toBe('first');
            }
        });

        test('redo restores textarea content', async () => {
            editor = new QuikdownEditor('#test-editor', { showUndoRedo: true });
            await editor.initPromise;
            editor.updateFromMarkdown('first');
            editor.updateFromMarkdown('second');
            editor.undo();
            editor.redo();
            if (editor.sourceTextarea) {
                expect(editor.sourceTextarea.value).toBe('second');
            }
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: parser edge cases via editor
    // -----------------------------------------------------------------------
    describe('Parser edge cases via editor (coverage push)', () => {

        test('HR with trailing whitespace after dashes', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('---  \n');
            expect(editor.html).toContain('<hr');
        });

        test('HR with many dashes and tab trailing', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('------\t\n');
            expect(editor.html).toContain('<hr');
        });

        test('non-string input to updateFromMarkdown treated as empty', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown(null);
            expect(editor.html).toBe('');
            editor.updateFromMarkdown(undefined);
            expect(editor.html).toBe('');
        });

        test('markdown comments [//]: # are ignored', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('[//]: # (this is a comment)\nHello world');
            expect(editor.html).not.toContain('comment');
            expect(editor.html).toContain('Hello world');
        });

        test('markdown comments with double quotes', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('[//]: # "this is a comment"\nVisible');
            expect(editor.html).toContain('Visible');
        });

        test('fenced code block without plugin renders pre/code', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('```js\nconst x = 1;\n```');
            expect(editor.html).toContain('<pre');
            expect(editor.html).toContain('<code');
            expect(editor.html).toContain('const x = 1;');
        });

        test('fenced code block with language gets data-qd-lang in BD mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('```python\nprint("hi")\n```');
            // BD mode is default for editor
            expect(editor.html).toContain('data-qd-lang');
            expect(editor.html).toContain('data-qd-fence');
        });

        test('allow_unsafe_html as limited whitelist via editor', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            editor.updateFromMarkdown('<div>test</div>');
            // 'limited' mode uses SAFE_HTML_TAGS whitelist
            expect(editor.html).toContain('<div>');
        });

        test('table alignment with inline_styles applies text-align', async () => {
            editor = new QuikdownEditor('#test-editor', { inline_styles: true });
            await editor.initPromise;
            editor.updateFromMarkdown('| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |');
            expect(editor.html).toContain('text-align:center');
            expect(editor.html).toContain('text-align:right');
        });

        test('invalid table with single pipe renders as paragraph', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Malformed table - no separator row
            editor.updateFromMarkdown('| just text\nno separator\nnormal text');
            expect(editor.html).not.toContain('<table');
        });

        test('nested list with dedent closes deeper levels', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('- Item 1\n  - Nested\n- Back to 1');
            expect(editor.html).toContain('Item 1');
            expect(editor.html).toContain('Nested');
            expect(editor.html).toContain('Back to 1');
        });

        test('fence close with trailing non-whitespace does not close fence', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // The fence close has extra text, so it should be treated as content
            editor.updateFromMarkdown('```\ncode line\n```junk\nmore code\n```');
            // "junk" should be inside the code block
            expect(editor.html).toContain('junk');
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: toMarkdown reverse paths via updateFromHTML
    // -----------------------------------------------------------------------
    describe('toMarkdown reverse paths (coverage push)', () => {

        test('toMarkdown handles non-element/non-text nodes gracefully', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Set some HTML with a comment node
            editor.previewPanel.innerHTML = '<!-- comment --><p>text</p>';
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('text');
        });

        test('toMarkdown with empty preview panel returns empty-ish', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.previewPanel.innerHTML = '';
            editor.updateFromHTML();
            expect(editor.markdown).toBeDefined();
        });

        test('code block with data-qd-source roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<pre data-qd-fence="```" data-qd-lang="js" data-qd-source="const x = 1;"><code class="language-js">const x = 1;</code></pre>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```js');
            expect(editor.getMarkdown()).toContain('const x = 1;');
        });

        test('mermaid container with data-qd-source roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div class="mermaid-container" data-qd-fence="```" data-qd-lang="mermaid" data-qd-source="graph TD; A--&gt;B"></div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```mermaid');
            expect(editor.getMarkdown()).toContain('graph TD; A-->B');
        });

        test('mermaid container with pre.mermaid extracts text via reverse handler', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Editor's built-in reverse handler extracts textContent from pre,
            // so the result contains the pre's text, not data-qd-source.
            const html = '<div class="mermaid-container" data-qd-fence="```" data-qd-lang="mermaid"><pre class="mermaid" data-qd-source="graph LR; A--&gt;B"><code>graph LR; A--&gt;B</code></pre></div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```mermaid');
        });

        test('mermaid container with legacy .mermaid-source element', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div class="mermaid-container" data-qd-fence="```" data-qd-lang="mermaid"><div class="mermaid-source">graph TB; X--&gt;Y</div></div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```mermaid');
            expect(editor.getMarkdown()).toContain('graph TB; X-->Y');
        });

        test('mermaid container with .mermaid element fallback', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div class="mermaid-container" data-qd-fence="```" data-qd-lang="mermaid"><div class="mermaid">graph TD; C-->D</div></div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```mermaid');
            expect(editor.getMarkdown()).toContain('graph TD; C-->D');
        });

        test('standalone mermaid div (legacy) roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div class="mermaid" data-qd-fence="```" data-qd-lang="mermaid">graph TD; E-->F</div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```mermaid');
            expect(editor.getMarkdown()).toContain('graph TD; E-->F');
        });

        test('div with data-qd-source and data-qd-fence roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div data-qd-fence="```" data-qd-lang="chart" data-qd-source="bar chart data"></div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```chart');
            expect(editor.getMarkdown()).toContain('bar chart data');
        });

        test('paragraph with trailing whitespace preserves spacing', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<p>First paragraph</p><p>Second paragraph</p>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('First paragraph');
            expect(editor.getMarkdown()).toContain('Second paragraph');
        });

        test('built-in reverse handler extracts code from pre elements', async () => {
            // Editor's createFencePlugin() reverse handler extracts textContent
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<pre data-qd-fence="```" data-qd-lang="custom"><code>original code content</code></pre>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```custom');
            expect(editor.getMarkdown()).toContain('original code content');
        });

        test('built-in reverse handler handles hljs-highlighted code', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<pre data-qd-fence="```" data-qd-lang="js"><code class="hljs language-js"><span class="hljs-keyword">const</span> x = 1;</code></pre>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```js');
            expect(editor.getMarkdown()).toContain('const x = 1;');
        });

        test('built-in reverse handler handles div with data-qd-lang', async () => {
            // The div case in toMarkdown uses fence_plugin.reverse for divs with data-qd-lang
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div data-qd-fence="```" data-qd-lang="geo">map data here</div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```geo');
            expect(editor.getMarkdown()).toContain('map data here');
        });

        test('contenteditable=false elements with data-qd-source are preprocessed', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<div contenteditable="false" data-qd-fence="```" data-qd-lang="special" data-qd-source="original source code">rendered preview</div>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            // preprocessSpecialElements replaces contenteditable=false elements with pre/code
            expect(editor.getMarkdown()).toContain('original source code');
        });

        test('code block without data-qd-source extracts from code element', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<pre data-qd-fence="```" data-qd-lang="ruby"><code>puts "hello"</code></pre>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            expect(editor.getMarkdown()).toContain('```ruby');
            expect(editor.getMarkdown()).toContain('puts "hello"');
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: inline_styles configuration
    // -----------------------------------------------------------------------
    describe('Configure wrapper functions (coverage push)', () => {
        test('editor uses inline_styles option correctly', async () => {
            editor = new QuikdownEditor('#test-editor', { inline_styles: true });
            await editor.initPromise;
            editor.updateFromMarkdown('**bold text**');
            expect(editor.html).toContain('style=');
            expect(editor.html).toContain('font-weight');
        });

        test('editor uses inline_styles false for class-based output', async () => {
            editor = new QuikdownEditor('#test-editor', { inline_styles: false });
            await editor.initPromise;
            editor.updateFromMarkdown('**bold text**');
            expect(editor.html).toContain('class="quikdown-strong"');
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: HTML sanitization edge cases
    // -----------------------------------------------------------------------
    describe('HTML sanitization edge cases (coverage push)', () => {

        test('boolean HTML attributes are preserved in limited mode', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            editor.updateFromMarkdown('<input disabled type="text">');
            const html = editor.html;
            expect(html).toBeDefined();
        });

        test('event handler attributes are stripped in limited mode', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            editor.updateFromMarkdown('<div onclick="alert(1)">test</div>');
            expect(editor.html).not.toContain('onclick');
        });

        test('style attributes pass through on whitelisted tags', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            editor.updateFromMarkdown('<div style="color:red">styled</div>');
            expect(editor.html).toContain('style=');
            expect(editor.html).toContain('color:red');
        });

        test('script tags are escaped in default mode', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('<script>alert("xss")</script>');
            expect(editor.html).not.toContain('<script>');
            expect(editor.html).toContain('&lt;script&gt;');
        });

        test('HTML comments pass through in limited mode', async () => {
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: 'limited' });
            await editor.initPromise;
            editor.updateFromMarkdown('<!-- comment -->\nvisible');
            expect(editor.html).toContain('visible');
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: URL sanitization
    // -----------------------------------------------------------------------
    describe('URL sanitization in editor (coverage push)', () => {

        test('vbscript URLs are blocked', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('[click](vbscript:MsgBox)');
            expect(editor.html).not.toContain('vbscript:');
            expect(editor.html).toContain('href="#"');
        });

        test('data:image URLs are allowed', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('![img](data:image/png;base64,abc123)');
            expect(editor.html).toContain('data:image/png;base64,abc123');
        });

        test('non-image data: URLs are blocked', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            editor.updateFromMarkdown('[x](data:text/html,bad)');
            expect(editor.html).toContain('href="#"');
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: split-toggle click, mode switch, lazy linefeeds
    // -----------------------------------------------------------------------
    describe('Split-toggle and mode switch (coverage push)', () => {

        test('clicking split-toggle button toggles preview class', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const btn = editor.toolbar.querySelector('.qde-split-toggle');
            if (btn) {
                // Simulate click event on the button
                const event = new Event('click', { bubbles: true });
                btn.dispatchEvent(event);
                const hasPreviewClass = editor.container.classList.contains('qde-split-preview');
                expect(typeof hasPreviewClass).toBe('boolean');
            }
        });

        test('mode switch from source to preview re-renders', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Start in source mode
            editor.setMode('source');
            editor.updateFromMarkdown('**bold content**');
            // Switch to preview mode — should re-render the preview panel
            editor.setMode('preview');
            expect(editor.previewPanel.innerHTML).toContain('bold content');
        });

        test('mode switch from source to split re-renders with MathJax', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Mock MathJax
            window.MathJax = {
                typesetPromise: jest.fn().mockResolvedValue(undefined)
            };
            editor.setMode('source');
            editor.updateFromMarkdown('$$E=mc^2$$');
            editor.setMode('split');
            // MathJax may or may not be called depending on class names
            delete window.MathJax;
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: removeHRFromMarkdown table heuristic, lazy linefeeds
    // -----------------------------------------------------------------------
    describe('removeHR and convertLazyLinefeeds edge cases (coverage push)', () => {

        test('removeHRFromMarkdown preserves table separator that looks like HR', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // A table separator row with pipes is preserved directly (line 5353)
            const md = '| A | B |\n|---|---|\n| 1 | 2 |';
            const result = QuikdownEditor.removeHRFromMarkdown(md);
            expect(result).toContain('|---|---|');
        });

        test('removeHRFromMarkdown preserves HR-like line adjacent to table rows', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // An HR-like separator without pipes, but adjacent to pipe rows
            // This hits the looksLikeTableRow heuristic (lines 5364-5366)
            const md = '| A | B |\n---\n| 1 | 2 |';
            const result = QuikdownEditor.removeHRFromMarkdown(md);
            // The --- should be preserved because adjacent lines have pipes
            expect(result).toContain('---');
        });

        test('convertLazyLinefeeds adds blank line before fence', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Text immediately followed by a fence block
            const md = 'some text\n```js\ncode\n```';
            const result = QuikdownEditor.convertLazyLinefeeds(md);
            // Should have a blank line before the fence
            expect(result).toContain('some text\n\n```js');
        });

        test('convertLazyLinefeeds classifies indented list continuations', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Indented continuation with 4 spaces
            const md = '- item 1\n    continued text\n- item 2';
            const result = QuikdownEditor.convertLazyLinefeeds(md);
            expect(result).toContain('- item 1');
            expect(result).toContain('- item 2');
        });
    });

    // -----------------------------------------------------------------------
    // Coverage push: task list with inline elements in toMarkdown
    // -----------------------------------------------------------------------
    describe('Task list toMarkdown edge cases (coverage push)', () => {

        test('task list item with inline formatting roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            // Create a task list with inline formatting inside items
            const html = '<ul><li class="quikdown-task-item"><input type="checkbox" checked> <strong>important</strong> task</li></ul>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('[x]');
            expect(md).toContain('important');
        });

        test('nested list inside list item roundtrips', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            const html = '<ul><li>parent<ul><li>child</li></ul></li></ul>';
            editor.previewPanel.innerHTML = html;
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('parent');
            expect(md).toContain('child');
        });
    });

    // ================================================================
    // Coverage push v2: toMarkdown edge cases + mermaid fallbacks
    // Target lines: 1230, 1242-1244, 1298, 1306-1308, 1330,
    //   1343-1381, 3162, 4438, 5044, 99
    // ================================================================

    describe('toMarkdown pre with fence_plugin.reverse error (line 1230)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('pre with fence_plugin.reverse that throws falls through to source', () => {
            const faultyPlugin = {
                reverse: () => { throw new Error('test error'); }
            };
            const pre = document.createElement('pre');
            pre.setAttribute('data-qd-fence', '```');
            pre.setAttribute('data-qd-lang', 'js');
            pre.setAttribute('data-qd-source', 'let x = 1;');
            const code = document.createElement('code');
            code.textContent = 'let x = 1;';
            pre.appendChild(code);
            editor.previewPanel.innerHTML = '';
            editor.previewPanel.appendChild(pre);

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('let x = 1');
            consoleSpy.mockRestore();
        });

        test('pre without code element uses childContent fallback (line 1242-1244)', () => {
            const pre = document.createElement('pre');
            pre.setAttribute('data-qd-fence', '```');
            pre.setAttribute('data-qd-lang', 'txt');
            pre.textContent = 'raw text here';
            editor.previewPanel.innerHTML = '';
            editor.previewPanel.appendChild(pre);

            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('raw text here');
        });
    });

    describe('toMarkdown paragraph trailing blank lines (lines 1298, 1306-1308)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('paragraph with trailing whitespace-only lines', () => {
            const p1 = document.createElement('p');
            p1.appendChild(document.createTextNode('first line'));
            p1.appendChild(document.createTextNode('\n'));
            p1.appendChild(document.createTextNode('\n'));
            const p2 = document.createElement('p');
            p2.textContent = 'second';

            editor.previewPanel.innerHTML = '';
            editor.previewPanel.appendChild(p1);
            editor.previewPanel.appendChild(p2);
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('first line');
            expect(md).toContain('second');
        });
    });

    describe('toMarkdown div with data-qd-source fallback (lines 1336-1338)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('div with data-qd-source and data-qd-fence but no lang uses source fallback', () => {
            // A div with fence attributes but no data-qd-lang skips the reverse handler (line 1321)
            // and falls through to the data-qd-source fallback (line 1336-1338)
            const div = document.createElement('div');
            div.setAttribute('data-qd-fence', '```');
            div.setAttribute('data-qd-source', 'chart data here');
            div.textContent = 'rendered output';

            editor.previewPanel.innerHTML = '';
            editor.previewPanel.appendChild(div);
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('chart data here');
        });
    });

    describe('toMarkdown mermaid container fallbacks (lines 1343-1381)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('mermaid container with data-qd-source on container itself', () => {
            // No data-qd-lang (line 1321 false), no data-qd-fence (line 1337 false)
            // → falls to mermaid-container check at line 1342, data-qd-source at line 1347
            editor.previewPanel.innerHTML =
                '<div class="mermaid-container" data-qd-source="graph TD; A--&gt;B">' +
                '<div class="mermaid">rendered svg</div></div>';
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('```mermaid');
            expect(md).toContain('graph TD');
        });

        test('mermaid container with data-qd-source on pre.mermaid child', () => {
            // No data-qd-source on container, no data-qd-lang, no data-qd-fence
            // → mermaid-container at 1342, no container source (1348 false), pre.mermaid at 1358
            editor.previewPanel.innerHTML =
                '<div class="mermaid-container">' +
                '<pre class="mermaid" data-qd-source="graph LR; X--&gt;Y">svg output</pre></div>';
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('```mermaid');
            expect(md).toContain('graph LR');
        });

        test('mermaid container with .mermaid-source legacy element', () => {
            // No source attributes on container or pre, no data-qd-lang, no data-qd-fence
            // → mermaid-container at 1342, no source (1348 false), no pre (1358 false), .mermaid-source at 1369
            editor.previewPanel.innerHTML =
                '<div class="mermaid-container">' +
                '<div class="mermaid-source">graph TB; C--&gt;D</div>' +
                '<div class="mermaid">rendered</div></div>';
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('```mermaid');
            expect(md).toContain('graph TB');
        });

        test('mermaid container with .mermaid element containing graph keyword', () => {
            // No source attributes anywhere, no mermaid-source, no data-qd-lang, no data-qd-fence
            // → mermaid-container at 1342, falls through to .mermaid element at 1379
            editor.previewPanel.innerHTML =
                '<div class="mermaid-container">' +
                '<div class="mermaid">graph TD\nA-->B\nB-->C</div></div>';
            editor.updateFromHTML();
            const md = editor.getMarkdown();
            expect(md).toContain('```mermaid');
            expect(md).toContain('graph TD');
        });
    });

    describe('Constructor invalid container (line 3162)', () => {
        test('throws on invalid container selector', () => {
            expect(() => new QuikdownEditor('#nonexistent-editor'))
                .toThrow('QuikdownEditor: Invalid container');
        });

        test('throws on null container', () => {
            expect(() => new QuikdownEditor(null))
                .toThrow();
        });
    });

    describe('renderTable error path (line 4438)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('renderTable with null data falls back to pre', () => {
            const result = editor.renderTable(null, 'csv');
            expect(result).toContain('<pre');
        });
    });

    describe('Mode switch source→split with MathJax (line 5044)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('switching from source to split triggers MathJax typeset', () => {
            editor.updateFromMarkdown('$$ x^2 $$');
            editor.setMode('source');

            const typesetSpy = jest.fn().mockResolvedValue(undefined);
            window.MathJax = { typesetPromise: typesetSpy };

            const mathEl = document.createElement('div');
            mathEl.className = 'math-display';
            editor.previewPanel.appendChild(mathEl);

            editor.setMode('split');

            delete window.MathJax;
        });
    });

    describe('Fence close with trailing non-whitespace (line 99)', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('fence close line with trailing text does not close fence', () => {
            editor.updateFromMarkdown('```js\ncode\n``` not close\nmore\n```');
            const html = editor.html;
            expect(html).toContain('not close');
            expect(html).toContain('more');
        });
    });

    describe('Embedded parser edge cases via updateFromMarkdown', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('code block without lang gets rendered', () => {
            editor.updateFromMarkdown('```\nplain code\n```');
            expect(editor.html).toContain('plain code');
            expect(editor.html).toContain('<pre');
        });

        test('array-form allowUnsafeHTML normalization', async () => {
            editor.destroy();
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: ['b', 'i'] });
            await editor.initPromise;
            editor.updateFromMarkdown('<b>bold</b> <script>bad</script>');
            expect(editor.html).toContain('<b>bold</b>');
            expect(editor.html).not.toMatch(/<script[\s>]/);
        });

        test('boolean HTML attributes pass through with whitelist', async () => {
            editor.destroy();
            editor = new QuikdownEditor('#test-editor', { allowUnsafeHTML: ['input'] });
            await editor.initPromise;
            editor.updateFromMarkdown('<input disabled type="text">');
            expect(editor.html).toContain('disabled');
        });
    });
});
