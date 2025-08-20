/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load quikdown_bd first as dependency
const bdSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown_bd.umd.js'), 'utf8');
eval(bdSource);

// Load the QuikdownEditor  
const editorSource = fs.readFileSync(path.join(__dirname, '../dist/quikdown_edit.umd.js'), 'utf8');
eval(editorSource);

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // Deprecated
        removeListener: jest.fn(), // Deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

describe('QuikdownEditor', () => {
    let container;
    let editor;

    beforeEach(() => {
        // Create a container element
        container = document.createElement('div');
        container.id = 'test-editor';
        document.body.appendChild(container);
    });

    afterEach(() => {
        // Clean up
        if (editor) {
            editor.destroy();
            editor = null;
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
    });

    describe('Initialization', () => {
        test('should create editor with default options', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            
            expect(editor).toBeDefined();
            expect(editor.container).toBe(container);
            expect(editor.currentMode).toBe('split');
            expect(editor.options.showToolbar).toBe(true);
        });

        test('should create editor with custom options', async () => {
            editor = new QuikdownEditor('#test-editor', {
                mode: 'source',
                theme: 'dark',
                showToolbar: false,
                lazy_linefeeds: true
            });
            await editor.initPromise;
            
            expect(editor.currentMode).toBe('source');
            expect(editor.options.theme).toBe('dark');
            expect(editor.options.showToolbar).toBe(false);
            expect(editor.options.lazy_linefeeds).toBe(true);
        });

        test('should accept DOM element as container', async () => {
            editor = new QuikdownEditor(container);
            await editor.initPromise;
            
            expect(editor.container).toBe(container);
        });

        test('should throw error for invalid container', () => {
            expect(() => {
                new QuikdownEditor('#non-existent');
            }).toThrow('QuikdownEditor: Invalid container');
        });
    });

    describe('Content Management', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should set and get markdown content', async () => {
            const markdown = '# Hello World\n\nThis is a test.';
            await editor.setMarkdown(markdown);
            
            expect(editor.getMarkdown()).toBe(markdown);
            expect(editor.markdown).toBe(markdown);
        });

        test('should get HTML output', async () => {
            const markdown = '# Hello World';
            await editor.setMarkdown(markdown);
            const html = editor.getHTML();
            
            expect(html).toContain('<h1');
            expect(html).toContain('Hello World');
            expect(editor.html).toBe(html);
        });

        test('should handle empty content', async () => {
            await editor.setMarkdown('');
            
            expect(editor.getMarkdown()).toBe('');
            expect(editor.getHTML()).toBe('');
        });

        test('should handle lazy linefeeds when enabled', async () => {
            editor.setLazyLinefeeds(true);
            await editor.setMarkdown('Line 1\nLine 2');
            const html = editor.getHTML();
            
            expect(html).toContain('<br');  // Check for br tag (may have class)
        });

        test('should not use lazy linefeeds when disabled', async () => {
            editor.setLazyLinefeeds(false);
            await editor.setMarkdown('Line 1\nLine 2');
            const html = editor.getHTML();
            
            expect(html).not.toContain('<br');  // Should not contain br tag
        });
    });

    describe('Mode Switching', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should switch to source mode', () => {
            editor.setMode('source');
            expect(editor.mode).toBe('source');
            expect(container.classList.contains('qde-mode-source')).toBe(true);
        });

        test('should switch to preview mode', () => {
            editor.setMode('preview');
            expect(editor.mode).toBe('preview');
            expect(container.classList.contains('qde-mode-preview')).toBe(true);
        });

        test('should switch to split mode', () => {
            editor.setMode('split');
            expect(editor.mode).toBe('split');
            expect(container.classList.contains('qde-mode-split')).toBe(true);
        });

        test('should ignore invalid mode', () => {
            const currentMode = editor.mode;
            editor.setMode('invalid');
            expect(editor.mode).toBe(currentMode);
        });

        test('should trigger onModeChange callback', () => {
            const callback = jest.fn();
            editor.options.onModeChange = callback;
            
            editor.setMode('preview');
            expect(callback).toHaveBeenCalledWith('preview');
        });
    });

    describe('Theme Support', () => {
        test('should apply light theme', async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'light' });
            await editor.initPromise;
            
            expect(container.classList.contains('qde-dark')).toBe(false);
        });

        test('should set dark theme option', async () => {
            editor = new QuikdownEditor('#test-editor', { theme: 'dark' });
            await editor.initPromise;
            
            expect(editor.options.theme).toBe('dark');
        });
    });

    describe('Fence Plugins', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should render SVG fence', async () => {
            const svg = '```svg\n<svg><circle cx="50" cy="50" r="40"/></svg>\n```';
            await editor.setMarkdown(svg);
            const html = editor.getHTML();
            
            expect(html).toContain('qde-svg-container');
            expect(html).toContain('<circle');
            expect(html).toContain('data-qd-source');
        });

        test('should render CSV fence as table', async () => {
            const csv = '```csv\nName,Age\nAlice,30\nBob,25\n```';
            await editor.setMarkdown(csv);
            const html = editor.getHTML();
            
            expect(html).toContain('<table');
            expect(html).toContain('qde-csv-table');
            expect(html).toContain('<th>Name</th>');
            expect(html).toContain('<td>Alice</td>');
        });

        test('should handle JSON fence', async () => {
            const json = '```json\n{"name": "test", "value": 123}\n```';
            await editor.setMarkdown(json);
            const html = editor.getHTML();
            
            expect(html).toContain('qde-json');
            expect(html).toContain('data-qd-lang="json"');
        });

        test('should preserve math fence', async () => {
            const math = '```math\nE = mc^2\n```';
            await editor.setMarkdown(math);
            const html = editor.getHTML();
            
            expect(html).toContain('qde-math-container');
            expect(html).toContain('data-qd-source');
        });

        test('should use custom fence plugin', async () => {
            editor = new QuikdownEditor('#test-editor', {
                customFences: {
                    'test': (code, lang) => `<div class="custom-test">${code}</div>`
                }
            });
            await editor.initPromise;
            
            await editor.setMarkdown('```test\nCustom content\n```');
            const html = editor.getHTML();
            
            expect(html).toContain('custom-test');
            expect(html).toContain('Custom content');
        });

        test('custom fence should override built-in', async () => {
            editor = new QuikdownEditor('#test-editor', {
                customFences: {
                    'svg': (code) => `<div class="my-svg">${code}</div>`
                }
            });
            await editor.initPromise;
            
            await editor.setMarkdown('```svg\n<svg/>\n```');
            const html = editor.getHTML();
            
            expect(html).toContain('my-svg');
            expect(html).not.toContain('qde-svg-container');
        });
    });

    describe('Callbacks', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should trigger onChange callback', async () => {
            const callback = jest.fn();
            editor.options.onChange = callback;
            
            await editor.setMarkdown('# Test');
            
            expect(callback).toHaveBeenCalled();
            const [markdown, html] = callback.mock.calls[0];
            expect(markdown).toBe('# Test');
            expect(html).toContain('<h1');
        });

        test('should debounce updates from source', (done) => {
            let callCount = 0;
            editor.options.onChange = () => callCount++;
            
            // Simulate rapid typing
            editor.sourceTextarea.value = 'H';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            editor.sourceTextarea.value = 'He';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            editor.sourceTextarea.value = 'Hello';
            editor.sourceTextarea.dispatchEvent(new Event('input'));
            
            // Should only trigger once after debounce
            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 400);
        });
    });

    describe('Escape Functions', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should escape HTML entities', () => {
            const input = '<script>alert("XSS")</script>';
            const escaped = editor.escapeHtml(input);
            
            expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        });

        test('should handle null in escapeHtml', () => {
            expect(editor.escapeHtml(null)).toBe('');
            expect(editor.escapeHtml(undefined)).toBe('');
        });

        test('should escape all special characters', () => {
            const input = '&"\'<>';
            const escaped = editor.escapeHtml(input);
            
            expect(escaped).toBe('&amp;&quot;&#39;&lt;&gt;');
        });
    });

    describe('Bidirectional Preservation', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should preserve SVG attributes in rendered HTML', async () => {
            const svg = '```svg\n<svg xmlns="http://www.w3.org/2000/svg">\n  <text font-family="Arial, sans-serif">Test</text>\n</svg>\n```';
            await editor.setMarkdown(svg);
            
            const html = editor.getHTML();
            // Check that SVG is properly rendered with data-qd-source
            expect(html).toContain('data-qd-source');
            expect(html).toContain('qde-svg-container');
        });

        test('should convert CSV table back to fence', async () => {
            const csv = '```csv\na,b,c\n1,2,3\n```';
            await editor.setMarkdown(csv);
            
            // The preprocessSpecialElements should handle conversion
            const clone = editor.previewPanel.cloneNode(true);
            editor.preprocessSpecialElements(clone);
            
            const pre = clone.querySelector('pre[data-qd-lang="csv"]');
            expect(pre).toBeTruthy();
            expect(pre.textContent).toContain('a,b,c');
        });
    });

    describe('Cleanup', () => {
        test('should clean up on destroy', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            
            // Check that editor was initialized
            expect(editor.container).toBe(container);
            expect(editor.sourceTextarea).toBeDefined();
            
            editor.destroy();
            
            // Check that container was cleared
            expect(container.innerHTML).toBe('');
            
            editor = null; // Prevent afterEach cleanup
        });

        test('should remove event listeners on destroy', async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
            
            const callback = jest.fn();
            editor.options.onChange = callback;
            
            editor.destroy();
            
            // Try to trigger change - should not call callback
            if (editor.sourceTextarea) {
                editor.sourceTextarea.value = 'test';
                editor.sourceTextarea.dispatchEvent(new Event('input'));
            }
            
            expect(callback).not.toHaveBeenCalled();
            
            editor = null; // Prevent afterEach cleanup
        });
    });

    describe('CSV Parsing', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should parse simple CSV line', () => {
            const result = editor.parseCSVLine('a,b,c', ',');
            expect(result).toEqual(['a', 'b', 'c']);
        });

        test('should handle quoted values', () => {
            const result = editor.parseCSVLine('"hello, world",test', ',');
            expect(result).toEqual(['hello, world', 'test']);
        });

        test('should handle escaped quotes', () => {
            const result = editor.parseCSVLine('"She said ""Hi""",test', ',');
            expect(result).toEqual(['She said "Hi"', 'test']);
        });

        test('should handle PSV delimiter', () => {
            const result = editor.parseCSVLine('a|b|c', '|');
            expect(result).toEqual(['a', 'b', 'c']);
        });

        test('should handle TSV delimiter', () => {
            const result = editor.parseCSVLine('a\tb\tc', '\t');
            expect(result).toEqual(['a', 'b', 'c']);
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            editor = new QuikdownEditor('#test-editor');
            await editor.initPromise;
        });

        test('should handle invalid SVG gracefully', async () => {
            const invalidSvg = '```svg\n<not valid svg>\n```';
            await editor.setMarkdown(invalidSvg);
            const html = editor.getHTML();
            
            expect(html).toContain('qde-error');
            expect(html).toContain('Invalid SVG');
        });

        test('should handle malformed CSV', async () => {
            const csv = '```csv\n\n```';
            await editor.setMarkdown(csv);
            const html = editor.getHTML();
            
            // Should render as pre or table with empty content
            expect(html.includes('<pre') || html.includes('<table')).toBe(true);
            expect(html).toContain('data-qd-');
        });

        test('should handle invalid JSON', async () => {
            const json = '```json\n{not valid json}\n```';
            await editor.setMarkdown(json);
            const html = editor.getHTML();
            
            expect(html).toContain('qde-json');
            // Should still attempt to render
            expect(html).toContain('{not valid json}');
        });
    });
});