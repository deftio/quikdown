/**
 * Quikdown Editor - Drop-in Markdown Parser
 * @version 1.2.9
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.QuikdownEditor = factory());
})(this, (function () { 'use strict';

    /**
     * quikdown_classify — Shared line-classification utilities
     * ═════════════════════════════════════════════════════════
     *
     * Pure functions for classifying markdown lines.  Used by both the main
     * parser (quikdown.js) and the editor (quikdown_edit.js) so the logic
     * lives in one place.
     *
     * All functions operate on a **trimmed** line (caller must trim).
     * None use regexes with nested quantifiers — every check is either a
     * simple regex or a linear scan, so there is zero ReDoS risk.
     */

    /**
     * Full CommonMark HR check: three or more identical characters from
     * {-, *, _} with optional interspersed whitespace.
     *
     * Examples that return true:  ---, ***, ___, ----, - - -, * * *, _  _  _
     * Examples that return false: --, - text, ---text, mixed -_*, empty
     *
     * Algorithm (O(n), single pass, no backtracking):
     *   1. Strip all whitespace
     *   2. Verify length >= 3
     *   3. First char must be -, *, or _
     *   4. Every remaining char must equal the first
     *
     * @param {string} trimmed  The line, already trimmed
     * @returns {boolean}
     */
    function isHRLine(trimmed) {
        if (trimmed.length < 3) return false;

        // Strip whitespace via linear scan
        let stripped = '';
        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];
            if (ch !== ' ' && ch !== '\t') stripped += ch;
        }

        if (stripped.length < 3) return false;

        const ch = stripped[0];
        if (ch !== '-' && ch !== '*' && ch !== '_') return false;

        for (let i = 1; i < stripped.length; i++) {
            if (stripped[i] !== ch) return false;
        }
        return true;
    }

    /**
     * Dash-only HR check — exact parity with the main parser's original
     * regex `/^---+\s*$/`.  Only matches lines of three or more dashes
     * with optional trailing whitespace (no interspersed spaces).
     *
     * @param {string} trimmed  The line, already trimmed
     * @returns {boolean}
     */
    function isDashHRLine(trimmed) {
        if (trimmed.length < 3) return false;
        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];
            if (ch === '-') continue;
            // Allow trailing whitespace only
            if (ch === ' ' || ch === '\t') {
                for (let j = i + 1; j < trimmed.length; j++) {
                    if (trimmed[j] !== ' ' && trimmed[j] !== '\t') return false;
                }
                return i >= 3; // at least 3 dashes before whitespace
            }
            return false;
        }
        return true; // all dashes
    }

    /**
     * Check if a trimmed line opens a code fence.
     * Returns { char, len, lang } if it does, or null otherwise.
     *
     * A fence opener is 3+ identical backticks or tildes at the start of a line,
     * optionally followed by a language tag.
     *
     * @param {string} trimmed  The line, already trimmed
     * @returns {{ char: string, len: number, lang: string } | null}
     */
    function fenceOpen(trimmed) {
        if (trimmed.length < 3) return null;
        const ch = trimmed[0];
        if (ch !== '`' && ch !== '~') return null;

        let len = 1;
        while (len < trimmed.length && trimmed[len] === ch) len++;
        if (len < 3) return null;

        const lang = trimmed.slice(len).trim();
        return { char: ch, len, lang };
    }

    /**
     * Check if a trimmed line closes an open fence.
     * The closing fence must use the same character, be at least as long,
     * and have no content after (optional trailing whitespace only).
     *
     * @param {string} trimmed   The line, already trimmed
     * @param {string} openChar  The fence character ('`' or '~')
     * @param {number} openLen   Length of the opening fence marker
     * @returns {boolean}
     */
    function isFenceClose(trimmed, openChar, openLen) {
        if (trimmed.length < openLen) return false;

        let len = 0;
        while (len < trimmed.length && trimmed[len] === openChar) len++;
        if (len < openLen) return false;

        // Rest must be whitespace only
        for (let i = len; i < trimmed.length; i++) {
            if (trimmed[i] !== ' ' && trimmed[i] !== '\t') return false;
        }
        return true;
    }

    /**
     * Classify a content line into a category string.
     * Order matters: HR before list-ul (since `- - -` looks like a list start).
     *
     * @param {string} trimmed  The line, already trimmed
     * @returns {string}  One of: 'heading', 'hr', 'list-ol', 'list-ul',
     *                    'blockquote', 'table', 'paragraph'
     */
    function classifyLine(trimmed) {
        if (/^#{1,6}\s/.test(trimmed))         return 'heading';
        if (isHRLine(trimmed))                 return 'hr';
        if (/^\d+\.\s/.test(trimmed))          return 'list-ol';
        if (/^[-*+]\s/.test(trimmed))          return 'list-ul';
        if (/^>/.test(trimmed))                return 'blockquote';
        if (/^\|/.test(trimmed))               return 'table';
        return 'paragraph';
    }

    /**
     * Heuristic: does a line look like a markdown table row?
     * @param {string} line  The line (trimmed or untrimmed)
     * @returns {boolean}
     */
    function looksLikeTableRow(line) {
        return line.includes('|');
    }

    /**
     * quikdown — A compact, scanner-based markdown parser
     * ════════════════════════════════════════════════════
     *
     * Architecture overview (v1.2.8 — lexer rewrite)
     * ───────────────────────────────────────────────
     * Prior to v1.2.8, quikdown used a multi-pass regex pipeline: each block
     * type (headings, blockquotes, HR, lists, tables) and each inline format
     * (bold, italic, links, …) was handled by its own global regex applied
     * sequentially to the full document string. That worked but made the code
     * hard to extend and debug — a new construct meant adding another regex
     * pass, and ordering bugs between passes were subtle.
     *
     * Starting in v1.2.8 the parser uses a **line-scanning** approach for
     * block detection and a **per-block inline pass** for formatting:
     *
     *   ┌─────────────────────────────────────────────────────────┐
     *   │  Phase 1 — Code Extraction                             │
     *   │  Scan for fenced code blocks (``` / ~~~) and inline    │
     *   │  code spans (`…`). Replace with §CB§ / §IC§ place-    │
     *   │  holders so code content is never touched by later      │
     *   │  phases.                                                │
     *   ├─────────────────────────────────────────────────────────┤
     *   │  Phase 2 — HTML Escaping                                │
     *   │  Escape &, <, >, ", ' in the remaining text to prevent │
     *   │  XSS. (Skipped when allow_unsafe_html is true.)         │
     *   ├─────────────────────────────────────────────────────────┤
     *   │  Phase 3 — Block Scanning                               │
     *   │  Walk the text **line by line**.  At each line, the     │
     *   │  scanner checks (in order):                             │
     *   │    • table rows  (|)                                    │
     *   │    • headings    (#)                                    │
     *   │    • HR          (---)                                  │
     *   │    • blockquotes (&gt;)                                 │
     *   │    • list items  (-, *, +, 1.)                          │
     *   │    • code-block placeholder (§CB…§)                     │
     *   │    • paragraph text (everything else)                   │
     *   │                                                         │
     *   │  Block text is run through the **inline formatter**     │
     *   │  which handles bold, italic, strikethrough, links,      │
     *   │  images, and autolinks.                                 │
     *   │                                                         │
     *   │  Paragraphs are wrapped in <p> tags.  Lazy linefeeds   │
     *   │  (single \n → <br>) are handled here too.               │
     *   ├─────────────────────────────────────────────────────────┤
     *   │  Phase 4 — Code Restoration                             │
     *   │  Replace §CB§ / §IC§ placeholders with rendered <pre>  │
     *   │  / <code> HTML, applying the fence_plugin if present.   │
     *   └─────────────────────────────────────────────────────────┘
     *
     * Why this design?
     *  • Single pass over lines for block identification — no re-scanning.
     *  • Each block type is a clearly separated branch, easy to add new ones.
     *  • Inline formatting is confined to block text — can't accidentally
     *    match across block boundaries or inside HTML tags.
     *  • Code extraction still uses a simple regex (it's one pattern, not a
     *    chain) because the §-placeholder approach is proven and simple.
     *
     * @param {string} markdown  The markdown source text
     * @param {Object} options   Configuration (see below)
     * @returns {string}         Rendered HTML
     */


    // ────────────────────────────────────────────────────────────────────
    //  Constants
    // ────────────────────────────────────────────────────────────────────

    /** Build-time version stamp (injected by tools/updateVersion) */
    const quikdownVersion = '1.2.9';

    /** CSS class prefix used for all generated elements */
    const CLASS_PREFIX = 'quikdown-';

    /** Placeholder sigils — chosen to be extremely unlikely in real text */
    const PLACEHOLDER_CB = '§CB';   // fenced code blocks
    const PLACEHOLDER_IC = '§IC';   // inline code spans

    /** HTML entity escape map */
    const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

    // ────────────────────────────────────────────────────────────────────
    //  Style definitions
    // ────────────────────────────────────────────────────────────────────

    /**
     * Inline styles for every element quikdown can emit.
     * When `inline_styles: true` these are injected as style="…" attributes.
     * When `inline_styles: false` (default) we use class="quikdown-<tag>"
     * and these same values are emitted by `quikdown.emitStyles()`.
     */
    const QUIKDOWN_STYLES = {
        h1: 'font-size:2em;font-weight:600;margin:.67em 0;text-align:left',
        h2: 'font-size:1.5em;font-weight:600;margin:.83em 0',
        h3: 'font-size:1.25em;font-weight:600;margin:1em 0',
        h4: 'font-size:1em;font-weight:600;margin:1.33em 0',
        h5: 'font-size:.875em;font-weight:600;margin:1.67em 0',
        h6: 'font-size:.85em;font-weight:600;margin:2em 0',
        pre: 'background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0',
        code: 'background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace',
        blockquote: 'border-left:4px solid #ddd;margin-left:0;padding-left:1em',
        table: 'border-collapse:collapse;width:100%;margin:1em 0',
        th: 'border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left',
        td: 'border:1px solid #ddd;padding:8px;text-align:left',
        hr: 'border:none;border-top:1px solid #ddd;margin:1em 0',
        img: 'max-width:100%;height:auto',
        a: 'color:#06c;text-decoration:underline',
        strong: 'font-weight:bold',
        em: 'font-style:italic',
        del: 'text-decoration:line-through',
        ul: 'margin:.5em 0;padding-left:2em',
        ol: 'margin:.5em 0;padding-left:2em',
        li: 'margin:.25em 0',
        'task-item': 'list-style:none',
        'task-checkbox': 'margin-right:.5em'
    };

    // ────────────────────────────────────────────────────────────────────
    //  Attribute factory
    // ────────────────────────────────────────────────────────────────────

    /**
     * Creates a `getAttr(tag, additionalStyle?)` helper that returns
     * either a class="…" or style="…" attribute string depending on mode.
     *
     * @param {boolean} inline_styles  True → emit style="…"; false → class="…"
     * @param {Object}  styles         The QUIKDOWN_STYLES map
     * @returns {Function}
     */
    function createGetAttr(inline_styles, styles) {
        return function(tag, additionalStyle = '') {
            if (inline_styles) {
                let style = styles[tag];
                if (!style && !additionalStyle) return '';

                // When adding alignment that conflicts with the tag's default,
                // strip the default text-align first.
                if (additionalStyle && additionalStyle.includes('text-align') && style && style.includes('text-align')) {
                    style = style.replace(/text-align:[^;]+;?/, '').trim();
                    /* istanbul ignore next */
                    if (style && !style.endsWith(';')) style += ';';
                }

                /* istanbul ignore next - defensive: additionalStyle without style doesn't occur with current tags */
                const fullStyle = additionalStyle ? (style ? `${style}${additionalStyle}` : additionalStyle) : style;
                return ` style="${fullStyle}"`;
            } else {
                const classAttr = ` class="${CLASS_PREFIX}${tag}"`;
                if (additionalStyle) {
                    return `${classAttr} style="${additionalStyle}"`;
                }
                return classAttr;
            }
        };
    }

    // ════════════════════════════════════════════════════════════════════
    //  Main parser function
    // ════════════════════════════════════════════════════════════════════

    function quikdown(markdown, options = {}) {
        // ── Guard: only process non-empty strings ──
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }

        // ── Unpack options ──
        const { fence_plugin, inline_styles = false, bidirectional = false, lazy_linefeeds = false, allow_unsafe_html = false } = options;
        const styles = QUIKDOWN_STYLES;
        const getAttr = createGetAttr(inline_styles, styles);

        // ── Helpers (closed over options) ──

        /** Escape the five HTML-special characters. */
        function escapeHtml(text) {
            return text.replace(/[&<>"']/g, m => ESC_MAP[m]);
        }

        /**
         * Bidirectional marker helper.
         * When bidirectional mode is on, returns ` data-qd="…"`.
         * The non-bidirectional branch is a trivial no-op arrow; it is
         * exercised in the core bundle but never in quikdown_bd.
         */
        /* istanbul ignore next - trivial no-op fallback */
        const dataQd = bidirectional ? (marker) => ` data-qd="${escapeHtml(marker)}"` : () => '';

        /**
         * Sanitize a URL to block javascript:, vbscript:, and non-image data: URIs.
         * Returns '#' for blocked URLs.
         */
        function sanitizeUrl(url, allowUnsafe = false) {
            /* istanbul ignore next - defensive programming, regex ensures url is never empty */
            if (!url) return '';
            if (allowUnsafe) return url;

            const trimmedUrl = url.trim();
            const lowerUrl = trimmedUrl.toLowerCase();
            const dangerousProtocols = ['javascript:', 'vbscript:', 'data:'];

            for (const protocol of dangerousProtocols) {
                if (lowerUrl.startsWith(protocol)) {
                    if (protocol === 'data:' && lowerUrl.startsWith('data:image/')) {
                        return trimmedUrl;
                    }
                    return '#';
                }
            }
            return trimmedUrl;
        }

        // ────────────────────────────────────────────────────────────────
        //  Phase 1 — Code Extraction
        // ────────────────────────────────────────────────────────────────
        // Why extract code first?  Fenced blocks and inline code spans can
        // contain markdown-like characters (*, _, #, |, etc.) that must NOT
        // be interpreted as formatting.  By pulling them out and replacing
        // with unique placeholders, the rest of the pipeline never sees them.

        let html = markdown;
        const codeBlocks = [];    // Array of {lang, code, custom, fence, hasReverse}
        const inlineCodes = [];   // Array of escaped-HTML strings

        // ── Fenced code blocks ──
        // Matches paired fences: ``` with ``` and ~~~ with ~~~.
        // The fence must start at column 0 of a line (^ with /m flag).
        // Group 1 = fence marker, Group 2 = language hint, Group 3 = code body.
        html = html.replace(/^(```|~~~)([^\n]*)\n([\s\S]*?)^\1$/gm, (match, fence, lang, code) => {
            const placeholder = `${PLACEHOLDER_CB}${codeBlocks.length}§`;
            const langTrimmed = lang ? lang.trim() : '';

            if (fence_plugin && fence_plugin.render && typeof fence_plugin.render === 'function') {
                // Custom plugin — store raw code (un-escaped) so the plugin
                // receives the original source.
                codeBlocks.push({
                    lang: langTrimmed,
                    code: code.trimEnd(),
                    custom: true,
                    fence: fence,
                    hasReverse: !!fence_plugin.reverse
                });
            } else {
                // Default — pre-escape the code for safe HTML output.
                codeBlocks.push({
                    lang: langTrimmed,
                    code: escapeHtml(code.trimEnd()),
                    custom: false,
                    fence: fence
                });
            }
            return placeholder;
        });

        // ── Inline code spans ──
        // Matches a single backtick pair: `content`.
        // Content is captured and HTML-escaped immediately.
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            const placeholder = `${PLACEHOLDER_IC}${inlineCodes.length}§`;
            inlineCodes.push(escapeHtml(code));
            return placeholder;
        });

        // ────────────────────────────────────────────────────────────────
        //  Phase 2 — HTML Escaping
        // ────────────────────────────────────────────────────────────────
        // All remaining text (everything except code placeholders) is escaped
        // to prevent XSS.  The `allow_unsafe_html` option skips this for
        // trusted pipelines that intentionally embed raw HTML.

        if (!allow_unsafe_html) {
            html = escapeHtml(html);
        }

        // ────────────────────────────────────────────────────────────────
        //  Phase 3 — Block Scanning + Inline Formatting + Paragraphs
        // ────────────────────────────────────────────────────────────────
        // This is the heart of the lexer rewrite.  Instead of applying
        // 10+ global regex passes, we:
        //   1. Process tables (line walker — tables need multi-line lookahead)
        //   2. Scan remaining lines for headings, HR, blockquotes
        //   3. Process lists (line walker — lists need indent tracking)
        //   4. Apply inline formatting to all text content
        //   5. Wrap remaining text in <p> tags
        //
        // Steps 1 and 3 are line-walkers that process the full text in a
        // single pass each.  Step 2 replaces global regex with a per-line
        // scanner.  Steps 4-5 are applied to the result.
        //
        // Total: 3 structured passes instead of 10+ regex passes.

        // ── Step 1: Tables ──
        // Tables need multi-line lookahead (header → separator → body rows)
        // so they're handled by a dedicated line-walker first.
        html = processTable(html, getAttr);

        // ── Step 2: Headings, HR, Blockquotes ──
        // These are simple line-level constructs.  We scan each line once
        // and replace matching lines with their HTML representation.
        html = scanLineBlocks(html, getAttr, dataQd);

        // ── Step 3: Lists ──
        // Lists need indent-level tracking across lines, so they get their
        // own line-walker.
        html = processLists(html, getAttr, inline_styles, bidirectional);

        // ── Step 4: Inline formatting ──
        // Apply bold, italic, strikethrough, images, links, and autolinks
        // to all text content.  This runs on the output of steps 1-3, so
        // it sees text inside headings, blockquotes, table cells, list
        // items, and paragraph text.

        // Images (must come before links — ![alt](src) vs [text](url))
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const sanitizedSrc = sanitizeUrl(src, options.allow_unsafe_urls);
            // Bidirectional attributes are only exercised via quikdown_bd bundle.
            /* istanbul ignore next - bd-only branch */
            const altAttr = bidirectional && alt ? ` data-qd-alt="${escapeHtml(alt)}"` : '';
            /* istanbul ignore next - bd-only branch */
            const srcAttr = bidirectional ? ` data-qd-src="${escapeHtml(src)}"` : '';
            return `<img${getAttr('img')} src="${sanitizedSrc}" alt="${alt}"${altAttr}${srcAttr}${dataQd('!')}>`;
        });

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
            const sanitizedHref = sanitizeUrl(href, options.allow_unsafe_urls);
            const isExternal = /^https?:\/\//i.test(sanitizedHref);
            const rel = isExternal ? ' rel="noopener noreferrer"' : '';
            /* istanbul ignore next - bd-only branch */
            const textAttr = bidirectional ? ` data-qd-text="${escapeHtml(text)}"` : '';
            return `<a${getAttr('a')} href="${sanitizedHref}"${rel}${textAttr}${dataQd('[')}>${text}</a>`;
        });

        // Autolinks — bare https?:// URLs become clickable <a> tags
        html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
            const sanitizedUrl = sanitizeUrl(url, options.allow_unsafe_urls);
            return `${prefix}<a${getAttr('a')} href="${sanitizedUrl}" rel="noopener noreferrer">${url}</a>`;
        });

        // Bold, italic, strikethrough
        // Order matters: ** before * (so ** isn't consumed as two *s)
        const inlinePatterns = [
            [/\*\*(.+?)\*\*/g, 'strong', '**'],
            [/__(.+?)__/g, 'strong', '__'],
            [/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, 'em', '*'],
            [/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, 'em', '_'],
            [/~~(.+?)~~/g, 'del', '~~']
        ];
        inlinePatterns.forEach(([pattern, tag, marker]) => {
            html = html.replace(pattern, `<${tag}${getAttr(tag)}${dataQd(marker)}>$1</${tag}>`);
        });

        // ── Step 5: Line breaks + paragraph wrapping ──
        if (lazy_linefeeds) {
            // Lazy linefeeds mode: every single \n becomes <br> EXCEPT:
            //   • Double newlines → paragraph break
            //   • Newlines adjacent to block elements (h, blockquote, pre, hr, table, list)
            //
            // Strategy: protect block-adjacent newlines with §N§, convert
            // the rest, then restore.

            const blocks = [];
            let bi = 0;

            // Protect tables and lists from <br> injection
            html = html.replace(/<(table|[uo]l)[^>]*>[\s\S]*?<\/\1>/g, m => {
                blocks[bi] = m;
                return `§B${bi++}§`;
            });

            html = html.replace(/\n\n+/g, '§P§')
                // After block-level closing tags
                .replace(/(<\/(?:h[1-6]|blockquote|pre)>)\n/g, '$1§N§')
                .replace(/(<(?:h[1-6]|blockquote|pre|hr)[^>]*>)\n/g, '$1§N§')
                // Before block-level opening tags
                .replace(/\n(<(?:h[1-6]|blockquote|pre|hr)[^>]*>)/g, '§N§$1')
                .replace(/\n(§B\d+§)/g, '§N§$1')
                .replace(/(§B\d+§)\n/g, '$1§N§')
                // Convert surviving newlines to <br>
                .replace(/\n/g, `<br${getAttr('br')}>`)
                // Restore
                .replace(/§N§/g, '\n')
                .replace(/§P§/g, '</p><p>');

            // Restore protected blocks
            blocks.forEach((b, i) => html = html.replace(`§B${i}§`, b));

            html = '<p>' + html + '</p>';
        } else {
            // Standard mode: two trailing spaces → <br>, double newline → new paragraph
            html = html.replace(/ {2}$/gm, `<br${getAttr('br')}>`);

            html = html.replace(/\n\n+/g, (match, offset) => {
                const before = html.substring(0, offset);
                if (before.match(/<\/(h[1-6]|blockquote|ul|ol|table|pre|hr)>$/)) {
                    return '<p>';
                }
                return '</p><p>';
            });
            html = '<p>' + html + '</p>';
        }

        // ── Step 6: Cleanup ──
        // Remove <p> wrappers that accidentally enclose block elements.
        // This is simpler than trying to prevent them during wrapping.
        const cleanupPatterns = [
            [/<p><\/p>/g, ''],
            [/<p>(<h[1-6][^>]*>)/g, '$1'],
            [/(<\/h[1-6]>)<\/p>/g, '$1'],
            [/<p>(<blockquote[^>]*>)/g, '$1'],
            [/(<\/blockquote>)<\/p>/g, '$1'],
            [/<p>(<ul[^>]*>|<ol[^>]*>)/g, '$1'],
            [/(<\/ul>|<\/ol>)<\/p>/g, '$1'],
            [/<p>(<hr[^>]*>)<\/p>/g, '$1'],
            [/<p>(<table[^>]*>)/g, '$1'],
            [/(<\/table>)<\/p>/g, '$1'],
            [/<p>(<pre[^>]*>)/g, '$1'],
            [/(<\/pre>)<\/p>/g, '$1'],
            [new RegExp(`<p>(${PLACEHOLDER_CB}\\d+§)</p>`, 'g'), '$1']
        ];
        cleanupPatterns.forEach(([pattern, replacement]) => {
            html = html.replace(pattern, replacement);
        });

        // When a block element is followed by a newline and then text, open a <p>.
        html = html.replace(/(<\/(?:h[1-6]|blockquote|ul|ol|table|pre|hr)>)\n([^<])/g, '$1\n<p>$2');

        // ────────────────────────────────────────────────────────────────
        //  Phase 4 — Code Restoration
        // ────────────────────────────────────────────────────────────────
        // Replace placeholders with rendered HTML.  For fenced blocks this
        // means wrapping in <pre><code>…</code></pre> (or calling the
        // fence_plugin).  For inline code it means <code>…</code>.

        codeBlocks.forEach((block, i) => {
            let replacement;

            if (block.custom && fence_plugin && fence_plugin.render) {
                // Delegate to the user-provided fence plugin.
                replacement = fence_plugin.render(block.code, block.lang);

                if (replacement === undefined) {
                    // Plugin declined — fall back to default rendering.
                    const langClass = !inline_styles && block.lang ? ` class="language-${block.lang}"` : '';
                    const codeAttr = inline_styles ? getAttr('code') : langClass;
                    /* istanbul ignore next - bd-only branch */
                    const langAttr = bidirectional && block.lang ? ` data-qd-lang="${escapeHtml(block.lang)}"` : '';
                    /* istanbul ignore next - bd-only branch */
                    const fenceAttr = bidirectional ? ` data-qd-fence="${escapeHtml(block.fence)}"` : '';
                    replacement = `<pre${getAttr('pre')}${fenceAttr}${langAttr}><code${codeAttr}>${escapeHtml(block.code)}</code></pre>`;
                } else /* istanbul ignore next - bd-only branch */ if (bidirectional) {
                    // Plugin returned HTML — inject data attributes for roundtrip.
                    replacement = replacement.replace(/^<(\w+)/,
                        `<$1 data-qd-fence="${escapeHtml(block.fence)}" data-qd-lang="${escapeHtml(block.lang)}" data-qd-source="${escapeHtml(block.code)}"`);
                }
            } else {
                // Default rendering — wrap in <pre><code>.
                const langClass = !inline_styles && block.lang ? ` class="language-${block.lang}"` : '';
                const codeAttr = inline_styles ? getAttr('code') : langClass;
                /* istanbul ignore next - bd-only branch */
                const langAttr = bidirectional && block.lang ? ` data-qd-lang="${escapeHtml(block.lang)}"` : '';
                /* istanbul ignore next - bd-only branch */
                const fenceAttr = bidirectional ? ` data-qd-fence="${escapeHtml(block.fence)}"` : '';
                replacement = `<pre${getAttr('pre')}${fenceAttr}${langAttr}><code${codeAttr}>${block.code}</code></pre>`;
            }

            const placeholder = `${PLACEHOLDER_CB}${i}§`;
            html = html.replace(placeholder, replacement);
        });

        // Restore inline code spans
        inlineCodes.forEach((code, i) => {
            const placeholder = `${PLACEHOLDER_IC}${i}§`;
            html = html.replace(placeholder, `<code${getAttr('code')}${dataQd('`')}>${code}</code>`);
        });

        return html.trim();
    }

    // ════════════════════════════════════════════════════════════════════
    //  Block-level line scanner
    // ════════════════════════════════════════════════════════════════════

    /**
     * scanLineBlocks — single-pass line scanner for headings, HR, blockquotes
     *
     * Walks the text line by line.  For each line it checks (in order):
     *   1. Heading   — starts with 1-6 '#' followed by a space
     *   2. HR        — line is entirely '---…' (3+ dashes, optional trailing space)
     *   3. Blockquote — starts with '&gt; ' (the > was already HTML-escaped)
     *
     * Lines that don't match any block pattern are passed through unchanged.
     *
     * This replaces three separate global regex passes from the pre-1.2.8
     * architecture with one structured scan.
     *
     * @param {string}   text    The document text (HTML-escaped, code extracted)
     * @param {Function} getAttr Attribute factory (class or style)
     * @param {Function} dataQd  Bidirectional marker factory
     * @returns {string}         Text with block-level elements rendered
     */
    function scanLineBlocks(text, getAttr, dataQd) {
        const lines = text.split('\n');
        const result = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // ── Heading ──
            // Count leading '#' characters.  Valid heading: 1-6 hashes then a space.
            // Example: "## Hello World ##" → <h2>Hello World</h2>
            let hashCount = 0;
            while (hashCount < line.length && hashCount < 7 && line[hashCount] === '#') {
                hashCount++;
            }
            if (hashCount >= 1 && hashCount <= 6 && line[hashCount] === ' ') {
                // Extract content after "# " and strip trailing hashes
                const content = line.slice(hashCount + 1).replace(/\s*#+\s*$/, '');
                const tag = 'h' + hashCount;
                result.push(`<${tag}${getAttr(tag)}${dataQd('#'.repeat(hashCount))}>${content}</${tag}>`);
                i++;
                continue;
            }

            // ── Horizontal Rule ──
            // Three or more dashes, optional trailing whitespace, nothing else.
            if (isDashHRLine(line)) {
                result.push(`<hr${getAttr('hr')}>`);
                i++;
                continue;
            }

            // ── Blockquote ──
            // After Phase 2, the '>' character has been escaped to '&gt;'.
            // Pattern: "&gt; content" or merged consecutive blockquotes.
            if (/^&gt;\s+/.test(line)) {
                result.push(`<blockquote${getAttr('blockquote')}>${line.replace(/^&gt;\s+/, '')}</blockquote>`);
                i++;
                continue;
            }

            // ── Pass-through ──
            result.push(line);
            i++;
        }

        // Merge consecutive blockquotes into a single element.
        // <blockquote>A</blockquote>\n<blockquote>B</blockquote>
        //   → <blockquote>A\nB</blockquote>
        let joined = result.join('\n');
        joined = joined.replace(/<\/blockquote>\n<blockquote>/g, '\n');
        return joined;
    }

    // ════════════════════════════════════════════════════════════════════
    //  Table processing (line walker)
    // ════════════════════════════════════════════════════════════════════

    /**
     * Inline markdown formatter for table cells.
     * Handles bold, italic, strikethrough, and code within cell text.
     * Links / images / autolinks are handled by the global inline pass
     * (Phase 3 Step 4) which runs after table processing.
     */
    function processInlineMarkdown(text, getAttr) {
        const patterns = [
            [/\*\*(.+?)\*\*/g, 'strong'],
            [/__(.+?)__/g, 'strong'],
            [/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, 'em'],
            [/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, 'em'],
            [/~~(.+?)~~/g, 'del'],
            [/`([^`]+)`/g, 'code']
        ];
        patterns.forEach(([pattern, tag]) => {
            text = text.replace(pattern, `<${tag}${getAttr(tag)}>$1</${tag}>`);
        });
        return text;
    }

    /**
     * processTable — line walker for markdown tables
     *
     * Walks through lines looking for runs of pipe-containing lines.
     * Each run is validated (must contain a separator row: |---|---|)
     * and rendered as an HTML <table>.  Invalid runs are restored as-is.
     *
     * @param {string}   text    Full document text
     * @param {Function} getAttr Attribute factory
     * @returns {string}         Text with tables rendered
     */
    function processTable(text, getAttr) {
        const lines = text.split('\n');
        const result = [];
        let inTable = false;
        let tableLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.includes('|') && (line.startsWith('|') || /[^\\|]/.test(line))) {
                if (!inTable) {
                    inTable = true;
                    tableLines = [];
                }
                tableLines.push(line);
            } else {
                if (inTable) {
                    const tableHtml = buildTable(tableLines, getAttr);
                    if (tableHtml) {
                        result.push(tableHtml);
                    } else {
                        result.push(...tableLines);
                    }
                    inTable = false;
                    tableLines = [];
                }
                result.push(lines[i]);
            }
        }

        // Handle table at end of document
        if (inTable && tableLines.length > 0) {
            const tableHtml = buildTable(tableLines, getAttr);
            if (tableHtml) {
                result.push(tableHtml);
            } else {
                result.push(...tableLines);
            }
        }

        return result.join('\n');
    }

    /**
     * buildTable — validate and render a table from accumulated lines
     *
     * @param {string[]} lines   Array of pipe-containing lines
     * @param {Function} getAttr Attribute factory
     * @returns {string|null}    HTML table string, or null if invalid
     */
    function buildTable(lines, getAttr) {
        if (lines.length < 2) return null;

        // Find the separator row (---|---|)
        let separatorIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (/^\|?[\s\-:|]+\|?$/.test(lines[i]) && lines[i].includes('-')) {
                separatorIndex = i;
                break;
            }
        }
        if (separatorIndex === -1) return null;

        const headerLines = lines.slice(0, separatorIndex);
        const bodyLines = lines.slice(separatorIndex + 1);

        // Parse alignment from separator cells (:--- = left, :---: = center, ---: = right)
        const separator = lines[separatorIndex];
        const separatorCells = separator.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
        const alignments = separatorCells.map(cell => {
            const trimmed = cell.trim();
            if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
            if (trimmed.endsWith(':')) return 'right';
            return 'left';
        });

        let html = `<table${getAttr('table')}>\n`;

        // Header
        html += `<thead${getAttr('thead')}>\n`;
        headerLines.forEach(line => {
            html += `<tr${getAttr('tr')}>\n`;
            const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
            cells.forEach((cell, i) => {
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                const processedCell = processInlineMarkdown(cell.trim(), getAttr);
                html += `<th${getAttr('th', alignStyle)}>${processedCell}</th>\n`;
            });
            html += '</tr>\n';
        });
        html += '</thead>\n';

        // Body
        if (bodyLines.length > 0) {
            html += `<tbody${getAttr('tbody')}>\n`;
            bodyLines.forEach(line => {
                html += `<tr${getAttr('tr')}>\n`;
                const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
                cells.forEach((cell, i) => {
                    const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                    const processedCell = processInlineMarkdown(cell.trim(), getAttr);
                    html += `<td${getAttr('td', alignStyle)}>${processedCell}</td>\n`;
                });
                html += '</tr>\n';
            });
            html += '</tbody>\n';
        }

        html += '</table>';
        return html;
    }

    // ════════════════════════════════════════════════════════════════════
    //  List processing (line walker)
    // ════════════════════════════════════════════════════════════════════

    /**
     * processLists — line walker for ordered, unordered, and task lists
     *
     * Scans each line for list markers (-, *, +, 1., 2., etc.) with
     * optional leading indentation for nesting.  Non-list lines close
     * any open lists and pass through unchanged.
     *
     * Task lists (- [ ] / - [x]) are detected and rendered with
     * checkbox inputs.
     *
     * @param {string}   text         Full document text
     * @param {Function} getAttr      Attribute factory
     * @param {boolean}  inline_styles Whether to use inline styles
     * @param {boolean}  bidirectional Whether to add data-qd markers
     * @returns {string}              Text with lists rendered
     */
    function processLists(text, getAttr, inline_styles, bidirectional) {
        const lines = text.split('\n');
        const result = [];
        const listStack = [];   // tracks nesting: [{type:'ul', level:0}, …]

        // Helper to escape HTML for data-qd attributes. List markers (`-`, `*`,
        // `+`, `1.`, etc.) never contain HTML-special chars, so the replace
        // callback is defensive-only and never actually fires in practice.
        /* istanbul ignore next - defensive: list markers never trigger escaping */
        const escapeHtml = (text) => text.replace(/[&<>"']/g,
            /* istanbul ignore next - defensive: list markers never contain HTML specials */
            m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
        /* istanbul ignore next - trivial no-op fallback; not exercised via bd bundle */
        const dataQd = bidirectional ? (marker) => ` data-qd="${escapeHtml(marker)}"` : () => '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);

            if (match) {
                const [, indent, marker, content] = match;
                const level = Math.floor(indent.length / 2);
                const isOrdered = /^\d+\./.test(marker);
                const listType = isOrdered ? 'ol' : 'ul';

                // Task list detection (only in unordered lists)
                let listItemContent = content;
                let taskListClass = '';
                const taskMatch = content.match(/^\[([x ])\]\s+(.*)$/i);
                if (taskMatch && !isOrdered) {
                    const [, checked, taskContent] = taskMatch;
                    const isChecked = checked.toLowerCase() === 'x';
                    const checkboxAttr = inline_styles
                        ? ' style="margin-right:.5em"'
                        : ` class="${CLASS_PREFIX}task-checkbox"`;
                    listItemContent = `<input type="checkbox"${checkboxAttr}${isChecked ? ' checked' : ''} disabled> ${taskContent}`;
                    taskListClass = inline_styles ? ' style="list-style:none"' : ` class="${CLASS_PREFIX}task-item"`;
                }

                // Close deeper nesting levels
                while (listStack.length > level + 1) {
                    const list = listStack.pop();
                    result.push(`</${list.type}>`);
                }

                // Open new list or switch type at current level
                if (listStack.length === level) {
                    listStack.push({ type: listType, level });
                    result.push(`<${listType}${getAttr(listType)}>`);
                } else if (listStack.length === level + 1) {
                    const currentList = listStack[listStack.length - 1];
                    if (currentList.type !== listType) {
                        result.push(`</${currentList.type}>`);
                        listStack.pop();
                        listStack.push({ type: listType, level });
                        result.push(`<${listType}${getAttr(listType)}>`);
                    }
                }

                const liAttr = taskListClass || getAttr('li');
                result.push(`<li${liAttr}${dataQd(marker)}>${listItemContent}</li>`);
            } else {
                // Not a list item — close all open lists
                while (listStack.length > 0) {
                    const list = listStack.pop();
                    result.push(`</${list.type}>`);
                }
                result.push(line);
            }
        }

        // Close any remaining open lists
        while (listStack.length > 0) {
            const list = listStack.pop();
            result.push(`</${list.type}>`);
        }

        return result.join('\n');
    }

    // ════════════════════════════════════════════════════════════════════
    //  Static API
    // ════════════════════════════════════════════════════════════════════

    /**
     * Emit CSS rules for all quikdown elements.
     *
     * @param {string} prefix  Class prefix (default: 'quikdown-')
     * @param {string} theme   'light' (default) or 'dark'
     * @returns {string}       CSS text
     */
    quikdown.emitStyles = function(prefix = 'quikdown-', theme = 'light') {
        const styles = QUIKDOWN_STYLES;

        const themeOverrides = {
            dark: {
                '#f4f4f4': '#2a2a2a',   // pre background
                '#f0f0f0': '#2a2a2a',   // code background
                '#f2f2f2': '#2a2a2a',   // th background
                '#ddd': '#3a3a3a',      // borders
                '#06c': '#6db3f2',      // links
                _textColor: '#e0e0e0'
            },
            light: {
                _textColor: '#333'
            }
        };

        let css = '';
        for (const [tag, style] of Object.entries(styles)) {
            let themedStyle = style;

            if (theme === 'dark' && themeOverrides.dark) {
                for (const [oldColor, newColor] of Object.entries(themeOverrides.dark)) {
                    if (!oldColor.startsWith('_')) {
                        themedStyle = themedStyle.replaceAll(oldColor, newColor);
                    }
                }
                const needsTextColor = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'li', 'blockquote'];
                if (needsTextColor.includes(tag)) {
                    themedStyle += `;color:${themeOverrides.dark._textColor}`;
                }
            } else if (theme === 'light' && themeOverrides.light) {
                const needsTextColor = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'li', 'blockquote'];
                if (needsTextColor.includes(tag)) {
                    themedStyle += `;color:${themeOverrides.light._textColor}`;
                }
            }

            css += `.${prefix}${tag} { ${themedStyle} }\n`;
        }

        return css;
    };

    /**
     * Create a pre-configured parser with baked-in options.
     *
     * @param {Object} options  Options to bake in
     * @returns {Function}      Configured quikdown(markdown) function
     */
    quikdown.configure = function(options) {
        return function(markdown) {
            return quikdown(markdown, options);
        };
    };

    /** Semantic version (injected at build time) */
    quikdown.version = quikdownVersion;

    // ════════════════════════════════════════════════════════════════════
    //  Exports
    // ════════════════════════════════════════════════════════════════════

    /* istanbul ignore next */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = quikdown;
    }

    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
        window.quikdown = quikdown;
    }

    /**
     * quikdown_bd - Bidirectional markdown/HTML converter
     * Extends core quikdown with HTML→Markdown conversion
     * 
     * Uses data-qd attributes to preserve original markdown syntax
     * Enables HTML→Markdown conversion for quikdown-generated HTML
     */


    /**
     * Create bidirectional version by extending quikdown
     * This wraps quikdown and adds the toMarkdown method
     */
    function quikdown_bd(markdown, options = {}) {
        // Use core quikdown with bidirectional flag to add data-qd attributes
        return quikdown(markdown, { ...options, bidirectional: true });
    }

    // Copy all properties and methods from quikdown (including version).
    // Skip `configure` — quikdown_bd provides its own override below, so the
    // inner quikdown.configure is dead code in this bundle.
    Object.keys(quikdown).forEach(key => {
        if (key === 'configure') return;
        quikdown_bd[key] = quikdown[key];
    });

    // Add the toMarkdown method for HTML→Markdown conversion
    quikdown_bd.toMarkdown = function(htmlOrElement, options = {}) {
        // Accept either HTML string or DOM element
        let container;
        if (typeof htmlOrElement === 'string') {
            container = document.createElement('div');
            container.innerHTML = htmlOrElement;
        } else if (htmlOrElement instanceof Element) {
            /* istanbul ignore next - browser-only code path, not testable in jsdom */
            container = htmlOrElement;
        } else {
            return '';
        }
        
        // Walk the DOM tree and reconstruct markdown
        function walkNode(node, parentContext = {}) {
            if (node.nodeType === Node.TEXT_NODE) {
                // Return text content, preserving whitespace where needed
                return node.textContent;
            }
            
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return '';
            }
            
            const tag = node.tagName.toLowerCase();
            const dataQd = node.getAttribute('data-qd');
            
            // Process children with context
            let childContent = '';
            for (const child of node.childNodes) {
                childContent += walkNode(child, { parentTag: tag, ...parentContext });
            }
            
            // Determine markdown based on element and attributes
            switch (tag) {
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    const level = parseInt(tag[1]);
                    const prefix = dataQd || '#'.repeat(level);
                    return `${prefix} ${childContent.trim()}\n\n`;
                    
                case 'strong':
                case 'b':
                    if (!childContent) return ''; // Don't add markers for empty content
                    const boldMarker = dataQd || '**';
                    return `${boldMarker}${childContent}${boldMarker}`;
                    
                case 'em':
                case 'i':
                    if (!childContent) return ''; // Don't add markers for empty content
                    const emMarker = dataQd || '*';
                    return `${emMarker}${childContent}${emMarker}`;
                    
                case 'del':
                case 's':
                case 'strike':
                    if (!childContent) return ''; // Don't add markers for empty content
                    const delMarker = dataQd || '~~';
                    return `${delMarker}${childContent}${delMarker}`;
                    
                case 'code':
                    // Note: code inside pre is handled directly by the pre case using querySelector
                    if (!childContent) return ''; // Don't add markers for empty content
                    const codeMarker = dataQd || '`';
                    return `${codeMarker}${childContent}${codeMarker}`;
                    
                case 'pre':
                    const fence = node.getAttribute('data-qd-fence') || dataQd || '```';
                    const lang = node.getAttribute('data-qd-lang') || '';
                    
                    // Check if this was created by a fence plugin with reverse handler
                    if (options.fence_plugin && options.fence_plugin.reverse && lang) {
                        try {
                            const result = options.fence_plugin.reverse(node);
                            if (result && result.content) {
                                const fenceMarker = result.fence || fence;
                                const langStr = result.lang || lang;
                                return `${fenceMarker}${langStr}\n${result.content}\n${fenceMarker}\n\n`;
                            }
                        } catch (err) {
                            console.warn('Fence reverse handler error:', err);
                            // Fall through to default handling
                        }
                    }
                    
                    // Fallback: use data-qd-source if available
                    const source = node.getAttribute('data-qd-source');
                    if (source) {
                        return `${fence}${lang}\n${source}\n${fence}\n\n`;
                    }
                    
                    // Final fallback: extract text content
                    const codeEl = node.querySelector('code');
                    const codeContent = codeEl ? codeEl.textContent : childContent;
                    return `${fence}${lang}\n${codeContent.trimEnd()}\n${fence}\n\n`;
                    
                case 'blockquote':
                    const quoteMarker = dataQd || '>';
                    const lines = childContent.trim().split('\n');
                    return lines.map(line => `${quoteMarker} ${line}`).join('\n') + '\n\n';
                    
                case 'hr':
                    const hrMarker = dataQd || '---';
                    return `${hrMarker}\n\n`;
                    
                case 'br':
                    const brMarker = dataQd || '  ';
                    return `${brMarker}\n`;
                    
                case 'a':
                    const linkText = node.getAttribute('data-qd-text') || childContent.trim();
                    const href = node.getAttribute('href') || '';
                    // Check for autolinks
                    if (linkText === href && !dataQd) {
                        return `<${href}>`;
                    }
                    return `[${linkText}](${href})`;
                    
                case 'img':
                    const alt = node.getAttribute('data-qd-alt') || node.getAttribute('alt') || '';
                    const src = node.getAttribute('data-qd-src') || node.getAttribute('src') || '';
                    const imgMarker = dataQd || '!';
                    return `${imgMarker}[${alt}](${src})`;
                    
                case 'ul':
                case 'ol':
                    return walkList(node, tag === 'ol') + '\n';
                    
                case 'li':
                    // Handled by list processor
                    return childContent;
                    
                case 'table':
                    return walkTable(node) + '\n\n';
                    
                case 'p':
                    // Check if it's actually a paragraph or just a wrapper
                    if (childContent.trim()) {
                        // Check if paragraph ends with a line that's just whitespace
                        // This indicates an intentional blank line before the next element
                        const lines = childContent.split('\n');
                        let content = childContent.trim();
                        
                        // If the last line(s) are just whitespace, preserve one blank line
                        if (lines.length > 1) {
                            let trailingBlankLines = 0;
                            for (let i = lines.length - 1; i >= 0; i--) {
                                if (lines[i].trim() === '') {
                                    trailingBlankLines++;
                                } else {
                                    break;
                                }
                            }
                            if (trailingBlankLines > 0) {
                                // Add a line with just a space, followed by single newline
                                // The \n\n will be added below for paragraph separation
                                content = content + '\n ';
                                // Only add one newline since we're preserving the space line
                                return content + '\n';
                            }
                        }
                        
                        return content + '\n\n';
                    }
                    return '';
                    
                case 'div':
                    // Check if this was created by a fence plugin with reverse handler
                    const divLang = node.getAttribute('data-qd-lang');
                    const divFence = node.getAttribute('data-qd-fence');
                    
                    if (divLang && options.fence_plugin && options.fence_plugin.reverse) {
                        try {
                            const result = options.fence_plugin.reverse(node);
                            if (result && result.content) {
                                const fenceMarker = result.fence || divFence || '```';
                                const langStr = result.lang || divLang;
                                return `${fenceMarker}${langStr}\n${result.content}\n${fenceMarker}\n\n`;
                            }
                        } catch (err) {
                            console.warn('Fence reverse handler error:', err);
                            // Fall through to default handling
                        }
                    }
                    
                    // Fallback: use data-qd-source if available
                    const divSource = node.getAttribute('data-qd-source');
                    if (divSource && divFence) {
                        return `${divFence}${divLang || ''}\n${divSource}\n${divFence}\n\n`;
                    }
                    
                    // Check if it's a mermaid container
                    if (node.classList && node.classList.contains('mermaid-container')) {
                        const fence = node.getAttribute('data-qd-fence') || '```';
                        const lang = node.getAttribute('data-qd-lang') || 'mermaid';
                        
                        // First check for data-qd-source attribute on the container
                        const source = node.getAttribute('data-qd-source');
                        if (source) {
                            // Decode HTML entities from the attribute (mainly &quot;)
                            const temp = document.createElement('textarea');
                            temp.innerHTML = source;
                            const code = temp.value;
                            return `${fence}${lang}\n${code}\n${fence}\n\n`;
                        }
                        
                        // Check for source on the pre.mermaid element
                        const mermaidPre = node.querySelector('pre.mermaid');
                        if (mermaidPre) {
                            const preSource = mermaidPre.getAttribute('data-qd-source');
                            if (preSource) {
                                const temp = document.createElement('textarea');
                                temp.innerHTML = preSource;
                                const code = temp.value;
                                return `${fence}${lang}\n${code}\n${fence}\n\n`;
                            }
                        }
                        
                        // Fallback: Look for the legacy .mermaid-source element
                        const sourceElement = node.querySelector('.mermaid-source');
                        if (sourceElement) {
                            // Decode HTML entities
                            const temp = document.createElement('div');
                            temp.innerHTML = sourceElement.innerHTML;
                            const code = temp.textContent;
                            return `${fence}${lang}\n${code}\n${fence}\n\n`;
                        }
                        
                        // Final fallback: try to extract from the mermaid element (unreliable after rendering)
                        const mermaidElement = node.querySelector('.mermaid');
                        if (mermaidElement && mermaidElement.textContent.includes('graph')) {
                            return `${fence}${lang}\n${mermaidElement.textContent.trim()}\n${fence}\n\n`;
                        }
                    }
                    // Check if it's a standalone mermaid diagram (legacy)
                    if (node.classList && node.classList.contains('mermaid')) {
                        const fence = node.getAttribute('data-qd-fence') || '```';
                        const lang = node.getAttribute('data-qd-lang') || 'mermaid';
                        const code = node.textContent.trim();
                        return `${fence}${lang}\n${code}\n${fence}\n\n`;
                    }
                    // Pass through other divs
                    return childContent;
                
                case 'span':
                    // Pass through container elements
                    return childContent;
                    
                default:
                    return childContent;
            }
        }
        
        // Walk list elements
        function walkList(listNode, isOrdered, depth = 0) {
            let result = '';
            let index = 1;
            const indent = '  '.repeat(depth);
            
            for (const child of listNode.children) {
                if (child.tagName !== 'LI') continue;
                
                const dataQd = child.getAttribute('data-qd');
                let marker = dataQd || (isOrdered ? `${index}.` : '-');
                
                // Check for task list checkbox
                const checkbox = child.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    const checked = checkbox.checked ? 'x' : ' ';
                    marker = '-';
                    // Get text without the checkbox
                    let text = '';
                    for (const node of child.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            text += node.textContent;
                        } else if (node.tagName && node.tagName !== 'INPUT') {
                            text += walkNode(node);
                        }
                    }
                    result += `${indent}${marker} [${checked}] ${text.trim()}\n`;
                } else {
                    let itemContent = '';
                    
                    for (const node of child.childNodes) {
                        if (node.tagName === 'UL' || node.tagName === 'OL') {
                            itemContent += walkList(node, node.tagName === 'OL', depth + 1);
                        } else {
                            itemContent += walkNode(node);
                        }
                    }
                    
                    result += `${indent}${marker} ${itemContent.trim()}\n`;
                }
                
                index++;
            }
            
            return result;
        }
        
        // Walk table elements
        function walkTable(table) {
            let result = '';
            const alignData = table.getAttribute('data-qd-align');
            const alignments = alignData ? alignData.split(',') : [];
            
            // Process header
            const thead = table.querySelector('thead');
            if (thead) {
                const headerRow = thead.querySelector('tr');
                if (headerRow) {
                    const headers = [];
                    for (const th of headerRow.querySelectorAll('th')) {
                        headers.push(th.textContent.trim());
                    }
                    result += '| ' + headers.join(' | ') + ' |\n';
                    
                    // Add separator with alignment
                    const separators = headers.map((_, i) => {
                        const align = alignments[i] || 'left';
                        if (align === 'center') return ':---:';
                        if (align === 'right') return '---:';
                        return '---';
                    });
                    result += '| ' + separators.join(' | ') + ' |\n';
                }
            }
            
            // Process body
            const tbody = table.querySelector('tbody');
            if (tbody) {
                for (const row of tbody.querySelectorAll('tr')) {
                    const cells = [];
                    for (const td of row.querySelectorAll('td')) {
                        cells.push(td.textContent.trim());
                    }
                    if (cells.length > 0) {
                        result += '| ' + cells.join(' | ') + ' |\n';
                    }
                }
            }
            
            return result.trim();
        }
        
        // Process the DOM tree
        let markdown = walkNode(container);
        
        // Clean up
        markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines
        markdown = markdown.trim();
        
        return markdown;
    };

    // Override the configure method to return a bidirectional version.
    // We delegate to the inner quikdown.configure so the shared closure
    // machinery is exercised in both bundles (no dead code).
    quikdown_bd.configure = function(options) {
        const innerParser = quikdown.configure({ ...options, bidirectional: true });
        return function(markdown) {
            return innerParser(markdown);
        };
    };

    // Set version
    // Version is already copied from quikdown via Object.keys loop

    // Export for both module and browser
    /* istanbul ignore next */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = quikdown_bd;
    }

    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
        window.quikdown_bd = quikdown_bd;
    }

    /**
     * Rich copy functionality for QuikdownEditor
     * Handles copying rendered content with proper formatting for pasting into rich text editors
     */

    /**
     * Get platform information
     * @returns {string} The detected platform: 'macos', 'windows', 'linux', or 'unknown'
     */
    function getPlatform() {
        const platform = navigator.platform?.toLowerCase() || '';
        const userAgent = navigator.userAgent?.toLowerCase() || '';
        
        if (platform.includes('mac') || userAgent.includes('mac')) {
            return 'macos';
        } else if (userAgent.includes('windows')) {
            return 'windows';
        } else if (userAgent.includes('linux')) {
            return 'linux';
        }
        return 'unknown';
    }

    /**
     * Copy to clipboard using HTML selection fallback (for Safari)
     * Uses div with selection to preserve HTML formatting
     * @param {string} html - HTML content to copy
     * @returns {boolean} Success status
     */
    function copyToClipboard(html) {
        let tempDiv;
        let result;
        
        try {
            // Use a div instead of textarea to preserve HTML formatting
            tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '0';
            tempDiv.style.width = '1px';
            tempDiv.style.height = '1px';
            tempDiv.style.overflow = 'hidden';
            tempDiv.innerHTML = html;
            
            document.body.appendChild(tempDiv);
            
            // Select the HTML content
            const range = document.createRange();
            range.selectNodeContents(tempDiv);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Try to copy
            result = document.execCommand('copy');
            
            // Clear selection
            selection.removeAllRanges();
        } catch (err) {
            console.error('Fallback copy failed:', err);
            result = false;
        } finally {
            if (tempDiv && tempDiv.parentNode) {
                document.body.removeChild(tempDiv);
            }
        }
        
        return result;
    }

    /**
     * Convert SVG to PNG blob (based on squibview's implementation)
     * @param {SVGElement} svgElement - The SVG element to convert
     * @returns {Promise<Blob>} A promise that resolves with the PNG blob
     */
    async function svgToPng(svgElement, needsWhiteBackground = false) {
        return new Promise((resolve, reject) => {
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            const scale = 2;
            
            // Check if this is a Mermaid-generated SVG (they don't have explicit width/height attributes)
            const isMermaidSvg = svgElement.closest('.mermaid') || svgElement.classList.contains('mermaid');
            const hasExplicitDimensions = svgElement.getAttribute('width') && svgElement.getAttribute('height');
            
            let svgWidth, svgHeight;
            
            if (isMermaidSvg || !hasExplicitDimensions) {
                // For Mermaid or other generated SVGs, prioritize computed dimensions
                svgWidth = svgElement.clientWidth || 
                           (svgElement.viewBox && svgElement.viewBox.baseVal.width) || 
                           parseFloat(svgElement.getAttribute('width')) || 400;
                svgHeight = svgElement.clientHeight || 
                            (svgElement.viewBox && svgElement.viewBox.baseVal.height) || 
                            parseFloat(svgElement.getAttribute('height')) || 300;
            } else {
                // For explicit SVGs (like fenced SVG blocks), prioritize explicit attributes
                svgWidth = parseFloat(svgElement.getAttribute('width')) || 
                           (svgElement.viewBox && svgElement.viewBox.baseVal.width) || 
                           svgElement.clientWidth || 400;
                svgHeight = parseFloat(svgElement.getAttribute('height')) || 
                            (svgElement.viewBox && svgElement.viewBox.baseVal.height) || 
                            svgElement.clientHeight || 300;
            }
            
            // Ensure the SVG string has explicit dimensions by modifying it if necessary
            let modifiedSvgString = svgString;
            if (svgWidth && svgHeight) {
                // Create a temporary SVG element to modify the serialized string
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = svgString;
                const tempSvg = tempDiv.querySelector('svg');
                if (tempSvg) {
                    tempSvg.setAttribute('width', svgWidth.toString());
                    tempSvg.setAttribute('height', svgHeight.toString());
                    modifiedSvgString = new XMLSerializer().serializeToString(tempSvg);
                }
            }
            
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            ctx.scale(scale, scale);
            
            img.onload = () => {
                try {
                    // Add white background for math equations (they often have transparent backgrounds)
                    if (needsWhiteBackground) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    
                    ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                    canvas.toBlob(blob => {
                        resolve(blob);
                    }, 'image/png', 1.0);
                } catch (err) {
                    reject(err);
                }
            };
            
            img.onerror = reject;
            // Use data URI instead of blob URL to avoid tainting the canvas
            const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(modifiedSvgString)}`;
            img.src = svgDataUrl;
        });
    }

    /**
     * Rasterize a GeoJSON Leaflet map to PNG data URL (following Gem's guide)
     * @param {HTMLElement} liveContainer - The live map container element
     * @returns {Promise<string|null>} PNG data URL or null if failed
     */
    async function rasterizeGeoJSONMap(liveContainer) {
        try {
            const map = liveContainer._map;
            if (!map) {
                console.warn('No map found on container');
                return null;
            }
            
            // Get container dimensions
            const mapRect = liveContainer.getBoundingClientRect();
            const width = Math.round(mapRect.width);
            const height = Math.round(mapRect.height);
            
            if (width === 0 || height === 0) {
                console.warn('Map container has zero dimensions');
                return null;
            }
            
            // Create canvas sized to the map container
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            
            // Set canvas size with DPR for sharpness
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            
            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            // 1. Draw tiles from THIS container only
            const tiles = liveContainer.querySelectorAll('.leaflet-tile');
            
            const tilePromises = [];
            for (const tile of tiles) {
                tilePromises.push(new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    
                    img.onload = () => {
                        try {
                            // Calculate tile position relative to container
                            const tileRect = tile.getBoundingClientRect();
                            const offsetX = tileRect.left - mapRect.left;
                            const offsetY = tileRect.top - mapRect.top;
                            
                            // Draw tile at correct position
                            ctx.drawImage(img, offsetX, offsetY, tileRect.width, tileRect.height);
                        } catch (err) {
                            console.warn('Failed to draw tile:', err);
                        }
                        resolve();
                    };
                    
                    img.onerror = () => {
                        console.warn('Failed to load tile:', tile.src);
                        resolve();
                    };
                    
                    img.src = tile.src;
                }));
            }
            
            // Wait for all tiles to load
            await Promise.all(tilePromises);
            
            // 2. Draw vector overlays (SVG paths for GeoJSON features)
            const svgOverlays = liveContainer.querySelectorAll('svg:not(.leaflet-attribution-flag)');
            
            for (const svg of svgOverlays) {
                // Skip attribution/control overlays
                if (svg.closest('.leaflet-control')) continue;
                
                try {
                    const svgRect = svg.getBoundingClientRect();
                    const offsetX = svgRect.left - mapRect.left;
                    const offsetY = svgRect.top - mapRect.top;
                    
                    // Serialize SVG
                    const serializer = new XMLSerializer();
                    const svgStr = serializer.serializeToString(svg);
                    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    // Draw SVG overlay
                    await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => {
                            ctx.drawImage(img, offsetX, offsetY, svgRect.width, svgRect.height);
                            URL.revokeObjectURL(url);
                            resolve();
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(url);
                            reject(new Error('Failed to load SVG overlay'));
                        };
                        img.src = url;
                    });
                } catch (err) {
                    console.warn('Failed to draw SVG overlay:', err);
                }
            }
            
            // 3. Draw marker icons if any
            const markerIcons = liveContainer.querySelectorAll('.leaflet-marker-icon');
            
            for (const marker of markerIcons) {
                try {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    
                    await new Promise((resolve) => {
                        img.onload = () => {
                            const markerRect = marker.getBoundingClientRect();
                            const offsetX = markerRect.left - mapRect.left;
                            const offsetY = markerRect.top - mapRect.top;
                            ctx.drawImage(img, offsetX, offsetY, markerRect.width, markerRect.height);
                            resolve();
                        };
                        img.onerror = resolve;
                        img.src = marker.src;
                    });
                } catch (err) {
                    console.warn('Failed to draw marker icon:', err);
                }
            }
            
            // Return PNG data URL
            return canvas.toDataURL('image/png', 1.0);
            
        } catch (error) {
            console.error('Failed to rasterize GeoJSON map:', error);
            return null;
        }
    }

    /**
     * Get rendered content as rich HTML suitable for clipboard
     * @param {HTMLElement} previewPanel - The preview panel element to copy from
     * @returns {Promise<{success: boolean, html?: string, text?: string}>}
     */
    async function getRenderedContent(previewPanel) {
        if (!previewPanel) {
            throw new Error('No preview panel available');
        }
        
        // Check if MathJax needs to render (only if not already rendered)
        const mathBlocks = previewPanel.querySelectorAll('.math-display');
        if (mathBlocks.length > 0) {
            // Check if already rendered (has mjx-container inside)
            const needsRendering = Array.from(mathBlocks).some(block => !block.querySelector('mjx-container'));
            
            if (needsRendering && window.MathJax && window.MathJax.typesetPromise) {
                try {
                    await window.MathJax.typesetPromise(Array.from(mathBlocks));
                } catch (err) {
                    console.warn('MathJax typesetting failed:', err);
                }
            }
        }
        
        // Clone the preview panel to avoid modifying the actual DOM
        const clone = previewPanel.cloneNode(true);
        
        // Process different fence types for rich copy
        try {
            // Phase 1: Process basic markdown elements with inline styles
            
            // 1.1 Text formatting - add inline styles
            clone.querySelectorAll('strong, b').forEach(el => {
                el.style.fontWeight = 'bold';
            });
            
            clone.querySelectorAll('em, i').forEach(el => {
                el.style.fontStyle = 'italic';
            });
            
            clone.querySelectorAll('del, s, strike').forEach(el => {
                el.style.textDecoration = 'line-through';
            });
            
            clone.querySelectorAll('u').forEach(el => {
                el.style.textDecoration = 'underline';
            });
            
            clone.querySelectorAll('code:not(pre code)').forEach(el => {
                el.style.backgroundColor = '#f4f4f4';
                el.style.padding = '2px 4px';
                el.style.borderRadius = '3px';
                el.style.fontFamily = 'monospace';
                el.style.fontSize = '0.9em';
            });
            
            // 1.2 Block elements - add inline styles
            clone.querySelectorAll('h1').forEach(el => {
                el.style.fontSize = '2em';
                el.style.fontWeight = 'bold';
                el.style.marginTop = '0.67em';
                el.style.marginBottom = '0.67em';
            });
            
            clone.querySelectorAll('h2').forEach(el => {
                el.style.fontSize = '1.5em';
                el.style.fontWeight = 'bold';
                el.style.marginTop = '0.83em';
                el.style.marginBottom = '0.83em';
            });
            
            clone.querySelectorAll('h3').forEach(el => {
                el.style.fontSize = '1.17em';
                el.style.fontWeight = 'bold';
                el.style.marginTop = '1em';
                el.style.marginBottom = '1em';
            });
            
            clone.querySelectorAll('h4').forEach(el => {
                el.style.fontSize = '1em';
                el.style.fontWeight = 'bold';
                el.style.marginTop = '1.33em';
                el.style.marginBottom = '1.33em';
            });
            
            clone.querySelectorAll('h5').forEach(el => {
                el.style.fontSize = '0.83em';
                el.style.fontWeight = 'bold';
                el.style.marginTop = '1.67em';
                el.style.marginBottom = '1.67em';
            });
            
            clone.querySelectorAll('h6').forEach(el => {
                el.style.fontSize = '0.67em';
                el.style.fontWeight = 'bold';
                el.style.marginTop = '2.33em';
                el.style.marginBottom = '2.33em';
            });
            
            clone.querySelectorAll('blockquote').forEach(el => {
                el.style.borderLeft = '4px solid #ddd';
                el.style.marginLeft = '0';
                el.style.paddingLeft = '1em';
                el.style.color = '#666';
            });
            
            clone.querySelectorAll('hr').forEach(el => {
                el.style.border = 'none';
                el.style.borderTop = '1px solid #ccc';
                el.style.margin = '1em 0';
            });
            
            // 1.3 Tables - add inline styles
            clone.querySelectorAll('table').forEach(table => {
                table.style.borderCollapse = 'collapse';
                table.style.width = '100%';
                table.style.marginBottom = '1em';
            });
            
            clone.querySelectorAll('th').forEach(th => {
                th.style.border = '1px solid #ccc';
                th.style.padding = '8px';
                th.style.textAlign = 'left';
                th.style.backgroundColor = '#f0f0f0';
                th.style.fontWeight = 'bold';
            });
            
            clone.querySelectorAll('td').forEach(td => {
                td.style.border = '1px solid #ccc';
                td.style.padding = '8px';
                td.style.textAlign = 'left';
            });
            
            // 1.4 Links - add inline styles
            clone.querySelectorAll('a').forEach(a => {
                a.style.color = '#0066cc';
                a.style.textDecoration = 'underline';
            });
            
            // Process code blocks - wrap in table and add syntax highlighting colors
            clone.querySelectorAll('pre code').forEach(block => {
                const pre = block.parentElement;
                
                // Add inline styles for syntax highlighting (GitHub theme colors)
                if (block.classList.contains('hljs')) {
                    // Apply inline styles to all highlight.js elements
                    block.querySelectorAll('.hljs-keyword').forEach(el => {
                        el.style.color = '#d73a49';
                        el.style.fontWeight = 'bold';
                    });
                    block.querySelectorAll('.hljs-string').forEach(el => {
                        el.style.color = '#032f62';
                    });
                    block.querySelectorAll('.hljs-number').forEach(el => {
                        el.style.color = '#005cc5';
                    });
                    block.querySelectorAll('.hljs-comment').forEach(el => {
                        el.style.color = '#6a737d';
                        el.style.fontStyle = 'italic';
                    });
                    block.querySelectorAll('.hljs-function').forEach(el => {
                        el.style.color = '#6f42c1';
                    });
                    block.querySelectorAll('.hljs-class').forEach(el => {
                        el.style.color = '#6f42c1';
                    });
                    block.querySelectorAll('.hljs-title').forEach(el => {
                        el.style.color = '#6f42c1';
                    });
                    block.querySelectorAll('.hljs-built_in').forEach(el => {
                        el.style.color = '#005cc5';
                    });
                    block.querySelectorAll('.hljs-literal').forEach(el => {
                        el.style.color = '#005cc5';
                    });
                    block.querySelectorAll('.hljs-meta').forEach(el => {
                        el.style.color = '#005cc5';
                    });
                    block.querySelectorAll('.hljs-attr').forEach(el => {
                        el.style.color = '#22863a';
                    });
                    block.querySelectorAll('.hljs-variable').forEach(el => {
                        el.style.color = '#e36209';
                    });
                    block.querySelectorAll('.hljs-regexp').forEach(el => {
                        el.style.color = '#032f62';
                    });
                    block.querySelectorAll('.hljs-selector-class').forEach(el => {
                        el.style.color = '#22863a';
                    });
                    block.querySelectorAll('.hljs-selector-id').forEach(el => {
                        el.style.color = '#6f42c1';
                    });
                    block.querySelectorAll('.hljs-selector-tag').forEach(el => {
                        el.style.color = '#22863a';
                    });
                    block.querySelectorAll('.hljs-tag').forEach(el => {
                        el.style.color = '#22863a';
                    });
                    block.querySelectorAll('.hljs-name').forEach(el => {
                        el.style.color = '#22863a';
                    });
                    block.querySelectorAll('.hljs-attribute').forEach(el => {
                        el.style.color = '#6f42c1';
                    });
                }
                
                const table = document.createElement('table');
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                table.style.border = 'none';
                table.style.marginBottom = '1em';
                
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.style.backgroundColor = '#f7f7f7';
                td.style.padding = '12px';
                td.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
                td.style.fontSize = '14px';
                td.style.lineHeight = '1.4';
                td.style.whiteSpace = 'pre';
                td.style.overflowX = 'auto';
                td.style.border = '1px solid #ddd';
                td.style.borderRadius = '4px';
                
                // Move the formatted code content with inline styles
                td.innerHTML = block.innerHTML;
                
                tr.appendChild(td);
                table.appendChild(tr);
                
                // Replace the pre element with the table
                pre.parentNode.replaceChild(table, pre);
            });
            
            // Process images - convert to data URLs and ensure proper dimensions
            const images = clone.querySelectorAll('img');
            for (const img of images) {
                // Ensure image has dimensions for Google Docs compatibility
                if (!img.width && img.naturalWidth) {
                    img.width = img.naturalWidth;
                }
                if (!img.height && img.naturalHeight) {
                    img.height = img.naturalHeight;
                }
                
                // Set max dimensions to prevent huge images
                const maxWidth = 800;
                const maxHeight = 600;
                if (img.width > maxWidth || img.height > maxHeight) {
                    const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                    img.width = Math.round(img.width * scale);
                    img.height = Math.round(img.height * scale);
                }
                
                // Ensure width and height attributes are set
                if (img.width) {
                    img.setAttribute('width', img.width.toString());
                    img.style.width = img.width + 'px';
                }
                if (img.height) {
                    img.setAttribute('height', img.height.toString());
                    img.style.height = img.height + 'px';
                }
                
                // Add v:shapes for Word compatibility
                if (!img.getAttribute('v:shapes')) {
                    img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                }
                
                // Skip if already a data URL
                if (img.src && !img.src.startsWith('data:')) {
                    try {
                        // Try to convert to data URL
                        const response = await fetch(img.src);
                        const blob = await response.blob();
                        
                        // Check if image is too large (Google Docs has limits)
                        const maxSize = 2 * 1024 * 1024; // 2MB limit for inline images
                        if (blob.size > maxSize) {
                            console.warn('Image too large for inline data URL:', img.src, 'Size:', blob.size);
                            // For large images, we might want to resize or keep the URL
                            continue;
                        }
                        
                        const dataUrl = await new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        img.src = dataUrl;
                    } catch (err) {
                        console.warn('Failed to convert image to data URL:', img.src, err);
                        // Keep original src if conversion fails
                    }
                }
            }
            
            // Phase 2: Process fence block types
            // 1. Process STL 3D models - convert canvas to image or placeholder
            const stlContainers = clone.querySelectorAll('.qde-stl-container');
            for (const container of stlContainers) {
                try {
                    // Find the corresponding original container to get the canvas
                    const containerId = container.dataset.stlId;
                    const originalContainer = previewPanel.querySelector(`.qde-stl-container[data-stl-id="${containerId}"]`);
                    
                    if (originalContainer) {
                        // Look for canvas element in the original container (Three.js WebGL canvas)
                        const canvas = originalContainer.querySelector('canvas');
                        if (canvas && canvas.width > 0 && canvas.height > 0) {
                            try {
                                // Get Three.js references stored on the container (like squibview)
                                const renderer = originalContainer._threeRenderer;
                                const scene = originalContainer._threeScene;
                                const camera = originalContainer._threeCamera;
                                
                                // If we have access to the Three.js objects, force render the scene
                                if (renderer && scene && camera) {
                                    renderer.render(scene, camera);
                                }
                                
                                // Try to capture the canvas as an image
                                const dataUrl = canvas.toDataURL('image/png', 1.0);
                                const img = document.createElement('img');
                                img.src = dataUrl;
                                
                                // Use canvas dimensions for the image
                                const imgWidth = canvas.width / 2; // Divide by scale factor (2x for retina)
                                const imgHeight = canvas.height / 2;
                                
                                // Set both HTML attributes and CSS properties for maximum compatibility
                                img.width = imgWidth;
                                img.height = imgHeight;
                                img.setAttribute('width', imgWidth.toString());
                                img.setAttribute('height', imgHeight.toString());
                                img.style.width = imgWidth + 'px';
                                img.style.height = imgHeight + 'px';
                                img.style.maxWidth = 'none';
                                img.style.maxHeight = 'none';
                                img.style.border = '1px solid #ddd';
                                img.style.borderRadius = '4px';
                                img.style.margin = '0.5em 0';
                                img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                                img.alt = 'STL 3D Model';
                                
                                container.parentNode.replaceChild(img, container);
                                continue;
                            } catch (canvasErr) {
                                console.warn('Failed to convert STL canvas to image (likely WebGL context issue):', canvasErr);
                            }
                        } else {
                            console.warn('No valid canvas found in STL container');
                        }
                    } else {
                        console.warn('Could not find original STL container');
                    }
                } catch (err) {
                    console.error('Error processing STL container for copy:', err);
                }
                
                // Fallback to placeholder if canvas conversion fails
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                placeholder.textContent = '[STL 3D Model - Interactive content not available in copy]';
                container.parentNode.replaceChild(placeholder, container);
            }
            
            // 2. Process Mermaid diagrams - convert SVG to PNG
            const mermaidContainers = clone.querySelectorAll('.mermaid');
            for (const container of mermaidContainers) {
                const svg = container.querySelector('svg');
                if (svg) {
                    try {
                        const pngBlob = await svgToPng(svg);
                        const dataUrl = await new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(pngBlob);
                        });
                        
                        const img = document.createElement('img');
                        img.src = dataUrl;
                        
                        // Use the exact same dimension calculation logic as svgToPng (like squibview)
                        const isMermaidSvg = svg.closest('.mermaid') || svg.classList.contains('mermaid');
                        const hasExplicitDimensions = svg.getAttribute('width') && svg.getAttribute('height');
                        
                        let imgWidth, imgHeight;
                        
                        if (isMermaidSvg || !hasExplicitDimensions) {
                            // For Mermaid or other generated SVGs, prioritize computed dimensions
                            imgWidth = svg.clientWidth || 
                                       (svg.viewBox && svg.viewBox.baseVal.width) || 
                                       parseFloat(svg.getAttribute('width')) || 400;
                            imgHeight = svg.clientHeight || 
                                        (svg.viewBox && svg.viewBox.baseVal.height) || 
                                        parseFloat(svg.getAttribute('height')) || 300;
                        } else {
                            // For explicit SVGs (like fenced SVG blocks), prioritize explicit attributes
                            imgWidth = parseFloat(svg.getAttribute('width')) || 
                                       (svg.viewBox && svg.viewBox.baseVal.width) || 
                                       svg.clientWidth || 400;
                            imgHeight = parseFloat(svg.getAttribute('height')) || 
                                        (svg.viewBox && svg.viewBox.baseVal.height) || 
                                        svg.clientHeight || 300;
                        }
                        
                        // Set both HTML attributes and CSS properties for maximum compatibility (like squibview)
                        img.width = imgWidth;
                        img.height = imgHeight;
                        img.setAttribute('width', imgWidth.toString());
                        img.setAttribute('height', imgHeight.toString());
                        img.style.width = imgWidth + 'px';
                        img.style.height = imgHeight + 'px';
                        img.style.maxWidth = 'none';  // Prevent CSS from constraining the image
                        img.style.maxHeight = 'none';
                        img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                        img.alt = 'Mermaid Diagram';
                        
                        container.parentNode.replaceChild(img, container);
                    } catch (err) {
                        console.warn('Failed to convert Mermaid diagram:', err);
                        // Fallback: leave as SVG
                    }
                }
            }
            
            // 3. Process Chart.js charts - convert canvas to image
            const chartContainers = clone.querySelectorAll('.qde-chart-container');
            for (const container of chartContainers) {
                try {
                    const containerId = container.dataset.chartId;
                    const originalContainer = previewPanel.querySelector(`.qde-chart-container[data-chart-id="${containerId}"]`);
                    
                    if (originalContainer) {
                        const canvas = originalContainer.querySelector('canvas');
                        if (canvas && canvas.width > 0 && canvas.height > 0) {
                            try {
                                const dataUrl = canvas.toDataURL('image/png', 1.0);
                                const img = document.createElement('img');
                                img.src = dataUrl;
                                
                                // Use canvas dimensions for the image
                                const imgWidth = canvas.width;
                                const imgHeight = canvas.height;
                                
                                // Set both HTML attributes and CSS properties for maximum compatibility
                                img.width = imgWidth;
                                img.height = imgHeight;
                                img.setAttribute('width', imgWidth.toString());
                                img.setAttribute('height', imgHeight.toString());
                                img.style.width = imgWidth + 'px';
                                img.style.height = imgHeight + 'px';
                                img.style.maxWidth = 'none';
                                img.style.maxHeight = 'none';
                                img.style.margin = '0.5em 0';
                                img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                                img.alt = 'Chart';
                                
                                container.parentNode.replaceChild(img, container);
                                continue;
                            } catch (canvasErr) {
                                console.warn('Failed to convert chart canvas to image:', canvasErr);
                            }
                        }
                    }
                } catch (err) {
                    console.warn('Error processing chart container:', err);
                }
                
                // Fallback to placeholder
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                placeholder.textContent = '[Chart - Interactive content not available in copy]';
                container.parentNode.replaceChild(placeholder, container);
            }
            
            // 4. Process SVG fenced blocks - convert to PNG
            const svgContainers = clone.querySelectorAll('.qde-svg-container svg');
            for (const svg of svgContainers) {
                try {
                    const pngBlob = await svgToPng(svg);
                    const dataUrl = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(pngBlob);
                    });
                    
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    
                    // Calculate dimensions for the SVG
                    const hasExplicitDimensions = svg.getAttribute('width') && svg.getAttribute('height');
                    
                    let imgWidth, imgHeight;
                    
                    if (hasExplicitDimensions) {
                        // For explicit SVGs (like fenced SVG blocks), prioritize explicit attributes
                        imgWidth = parseFloat(svg.getAttribute('width')) || 
                                   (svg.viewBox && svg.viewBox.baseVal.width) || 
                                   svg.clientWidth || 400;
                        imgHeight = parseFloat(svg.getAttribute('height')) || 
                                    (svg.viewBox && svg.viewBox.baseVal.height) || 
                                    svg.clientHeight || 300;
                    } else {
                        // For generated SVGs, prioritize computed dimensions
                        imgWidth = svg.clientWidth || 
                                   (svg.viewBox && svg.viewBox.baseVal.width) || 
                                   parseFloat(svg.getAttribute('width')) || 400;
                        imgHeight = svg.clientHeight || 
                                    (svg.viewBox && svg.viewBox.baseVal.height) || 
                                    parseFloat(svg.getAttribute('height')) || 300;
                    }
                    
                    // Set both HTML attributes and CSS properties for maximum compatibility
                    img.width = imgWidth;
                    img.height = imgHeight;
                    img.setAttribute('width', imgWidth.toString());
                    img.setAttribute('height', imgHeight.toString());
                    img.style.width = imgWidth + 'px';
                    img.style.height = imgHeight + 'px';
                    img.style.maxWidth = 'none';  // Prevent CSS from constraining the image
                    img.style.maxHeight = 'none';
                    img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    img.alt = 'SVG Image';
                    
                    svg.parentNode.replaceChild(img, svg);
                } catch (err) {
                    console.warn('Failed to convert SVG to image:', err);
                    // Leave as SVG if conversion fails
                }
            }
            
            // 5. Process Math equations - convert to PNG images (exactly like SquibView)
            const mathElements = Array.from(clone.querySelectorAll('.math-display'));
            
            if (mathElements.length > 0) {
                for (const mathEl of mathElements) {
                    try {
                        // Find SVG inside the math element (MathJax creates it)
                        const svg = mathEl.querySelector('svg');
                        if (!svg) {
                            console.warn('No SVG found in math element, skipping');
                            continue;
                        }
                        
                        // Convert SVG to PNG data URL (exactly like SquibView)
                        const serializer = new XMLSerializer();
                        const svgStr = serializer.serializeToString(svg);
                        const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
                        const url = URL.createObjectURL(svgBlob);
                        
                        const img = new Image();
                        const dataUrl = await new Promise((resolve, reject) => {
                            img.onload = function () {
                                const canvas = document.createElement('canvas');
                                
                                // Determine SVG dimensions robustly (exactly like SquibView)
                                let width, height;
                                try {
                                    // First try baseVal.value (works for absolute units)
                                    width = svg.width.baseVal.value;
                                    height = svg.height.baseVal.value;
                                } catch (_e) {
                                    // Fallback for relative units - use viewBox or rendered size
                                    if (svg.viewBox && svg.viewBox.baseVal) {
                                        width = svg.viewBox.baseVal.width;
                                        height = svg.viewBox.baseVal.height;
                                    } else {
                                        // Use the natural size of the loaded image
                                        width = img.naturalWidth || img.width || 200;
                                        height = img.naturalHeight || img.height || 50;
                                    }
                                }
                                
                                // Scale down for much smaller paste sizes
                                const targetMaxWidth = 150;  // Further reduced
                                const targetMaxHeight = 45;   // Further reduced
                                
                                // Apply aggressive downsizing for MathJax SVGs
                                let scaleFactor = 0.04; // Further reduced for smaller output
                                
                                const scaledWidth = width * scaleFactor;
                                const scaledHeight = height * scaleFactor;
                                
                                // If still too large after base scaling, scale down further
                                if (scaledWidth > targetMaxWidth || scaledHeight > targetMaxHeight) {
                                    const scaleX = targetMaxWidth / scaledWidth;
                                    const scaleY = targetMaxHeight / scaledHeight;
                                    scaleFactor *= Math.min(scaleX, scaleY);
                                }
                                
                                width *= scaleFactor;
                                height *= scaleFactor;
                                
                                // Use higher DPR for crisp rendering at smaller sizes
                                const dpr = 2; // Fixed 2x for consistent quality
                                canvas.width = width * dpr;
                                canvas.height = height * dpr;
                                canvas.style.width = width + 'px';
                                canvas.style.height = height + 'px';
                                
                                const ctx = canvas.getContext('2d');
                                ctx.scale(dpr, dpr);
                                
                                // White background
                                ctx.fillStyle = "#FFFFFF";
                                ctx.fillRect(0, 0, width, height);
                                
                                // Draw the SVG image at logical size
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                // Clean up URL
                                URL.revokeObjectURL(url);
                                
                                // Return data URL
                                resolve(canvas.toDataURL('image/png'));
                            };
                            
                            img.onerror = () => {
                                URL.revokeObjectURL(url);
                                reject(new Error('Failed to load SVG image'));
                            };
                            
                            img.src = url;
                        });
                        
                        // Replace math element with img tag containing the PNG data URL
                        const imgElement = document.createElement('img');
                        imgElement.src = dataUrl;
                        
                        // Extract dimensions from the data URL canvas
                        const img2 = new Image();
                        img2.src = dataUrl;
                        await new Promise((resolve) => {
                            img2.onload = resolve;
                            img2.onerror = resolve;
                            setTimeout(resolve, 100); // Timeout fallback
                        });
                        
                        // Set explicit dimensions (accounting for DPR)
                        const displayWidth = img2.naturalWidth / 2;  // Divide by DPR
                        const displayHeight = img2.naturalHeight / 2;
                        
                        imgElement.width = displayWidth;
                        imgElement.height = displayHeight;
                        imgElement.style.cssText = `display:inline-block;margin:0.5em 0;width:${displayWidth}px;height:${displayHeight}px;vertical-align:middle;`;
                        imgElement.alt = 'Math equation';
                        
                        mathEl.parentNode.replaceChild(imgElement, mathEl);
                    } catch (error) {
                        console.error('Failed to convert math element to image:', error);
                        // Keep the original element if conversion fails
                    }
                }
            }
            
            // 2. Process GeoJSON maps - convert to static images (following Gem's guide)
            const geojsonContainers = clone.querySelectorAll('.geojson-container');
            if (geojsonContainers.length > 0) {
                
                for (const clonedContainer of geojsonContainers) {
                    try {
                        // Find the corresponding live container by matching data-original-source
                        const originalSource = clonedContainer.getAttribute('data-original-source');
                        if (!originalSource) {
                            console.warn('No original source found for GeoJSON container');
                            continue;
                        }
                        
                        // Find live container with same source
                        let liveContainer = null;
                        const allLiveContainers = previewPanel.querySelectorAll('.geojson-container');
                        for (const candidate of allLiveContainers) {
                            if (candidate.getAttribute('data-original-source') === originalSource) {
                                liveContainer = candidate;
                                break;
                            }
                        }
                        
                        if (!liveContainer) {
                            console.warn('Could not find live GeoJSON container');
                            const placeholder = document.createElement('div');
                            placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                            placeholder.textContent = '[GeoJSON Map - Interactive content not available in copy]';
                            clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                            continue;
                        }
                        
                        // Check if map is ready
                        const map = liveContainer._map;
                        if (!map) {
                            console.warn('Map not initialized yet');
                            const placeholder = document.createElement('div');
                            placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                            placeholder.textContent = '[GeoJSON Map - Still loading]';
                            clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                            continue;
                        }
                        
                        // Rasterize the map to PNG
                        const dataUrl = await rasterizeGeoJSONMap(liveContainer);
                        
                        if (dataUrl) {
                            // Replace with image
                            const img = document.createElement('img');
                            img.src = dataUrl;
                            img.style.cssText = 'width: 100%; height: 300px; border: 1px solid #ddd; border-radius: 4px; margin: 0.5em 0;';
                            img.alt = 'GeoJSON Map';
                            clonedContainer.parentNode.replaceChild(img, clonedContainer);
                        } else {
                            // Fallback placeholder
                            const placeholder = document.createElement('div');
                            placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                            placeholder.textContent = '[GeoJSON Map - Interactive content not available in copy]';
                            clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                        }
                        
                    } catch (error) {
                        console.error('Failed to process GeoJSON container:', error);
                        // Replace with placeholder
                        const placeholder = document.createElement('div');
                        placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                        placeholder.textContent = '[GeoJSON Map - Interactive content not available in copy]';
                        clonedContainer.parentNode.replaceChild(placeholder, clonedContainer);
                    }
                }
            }
            
            
            
            // 6. Process GeoJSON/Leaflet maps - capture as single image (compose tiles + overlays)
            const mapContainers = clone.querySelectorAll('[data-qd-lang="geojson"]');
            for (const container of mapContainers) {
                try {
                    const containerId = container.id;
                    const originalContainer = containerId ? previewPanel.querySelector(`#${containerId}`) : null;
                    if (!originalContainer) continue;
                    const leafletContainer = originalContainer.querySelector('.leaflet-container');
                    if (!leafletContainer) continue;

                    const dpr = Math.max(1, window.devicePixelRatio || 1);
                    const width = leafletContainer.clientWidth || 600;
                    const height = leafletContainer.clientHeight || 400;
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(width * dpr);
                    canvas.height = Math.round(height * dpr);
                    const ctx = canvas.getContext('2d');
                    ctx.scale(dpr, dpr);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);

                    const leafRect = leafletContainer.getBoundingClientRect();

                    // Draw tiles (snap to integer pixels to avoid seams)
                    const tiles = Array.from(leafletContainer.querySelectorAll('img.leaflet-tile'));
                    for (const tile of tiles) {
                        try {
                            const r = tile.getBoundingClientRect();
                            const x = Math.round(r.left - leafRect.left);
                            const y = Math.round(r.top - leafRect.top);
                            const w = Math.round(r.width);
                            const h = Math.round(r.height);
                            const overlaps = !(r.right <= leafRect.left || r.left >= leafRect.right || r.bottom <= leafRect.top || r.top >= leafRect.bottom);
                            const style = window.getComputedStyle(tile);
                            if (w > 0 && h > 0 && overlaps && style.display !== 'none' && style.visibility !== 'hidden') {
                                ctx.drawImage(tile, x, y, w + 1, h + 1);
                            }
                        } catch (e) {
                            console.warn('Failed to draw tile:', e);
                        }
                    }

                    // Draw SVG overlays (paths, markers)
                    const overlaySvgs = originalContainer.querySelectorAll('.leaflet-overlay-pane svg');
                    for (const svg of overlaySvgs) {
                        try {
                            const svgStr = new XMLSerializer().serializeToString(svg);
                            const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
                            const img = new Image();
                            await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = dataUrl; });
                            const r = svg.getBoundingClientRect();
                            const x = Math.round(r.left - leafRect.left);
                            const y = Math.round(r.top - leafRect.top);
                            const w = Math.round(r.width);
                            const h = Math.round(r.height);
                            const overlaps = !(r.right <= leafRect.left || r.left >= leafRect.right || r.bottom <= leafRect.top || r.top >= leafRect.bottom);
                            if (w > 0 && h > 0 && overlaps) ctx.drawImage(img, x, y, w, h);
                        } catch (e) {
                            console.warn('Failed to draw overlay SVG:', e);
                        }
                    }

                    // Draw marker icons (PNG/SVG img elements)
                    const markerIcons = originalContainer.querySelectorAll('.leaflet-marker-pane img.leaflet-marker-icon');
                    for (const icon of markerIcons) {
                        try {
                            const r = icon.getBoundingClientRect();
                            const x = Math.round(r.left - leafRect.left);
                            const y = Math.round(r.top - leafRect.top);
                            const w = Math.round(r.width);
                            const h = Math.round(r.height);
                            const overlaps = !(r.right <= leafRect.left || r.left >= leafRect.right || r.bottom <= leafRect.top || r.top >= leafRect.bottom);
                            const style = window.getComputedStyle(icon);
                            if (w > 0 && h > 0 && overlaps && style.display !== 'none' && style.visibility !== 'hidden') {
                                ctx.drawImage(icon, x, y, w, h);
                            }
                        } catch (e) {
                            console.warn('Failed to draw marker icon:', e);
                        }
                    }

                    // Try to produce a data URL (may fail if canvas tainted by CORS tiles)
                    let mapDataUrl = '';
                    try {
                        mapDataUrl = canvas.toDataURL('image/png', 1.0);
                    } catch (_e) {
                        console.warn('Map canvas tainted; falling back to placeholder');
                    }

                    const img = document.createElement('img');
                    if (mapDataUrl) {
                        img.src = mapDataUrl;
                        img.width = width;
                        img.height = height;
                        img.setAttribute('width', String(width));
                        img.setAttribute('height', String(height));
                        img.style.width = width + 'px';
                        img.style.height = height + 'px';
                        img.style.display = 'block';
                        img.style.border = '1px solid #ddd';
                        img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                        img.alt = 'Map';
                    } else {
                        img.alt = 'Map';
                        img.style.width = width + 'px';
                        img.style.height = height + 'px';
                        img.style.border = '1px solid #ddd';
                        img.style.backgroundColor = '#f0f0f0';
                    }

                    container.parentNode.replaceChild(img, container);
                } catch (err) {
                    console.warn('Failed to process map container:', err);
                }
            }
            
            // 7. Process HTML fence blocks - render the HTML content and process images
            const htmlContainers = clone.querySelectorAll('.qde-html-container');
            for (const container of htmlContainers) {
                try {
                    // Get the original source HTML
                    const source = container.getAttribute('data-qd-source');
                    
                    // Check if there's a pre element (fallback display) or actual HTML content
                    const pre = container.querySelector('pre');
                    
                    if (source) {
                        // Parse the source HTML
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = source;
                        
                        // Process all images in the HTML block
                        const htmlImages = tempDiv.querySelectorAll('img');
                        for (const img of htmlImages) {
                            // Preserve original dimensions from HTML attributes
                            const widthAttr = img.getAttribute('width');
                            const heightAttr = img.getAttribute('height');
                            
                            if (widthAttr) {
                                img.width = parseInt(widthAttr);
                                img.style.width = widthAttr.includes('%') ? widthAttr : `${img.width}px`;
                            }
                            if (heightAttr) {
                                img.height = parseInt(heightAttr);
                                img.style.height = heightAttr.includes('%') ? heightAttr : `${img.height}px`;
                            }
                            
                            // Convert to data URL using canvas (like squibview)
                            if (img.src && !img.src.startsWith('data:')) {
                                try {
                                    // Use canvas to convert image to data URL (avoids CORS issues)
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    
                                    // Create new image and wait for it to load
                                    const tempImg = new Image();
                                    tempImg.crossOrigin = 'anonymous';
                                    
                                    await new Promise((resolve, reject) => {
                                        tempImg.onload = function() {
                                            
                                            // Calculate dimensions preserving aspect ratio
                                            let displayWidth = 0;
                                            let displayHeight = 0;
                                            
                                            // Use the width specified in HTML (e.g. width="250")
                                            if (widthAttr && !widthAttr.includes('%')) {
                                                displayWidth = parseInt(widthAttr);
                                            }
                                            
                                            // Use the height if specified
                                            if (heightAttr && !heightAttr.includes('%')) {
                                                displayHeight = parseInt(heightAttr);
                                            }
                                            
                                            
                                            // If only width is specified, calculate height based on aspect ratio
                                            if (displayWidth > 0 && displayHeight === 0) {
                                                if (tempImg.naturalWidth > 0) {
                                                    const aspectRatio = tempImg.naturalHeight / tempImg.naturalWidth;
                                                    displayHeight = Math.round(displayWidth * aspectRatio);
                                                }
                                            }
                                            // If only height is specified, calculate width based on aspect ratio
                                            else if (displayHeight > 0 && displayWidth === 0) {
                                                if (tempImg.naturalHeight > 0) {
                                                    const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
                                                    displayWidth = Math.round(displayHeight * aspectRatio);
                                                }
                                            }
                                            // If neither specified, use natural dimensions
                                            else if (displayWidth === 0 && displayHeight === 0) {
                                                displayWidth = tempImg.naturalWidth || 250;
                                                displayHeight = tempImg.naturalHeight || 200;
                                            }
                                            
                                            
                                            canvas.width = displayWidth;
                                            canvas.height = displayHeight;
                                            
                                            // Draw image to canvas
                                            ctx.drawImage(tempImg, 0, 0, displayWidth, displayHeight);
                                            
                                            // Convert to data URL
                                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                                            
                                            // Update original image
                                            img.src = dataUrl;
                                            img.width = displayWidth;
                                            img.height = displayHeight;
                                            img.setAttribute('width', displayWidth.toString());
                                            img.setAttribute('height', displayHeight.toString());
                                            img.style.width = displayWidth + 'px';
                                            img.style.height = displayHeight + 'px';
                                            
                                            resolve();
                                        };
                                        
                                        tempImg.onerror = function() {
                                            console.warn('Failed to load HTML fence image:', img.src);
                                            reject(new Error('Image load failed'));
                                        };
                                        
                                        // Set source - resolve relative paths
                                        if (img.src.startsWith('http') || img.src.startsWith('//')) {
                                            tempImg.src = img.src;
                                        } else {
                                            // Relative path - let browser resolve it
                                            const absoluteImg = new Image();
                                            absoluteImg.src = img.src;
                                            tempImg.src = absoluteImg.src;
                                        }
                                    });
                                } catch (err) {
                                    console.warn('Failed to convert HTML fence image:', img.src, err);
                                }
                            }
                            
                            // Add v:shapes for Word compatibility
                            img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                        }
                        
                        // Replace container content with processed HTML (whether it had pre or not)
                        container.innerHTML = tempDiv.innerHTML;
                    } else if (!pre) {
                        // Container has rendered HTML already, process its images directly
                        const htmlImages = container.querySelectorAll('img');
                        for (const img of htmlImages) {
                            // Same image processing as above
                            const widthAttr = img.getAttribute('width');
                            const heightAttr = img.getAttribute('height');
                            
                            if (widthAttr) {
                                img.width = parseInt(widthAttr);
                                img.style.width = widthAttr.includes('%') ? widthAttr : `${img.width}px`;
                            }
                            if (heightAttr) {
                                img.height = parseInt(heightAttr);
                                img.style.height = heightAttr.includes('%') ? heightAttr : `${img.height}px`;
                            }
                            
                            if (img.src && !img.src.startsWith('data:')) {
                                try {
                                    // Use same canvas approach as above
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    const tempImg = new Image();
                                    tempImg.crossOrigin = 'anonymous';
                                    
                                    await new Promise((resolve, reject) => {
                                        tempImg.onload = function() {
                                            // Calculate dimensions preserving aspect ratio
                                            let displayWidth = img.width || 0;
                                            let displayHeight = img.height || 0;
                                            
                                            // If only width is specified, calculate height based on aspect ratio
                                            if (displayWidth && !displayHeight) {
                                                const aspectRatio = tempImg.naturalHeight / tempImg.naturalWidth;
                                                displayHeight = Math.round(displayWidth * aspectRatio);
                                            }
                                            // If only height is specified, calculate width based on aspect ratio
                                            else if (displayHeight && !displayWidth) {
                                                const aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
                                                displayWidth = Math.round(displayHeight * aspectRatio);
                                            }
                                            // If neither specified, use natural dimensions
                                            else if (!displayWidth && !displayHeight) {
                                                displayWidth = tempImg.naturalWidth || 250;
                                                displayHeight = tempImg.naturalHeight || Math.round(250 * (tempImg.naturalHeight / tempImg.naturalWidth));
                                            }
                                            
                                            canvas.width = displayWidth;
                                            canvas.height = displayHeight;
                                            ctx.drawImage(tempImg, 0, 0, displayWidth, displayHeight);
                                            
                                            const dataUrl = canvas.toDataURL('image/png', 1.0);
                                            img.src = dataUrl;
                                            img.width = displayWidth;
                                            img.height = displayHeight;
                                            img.setAttribute('width', displayWidth.toString());
                                            img.setAttribute('height', displayHeight.toString());
                                            img.style.width = displayWidth + 'px';
                                            img.style.height = displayHeight + 'px';
                                            
                                            resolve();
                                        };
                                        
                                        tempImg.onerror = function() {
                                            console.warn('Failed to load HTML fence image:', img.src);
                                            reject(new Error('Image load failed'));
                                        };
                                        
                                        if (img.src.startsWith('http') || img.src.startsWith('//')) {
                                            tempImg.src = img.src;
                                        } else {
                                            const absoluteImg = new Image();
                                            absoluteImg.src = img.src;
                                            tempImg.src = absoluteImg.src;
                                        }
                                    });
                                } catch (err) {
                                    console.warn('Failed to convert HTML fence image:', img.src, err);
                                }
                            }
                            
                            img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                        }
                    }
                } catch (err) {
                    console.warn('Failed to process HTML container:', err);
                }
            }
            
            // 8. Tables are already HTML tables from the built-in renderer
            // No processing needed
            
            // Wrap in proper HTML structure for rich text editors
            const fragment = clone.innerHTML;
            const htmlContent = `
            <!DOCTYPE html>
            <html xmlns:v="urn:schemas-microsoft-com:vml"
                  xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:w="urn:schemas-microsoft-com:office:word">
              <head>
                <meta charset="utf-8">
                <style>
                  /* Table styling */
                  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
                  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                  th { background-color: #f0f0f0; font-weight: bold; }
                  
                  /* Code block styling */
                  pre { background-color: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
                  code { font-family: monospace; background-color: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
                  
                  /* Image handling */
                  img { display: block; max-width: 100%; height: auto; margin: 0.5em 0; }
                  
                  /* Blockquote */
                  blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
                  
                  /* Math equations centered like squibview */
                  .math-display { text-align: center; margin: 1em 0; }
                  .math-display img { display: inline-block; margin: 0 auto; }
                </style>
              </head>
              <body><!--StartFragment-->${fragment}<!--EndFragment--></body>
            </html>`;
            
            // Get plain text version
            const text = clone.textContent || clone.innerText || '';
            
            // Get platform for clipboard strategy (like squibview)
            const platform = getPlatform();
            
            if (platform === 'macos') {
                // macOS approach (like squibview)
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'text/html': new Blob([htmlContent], { type: 'text/html' }),
                            'text/plain': new Blob([text], { type: 'text/plain' })
                        })
                    ]);
                    return { success: true, html: htmlContent, text };
                } catch (modernErr) {
                    console.warn('Modern clipboard API failed, trying Safari fallback:', modernErr);
                    // Safari fallback (selection-based HTML of fragment)
                    if (copyToClipboard(fragment)) {
                        return { success: true, html: htmlContent, text };
                    }
                    throw new Error('Fallback copy failed');
                }
            } else {
                // Windows/Linux approach (like squibview)
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'fixed';
                tempDiv.style.left = '-9999px';
                tempDiv.style.top = '0';
                // Use fragment for selection-based fallback copy
                tempDiv.innerHTML = fragment;
                document.body.appendChild(tempDiv);
                
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'text/html': new Blob([htmlContent], { type: 'text/html' }),
                            'text/plain': new Blob([text], { type: 'text/plain' })
                        })
                    ]);
                    return { success: true, html: htmlContent, text };
                } catch (modernErr) {
                    console.warn('Modern clipboard API failed, trying execCommand fallback:', modernErr);
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(tempDiv);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    const successful = document.execCommand('copy');
                    if (!successful) {
                        throw new Error('Fallback copy failed');
                    }
                    return { success: true, html: htmlContent, text };
                } finally {
                    if (tempDiv && tempDiv.parentNode) {
                        document.body.removeChild(tempDiv);
                    }
                }
            }
            
        } catch (err) {
            console.error('Failed to copy rendered content:', err);
            throw err;
        }
    }

    /**
     * Quikdown Editor - A drop-in markdown editor control
     * @version 1.0.5
     * @license BSD-2-Clause
     */


    // Default options
    const DEFAULT_OPTIONS = {
        mode: 'split',          // 'source' | 'preview' | 'split'
        showToolbar: true,
        showRemoveHR: false,    // Show button to remove horizontal rules (---)
        showLazyLinefeeds: false, // Show button to convert lazy linefeeds
        theme: 'auto',          // 'light' | 'dark' | 'auto'
        lazy_linefeeds: false,
        inline_styles: false,   // Use CSS classes (false) or inline styles (true)
        debounceDelay: 20,      // Reduced from 100ms for better responsiveness
        placeholder: 'Start typing markdown...',
        plugins: {
            highlightjs: false,
            mermaid: false
        },
        /**
         * Preload fence-rendering libraries at construction time so the FIRST
         * encounter with a fence type renders instantly (no lazy load delay).
         *
         * Accepts:
         *   - 'all'                                — preload every known library
         *   - ['highlightjs','mermaid','math',
         *      'geojson','stl']                    — preload specific libraries
         *   - [{ name: 'mylib', script: 'https://...', css: '...' }]
         *                                          — preload an arbitrary library
         *
         * Without this, fence libraries are loaded on demand the first time their
         * fence type is encountered. That keeps the editor lightweight, but the
         * first SVG/Mermaid/Math/GeoJSON/STL fence will show "loading..." for a
         * moment. Set `preloadFences` if you want zero-delay rendering — at the
         * cost of a few hundred KB of upfront network.
         *
         * Developer's choice. The editor itself is still ~70 KB minified;
         * `preloadFences` only affects the OPTIONAL fence renderers.
         */
        preloadFences: null,
        customFences: {}, // { 'language': (code, lang) => html }
        enableComplexFences: true, // Enable CSV tables, math rendering, SVG, etc.
        showUndoRedo: false,      // Show undo/redo toolbar buttons
        undoStackSize: 100        // Maximum number of undo states to keep
    };

    // Library catalog used by preloadFences. Each entry knows how to:
    //   - check if the library is already on the page (so we don't double-load)
    //   - load it via script (and optional CSS)
    const FENCE_LIBRARIES = {
        highlightjs: {
            check: () => typeof window.hljs !== 'undefined',
            script: 'https://unpkg.com/@highlightjs/cdn-assets/highlight.min.js',
            css: 'https://unpkg.com/@highlightjs/cdn-assets/styles/github.min.css',
            cssDark: 'https://unpkg.com/@highlightjs/cdn-assets/styles/github-dark.min.css'
        },
        mermaid: {
            check: () => typeof window.mermaid !== 'undefined',
            script: 'https://unpkg.com/mermaid/dist/mermaid.min.js',
            afterLoad: () => {
                if (window.mermaid) window.mermaid.initialize({ startOnLoad: false });
            }
        },
        math: {
            check: () => typeof window.MathJax !== 'undefined',
            script: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js',
            beforeLoad: () => {
                // Configure MathJax before loading (must be set on window before script runs)
                if (!window.MathJax) {
                    window.MathJax = {
                        tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
                        svg: { fontCache: 'global' },
                        startup: { typeset: false }
                    };
                }
            }
        },
        geojson: {
            check: () => typeof window.L !== 'undefined',
            script: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        },
        stl: {
            check: () => typeof window.THREE !== 'undefined',
            script: 'https://unpkg.com/three@0.147.0/build/three.min.js'
        }
    };

    /**
     * Quikdown Editor - A complete markdown editing solution
     */
    class QuikdownEditor {
        constructor(container, options = {}) {
            // Resolve container
            this.container = typeof container === 'string' 
                ? document.querySelector(container) 
                : container;
                
            if (!this.container) {
                throw new Error('QuikdownEditor: Invalid container');
            }
            
            // Merge options
            this.options = { ...DEFAULT_OPTIONS, ...options };
            
            // State
            this._markdown = '';
            this._html = '';
            this.currentMode = this.options.mode;
            this.updateTimer = null;

            // Undo/redo state
            this._undoStack = [];
            this._redoStack = [];
            this._isUndoRedo = false;
            
            // Initialize
            this.initPromise = this.init();
        }
        
        /**
         * Initialize the editor
         */
        async init() {
            // Load plugins if requested
            await this.loadPlugins();
            
            // Build UI
            this.buildUI();
            
            // Attach event listeners
            this.attachEvents();
            
            // Apply initial theme
            this.applyTheme();
            
            // Set initial mode
            this.setMode(this.currentMode);
            
            // Set initial content if provided
            if (this.options.initialContent) {
                this.setMarkdown(this.options.initialContent);
            }
        }
        
        /**
         * Build the editor UI
         */
        buildUI() {
            // Clear container
            this.container.innerHTML = '';
            
            // Add editor class
            this.container.classList.add('qde-container');
            
            // Create toolbar if enabled
            if (this.options.showToolbar) {
                this.toolbar = this.createToolbar();
                this.container.appendChild(this.toolbar);
            }
            
            // Create editor area
            this.editorArea = document.createElement('div');
            this.editorArea.className = 'qde-editor';
            
            // Create source panel
            this.sourcePanel = document.createElement('div');
            this.sourcePanel.className = 'qde-source';
            
            this.sourceTextarea = document.createElement('textarea');
            this.sourceTextarea.className = 'qde-textarea';
            this.sourceTextarea.spellcheck = false;
            this.sourceTextarea.placeholder = this.options.placeholder;
            this.sourcePanel.appendChild(this.sourceTextarea);
            
            // Create preview panel
            this.previewPanel = document.createElement('div');
            this.previewPanel.className = 'qde-preview';
            this.previewPanel.contentEditable = true;
            this.previewPanel.spellcheck = false;
            
            // Add panels to editor
            this.editorArea.appendChild(this.sourcePanel);
            this.editorArea.appendChild(this.previewPanel);
            this.container.appendChild(this.editorArea);
            
            // Add built-in styles if not already present
            this.injectStyles();
        }
        
        /**
         * Create toolbar
         */
        createToolbar() {
            const toolbar = document.createElement('div');
            toolbar.className = 'qde-toolbar';
            
            // Mode buttons
            const modes = ['source', 'split', 'preview'];
            const modeLabels = { source: 'Source', split: 'Split', preview: 'Rendered' };
            modes.forEach(mode => {
                const btn = document.createElement('button');
                btn.className = 'qde-btn';
                btn.dataset.mode = mode;
                btn.textContent = modeLabels[mode];
                btn.title = `Switch to ${modeLabels[mode]} view`;
                toolbar.appendChild(btn);
            });

            // Mobile split toggle (hidden by default, shown via CSS on narrow viewports)
            const splitToggle = document.createElement('button');
            splitToggle.className = 'qde-btn qde-split-toggle';
            splitToggle.textContent = 'Preview';
            splitToggle.title = 'Toggle between source and preview in split mode';
            toolbar.appendChild(splitToggle);

            // Undo/Redo buttons (if enabled)
            if (this.options.showUndoRedo) {
                const undoBtn = document.createElement('button');
                undoBtn.className = 'qde-btn disabled';
                undoBtn.dataset.action = 'undo';
                undoBtn.textContent = 'Undo';
                undoBtn.title = 'Undo (Ctrl+Z)';
                toolbar.appendChild(undoBtn);

                const redoBtn = document.createElement('button');
                redoBtn.className = 'qde-btn disabled';
                redoBtn.dataset.action = 'redo';
                redoBtn.textContent = 'Redo';
                redoBtn.title = 'Redo (Ctrl+Shift+Z / Ctrl+Y)';
                toolbar.appendChild(redoBtn);
            }

            // Spacer
            const spacer = document.createElement('span');
            spacer.className = 'qde-spacer';
            toolbar.appendChild(spacer);
            
            // Copy buttons
            const copyButtons = [
                { action: 'copy-markdown', text: 'Copy MD', title: 'Copy markdown to clipboard' },
                { action: 'copy-html', text: 'Copy HTML', title: 'Copy HTML to clipboard' },
                { action: 'copy-rendered', text: 'Copy Rendered', title: 'Copy rich text to clipboard' }
            ];
            
            copyButtons.forEach(({ action, text, title }) => {
                const btn = document.createElement('button');
                btn.className = 'qde-btn';
                btn.dataset.action = action;
                btn.textContent = text;
                btn.title = title;
                toolbar.appendChild(btn);
            });
            
            // Remove HR button (if enabled)
            if (this.options.showRemoveHR) {
                const removeHRBtn = document.createElement('button');
                removeHRBtn.className = 'qde-btn';
                removeHRBtn.dataset.action = 'remove-hr';
                removeHRBtn.textContent = 'Remove HR';
                removeHRBtn.title = 'Remove all horizontal rules (---) from markdown';
                toolbar.appendChild(removeHRBtn);
            }

            // Lazy linefeeds button (if enabled)
            if (this.options.showLazyLinefeeds) {
                const lazyLFBtn = document.createElement('button');
                lazyLFBtn.className = 'qde-btn';
                lazyLFBtn.dataset.action = 'lazy-linefeeds';
                lazyLFBtn.textContent = 'Fix Linefeeds';
                lazyLFBtn.title = 'Convert single newlines to paragraph breaks (one-time transform)';
                toolbar.appendChild(lazyLFBtn);
            }
            
            return toolbar;
        }
        
        /**
         * Inject built-in styles
         */
        injectStyles() {
            if (document.getElementById('qde-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'qde-styles';
            style.textContent = `
            .qde-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                background: white;
                color: #1f2937;
            }
            
            .qde-toolbar {
                display: flex;
                align-items: center;
                padding: 8px;
                background: #f5f5f5;
                border-bottom: 1px solid #ddd;
                gap: 4px;
            }
            
            .qde-btn {
                padding: 6px 12px;
                border: 1px solid #ccc;
                background: white;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .qde-btn:hover {
                background: #e9e9e9;
                border-color: #999;
            }
            
            .qde-btn.active {
                background: #007bff;
                color: white;
                border-color: #0056b3;
            }

            .qde-btn.disabled {
                opacity: 0.4;
                pointer-events: none;
            }
            
            .qde-spacer {
                flex: 1;
            }
            
            .qde-editor {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .qde-source, .qde-preview {
                flex: 1 1 0;
                min-width: 0;       /* allow flex shrinking below content size */
                min-height: 0;
                overflow: auto;
                padding: 16px;
                box-sizing: border-box;
            }

            .qde-source {
                border-right: 1px solid #ddd;
                /* Source pane is just a container for the textarea — make it
                   a positioning context so the textarea can fill it absolutely */
                position: relative;
                padding: 0;          /* textarea brings its own padding */
            }

            .qde-textarea {
                display: block;
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
                resize: none;
                padding: 16px;
                box-sizing: border-box;
                font-family: 'Monaco', 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
                background: transparent;
                color: inherit;
                /* Wrap long lines so the textarea only scrolls VERTICALLY.
                   pre-wrap preserves intentional line breaks/whitespace
                   while soft-wrapping at the right edge. */
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: hidden;
                overflow-y: auto;
            }
            
            .qde-preview {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                outline: none;
                cursor: text;  /* Standard text cursor */
                overflow-x: hidden;  /* never scroll horizontally; clip wide content */
            }

            /* Code blocks and inline code — self-contained so the editor
               does not depend on any external stylesheet for these. */
            .qde-preview pre {
                background: #f4f4f4;
                color: #1f2937;
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 0.6em 0;
                font-size: 0.9em;
                line-height: 1.5;
                font-family: ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace;
            }
            .qde-preview code {
                padding: 2px 4px;
                font-size: 0.9em;
                border-radius: 3px;
                background: #f0f0f0;
                color: #1f2937;
                font-family: ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace;
            }
            .qde-preview pre code {
                padding: 0;
                font-size: inherit;
                border-radius: 0;
                background: transparent;
                color: inherit;
            }

            /* Wide fence content (Leaflet maps, large SVGs, STL canvases,
               iframes, raw <img>) must never overflow the preview pane */
            .qde-preview .geojson-container,
            .qde-preview .qde-stl-container,
            .qde-preview .qde-svg-container,
            .qde-preview .leaflet-container,
            .qde-preview iframe,
            .qde-preview img,
            .qde-preview > svg {
                max-width: 100%;
            }
            .qde-preview .leaflet-container { box-sizing: border-box; }

            /* Standard markdown tables (the .quikdown-table class) need to
               scroll horizontally inside their own wrapper rather than
               making the whole preview pane scroll */
            .qde-preview table.quikdown-table,
            .qde-preview table.qde-csv-table {
                display: block;
                max-width: 100%;
                overflow-x: auto;
            }

            /* Fence-specific styles */
            .qde-svg-container {
                max-width: 100%;
                overflow: auto;
            }

            .qde-svg-container svg {
                max-width: 100%;
                height: auto;
            }
            
            .qde-html-container {
                /* HTML containers inherit background */
                margin: 12px 0;
            }
            
            .qde-math-container {
                text-align: center;
                margin: 16px 0;
                overflow-x: auto;
            }
            
            /* All tables in preview (both regular markdown and CSV) */
            .qde-preview table {
                width: 100%;
                border-collapse: collapse;
                margin: 12px 0;
                font-size: 14px;
            }
            
            .qde-preview table th,
            .qde-preview table td {
                border: 1px solid #ddd;
                padding: 8px;
            }
            
            /* Support for alignment classes from quikdown */
            .qde-preview .quikdown-left { text-align: left; }
            .qde-preview .quikdown-center { text-align: center; }
            .qde-preview .quikdown-right { text-align: right; }
            
            .qde-preview table th {
                background: #f5f5f5;
                font-weight: bold;
            }
            
            .qde-preview table tr:nth-child(even) {
                background: #f9f9f9;
            }
            
            /* Specific to CSV-generated tables */
            .qde-data-table {
                /* Can add specific CSV table styles here if needed */
            }
            
            .qde-json {
                /* Let highlight.js handle styling */
                overflow-x: auto;
            }
            
            .qde-error {
                background: #fee;
                border: 1px solid #fcc;
                color: #c00;
                padding: 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
            }
            
            /* Read-only complex fence blocks in preview */
            .qde-preview [contenteditable="false"] {
                cursor: auto;  /* Use automatic cursor (arrow for non-text) */
                user-select: text;
                position: relative;
            }
            
            /* Reset headings inside the preview to plain browser defaults so
               parent-page styles (site navs, marketing pages, design systems)
               cannot bleed in. Business-casual: black text, decreasing sizes,
               no decorative borders. See docs/quikdown-editor.md for how
               embedders can override these with their own stylesheet. */
            .qde-preview h1 { font-size: 2em; }
            .qde-preview h2 { font-size: 1.5em; }
            .qde-preview h3 { font-size: 1.25em; }
            .qde-preview h4 { font-size: 1em; }
            .qde-preview h5 { font-size: 0.875em; }
            .qde-preview h6 { font-size: 0.85em; }
            .qde-preview h1,
            .qde-preview h2,
            .qde-preview h3,
            .qde-preview h4,
            .qde-preview h5,
            .qde-preview h6 {
                font-weight: bold;
                color: inherit;
                border: none;
                margin: 0.6em 0 0.3em 0;
                line-height: 1.25;
            }
            .qde-preview p {
                margin: 0.35em 0;
            }
            .qde-preview ul,
            .qde-preview ol {
                padding-left: 1.8em;
                margin: 0.4em 0;
            }
            .qde-preview li {
                margin: 0.15em 0;
            }
            .qde-preview blockquote {
                margin: 0.5em 0;
                padding-left: 1em;
            }

            /* Ensure proper cursor for editable text elements */
            .qde-preview p,
            .qde-preview h1,
            .qde-preview h2,
            .qde-preview h3,
            .qde-preview h4,
            .qde-preview h5,
            .qde-preview h6,
            .qde-preview li,
            .qde-preview td,
            .qde-preview th,
            .qde-preview blockquote,
            .qde-preview pre[contenteditable="true"],
            .qde-preview code[contenteditable="true"] {
                cursor: text;
            }
            
            
            /* Non-editable complex renderers */
            .qde-preview .qde-svg-container[contenteditable="false"],
            .qde-preview .qde-html-container[contenteditable="false"],
            .qde-preview .qde-math-container[contenteditable="false"],
            .qde-preview .mermaid[contenteditable="false"] {
                opacity: 0.98;
            }
            
            /* Subtle hover effect for read-only blocks */
            .qde-preview [contenteditable="false"]:hover::after {
                content: "Read-only";
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 10px;
                color: #999;
                background: rgba(255, 255, 255, 0.9);
                padding: 2px 4px;
                border-radius: 2px;
                pointer-events: none;
            }
            
            /* Fix list padding in preview */
            .qde-preview ul,
            .qde-preview ol {
                padding-left: 2em;
                margin: 0.5em 0;
            }
            
            .qde-preview li {
                margin: 0.25em 0;
            }
            
            /* Mode-specific visibility */
            .qde-mode-source .qde-preview { display: none; }
            .qde-mode-source .qde-source { border-right: none; }
            .qde-mode-preview .qde-source { display: none; }
            .qde-mode-split .qde-source,
            .qde-mode-split .qde-preview { display: block; }
            
            /* Dark theme */
            .qde-dark {
                background: #1e1e1e;
                color: #e0e0e0;
                border-color: #444;
            }
            
            .qde-dark .qde-toolbar {
                background: #2d2d2d;
                border-color: #444;
            }
            
            .qde-dark .qde-btn {
                background: #3a3a3a;
                color: #e0e0e0;
                border-color: #555;
            }
            
            .qde-dark .qde-btn:hover {
                background: #4a4a4a;
            }
            
            .qde-dark .qde-source {
                border-color: #444;
            }
            
            .qde-dark .qde-textarea {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            .qde-dark .qde-preview {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            /* Dark mode code blocks */
            .qde-dark .qde-preview pre {
                background: #2d2d3a;
                color: #e6e6f0;
            }
            .qde-dark .qde-preview code {
                background: #2a2a3a;
                color: #e6e6f0;
            }
            .qde-dark .qde-preview pre code {
                background: transparent;
                color: inherit;
            }

            /* Dark mode table styles */
            .qde-dark .qde-preview table th,
            .qde-dark .qde-preview table td {
                border-color: #3a3a3a;
            }
            
            .qde-dark .qde-preview table th {
                background: #2d2d2d;
            }
            
            .qde-dark .qde-preview table tr:nth-child(even) {
                background: #252525;
            }
            
            /* Mobile split toggle — hidden by default */
            .qde-split-toggle { display: none; }

            /* Mobile responsive — collapse split to single-pane with toggle */
            @media (max-width: 768px) {
                .qde-toolbar {
                    flex-wrap: wrap;
                }
                .qde-btn {
                    padding: 4px 8px;
                    font-size: 12px;
                }
                .qde-source, .qde-preview {
                    padding: 10px;
                }
                .qde-textarea {
                    padding: 10px;
                }

                /* In split mode on mobile: show only one pane at a time */
                .qde-mode-split .qde-source {
                    border-right: none;
                }
                .qde-mode-split .qde-preview {
                    display: none;
                }
                /* When the user toggles to preview-side in mobile split */
                .qde-mode-split.qde-split-preview .qde-source {
                    display: none;
                }
                .qde-mode-split.qde-split-preview .qde-preview {
                    display: block;
                }

                /* Show the toggle button only in split mode on mobile */
                .qde-mode-split .qde-split-toggle {
                    display: inline-block;
                }

                /* Dark theme border override */
                .qde-dark.qde-mode-split .qde-source {
                    border-bottom-color: #444;
                }
            }
        `;
            
            document.head.appendChild(style);
        }
        
        /**
         * Attach event listeners
         */
        attachEvents() {
            // Source textarea input
            this.sourceTextarea.addEventListener('input', () => {
                this.handleSourceInput();
            });
            
            // Preview contenteditable input
            this.previewPanel.addEventListener('input', () => {
                this.handlePreviewInput();
            });
            
            // Toolbar buttons
            if (this.toolbar) {
                this.toolbar.addEventListener('click', (e) => {
                    const btn = e.target.closest('.qde-btn');
                    if (!btn) return;

                    // Mobile split-toggle button
                    if (btn.classList.contains('qde-split-toggle')) {
                        this.container.classList.toggle('qde-split-preview');
                        const showingPreview = this.container.classList.contains('qde-split-preview');
                        btn.textContent = showingPreview ? 'Source' : 'Preview';
                        return;
                    }

                    if (btn.dataset.mode) {
                        this.setMode(btn.dataset.mode);
                    } else if (btn.dataset.action) {
                        this.handleAction(btn.dataset.action);
                    }
                });
            }
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch(e.key) {
                        case '1':
                            e.preventDefault();
                            this.setMode('source');
                            break;
                        case '2':
                            e.preventDefault();
                            this.setMode('split');
                            break;
                        case '3':
                            e.preventDefault();
                            this.setMode('preview');
                            break;
                        case 'z':
                        case 'Z':
                            if (e.shiftKey) {
                                e.preventDefault();
                                this.redo();
                            } else {
                                e.preventDefault();
                                this.undo();
                            }
                            break;
                        case 'y':
                        case 'Y':
                            e.preventDefault();
                            this.redo();
                            break;
                    }
                }
            });
        }
        
        /**
         * Handle source textarea input
         */
        handleSourceInput() {
            clearTimeout(this.updateTimer);
            this.updateTimer = setTimeout(() => {
                this.updateFromMarkdown(this.sourceTextarea.value);
            }, this.options.debounceDelay);
        }
        
        /**
         * Handle preview panel input
         */
        handlePreviewInput() {
            clearTimeout(this.updateTimer);
            this.updateTimer = setTimeout(() => {
                this.updateFromHTML();
            }, this.options.debounceDelay);
        }
        
        /**
         * Update from markdown source
         */
        updateFromMarkdown(markdown) {
            // Push current state to undo stack before changing (unless this is an undo/redo operation)
            if (!this._isUndoRedo) {
                this._pushUndoState(markdown || '');
            }
            this._isUndoRedo = false;

            this._markdown = markdown || '';
            
            // Show placeholder if empty
            if (!this._markdown.trim()) {
                this._html = '';
                if (this.currentMode !== 'source') {
                    this.previewPanel.innerHTML = '<div style="color: #999; font-style: italic; padding: 16px;">Start typing markdown in the source panel...</div>';
                }
            } else {
                this._html = quikdown_bd(markdown, {
                    fence_plugin: this.createFencePlugin(),
                    lazy_linefeeds: this.options.lazy_linefeeds,
                    inline_styles: this.options.inline_styles
                });
                
                // Update preview if visible
                if (this.currentMode !== 'source') {
                    this.previewPanel.innerHTML = this._html;
                    // Make all fence blocks non-editable
                    this.makeFencesNonEditable();
                    
                    // Process all math elements with MathJax if loaded (like squibview)
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        const mathElements = this.previewPanel.querySelectorAll('.math-display');
                        if (mathElements.length > 0) {
                            window.MathJax.typesetPromise(Array.from(mathElements))
                                .catch(_err => {
                                    console.warn('MathJax batch processing failed:', _err);
                                });
                        }
                    }
                }
            }
            
            // Trigger change event
            if (this.options.onChange) {
                this.options.onChange(this._markdown, this._html);
            }
        }
        
        /**
         * Update from HTML preview
         */
        updateFromHTML() {
            // Clone the preview panel to avoid modifying the actual DOM
            const clonedPanel = this.previewPanel.cloneNode(true);

            // Pre-process special elements on the clone
            this.preprocessSpecialElements(clonedPanel);

            this._html = this.previewPanel.innerHTML;
            const newMarkdown = quikdown_bd.toMarkdown(clonedPanel, {
                fence_plugin: this.createFencePlugin()
            });

            // Push previous state to undo stack (now that we know the new markdown)
            if (!this._isUndoRedo) {
                this._pushUndoState(newMarkdown);
            }
            this._isUndoRedo = false;

            this._markdown = newMarkdown;

            // Update source if visible
            if (this.currentMode !== 'preview') {
                this.sourceTextarea.value = this._markdown;
            }

            // Trigger change event
            if (this.options.onChange) {
                this.options.onChange(this._markdown, this._html);
            }

            this._updateUndoButtons();
        }
        
        /**
         * Pre-process special elements before markdown conversion
         */
        preprocessSpecialElements(panel) {
            if (!panel) return;
            
            // Restore non-editable complex fences from their data attributes
            const complexFences = panel.querySelectorAll('[contenteditable="false"][data-qd-source]');
            complexFences.forEach(element => {
                const source = element.getAttribute('data-qd-source');
                const fence = element.getAttribute('data-qd-fence') || '```';
                const lang = element.getAttribute('data-qd-lang') || '';
                
                // Create a pre element with the original source
                const pre = document.createElement('pre');
                pre.setAttribute('data-qd-fence', fence);
                if (lang) pre.setAttribute('data-qd-lang', lang);
                const code = document.createElement('code');
                // The source is already the original unescaped content when using setAttribute
                // No need to unescape since browser handles it automatically
                code.textContent = source;
                pre.appendChild(code);
                
                // Replace the complex element with pre
                element.parentNode.replaceChild(pre, element);
            });
            
            // Convert CSV tables back to CSV fence blocks (these ARE editable)
            const csvTables = panel.querySelectorAll('table.qde-csv-table[data-qd-lang]');
            csvTables.forEach(table => {
                const lang = table.getAttribute('data-qd-lang');
                if (!lang || !['csv', 'psv', 'tsv'].includes(lang)) return;
                
                const delimiter = lang === 'csv' ? ',' : lang === 'psv' ? '|' : '\t';
                
                // Extract data from table
                let csv = '';
                
                // Get headers
                const headers = [];
                const headerCells = table.querySelectorAll('thead th');
                headerCells.forEach(th => {
                    const text = th.textContent.trim();
                    // Quote if contains delimiter or quotes
                    const needsQuoting = text.includes(delimiter) || text.includes('"') || text.includes('\n');
                    headers.push(needsQuoting ? `"${text.replace(/"/g, '""')}"` : text);
                });
                csv += headers.join(delimiter) + '\n';
                
                // Get rows
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td').forEach(td => {
                        const text = td.textContent.trim();
                        const needsQuoting = text.includes(delimiter) || text.includes('"') || text.includes('\n');
                        cells.push(needsQuoting ? `"${text.replace(/"/g, '""')}"` : text);
                    });
                    csv += cells.join(delimiter) + '\n';
                });
                
                // Create a pre element with the CSV data
                const pre = document.createElement('pre');
                pre.setAttribute('data-qd-fence', '```');
                pre.setAttribute('data-qd-lang', lang);
                const code = document.createElement('code');
                code.textContent = csv.trim();
                pre.appendChild(code);
                
                // Replace table with pre
                table.parentNode.replaceChild(pre, table);
            });
        }
        
        /**
         * Create fence plugin for syntax highlighting
         */
        createFencePlugin() {
            const render = (code, lang) => {
                // Check custom fences first (they take precedence)
                if (this.options.customFences && this.options.customFences[lang]) {
                    try {
                        return this.options.customFences[lang](code, lang);
                    } catch (err) {
                        console.error(`Custom fence plugin error for ${lang}:`, err);
                        return `<pre><code class="language-${lang}">${this.escapeHtml(code)}</code></pre>`;
                    }
                }
                
                // For bidirectional editing, only apply syntax highlighting
                // Skip complex transformations that break round-trip conversion
                const skipComplexRendering = !this.options.enableComplexFences;
                
                if (!skipComplexRendering) {
                    // Built-in lazy loading fence handlers (disabled for now)
                    switch(lang) {
                        case 'svg':
                            return this.renderSVG(code);
                            
                        case 'html':
                            return this.renderHTML(code);
                            
                        case 'math':
                        case 'tex':
                        case 'latex':
                            return this.renderMath(code, lang);
                            
                        case 'csv':
                        case 'psv':
                        case 'tsv':
                            return this.renderTable(code, lang);
                            
                        case 'json':
                        case 'json5':
                            return this.renderJSON(code, lang);
                            
                        case 'katex':  // Use MathJax for katex fence blocks (backward compatibility)
                            return this.renderMath(code, 'katex');
                            
                        case 'mermaid':
                            if (window.mermaid) {
                                return this.renderMermaid(code);
                            }
                            break;
                            
                        case 'geojson':
                            return this.renderGeoJSON(code);
                            
                        case 'stl':
                            return this.renderSTL(code);
                    }
                }
                
                // Syntax highlighting support - keep editable for bidirectional
                if (window.hljs && lang && hljs.getLanguage(lang)) {
                    const highlighted = hljs.highlight(code, { language: lang }).value;
                    // Don't add contenteditable="false" - the bidirectional system can extract text from the highlighted code
                    return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                }
                
                // Default: let quikdown handle it
                return undefined;
            };
            
            // Reverse function to extract raw source from rendered HTML
            const reverse = (element) => {
                // Get the language from data attribute
                const lang = element.getAttribute('data-qd-lang') || '';
                let content = '';
                
                // For syntax-highlighted code, extract the raw text
                if (element.querySelector('code.hljs')) {
                    const code = element.querySelector('code.hljs');
                    content = code.textContent || code.innerText || '';
                }
                // For other code blocks, just get the text content
                else if (element.querySelector('code')) {
                    const codeEl = element.querySelector('code');
                    content = codeEl.textContent || codeEl.innerText || '';
                }
                // Fallback to element text
                else {
                    content = element.textContent || element.innerText || '';
                }
                
                // Return in the format quikdown_bd expects
                return {
                    content: content,
                    lang: lang,
                    fence: '```'
                };
            };
            
            // Return object format for v1.1.0 API with both render and reverse
            return { render, reverse };
        }
        
        /**
         * Render SVG content
         */
        renderSVG(code) {
            try {
                // Basic SVG validation
                const parser = new DOMParser();
                const doc = parser.parseFromString(code, 'image/svg+xml');
                const parseError = doc.querySelector('parsererror');
                
                if (parseError) {
                    throw new Error('Invalid SVG');
                }
                
                // Sanitize SVG by removing script tags and event handlers
                const svg = doc.documentElement;
                svg.querySelectorAll('script').forEach(el => el.remove());
                
                // Remove event handlers
                const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
                let node;
                while ((node = walker.nextNode())) {
                    for (let i = node.attributes.length - 1; i >= 0; i--) {
                        const attr = node.attributes[i];
                        if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                            node.removeAttribute(attr.name);
                        }
                    }
                }
                
                // Create container element programmatically to avoid attribute escaping issues
                const container = document.createElement('div');
                container.className = 'qde-svg-container';
                container.contentEditable = 'false';
                container.setAttribute('data-qd-fence', '```');
                container.setAttribute('data-qd-lang', 'svg');
                container.setAttribute('data-qd-source', code);  // No escaping needed when using setAttribute!
                container.innerHTML = new XMLSerializer().serializeToString(svg);
                
                // Return the HTML string
                return container.outerHTML;
            } catch (err) {
                const errorContainer = document.createElement('pre');
                errorContainer.className = 'qde-error';
                errorContainer.contentEditable = 'false';
                errorContainer.setAttribute('data-qd-fence', '```');
                errorContainer.setAttribute('data-qd-lang', 'svg');
                errorContainer.textContent = `Invalid SVG: ${err.message}`;
                return errorContainer.outerHTML;
            }
        }
        
        /**
         * Render HTML content with DOMPurify if available
         */
        renderHTML(code) {
            const id = `html-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // If DOMPurify is loaded, use it
            if (window.DOMPurify) {
                const clean = DOMPurify.sanitize(code);
                
                // Create container programmatically
                const container = document.createElement('div');
                container.className = 'qde-html-container';
                container.contentEditable = 'false';
                container.setAttribute('data-qd-fence', '```');
                container.setAttribute('data-qd-lang', 'html');
                container.setAttribute('data-qd-source', code);
                container.innerHTML = clean;
                
                return container.outerHTML;
            }
            
            // Try to lazy load DOMPurify
            this.lazyLoadLibrary(
                'DOMPurify',
                () => window.DOMPurify,
                'https://unpkg.com/dompurify/dist/purify.min.js'
            ).then(loaded => {
                if (loaded) {
                    const element = document.getElementById(id);
                    if (element) {
                        const clean = DOMPurify.sanitize(code);
                        element.innerHTML = clean;
                        // Update attributes after loading
                        element.setAttribute('data-qd-source', code);
                        element.setAttribute('data-qd-fence', '```');
                        element.setAttribute('data-qd-lang', 'html');
                    }
                }
            });
            
            // Return placeholder with bidirectional attributes - non-editable
            const placeholder = document.createElement('div');
            placeholder.id = id;
            placeholder.className = 'qde-html-container';
            placeholder.contentEditable = 'false';
            placeholder.setAttribute('data-qd-fence', '```');
            placeholder.setAttribute('data-qd-lang', 'html');
            placeholder.setAttribute('data-qd-source', code);
            const pre = document.createElement('pre');
            pre.textContent = code;
            placeholder.appendChild(pre);
            
            return placeholder.outerHTML;
        }
        
        /**
         * Render math with MathJax (SVG output for better copy support)
         */
        renderMath(code, _lang) {
            const id = `math-${Math.random().toString(36).substring(2, 15)}`;
            
            // Create container exactly like squibview
            const container = document.createElement('div');
            container.id = id;
            container.className = 'math-display';
            container.contentEditable = 'false';
            container.setAttribute('data-source-type', 'math');
            
            // Format content for MathJax (display mode with $$) - exactly like squibview
            const singleLineContent = code.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
            container.textContent = `$$${singleLineContent}$$`;
            
            // Add centering style
            container.style.textAlign = 'center';
            container.style.margin = '1em 0';
            
            
            // Ensure MathJax will be loaded (if not already)
            if (!window.MathJax || !window.MathJax.typesetPromise) {
                this.ensureMathJaxLoaded();
            }
            
            // MathJax will be processed in batch after preview update
            return container.outerHTML;
        }
        
        /**
         * Ensures MathJax is loaded (but doesn't process elements)
         */
        ensureMathJaxLoaded() {
            if (typeof window.MathJax === 'undefined' && !window.mathJaxLoading) {
                window.mathJaxLoading = true;
                
                // Configure MathJax before loading
                if (!window.MathJax) {
                    window.MathJax = {
                        loader: { load: ['input/tex', 'output/svg'] },
                        tex: { 
                            packages: { '[+]': ['ams'] },
                            inlineMath: [['$', '$'], ['\\(', '\\)']],
                            displayMath: [['$$', '$$'], ['\\[', '\\]']],
                            processEscapes: true,
                            processEnvironments: true
                        },
                        options: {
                            renderActions: { addMenu: [] },
                            ignoreHtmlClass: 'tex2jax_ignore',
                            processHtmlClass: 'tex2jax_process'
                        },
                        svg: {
                            fontCache: 'none'  // Important: self-contained SVGs for copy
                        },
                        startup: { typeset: false }
                    };
                }
                
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
                script.async = true;
                script.onload = () => {
                    window.mathJaxLoading = false;
                    
                    // Process any existing math elements (like squibview)
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        const mathElements = document.querySelectorAll('.math-display');
                        if (mathElements.length > 0) {
                            window.MathJax.typesetPromise(Array.from(mathElements)).catch(err => {
                                console.warn('Initial MathJax processing failed:', err);
                            });
                        }
                    }
                };
                script.onerror = () => {
                    window.mathJaxLoading = false;
                    console.error('Failed to load MathJax');
                };
                document.head.appendChild(script);
            }
        }
        
        /**
         * Render CSV/PSV/TSV as HTML table
         */
        renderTable(code, lang) {
            const escapedCode = this.escapeHtml(code);
            try {
                const delimiter = lang === 'csv' ? ',' : lang === 'psv' ? '|' : '\t';
                const lines = code.trim().split('\n');
                
                if (lines.length === 0) {
                    return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}">${escapedCode}</pre>`;
                }
                
                // CSV tables CAN be editable - we'll convert HTML table back to CSV
                // Don't need data-qd-source since we convert the table structure back to CSV
                let html = `<table class="qde-data-table qde-csv-table" data-qd-fence="\`\`\`" data-qd-lang="${lang}">`;
                
                // Parse header
                const header = this.parseCSVLine(lines[0], delimiter);
                html += '<thead><tr>';
                header.forEach(cell => {
                    html += `<th>${this.escapeHtml(cell.trim())}</th>`;
                });
                html += '</tr></thead>';
                
                // Parse body
                if (lines.length > 1) {
                    html += '<tbody>';
                    for (let i = 1; i < lines.length; i++) {
                        const row = this.parseCSVLine(lines[i], delimiter);
                        html += '<tr>';
                        row.forEach(cell => {
                            html += `<td>${this.escapeHtml(cell.trim())}</td>`;
                        });
                        html += '</tr>';
                    }
                    html += '</tbody>';
                }
                
                html += '</table>';
                return html;
            } catch (_err) {
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}">${escapedCode}</pre>`;
            }
        }

        /**
         * Parse CSV line handling quoted values
         */
        parseCSVLine(line, delimiter) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            
            result.push(current);
            return result;
        }
        
        /**
         * Render JSON with syntax highlighting
         */
        renderJSON(code, lang) {
            // If highlight.js is available, use it for all JSON
            if (window.hljs && hljs.getLanguage('json')) {
                try {
                    // Try to format if valid JSON
                    let toHighlight = code;
                    try {
                        const data = JSON.parse(code);
                        toHighlight = JSON.stringify(data, null, 2);
                    } catch (_e) {
                        // Use original if not valid JSON
                    }
                    
                    const highlighted = hljs.highlight(toHighlight, { language: 'json' }).value;
                    return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-json">${highlighted}</code></pre>`;
                } catch (_e) {
                    // Fall through if highlighting fails
                }
            }
            
            // No highlighting available - return plain
            return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}">${this.escapeHtml(code)}</pre>`;
        }
        
        /**
         * Render GeoJSON map
         */
        renderGeoJSON(code) {
            // Generate unique map ID (following SquibView pattern)
            const mapId = `map-${Math.random().toString(36).substr(2, 15)}`;
            
            // Function to render the map
            const renderMap = () => {
                const container = document.getElementById(mapId + '-container');
                if (!container || !window.L) return;
                
                try {
                    const data = JSON.parse(code);
                    
                    // Clear container and set deterministic size for rasterization
                    const mapDiv = document.createElement('div');
                    mapDiv.id = mapId;
                    mapDiv.style.cssText = 'width: 100%; height: 300px;';
                    container.innerHTML = '';
                    container.appendChild(mapDiv);
                    
                    // Create the map
                    const map = L.map(mapId);
                    
                    // Store back-reference for capture (per Gem's guide)
                    container._map = map; // Avoid window pollution
                    
                    // Add tile layer with CORS support
                    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '',
                        crossOrigin: 'anonymous' // Important for canvas capture
                    });
                    tileLayer.addTo(map);
                    
                    // Add GeoJSON layer
                    const geoJsonLayer = L.geoJSON(data);
                    geoJsonLayer.addTo(map);
                    
                    // Fit bounds if valid
                    if (geoJsonLayer.getBounds().isValid()) {
                        map.fitBounds(geoJsonLayer.getBounds());
                    } else {
                        map.setView([0, 0], 2);
                    }
                    
                    // Store references for copy-time capture
                    container._tileLayer = tileLayer;
                    container._geoJsonLayer = geoJsonLayer;
                    
                    // Optional: Wait for tiles to load for better capture
                    tileLayer.on('load', () => {
                        container.setAttribute('data-tiles-loaded', 'true');
                    });
                    
                } catch (err) {
                    container.innerHTML = `<pre class="qde-error">GeoJSON error: ${this.escapeHtml(err.message)}</pre>`;
                }
            };
            
            // Check if Leaflet is already loaded
            if (window.L) {
                // Render after DOM update
                setTimeout(renderMap, 0);
            } else {
                // Lazy load Leaflet only if not already loading
                if (!window._qde_leaflet_loading) {
                    window._qde_leaflet_loading = this.lazyLoadLibrary(
                        'Leaflet',
                        () => window.L,
                        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
                        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                    ).catch(err => {
                        console.warn('Failed to load Leaflet:', err);
                        // Clear the loading promise so it can be retried
                        window._qde_leaflet_loading = null;
                        return false;
                    });
                }
                
                window._qde_leaflet_loading.then(loaded => {
                    if (loaded) {
                        renderMap();
                    } else {
                        const element = document.getElementById(mapId + '-container');
                        if (element) {
                            element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load map library</div>';
                        }
                    }
                }).catch(() => {
                    // Error already handled above
                });
            }
            
            // Return container following SquibView pattern
            const container = document.createElement('div');
            container.className = 'geojson-container';
            container.id = mapId + '-container';
            container.style.cssText = 'width: 100%; height: 300px; border: 1px solid #ddd; border-radius: 4px; margin: 0.5em 0; background: #f0f0f0;';
            container.contentEditable = 'false';
            
            // Preserve source for copy-time identification (per Gem's guide)
            container.setAttribute('data-source-type', 'geojson');
            container.setAttribute('data-original-source', this.escapeHtml(code));
            
            // For bidirectional editing
            container.setAttribute('data-qd-fence', '```');
            container.setAttribute('data-qd-lang', 'geojson');
            container.setAttribute('data-qd-source', code);
            
            container.textContent = 'Loading map...';
            
            return container.outerHTML;
        }
        
        /**
         * Render STL 3D model
         */
        renderSTL(code) {
            const id = `qde-stl-viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Function to render the 3D model (assumes window.THREE is loaded)
            const render3D = () => {
                const element = document.getElementById(id);
                if (!element) return;

                try {
                    const THREE = window.THREE;
                    
                    // Create scene
                    const scene = new THREE.Scene();
                    scene.background = new THREE.Color(0xf0f0f0);
                    
                    // Create camera
                    const camera = new THREE.PerspectiveCamera(75, element.clientWidth / 400, 0.1, 1000);
                    
                    // Create renderer
                    const renderer = new THREE.WebGLRenderer({ antialias: true });
                    renderer.setSize(element.clientWidth, 400);
                    element.innerHTML = '';
                    element.appendChild(renderer.domElement);
                    
                    // Store Three.js references for copy functionality (like squibview)
                    element._threeScene = scene;
                    element._threeCamera = camera;
                    element._threeRenderer = renderer;
                    
                    // Parse STL data (ASCII format)
                    const geometry = this.parseSTL(code);
                    const material = new THREE.MeshLambertMaterial({ color: 0x0066ff });
                    const mesh = new THREE.Mesh(geometry, material);
                    scene.add(mesh);
                    
                    // Add lighting
                    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
                    scene.add(ambientLight);
                    
                    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                    directionalLight.position.set(1, 1, 1).normalize();
                    scene.add(directionalLight);
                    
                    // Position camera based on object bounds
                    const box = new THREE.Box3().setFromObject(mesh);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    
                    camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
                    camera.lookAt(center);
                    
                    // Animate
                    const animate = () => {
                        requestAnimationFrame(animate);
                        mesh.rotation.y += 0.01;
                        renderer.render(scene, camera);
                    };
                    animate();
                } catch (err) {
                    console.error('STL rendering error:', err);
                    element.innerHTML = `<pre class="qde-error">STL error: ${this.escapeHtml(err.message)}</pre>`;
                }
            };
            
            // If Three.js is already loaded, render immediately. Otherwise lazy-load
            // it from a CDN (matches the GeoJSON/Leaflet pattern).
            if (window.THREE) {
                setTimeout(render3D, 0);
            } else {
                if (!window._qde_three_loading) {
                    window._qde_three_loading = this.lazyLoadLibrary(
                        'Three.js',
                        () => window.THREE,
                        'https://unpkg.com/three@0.147.0/build/three.min.js'
                    ).catch(_err => {
                        console.warn('Failed to load Three.js for STL rendering');
                        window._qde_three_loading = null;
                        return false;
                    });
                }
                window._qde_three_loading.then(loaded => {
                    if (loaded) {
                        render3D();
                    } else {
                        const element = document.getElementById(id);
                        if (element) {
                            element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load Three.js for STL rendering</div>';
                        }
                    }
                });
            }

            // Return placeholder with data-stl-id for copy functionality
            return `<div id="${id}" class="qde-stl-container" data-stl-id="${id}" data-qd-fence="\`\`\`" data-qd-lang="stl" data-qd-source="${this.escapeHtml(code)}" contenteditable="false" style="height: 400px; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">Loading 3D model...</div>`;
        }
        
        /**
         * Parse ASCII STL format
         * @param {string} stlData - The STL file content
         * @returns {THREE.BufferGeometry} - The parsed geometry
         */
        parseSTL(stlData) {
            const THREE = window.THREE;
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const normals = [];
            
            const lines = stlData.split('\n');
            let currentNormal = null;
            
            for (let line of lines) {
                line = line.trim();
                
                if (line.startsWith('facet normal')) {
                    const parts = line.split(/\s+/);
                    currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
                } else if (line.startsWith('vertex')) {
                    const parts = line.split(/\s+/);
                    vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                    if (currentNormal) {
                        normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
                    }
                }
            }
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            
            return geometry;
        }
        
        /**
         * Render Mermaid diagram
         */
        renderMermaid(code) {
            const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            setTimeout(() => {
                const element = document.getElementById(id);
                if (element && window.mermaid) {
                    mermaid.render(id + '-svg', code).then(result => {
                        element.innerHTML = result.svg;
                    }).catch(err => {
                        element.innerHTML = `<pre>Error rendering diagram: ${err.message}</pre>`;
                    });
                }
            }, 0);
            
            // Create container programmatically
            const container = document.createElement('div');
            container.id = id;
            container.className = 'mermaid';
            container.contentEditable = 'false';
            container.setAttribute('data-qd-source', code);
            container.setAttribute('data-qd-fence', '```');
            container.setAttribute('data-qd-lang', 'mermaid');
            container.textContent = 'Loading diagram...';
            
            return container.outerHTML;
        }
        
        /**
         * Escape HTML for attributes
         */
        escapeHtml(text) {
            return (text ?? "").replace(/[&"'<>]/g, m => 
                ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[m]));
        }
        
        /**
         * Make complex fence blocks non-editable
         */
        makeFencesNonEditable() {
            if (!this.previewPanel) return;
            
            // Only make specific complex fence types non-editable
            // SVG, HTML, Math, Mermaid already have contenteditable="false" set
            // Syntax-highlighted code also has it set
            
            // Don't make regular code blocks or tables non-editable
            // They can be edited and properly round-trip
        }
        
        /**
         * Load plugins dynamically — honors both `plugins: { highlightjs, mermaid }`
         * (legacy) and the newer `preloadFences` option which can preload any
         * combination of fence libraries (or 'all') at construction time.
         */
        async loadPlugins() {
            const namesToLoad = new Set();

            // Legacy plugins option
            if (this.options.plugins) {
                if (this.options.plugins.highlightjs) namesToLoad.add('highlightjs');
                if (this.options.plugins.mermaid)     namesToLoad.add('mermaid');
            }

            // New preloadFences option
            const pf = this.options.preloadFences;
            if (pf === 'all') {
                Object.keys(FENCE_LIBRARIES).forEach(n => namesToLoad.add(n));
            } else if (Array.isArray(pf)) {
                for (const entry of pf) {
                    if (typeof entry === 'string') {
                        if (FENCE_LIBRARIES[entry]) namesToLoad.add(entry);
                        else console.warn(`QuikdownEditor: unknown preloadFences entry "${entry}"`);
                    } else if (entry && typeof entry === 'object' && entry.script) {
                        // Custom library: { name, script, css? }
                        namesToLoad.add('__custom__:' + (entry.name || entry.script));
                        FENCE_LIBRARIES['__custom__:' + (entry.name || entry.script)] = {
                            check: () => false,
                            script: entry.script,
                            css: entry.css
                        };
                    }
                }
            } else if (pf) {
                console.warn('QuikdownEditor: preloadFences should be "all", an array, or null');
            }

            // Load each in parallel; respect already-loaded state
            const promises = [];
            for (const name of namesToLoad) {
                const lib = FENCE_LIBRARIES[name];
                if (!lib || lib.check()) continue;
                if (lib.beforeLoad) lib.beforeLoad();
                const p = (async () => {
                    try {
                        const tasks = [];
                        if (lib.script) tasks.push(this.loadScript(lib.script));
                        if (lib.css)    tasks.push(this.loadCSS(lib.css, 'qde-hljs-light'));
                        if (lib.cssDark) tasks.push(this.loadCSS(lib.cssDark, 'qde-hljs-dark'));
                        await Promise.all(tasks);
                        if (lib.css && lib.cssDark) this._syncHljsTheme();
                        if (lib.afterLoad) lib.afterLoad();
                    } catch (err) {
                        console.warn(`QuikdownEditor: failed to preload ${name}:`, err);
                    }
                })();
                promises.push(p);
            }

            await Promise.all(promises);
        }
        
        /**
         * Lazy load library if not already loaded
         */
        async lazyLoadLibrary(name, check, scriptUrl, cssUrl = null) {
            // Check if library is already loaded
            if (check()) {
                return true;
            }
            
            try {
                const promises = [];
                
                // Load script
                if (scriptUrl) {
                    promises.push(this.loadScript(scriptUrl));
                }
                
                // Load CSS if provided
                if (cssUrl) {
                    promises.push(this.loadCSS(cssUrl));
                }
                
                await Promise.all(promises);
                
                // Verify library loaded
                return check();
            } catch (err) {
                console.error(`Failed to load ${name}:`, err);
                return false;
            }
        }
        
        /**
         * Load external script
         */
        loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        /**
         * Load external CSS
         */
        loadCSS(href, id) {
            return new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                if (id) link.id = id;
                link.onload = resolve;
                document.head.appendChild(link);
                // Resolve anyway after timeout (CSS doesn't always fire onload)
                setTimeout(resolve, 1000);
            });
        }

        /**
         * Enable the hljs stylesheet matching the current theme and disable
         * the other one. Called from applyTheme and after hljs CSS loads.
         */
        _syncHljsTheme() {
            const isDark = this.container.classList.contains('qde-dark');
            const light = document.getElementById('qde-hljs-light');
            const dark  = document.getElementById('qde-hljs-dark');
            if (light) light.disabled = isDark;
            if (dark)  dark.disabled  = !isDark;
        }

        /**
         * Apply the current theme (based on this.options.theme)
         */
        applyTheme() {
            const theme = this.options.theme;

            // Tear down any previous auto-mode listener so we don't stack them
            if (this._autoThemeListener) {
                window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this._autoThemeListener);
                this._autoThemeListener = null;
            }

            if (theme === 'auto') {
                const mq = window.matchMedia('(prefers-color-scheme: dark)');
                this.container.classList.toggle('qde-dark', mq.matches);
                this._autoThemeListener = (e) => {
                    this.container.classList.toggle('qde-dark', e.matches);
                    this._syncHljsTheme();
                };
                mq.addEventListener('change', this._autoThemeListener);
            } else {
                this.container.classList.toggle('qde-dark', theme === 'dark');
            }
            this._syncHljsTheme();
        }

        /**
         * Set theme at runtime. Accepts 'light', 'dark', or 'auto'.
         * @param {'light'|'dark'|'auto'} theme
         */
        setTheme(theme) {
            if (!['light', 'dark', 'auto'].includes(theme)) return;
            this.options.theme = theme;
            this.applyTheme();
        }

        /**
         * Get the current theme option (as configured, not resolved).
         * @returns {'light'|'dark'|'auto'}
         */
        getTheme() {
            return this.options.theme;
        }
        
        /**
         * Set lazy linefeeds option
         * @param {boolean} enabled - Whether to enable lazy linefeeds
         */
        setLazyLinefeeds(enabled) {
            this.options.lazy_linefeeds = enabled;
            // Re-render if we have content
            if (this._markdown) {
                this.updateFromMarkdown(this._markdown);
            }
        }
        
        /**
         * Get lazy linefeeds option
         * @returns {boolean}
         */
        getLazyLinefeeds() {
            return this.options.lazy_linefeeds;
        }
        
        /**
         * Set debounce delay for input updates
         * @param {number} delay - Delay in milliseconds (0 for instant)
         */
        setDebounceDelay(delay) {
            this.options.debounceDelay = Math.max(0, delay);
        }
        
        /**
         * Get current debounce delay
         * @returns {number} Delay in milliseconds
         */
        getDebounceDelay() {
            return this.options.debounceDelay;
        }
        
        /**
         * Set editor mode
         */
        setMode(mode) {
            if (!['source', 'preview', 'split'].includes(mode)) return;

            // Preserve theme class across mode swap (the assignment to className
            // below would otherwise wipe it out — this used to be a no-op bug
            // where dark mode was lost on every setMode call).
            const wasDark = this.container.classList.contains('qde-dark');

            this.currentMode = mode;
            this.container.className = `qde-container qde-mode-${mode}`;
            if (wasDark) {
                this.container.classList.add('qde-dark');
            }

            // Reset mobile split-toggle button text
            if (this.toolbar) {
                const splitToggle = this.toolbar.querySelector('.qde-split-toggle');
                if (splitToggle) {
                    splitToggle.textContent = 'Preview';
                }
            }

            // Update toolbar buttons
            if (this.toolbar) {
                this.toolbar.querySelectorAll('.qde-btn[data-mode]').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === mode);
                });
            }
            
            // Make fence blocks non-editable when showing preview
            if (mode !== 'source') {
                setTimeout(() => this.makeFencesNonEditable(), 0);
            }
            
            // Trigger mode change event
            if (this.options.onModeChange) {
                this.options.onModeChange(mode);
            }
        }
        
        // --- Undo / Redo ---

        /**
         * Push current markdown state onto the undo stack (called before a change).
         * Only pushes if the new state differs from the current state.
         * @param {string} newMarkdown - the incoming markdown (used to detect no-op)
         * @private
         */
        _pushUndoState(newMarkdown) {
            // Don't push if the content hasn't actually changed
            if (newMarkdown === this._markdown) return;

            this._undoStack.push(this._markdown);

            // Enforce max stack size
            const max = this.options.undoStackSize || 100;
            if (this._undoStack.length > max) {
                this._undoStack.splice(0, this._undoStack.length - max);
            }

            // Any new edit clears the redo stack
            this._redoStack = [];
            this._updateUndoButtons();
        }

        /**
         * Undo the last change. Restores the previous markdown state.
         */
        undo() {
            if (!this.canUndo()) return;
            // Save current state to redo stack
            this._redoStack.push(this._markdown);
            const previous = this._undoStack.pop();
            this._isUndoRedo = true;
            // Update state directly (setMarkdown is async; keep it synchronous here)
            this._markdown = previous;
            if (this.sourceTextarea) {
                this.sourceTextarea.value = previous;
            }
            this.updateFromMarkdown(previous);
            this._updateUndoButtons();
        }

        /**
         * Redo the last undone change.
         */
        redo() {
            if (!this.canRedo()) return;
            // Save current state to undo stack
            this._undoStack.push(this._markdown);
            const next = this._redoStack.pop();
            this._isUndoRedo = true;
            this._markdown = next;
            if (this.sourceTextarea) {
                this.sourceTextarea.value = next;
            }
            this.updateFromMarkdown(next);
            this._updateUndoButtons();
        }

        /**
         * @returns {boolean} true if undo is possible
         */
        canUndo() {
            return this._undoStack.length > 0;
        }

        /**
         * @returns {boolean} true if redo is possible
         */
        canRedo() {
            return this._redoStack.length > 0;
        }

        /**
         * Clear the undo and redo history.
         */
        clearHistory() {
            this._undoStack = [];
            this._redoStack = [];
            this._updateUndoButtons();
        }

        /**
         * Update the disabled state of the undo/redo toolbar buttons.
         * @private
         */
        _updateUndoButtons() {
            if (!this.toolbar) return;
            const undoBtn = this.toolbar.querySelector('[data-action="undo"]');
            const redoBtn = this.toolbar.querySelector('[data-action="redo"]');
            if (undoBtn) {
                undoBtn.classList.toggle('disabled', !this.canUndo());
            }
            if (redoBtn) {
                redoBtn.classList.toggle('disabled', !this.canRedo());
            }
        }

        /**
         * Handle toolbar actions
         */
        handleAction(action) {
            switch(action) {
                case 'copy-markdown':
                    this.copy('markdown');
                    break;
                case 'copy-html':
                    this.copy('html');
                    break;
                case 'copy-rendered':
                    this.copyRendered();
                    break;
                case 'remove-hr':
                    this.removeHR();
                    break;
                case 'lazy-linefeeds':
                    this.convertLazyLinefeeds();
                    break;
                case 'undo':
                    this.undo();
                    break;
                case 'redo':
                    this.redo();
                    break;
            }
        }
        
        /**
         * Copy content to clipboard
         */
        async copy(type) {
            const content = type === 'markdown' ? this._markdown : this._html;
            
            try {
                await navigator.clipboard.writeText(content);
                
                // Visual feedback
                const btn = this.toolbar.querySelector(`[data-action="copy-${type}"]`);
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 1500);
                }
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
        
        // Public API
        
        /**
         * Get current markdown
         */
        get markdown() {
            return this._markdown;
        }
        
        /**
         * Set markdown content
         */
        set markdown(value) {
            this.setMarkdown(value);
        }
        
        /**
         * Get current HTML
         */
        get html() {
            return this._html;
        }
        
        /**
         * Get current mode
         */
        get mode() {
            return this.currentMode;
        }
        
        /**
         * Set markdown content
         */
        async setMarkdown(markdown) {
            // Wait for initialization if needed
            if (this.initPromise) {
                await this.initPromise;
            }
            
            this._markdown = markdown;
            if (this.sourceTextarea) {
                this.sourceTextarea.value = markdown;
            }
            this.updateFromMarkdown(markdown);
        }
        
        /**
         * Get markdown content
         */
        getMarkdown() {
            return this._markdown;
        }
        
        /**
         * Get HTML content
         */
        getHTML() {
            return this._html;
        }
        
        /**
         * Remove all horizontal rules (---) from markdown source.
         * Preserves content inside fences (``` or ~~~) and table separator rows.
         */
        async removeHR() {
            const cleaned = QuikdownEditor.removeHRFromMarkdown(this._markdown);
            await this.setMarkdown(cleaned);

            // Visual feedback if toolbar button exists
            const btn = this.toolbar?.querySelector('[data-action="remove-hr"]');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Removed!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }
        }

        /**
         * Static: remove horizontal rules from markdown string.
         * Safe for fences, tables, and all markdown constructs.
         * Can be used headless without an editor instance.
         * @param {string} markdown - source markdown
         * @returns {string} markdown with standalone HRs removed
         */
        static removeHRFromMarkdown(markdown) {
            const lines = (markdown || '').split('\n');
            const result = [];
            let inFence = false;
            let openChar = null;
            let openLen = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Track fence open/close
                if (!inFence) {
                    const fo = fenceOpen(trimmed);
                    if (fo) {
                        inFence = true;
                        openChar = fo.char;
                        openLen = fo.len;
                        result.push(line);
                        continue;
                    }
                } else {
                    if (isFenceClose(trimmed, openChar, openLen)) {
                        inFence = false;
                        openChar = null;
                        openLen = 0;
                    }
                    result.push(line);
                    continue;
                }

                // Detect table row/separator with pipes — always keep
                if (/^\|.*\|$/.test(trimmed) || (/^[-| :]+$/.test(trimmed) && trimmed.includes('|'))) {
                    result.push(line);
                    continue;
                }

                // Check if this line is a standalone HR (no ReDoS — linear scan)
                if (isHRLine(trimmed)) {
                    // Table separator heuristic: immediately adjacent lines (no blank
                    // lines between) that look like table rows protect this HR-like line
                    const prevLine = i > 0 ? lines[i - 1].trim() : '';
                    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
                    if (looksLikeTableRow(prevLine) || looksLikeTableRow(nextLine)) {
                        result.push(line);
                        continue;
                    }
                    // It's a real HR — skip it
                    continue;
                }

                result.push(line);
            }

            return result.join('\n');
        }

        /**
         * Convert lazy linefeeds in markdown source.
         * Replaces single newlines with double newlines (adds real line breaks)
         * except inside fences, tables, and other block-level constructs.
         * Idempotent: calling multiple times produces the same result.
         * Can be used as a toolbar action or headless via the static method.
         */
        async convertLazyLinefeeds() {
            const converted = QuikdownEditor.convertLazyLinefeeds(this._markdown);
            await this.setMarkdown(converted);

            // Visual feedback if toolbar button exists
            const btn = this.toolbar?.querySelector('[data-action="lazy-linefeeds"]');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Converted!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }
        }

        /**
         * Static: convert lazy linefeeds in markdown source.
         * Turns single \n between non-blank lines into \n\n so each line becomes
         * its own paragraph / hard break. Idempotent — already-doubled newlines
         * are not doubled again. Fences, tables, lists, blockquotes, headings,
         * and HTML blocks are left untouched.
         * @param {string} markdown - source markdown
         * @returns {string} markdown with lazy linefeeds resolved
         */
        static convertLazyLinefeeds(markdown) {
            // Two-phase approach (much cleaner than the old single pass):
            //
            //   Phase A: walk lines, classify each as { content, blank, fence }.
            //            Inside fences, lines are passed through verbatim.
            //   Phase B: emit lines with the rule:
            //            "between two adjacent CONTENT lines, ensure exactly one
            //             blank line — never zero, never more than one."
            //
            // The rule applies regardless of whether the content lines are
            // headings, lists, blockquotes, table rows, paragraphs, or HR — any
            // adjacent pair of non-fence non-blank lines gets exactly one blank
            // between them. This produces the cleanest possible output for any
            // input and is fully idempotent.
            //
            // Lines that are whitespace-only (e.g. "   ") are normalized to
            // empty strings, eliminating "phantom" blank lines.
            //
            // Lists are a special case: adjacent list items (same marker type)
            // should NOT get a blank line between them, otherwise we'd break
            // tight lists.
            //
            // Same applies to blockquote lines and table rows — adjacent rows
            // belong to the same block.

            const inputLines = (markdown || '').split('\n');

            // -------- Phase A: classify lines, normalize whitespace-only --------
            // Each entry: { line, kind } where kind is one of:
            //   'fence-open', 'fence-close', 'fence-body', 'blank', 'content'
            // Plus a 'category' for content lines: 'list-ul', 'list-ol',
            //   'blockquote', 'table', 'heading', 'hr', 'paragraph'
            const items = [];
            let inFence = false;
            let openChar = null;
            let openLen = 0;

            for (const rawLine of inputLines) {
                const line = rawLine;
                const trimmed = line.trim();

                // Fence tracking via shared utilities
                if (!inFence) {
                    const fo = fenceOpen(trimmed);
                    if (fo) {
                        inFence = true;
                        openChar = fo.char;
                        openLen  = fo.len;
                        items.push({ line, kind: 'fence-open' });
                        continue;
                    }
                } else {
                    if (isFenceClose(trimmed, openChar, openLen)) {
                        inFence = false;
                        openChar = null;
                        openLen = 0;
                        items.push({ line, kind: 'fence-close' });
                    } else {
                        items.push({ line, kind: 'fence-body' });
                    }
                    continue;
                }

                // Outside fence: whitespace-only lines become canonical blanks
                if (trimmed === '') {
                    items.push({ line: '', kind: 'blank' });
                    continue;
                }

                // Categorize content lines (no ReDoS — classifyLine uses linear scan for HR)
                let category = classifyLine(trimmed);
                // Indented continuation of a list (2+ leading spaces or tab)
                if (category === 'paragraph' && /^(?: {4}|\t| {2,}[-*+]| {2,}\d+\.)/.test(line)) {
                    category = 'list-cont';
                }

                items.push({ line, kind: 'content', category });
            }

            // -------- Phase B: emit with exactly-one-blank-line normalization --------
            // Same-block adjacent lines (lists, blockquotes, tables) stay
            // touching; any other adjacent content pair gets exactly one blank.
            const result = [];
            let prev = null;   // last emitted non-blank content item

            function inSameBlock(a, b) {
                if (!a || !b) return false;
                // Lists: same marker family OR list-content continuation
                if ((a.category === 'list-ul' || a.category === 'list-ol' || a.category === 'list-cont') &&
                    (b.category === 'list-ul' || b.category === 'list-ol' || b.category === 'list-cont')) {
                    return true;
                }
                // Blockquotes
                if (a.category === 'blockquote' && b.category === 'blockquote') return true;
                // Table rows
                if (a.category === 'table' && b.category === 'table') return true;
                return false;
            }

            for (const item of items) {
                if (item.kind === 'fence-open' || item.kind === 'fence-body' || item.kind === 'fence-close') {
                    // Fences: ensure exactly one blank line before the fence-open
                    if (item.kind === 'fence-open' && prev && result.length > 0 && result[result.length - 1] !== '') {
                        result.push('');
                    }
                    result.push(item.line);
                    if (item.kind === 'fence-close') prev = { kind: 'content', category: 'fence' };
                    continue;
                }

                if (item.kind === 'blank') {
                    // Skip — Phase B inserts its own blank lines as needed
                    continue;
                }

                // item.kind === 'content'
                if (prev) {
                    if (inSameBlock(prev, item)) ; else {
                        // Different blocks (or paragraphs): exactly one blank
                        if (result[result.length - 1] !== '') result.push('');
                    }
                }
                result.push(item.line);
                prev = item;
            }

            // Trim trailing blank lines so output has exactly one terminal newline
            while (result.length > 0 && result[result.length - 1] === '') result.pop();

            return result.join('\n');
        }
        
        /**
         * Copy rendered content as rich text
         */
        async copyRendered() {
            try {
                const result = await getRenderedContent(this.previewPanel);
                if (result.success) {
                    // Visual feedback
                    const btn = this.toolbar?.querySelector('[data-action="copy-rendered"]');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = 'Copied!';
                        setTimeout(() => {
                            btn.textContent = originalText;
                        }, 1500);
                    }
                }
            } catch (err) {
                console.error('Failed to copy rendered content:', err);
            }
        }
        
        /**
         * Destroy the editor
         */
        destroy() {
            // Clear timers
            clearTimeout(this.updateTimer);
            
            // Clear container
            this.container.innerHTML = '';
            this.container.classList.remove('qde-container', 'qde-dark');
            
            // Remove injected styles (only if no other editors exist)
            const otherEditors = document.querySelectorAll('.qde-container');
            if (otherEditors.length === 0) {
                const style = document.getElementById('qde-styles');
                if (style) style.remove();
            }
        }
    }

    // Export for CommonJS (needed for bundled ESM to work with Jest)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QuikdownEditor;
    }

    // Also export for UMD builds
    if (typeof window !== 'undefined') {
        window.QuikdownEditor = QuikdownEditor;
    }

    return QuikdownEditor;

}));
