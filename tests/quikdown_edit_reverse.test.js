/**
 * Test suite for bidirectional code block editing with reverse handler
 * Tests the fence plugin's reverse functionality for extracting edited content
 */

const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Load the modules
const quikdownBdPath = path.join(__dirname, '..', 'dist', 'quikdown_bd.umd.min.js');
const quikdownBdCode = fs.readFileSync(quikdownBdPath, 'utf8');

const quikdownEditPath = path.join(__dirname, '..', 'dist', 'quikdown_edit.umd.min.js');
const quikdownEditCode = fs.readFileSync(quikdownEditPath, 'utf8');

describe('Bidirectional Code Block Editing with Reverse Handler', () => {
    let window;
    let document;
    let quikdown_bd;
    let QuikdownEditor;

    beforeEach(() => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="editor"></div></body></html>`, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost'
        });
        window = dom.window;
        document = window.document;
        
        // Mock matchMedia for theme detection
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
        
        // Make window global for the scripts
        global.window = window;
        global.document = document;
        
        // Execute the scripts
        const scriptBd = new window.Function(quikdownBdCode + '; return quikdown_bd;');
        quikdown_bd = scriptBd();
        
        const scriptEdit = new window.Function(quikdownEditCode + '; return QuikdownEditor;');
        QuikdownEditor = scriptEdit();
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    describe('Reverse Handler for Syntax Highlighted Code', () => {
        test('should extract edited content from highlighted code blocks', () => {
            // Create a fence plugin with reverse handler (simulating what quikdown_edit does)
            const fencePlugin = {
                render: (code, lang) => {
                    // Simulate syntax highlighting
                    if (lang === 'javascript') {
                        const highlighted = `<span class="hljs-function">function</span> <span class="hljs-title">test</span>() { }`;
                        const escapedCode = code.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                    }
                    return undefined;
                },
                reverse: (node) => {
                    const codeEl = node.querySelector('code.hljs');
                    if (codeEl) {
                        const content = codeEl.textContent;
                        const lang = node.getAttribute('data-qd-lang') || '';
                        const fence = node.getAttribute('data-qd-fence') || '```';
                        return {
                            content: content,
                            lang: lang,
                            fence: fence
                        };
                    }
                    return null;
                }
            };

            // Test markdown to HTML
            const markdown = '```javascript\nfunction test() { }\n```';
            const html = quikdown_bd(markdown, { fence_plugin: fencePlugin });
            
            // Verify HTML has the expected structure
            expect(html).toContain('data-qd-source=');
            expect(html).toContain('data-qd-lang="javascript"');
            expect(html).toContain('class="hljs language-javascript"');
            
            // Parse HTML and simulate editing
            const div = document.createElement('div');
            div.innerHTML = html;
            const codeEl = div.querySelector('code.hljs');
            
            // Edit the content
            codeEl.textContent = 'function edited() { return 42; }';
            
            // Test reverse conversion
            const backToMarkdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
            
            // Should get the edited content, not the original
            expect(backToMarkdown).toContain('function edited() { return 42; }');
            expect(backToMarkdown).not.toContain('function test() { }');
        });

        test('should handle multiple language types', () => {
            const languages = ['javascript', 'python', 'json', 'html', 'css'];
            
            languages.forEach(lang => {
                const fencePlugin = {
                    reverse: (node) => {
                        const codeEl = node.querySelector('code');
                        if (codeEl) {
                            return {
                                content: codeEl.textContent,
                                lang: node.getAttribute('data-qd-lang') || '',
                                fence: '```'
                            };
                        }
                        return null;
                    }
                };
                
                // Create HTML with edited content
                const editedContent = `edited ${lang} code`;
                const html = `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="original"><code class="hljs language-${lang}">${editedContent}</code></pre>`;
                
                const div = document.createElement('div');
                div.innerHTML = html;
                
                const markdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
                
                // Should use edited content from reverse handler
                expect(markdown).toContain(editedContent);
                expect(markdown).toContain(`\`\`\`${lang}`);
                expect(markdown).not.toContain('original');
            });
        });

        test('should fall back to data-qd-source when reverse returns null', () => {
            const fencePlugin = {
                reverse: (node) => {
                    // Return null to indicate no special handling
                    return null;
                }
            };
            
            const originalCode = 'function original() { }';
            const html = `<pre data-qd-fence="\`\`\`" data-qd-lang="javascript" data-qd-source="${originalCode}"><code>edited content</code></pre>`;
            
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const markdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
            
            // Should fall back to data-qd-source
            expect(markdown).toContain(originalCode);
        });

        test('should handle code blocks without syntax highlighting', () => {
            const fencePlugin = {
                reverse: (node) => {
                    const codeEl = node.querySelector('code.hljs');
                    if (codeEl) {
                        return {
                            content: codeEl.textContent,
                            lang: node.getAttribute('data-qd-lang') || '',
                            fence: '```'
                        };
                    }
                    return null;
                }
            };
            
            // Plain code block without hljs class
            const html = `<pre data-qd-fence="\`\`\`" data-qd-lang="text"><code>plain text code</code></pre>`;
            
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const markdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
            
            // Should extract text content normally
            expect(markdown).toContain('plain text code');
            expect(markdown).toContain('```text');
        });
    });

    describe('Integration with QuikdownEditor', () => {
        test('should handle edited code blocks in editor', (done) => {
            if (typeof QuikdownEditor !== 'function') {
                console.log('Skipping editor integration test - QuikdownEditor not available');
                done();
                return;
            }

            // Mock highlight.js
            window.hljs = {
                getLanguage: (lang) => lang === 'javascript',
                highlight: (code, opts) => ({
                    value: `<span class="hljs">${code}</span>`
                })
            };

            const editor = new QuikdownEditor('#editor', {
                mode: 'split',
                plugins: { highlightjs: true }
            });

            const originalMarkdown = '```javascript\nfunction test() {\n    return "original";\n}\n```';
            editor.setMarkdown(originalMarkdown);

            setTimeout(() => {
                // Get the preview panel
                const previewPanel = document.querySelector('.qde-preview');
                const codeBlock = previewPanel.querySelector('code.hljs');
                
                if (codeBlock) {
                    // Edit the code
                    const editedCode = 'function test() {\n    return "edited";\n}';
                    codeBlock.textContent = editedCode;
                    
                    // Trigger input event
                    const inputEvent = new window.Event('input', { bubbles: true });
                    previewPanel.dispatchEvent(inputEvent);
                    
                    setTimeout(() => {
                        const newMarkdown = editor.getMarkdown();
                        expect(newMarkdown).toContain('return "edited"');
                        expect(newMarkdown).not.toContain('return "original"');
                        done();
                    }, 100);
                } else {
                    done();
                }
            }, 100);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty code blocks', () => {
            const fencePlugin = {
                reverse: (node) => {
                    const codeEl = node.querySelector('code');
                    if (codeEl) {
                        return {
                            content: codeEl.textContent,
                            lang: 'javascript',
                            fence: '```'
                        };
                    }
                    return null;
                }
            };
            
            const html = `<pre data-qd-fence="\`\`\`" data-qd-lang="javascript"><code class="hljs"></code></pre>`;
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const markdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
            expect(markdown.trim()).toBe('```javascript\n\n```');
        });

        test('should preserve whitespace in edited code', () => {
            const fencePlugin = {
                reverse: (node) => {
                    const codeEl = node.querySelector('code');
                    if (codeEl) {
                        return {
                            content: codeEl.textContent,
                            lang: 'python',
                            fence: '```'
                        };
                    }
                    return null;
                }
            };
            
            const codeWithIndentation = 'def test():\n    if True:\n        return "indented"';
            const html = `<pre data-qd-fence="\`\`\`" data-qd-lang="python"><code>${codeWithIndentation}</code></pre>`;
            
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const markdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
            expect(markdown).toContain('    if True:');
            expect(markdown).toContain('        return "indented"');
        });

        test('should handle special characters in edited code', () => {
            const fencePlugin = {
                reverse: (node) => {
                    const codeEl = node.querySelector('code');
                    if (codeEl) {
                        return {
                            content: codeEl.textContent,
                            lang: 'javascript',
                            fence: '```'
                        };
                    }
                    return null;
                }
            };
            
            const specialChars = 'const str = "He said \\"Hello\\""; // <>&';
            const html = `<pre data-qd-fence="\`\`\`" data-qd-lang="javascript"><code>${specialChars}</code></pre>`;
            
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const markdown = quikdown_bd.toMarkdown(div, { fence_plugin: fencePlugin });
            expect(markdown).toContain('He said \\"Hello\\"');
            expect(markdown).toContain('// <>&');
        });
    });
});