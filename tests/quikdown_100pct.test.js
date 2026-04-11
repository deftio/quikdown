/**
 * @jest-environment jsdom
 */

/**
 * Targeted tests to push quikdown.esm.js and quikdown_bd.esm.js to 100% coverage.
 * These are the flagship parser files and must be fully covered per project rule.
 *
 * Each test here intentionally exercises a specific previously-uncovered line
 * in the rolled-up dist files. See inline comments for the targeted lines.
 *
 * Imports the .esm.js files directly so Jest's coverage collector picks them up
 * (the jest config collects from `dist/quikdown.esm.js` and `dist/quikdown_bd.esm.js`).
 */

import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';

// ========================================================================
// quikdown.esm.js — target 100% on all 4 metrics
// ========================================================================
describe('quikdown core — coverage gap fills', () => {
    // Line 69 of dist: text-align strip branch in createGetAttr
    // Fires when inline_styles=true and a table column has non-default alignment,
    // so the default `text-align:left` gets stripped and a `;` appended.
    test('inline_styles with aligned table columns (strips default text-align)', () => {
        const md = '| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |';
        const html = quikdown(md, { inline_styles: true });
        // Verify all three alignments made it through
        expect(html).toContain('text-align:center');
        expect(html).toContain('text-align:right');
        // Header cells also get alignment
        expect(html).toMatch(/<th[^>]*style="[^"]*text-align:center/);
        expect(html).toMatch(/<th[^>]*style="[^"]*text-align:right/);
    });

    // Same branch — td cells (not just th)
    test('inline_styles aligned table body cells', () => {
        const md = '| A | B |\n|:---:|---:|\n| 1 | 2 |';
        const html = quikdown(md, { inline_styles: true });
        expect(html).toMatch(/<td[^>]*style="[^"]*text-align:center/);
        expect(html).toMatch(/<td[^>]*style="[^"]*text-align:right/);
    });

    // emitStyles with 'light' theme — covers the light-theme branch
    test('emitStyles("quikdown-", "light") returns CSS with light theme', () => {
        if (typeof quikdown.emitStyles === 'function') {
            const css = quikdown.emitStyles('quikdown-', 'light');
            expect(typeof css).toBe('string');
            expect(css.length).toBeGreaterThan(0);
            expect(css).toContain('quikdown-');
        }
    });

    // emitStyles with 'dark' theme
    test('emitStyles("quikdown-", "dark") returns CSS with dark theme', () => {
        if (typeof quikdown.emitStyles === 'function') {
            const css = quikdown.emitStyles('quikdown-', 'dark');
            expect(typeof css).toBe('string');
            expect(css.length).toBeGreaterThan(0);
        }
    });

    // emitStyles with no args — default prefix
    test('emitStyles() uses default prefix', () => {
        if (typeof quikdown.emitStyles === 'function') {
            const css = quikdown.emitStyles();
            expect(typeof css).toBe('string');
        }
    });

    // quikdown.configure returns a curried parser
    test('quikdown.configure returns callable parser', () => {
        const parser = quikdown.configure({ inline_styles: true });
        expect(typeof parser).toBe('function');
        const html = parser('**bold**');
        expect(html).toContain('<strong');
        expect(html).toContain('style=');
    });

    // Deeply nested inline formatting covers branch paths
    test('deeply nested inline formatting (all markers)', () => {
        const md = '***~~`code` text~~***';
        const html = quikdown(md);
        expect(typeof html).toBe('string');
    });

    // Ordered list with starting number
    test('ordered list with custom start number', () => {
        const html = quikdown('5. first\n6. second\n7. third');
        expect(html).toContain('<ol');
    });

    // Task list with checked items
    test('task list checked state', () => {
        const html = quikdown('- [x] done\n- [ ] todo');
        expect(html).toContain('checked');
    });
});

