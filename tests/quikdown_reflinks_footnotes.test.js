import quikdown from '../dist/quikdown.esm.js';
import quikdown_bd from '../dist/quikdown_bd.esm.js';

// ════════════════════════════════════════════════════════════════════
//  Reference Links — Happy Path
// ════════════════════════════════════════════════════════════════════

describe('Reference Links — Happy Path', () => {
    const opts = { reference_links: true };

    test('full reference [text][id]', () => {
        const md = '[click here][example]\n\n[example]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('<a');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('>click here</a>');
    });

    test('collapsed reference [text][]', () => {
        const md = '[Example][]\n\n[Example]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('>Example</a>');
    });

    test('shortcut reference [id]', () => {
        const md = '[Example]\n\n[Example]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('>Example</a>');
    });

    test('title with double quotes', () => {
        const md = '[link][ref]\n\n[ref]: https://example.com "My Title"';
        const html = quikdown(md, opts);
        expect(html).toContain('title="My Title"');
    });

    test('title with single quotes', () => {
        const md = "[link][ref]\n\n[ref]: https://example.com 'My Title'";
        const html = quikdown(md, opts);
        expect(html).toContain('title="My Title"');
    });

    test('title with parentheses', () => {
        const md = '[link][ref]\n\n[ref]: https://example.com (My Title)';
        const html = quikdown(md, opts);
        expect(html).toContain('title="My Title"');
    });

    test('angle-bracket URL', () => {
        const md = '[link][ref]\n\n[ref]: <https://example.com/path>';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com/path"');
    });

    test('case-insensitive IDs', () => {
        const md = '[link][REF]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com"');
    });

    test('multiple refs to same definition', () => {
        const md = '[first][ref] and [second][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        const count = (html.match(/href="https:\/\/example\.com"/g) || []).length;
        expect(count).toBe(2);
    });

    test('external link gets rel="noopener noreferrer"', () => {
        const md = '[link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('rel="noopener noreferrer"');
    });

    test('internal/relative link has no rel attribute', () => {
        const md = '[link][ref]\n\n[ref]: /about';
        const html = quikdown(md, opts);
        expect(html).not.toContain('rel=');
    });

    test('XSS URL sanitization', () => {
        const md = '[link][ref]\n\n[ref]: javascript:alert(1)';
        const html = quikdown(md, opts);
        expect(html).toContain('href="#"');
        expect(html).not.toContain('javascript:');
    });

    test('inline_styles mode', () => {
        const md = '[link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, { ...opts, inline_styles: true });
        expect(html).toContain('style="');
        expect(html).toContain('href="https://example.com"');
    });

    test('ref inside a list item', () => {
        const md = '- [link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('<li');
        expect(html).toContain('href="https://example.com"');
    });

    test('ref inside a blockquote', () => {
        const md = '> [link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('<blockquote');
        expect(html).toContain('href="https://example.com"');
    });

    test('ref inside a heading', () => {
        const md = '# [link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('<h1');
        expect(html).toContain('href="https://example.com"');
    });

    test('ref inside a table cell', () => {
        const md = '| col |\n|---|\n| [link][ref] |\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('<td');
        expect(html).toContain('href="https://example.com"');
    });

    test('definition line is stripped from output', () => {
        const md = 'Hello [link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        // The definition syntax should not appear as raw text in the body
        expect(html).not.toContain('[ref]:');
        // The URL appears in href attribute
        expect(html).toContain('href="https://example.com"');
    });

    test('multiple different definitions', () => {
        const md = '[a][one] and [b][two]\n\n[one]: https://one.com\n[two]: https://two.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://one.com"');
        expect(html).toContain('href="https://two.com"');
    });

    test('allow_unsafe_urls passthrough', () => {
        const md = '[link][ref]\n\n[ref]: javascript:void(0)';
        const html = quikdown(md, { ...opts, allow_unsafe_urls: true });
        expect(html).toContain('href="javascript:void(0)"');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Reference Links — Malformed / Edge Cases
// ════════════════════════════════════════════════════════════════════

describe('Reference Links — Malformed', () => {
    const opts = { reference_links: true };

    test('missing definition stays as text', () => {
        const md = '[text][undefined-ref]';
        const html = quikdown(md, opts);
        expect(html).toContain('[text][undefined-ref]');
        expect(html).not.toContain('<a');
    });

    test('shortcut with missing definition stays as text', () => {
        const md = '[undefined-ref]';
        const html = quikdown(md, opts);
        expect(html).toContain('[undefined-ref]');
        expect(html).not.toContain('<a');
    });

    test('unclosed brackets — nested open bracket', () => {
        const md = '[text[ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        // [ref] is still a valid shortcut ref inside the text
        // so it resolves — this tests that the parser doesn't crash
        expect(html).toContain('ref');
    });

    test('definition inside code block is not collected', () => {
        const md = '```\n[ref]: https://example.com\n```\n\n[link][ref]';
        const html = quikdown(md, opts);
        // Should not resolve — definition was inside code
        expect(html).toContain('[link][ref]');
    });

    test('duplicate definitions — first wins', () => {
        const md = '[link][ref]\n\n[ref]: https://first.com\n[ref]: https://second.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://first.com"');
        expect(html).not.toContain('href="https://second.com"');
    });

    test('empty URL in definition', () => {
        // The regex requires a non-space char for URL, so empty URL won't match the def
        const md = '[link][ref]\n\n[ref]:';
        const html = quikdown(md, opts);
        expect(html).toContain('[link][ref]');
    });

    test('backslash-escaped brackets preserve literal brackets', () => {
        const md = '\\[literal bracket\\]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        // Escaped brackets become literal characters, not a link
        expect(html).toContain('[literal bracket]');
    });

    test('shortcut does not match footnote-like [^id]', () => {
        const md = '[^note]\n\n[^note]: https://example.com';
        const html = quikdown(md, opts);
        // [^note] contains ^ so shortcut regex excludes it
        expect(html).not.toContain('href="https://example.com"');
    });

    test('very long IDs work', () => {
        const longId = 'a'.repeat(200);
        const md = `[text][${longId}]\n\n[${longId}]: https://example.com`;
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com"');
    });

    test('extra content after title is not a valid definition', () => {
        const md = '[link][ref]\n\n[ref]: https://example.com "title" extra';
        const html = quikdown(md, opts);
        // Definition line has trailing content after title — regex won't match
        expect(html).toContain('[link][ref]');
    });

    test('definition with only whitespace after colon is not valid', () => {
        const md = '[link][ref]\n\n[ref]:   ';
        const html = quikdown(md, opts);
        expect(html).toContain('[link][ref]');
    });

    test('inline link syntax is not affected by reference_links', () => {
        const md = '[link](https://example.com)\n\n[ref]: https://other.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com"');
    });

    test('nested brackets in text part', () => {
        const md = '[[nested]][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        // The outer [text] should not match correctly
        // This is an edge case where behavior varies by parser
    });

    test('collapsed reference case-insensitive', () => {
        const md = '[EXAMPLE][]\n\n[example]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('href="https://example.com"');
    });

    test('collapsed reference with no definition stays as text', () => {
        const md = '[nope][]';
        const html = quikdown(md, opts);
        expect(html).toContain('[nope][]');
    });

    test('image syntax is not broken by reference_links', () => {
        const md = '![alt](https://img.com/x.png)\n\n[ref]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).toContain('<img');
        expect(html).toContain('src="https://img.com/x.png"');
    });

    test('definition stripped even if unreferenced', () => {
        const md = 'Hello world\n\n[unused]: https://example.com';
        const html = quikdown(md, opts);
        expect(html).not.toContain('[unused]');
        expect(html).not.toContain('example.com');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Footnotes — Happy Path
// ════════════════════════════════════════════════════════════════════

describe('Footnotes — Happy Path', () => {
    const opts = { footnotes: true };

    test('basic footnote [^1]', () => {
        const md = 'Text[^1]\n\n[^1]: Footnote text';
        const html = quikdown(md, opts);
        expect(html).toContain('<sup');
        expect(html).toContain('href="#fn-1"');
        expect(html).toContain('id="fnref-1"');
        expect(html).toContain('>1</a>');
        expect(html).toContain('<section');
        expect(html).toContain('id="fn-1"');
        expect(html).toContain('Footnote text');
        expect(html).toContain('↩');
    });

    test('named footnote [^note]', () => {
        const md = 'Text[^note]\n\n[^note]: Named footnote';
        const html = quikdown(md, opts);
        expect(html).toContain('href="#fn-note"');
        expect(html).toContain('id="fn-note"');
        expect(html).toContain('Named footnote');
    });

    test('multiple footnotes in order', () => {
        const md = 'First[^a] and second[^b]\n\n[^a]: Note A\n[^b]: Note B';
        const html = quikdown(md, opts);
        expect(html).toContain('>1</a>');
        expect(html).toContain('>2</a>');
        // Verify order in footnotes section
        const fnA = html.indexOf('Note A');
        const fnB = html.indexOf('Note B');
        expect(fnA).toBeLessThan(fnB);
    });

    test('inline formatting in footnote definition', () => {
        const md = 'Text[^1]\n\n[^1]: This is **bold** and *italic*';
        const html = quikdown(md, opts);
        expect(html).toContain('<strong');
        expect(html).toContain('bold');
        expect(html).toContain('<em');
        expect(html).toContain('italic');
    });

    test('sequential numbering regardless of ID', () => {
        const md = 'A[^z] B[^a]\n\n[^z]: First\n[^a]: Second';
        const html = quikdown(md, opts);
        // [^z] appears first → gets number 1
        const sup1 = html.match(/<sup[^>]*>.*?<a[^>]*>1<\/a>/);
        expect(sup1).not.toBeNull();
        const sup2 = html.match(/<sup[^>]*>.*?<a[^>]*>2<\/a>/);
        expect(sup2).not.toBeNull();
    });

    test('back-link href is correct', () => {
        const md = 'Text[^test]\n\n[^test]: Note';
        const html = quikdown(md, opts);
        expect(html).toContain('href="#fnref-test"');
    });

    test('<hr> separator before footnotes', () => {
        const md = 'Text[^1]\n\n[^1]: Note';
        const html = quikdown(md, opts);
        expect(html).toContain('<hr');
    });

    test('<section> wrapper around footnotes', () => {
        const md = 'Text[^1]\n\n[^1]: Note';
        const html = quikdown(md, opts);
        expect(html).toContain('<section');
        expect(html).toContain('</section>');
    });

    test('multi-line definition with indented continuation', () => {
        const md = 'Text[^1]\n\n[^1]: First line\n    continued here';
        const html = quikdown(md, opts);
        expect(html).toContain('First line');
        expect(html).toContain('continued here');
    });

    test('same footnote referenced twice uses same number', () => {
        const md = 'First[^1] and again[^1]\n\n[^1]: Note';
        const html = quikdown(md, opts);
        // Both should display number 1
        const sups = html.match(/<sup[^>]*>.*?<a[^>]*>1<\/a><\/sup>/g);
        expect(sups).not.toBeNull();
        expect(sups.length).toBe(2);
        // Only one footnote definition in the section
        const lis = html.match(/<li[^>]*id="fn-1"/g);
        expect(lis.length).toBe(1);
    });

    test('inline_styles mode', () => {
        const md = 'Text[^1]\n\n[^1]: Note';
        const html = quikdown(md, { ...opts, inline_styles: true });
        expect(html).toContain('style="');
        expect(html).toContain('<sup');
    });

    test('footnote definition line is stripped from output', () => {
        const md = 'Hello[^1]\n\n[^1]: Footnote content';
        const html = quikdown(md, opts);
        // The definition should not appear as raw text in the body
        const bodyPart = html.split('<section')[0];
        expect(bodyPart).not.toContain('[^1]:');
    });

    test('inline code in footnote definition', () => {
        const md = 'Text[^1]\n\n[^1]: Use `code` here';
        const html = quikdown(md, opts);
        expect(html).toContain('<code');
        expect(html).toContain('code');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Footnotes — Malformed / Edge Cases
// ════════════════════════════════════════════════════════════════════

describe('Footnotes — Malformed', () => {
    const opts = { footnotes: true };

    test('missing definition leaves marker as text', () => {
        const md = 'Text[^unknown]';
        const html = quikdown(md, opts);
        expect(html).toContain('[^unknown]');
        expect(html).not.toContain('<sup');
    });

    test('definition in code block is not collected', () => {
        const md = '```\n[^1]: Not a footnote\n```\n\nText[^1]';
        const html = quikdown(md, opts);
        expect(html).toContain('[^1]');
        expect(html).not.toContain('<section');
    });

    test('duplicate definitions — first wins', () => {
        const md = 'Text[^1]\n\n[^1]: First\n[^1]: Second';
        const html = quikdown(md, opts);
        expect(html).toContain('First');
        expect(html).not.toMatch(/<li[^>]*>Second/);
    });

    test('empty definition text', () => {
        const md = 'Text[^1]\n\n[^1]: ';
        const html = quikdown(md, opts);
        // Should still render the footnote section, even with empty text
        expect(html).toContain('<sup');
        expect(html).toContain('id="fn-1"');
    });

    test('special characters in ID', () => {
        const md = 'Text[^a-b_c]\n\n[^a-b_c]: Note';
        const html = quikdown(md, opts);
        expect(html).toContain('href="#fn-a-b_c"');
        expect(html).toContain('id="fn-a-b_c"');
    });

    test('unreferenced definition is not rendered', () => {
        const md = 'Hello world\n\n[^unused]: This should not appear';
        const html = quikdown(md, opts);
        expect(html).not.toContain('<section');
        expect(html).not.toContain('This should not appear');
    });

    test('unclosed bracket stays as text', () => {
        const md = 'Text[^unclosed';
        const html = quikdown(md, opts);
        expect(html).toContain('[^unclosed');
        expect(html).not.toContain('<sup');
    });

    test('bare [^] stays as text', () => {
        const md = 'Text[^]';
        const html = quikdown(md, opts);
        expect(html).toContain('[^]');
        expect(html).not.toContain('<sup');
    });

    test('continuation stops at non-indented line', () => {
        const md = 'Text[^1]\n\n[^1]: First line\nNot continued\n\n[^1] should not have "Not continued"';
        const html = quikdown(md, opts);
        // "Not continued" should be in the body, not in the footnote
        const sectionIdx = html.indexOf('<section');
        if (sectionIdx !== -1) {
            const sectionHtml = html.slice(sectionIdx);
            expect(sectionHtml).not.toContain('Not continued');
        }
    });

    test('footnote in middle of paragraph', () => {
        const md = 'Hello[^1] world\n\n[^1]: Note';
        const html = quikdown(md, opts);
        expect(html).toContain('Hello<sup');
        expect(html).toContain('world');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Feature Interactions
// ════════════════════════════════════════════════════════════════════

describe('Feature Interactions', () => {
    test('both enabled together', () => {
        const md = '[link][ref] and [^1]\n\n[ref]: https://example.com\n[^1]: Footnote';
        const html = quikdown(md, { reference_links: true, footnotes: true });
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('<sup');
        expect(html).toContain('<section');
    });

    test('both disabled — syntax passes through as text', () => {
        const md = '[link][ref] and [^1]\n\n[ref]: /about\n[^1]: Footnote';
        const html = quikdown(md);
        expect(html).toContain('[link][ref]');
        expect(html).toContain('[^1]');
        // Definition lines stay in the output (not stripped when features disabled)
        expect(html).toContain('[ref]: /about');
    });

    test('only reference_links enabled — footnote syntax ignored', () => {
        const md = '[link][ref] and [^1]\n\n[ref]: https://example.com\n[^1]: Footnote text';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('[^1]');
        // The [^1]: line won't be collected as a ref link def (starts with ^)
    });

    test('only footnotes enabled — reference link syntax ignored', () => {
        const md = '[link][ref] and [^1]\n\n[ref]: https://example.com\n[^1]: Footnote text';
        const html = quikdown(md, { footnotes: true });
        expect(html).toContain('[link][ref]');
        expect(html).toContain('<sup');
    });

    test('lazy_linefeeds with footnotes', () => {
        const md = 'Text[^1]\n\n[^1]: Note';
        const html = quikdown(md, { footnotes: true, lazy_linefeeds: true });
        expect(html).toContain('<sup');
        expect(html).toContain('<section');
    });

    test('allow_unsafe_html with reference links', () => {
        const md = '<b>bold</b> [link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, { reference_links: true, allow_unsafe_html: true });
        expect(html).toContain('<b>bold</b>');
        expect(html).toContain('href="https://example.com"');
    });

    test('heading_ids with reference links', () => {
        const md = '# Heading\n\n[link][ref]\n\n[ref]: https://example.com';
        const html = quikdown(md, { reference_links: true, heading_ids: true });
        expect(html).toContain('id="heading"');
        expect(html).toContain('href="https://example.com"');
    });

    test('definition that looks like both ref and footnote', () => {
        // [^note]: could be a footnote def; [^note] as shortcut ref would be excluded by ^ in regex
        const md = 'Text[^note]\n\n[^note]: This is a footnote';
        const html = quikdown(md, { reference_links: true, footnotes: true });
        // Should be treated as a footnote
        expect(html).toContain('<sup');
        expect(html).toContain('This is a footnote');
    });

    test('reference links work alongside inline links', () => {
        const md = '[inline](https://inline.com) and [ref][id]\n\n[id]: https://ref.com';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('href="https://inline.com"');
        expect(html).toContain('href="https://ref.com"');
    });

    test('footnote inside a list item', () => {
        const md = '- Item[^1]\n\n[^1]: Note';
        const html = quikdown(md, { footnotes: true });
        expect(html).toContain('<li');
        expect(html).toContain('<sup');
    });

    test('footnote inside a blockquote', () => {
        const md = '> Text[^1]\n\n[^1]: Note';
        const html = quikdown(md, { footnotes: true });
        expect(html).toContain('<blockquote');
        expect(html).toContain('<sup');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Bidirectional Round-Trip
// ════════════════════════════════════════════════════════════════════

describe('Bidirectional Round-Trip', () => {
    test('full reference [text][id] round-trip', () => {
        const md = '[click here][example]\n\n[example]: https://example.com';
        const html = quikdown_bd(md, { reference_links: true });
        expect(html).toContain('data-qd="[ref"');
        expect(html).toContain('data-qd-ref="example"');
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[click here][example]');
    });

    test('collapsed reference [text][] round-trip', () => {
        const md = '[Example][]\n\n[Example]: https://example.com';
        const html = quikdown_bd(md, { reference_links: true });
        expect(html).toContain('data-qd-ref=""');
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[Example][]');
    });

    test('shortcut reference [id] round-trip', () => {
        const md = '[example]\n\n[example]: https://example.com';
        const html = quikdown_bd(md, { reference_links: true });
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[example]');
    });

    test('footnote marker round-trip', () => {
        const md = 'Text[^1]\n\n[^1]: Footnote content';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('data-qd="[^"');
        expect(html).toContain('data-qd-fn="1"');
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[^1]');
    });

    test('footnotes section round-trip', () => {
        const md = 'Text[^note]\n\n[^note]: My footnote';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('data-qd="[^section"');
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[^note]: My footnote');
    });

    test('full doc with refs and footnotes round-trip', () => {
        const md = '# Title\n\n[link][ref] and [^1]\n\n[ref]: https://example.com\n[^1]: A footnote';
        const html = quikdown_bd(md, { reference_links: true, footnotes: true });
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[link][ref]');
        expect(result).toContain('[^1]');
        expect(result).toContain('[^1]: A footnote');
    });

    test('bidir with inline_styles', () => {
        const md = '[link][ref]\n\n[ref]: https://example.com';
        const html = quikdown_bd(md, { reference_links: true, inline_styles: true });
        expect(html).toContain('style="');
        expect(html).toContain('data-qd-ref="ref"');
    });
});

// ════════════════════════════════════════════════════════════════════
//  Coverage Boost — Branch coverage for edge cases
// ════════════════════════════════════════════════════════════════════

describe('Coverage — Branch targeting', () => {
    test('unresolved collapsed ref [text][] with existing defs', () => {
        // Ensures the "no def" branch is hit inside the full ref regex handler
        const md = '[text][] and [link][known]\n\n[known]: https://example.com';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('[text][]');
        expect(html).toContain('href="https://example.com"');
    });

    test('shortcut ref with internal URL (no rel attr)', () => {
        const md = '[about]\n\n[about]: /about';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('href="/about"');
        expect(html).not.toContain('rel=');
    });

    test('shortcut ref with title', () => {
        const md = '[about]\n\n[about]: /about "About page"';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('title="About page"');
    });

    test('footnotes with allow_unsafe_html: true', () => {
        const md = 'Text[^1]\n\n[^1]: <b>bold</b> note';
        const html = quikdown(md, { footnotes: true, allow_unsafe_html: true });
        expect(html).toContain('<b>bold</b>');
        expect(html).toContain('<section');
    });

    test('unresolved footnote with other defs present', () => {
        // fnDefs.size > 0 but specific id missing — hits the "return match" branch
        const md = 'Known[^a] and unknown[^b]\n\n[^a]: Note A';
        const html = quikdown(md, { footnotes: true });
        expect(html).toContain('<sup');
        expect(html).toContain('[^b]');
    });

    test('shortcut ref with XSS url gets sanitized', () => {
        const md = '[evil]\n\n[evil]: javascript:alert(1)';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('href="#"');
    });

    test('full ref with unresolved ID where other refs exist', () => {
        // Tests the "return match" branch in the full ref handler
        const md = '[text][missing] and [text][found]\n\n[found]: https://found.com';
        const html = quikdown(md, { reference_links: true });
        expect(html).toContain('[text][missing]');
        expect(html).toContain('href="https://found.com"');
    });

    test('strikethrough in footnote definition', () => {
        const md = 'Text[^1]\n\n[^1]: This is ~~deleted~~ text';
        const html = quikdown(md, { footnotes: true });
        expect(html).toContain('<del');
    });

    test('__bold__ in footnote definition', () => {
        const md = 'Text[^1]\n\n[^1]: This is __bold__ text';
        const html = quikdown(md, { footnotes: true });
        expect(html).toContain('<strong');
    });

    test('section cleanup pattern works (footnotes after paragraph)', () => {
        const md = 'Paragraph text[^1]\n\n[^1]: Note';
        const html = quikdown(md, { footnotes: true });
        // Section should not be wrapped in <p>
        expect(html).not.toContain('<p><section');
    });

    // BD-specific branch coverage
    test('BD: definition inside code block not collected', () => {
        const md = '```\n[^1]: Not a footnote\n```\n\nText[^1]';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('[^1]');
        expect(html).not.toContain('<section');
    });

    test('BD: footnote with indented continuation', () => {
        const md = 'Text[^1]\n\n[^1]: First line\n    continued here';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('First line');
        expect(html).toContain('continued here');
    });

    test('BD: same footnote referenced twice', () => {
        const md = 'First[^1] and again[^1]\n\n[^1]: Note';
        const html = quikdown_bd(md, { footnotes: true });
        const sups = html.match(/<sup[^>]*>/g);
        expect(sups.length).toBe(2);
    });

    test('BD: footnote with inline formatting round-trip', () => {
        const md = 'Text[^1]\n\n[^1]: This is **bold** text';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('<strong');
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('[^1]');
        expect(result).toContain('[^1]:');
        expect(result).toContain('bold');
    });

    test('BD: section without data-qd passes through', () => {
        // Test the section handler when data-qd is not [^section
        const html = '<section><p>content</p></section>';
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('content');
    });

    test('BD: sup without data-qd-fn passes through', () => {
        const html = '<p>x<sup>2</sup></p>';
        const result = quikdown_bd.toMarkdown(html);
        expect(result).toContain('2');
    });

    test('BD: continuation stops at non-indented line', () => {
        const md = 'Text[^1]\n\n[^1]: First line\nNot continued\n\nMore text';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('First line');
        // "Not continued" should be in the body, not the footnote
        const sectionIdx = html.indexOf('<section');
        if (sectionIdx !== -1) {
            const sectionHtml = html.slice(sectionIdx);
            expect(sectionHtml).not.toContain('Not continued');
        }
    });

    test('BD: indented code block placeholder skip in definition collection', () => {
        // Code block on a line that goes through the PLACEHOLDER_CB check
        const md = '```\ncode\n```\n\n[^1]: note\n\nText[^1]';
        const html = quikdown_bd(md, { footnotes: true });
        expect(html).toContain('<pre');
        expect(html).toContain('<sup');
    });

    // BD bundle branch coverage for pre-existing helper functions
    test('BD: link with single-quote title', () => {
        const md = "[link](/url 'title')";
        const html = quikdown_bd(md);
        expect(html).toContain('title="title"');
    });

    test('BD: link with angle-bracket URL', () => {
        const md = '[link](<http://example.com>)';
        const html = quikdown_bd(md);
        expect(html).toContain('href="http://example.com"');
    });

    test('BD: heading_ids slug generation', () => {
        const md = '# Hello World\n\n## Hello World';
        const html = quikdown_bd(md, { heading_ids: true });
        expect(html).toContain('id="hello-world"');
        expect(html).toContain('id="hello-world-1"');
    });

    test('BD: heading slug with special chars', () => {
        const md = '# ***Bold Heading***';
        const html = quikdown_bd(md, { heading_ids: true });
        expect(html).toContain('id="');
    });

    test('BD: indented code block', () => {
        const md = '    code line 1\n    code line 2';
        const html = quikdown_bd(md);
        expect(html).toContain('<pre');
        expect(html).toContain('<code');
    });

    test('BD: indented code block with blank line between', () => {
        const md = '    line 1\n\n    line 2';
        const html = quikdown_bd(md);
        expect(html).toContain('<pre');
    });

    test('BD: link with double-quote title', () => {
        const md = '[link](/url "my title")';
        const html = quikdown_bd(md);
        expect(html).toContain('title="my title"');
    });
});
