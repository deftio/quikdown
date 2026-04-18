/**
 * quikdown_bd - Bidirectional Markdown Parser
 * @version 1.2.10
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
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
const quikdownVersion = '1.2.10';

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
    //
    // Uses a character-walking scanner so that URL content (href, src)
    // is emitted verbatim — emphasis markers inside URLs are never
    // interpreted.  Link *text* is recursively scanned (emphasis in
    // link text is valid markdown).
    html = scanInline(html, getAttr, dataQd, sanitizeUrl, {
        bidirectional,
        allow_unsafe_urls: options.allow_unsafe_urls,
        escapeHtml
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
//  Inline scanner (character-walking)
// ════════════════════════════════════════════════════════════════════

/**
 * Character-walking inline formatter.  Processes images, links, autolinks,
 * bold, strikethrough, and italic in priority order.  URL content is emitted
 * verbatim — emphasis markers inside URLs are never interpreted (fixes #3).
 *
 * @param {string}   t           Input (HTML-escaped, blocks already rendered)
 * @param {Function} getAttr     Attribute factory (class or style)
 * @param {Function} dataQd      Bidirectional marker factory
 * @param {Function} sanitizeUrl URL sanitizer
 * @param {Object}   opts        { bidirectional, allow_unsafe_urls, escapeHtml }
 * @returns {string}
 */
function scanInline(t, getAttr, dataQd, sanitizeUrl, opts) {
    const { bidirectional, allow_unsafe_urls, escapeHtml } = opts;
    let out = '', i = 0, j, end, start, close, pos, inner,
        lineEnd, searchEnd, runEnd, sanitized, delim, delimC, tag, qd;

    while (i < t.length) {
        const c = t[i];

        // 1. Image: ![alt](src)
        if (c === '!' && t[i + 1] === '[') {
            j = t.indexOf(']', i + 2);
            if (j !== -1 && t[j + 1] === '(') {
                end = t.indexOf(')', j + 2);
                if (end !== -1 && end > j + 2) {
                    const alt = t.slice(i + 2, j), src = t.slice(j + 2, end);
                    sanitized = sanitizeUrl(src, allow_unsafe_urls);
                    /* istanbul ignore next -- bd-only */
                    out += `<img${getAttr('img')} src="${sanitized}" alt="${alt}"`
                        + (bidirectional && alt ? ` data-qd-alt="${escapeHtml(alt)}"` : '')
                        + (bidirectional ? ` data-qd-src="${escapeHtml(src)}"` : '')
                        + `${dataQd('!')}>`;
                    i = end + 1; continue;
                }
            }
        }

        // 2. Link: [text](href)
        if (c === '[') {
            j = t.indexOf(']', i + 1);
            if (j !== -1 && (t.indexOf('[', i + 1) === -1 || t.indexOf('[', i + 1) >= j)
                && t[j + 1] === '(') {
                end = t.indexOf(')', j + 2);
                if (end !== -1) {
                    const lt = t.slice(i + 1, j), href = t.slice(j + 2, end);
                    if (lt && href) {
                        sanitized = sanitizeUrl(href, allow_unsafe_urls);
                        const ext = /^https?:\/\//i.test(sanitized);
                        /* istanbul ignore next -- bd-only */
                        out += `<a${getAttr('a')} href="${sanitized}"`
                            + (ext ? ' rel="noopener noreferrer"' : '')
                            + (bidirectional ? ` data-qd-text="${escapeHtml(lt)}"` : '')
                            + `${dataQd('[')}>` + scanInline(lt, getAttr, dataQd, sanitizeUrl, opts) + '</a>';
                        i = end + 1; continue;
                    }
                }
            }
        }

        // 3. Autolink: http(s)://…
        if (c === 'h' && t[i + 1] === 't' && t[i + 2] === 't' && t[i + 3] === 'p'
            && (i === 0 || /\s/.test(t[i - 1]))) {
            const isS = t[i + 4] === 's', cp = isS ? i + 5 : i + 4;
            if (t[cp] === ':' && t[cp + 1] === '/' && t[cp + 2] === '/') {
                end = cp + 3;
                while (end < t.length && !/[\s<]/.test(t[end])) end++;
                const url = t.slice(i, end);
                sanitized = sanitizeUrl(url, allow_unsafe_urls);
                out += `<a${getAttr('a')} href="${sanitized}" rel="noopener noreferrer">${url}</a>`;
                i = end; continue;
            }
        }

        // 4. Two-char delimiters: ** __ ~~
        delim = null;
        if      (c === '*' && t[i + 1] === '*') { delim = '**'; delimC = '*'; tag = 'strong'; qd = '**'; }
        else if (c === '_' && t[i + 1] === '_') { delim = '__'; delimC = '_'; tag = 'strong'; qd = '__'; }
        else if (c === '~' && t[i + 1] === '~') { delim = '~~'; delimC = '~'; tag = 'del';    qd = '~~'; }
        if (delim) {
            start = i + 2;
            lineEnd = t.indexOf('\n', start);
            searchEnd = lineEnd === -1 ? t.length : lineEnd;
            inner = null;
            for (pos = start; pos < searchEnd;) {
                close = t.indexOf(delim, pos);
                if (close === -1 || close >= searchEnd) break;
                if (delimC !== '~') {
                    runEnd = close + 2;
                    while (runEnd < searchEnd && t[runEnd] === delimC) runEnd++;
                    inner = t.slice(start, runEnd - 2);
                    if (!inner) { pos = close + 1; inner = null; continue; }
                    end = runEnd;
                } else {
                    inner = t.slice(start, close);
                    if (!inner) { pos = close + 1; inner = null; continue; }
                    end = close + 2;
                }
                break;
            }
            if (inner) {
                out += `<${tag}${getAttr(tag)}${dataQd(qd)}>`
                    + scanInline(inner, getAttr, dataQd, sanitizeUrl, opts) + `</${tag}>`;
                i = end; continue;
            }
        }

        // 5. Single emphasis: * or _
        if ((c === '*' && t[i + 1] !== '*' && (i === 0 || t[i - 1] !== '*'))
         || (c === '_' && t[i + 1] !== '_' && (i === 0 || t[i - 1] !== '_'))) {
            inner = null;
            for (j = i + 1; j < t.length; j++) {
                if (t[j] === '\n') break;
                if (t[j] === c && t[j - 1] !== c && t[j + 1] !== c) {
                    inner = t.slice(i + 1, j);
                    /* istanbul ignore next -- guards above prevent empty inner */
                    if (inner) { end = j + 1; break; }
                }
            }
            if (inner) {
                out += `<em${getAttr('em')}${dataQd(c)}>`
                    + scanInline(inner, getAttr, dataQd, sanitizeUrl, opts) + '</em>';
                i = end; continue;
            }
        }

        // 6. Plain text — advance to next potential marker
        for (j = i + 1; j < t.length; j++) {
            const ch = t[j];
            if (ch === '!' || ch === '[' || ch === '*' || ch === '_' || ch === '~') break;
            if (ch === 'h' && t[j + 1] === 't' && t[j + 2] === 't' && t[j + 3] === 'p') break;
        }
        out += t.slice(i, j);
        i = j;
    }

    return out;
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

export { quikdown_bd as default };