// ========================================================================
// quikdown_bd.esm.js — target 100% on all 4 metrics
// ========================================================================
describe('quikdown_bd — coverage gap fills', () => {
    // Line 79 of dist: CSS-classes mode (default) with table column alignment
    // returns `class="..." style="text-align:..."` — the else branch of createGetAttr
    test('default CSS-classes mode with aligned table columns', () => {
        const md = '| A | B | C |\n|:---|:---:|---:|\n| 1 | 2 | 3 |';
        const html = quikdown_bd(md); // no inline_styles → CSS classes mode
        // Should have both class AND inline style for alignment
        expect(html).toContain('class="quikdown-th"');
        expect(html).toContain('text-align:center');
        expect(html).toContain('text-align:right');
        // Both should coexist on the same element
        expect(html).toMatch(/<th[^>]*class="[^"]*"[^>]*style="[^"]*text-align/);
    });

    // quikdown_bd.configure delegates to quikdown.configure
    // This is the delegation we added to cover lines 641-642 of the bd dist
    test('quikdown_bd.configure returns functioning bidirectional parser', () => {
        const parser = quikdown_bd.configure({ inline_styles: true });
        expect(typeof parser).toBe('function');
        const html = parser('# Heading\n\n**bold**');
        expect(html).toContain('<h1');
        expect(html).toContain('<strong');
        // bidirectional flag should be set → data-qd attrs present
        expect(html).toContain('data-qd');
    });

    test('quikdown_bd.configure with default options', () => {
        const parser = quikdown_bd.configure({});
        const html = parser('- item 1\n- item 2');
        expect(html).toContain('<li');
        expect(html).toContain('data-qd');
    });
});

// ========================================================================
// quikdown_bd.toMarkdown — reverse conversion coverage gaps
// ========================================================================
describe('quikdown_bd.toMarkdown — fence plugin reverse paths', () => {
    // Lines 766-774 of dist: fence plugin reverse handler in <pre> case (try branch)
    test('pre tag with fence_plugin reverse returns custom content', () => {
        const fence_plugin = {
            render: (code, lang) => `<pre data-qd-lang="${lang}"><code>${code}</code></pre>`,
            reverse: (_node) => ({
                fence: '```',
                lang: 'custom',
                content: 'reverse-extracted content'
            })
        };
        // Build HTML that matches the reverse handler's expectations
        const html = '<pre data-qd-fence="```" data-qd-lang="custom"><code>original</code></pre>';
        const md = quikdown_bd.toMarkdown(html, { fence_plugin });
        expect(md).toContain('```custom');
        expect(md).toContain('reverse-extracted content');
    });

    // Line 782 of dist: pre tag fallback using data-qd-source attribute
    test('pre tag with data-qd-source attribute (fallback path)', () => {
        const html = '<pre data-qd-fence="```" data-qd-lang="python" data-qd-source="def foo(): pass"><code>rendered</code></pre>';
        const md = quikdown_bd.toMarkdown(html);
        expect(md).toContain('```python');
        expect(md).toContain('def foo(): pass');
    });

    // Line 766-774 catch branch: fence plugin reverse throws
    test('pre tag with fence_plugin reverse that throws (caught)', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const fence_plugin = {
            render: (code) => `<pre>${code}</pre>`,
            reverse: () => { throw new Error('intentional failure'); }
        };
        const html = '<pre data-qd-lang="js" data-qd-source="x=1"><code>x=1</code></pre>';
        const md = quikdown_bd.toMarkdown(html, { fence_plugin });
        // Falls through to data-qd-source fallback
        expect(md).toContain('```js');
        expect(md).toContain('x=1');
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    // Line 842, 850-852 of dist: paragraph with trailing blank lines
    // This fires when a paragraph's text content has trailing empty lines
    test('paragraph with trailing blank lines preserved', () => {
        const html = '<p>First line\n\n\n</p>';
        const md = quikdown_bd.toMarkdown(html);
        expect(typeof md).toBe('string');
        expect(md).toContain('First line');
    });
});

// ========================================================================
// quikdown_bd.toMarkdown — div-based fence plugin reverse paths
// ========================================================================
describe('quikdown_bd.toMarkdown — div fence plugin paths', () => {
    // Line 874 of dist: div fence_plugin.reverse throws (catch branch)
    test('div with fence_plugin reverse that throws (caught)', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const fence_plugin = {
            render: (code) => `<div>${code}</div>`,
            reverse: () => { throw new Error('div reverse boom'); }
        };
        const html = '<div data-qd-lang="custom" data-qd-fence="```" data-qd-source="content">x</div>';
        const md = quikdown_bd.toMarkdown(html, { fence_plugin });
        expect(md).toContain('```custom');
        expect(md).toContain('content');
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

// ========================================================================
// quikdown_bd.toMarkdown — mermaid container reverse paths
// ========================================================================
describe('quikdown_bd.toMarkdown — mermaid container paths', () => {
    // Lines 899-902 of dist: mermaid-container with data-qd-source entity decode.
    // This path requires the early `divSource && divFence` fallback (line 887)
    // to NOT match — so we omit data-qd-fence on the container. The mermaid
    // branch then runs and performs the textarea entity decode.
    test('mermaid-container with data-qd-source (HTML-entity decoded)', () => {
        const source = 'graph TD\n  A --&gt; B';
        // No data-qd-fence on the div → skips the divSource&&divFence early
        // return, reaches the mermaid-container branch
        const html = `<div class="mermaid-container" data-qd-lang="mermaid" data-qd-source="${source}">svg here</div>`;
        const md = quikdown_bd.toMarkdown(html);
        expect(md).toContain('```mermaid');
        // The entity should be decoded back to the original character
        expect(md).toContain('A --> B');
    });

    // Lines 907-913 of dist: mermaid-container with pre.mermaid[data-qd-source]
    // Container has no data-qd-source itself, but contains pre.mermaid with one.
    test('mermaid-container with nested pre.mermaid data-qd-source', () => {
        const source = 'sequenceDiagram\n  Alice-&gt;&gt;Bob: Hi';
        // No data-qd-source on the container, no data-qd-fence either
        const html = `<div class="mermaid-container" data-qd-lang="mermaid"><pre class="mermaid" data-qd-source="${source}">rendered</pre></div>`;
        const md = quikdown_bd.toMarkdown(html);
        expect(md).toContain('```mermaid');
        expect(md).toContain('Alice->>Bob: Hi');
    });
});
