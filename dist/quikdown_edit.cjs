/**
 * Quikdown Editor - Drop-in Markdown Parser
 * @version 1.3.1
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
'use strict';

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
 *   │  Phase 1 — Code + Escape Extraction                     │
 *   │  1a. Fenced code blocks (``` / ~~~) → §CB§ placeholders│
 *   │  1b. Escaped backticks (\`) → §BE§ placeholders        │
 *   │  1c. Inline code spans (`…`) → §IC§ placeholders       │
 *   │      Cannot cross newlines (scoped to single line).     │
 *   │  1d. Remaining backslash escapes (\* \_ etc.) → §BE§   │
 *   │      Only ASCII punctuation is escapable; \a stays.     │
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
const quikdownVersion = '1.3.1';

/** CSS class prefix used for all generated elements */
const CLASS_PREFIX = 'quikdown-';

/** Placeholder sigils — chosen to be extremely unlikely in real text */
const PLACEHOLDER_CB = '§CB';   // fenced code blocks
const PLACEHOLDER_IC = '§IC';   // inline code spans
const PLACEHOLDER_HT = '§HT';  // safe HTML tags (limited mode)
const PLACEHOLDER_BE = '§BE';  // backslash escapes
const PLACEHOLDER_NL = '§NL§'; // newlines inside indented code (restored in Phase 4)

/** Attributes whose values need URL sanitization */
const URL_ATTRIBUTES = { href:1, src:1, action:1, formaction:1 };

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
    h1: 'font-size:2em;margin:.67em 0;text-align:left',
    h2: 'font-size:1.5em;margin:.83em 0',
    h3: 'font-size:1.25em;margin:1em 0',
    h4: 'font-size:1em;margin:1.33em 0',
    h5: 'font-size:.875em;margin:1.67em 0',
    h6: 'font-size:.85em;margin:2em 0',
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
    'task-checkbox': 'margin-right:.5em',
    'alert': 'padding:1em;margin:1em 0;border-left:4px solid #0969da;border-radius:4px;background:#ddf4ff',
    'alert-title': 'font-weight:600;margin:0 0 .4em',
    'alert-note': 'border-left-color:#0969da;background:#ddf4ff',
    'alert-tip': 'border-left-color:#1a7f37;background:#dafbe1',
    'alert-important': 'border-left-color:#8250df;background:#fbefff',
    'alert-warning': 'border-left-color:#9a6700;background:#fff8c5',
    'alert-caution': 'border-left-color:#cf222e;background:#ffebe9',
    sup: 'font-size:.75em;vertical-align:super;line-height:0',
    'footnotes': 'margin-top:2em;font-size:.9em',
    'footnote-backref': 'text-decoration:none;margin-left:.25em'
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

// ────────────────────────────────────────────────────────────────────
//  Link destination + heading slug + blockquote helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Parse a markdown link/image destination: url with optional "title" or 'title'.
 * Supports angle-bracket form: <url>
 * @returns {{ url: string, title: string|null }}
 */
function parseLinkDestination(raw) {
    if (raw === undefined || raw === null || raw === '') return { url: '', title: null };

    const dblQuote = raw.match(/^(.*)\s+(?:"([^"]*)"|&quot;([^&]*?)&quot;)\s*$/);
    if (dblQuote) {
        return { url: dblQuote[1].replace(/\s+$/, ''), title: dblQuote[2] ?? dblQuote[3] };
    }

    const sglQuote = raw.match(/^(.*)\s+(?:'([^']*)'|&#39;([^&]*?)&#39;)\s*$/);
    if (sglQuote) {
        return { url: sglQuote[1].replace(/\s+$/, ''), title: sglQuote[2] ?? sglQuote[3] };
    }

    if (raw.startsWith('&lt;') && raw.endsWith('&gt;')) {
        return { url: raw.slice(4, -4), title: null };
    }

    return { url: raw, title: null };
}

/** Build a URL-safe slug from heading text (inline markdown stripped). */
function headingSlug(text) {
    return text
        .replace(/[*_`~]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';
}

/** Return a unique slug, suffixing -1, -2, … on duplicates. */
function uniqueSlug(base, counts) {
    const n = counts.get(base) || 0;
    counts.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
}

/**
 * Strip trailing punctuation from an autolinked URL.
 * Handles balanced parentheses (e.g. Wikipedia URLs).
 * @param {string} url  The matched URL text
 * @returns {{ url: string, trailing: string }}
 */
function stripTrailingPunctuation(url) {
    let trailing = '';
    const punct = /[.,;:!?)]/;
    while (url.length > 0 && punct.test(url[url.length - 1])) {
        const ch = url[url.length - 1];
        if (ch === ')') {
            const opens = (url.match(/\(/g) || []).length;
            const closes = (url.match(/\)/g) || []).length;
            if (opens >= closes) break; // balanced — ) is part of URL
        }
        trailing = ch + trailing;
        url = url.slice(0, -1);
    }
    return { url, trailing };
}

/**
 * Count leading blockquote depth on an HTML-escaped line (&gt; markers).
 * @returns {{ depth: number, content: string }}
 */
function parseBlockquoteLine(line) {
    let depth = 0;
    let pos = 0;
    while (pos < line.length && line.startsWith('&gt;', pos)) {
        pos += 4;
        depth++;
        if (line[pos] === ' ') pos++;
    }
    return { depth, content: line.slice(pos) };
}

/**
 * Check if a line breaks lazy blockquote continuation.
 * @param {string} line  HTML-escaped line text
 * @returns {boolean}
 */
function isLazyContinuationBreaker(line) {
    const trimmed = line.trim();
    if (trimmed === '') return true;                          // blank line
    if (/^#{1,6}\s/.test(trimmed)) return true;              // heading
    if (isHRLine(trimmed)) return true;                       // HR
    /* istanbul ignore next -- defensive: &gt; lines are caught by parseBlockquoteLine first */
    if (/^&gt;/.test(trimmed)) return true;                   // new blockquote
    if (/^[-*+]\s/.test(trimmed)) return true;               // unordered list
    if (/^\d+\.\s/.test(trimmed)) return true;               // ordered list
    if (trimmed.startsWith('|')) return true;                  // table row
    if (trimmed.startsWith(PLACEHOLDER_CB)) return true;      // code block placeholder
    return false;
}

/**
 * Base inline formatting patterns shared between the main pass and
 * footnotes rendering.  Defined once at module level to avoid
 * recreating regex objects on every call.
 */
const BASE_INLINE_PATTERNS = [
    [/\*\*(.+?)\*\*/g, 'strong'],
    [/__(.+?)__/g, 'strong'],
    [/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, 'em'],
    [/(?<![A-Za-z0-9_])_(?![_\s])(.+?)(?<![\s_])_(?![A-Za-z0-9_])/g, 'em'],
    [/~~(.+?)~~/g, 'del'],
    [/`([^`\n]+)`/g, 'code']
];

/** GFM alert type labels */
const ALERT_LABELS = {
    NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important',
    WARNING: 'Warning', CAUTION: 'Caution'
};

/** Render nested blockquotes from a run of parsed lines. */
function renderNestedBlockquotes(items, getAttr, dataQd) {
    // ── GFM alert detection ──
    // Check if the first item's content matches [!TYPE]
    /* istanbul ignore next -- depth is always 1 for outermost blockquote */
    const alertMatch = items.length > 0 && items[0].depth === 1
        ? items[0].content.trim().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i)
        : null;

    let html = '';
    const stack = [];
    const useInlineStyles = getAttr('blockquote').includes('style=');

    for (let idx = 0; idx < items.length; idx++) {
        const { depth, content } = items[idx];
        /* istanbul ignore next -- depth is always >= 1 from parseBlockquoteLine gate */
        if (depth <= 0) continue;

        // Skip the [!TYPE] marker line — we'll render it as a title
        if (alertMatch && idx === 0) {
            const alertType = alertMatch[1].toUpperCase();
            const typeLower = alertType.toLowerCase();
            if (useInlineStyles) {
                const baseStyle = QUIKDOWN_STYLES['alert'];
                const typeStyle = QUIKDOWN_STYLES['alert-' + typeLower];
                /* istanbul ignore next -- typeStyle is always defined for valid alert types */
                const merged = typeStyle ? `${baseStyle};${typeStyle}` : baseStyle;
                html += `<div style="${merged}"${dataQd('>')}>`;
            } else {
                html += `<div class="${CLASS_PREFIX}alert ${CLASS_PREFIX}alert-${typeLower}"${dataQd('>')}>`;
            }
            // Title
            const label = ALERT_LABELS[alertType];
            if (useInlineStyles) {
                html += `<p style="${QUIKDOWN_STYLES['alert-title']}">${label}</p>`;
            } else {
                html += `<p class="${CLASS_PREFIX}alert-title">${label}</p>`;
            }
            stack.push('alert');
            continue;
        }

        while (stack.length > depth) {
            const tag = stack.pop();
            /* istanbul ignore next -- alert closing uses </div>, blockquote uses </blockquote> */
            html += tag === 'alert' ? '</div>' : '</blockquote>';
        }
        while (stack.length < depth) {
            /* istanbul ignore next -- defensive: alert div already opened at depth 0 */
            if (stack.length === 0 && alertMatch) {
                stack.push('alert');
            } else {
                html += `<blockquote${getAttr('blockquote')}${dataQd('>')}>`;
                stack.push('blockquote');
            }
        }
        html += content;
        if (idx < items.length - 1) html += '\n';
    }

    while (stack.length > 0) {
        const tag = stack.pop();
        html += tag === 'alert' ? '</div>' : '</blockquote>';
    }

    return html.trimEnd();
}

/** True when a line is part of a 4-space (or tab) indented code block. */
function isIndentedCodeLine(line) {
    if (line.length === 0) return false;
    const m = line.match(/^([ \t]+)(.*)$/);
    if (!m) return false;
    const spaceEquiv = m[1].replace(/\t/g, '    ').length;
    if (spaceEquiv < 4) return false;
    const content = m[2];
    if (/^[-*+]\s/.test(content) || /^\d+\.\s/.test(content) || /^>/.test(content) || /^#{1,6}\s/.test(content)) {
        return false;
    }
    return true;
}

/** Strip one indent level (4 spaces or one tab) from a code line. */
function stripCodeIndent(line) {
    if (line.startsWith('    ')) return line.slice(4);
    if (line[0] === '\t') return line.slice(1);
    const m = line.match(/^[ \t]+(.*)$/);
    /* istanbul ignore next -- isIndentedCodeLine guarantees leading whitespace */
    return m ? m[1] : line;
}

/** List item: optional indent, a bullet or ordinal marker, whitespace, content. */
const LIST_ITEM_RE = /^(\s*)([*\-+]|\d+\.)\s+(.+)$/;

/**
 * True when an indented, non-blank line is wrapped text belonging to the
 * list item above it (issue #36).  Lines that start a block construct of
 * their own (fence, blockquote, table row, heading, HR, or already-rendered
 * HTML) are excluded so they keep their existing rendering.
 */
function isListContinuation(line) {
    const m = line.match(/^[ \t]+(\S.*)$/);
    if (!m) return false;
    const t = m[1];
    if (/^(```|~~~|>|&gt;|\||#{1,6}(\s|$)|<)/.test(t)) return false;
    if (/^([-*_])\1{2,}\s*$/.test(t)) return false;
    return true;
}

/**
 * processIndentedCodeBlocks — line walker for 4-space / tab indented code
 *
 * An indented line directly under a list item (or under another
 * continuation line of that item) is wrapped item text, not code, so it
 * is passed through untouched for processLists to fold.  A blank line
 * ends the item, so `- item\n\n    code` still produces a code block.
 */
function processIndentedCodeBlocks(text, getAttr, dataQd) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;
    let inListItem = false;

    while (i < lines.length) {
        const line = lines[i];
        if (LIST_ITEM_RE.test(line)) {
            inListItem = true;
            result.push(line);
            i++;
            continue;
        }
        if (inListItem) {
            if (isListContinuation(line)) {
                result.push(line);
                i++;
                continue;
            }
            inListItem = false;
        }
        if (!isIndentedCodeLine(line)) {
            result.push(line);
            i++;
            continue;
        }

        const codeLines = [];
        while (i < lines.length) {
            const line = lines[i];
            if (line === '') {
                if (i + 1 < lines.length && isIndentedCodeLine(lines[i + 1])) {
                    codeLines.push('');
                    i++;
                    continue;
                }
                break;
            }
            if (isIndentedCodeLine(line)) {
                codeLines.push(stripCodeIndent(line));
                i++;
            } else {
                break;
            }
        }

        // Join with a placeholder so the paragraph / line-break pass cannot
        // turn blank lines into </p><p> or newlines into <br> inside <pre>.
        const codeBody = codeLines.join(PLACEHOLDER_NL);
        result.push(`<pre${getAttr('pre')}${dataQd('    ')}><code${getAttr('code')}>${codeBody}</code></pre>`);
    }

    return result.join('\n');
}

/** Split a table row into cell strings. */
function parseTableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
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
    const { fence_plugin, inline_styles = false, bidirectional = false, lazy_linefeeds = false, allow_unsafe_html = false, heading_ids = false, reference_links = false, footnotes = false } = options;
    const styles = QUIKDOWN_STYLES;
    const getAttr = createGetAttr(inline_styles, styles);
    const headingSlugCounts = new Map();

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

    /**
     * Sanitize attributes on an HTML tag string for limited mode.
     * Strips on* event handlers (case-insensitive) and runs sanitizeUrl()
     * on href/src/action/formaction values.
     */
    function sanitizeHtmlTagAttrs(tagStr) {
        // Self-closing or void tag without attributes — pass through
        if (!/\s/.test(tagStr.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*/, '').replace(/\/?>$/, ''))) {
            return tagStr;
        }
        // Parse: <tagname ...attrs... > or <tagname ...attrs... />
        const m = tagStr.match(/^(<\/?[a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)(\/?>)$/);
        /* istanbul ignore next - defensive: Phase 1.5 regex guarantees valid tag shape */
        if (!m) return tagStr;

        const [, open, attrStr, close] = m;
        // Match individual attributes: name="value", name='value', name=value, or bare name
        // eslint-disable-next-line security/detect-unsafe-regex -- linear: no nested quantifiers
        const attrRe = /([a-zA-Z_][\w\-.:]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
        const attrs = [];
        let am;
        while ((am = attrRe.exec(attrStr)) !== null) {
            const name = am[1];
            const value = am[2] !== undefined ? am[2] : am[3] !== undefined ? am[3] : am[4];
            // Strip event handlers (on*)
            if (/^on/i.test(name)) continue;
            if (value === undefined) {
                // Boolean attribute (e.g. disabled, checked)
                attrs.push(name);
            } else {
                let sanitized = value;
                if (name.toLowerCase() in URL_ATTRIBUTES) {
                    sanitized = sanitizeUrl(value);
                }
                attrs.push(`${name}="${sanitized}"`);
            }
        }
        return open + (attrs.length ? ' ' + attrs.join(' ') : '') + close;
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

    // ── Escaped backticks ──
    // Extract \` before inline code extraction so an escaped backtick
    // does not participate in code span pairing.
    const backslashEscapes = [];
    html = html.replace(/\\`/g, () => {
        const placeholder = `${PLACEHOLDER_BE}${backslashEscapes.length}§`;
        backslashEscapes.push('`');
        return placeholder;
    });

    // ── Inline code spans ──
    // Matches a single backtick pair: `content`.
    // Content is captured and HTML-escaped immediately.
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
        const placeholder = `${PLACEHOLDER_IC}${inlineCodes.length}§`;
        inlineCodes.push(escapeHtml(code));
        return placeholder;
    });

    // ────────────────────────────────────────────────────────────────
    //  Phase 1.25 — Backslash Escape Extraction
    // ────────────────────────────────────────────────────────────────
    // Extract remaining backslash-escaped ASCII punctuation so those
    // characters are not interpreted as markdown formatting.  Runs
    // after code extraction (so \* inside code blocks and inline code
    // is already protected) and before HTML escaping.

    html = html.replace(/\\([\\*_{}[\]()#+\-.!~|<>])/g, (match, char) => {
        const placeholder = `${PLACEHOLDER_BE}${backslashEscapes.length}§`;
        backslashEscapes.push(escapeHtml(char));
        return placeholder;
    });

    // ────────────────────────────────────────────────────────────────
    //  Phase 1.75 — Reference Link & Footnote Definition Collection
    // ────────────────────────────────────────────────────────────────
    // Scan lines BEFORE HTML escaping to collect definitions.
    // [id]: url "title"   — reference link definition
    // [^id]: text         — footnote definition (with indented continuation)
    // Characters [, ], :, ^ are NOT in the HTML escape map so they
    // survive all phases unchanged.  Definition lines are stripped.

    const refDefs = new Map();     // id (lowercase) → { url, title }
    const fnDefs = new Map();      // id → text
    const fnOrder = [];            // ordered list of footnote ids as referenced

    if (reference_links || footnotes) {
        const lines = html.split('\n');
        const kept = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // Skip lines inside code block placeholders
            if (line.includes(PLACEHOLDER_CB)) {
                kept.push(line);
                i++;
                continue;
            }

            // Footnote definition: [^id]: text
            if (footnotes) {
                const fnMatch = line.match(/^\[\^([^\]]+)\]:\s+([\s\S]*)$/);
                if (fnMatch) {
                    const fnId = fnMatch[1];
                    let fnText = fnMatch[2];
                    // Collect indented continuation lines
                    while (i + 1 < lines.length) {
                        const next = lines[i + 1];
                        if (/^[ \t]+\S/.test(next) && !next.includes(PLACEHOLDER_CB)) {
                            fnText += ' ' + next.trim();
                            i++;
                        } else {
                            break;
                        }
                    }
                    // First definition wins
                    const key = fnId;
                    if (!fnDefs.has(key)) {
                        fnDefs.set(key, fnText);
                    }
                    i++;
                    continue;
                }
            }

            // Reference link definition: [id]: url "title"
            if (reference_links) {
                // eslint-disable-next-line security/detect-unsafe-regex -- linear: no nested quantifiers on same path
                const refMatch = line.match(/^\[([^\]]+)\]:\s+<?([^\s>]+)>?(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/);
                if (refMatch) {
                    const refId = refMatch[1].toLowerCase();
                    const url = refMatch[2];
                    const title = refMatch[3] !== undefined ? refMatch[3]
                        : refMatch[4] !== undefined ? refMatch[4]
                        : refMatch[5] !== undefined ? refMatch[5]
                        : null;
                    // First definition wins
                    if (!refDefs.has(refId)) {
                        refDefs.set(refId, { url, title });
                    }
                    i++;
                    continue;
                }
            }

            kept.push(line);
            i++;
        }
        html = kept.join('\n');
    }

    // ────────────────────────────────────────────────────────────────
    //  Phase 1.5 — Safe HTML Extraction (whitelist mode)
    // ────────────────────────────────────────────────────────────────
    // When allow_unsafe_html is an object or array, extract whitelisted
    // HTML tags, sanitize their attributes, and replace with placeholders.
    // Non-whitelisted tags stay in text so Phase 2 will escape them.

    const safeTags = [];
    // Normalize: array → object for O(1) lookup; object used as-is
    const htmlAllow = Array.isArray(allow_unsafe_html)
        ? Object.fromEntries(allow_unsafe_html.map(t => [t, 1]))
        : (allow_unsafe_html && typeof allow_unsafe_html === 'object') ? allow_unsafe_html : null;

    if (htmlAllow) {
        // Pass through HTML comments — browsers render them as nothing
        html = html.replace(/<!--[\s\S]*?-->/g, (match) => {
            const idx = safeTags.length;
            safeTags.push(match);
            return `${PLACEHOLDER_HT}${idx}§`;
        });
        html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName) => {
            if (tagName.toLowerCase() in htmlAllow) {
                const sanitized = sanitizeHtmlTagAttrs(match);
                const idx = safeTags.length;
                safeTags.push(sanitized);
                return `${PLACEHOLDER_HT}${idx}§`;
            }
            // Not whitelisted — leave in text for Phase 2 to escape
            return match;
        });
    }

    // ────────────────────────────────────────────────────────────────
    //  Phase 2 — HTML Escaping
    // ────────────────────────────────────────────────────────────────
    // All remaining text (everything except code placeholders) is escaped
    // to prevent XSS.  The `allow_unsafe_html` option skips this for
    // trusted pipelines that intentionally embed raw HTML.
    // For whitelist mode, escaping still runs (only `true` bypasses it).

    if (allow_unsafe_html !== true) {
        html = escapeHtml(html);
    }

    // Restore safe HTML tag placeholders after escaping
    if (htmlAllow) {
        safeTags.forEach((tag, i) => {
            html = html.replace(`${PLACEHOLDER_HT}${i}§`, () => tag);
        });
    }

    // ────────────────────────────────────────────────────────────────
    //  Phase 3 — Block Scanning + Inline Formatting + Paragraphs
    // ────────────────────────────────────────────────────────────────
    // This is the heart of the lexer rewrite.  Instead of applying
    // 10+ global regex passes, we:
    //   0. Process indented code blocks (4-space / tab, before other blocks)
    //   1. Process tables (line walker — tables need multi-line lookahead)
    //   2. Scan remaining lines for headings, HR, blockquotes
    //   3. Process lists (line walker — lists need indent tracking)
    //   4. Apply inline formatting to all text content
    //   5. Wrap remaining text in <p> tags
    //
    // Steps 0, 1 and 3 are line-walkers that process the full text in a
    // single pass each.  Step 2 replaces global regex with a per-line
    // scanner.  Steps 4-5 are applied to the result.
    //
    // Total: 4 structured passes instead of 10+ regex passes.

    // ── Step 0: Indented code blocks ──
    html = processIndentedCodeBlocks(html, getAttr, dataQd);

    // ── Step 1: Tables ──
    // Tables need multi-line lookahead (header → separator → body rows)
    // so they're handled by a dedicated line-walker first.
    html = processTable(html, getAttr, bidirectional);

    // ── Step 2: Headings, HR, Blockquotes ──
    // These are simple line-level constructs.  We scan each line once
    // and replace matching lines with their HTML representation.
    html = scanLineBlocks(html, getAttr, dataQd, heading_ids, headingSlugCounts, escapeHtml);

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
    // The destination allows one level of balanced parentheses so URLs
    // like https://en.wikipedia.org/wiki/Foo_(bar) are captured whole.
    // eslint-disable-next-line security/detect-unsafe-regex -- linear: the two alternatives differ on their first char, so each input has only one match path
    html = html.replace(/!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g, (match, alt, dest) => {
        // allow_images:false — never emit <img> (no implicit resource load).
        // Re-emit as link markdown so the link pass below renders a normal,
        // sanitized <a> the reader can choose to follow.
        if (options.allow_images === false) return `[${alt || 'image'}](${dest})`;
        const { url, title } = parseLinkDestination(dest);
        const sanitizedSrc = sanitizeUrl(url, options.allow_unsafe_urls);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        /* istanbul ignore next - bd-only branch */
        const altAttr = bidirectional && alt ? ` data-qd-alt="${escapeHtml(alt)}"` : '';
        /* istanbul ignore next - bd-only branch */
        const srcAttr = bidirectional ? ` data-qd-src="${escapeHtml(url)}"` : '';
        /* istanbul ignore next - bd-only branch */
        const titleQd = bidirectional && title ? ` data-qd-title="${escapeHtml(title)}"` : '';
        return `<img${getAttr('img')} src="${sanitizedSrc}" alt="${alt}"${titleAttr}${altAttr}${srcAttr}${titleQd}${dataQd('!')}>`;
    });

    // Links
    // eslint-disable-next-line security/detect-unsafe-regex -- linear: the two alternatives differ on their first char, so each input has only one match path
    html = html.replace(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)/g, (match, text, dest) => {
        const { url, title } = parseLinkDestination(dest);
        const sanitizedHref = sanitizeUrl(url, options.allow_unsafe_urls);
        const isExternal = /^https?:\/\//i.test(sanitizedHref);
        const rel = isExternal ? ' rel="noopener noreferrer"' : '';
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        /* istanbul ignore next - bd-only branch */
        const textAttr = bidirectional ? ` data-qd-text="${escapeHtml(text)}"` : '';
        /* istanbul ignore next - bd-only branch */
        const titleQd = bidirectional && title ? ` data-qd-title="${escapeHtml(title)}"` : '';
        return `<a${getAttr('a')} href="${sanitizedHref}"${rel}${titleAttr}${textAttr}${titleQd}${dataQd('[')}>${text}</a>`;
    });

    // Autolinks — bare https?:// URLs become clickable <a> tags
    html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, prefix, rawUrl) => {
        const { url, trailing } = stripTrailingPunctuation(rawUrl);
        const sanitizedUrl = sanitizeUrl(url, options.allow_unsafe_urls);
        return `${prefix}<a${getAttr('a')} href="${sanitizedUrl}" rel="noopener noreferrer">${url}</a>${trailing}`;
    });

    // ── Phase 3.5: Reference Link & Footnote Resolution ──
    // Resolve [text][id], [text][], [id] patterns to <a> tags using
    // collected definitions.  Footnote markers [^id] become <sup> links.

    if (reference_links && refDefs.size > 0) {
        /** Build an <a> tag from a resolved reference definition. */
        function buildRefAnchor(def, id, displayText) {
            const sanitizedHref = sanitizeUrl(def.url, options.allow_unsafe_urls);
            const isExternal = /^https?:\/\//i.test(sanitizedHref);
            const rel = isExternal ? ' rel="noopener noreferrer"' : '';
            const titleAttr = def.title ? ` title="${escapeHtml(def.title)}"` : '';
            /* istanbul ignore next - bd-only branch */
            const refAttr = bidirectional ? ` data-qd-ref="${escapeHtml(id)}"` : '';
            // When sanitizing changed the URL, keep the original for the
            // round trip back to markdown.
            /* istanbul ignore next - bd-only branch */
            const refUrlAttr = bidirectional && sanitizedHref !== def.url ? ` data-qd-ref-url="${escapeHtml(def.url)}"` : '';
            // Definitions are collected before HTML escaping, so the URL is
            // escaped here: a quote in it must not end the href attribute.
            return `<a${getAttr('a')} href="${escapeHtml(sanitizedHref)}"${rel}${titleAttr}${refAttr}${refUrlAttr}${dataQd('[ref')}>${displayText}</a>`;
        }

        // Full reference: [text][id]  and collapsed: [text][]
        html = html.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (match, text, id) => {
            const def = refDefs.get((id === '' ? text : id).toLowerCase());
            return def ? buildRefAnchor(def, id, text) : match;
        });

        // Shortcut reference: [id] (not followed by ( or [, not containing ^)
        html = html.replace(/(?<!\])\[([^\]^[\n]+)\](?!\(|\[)/g, (match, id) => {
            const def = refDefs.get(id.toLowerCase());
            return def ? buildRefAnchor(def, id, id) : match;
        });
    }

    if (footnotes && fnDefs.size > 0) {
        // A footnote can be referenced more than once. The first reference
        // keeps the id fnref-<id> (the back-link target); later ones get
        // fnref-<id>-2, fnref-<id>-3, so ids stay unique.
        const fnUses = new Map();
        // Footnote markers: [^id]
        html = html.replace(/\[\^([^\]]+)\]/g, (match, id) => {
            if (!fnDefs.has(id)) return match; // unresolved — leave as text
            // Track ordering — each unique id gets a sequential number
            let fnNum = fnOrder.indexOf(id);
            if (fnNum === -1) {
                fnOrder.push(id);
                fnNum = fnOrder.length;
            } else {
                fnNum = fnNum + 1;
            }
            /* istanbul ignore next - bd-only branch */
            const fnAttr = bidirectional ? ` data-qd-fn="${escapeHtml(id)}"` : '';
            const uses = (fnUses.get(id) || 0) + 1;
            fnUses.set(id, uses);
            const refSuffix = uses === 1 ? '' : `-${uses}`;
            return `<sup${getAttr('sup')}${fnAttr}${dataQd('[^')}><a href="#fn-${escapeHtml(id)}" id="fnref-${escapeHtml(id)}${refSuffix}">${fnNum}</a></sup>`;
        });
    }

    // Protect rendered tags so emphasis regexes don't see attribute
    // values — fixes #3 (underscores in URLs interpreted as emphasis).
    const savedTags = [];
    html = html.replace(/<[^>]+>/g, m => { savedTags.push(m); return `%%T${savedTags.length - 1}%%`; });

    // Bold, italic, strikethrough (reuses BASE_INLINE_PATTERNS; code spans
    // are already extracted in Phase 1 so only the first 5 patterns apply here)
    const emphasisMarkers = ['**', '__', '*', '_', '~~'];
    for (let pi = 0; pi < 5; pi++) {
        const [pattern, tag] = BASE_INLINE_PATTERNS[pi];
        html = html.replace(pattern, `<${tag}${getAttr(tag)}${dataQd(emphasisMarkers[pi])}>$1</${tag}>`);
    }

    // Restore protected tags
    html = html.replace(/%%T(\d+)%%/g, (_, i) => savedTags[i]);

    // ── Step 5: Line breaks + paragraph wrapping ──

    // Backslash at end of line → hard line break (CommonMark)
    html = html.replace(/\\\n/g, `<br${getAttr('br')}>`);

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
        blocks.forEach((b, i) => html = html.replace(`§B${i}§`, () => b));

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
        [/<p>(<div[^>]*>)/g, '$1'],
        [/(<\/div>)<\/p>/g, '$1'],
        [/<p>(<section[^>]*>)/g, '$1'],
        [/(<\/section>)<\/p>/g, '$1'],
        [new RegExp(`<p>(${PLACEHOLDER_CB}\\d+§)</p>`, 'g'), '$1']
    ];
    cleanupPatterns.forEach(([pattern, replacement]) => {
        html = html.replace(pattern, replacement);
    });

    // When a block element is followed by a newline and then text, open a <p>.
    html = html.replace(/(<\/(?:h[1-6]|blockquote|div|section|ul|ol|table|pre|hr)>)\n([^<])/g, '$1\n<p>$2');

    // ── Footnotes section ──
    // Only rendered if footnotes were actually referenced in the document.
    if (footnotes && fnOrder.length > 0) {
        /* istanbul ignore next - bd-only branch */
        const sectionAttr = bidirectional ? ` data-qd="[^section"` : '';
        let fnSection = `<section${getAttr('footnotes')}${sectionAttr}>`;
        fnSection += `<hr${getAttr('hr')}>`;
        fnSection += `<ol${getAttr('ol')}>`;
        for (const id of fnOrder) {
            const rawText = fnDefs.get(id) || '';
            // Escape HTML in footnote text, then apply inline formatting
            let fnHtml = allow_unsafe_html === true ? rawText : escapeHtml(rawText);
            for (const [pattern, tag] of BASE_INLINE_PATTERNS) {
                fnHtml = fnHtml.replace(pattern, `<${tag}${getAttr(tag)}>$1</${tag}>`);
            }
            /* istanbul ignore next - bd-only branch */
            const liAttr = bidirectional ? ` data-qd-fn-id="${escapeHtml(id)}"` : '';
            fnSection += `<li${getAttr('li')} id="fn-${escapeHtml(id)}"${liAttr}>${fnHtml} <a href="#fnref-${escapeHtml(id)}"${getAttr('footnote-backref')}>↩</a></li>`;
        }
        fnSection += '</ol></section>';
        html += fnSection;
    }

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
                const langClass = !inline_styles && block.lang ? ` class="language-${escapeHtml(block.lang)}"` : '';
                const codeAttr = inline_styles ? getAttr('code') : langClass;
                /* istanbul ignore next - bd-only branch */
                const langAttr = bidirectional && block.lang ? ` data-qd-lang="${escapeHtml(block.lang)}"` : '';
                /* istanbul ignore next - bd-only branch */
                const fenceAttr = bidirectional ? ` data-qd-fence="${escapeHtml(block.fence)}"` : '';
                replacement = `<pre${getAttr('pre')}${fenceAttr}${langAttr}><code${codeAttr}>${escapeHtml(block.code)}</code></pre>`;
            } else /* istanbul ignore next - bd-only branch */ if (bidirectional) {
                // Plugin returned HTML — inject data attributes for roundtrip.
                replacement = replacement.replace(/^<(\w+)/, (m, tag) =>
                    `<${tag} data-qd-fence="${escapeHtml(block.fence)}" data-qd-lang="${escapeHtml(block.lang)}" data-qd-source="${escapeHtml(block.code)}"`);
            }
        } else {
            // Default rendering — wrap in <pre><code>.
            const langClass = !inline_styles && block.lang ? ` class="language-${escapeHtml(block.lang)}"` : '';
            const codeAttr = inline_styles ? getAttr('code') : langClass;
            /* istanbul ignore next - bd-only branch */
            const langAttr = bidirectional && block.lang ? ` data-qd-lang="${escapeHtml(block.lang)}"` : '';
            /* istanbul ignore next - bd-only branch */
            const fenceAttr = bidirectional ? ` data-qd-fence="${escapeHtml(block.fence)}"` : '';
            replacement = `<pre${getAttr('pre')}${fenceAttr}${langAttr}><code${codeAttr}>${block.code}</code></pre>`;
        }

        const placeholder = `${PLACEHOLDER_CB}${i}§`;
        // Function replacements: the restored text may contain "$&", "$$" and
        // similar sequences that a string replacement would interpret.
        html = html.replace(placeholder, () => replacement);
    });

    // Restore inline code spans
    inlineCodes.forEach((code, i) => {
        const placeholder = `${PLACEHOLDER_IC}${i}§`;
        html = html.replace(placeholder, () => `<code${getAttr('code')}${dataQd('`')}>${code}</code>`);
    });

    // Restore backslash escapes
    backslashEscapes.forEach((char, i) => {
        html = html.replace(`${PLACEHOLDER_BE}${i}§`, () => char);
    });

    // Restore newlines inside indented code blocks
    html = html.split(PLACEHOLDER_NL).join('\n');

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
 * @param {boolean}  headingIds  Emit id attributes on headings
 * @param {Map}      slugCounts  Duplicate slug tracker
 * @param {Function} escapeHtmlFn Escape helper for id attributes
 * @returns {string}         Text with block-level elements rendered
 */
function scanLineBlocks(text, getAttr, dataQd, headingIds, slugCounts, escapeHtmlFn) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // ── Markdown comment (reference-link hack) ──
        // [//]: # (comment)  or  [//]: # "comment"  or  [//]: #
        // These produce no output — standard markdown comment convention.
        if (/^\[\/\/\]: #/.test(line)) {
            i++;
            continue;
        }

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
            let idAttr = '';
            if (headingIds) {
                const slug = uniqueSlug(headingSlug(content), slugCounts);
                idAttr = ` id="${escapeHtmlFn(slug)}"`;
            }
            result.push(`<${tag}${getAttr(tag)}${idAttr}${dataQd('#'.repeat(hashCount))}>${content}</${tag}>`);
            i++;
            continue;
        }

        // ── Horizontal Rule ──
        // Three or more identical chars (-, *, _), optional interspersed spaces.
        if (isHRLine(line)) {
            result.push(`<hr${getAttr('hr')}${dataQd(line.trim())}>`);
            i++;
            continue;
        }

        // ── Blockquote ──
        // After Phase 2, the '>' character has been escaped to '&gt;'.
        // Supports nested levels: >> inner, > > inner
        // Supports lazy continuation: lines without > prefix continue
        // the blockquote at the previous depth.
        if (parseBlockquoteLine(line).depth > 0) {
            const bqLines = [];
            let lastDepth = 0;
            while (i < lines.length) {
                const parsed = parseBlockquoteLine(lines[i]);
                if (parsed.depth > 0) {
                    bqLines.push(parsed);
                    lastDepth = parsed.depth;
                    i++;
                } else if (lastDepth > 0 && !isLazyContinuationBreaker(lines[i])) {
                    bqLines.push({ depth: lastDepth, content: lines[i] });
                    i++;
                } else {
                    break;
                }
            }
            result.push(renderNestedBlockquotes(bqLines, getAttr, dataQd));
            continue;
        }

        // ── Pass-through ──
        result.push(line);
        i++;
    }

    return result.join('\n');
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
        [/(?<![A-Za-z0-9_])_(?![_\s])(.+?)(?<![\s_])_(?![A-Za-z0-9_])/g, 'em'],
        [/~~(.+?)~~/g, 'del'],
        [/`([^`\n]+)`/g, 'code']
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
function processTable(text, getAttr, bidirectional) {
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
                const tableHtml = buildTable(tableLines, getAttr, bidirectional);
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
        const tableHtml = buildTable(tableLines, getAttr, bidirectional);
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
function buildTable(lines, getAttr, bidirectional) {
    if (lines.length < 2) return null;

    // Find the separator row (---|---|)
    let separatorIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (/^\|?[\s\-:|]+\|?$/.test(lines[i]) && lines[i].includes('-')) {
            separatorIndex = i;
            break;
        }
    }

    let headerLines;
    let bodyLines;
    let alignments;

    if (separatorIndex === -1) {
        // No separator row (common in LLM output) — first row is header, rest is body
        headerLines = [lines[0]];
        bodyLines = lines.slice(1);
        alignments = parseTableCells(lines[0]).map(() => 'left');
    } else {
        headerLines = lines.slice(0, separatorIndex);
        bodyLines = lines.slice(separatorIndex + 1);

        const separator = lines[separatorIndex];
        const separatorCells = parseTableCells(separator);
        alignments = separatorCells.map(cell => {
            const trimmed = cell.trim();
            if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
            if (trimmed.endsWith(':')) return 'right';
            return 'left';
        });
    }

    const colCount = alignments.length;

    /* istanbul ignore next - bd-only branch */
    const alignAttr = bidirectional ? ` data-qd-align="${alignments.join(',')}"` : '';
    let html = `<table${getAttr('table')}${alignAttr}>\n`;

    // Header
    html += `<thead${getAttr('thead')}>\n`;
    headerLines.forEach(line => {
        html += `<tr${getAttr('tr')}>\n`;
        const cells = parseTableCells(line);
        for (let i = 0; i < colCount; i++) {
            const cell = i < cells.length ? cells[i] : '';
            const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
            const processedCell = processInlineMarkdown(cell.trim(), getAttr);
            html += `<th${getAttr('th', alignStyle)}>${processedCell}</th>\n`;
        }
        html += '</tr>\n';
    });
    html += '</thead>\n';

    // Body
    if (bodyLines.length > 0) {
        html += `<tbody${getAttr('tbody')}>\n`;
        bodyLines.forEach(line => {
            html += `<tr${getAttr('tr')}>\n`;
            const cells = parseTableCells(line);
            for (let i = 0; i < colCount; i++) {
                const cell = i < cells.length ? cells[i] : '';
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                const processedCell = processInlineMarkdown(cell.trim(), getAttr);
                html += `<td${getAttr('td', alignStyle)}>${processedCell}</td>\n`;
            }
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
 * optional leading indentation for nesting.  The indent of the item
 * that opens the outermost list is the base, so a list that starts at
 * indent 2 is a top-level list.  An indented, non-blank line directly
 * under an item is wrapped item text and is folded into that item
 * (two trailing spaces or a trailing backslash on the item keep a hard
 * break).  Any other non-list line closes all open lists and passes
 * through unchanged.
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
    let baseIndent = 0;     // indent of the item that opened the outermost list
    let lastWasItem = false; // result[last] is an <li> a continuation line may extend

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
        const match = line.match(LIST_ITEM_RE);

        if (match) {
            const [, indent, marker, content] = match;
            if (listStack.length === 0) baseIndent = indent.length;
            const level = Math.max(0, Math.floor((indent.length - baseIndent) / 2));
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

            // Switch list type at the current level
            if (listStack.length === level + 1 && listStack[level].type !== listType) {
                result.push(`</${listStack.pop().type}>`);
            }

            // Open lists up to the current level.  More than one opens when
            // the indent jumps (`- a\n    - deep`) so no <li> is left bare.
            while (listStack.length < level + 1) {
                listStack.push({ type: listType, level: listStack.length });
                result.push(`<${listType}${getAttr(listType)}>`);
            }

            const liAttr = taskListClass || getAttr('li');
            result.push(`<li${liAttr}${dataQd(marker)}>${listItemContent}</li>`);
            lastWasItem = true;
        } else if (lastWasItem && isListContinuation(line)) {
            // Wrapped item text — fold into the <li> above (issue #36)
            let body = result[result.length - 1].slice(0, -'</li>'.length);
            if (/( {2}|\\)$/.test(body)) {
                body = body.replace(/( {2}|\\)$/, `<br${getAttr('br')}>`);
            } else {
                body += ' ';
            }
            result[result.length - 1] = `${body}${line.trim()}</li>`;
        } else {
            // Not a list item — close all open lists
            while (listStack.length > 0) {
                const list = listStack.pop();
                result.push(`</${list.type}>`);
            }
            result.push(line);
            lastWasItem = false;
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
            '#ddf4ff': '#162d50',   // alert-note bg
            '#dafbe1': '#16351d',   // alert-tip bg
            '#fbefff': '#2d1a42',   // alert-important bg
            '#fff8c5': '#342a10',   // alert-warning bg
            '#ffebe9': '#3d1418',   // alert-caution bg
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
            const needsTextColor = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'li', 'blockquote', 'alert', 'alert-title'];
            if (needsTextColor.includes(tag)) {
                themedStyle += `;color:${themeOverrides.dark._textColor}`;
            }
        } else /* istanbul ignore next */ if (theme === 'light' && themeOverrides.light) {
            const needsTextColor = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'li', 'blockquote', 'alert', 'alert-title'];
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
    
    // Reference-link definitions seen while walking, keyed by lowercased id.
    // They are written back at the end of the document.
    const refDefs = new Map();

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
                
            case 'a': {
                const href = node.getAttribute('href') || '';
                // Skip footnote back-links (↩)
                if (href.startsWith('#fnref-')) {
                    return '';
                }
                // Reference link
                const refId = node.getAttribute('data-qd-ref');
                if (refId !== null) {
                    const linkText = childContent.trim() || node.getAttribute('data-qd-text') || '';
                    const defId = refId === '' ? linkText : refId;
                    if (!refDefs.has(defId.toLowerCase())) {
                        refDefs.set(defId.toLowerCase(), {
                            id: defId,
                            url: node.getAttribute('data-qd-ref-url') || href,
                            title: node.getAttribute('title')
                        });
                    }
                    if (refId === '') {
                        // Collapsed reference: [text][]
                        return `[${linkText}][]`;
                    }
                    if (refId.toLowerCase() === linkText.toLowerCase()) {
                        // Shortcut reference: [id]
                        return `[${refId}]`;
                    }
                    // Full reference: [text][id]
                    return `[${linkText}][${refId}]`;
                }
                const linkText = childContent.trim() || node.getAttribute('data-qd-text') || '';
                // Check for autolinks
                if (linkText === href && !dataQd) {
                    return `<${href}>`;
                }
                return `[${linkText}](${href})`;
            }

            case 'sup': {
                // Footnote marker
                const fnId = node.getAttribute('data-qd-fn');
                if (fnId) {
                    return `[^${fnId}]`;
                }
                return childContent;
            }

            case 'section': {
                // Footnotes section
                if (dataQd === '[^section') {
                    // Walk <ol> children to extract footnote definitions
                    let fnDefs = '';
                    const ol = node.querySelector('ol');
                    if (ol) {
                        for (const li of ol.children) {
                            if (li.tagName !== 'LI') continue;
                            const fnId = li.getAttribute('data-qd-fn-id');
                            if (!fnId) continue;
                            // Extract text content, skipping the back-reference <a>
                            let text = '';
                            for (const child of li.childNodes) {
                                if (child.nodeType === Node.TEXT_NODE) {
                                    text += child.textContent;
                                } else if (child.nodeType === Node.ELEMENT_NODE) {
                                    if (child.tagName === 'A' && (child.getAttribute('href') || '').startsWith('#fnref-')) {
                                        continue; // skip backref
                                    }
                                    text += child.textContent;
                                }
                            }
                            fnDefs += `[^${fnId}]: ${text.trim()}\n`;
                        }
                    }
                    return fnDefs ? '\n' + fnDefs : '';
                }
                return childContent;
            }

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
            // The parser emits a nested list as a sibling of the <li> it
            // belongs to (not inside it), so walk it one level deeper.
            if (child.tagName === 'UL' || child.tagName === 'OL') {
                result += walkList(child, child.tagName === 'OL', depth + 1);
                continue;
            }
            if (child.tagName !== 'LI') continue;
            
            const dataQd = child.getAttribute('data-qd');
            let marker = dataQd || (isOrdered ? `${index}.` : '-');
            
            // Check for task list checkbox
            const checkbox = child.querySelector('input[type="checkbox"]');
            if (checkbox) {
                const checked = checkbox.checked ? 'x' : ' ';
                marker = '-';
                // Continuation lines (after <br>) indent to the item's text column
                const cont = '\n' + indent + ' '.repeat(marker.length + 5);
                // Get text without the checkbox
                let text = '';
                for (const node of child.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        text += node.textContent;
                    } else if (node.tagName && node.tagName !== 'INPUT') {
                        text += walkNode(node);
                    }
                }
                result += `${indent}${marker} [${checked}] ${text.trim().replace(/\n/g, cont)}\n`;
            } else {
                const cont = '\n' + indent + ' '.repeat(marker.length + 1);
                let text = '';
                let nested = '';
                
                for (const node of child.childNodes) {
                    if (node.tagName === 'UL' || node.tagName === 'OL') {
                        // Nested list placed inside the <li> (hand-written or edited HTML)
                        nested += walkList(node, node.tagName === 'OL', depth + 1);
                    } else {
                        text += walkNode(node);
                    }
                }
                
                result += `${indent}${marker} ${text.trim().replace(/\n/g, cont)}\n${nested}`;
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

    // Write the reference-link definitions back, after the content
    if (refDefs.size > 0) {
        const lines = [];
        for (const { id, url, title } of refDefs.values()) {
            let line = `[${id}]: ${url}`;
            if (title) line += title.includes('"') ? ` '${title}'` : ` "${title}"`;
            lines.push(line);
        }
        markdown += '\n\n' + lines.join('\n');
    }
    
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

const COPY_OUTPUT_PROFILES = ['default', 'stripped', 'quikdown'];

const COPY_HEADING_STYLES = {
    h1: { fontSize: '24pt', marginTop: '0.6em', marginBottom: '0.35em' },
    h2: { fontSize: '18pt', marginTop: '0.55em', marginBottom: '0.3em' },
    h3: { fontSize: '15pt', marginTop: '0.5em', marginBottom: '0.25em' },
    h4: { fontSize: '13pt', marginTop: '0.45em', marginBottom: '0.25em' },
    h5: { fontSize: '11pt', marginTop: '0.4em', marginBottom: '0.2em' },
    h6: { fontSize: '10pt', marginTop: '0.35em', marginBottom: '0.2em' }
};

function buildHeadingCSS(output) {
    if (output === 'stripped') return '';
    return Object.entries(COPY_HEADING_STYLES)
        .map(([tag, style]) => {
            const weight = output === 'quikdown' ? ' font-weight:bold;' : '';
            return `${tag} { font-size:${style.fontSize};${weight} line-height:1.25; margin:${style.marginTop} 0 ${style.marginBottom}; }`;
        })
        .join('\n                  ');
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
 * @param {Object} [options={}] - Copy options
 * @param {string} [options.output='default'] - Output profile: 'default' (no heading font-weight), 'quikdown' (full styling with heading font-weight), or 'stripped' (minimal styling)
 * @returns {Promise<{success: boolean, html?: string, text?: string}>}
 */
async function getRenderedContent(previewPanel, options = {}) {
    const output = options.output || 'default';
    if (!COPY_OUTPUT_PROFILES.includes(output)) {
        throw new Error(`Invalid output profile "${output}". Must be one of: ${COPY_OUTPUT_PROFILES.join(', ')}`);
    }
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
        // In 'stripped' mode, skip all inline style application
        if (output !== 'stripped') {

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
        Object.entries(COPY_HEADING_STYLES).forEach(([tag, style]) => {
            clone.querySelectorAll(tag).forEach(el => {
                el.style.fontSize = style.fontSize;
                if (output === 'quikdown') {
                    el.style.fontWeight = 'bold';
                }
                el.style.lineHeight = '1.25';
                el.style.marginTop = style.marginTop;
                el.style.marginBottom = style.marginBottom;
            });
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

        } // end if (output !== 'stripped')
        
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
        
        // 2b. Process ABC music notation — convert SVG to PNG
        // ABCJS renders responsive SVGs (width="100%", no height) whose
        // clientHeight reflects the container, not the content. Use the
        // viewBox aspect ratio to derive the correct image height.
        const abcContainers = clone.querySelectorAll('.qde-abc-container');
        for (const container of abcContainers) {
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

                    // Derive dimensions from viewBox (accurate) rather than
                    // clientWidth/Height (stretched by container)
                    const vb = svg.viewBox && svg.viewBox.baseVal;
                    let imgWidth, imgHeight;
                    if (vb && vb.width && vb.height) {
                        const aspect = vb.width / vb.height;
                        imgWidth = svg.clientWidth || vb.width;
                        imgHeight = Math.round(imgWidth / aspect);
                    } else {
                        imgWidth = svg.clientWidth || parseFloat(svg.getAttribute('width')) || 400;
                        imgHeight = svg.clientHeight || parseFloat(svg.getAttribute('height')) || 200;
                    }

                    img.width = imgWidth;
                    img.height = imgHeight;
                    img.setAttribute('width', imgWidth.toString());
                    img.setAttribute('height', imgHeight.toString());
                    img.style.width = imgWidth + 'px';
                    img.style.height = imgHeight + 'px';
                    img.style.maxWidth = 'none';
                    img.style.maxHeight = 'none';
                    img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    img.alt = 'Music Notation';
                    container.parentNode.replaceChild(img, container);
                } catch (err) {
                    console.warn('Failed to convert ABC notation:', err);
                }
            } else {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                placeholder.textContent = '[Music Notation - Interactive content not available in copy]';
                container.parentNode.replaceChild(placeholder, container);
            }
        }

        // 2c. Process Vega charts — convert SVG to PNG
        const vegaContainers = clone.querySelectorAll('.qde-vega-container');
        for (const container of vegaContainers) {
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
                    const imgWidth = svg.clientWidth || parseFloat(svg.getAttribute('width')) || 400;
                    const imgHeight = svg.clientHeight || parseFloat(svg.getAttribute('height')) || 300;
                    img.width = imgWidth;
                    img.height = imgHeight;
                    img.setAttribute('width', imgWidth.toString());
                    img.setAttribute('height', imgHeight.toString());
                    img.style.width = imgWidth + 'px';
                    img.style.height = imgHeight + 'px';
                    img.style.maxWidth = 'none';
                    img.style.maxHeight = 'none';
                    img.setAttribute('v:shapes', 'image' + Math.random().toString(36).substr(2, 9));
                    img.alt = 'Data Visualization';
                    container.parentNode.replaceChild(img, container);
                } catch (err) {
                    console.warn('Failed to convert Vega chart:', err);
                }
            } else {
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'padding: 12px; background-color: #f0f0f0; border: 1px solid #ccc; text-align: center; margin: 0.5em 0; border-radius: 4px;';
                placeholder.textContent = '[Vega Chart - Interactive content not available in copy]';
                container.parentNode.replaceChild(placeholder, container);
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
                    } catch (_e) {
                        console.warn('Failed to draw tile:', _e);
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
                    } catch (_e) {
                        console.warn('Failed to draw overlay SVG:', _e);
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
                    } catch (_e) {
                        console.warn('Failed to draw marker icon:', _e);
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

                    // Sanitize: remove script elements and on* event handlers
                    tempDiv.querySelectorAll('script').forEach(s => s.remove());
                    tempDiv.querySelectorAll('*').forEach(el => {
                        for (const attr of Array.from(el.attributes)) {
                            if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
                        }
                    });
                    
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
        const headingCSS = buildHeadingCSS(output);
        const cssBlock = output === 'stripped'
            ? '/* Minimal styles */\n                  img { max-width: 100%; height: auto; }'
            : `${headingCSS}

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
                  blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }`;
        const htmlContent = `
            <!DOCTYPE html>
            <html xmlns:v="urn:schemas-microsoft-com:vml"
                  xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:w="urn:schemas-microsoft-com:office:word">
              <head>
                <meta charset="utf-8">
                <style>
                  ${cssBlock}
                  
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
                throw new Error('Fallback copy failed', { cause: modernErr });
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
                    throw new Error('Fallback copy failed', { cause: modernErr });
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
 * quikdown_edit_format — markdown text transforms behind QuikdownEditor.format()
 *
 * Everything here is a pure string function. A transform takes the markdown
 * source plus a selection (start/end character offsets) and returns the new
 * markdown plus the new selection. The editor uses the same functions for
 * the source pane and the rendered pane, so formatting behaves the same in
 * every browser engine and needs no document.execCommand.
 *
 * @license BSD-2-Clause
 */

/** Inline commands and the marker each one writes. */
const INLINE_MARKERS = { bold: '**', italic: '*', strike: '~~', code: '`' };

/** Every command name format() accepts. */
const FORMAT_COMMANDS = [
    'bold', 'italic', 'strike', 'code', 'link',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading', 'paragraph',
    'ul', 'ol', 'task', 'quote', 'codeblock', 'hr', 'table',
    'indent', 'outdent'
];

// Block prefix of a line: indent, blockquote markers, then at most one of
// heading / task item / bullet / ordered marker.
// eslint-disable-next-line security/detect-unsafe-regex -- linear: every repetition of the quote group must start with ">", so there is one match path
const LINE_RE = /^([ \t]*)((?:>[ \t]?)*)(?:(#{1,6})(?:[ \t]+|$)|([-*+])[ \t]+(\[[ xX]\])(?:[ \t]+|$)|([-*+])(?:[ \t]+|$)|(\d+)\.(?:[ \t]+|$))?/;

const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;

/**
 * Split one line into its block prefix and its text.
 * @returns {{indent:string, quote:string, kind:(null|'h'|'ul'|'ol'|'task'), level:number, check:string, prefix:number, rest:string}}
 */
function parseLine(line) {
    const m = LINE_RE.exec(line);
    let kind = null;
    if (m[3]) kind = 'h';
    else if (m[5]) kind = 'task';
    else if (m[6]) kind = 'ul';
    else if (m[7]) kind = 'ol';
    return {
        indent: m[1],
        quote: m[2],
        kind,
        level: m[3] ? m[3].length : 0,
        check: m[5] || '',
        prefix: m[0].length,
        rest: line.slice(m[0].length)
    };
}

/**
 * Offsets of the whole lines a selection touches. A selection that ends
 * just after a newline does not include the following line.
 */
function lineRange(md, start, end) {
    const ls = md.lastIndexOf('\n', start - 1) + 1;
    const anchor = end > start && md[end - 1] === '\n' ? end - 1 : end;
    let le = md.indexOf('\n', anchor);
    if (le === -1) le = md.length;
    return { ls, le };
}

/**
 * Inline spans (code, bold, italic, strike, link) in one line of text.
 * Offsets are relative to `text`; `m` is the marker length on each side.
 */
function inlineSpans(text) {
    const spans = [];
    const blank = (s, from, to) => s.slice(0, from) + ' '.repeat(to - from) + s.slice(to);
    let masked = text;

    // Code spans win over everything else; hide their contents.
    text.replace(/`([^`\n]+)`/g, (match, inner, at) => {
        spans.push({ type: 'code', start: at, end: at + match.length, m: 1 });
        masked = blank(masked, at, at + match.length);
        return match;
    });

    // Links: keep the text visible to the emphasis passes, hide the target.
    // eslint-disable-next-line security/detect-unsafe-regex -- linear: every repetition of the inner group must start with "(", so there is one match path
    masked.replace(/\[([^\]\n]*)\]\(([^()\n]*(?:\([^()\n]*\)[^()\n]*)*)\)/g, (match, label, dest, at) => {
        spans.push({
            type: 'link', start: at, end: at + match.length, m: 1,
            textStart: at + 1, textEnd: at + 1 + label.length,
            destStart: at + label.length + 3, destEnd: at + match.length - 1
        });
        masked = blank(masked, at + 1 + label.length, at + match.length);
        return match;
    });

    // The closing marker is the end of its run, so "***x***" is bold around "*x*".
    const bold = (match, inner, at) => {
        spans.push({ type: 'bold', start: at, end: at + match.length, m: 2 });
        masked = blank(masked, at, at + 2);
        masked = blank(masked, at + match.length - 2, at + match.length);
        return match;
    };
    masked.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\*)/g, bold);
    masked.replace(/__(?=\S)(.+?)(?<=\S)__(?!_)/g, bold);

    masked.replace(/~~(?=\S)(.+?)(?<=\S)~~/g, (match, inner, at) => {
        spans.push({ type: 'strike', start: at, end: at + match.length, m: 2 });
        return match;
    });

    const italic = (match, inner, at) => {
        spans.push({ type: 'italic', start: at, end: at + match.length, m: 1 });
        return match;
    };
    masked.replace(/(?<![*\\])\*(?![*\s])(.+?)(?<![*\s])\*(?!\*)/g, italic);
    masked.replace(/(?<![A-Za-z0-9_])_(?![_\s])(.+?)(?<![\s_])_(?![A-Za-z0-9_])/g, italic);

    return spans;
}

/** True for characters that belong to a word for caret expansion. */
function isWordChar(ch) {
    return ch !== undefined && !/[\s*_~`[\]()<>]/.test(ch);
}

/** Result helper. */
function result(markdown, start, end) {
    return { markdown, start, end };
}

/**
 * Toggle an inline marker (bold, italic, strike, code) over the selection.
 */
function toggleInline(md, start, end, type) {
    const mk = INLINE_MARKERS[type];
    let caretShift = null;

    if (start === end) {
        // Caret inside a word: act on the word and keep the caret in place.
        let a = start;
        let b = end;
        while (isWordChar(md[a - 1])) a--;
        while (isWordChar(md[b])) b++;
        if (a === b) {
            // Caret between an empty pair of this marker: remove the pair.
            let before = 0;
            let after = 0;
            const ch = mk[0];
            while (md[start - 1 - before] === ch) before++;
            while (md[start + after] === ch) after++;
            const run = Math.min(before, after);
            const paired = type === 'italic' ? run % 2 === 1
                : type === 'code' ? run >= 1
                    : run >= 2;
            if (paired) {
                return result(md.slice(0, start - mk.length) + md.slice(start + mk.length), start - mk.length, start - mk.length);
            }
            return result(md.slice(0, start) + mk + mk + md.slice(start), start + mk.length, start + mk.length);
        }
        caretShift = start - a;
        start = a;
        end = b;
    }

    // One segment per line, without the block prefix or outer whitespace.
    const segs = [];
    let pos = md.lastIndexOf('\n', start - 1) + 1;
    while (pos <= end) {
        let le = md.indexOf('\n', pos);
        if (le === -1) le = md.length;
        const line = md.slice(pos, le);
        let a = Math.max(start, pos + parseLine(line).prefix);
        let b = Math.min(end, le);
        while (a < b && /\s/.test(md[a])) a++;
        while (b > a && /\s/.test(md[b - 1])) b--;
        if (a < b && !FENCE_RE.test(line)) {
            const spans = inlineSpans(line)
                .filter(s => s.type === type)
                .map(s => ({ start: s.start + pos, end: s.end + pos, m: s.m }));
            segs.push({ a, b, spans, on: spans.find(s => s.start <= a && b <= s.end) || null });
        }
        pos = le + 1;
    }
    if (segs.length === 0) return result(md, start, end);

    const turnOff = segs.every(s => s.on);
    let out = '';
    let cursor = 0;
    let newStart = 0;
    let newEnd = 0;

    segs.forEach((seg, i) => {
        let r0;
        let r1;
        let rep;
        let selA;
        let selB;
        if (turnOff) {
            const sp = seg.on;
            const open = md.slice(sp.start, sp.start + sp.m);
            const innerStart = sp.start + sp.m;
            const innerEnd = sp.end - sp.m;
            // "Whole span" ignores other markers and spaces hugging the edges.
            let cs = innerStart;
            let ce = innerEnd;
            while (cs < ce && /[*_~`\s]/.test(md[cs])) cs++;
            while (ce > cs && /[*_~`\s]/.test(md[ce - 1])) ce--;
            r0 = sp.start;
            r1 = sp.end;
            if (seg.a <= cs && seg.b >= ce) {
                rep = md.slice(innerStart, innerEnd);
                selA = Math.max(seg.a, innerStart) - innerStart;
                selB = Math.min(seg.b, innerEnd) - innerStart;
            } else {
                // Selection is part of the span: split the span around it.
                const a = Math.max(seg.a, innerStart);
                const b = Math.min(seg.b, innerEnd);
                const left = md.slice(innerStart, a);
                const right = md.slice(b, innerEnd);
                const L = left.replace(/\s+$/, '');
                const R = right.replace(/^\s+/, '');
                const head = (L ? open + L + open : '') + left.slice(L.length);
                const tail = right.slice(0, right.length - R.length) + (R ? open + R + open : '');
                rep = head + md.slice(a, b) + tail;
                selA = head.length;
                selB = head.length + (b - a);
            }
        } else {
            // Merge any spans of this type the selection overlaps, then wrap.
            const hit = seg.spans.filter(s => s.start < seg.b && s.end > seg.a);
            r0 = Math.min(seg.a, ...hit.map(s => s.start));
            r1 = Math.max(seg.b, ...hit.map(s => s.end));
            let text = '';
            let at = r0;
            hit.forEach(s => {
                text += md.slice(at, s.start) + md.slice(s.start + s.m, s.end - s.m);
                at = s.end;
            });
            text += md.slice(at, r1);
            rep = mk + text + mk;
            selA = mk.length;
            selB = mk.length + text.length;
        }
        out += md.slice(cursor, r0);
        if (i === 0) newStart = out.length + selA;
        if (i === segs.length - 1) newEnd = out.length + selB;
        out += rep;
        cursor = r1;
    });
    out += md.slice(cursor);

    if (caretShift !== null) {
        const caret = Math.min(newStart + caretShift, newEnd);
        return result(out, caret, caret);
    }
    return result(out, newStart, newEnd);
}

/**
 * Insert, retarget, or remove a link.
 * `url` string: link the selection (or retarget the link under it).
 * `url` null / '' / false: remove the link under the selection.
 * `url` undefined: link the selection with a placeholder target, selected.
 */
function toggleLink(md, start, end, url) {
    const { ls } = lineRange(md, start, start);
    let le = md.indexOf('\n', start);
    if (le === -1) le = md.length;
    end = Math.min(end, le);
    const link = inlineSpans(md.slice(ls, le))
        .filter(s => s.type === 'link')
        .map(s => ({ start: s.start + ls, end: s.end + ls, textStart: s.textStart + ls, textEnd: s.textEnd + ls }))
        .find(s => s.start <= start && end <= s.end);
    const remove = url === null || url === '' || url === false;

    if (link) {
        const text = md.slice(link.textStart, link.textEnd);
        if (remove) {
            return result(md.slice(0, link.start) + text + md.slice(link.end), link.start, link.start + text.length);
        }
        if (url === undefined) return result(md, link.textStart, link.textEnd);
        const rep = `[${text}](${url})`;
        return result(md.slice(0, link.start) + rep + md.slice(link.end), link.start + 1, link.start + 1 + text.length);
    }
    if (remove) return result(md, start, end);

    if (start === end) {
        while (isWordChar(md[start - 1])) start--;
        while (isWordChar(md[end])) end++;
    }
    while (start < end && /\s/.test(md[start])) start++;
    while (end > start && /\s/.test(md[end - 1])) end--;
    const target = url === undefined ? 'url' : String(url);
    const text = md.slice(start, end) || (url === undefined ? 'link' : target);
    const rep = `[${text}](${target})`;
    const out = md.slice(0, start) + rep + md.slice(end);
    if (url === undefined) {
        const at = start + text.length + 3;
        return result(out, at, at + target.length);
    }
    return result(out, start + 1, start + 1 + text.length);
}

/**
 * Rewrite the whole lines under the selection with `fn(lines) → lines`.
 * A caret keeps its distance from the end of its line; a range selection
 * becomes the rewritten lines.
 */
function rewriteLines(md, start, end, fn) {
    const { ls, le } = lineRange(md, start, end);
    const oldLines = md.slice(ls, le).split('\n');
    const newLines = fn(oldLines);
    const block = newLines.join('\n');
    const out = md.slice(0, ls) + block + md.slice(le);
    if (start !== end) return result(out, ls, ls + block.length);
    const fromEnd = le - start;
    const caret = Math.max(ls + parseLine(newLines[0]).prefix, ls + block.length - fromEnd);
    return result(out, caret, caret);
}

/** Lines a block command acts on: the non-blank ones, or a lone blank line. */
function targets(lines) {
    const idx = [];
    lines.forEach((l, i) => { if (l.trim() !== '') idx.push(i); });
    return idx.length ? idx : [0];
}

function setHeading(md, start, end, level) {
    return rewriteLines(md, start, end, lines => {
        const t = targets(lines);
        const parsed = lines.map(parseLine);
        const same = level > 0 && t.every(i => parsed[i].kind === 'h' && parsed[i].level === level);
        const mark = level > 0 && !same ? '#'.repeat(level) + ' ' : '';
        return lines.map((l, i) => {
            if (!t.includes(i)) return l;
            const p = parsed[i];
            if (level === 0) return p.rest;
            return p.indent + p.quote + mark + p.rest;
        });
    });
}

function setList(md, start, end, kind) {
    return rewriteLines(md, start, end, lines => {
        const t = targets(lines);
        const parsed = lines.map(parseLine);
        const same = t.every(i => parsed[i].kind === kind);
        let n = 0;
        return lines.map((l, i) => {
            if (!t.includes(i)) return l;
            const p = parsed[i];
            let mark = '';
            if (!same) {
                if (kind === 'ol') mark = `${++n}. `;
                else if (kind === 'task') mark = `- ${p.check || '[ ]'} `;
                else mark = '- ';
            }
            return p.indent + p.quote + mark + p.rest;
        });
    });
}

function toggleQuote(md, start, end) {
    return rewriteLines(md, start, end, lines => {
        const t = targets(lines);
        const quoted = t.every(i => parseLine(lines[i]).quote !== '');
        if (quoted) return lines.map(l => l.replace(/^([ \t]*)>[ \t]?/, '$1'));
        return lines.map(l => (l.trim() === '' ? '>' : '> ' + l));
    });
}

function shiftIndent(md, start, end, dir) {
    return rewriteLines(md, start, end, lines => lines.map(l => {
        if (l.trim() === '') return l;
        return dir > 0 ? '  ' + l : l.replace(/^(?: {1,2}|\t)/, '');
    }));
}

function toggleCodeBlock(md, start, end, lang) {
    const { ls, le } = lineRange(md, start, end);
    const lines = md.slice(ls, le).split('\n');
    const isFence = l => FENCE_RE.test(l);
    // A fence line opens a block when an even number of fence lines precede it.
    const opens = at => md.slice(0, at).split('\n').filter(isFence).length % 2 === 0;

    // Selection includes its own fence lines: drop them.
    if (lines.length >= 2 && isFence(lines[0]) && isFence(lines[lines.length - 1]) && opens(ls)) {
        const inner = lines.slice(1, -1).join('\n');
        return result(md.slice(0, ls) + inner + md.slice(le), ls, ls + inner.length);
    }
    // Selection sits between two fence lines: drop those.
    const prevStart = ls > 0 ? md.lastIndexOf('\n', ls - 2) + 1 : -1;
    const nextEnd = le < md.length ? (md.indexOf('\n', le + 1) === -1 ? md.length : md.indexOf('\n', le + 1)) : -1;
    if (prevStart >= 0 && nextEnd >= 0 && isFence(md.slice(prevStart, ls - 1)) && isFence(md.slice(le + 1, nextEnd)) && opens(prevStart)) {
        const inner = md.slice(ls, le);
        const tail = md.slice(nextEnd);
        const out = md.slice(0, prevStart) + inner + tail;
        return result(out, start - (ls - prevStart), end - (ls - prevStart));
    }
    const open = '```' + (lang ? String(lang) : '') + '\n';
    const inner = md.slice(ls, le);
    const out = md.slice(0, ls) + open + inner + '\n```' + md.slice(le);
    return result(out, start + open.length, end + open.length);
}

/**
 * Insert a block on its own lines after the current line, padded with one
 * blank line on each side where there is neighbouring content.
 */
function insertBlock(md, start, end, block, selFrom, selTo) {
    const { ls, le } = lineRange(md, start, end);
    const blankLine = md.slice(ls, le).trim() === '';
    const at = blankLine ? ls : le;
    const before = md.slice(0, at);
    const after = md.slice(blankLine ? le : at);
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    // `after` is empty or starts at a line break
    const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : '\n';
    const base = before.length + lead.length;
    const out = before + lead + block + trail + after;
    if (selFrom === undefined) {
        const caret = base + block.length + trail.length;
        return result(out, caret, caret);
    }
    return result(out, base + selFrom, base + selTo);
}

function insertTable(md, start, end, value) {
    const cols = Math.max(1, Math.min(20, parseInt(value && value.cols, 10) || 2));
    const rows = Math.max(1, Math.min(100, parseInt(value && value.rows, 10) || 2));
    const names = [];
    for (let c = 1; c <= cols; c++) names.push(`Column ${c}`);
    const lines = [
        '| ' + names.join(' | ') + ' |',
        '| ' + names.map(() => '---').join(' | ') + ' |'
    ];
    for (let r = 0; r < rows; r++) lines.push('| ' + names.map(() => ' ').join(' | ') + ' |');
    return insertBlock(md, start, end, lines.join('\n'), 2, 2 + names[0].length);
}

/**
 * Apply a formatting command to markdown.
 *
 * @param {string} markdown
 * @param {number} start  selection start offset
 * @param {number} end    selection end offset
 * @param {string} command one of FORMAT_COMMANDS
 * @param {*} [value]     link target, heading level, code language, or table size
 * @returns {{markdown:string, start:number, end:number}|null} null for an unknown command
 */
function formatMarkdown(markdown, start, end, command, value) {
    const md = typeof markdown === 'string' ? markdown : '';
    let s = Math.max(0, Math.min(md.length, Number(start) || 0));
    let e = Math.max(0, Math.min(md.length, Number(end) || 0));
    if (s > e) [s, e] = [e, s];

    switch (command) {
        case 'bold':
        case 'italic':
        case 'strike':
        case 'code':
            return toggleInline(md, s, e, command);
        case 'link':
            return toggleLink(md, s, e, value);
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            return setHeading(md, s, e, parseInt(command[1], 10));
        case 'heading':
            return setHeading(md, s, e, Math.max(0, Math.min(6, parseInt(value, 10) || 0)));
        case 'paragraph':
            return setHeading(md, s, e, 0);
        case 'ul':
        case 'ol':
        case 'task':
            return setList(md, s, e, command);
        case 'quote':
            return toggleQuote(md, s, e);
        case 'indent':
            return shiftIndent(md, s, e, 1);
        case 'outdent':
            return shiftIndent(md, s, e, -1);
        case 'codeblock':
            return toggleCodeBlock(md, s, e, value);
        case 'hr':
            return insertBlock(md, s, e, '---');
        case 'table':
            return insertTable(md, s, e, value);
        default:
            return null;
    }
}

/**
 * Describe the formatting at a selection, for toolbar pressed states.
 *
 * @returns {{bold:boolean, italic:boolean, strike:boolean, code:boolean, link:boolean,
 *            heading:number, list:(null|'ul'|'ol'|'task'), quote:boolean, codeblock:boolean}}
 */
function getFormatState(markdown, start, end) {
    const md = typeof markdown === 'string' ? markdown : '';
    let s = Math.max(0, Math.min(md.length, Number(start) || 0));
    let e = Math.max(0, Math.min(md.length, Number(end) || 0));
    if (s > e) [s, e] = [e, s];

    const ls = md.lastIndexOf('\n', s - 1) + 1;
    let le = md.indexOf('\n', s);
    if (le === -1) le = md.length;
    const line = md.slice(ls, le);
    const p = parseLine(line);

    // Inside a fenced block when an odd number of fence lines precede this one.
    let fences = 0;
    md.slice(0, ls).split('\n').forEach(l => { if (FENCE_RE.test(l)) fences++; });
    const codeblock = fences % 2 === 1 && !FENCE_RE.test(line);

    const state = {
        bold: false, italic: false, strike: false, code: false, link: false,
        heading: codeblock ? 0 : p.level,
        list: codeblock || p.kind === 'h' ? null : p.kind,
        quote: !codeblock && p.quote !== '',
        codeblock
    };
    if (codeblock) return state;

    const a = s - ls;
    const b = Math.min(e, le) - ls;
    inlineSpans(line).forEach(sp => {
        const inside = a === b
            ? sp.start + sp.m <= a && a <= sp.end - sp.m
            : sp.start <= a && b <= sp.end;
        if (inside) state[sp.type] = true;
    });
    return state;
}

/**
 * Translate a character offset in `from` to the matching offset in `to`.
 * The two texts are expected to be near-identical (the same document before
 * and after a round trip through the rendered pane). Text outside the
 * changed region maps exactly; inside it, lines are aligned by a longest
 * common subsequence and the column is kept.
 */
function mapOffset(from, to, offset) {
    offset = Math.max(0, Math.min(from.length, offset));
    if (from === to) return offset;

    const max = Math.min(from.length, to.length);
    let p = 0;
    while (p < max && from.charCodeAt(p) === to.charCodeAt(p)) p++;
    // Before the first difference, or `to` only adds text after all of `from`
    if (offset < p || p === from.length) return offset;
    let x = 0;
    while (x < max - p && from.charCodeAt(from.length - 1 - x) === to.charCodeAt(to.length - 1 - x)) x++;
    if (x > 0 && offset >= from.length - x) return to.length - (from.length - offset);

    // Widen the changed region to whole lines.
    const top = from.lastIndexOf('\n', p - 1) + 1;
    let fromEnd = from.indexOf('\n', from.length - x);
    if (fromEnd === -1) fromEnd = from.length;
    const toEnd = to.length - (from.length - fromEnd);
    const A = from.slice(top, fromEnd).split('\n');
    const B = to.slice(top, Math.max(top, toEnd)).split('\n');

    // Line of the offset within A, and its column.
    let row = 0;
    let rowStart = top;
    while (row < A.length - 1 && rowStart + A[row].length < offset) {
        rowStart += A[row].length + 1;
        row++;
    }
    const col = offset - rowStart;

    const startOfB = j => {
        let at = top;
        for (let k = 0; k < j; k++) at += B[k].length + 1;
        return at;
    };

    if (A.length * B.length > 250000) {
        // Too large to align: keep the relative position.
        const ratio = (offset - top) / Math.max(1, fromEnd - top);
        return Math.min(to.length, top + Math.round(ratio * Math.max(0, toEnd - top)));
    }

    // Longest common subsequence over lines.
    const n = A.length;
    const m = B.length;
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const match = new Array(n).fill(-1);
    for (let i = 0, j = 0; i < n && j < m;) {
        if (A[i] === B[j]) { match[i] = j; i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else j++;
    }

    let target = match[row];
    if (target === -1) {
        // Unmatched line: pair it with the line at the same position in the
        // gap between the neighbouring matches, if there is one.
        let prev = row - 1;
        while (prev >= 0 && match[prev] === -1) prev--;
        let next = row + 1;
        while (next < n && match[next] === -1) next++;
        const gapStart = prev >= 0 ? match[prev] + 1 : 0;
        const gapEnd = next < n ? match[next] : m;
        const guess = gapStart + (row - prev - 1);
        if (guess < gapEnd) target = guess;
        else return Math.min(to.length, startOfB(gapEnd < m ? gapEnd : m - 1) + (gapEnd < m ? 0 : B[m - 1].length));
    }
    return Math.min(to.length, startOfB(target) + Math.min(col, B[target].length));
}

/**
 * Move an offset that sits inside a line's block prefix ("## ", "- ", "> ")
 * to the first character after it. Used before placing a caret marker so the
 * marker cannot break block syntax.
 */
function skipBlockPrefix(md, offset) {
    const ls = md.lastIndexOf('\n', offset - 1) + 1;
    let le = md.indexOf('\n', offset);
    if (le === -1) le = md.length;
    const prefix = parseLine(md.slice(ls, le)).prefix;
    return offset < ls + prefix ? ls + prefix : offset;
}

/**
 * Quikdown Editor - A drop-in markdown editor control
 * @license BSD-2-Clause
 */


/** Build-time version stamp (injected by rollup replaceVersion plugin) */
const quikdownEditorVersion = '1.3.1';

// Private-use characters that mark a selection's two ends while it is
// carried between the rendered pane and the markdown source.
const MARK_START = '\uE000';
const MARK_END = '\uE001';
const MARKS_RE = /[\uE000\uE001]/g;

/**
 * Curated safe HTML tag whitelist.
 * Pass to quikdown's `allow_unsafe_html` option to allow these tags
 * through while escaping everything else.  Callers can use this as-is,
 * pass a subset, or build their own object — any object whose keys are
 * lowercase tag names works.
 *
 * @example
 *   // Use the curated list
 *   quikdown(md, { allow_unsafe_html: QuikdownEditor.SAFE_HTML_TAGS });
 *
 *   // Or a minimal subset
 *   quikdown(md, { allow_unsafe_html: { img: 1, a: 1, br: 1 } });
 *
 *   // Or an array (converted internally)
 *   quikdown(md, { allow_unsafe_html: ['img', 'a', 'br'] });
 */
const SAFE_HTML_TAGS = {
    b:1, i:1, em:1, strong:1, del:1, s:1, u:1, mark:1, sup:1, sub:1,
    kbd:1, abbr:1, var:1, samp:1, cite:1, small:1, ins:1, dfn:1,
    ruby:1, rt:1, rp:1, time:1, wbr:1,
    img:1, picture:1, source:1, video:1, audio:1, figure:1, figcaption:1,
    a:1, br:1, hr:1,
    div:1, span:1, p:1, details:1, summary:1,
    section:1, article:1, aside:1, header:1, footer:1, nav:1, main:1,
    table:1, thead:1, tbody:1, tfoot:1, tr:1, th:1, td:1, caption:1, col:1, colgroup:1,
    ul:1, ol:1, li:1, dl:1, dt:1, dd:1,
    h1:1, h2:1, h3:1, h4:1, h5:1, h6:1,
    blockquote:1, pre:1, code:1
};

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
     * Developer's choice. `preloadFences` only affects the OPTIONAL fence
     * renderers, not the size of the editor bundle itself.
     */
    preloadFences: null,
    customFences: {}, // { 'language': (code, lang) => html }
    enableComplexFences: true, // Enable CSV tables, math rendering, SVG, etc.
    showUndoRedo: false,      // Show undo/redo toolbar buttons
    undoStackSize: 100,       // Maximum number of undo states to keep
    allowUnsafeHTML: false,   // false | 'limited' | true — controls HTML passthrough
    showAllowUnsafeHTML: false, // Show toolbar button to cycle HTML mode
    allowExternalFetch: true, // Allow fence renderers to fetch external resources (CDN, tiles, etc.)
    reference_links: false,   // Enable reference-style links [text][id]
    footnotes: false,         // Enable footnotes [^id]
    lineNumbers: false,       // Show line numbers beside the source pane
    shortcuts: true,          // Keyboard shortcuts (mode, undo/redo, bold, italic, list indent)
    mount: 'replace',         // 'replace' — take over the container; 'append' — add the editor as a child
    syncScroll: false,        // Keep the two panes at the same relative scroll position in split mode
    resolveImageSrc: null,    // (src, { alt, title }) => string — rewrite image URLs for display only
    onRender: null,           // (previewElement) => void — after every preview render
    onSelectionChange: null,  // ({ start, end, text, pane, format }) => void
    onLinkClick: null,        // (href, event) => void|true — return true to let the browser follow the link
    assetBase: null           // Directory URL for the standalone build's runtime assets (basemap *.topojson)
};

// MathJax reads its configuration from window.MathJax when its script runs,
// so the config object is put there before loading. If the load fails, the
// object must be removed again: it would otherwise look like a loaded library
// and no later render would retry.
let pendingMathJaxConfig = null;
const MATHJAX_RETRY_MS = 5000;

function configureMathJax() {
    if (!window.MathJax) {
        pendingMathJaxConfig = window.MathJax = {
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
                fontCache: 'none'  // self-contained SVGs (required for copy-rendered)
            },
            startup: { typeset: false }
        };
    }
}

function clearFailedMathJax() {
    if (window.MathJax && window.MathJax === pendingMathJaxConfig && !window.MathJax.version) {
        delete window.MathJax;
    }
    pendingMathJaxConfig = null;
    window._qde_mathjax_failed = Date.now();
}

// Script loads in flight, by URL, so two callers asking for the same library
// at the same time share one <script> element.
const scriptLoads = new Map();

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
        script: 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js',
        beforeLoad: configureMathJax,
        onError: clearFailedMathJax
    },
    geojson: {
        check: () => typeof window.L !== 'undefined',
        script: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    },
    stl: {
        check: () => typeof window.THREE !== 'undefined',
        script: 'https://unpkg.com/three@0.147.0/build/three.min.js'
    },
    abc: {
        check: () => typeof window.ABCJS !== 'undefined',
        script: 'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js'
    },
    music: {
        check: () => typeof window.ABCJS !== 'undefined',
        script: 'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js'
    },
    vega: {
        check: () => typeof window.vegaEmbed !== 'undefined',
        scripts: [
            'https://cdn.jsdelivr.net/npm/vega@5',
            'https://cdn.jsdelivr.net/npm/vega-lite@5',
            'https://cdn.jsdelivr.net/npm/vega-embed@6'
        ]
    }
};

/**
 * Quikdown Editor - A complete markdown editing solution
 */
class QuikdownEditor {
    constructor(container, options = {}) {
        // Resolve container
        const host = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!host) {
            throw new Error('QuikdownEditor: Invalid container');
        }

        // Merge options. Nested defaults are copied so that no two editors
        // (and no editor and the defaults) ever share a mutable object.
        this.options = { ...DEFAULT_OPTIONS, ...options };
        if (!options.plugins) this.options.plugins = { ...DEFAULT_OPTIONS.plugins };
        if (!options.customFences) this.options.customFences = {};

        // `host` is the element the caller passed in. `container` is the
        // editor's own root: the host itself (mount: 'replace') or a child
        // the editor adds and later removes (mount: 'append').
        this.host = host;
        if (this.options.mount === 'append') {
            this.container = document.createElement('div');
            host.appendChild(this.container);
        } else {
            this.container = host;
        }

        // State — everything below belongs to this instance only
        this._markdown = '';
        this._html = '';
        this.currentMode = ['source', 'split', 'preview'].includes(this.options.mode) ? this.options.mode : 'split';
        this.updateTimer = null;
        this._pending = null;        // pane ('source' | 'preview') with a debounced update waiting
        this._destroyed = false;
        this._listeners = [];        // [target, type, handler] for removal in destroy()
        this._timers = new Set();    // UI feedback timers, cleared in destroy()
        this._lastPane = null;       // pane the user last worked in
        this._savedRange = null;     // last selection range seen inside the preview
        this._previewFresh = false;  // preview DOM is an untouched render of _markdown
        this._blocks = null;         // cached preview block → source line map
        this._lineCache = [];        // source lines currently shown in the line-number layer
        this._lastSelKey = '';
        this._scrollLock = null;

        // Undo/redo state
        this._undoStack = [];
        this._redoStack = [];
        this._isUndoRedo = false;

        // Instance-level copy of fence libraries so custom entries
        // don't leak across editor instances.
        this._fenceLibraries = { ...FENCE_LIBRARIES };
        
        // Initialize
        this.initPromise = this.init();
    }
    
    /**
     * Initialize the editor
     */
    async init() {
        // Load plugins if requested
        await this.loadPlugins();

        // destroy() may have been called while libraries were loading
        if (this._destroyed) return;

        // Build UI
        this.buildUI();
        
        // Attach event listeners
        this.attachEvents();
        
        // Apply initial theme
        this.applyTheme();
        
        // Set initial mode
        this.setMode(this.currentMode);

        if (this.options.lineNumbers) this.setLineNumbers(true);
        
        // Set initial content if provided
        if (this.options.initialContent) {
            this._load(this.options.initialContent, 'api');
        }
    }

    /**
     * Add an event listener that destroy() will remove.
     * @private
     */
    _on(target, type, handler) {
        target.addEventListener(type, handler);
        this._listeners.push([target, type, handler]);
    }

    /**
     * setTimeout that is cancelled by destroy().
     * @private
     */
    _later(fn, ms) {
        const id = setTimeout(() => {
            this._timers.delete(id);
            fn();
        }, ms);
        this._timers.add(id);
        return id;
    }
    
    /**
     * Build the editor UI
     */
    buildUI() {
        // Clear container (in 'append' mode it is our own, empty element)
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

        // Line-number layer. It lies over the textarea, ignores the pointer,
        // and holds an invisible copy of each line so that a number sits at
        // the top of its line however the line wraps.
        this.lineNumbersEl = document.createElement('div');
        this.lineNumbersEl.className = 'qde-lines';
        this.lineNumbersEl.setAttribute('aria-hidden', 'true');
        this.sourcePanel.appendChild(this.lineNumbersEl);
        
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

        // Allow unsafe HTML toggle button (if enabled)
        if (this.options.showAllowUnsafeHTML) {
            const htmlModeBtn = document.createElement('button');
            htmlModeBtn.className = 'qde-btn';
            htmlModeBtn.dataset.action = 'toggle-html-mode';
            htmlModeBtn.textContent = this._getHtmlModeLabel(this.options.allowUnsafeHTML);
            htmlModeBtn.title = this._getHtmlModeTooltip(this.options.allowUnsafeHTML);
            toolbar.appendChild(htmlModeBtn);
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
                border: 1px solid var(--qde-border, #ddd);
                border-radius: var(--qde-radius, 4px);
                overflow: hidden;
                background: var(--qde-bg, white);
                color: var(--qde-fg, #1f2937);
            }
            
            .qde-toolbar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                padding: 8px;
                background: var(--qde-toolbar-bg, #f5f5f5);
                border-bottom: 1px solid var(--qde-border, #ddd);
                gap: 4px;
            }
            
            .qde-btn {
                padding: 6px 12px;
                border: 1px solid var(--qde-btn-border, #ccc);
                background: var(--qde-btn-bg, white);
                color: var(--qde-btn-fg, inherit);
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .qde-btn:hover {
                background: var(--qde-btn-hover-bg, #e9e9e9);
                border-color: var(--qde-btn-hover-border, #999);
            }
            
            .qde-btn.active {
                background: var(--qde-accent, #007bff);
                color: var(--qde-accent-fg, white);
                border-color: var(--qde-accent-border, #0056b3);
            }

            .qde-btn.disabled {
                opacity: 0.4;
                pointer-events: none;
            }
            .qde-btn[data-action="toggle-html-mode"] {
                position: relative;
            }
            .qde-btn[data-action="toggle-html-mode"]:hover::after {
                content: attr(title);
                position: absolute;
                bottom: calc(100% + 6px);
                left: 50%;
                transform: translateX(-50%);
                padding: 5px 10px;
                background: #1f2937;
                color: #fff;
                font-size: 0.75rem;
                font-weight: 400;
                white-space: nowrap;
                border-radius: 4px;
                pointer-events: none;
                z-index: 10;
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
                padding: var(--qde-padding, 16px);
                box-sizing: border-box;
            }

            .qde-source {
                border-right: 1px solid var(--qde-border, #ddd);
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
                padding: var(--qde-padding, 16px);
                box-sizing: border-box;
                font-family: var(--qde-source-font, 'Monaco', 'Courier New', monospace);
                font-size: var(--qde-source-font-size, var(--qde-font-size, 14px));
                line-height: var(--qde-source-line-height, 1.5);
                background: var(--qde-source-bg, transparent);
                color: var(--qde-source-fg, inherit);
                /* Wrap long lines so the textarea only scrolls VERTICALLY.
                   pre-wrap preserves intentional line breaks/whitespace
                   while soft-wrapping at the right edge. */
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-x: hidden;
                overflow-y: auto;
            }
            
            .qde-preview {
                font-family: var(--qde-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
                font-size: var(--qde-preview-font-size, var(--qde-font-size, 16px));
                line-height: var(--qde-line-height, 1.6);
                background: var(--qde-preview-bg, transparent);
                color: var(--qde-preview-fg, inherit);
                outline: none;
                cursor: text;  /* Standard text cursor */
                overflow-x: hidden;  /* never scroll horizontally; clip wide content */
            }

            /* Code blocks and inline code — self-contained so the editor
               does not depend on any external stylesheet for these. */
            .qde-preview pre {
                background: var(--qde-code-bg, #f4f4f4);
                color: var(--qde-code-fg, #1f2937);
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 0.6em 0;
                font-size: 0.9em;
                line-height: 1.5;
                font-family: var(--qde-code-font, ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace);
            }
            .qde-preview code {
                padding: 2px 4px;
                font-size: 0.9em;
                border-radius: 3px;
                background: var(--qde-inline-code-bg, var(--qde-code-bg, #f0f0f0));
                color: var(--qde-code-fg, #1f2937);
                font-family: var(--qde-code-font, ui-monospace, "SF Mono", Monaco, "Cascadia Code",
                             "Roboto Mono", Consolas, "Courier New", monospace);
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
            .qde-preview img {
                display: inline;
            }
            .qde-preview .leaflet-container { box-sizing: border-box; }
            .qde-preview .leaflet-container.qde-offline-map {
                background: #b8d4f0;
            }
            .qde-preview .leaflet-container.qde-offline-map path {
                shape-rendering: geometricPrecision;
            }
            .qde-dark .qde-preview .leaflet-container.qde-offline-map {
                background: #1a3048;
            }

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
                border: 1px solid var(--qde-table-border, var(--qde-border, #ddd));
                padding: 8px;
            }
            
            /* Support for alignment classes from quikdown */
            .qde-preview .quikdown-left { text-align: left; }
            .qde-preview .quikdown-center { text-align: center; }
            .qde-preview .quikdown-right { text-align: right; }
            
            .qde-preview table th {
                background: var(--qde-table-header-bg, #f5f5f5);
                font-weight: bold;
            }
            
            .qde-preview table tr:nth-child(even) {
                background: var(--qde-table-stripe-bg, #f9f9f9);
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
                background: var(--qde-bg, #1e1e1e);
                color: var(--qde-fg, #e0e0e0);
                border-color: var(--qde-border, #444);
            }
            
            .qde-dark .qde-toolbar {
                background: var(--qde-toolbar-bg, #2d2d2d);
                border-color: var(--qde-border, #444);
            }
            
            .qde-dark .qde-btn {
                background: var(--qde-btn-bg, #3a3a3a);
                color: var(--qde-btn-fg, #e0e0e0);
                border-color: var(--qde-btn-border, #555);
            }
            
            .qde-dark .qde-btn:hover {
                background: var(--qde-btn-hover-bg, #4a4a4a);
            }
            
            /* Line numbers: a layer over the textarea with the same font,
               padding and wrapping, so each row is as tall as its line. */
            .qde-lines {
                display: none;
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                width: 100%;
                margin: 0;
                overflow: hidden;
                pointer-events: none;
                user-select: none;
                -webkit-user-select: none;
                padding: var(--qde-padding, 16px);
                box-sizing: border-box;
                font-family: var(--qde-source-font, 'Monaco', 'Courier New', monospace);
                font-size: var(--qde-source-font-size, var(--qde-font-size, 14px));
                line-height: var(--qde-source-line-height, 1.5);
                white-space: pre-wrap;
                overflow-wrap: break-word;
                word-wrap: break-word;
                color: transparent;
                background: linear-gradient(to right,
                    var(--qde-gutter-bg, #f7f7f7) var(--qde-gutter-width, 4ch),
                    var(--qde-gutter-border, #ddd) var(--qde-gutter-width, 4ch),
                    var(--qde-gutter-border, #ddd) calc(var(--qde-gutter-width, 4ch) + 1px),
                    transparent calc(var(--qde-gutter-width, 4ch) + 1px));
            }
            .qde-line-numbers .qde-lines { display: block; }
            .qde-line-numbers .qde-textarea,
            .qde-line-numbers .qde-lines {
                padding-left: calc(var(--qde-gutter-width, 4ch) + 8px);
            }
            .qde-line { position: relative; }
            .qde-ln {
                position: absolute;
                right: 100%;
                margin-right: calc(8px + 1ch);
                white-space: nowrap;
                color: var(--qde-gutter-fg, #999);
            }

            .qde-dark .qde-source {
                border-color: var(--qde-border, #444);
            }

            .qde-dark .qde-lines {
                background: linear-gradient(to right,
                    var(--qde-gutter-bg, #252525) var(--qde-gutter-width, 4ch),
                    var(--qde-gutter-border, #444) var(--qde-gutter-width, 4ch),
                    var(--qde-gutter-border, #444) calc(var(--qde-gutter-width, 4ch) + 1px),
                    transparent calc(var(--qde-gutter-width, 4ch) + 1px));
            }
            .qde-dark .qde-ln { color: var(--qde-gutter-fg, #777); }
            
            .qde-dark .qde-textarea {
                background: var(--qde-source-bg, var(--qde-bg, #1e1e1e));
                color: var(--qde-source-fg, var(--qde-fg, #e0e0e0));
            }
            
            .qde-dark .qde-preview {
                background: var(--qde-preview-bg, var(--qde-bg, #1e1e1e));
                color: var(--qde-preview-fg, var(--qde-fg, #e0e0e0));
            }
            
            /* Dark mode code blocks */
            .qde-dark .qde-preview pre {
                background: var(--qde-code-bg, #2d2d3a);
                color: var(--qde-code-fg, #e6e6f0);
            }
            .qde-dark .qde-preview code {
                background: var(--qde-inline-code-bg, var(--qde-code-bg, #2a2a3a));
                color: var(--qde-code-fg, #e6e6f0);
            }
            .qde-dark .qde-preview pre code {
                background: transparent;
                color: inherit;
            }

            /* Dark mode table styles */
            .qde-dark .qde-preview table th,
            .qde-dark .qde-preview table td {
                border-color: var(--qde-table-border, var(--qde-border, #3a3a3a));
            }
            
            .qde-dark .qde-preview table th {
                background: var(--qde-table-header-bg, #2d2d2d);
            }
            
            .qde-dark .qde-preview table tr:nth-child(even) {
                background: var(--qde-table-stripe-bg, #252525);
            }
            
            /* Mobile split toggle — hidden by default */
            .qde-split-toggle { display: none; }

            /* Mobile responsive — compact toolbar for all small screens */
            @media (max-width: 720px) {
                .qde-toolbar {
                    padding: 6px;
                    gap: 3px;
                }
                .qde-btn {
                    padding: 5px 8px;
                    font-size: 12px;
                }
                .qde-source, .qde-preview {
                    padding: 10px;
                }
                .qde-textarea, .qde-lines {
                    padding: 10px;
                }
                /* Undo/Redo: show circular arrows instead of text */
                .qde-btn[data-action="undo"] { font-size: 0; }
                .qde-btn[data-action="undo"]::after { content: "\\21B6"; font-size: 14px; }
                .qde-btn[data-action="redo"] { font-size: 0; }
                .qde-btn[data-action="redo"]::after { content: "\\21B7"; font-size: 14px; }
                /* Hide secondary utility buttons to reduce clutter */
                .qde-btn[data-action="remove-hr"],
                .qde-btn[data-action="lazy-linefeeds"],
                .qde-btn[data-action="copy-rendered"] { display: none; }
            }

            /* Portrait mobile: drop split mode entirely */
            @media (max-width: 720px) and (orientation: portrait) {
                .qde-btn[data-mode="split"] { display: none; }
                .qde-split-toggle { display: none !important; }
                /* Fallback: if still in split mode, show source only */
                .qde-mode-split .qde-source { border-right: none; }
                .qde-mode-split .qde-preview { display: none; }
                .qde-mode-split.qde-split-preview .qde-source { display: none; }
                .qde-mode-split.qde-split-preview .qde-preview { display: block; }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Attach event listeners
     */
    attachEvents() {
        // Source textarea input
        this._on(this.sourceTextarea, 'input', () => {
            this._syncLineNumbers();
            this.handleSourceInput();
        });

        // Line numbers follow the textarea's scroll position and width
        this._on(this.sourceTextarea, 'scroll', () => {
            this.lineNumbersEl.scrollTop = this.sourceTextarea.scrollTop;
        });
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._syncLineNumbers());
            this._resizeObserver.observe(this.sourceTextarea);
        }

        // Preview contenteditable input
        this._on(this.previewPanel, 'input', () => {
            this.handlePreviewInput();
        });

        // Toolbar buttons
        if (this.toolbar) {
            this._on(this.toolbar, 'click', (e) => {
                const btn = e.target.closest('.qde-btn');
                if (!btn) return;

                // Mobile split-toggle button
                if (btn.classList.contains('qde-split-toggle')) {
                    this.setSplitPane(this.getSplitPane() === 'preview' ? 'source' : 'preview');
                    return;
                }

                if (btn.dataset.mode) {
                    this.setMode(btn.dataset.mode);
                } else if (btn.dataset.action) {
                    this.handleAction(btn.dataset.action);
                }
            });
        }

        // Keyboard shortcuts. The listener is on this editor's own element,
        // so a shortcut acts only on the editor that holds focus: other
        // editors and other inputs on the page are left alone.
        if (this.options.shortcuts) {
            this._on(this.container, 'keydown', (e) => this._handleKeydown(e));
        }

        // Track which pane the user is working in, so API calls made from a
        // host toolbar (which takes focus when clicked) still know the pane.
        ['focusin', 'mousedown', 'keydown', 'input'].forEach(type => {
            this._on(this.sourceTextarea, type, () => { this._lastPane = 'source'; });
            this._on(this.previewPanel, type, () => { this._lastPane = 'preview'; });
        });

        // Selection tracking. `selectionchange` only fires on the document;
        // the handler ignores selections outside this editor.
        this._on(document, 'selectionchange', () => this._handleSelectionChange());
        ['select', 'keyup', 'mouseup'].forEach(type => {
            this._on(this.sourceTextarea, type, () => this._handleSelectionChange());
        });

        // Link clicks in the rendered pane
        this._on(this.previewPanel, 'click', (e) => this._handlePreviewClick(e));

        // Scroll sync (no-op unless options.syncScroll is on)
        this._on(this.sourceTextarea, 'scroll', () => this._handleScroll('source'));
        this._on(this.previewPanel, 'scroll', () => this._handleScroll('preview'));

        // On narrow portrait viewports, auto-switch out of split mode to source.
        // Split is kept available on landscape where there is enough width.
        if (typeof window.matchMedia === 'function') {
            const portraitQuery = window.matchMedia('(max-width: 720px) and (orientation: portrait)');
            const switchIfPortrait = () => {
                if (!this._destroyed && portraitQuery.matches && this.currentMode === 'split') {
                    this.setMode('source');
                }
            };
            // Check after init's setMode() has run (microtask fires after sync code).
            Promise.resolve().then(switchIfPortrait);
            this._on(portraitQuery, 'change', switchIfPortrait);
        }
    }

    /**
     * Keyboard shortcuts for the editor that holds focus.
     * @private
     */
    _handleKeydown(e) {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey) {
            switch (e.key.toLowerCase()) {
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
                    e.preventDefault();
                    if (e.shiftKey) this.redo();
                    else this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'b':
                    if (e.shiftKey) break;
                    e.preventDefault();
                    this.format('bold');
                    break;
                case 'i':
                    if (e.shiftKey) break;
                    e.preventDefault();
                    this.format('italic');
                    break;
            }
        } else if (e.key === 'Tab' && !mod && !e.altKey) {
            // Tab / Shift+Tab indent and outdent list items. Outside a list
            // the key keeps its normal meaning (move focus).
            if (this.getFormatState().list) {
                e.preventDefault();
                this.format(e.shiftKey ? 'outdent' : 'indent');
            }
        }
    }

    /**
     * Save the preview selection and report selection changes to the host.
     * @private
     */
    _handleSelectionChange() {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        if (range && this._inPreview(range)) {
            this._savedRange = range.cloneRange();
            if (document.activeElement !== this.sourceTextarea) this._lastPane = 'preview';
        } else if (document.activeElement !== this.sourceTextarea) {
            return; // the selection is somewhere else on the page
        }
        this._notifySelection();
    }

    /**
     * Call onSelectionChange if the selection differs from the last report.
     * Skipped while a debounced edit is waiting; the update that follows
     * reports the selection itself.
     * @private
     */
    _notifySelection() {
        if (!this.options.onSelectionChange || this._pending) return;
        const sel = this.getSelection();
        const key = `${sel.pane}:${sel.start}:${sel.end}:${this._markdown.length}`;
        if (key === this._lastSelKey) return;
        this._lastSelKey = key;
        this.options.onSelectionChange({ ...sel, format: getFormatState(this._markdown, sel.start, sel.end) });
    }

    /**
     * Hand link clicks in the rendered pane to the host.
     * @private
     */
    _handlePreviewClick(e) {
        if (!this.options.onLinkClick) return;
        const link = e.target.closest ? e.target.closest('a[href]') : null;
        if (!link || !this.previewPanel.contains(link)) return;
        if (this.options.onLinkClick(link.getAttribute('href'), e) !== true) {
            e.preventDefault();
        }
    }

    /**
     * Mirror one pane's relative scroll position onto the other.
     * @private
     */
    _handleScroll(pane) {
        if (!this.options.syncScroll || this.currentMode !== 'split') return;
        if (this._scrollLock === pane) {
            // This event is the echo of the position we just wrote.
            this._scrollLock = null;
            return;
        }
        const from = pane === 'source' ? this.sourceTextarea : this.previewPanel;
        const to = pane === 'source' ? this.previewPanel : this.sourceTextarea;
        const range = from.scrollHeight - from.clientHeight;
        const ratio = range > 0 ? from.scrollTop / range : 0;
        const target = Math.round(ratio * Math.max(0, to.scrollHeight - to.clientHeight));
        if (Math.abs(to.scrollTop - target) > 1) {
            this._scrollLock = pane === 'source' ? 'preview' : 'source';
            to.scrollTop = target;
        }
    }

    /**
     * Handle source textarea input
     */
    handleSourceInput() {
        clearTimeout(this.updateTimer);
        this._pending = 'source';
        this.updateTimer = setTimeout(() => {
            this._pending = null;
            this.updateFromMarkdown(this.sourceTextarea.value, 'user');
        }, this.options.debounceDelay);
    }

    /**
     * Handle preview panel input
     */
    handlePreviewInput() {
        clearTimeout(this.updateTimer);
        this._pending = 'preview';
        this._previewFresh = false;
        this.updateTimer = setTimeout(() => {
            this._pending = null;
            this.updateFromHTML('user');
        }, this.options.debounceDelay);
    }

    /**
     * Apply any edit that is still waiting on the debounce timer, so that
     * the markdown, HTML and history are current. Called by every API
     * method that reads or changes the document.
     */
    flush() {
        if (!this._pending) return;
        const pane = this._pending;
        clearTimeout(this.updateTimer);
        this._pending = null;
        if (pane === 'source') this.updateFromMarkdown(this.sourceTextarea.value, 'user');
        else this.updateFromHTML('user');
    }

    /**
     * Render markdown to HTML with this editor's options.
     * @private
     */
    _renderMarkdown(markdown) {
        // Translate editor's allowUnsafeHTML to parser's allow_unsafe_html:
        //   false → false,  true → true,  'limited' → quikdown_bd.SAFE_HTML_TAGS
        const htmlMode = this.options.allowUnsafeHTML;
        const allowHtml = htmlMode === 'limited' ? SAFE_HTML_TAGS : htmlMode;

        return quikdown_bd(markdown, {
            fence_plugin: this.createFencePlugin(),
            lazy_linefeeds: this.options.lazy_linefeeds,
            inline_styles: this.options.inline_styles,
            allow_unsafe_html: allowHtml,
            reference_links: this.options.reference_links,
            footnotes: this.options.footnotes
        });
    }

    /**
     * Put the current HTML into the preview pane.
     * @private
     */
    _renderPreview() {
        if (!this._markdown.trim()) {
            this.previewPanel.innerHTML = '<div style="color: #999; font-style: italic; padding: 16px;">Start typing markdown in the source panel...</div>';
        } else {
            this.previewPanel.innerHTML = this._html;
            this._resolveImages();

            // Process all math elements with MathJax if loaded (like squibview)
            this._typesetMath(this.previewPanel);
        }
        this._previewFresh = true;
        this._blocks = null;
        this._savedRange = null;

        if (this.options.onRender) {
            this.options.onRender(this.previewPanel);
        }
    }

    /**
     * Rewrite image sources for display through options.resolveImageSrc.
     * The markdown keeps the original URL: it is stored in data-qd-src,
     * which the HTML → markdown conversion reads in preference to src.
     * @private
     */
    _resolveImages() {
        const resolve = this.options.resolveImageSrc;
        if (typeof resolve !== 'function') return;
        this.previewPanel.querySelectorAll('img').forEach(img => {
            const original = img.getAttribute('data-qd-src') || img.getAttribute('src') || '';
            const resolved = resolve(original, {
                alt: img.getAttribute('alt') || '',
                title: img.getAttribute('title') || ''
            });
            if (typeof resolved === 'string' && resolved !== img.getAttribute('src')) {
                img.setAttribute('data-qd-src', original);
                img.setAttribute('src', resolved);
            }
        });
    }

    /**
     * Report a change to the host.
     * @private
     */
    _emitChange(source) {
        this._lastSelKey = '';
        this._syncLineNumbers();
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html, { source });
        }
    }

    /**
     * Update from markdown source
     * @param {string} markdown
     * @param {string} [source='api'] reported to onChange as meta.source
     */
    updateFromMarkdown(markdown, source = 'api') {
        if (this._destroyed) return;

        // Push current state to undo stack before changing (unless this is an undo/redo operation)
        if (!this._isUndoRedo) {
            this._pushUndoState(markdown || '');
        }
        this._isUndoRedo = false;

        this._markdown = markdown || '';
        this._html = this._markdown.trim() ? this._renderMarkdown(this._markdown) : '';

        // Update preview if visible
        if (this.currentMode !== 'source') {
            this._renderPreview();
        } else {
            this._previewFresh = false;
            this._blocks = null;
        }

        this._emitChange(source);
        this._updateUndoButtons();
    }

    /**
     * Update from HTML preview
     * @param {string} [source='user'] reported to onChange as meta.source
     */
    updateFromHTML(source = 'user') {
        if (this._destroyed) return;

        // Clone the preview panel to avoid modifying the actual DOM
        const clonedPanel = this.previewPanel.cloneNode(true);

        // Pre-process special elements on the clone
        this.preprocessSpecialElements(clonedPanel);

        this._html = this.previewPanel.innerHTML;
        const newMarkdown = quikdown_bd.toMarkdown(clonedPanel, {
            fence_plugin: this.createFencePlugin()
        });

        // Push previous state to undo stack (now that we know the new markdown)
        this._pushUndoState(newMarkdown);
        this._isUndoRedo = false;

        this._markdown = newMarkdown;
        this._previewFresh = false;
        this._blocks = null;

        // Keep the source in step even while it is hidden, so a later
        // switch to source or split mode shows the current text.
        this.sourceTextarea.value = this._markdown;

        this._emitChange(source);
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
                    return `<pre><code class="language-${this.escapeHtml(lang)}">${this.escapeHtml(code)}</code></pre>`;
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

                    case 'abc':
                    case 'music':
                        return this.renderABC(code);

                    case 'vega':
                    case 'vega-lite':
                    case 'vegalite':
                        return this.renderVega(code, lang);
                }
            }
            
            // Syntax highlighting support - keep editable for bidirectional
            if (window.hljs && lang && hljs.getLanguage(lang)) {
                const highlighted = hljs.highlight(code, { language: lang }).value;
                // Don't add contenteditable="false" - the bidirectional system can extract text from the highlighted code
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${this.escapeHtml(lang)}"><code class="hljs language-${this.escapeHtml(lang)}">${highlighted}</code></pre>`;
            }
            
            // Default: let quikdown handle it
            return undefined;
        };
        
        // Reverse function to extract raw source from rendered HTML
        const reverse = (element) => {
            // Get the language from data attribute
            const lang = element.getAttribute('data-qd-lang') || '';
            let content;

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
            // Start at the root <svg> itself: nextNode() alone would skip it
            const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
            for (let node = svg; node; node = walker.nextNode()) {
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
     * Typeset math elements, handling both ready and not-yet-ready MathJax.
     * In the standalone bundle MathJax may be imported but its async startup
     * not yet complete, so typesetPromise is not available immediately.
     */
    _typesetMath(root) {
        const mathElements = (root || this.previewPanel || document).querySelectorAll('.math-display');
        if (mathElements.length === 0) return;
        const elements = Array.from(mathElements);

        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise(elements).catch(() => {});
        } else if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
            // Standalone bundle: MathJax imported but async startup not finished
            window.MathJax.startup.promise.then(() => {
                if (window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise(elements).catch(() => {});
                }
            }).catch(() => {});
        } else if (window.MathJax) {
            // MathJax config exists but startup not yet initialized — poll
            const poll = (n) => {
                if (n <= 0) return;
                setTimeout(() => {
                    if (!window.MathJax) return;
                    if (window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise(elements).catch(() => {});
                    } else if (window.MathJax.startup && window.MathJax.startup.promise) {
                        window.MathJax.startup.promise.then(() => {
                            if (window.MathJax && window.MathJax.typesetPromise) {
                                window.MathJax.typesetPromise(elements).catch(() => {});
                            }
                        }).catch(() => {});
                    } else {
                        poll(n - 1);
                    }
                }, 100);
            };
            poll(50);
        }
    }

    /**
     * Ensures MathJax is loaded (but doesn't process elements)
     */
    ensureMathJaxLoaded() {
        if (typeof window.MathJax === 'undefined' && !window.mathJaxLoading) {
            // After a failed load, wait before trying again so an offline
            // page does not request the script on every render.
            if (Date.now() - (window._qde_mathjax_failed || 0) < MATHJAX_RETRY_MS) return;
            window.mathJaxLoading = true;
            configureMathJax();

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
            script.async = true;
            script.onload = () => {
                window.mathJaxLoading = false;

                // Process any existing math elements (like squibview)
                this._typesetMath(this.previewPanel || document);
            };
            script.onerror = () => {
                window.mathJaxLoading = false;
                // Remove the config and the dead script so the next render retries
                clearFailedMathJax();
                script.remove();
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
                
                // Create the map — SVG basemap (not canvas) to avoid tile-clipping bands at world zoom
                const offlineVector = !this.options.allowExternalFetch;
                const mapOptions = {
                    zoomAnimation: !offlineVector,
                    fadeAnimation: !offlineVector
                };
                if (offlineVector) {
                    mapOptions.minZoom = 2;
                    mapOptions.maxBounds = [[-84, -180], [84, 180]];
                    mapOptions.maxBoundsViscosity = 0.85;
                }
                const map = L.map(mapId, mapOptions);
                if (offlineVector) {
                    map.getContainer().classList.add('qde-offline-map');
                    const tilePane = map.getPane('tilePane');
                    if (tilePane) tilePane.style.display = 'none';
                }

                // Store back-reference for capture (per Gem's guide)
                container._map = map; // Avoid window pollution

                // Add basemap — vector (offline) or OSM tiles (online)
                let tileLayer = null;
                const isDark = this.container.classList.contains('qde-dark');
                if (!this.options.allowExternalFetch && window._qde_worldGeoJSON) {
                    const basemapStyle = (zoom) => ({
                        weight: zoom < 4 ? 0.45 : zoom < 6 ? 0.75 : (isDark ? 1 : 1.1),
                        color: isDark ? '#b8b8b8' : '#1a1a1a',
                        fillColor: isDark ? '#3a3a3e' : '#ebe6d9',
                        fillOpacity: 1
                    });
                    const admin1Style = (zoom) => ({
                        weight: zoom < 6 ? 0.45 : (isDark ? 0.5 : 0.6),
                        color: isDark ? '#666' : '#555',
                        fillOpacity: 0,
                        fill: false
                    });

                    // Country fills — SVG renderer (canvas tiles clip large polygons at low zoom)
                    const countriesLayer = L.geoJSON(window._qde_worldGeoJSON, {
                        smoothFactor: 1.5,
                        style: () => basemapStyle(map.getZoom()),
                        interactive: false
                    }).addTo(map);

                    // Admin-1 hidden when zoomed out (dense lines read as horizontal banding)
                    let admin1Layer = null;
                    if (window._qde_admin1GeoJSON) {
                        admin1Layer = L.geoJSON(window._qde_admin1GeoJSON, {
                            smoothFactor: 1,
                            style: () => admin1Style(map.getZoom()),
                            interactive: false
                        });
                    }

                    const syncBasemapForZoom = () => {
                        const z = map.getZoom();
                        countriesLayer.setStyle(basemapStyle(z));
                        if (admin1Layer) {
                            if (z >= 5) {
                                admin1Layer.setStyle(admin1Style(z));
                                if (!map.hasLayer(admin1Layer)) admin1Layer.addTo(map);
                            } else if (map.hasLayer(admin1Layer)) {
                                map.removeLayer(admin1Layer);
                            }
                        }
                    };
                    map.on('zoomend', syncBasemapForZoom);
                    syncBasemapForZoom();
                } else if (this.options.allowExternalFetch) {
                    // Standard OSM tiles. With allowExternalFetch off and no
                    // offline basemap, the features are drawn with no
                    // background and no tile requests are made.
                    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '',
                        crossOrigin: 'anonymous' // Important for canvas capture
                    });
                    tileLayer.addTo(map);
                }
                
                // Add GeoJSON layer
                const geoJsonLayer = L.geoJSON(data);
                geoJsonLayer.addTo(map);
                
                // Fit bounds if valid
                const bounds = geoJsonLayer.getBounds();
                if (bounds.isValid()) {
                    const sw = bounds.getSouthWest();
                    const ne = bounds.getNorthEast();
                    if (sw.lat === ne.lat && sw.lng === ne.lng) {
                        // Single point — setView instead of fitBounds to avoid NaN
                        map.setView([sw.lat, sw.lng], 8);
                    } else {
                        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6 });
                    }
                } else {
                    map.setView([0, 0], 2);
                }
                
                // Store references for copy-time capture
                container._tileLayer = tileLayer;
                container._geoJsonLayer = geoJsonLayer;
                
                // Optional: Wait for tiles to load for better capture
                if (tileLayer) {
                    tileLayer.on('load', () => {
                        container.setAttribute('data-tiles-loaded', 'true');
                    });
                } else {
                    // Vector basemap — tiles always "loaded"
                    container.setAttribute('data-tiles-loaded', 'true');
                }
                
            } catch (err) {
                container.innerHTML = `<pre class="qde-error">GeoJSON error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };
        
        // Check if Leaflet is already loaded
        const runRender = () => {
            const needBasemap = !this.options.allowExternalFetch
                && !window._qde_worldGeoJSON
                && typeof window._qde_ensureBasemap === 'function';
            if (needBasemap) {
                window._qde_ensureBasemap(this.options.assetBase).then(() => renderMap()).catch(err => {
                    const el = document.getElementById(mapId + '-container');
                    if (el) {
                        el.innerHTML = `<pre class="qde-error">Basemap load failed: ${this.escapeHtml(err.message)}</pre>`;
                    }
                });
            } else {
                renderMap();
            }
        };

        if (window.L) {
            // Render after DOM update
            setTimeout(runRender, 0);
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
                    runRender();
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
     * Render ABC music notation
     */
    renderABC(code) {
        const id = `qde-abc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const renderNotation = () => {
            const element = document.getElementById(id);
            if (!element || !window.ABCJS) return;
            try {
                element.innerHTML = '';
                window.ABCJS.renderAbc(element, code, { responsive: 'resize' });
            } catch (err) {
                element.innerHTML = `<pre class="qde-error">ABC notation error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };

        if (window.ABCJS) {
            setTimeout(renderNotation, 0);
        } else {
            if (!window._qde_abcjs_loading) {
                window._qde_abcjs_loading = this.lazyLoadLibrary(
                    'ABCJS',
                    () => window.ABCJS,
                    'https://cdn.jsdelivr.net/npm/abcjs@6/dist/abcjs-basic-min.js'
                ).catch(err => {
                    console.warn('Failed to load ABCJS:', err);
                    window._qde_abcjs_loading = null;
                    return false;
                });
            }
            window._qde_abcjs_loading.then(loaded => {
                if (loaded) {
                    renderNotation();
                } else {
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load ABC notation library</div>';
                    }
                }
            });
        }

        const container = document.createElement('div');
        container.id = id;
        container.className = 'qde-abc-container';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-source', code);
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', 'abc');
        container.style.cssText = 'min-height: 80px; margin: 0.5em 0;';
        container.textContent = 'Loading music notation...';

        return container.outerHTML;
    }

    /**
     * Render Vega or Vega-Lite visualization
     */
    renderVega(code, lang) {
        const id = `qde-vega-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const renderChart = () => {
            const element = document.getElementById(id);
            if (!element || !window.vegaEmbed) return;
            try {
                const spec = JSON.parse(code);
                // If using vega-lite alias, ensure $schema is set for vega-lite
                if ((lang === 'vega-lite' || lang === 'vegalite') && !spec.$schema) {
                    spec.$schema = 'https://vega.github.io/schema/vega-lite/v5.json';
                }
                // Warn about external URL data sources when allowExternalFetch is off
                if (!this.options.allowExternalFetch) {
                    const specStr = JSON.stringify(spec);
                    if (/"url"\s*:/.test(specStr)) {
                        element.innerHTML = '<div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404; font-size: 0.9em;">⚠ This Vega spec references external data URLs. External fetch is disabled in offline mode. Use inline <code>"values"</code> instead.</div>';
                        return;
                    }
                }
                window.vegaEmbed(element, spec, { renderer: 'svg', actions: false }).catch(err => {
                    element.innerHTML = `<pre class="qde-error">Vega error: ${this.escapeHtml(err.message)}</pre>`;
                });
            } catch (err) {
                element.innerHTML = `<pre class="qde-error">Vega JSON error: ${this.escapeHtml(err.message)}</pre>`;
            }
        };

        if (window.vegaEmbed) {
            setTimeout(renderChart, 0);
        } else {
            if (!window._qde_vega_loading) {
                // Vega-Embed requires vega + vega-lite loaded first (peer deps)
                window._qde_vega_loading = (async () => {
                    try {
                        await this.loadScript('https://cdn.jsdelivr.net/npm/vega@5');
                        await this.loadScript('https://cdn.jsdelivr.net/npm/vega-lite@5');
                        await this.loadScript('https://cdn.jsdelivr.net/npm/vega-embed@6');
                        return !!window.vegaEmbed;
                    } catch (err) {
                        console.warn('Failed to load Vega:', err);
                        window._qde_vega_loading = null;
                        return false;
                    }
                })();
            }
            window._qde_vega_loading.then(loaded => {
                if (loaded) {
                    renderChart();
                } else {
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Failed to load Vega visualization library</div>';
                    }
                }
            });
        }

        const container = document.createElement('div');
        container.id = id;
        container.className = 'qde-vega-container';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-source', code);
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', lang);
        container.style.cssText = 'min-height: 100px; margin: 0.5em 0;';
        container.textContent = 'Loading visualization...';

        return container.outerHTML;
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
                    element.innerHTML = `<pre>Error rendering diagram: ${this.escapeHtml(err.message)}</pre>`;
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
     * Load plugins dynamically — honors both `plugins: { highlightjs, mermaid }`
     * (legacy) and the newer `preloadFences` option which can preload any
     * combination of fence libraries (or 'all') at construction time.
     */
    async loadPlugins() {
        const namesToLoad = new Set();

        // Legacy plugins option
        if (this.options.plugins.highlightjs) namesToLoad.add('highlightjs');
        if (this.options.plugins.mermaid)     namesToLoad.add('mermaid');

        // New preloadFences option
        const pf = this.options.preloadFences;
        if (pf === 'all') {
            Object.keys(this._fenceLibraries).forEach(n => namesToLoad.add(n));
        } else if (Array.isArray(pf)) {
            for (const entry of pf) {
                if (typeof entry === 'string') {
                    if (this._fenceLibraries[entry]) namesToLoad.add(entry);
                    else console.warn(`QuikdownEditor: unknown preloadFences entry "${entry}"`);
                } else if (entry && typeof entry === 'object' && entry.script) {
                    // Custom library: { name, script, css? }
                    namesToLoad.add('__custom__:' + (entry.name || entry.script));
                    this._fenceLibraries['__custom__:' + (entry.name || entry.script)] = {
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
            const lib = this._fenceLibraries[name];
            if (!lib || lib.check()) continue;
            if (lib.beforeLoad) lib.beforeLoad();
            const p = (async () => {
                try {
                    const tasks = [];
                    // scripts (array) = sequential deps; script (string) = single load
                    if (lib.scripts) {
                        for (const s of lib.scripts) await this.loadScript(s);
                    } else if (lib.script) {
                        tasks.push(this.loadScript(lib.script));
                    }
                    // Only the highlight.js pair is theme-switched by id; other
                    // libraries' CSS must stay enabled in both themes.
                    if (lib.css)    tasks.push(this.loadCSS(lib.css, lib.cssDark ? 'qde-hljs-light' : undefined));
                    if (lib.cssDark) tasks.push(this.loadCSS(lib.cssDark, 'qde-hljs-dark'));
                    await Promise.all(tasks);
                    if (lib.css && lib.cssDark) this._syncHljsTheme();
                    if (lib.afterLoad) lib.afterLoad();
                } catch (err) {
                    if (lib.onError) lib.onError();
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
        const pending = scriptLoads.get(src);
        if (pending && pending.script.isConnected) return pending.promise;

        const script = document.createElement('script');
        const promise = new Promise((resolve, reject) => {
            script.src = src;
            script.onload = (event) => {
                scriptLoads.delete(src);
                resolve(event);
            };
            script.onerror = (event) => {
                scriptLoads.delete(src);
                script.remove();
                reject(event);
            };
            document.head.appendChild(script);
        });
        scriptLoads.set(src, { script, promise });
        return promise;
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
     * Show or hide line numbers beside the source pane.
     * @param {boolean} enabled
     */
    setLineNumbers(enabled) {
        this.options.lineNumbers = !!enabled;
        this.container.classList.toggle('qde-line-numbers', this.options.lineNumbers);
        if (this.options.lineNumbers) {
            this._syncLineNumbers();
        } else {
            if (this.lineNumbersEl) this.lineNumbersEl.textContent = '';
            this._lineCache = [];
            this.container.style.removeProperty('--qde-gutter-width');
        }
    }

    /**
     * Whether line numbers are shown.
     * @returns {boolean}
     */
    getLineNumbers() {
        return !!this.options.lineNumbers;
    }

    // Bring the line-number layer in line with the textarea: one row per
    // line of text, the same width, the same scroll position. Only the rows
    // that changed since the last call are touched.
    _syncLineNumbers() {
        if (!this.options.lineNumbers || !this.lineNumbersEl) return;
        const layer = this.lineNumbersEl;
        const lines = this.sourceTextarea.value.split('\n');
        const old = this._lineCache;

        // Lines unchanged at the start and at the end keep their rows
        const max = Math.min(old.length, lines.length);
        let head = 0;
        while (head < max && old[head] === lines[head]) head++;
        let tail = 0;
        while (tail < max - head && old[old.length - 1 - tail] === lines[lines.length - 1 - tail]) tail++;

        for (let i = old.length - tail - head; i > 0; i--) layer.children[head].remove();
        const before = layer.children[head] || null;
        for (let i = head; i < lines.length - tail; i++) {
            const row = document.createElement('div');
            row.className = 'qde-line';
            const number = document.createElement('span');
            number.className = 'qde-ln';
            number.textContent = String(i + 1);
            row.appendChild(number);
            // An empty line still needs content to be one line tall
            row.appendChild(document.createTextNode(lines[i] || '\u200b'));
            layer.insertBefore(row, before);
        }
        if (old.length !== lines.length) {
            // Rows after the change moved up or down: renumber them
            for (let i = lines.length - tail; i < lines.length; i++) {
                layer.children[i].firstChild.textContent = String(i + 1);
            }
            // Room for the widest number, and at least two digits
            const digits = Math.max(2, String(lines.length).length);
            this.container.style.setProperty('--qde-gutter-width', `${digits + 2}ch`);
        }
        this._lineCache = lines;

        // Match the textarea's inner width, which excludes its scrollbar
        const width = this.sourceTextarea.clientWidth;
        if (width) layer.style.width = `${width}px`;
        layer.scrollTop = this.sourceTextarea.scrollTop;
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

        // Apply any edit still waiting on the debounce timer before the
        // panes change visibility.
        this.flush();

        const previousMode = this.currentMode;
        this.currentMode = mode;

        // Swap only the editor's own mode classes; the theme class and any
        // classes the host put on the element stay.
        const classes = this.container.classList;
        classes.add('qde-container');
        classes.remove('qde-mode-source', 'qde-mode-split', 'qde-mode-preview', 'qde-split-preview');
        classes.add(`qde-mode-${mode}`);

        this._syncSplitToggle();

        // Update toolbar buttons
        if (this.toolbar) {
            this.toolbar.querySelectorAll('.qde-btn[data-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }

        // If the preview was hidden (source-only) it may have missed content
        // updates. Re-render it now, including MathJax typesetting.
        // Do NOT re-render if the preview was already visible — that would
        // destroy MathJax-typeset SVG output with raw pre-typeset HTML.
        if (mode !== 'source' && previousMode === 'source' && this._html) {
            this._renderPreview();
        }

        // The source pane may have just become visible or changed width
        this._syncLineNumbers();

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
        this.flush();
        if (!this.canUndo()) return;
        // Save current state to redo stack
        this._redoStack.push(this._markdown);
        const previous = this._undoStack.pop();
        this._isUndoRedo = true;
        this.sourceTextarea.value = previous;
        this.updateFromMarkdown(previous, 'undo');
    }

    /**
     * Redo the last undone change.
     */
    redo() {
        this.flush();
        if (!this.canRedo()) return;
        // Save current state to undo stack
        this._undoStack.push(this._markdown);
        const next = this._redoStack.pop();
        this._isUndoRedo = true;
        this.sourceTextarea.value = next;
        this.updateFromMarkdown(next, 'redo');
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
     * Snapshot of the undo and redo stacks, for hosts that keep one
     * history per document. The arrays are copies.
     * @returns {{undo: string[], redo: string[]}}
     */
    getHistory() {
        this.flush();
        return { undo: this._undoStack.slice(), redo: this._redoStack.slice() };
    }

    /**
     * Replace the undo and redo stacks with a snapshot from getHistory().
     * @param {{undo?: string[], redo?: string[]}} [state] omitted or invalid parts become empty
     */
    setHistory(state) {
        const clean = list => (Array.isArray(list) ? list.filter(item => typeof item === 'string') : []);
        const max = this.options.undoStackSize || 100;
        this._undoStack = clean(state && state.undo).slice(-max);
        this._redoStack = clean(state && state.redo).slice(-max);
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
            case 'toggle-html-mode':
                this.cycleAllowUnsafeHTML();
                break;
        }
    }
    
    /**
     * Copy content to clipboard
     */
    async copy(type) {
        this.flush();
        const content = type === 'markdown' ? this._markdown : this._html;
        
        try {
            await navigator.clipboard.writeText(content);
            
            // Visual feedback
            const btn = this.toolbar?.querySelector(`[data-action="copy-${type}"]`);
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                this._later(() => {
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
     * Get current mode: 'source', 'split' or 'preview'.
     * @returns {'source'|'split'|'preview'}
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * Choose which pane split mode shows when the editor is too narrow to
     * show both side by side (the toolbar's Preview/Source toggle). On a wide
     * editor both panes stay visible and this has no visible effect. Changing
     * mode with setMode() resets it to 'source'.
     * @param {'source'|'preview'} pane
     */
    setSplitPane(pane) {
        if (pane !== 'source' && pane !== 'preview') return;
        this.container.classList.toggle('qde-split-preview', pane === 'preview');
        this._syncSplitToggle();
    }

    /**
     * The pane split mode shows on a narrow editor: 'source' or 'preview'.
     * @returns {'source'|'preview'}
     */
    getSplitPane() {
        return this.container.classList.contains('qde-split-preview') ? 'preview' : 'source';
    }

    // The toggle button names the pane a click would switch to
    _syncSplitToggle() {
        const label = this.getSplitPane() === 'preview' ? 'Source' : 'Preview';
        this.toolbar?.querySelectorAll('.qde-split-toggle').forEach(toggle => { toggle.textContent = label; });
    }

    /**
     * Set markdown content
     * @param {string} markdown
     * @param {Object} [options]
     * @param {'keep'|'reset'|'push'} [options.history='keep'] 'keep' leaves the
     *        undo history as it is, 'reset' clears it (use when loading a
     *        different document), 'push' records the replaced text as an undo step
     * @param {string} [options.source='api'] reported to onChange as meta.source
     */
    async setMarkdown(markdown, options = {}) {
        // Wait for initialization if needed
        if (this.initPromise) {
            await this.initPromise;
        }
        if (this._destroyed) return;
        this._load(markdown, options.source || 'api', options.history);
    }

    /**
     * Synchronous core of setMarkdown().
     * @private
     */
    _load(markdown, source, history) {
        const text = markdown === null || markdown === undefined ? '' : String(markdown);
        clearTimeout(this.updateTimer);
        this._pending = null;
        if (history === 'reset') {
            this._undoStack = [];
            this._redoStack = [];
        }
        // 'keep' (the default) replaces the text without adding an undo step
        if (history !== 'push') this._isUndoRedo = true;
        this.sourceTextarea.value = text;
        this.updateFromMarkdown(text, source);
    }

    /**
     * Get markdown content
     */
    getMarkdown() {
        this.flush();
        return this._markdown;
    }

    /**
     * Get HTML content
     */
    getHTML() {
        this.flush();
        return this._html;
    }

    // --- Selection, cursor and text edits ---

    /**
     * Which pane has keyboard focus.
     * @returns {'source'|'preview'|null} null when focus is outside the editor
     */
    getFocusedPane() {
        const active = document.activeElement;
        if (active === this.sourceTextarea) return 'source';
        if (active && this.previewPanel.contains(active)) return 'preview';
        return null;
    }

    /**
     * The pane API calls act on: the focused pane, else the pane the user
     * last worked in, limited to what the current mode shows.
     * @private
     */
    _activePane() {
        if (this.currentMode === 'source') return 'source';
        if (this.currentMode === 'preview') return 'preview';
        return this.getFocusedPane() || this._lastPane || 'source';
    }

    /** @private */
    _inPreview(range) {
        return this.previewPanel.contains(range.startContainer) && this.previewPanel.contains(range.endContainer);
    }

    /**
     * Current (or last seen) selection range inside the preview.
     * @private
     */
    _previewRange() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && this._inPreview(sel.getRangeAt(0))) return sel.getRangeAt(0);
        if (this._savedRange && this._inPreview(this._savedRange)) return this._savedRange;
        return null;
    }

    /**
     * Convert a copy of the preview to markdown after `mark(clone, locate)`
     * has dropped marker text into the copy. `locate(node)` returns the
     * copy's counterpart of a node in the live preview.
     * @private
     */
    _markedMarkdown(mark) {
        const clone = this.previewPanel.cloneNode(true);
        const locate = (node) => {
            const path = [];
            for (let n = node; n !== this.previewPanel; n = n.parentNode) {
                path.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n));
            }
            return path.reduce((at, index) => at.childNodes[index], clone);
        };
        mark(clone, locate);
        this.preprocessSpecialElements(clone);
        return quikdown_bd.toMarkdown(clone, { fence_plugin: this.createFencePlugin() });
    }

    /**
     * The preview selection as offsets into the markdown the preview
     * converts to. Null when there is no selection in the preview or its
     * ends fall inside content that has no text of its own in the markdown.
     * @private
     */
    _previewSelection() {
        const range = this._previewRange();
        if (!range) return null;
        const marked = this._markedMarkdown((clone, locate) => {
            const put = (node, offset, mark) => {
                const target = locate(node);
                if (target.nodeType === 3) target.insertData(offset, mark);
                else target.insertBefore(document.createTextNode(mark), target.childNodes[offset] || null);
            };
            // End first, so the start offset is still valid in a shared node
            put(range.endContainer, range.endOffset, MARK_END);
            put(range.startContainer, range.startOffset, MARK_START);
        });
        const a = marked.indexOf(MARK_START);
        const b = marked.indexOf(MARK_END);
        if (a === -1 || b === -1) return null;
        return {
            markdown: marked.replace(MARKS_RE, ''),
            start: Math.min(a, b),
            end: Math.max(a, b) - 1
        };
    }

    /**
     * Current selection as character offsets into the markdown, whichever
     * pane the user is in. A caret is a selection with start === end.
     * @returns {{start: number, end: number, text: string, pane: 'source'|'preview'}}
     */
    getSelection() {
        this.flush();
        const pane = this._activePane();
        const md = this._markdown;
        if (pane === 'preview') {
            const found = this._previewSelection();
            if (found) {
                const start = mapOffset(found.markdown, md, found.start);
                const end = Math.max(start, mapOffset(found.markdown, md, found.end));
                return { start, end, text: md.slice(start, end), pane };
            }
        }
        const start = Math.min(md.length, this.sourceTextarea.selectionStart || 0);
        const end = Math.min(md.length, Math.max(start, this.sourceTextarea.selectionEnd || 0));
        return { start, end, text: md.slice(start, end), pane };
    }

    /**
     * Select a range of the markdown (or place the caret when end is omitted).
     * In the rendered pane the matching rendered text is selected.
     * @param {number} start
     * @param {number} [end=start]
     * @param {'source'|'preview'} [pane] defaults to the pane the user is in
     * @returns {{start: number, end: number}} the clamped range
     */
    setSelection(start, end = start, pane) {
        this.flush();
        const len = this._markdown.length;
        let a = Math.max(0, Math.min(len, Number(start) || 0));
        let b = Math.max(0, Math.min(len, Number(end) || 0));
        if (a > b) [a, b] = [b, a];

        // The source pane always carries the selection, so it is already
        // in place when the user switches panes.
        this.sourceTextarea.setSelectionRange(a, b);

        const target = pane === 'source' || pane === 'preview' ? pane : this._activePane();
        if (target === 'preview' && this.currentMode !== 'source') {
            this._selectInPreview(a, b);
        }
        this._lastSelKey = '';
        return { start: a, end: b };
    }

    /**
     * Select the rendered text that corresponds to markdown offsets.
     * Renders a marked copy of the document off-screen to find where the
     * two ends land, then selects the same places in the live preview.
     * @private
     */
    _selectInPreview(start, end) {
        // The live preview must be an untouched render for positions found
        // in the off-screen copy to line up with it.
        if (!this._previewFresh) this._renderPreview();

        const md = this._markdown;
        const a = skipBlockPrefix(md, start);
        const b = Math.max(a, skipBlockPrefix(md, end));
        const scratch = document.createElement('div');
        scratch.innerHTML = this._renderMarkdown(md.slice(0, a) + MARK_START + md.slice(a, b) + MARK_END + md.slice(b));

        // Find a marker in the copy, remove it, and describe where it was.
        const take = (mark) => {
            const walker = document.createTreeWalker(scratch, 4 /* NodeFilter.SHOW_TEXT */);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const at = node.data.indexOf(mark);
                if (at === -1) continue;
                node.deleteData(at, 1);
                let anchor = node;
                let offset = at;
                let text = node.data.replace(MARKS_RE, '');
                if (text === '') {
                    // The marker stood alone between elements
                    anchor = node.parentNode;
                    offset = Array.prototype.indexOf.call(anchor.childNodes, node);
                    anchor.removeChild(node);
                    text = null;
                }
                const path = [];
                for (let n = anchor; n !== scratch; n = n.parentNode) {
                    path.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n));
                }
                return { path, offset, text };
            }
            return null;
        };

        // Resolve a description against the live preview, or fall back to
        // the start of the block that holds the offset.
        const resolve = (point, offset) => {
            if (point) {
                let node = this.previewPanel;
                for (const index of point.path) {
                    node = node && node.childNodes[index];
                }
                if (node && point.text !== null && node.nodeType === 3 && node.data === point.text) {
                    return [node, Math.min(point.offset, node.data.length)];
                }
                if (node && point.text === null && node.nodeType === 1 && point.offset <= node.childNodes.length) {
                    return [node, point.offset];
                }
            }
            const block = this._blockAt(this._markdown.slice(0, offset).split('\n').length - 1);
            return [block || this.previewPanel, 0];
        };

        const from = resolve(take(MARK_START), start);
        const to = start === end ? from : resolve(take(MARK_END), end);
        const range = document.createRange();
        range.setStart(from[0], from[1]);
        range.setEnd(to[0], to[1]);
        if (range.collapsed && start !== end) range.setEnd(from[0], from[1]);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        this._savedRange = range.cloneRange();
    }

    /**
     * Move keyboard focus into the editor.
     * @param {'source'|'preview'} [pane] defaults to the pane the user is in;
     *        a pane the current mode hides falls back to the visible one
     */
    focus(pane) {
        let target = pane === 'source' || pane === 'preview' ? pane : this._activePane();
        if (this.currentMode === 'source') target = 'source';
        if (this.currentMode === 'preview') target = 'preview';
        this._lastPane = target;
        if (target === 'source') {
            this.sourceTextarea.focus();
            return;
        }
        this.previewPanel.focus();
        if (this._savedRange && this._inPreview(this._savedRange)) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this._savedRange);
        }
    }

    /**
     * Replace the document with an edited version and restore view state.
     * Every programmatic edit goes through here so it reaches the history,
     * the other pane and onChange the same way typing does.
     * @private
     */
    _applyEdit(markdown, start, end, source, pane) {
        clearTimeout(this.updateTimer);
        this._pending = null;
        const scroll = this.getScroll();
        this.sourceTextarea.value = markdown;
        this.updateFromMarkdown(markdown, source);
        this.setScroll(scroll);
        return this.setSelection(start, end, pane);
    }

    /**
     * Replace a range of the markdown.
     * @param {number} start
     * @param {number} end
     * @param {string} text
     * @param {boolean} [select=false] select the inserted text instead of placing the caret after it
     * @returns {{start: number, end: number}} the resulting selection
     */
    replaceRange(start, end, text, select = false) {
        this.flush();
        const md = this._markdown;
        let a = Math.max(0, Math.min(md.length, Number(start) || 0));
        let b = Math.max(0, Math.min(md.length, Number(end) || 0));
        if (a > b) [a, b] = [b, a];
        const insert = text === null || text === undefined ? '' : String(text);
        const pane = this._activePane();
        const to = a + insert.length;
        return this._applyEdit(md.slice(0, a) + insert + md.slice(b), select ? a : to, to, 'edit', pane);
    }

    /**
     * Insert text at the caret, replacing the selection if there is one.
     * @param {string} text
     * @returns {{start: number, end: number}} the caret after the inserted text
     */
    insertText(text) {
        const sel = this.getSelection();
        return this.replaceRange(sel.start, sel.end, text);
    }

    // --- Formatting ---

    /**
     * Apply a formatting command to the selection in whichever pane the
     * user is in. Inline commands toggle.
     *
     * Commands: bold, italic, strike, code, link (value: URL; null removes),
     * h1…h6, heading (value: 0–6), paragraph, ul, ol, task, quote,
     * codeblock (value: language), hr, table (value: { rows, cols }),
     * indent, outdent.
     *
     * @param {string} command
     * @param {*} [value]
     * @returns {boolean} false for an unknown command
     */
    format(command, value) {
        const sel = this.getSelection();
        const next = formatMarkdown(this._markdown, sel.start, sel.end, command, value);
        if (!next) return false;
        if (next.markdown === this._markdown) {
            this.setSelection(next.start, next.end, sel.pane);
        } else {
            this._applyEdit(next.markdown, next.start, next.end, 'format', sel.pane);
        }
        return true;
    }

    /**
     * Formatting at the caret or selection, for toolbar pressed states.
     * @returns {{bold: boolean, italic: boolean, strike: boolean, code: boolean, link: boolean,
     *            heading: number, list: ('ul'|'ol'|'task'|null), quote: boolean, codeblock: boolean}}
     */
    getFormatState() {
        const sel = this.getSelection();
        return getFormatState(this._markdown, sel.start, sel.end);
    }

    // --- Scroll and line mapping ---

    /**
     * Scroll positions of both panes.
     * @returns {{source: number, preview: number}}
     */
    getScroll() {
        return { source: this.sourceTextarea.scrollTop, preview: this.previewPanel.scrollTop };
    }

    /**
     * Restore scroll positions from getScroll(). Either field may be omitted.
     * @param {{source?: number, preview?: number}} [scroll]
     */
    setScroll(scroll) {
        if (!scroll) return;
        if (Number.isFinite(scroll.source)) {
            this._scrollLock = null;
            this.sourceTextarea.scrollTop = scroll.source;
        }
        if (Number.isFinite(scroll.preview)) {
            this._scrollLock = null;
            this.previewPanel.scrollTop = scroll.preview;
        }
    }

    /**
     * Top-level preview blocks with the zero-based source line each starts on.
     * Built on demand (one HTML → markdown pass) and cached until the next
     * render or edit.
     * @private
     */
    _blockMap() {
        if (this._blocks) return this._blocks;
        const blocks = [];
        if (this._markdown.trim() && this.currentMode !== 'source') {
            const live = Array.from(this.previewPanel.children);
            const marked = this._markedMarkdown((clone) => {
                Array.from(clone.children).forEach((el, i) => {
                    clone.insertBefore(document.createTextNode(MARK_START + i + MARK_END), el);
                });
            });
            let clean = '';
            let last = 0;
            const found = [];
            marked.replace(/(\d+)/g, (match, index, at) => {
                clean += marked.slice(last, at);
                last = at + match.length;
                found.push({ el: live[Number(index)], offset: clean.length });
                return match;
            });
            clean += marked.slice(last);
            found.forEach(item => {
                let at = item.offset;
                while (at < clean.length && /\s/.test(clean[at])) at++;
                const offset = mapOffset(clean, this._markdown, at);
                blocks.push({ el: item.el, line: this._markdown.slice(0, offset).split('\n').length - 1 });
            });
        }
        this._blocks = blocks;
        return blocks;
    }

    /**
     * The preview block that holds a source line.
     * @private
     */
    _blockAt(line) {
        let hit = null;
        for (const block of this._blockMap()) {
            if (block.line > line && hit) break;
            hit = block.el;
        }
        return hit;
    }

    /**
     * Zero-based source line of an element in the rendered pane.
     * @param {Element} element
     * @returns {number} -1 when the element is not in the preview
     */
    lineOf(element) {
        this.flush();
        if (!element || element === this.previewPanel || !this.previewPanel.contains(element)) return -1;

        const lineAt = (marked) => {
            const at = marked.indexOf(MARK_START);
            if (at === -1) return -1;
            const clean = marked.replace(MARKS_RE, '');
            let pos = at;
            while (pos < clean.length && /\s/.test(clean[pos])) pos++;
            return this._markdown.slice(0, mapOffset(clean, this._markdown, pos)).split('\n').length - 1;
        };

        // A marker as the element's first text, then one just before it
        let line = lineAt(this._markedMarkdown((clone, locate) => {
            const target = locate(element);
            target.insertBefore(document.createTextNode(MARK_START), target.firstChild);
        }));
        if (line === -1) {
            line = lineAt(this._markedMarkdown((clone, locate) => {
                const target = locate(element);
                target.parentNode.insertBefore(document.createTextNode(MARK_START), target);
            }));
        }
        if (line !== -1) return line;

        // Fall back to the top-level block that contains the element
        let top = element;
        while (top.parentNode !== this.previewPanel) top = top.parentNode;
        const block = this._blockMap().find(item => item.el === top);
        return block ? block.line : -1;
    }

    /**
     * Scroll a zero-based source line into view.
     * @param {number} line
     * @param {'source'|'preview'} [pane] omitted scrolls both panes
     * @returns {Element|null} the preview block that was scrolled to, if any
     */
    scrollToLine(line, pane) {
        this.flush();
        const total = this._markdown.split('\n').length;
        const n = Math.max(0, Math.min(total - 1, Math.floor(Number(line)) || 0));
        let block = null;

        if (pane !== 'preview') {
            const ta = this.sourceTextarea;
            const lineHeight = parseFloat(window.getComputedStyle(ta).lineHeight);
            this._scrollLock = null;
            ta.scrollTop = Number.isFinite(lineHeight)
                ? n * lineHeight
                : (n / total) * ta.scrollHeight;
        }
        if (pane !== 'source' && this.currentMode !== 'source') {
            block = this._blockAt(n);
            if (block) {
                const panel = this.previewPanel;
                this._scrollLock = null;
                panel.scrollTop += block.getBoundingClientRect().top - panel.getBoundingClientRect().top;
            }
        }
        return block;
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
            this._later(() => {
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
            this._later(() => {
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
     * @param {string} [output='default'] - Output profile: 'default', 'quikdown', or 'stripped'
     */
    async copyRendered(output = 'default') {
        try {
            const result = await getRenderedContent(this.previewPanel, { output });
            if (result.success) {
                // Visual feedback
                const btn = this.toolbar?.querySelector('[data-action="copy-rendered"]');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    this._later(() => {
                        btn.textContent = originalText;
                    }, 1500);
                }
            }
        } catch (err) {
            console.error('Failed to copy rendered content:', err);
        }
    }
    
    /**
     * Get the label for the current HTML passthrough mode.
     * @private
     */
    _getHtmlModeLabel(mode) {
        if (mode === true)      return 'HTML: Raw';
        if (mode === 'limited') return 'HTML: Safe';
        return 'HTML: Off';
    }

    /** @private */
    _getHtmlModeTooltip(mode) {
        if (mode === true)      return 'All HTML passes through — no protection';
        if (mode === 'limited') return 'Safe tags render, dangerous tags escaped';
        return 'All HTML tags shown as text';
    }

    /**
     * Cycle allowUnsafeHTML through false → "limited" → true → false.
     */
    cycleAllowUnsafeHTML() {
        const current = this.options.allowUnsafeHTML;
        let next;
        if (current === false)         next = 'limited';
        else if (current === 'limited') next = true;
        else                            next = false;
        this.setAllowUnsafeHTML(next);
    }

    /**
     * Set the HTML passthrough mode.
     * @param {boolean|'limited'} mode - false, 'limited', or true
     */
    setAllowUnsafeHTML(mode) {
        if (mode !== false && mode !== true && mode !== 'limited') return;
        this.options.allowUnsafeHTML = mode;
        // Update toolbar button label
        if (this.toolbar) {
            const btn = this.toolbar.querySelector('[data-action="toggle-html-mode"]');
            if (btn) {
                btn.textContent = this._getHtmlModeLabel(mode);
                btn.title = this._getHtmlModeTooltip(mode);
            }
        }
        // Re-render
        this.updateFromMarkdown(this._markdown);
    }

    /**
     * Get the current HTML passthrough mode.
     * @returns {boolean|'limited'}
     */
    getAllowUnsafeHTML() {
        return this.options.allowUnsafeHTML;
    }

    /**
     * Destroy the editor: remove its listeners, timers and DOM. Safe to
     * call more than once. Other editors on the page are not affected.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        // Timers
        clearTimeout(this.updateTimer);
        this._pending = null;
        this._timers.forEach(id => clearTimeout(id));
        this._timers.clear();

        // Listeners (document, media queries, own elements)
        this._listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
        this._listeners = [];
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._autoThemeListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this._autoThemeListener);
            this._autoThemeListener = null;
        }

        // UI may not exist if init was still loading libraries
        if (this.previewPanel) {
            // Release Leaflet maps created by geojson fences
            this.previewPanel.querySelectorAll('[id$="-container"]').forEach(el => {
                if (el._map && typeof el._map.remove === 'function') {
                    try { el._map.remove(); } catch (_err) { /* already gone */ }
                    el._map = null;
                }
            });
        }

        // DOM
        if (this.options.mount === 'append') {
            this.container.remove();
        } else {
            this.container.innerHTML = '';
            this.container.style.removeProperty('--qde-gutter-width');
            this.container.classList.remove(
                'qde-container', 'qde-dark', 'qde-split-preview', 'qde-line-numbers',
                'qde-mode-source', 'qde-mode-split', 'qde-mode-preview'
            );
        }

        // State
        this._undoStack = [];
        this._redoStack = [];
        this._savedRange = null;
        this._blocks = null;

        // Remove injected styles (only if no other editors exist)
        const otherEditors = document.querySelectorAll('.qde-container');
        if (otherEditors.length === 0) {
            const style = document.getElementById('qde-styles');
            if (style) style.remove();
        }
    }
}

/** Static: apply a formatting command to a markdown string (no editor needed). */
QuikdownEditor.formatMarkdown = formatMarkdown;

/** Static: formatting state at a selection in a markdown string. */
QuikdownEditor.getFormatState = getFormatState;

/**
 * Static: translate a character offset in one version of a document to the
 * matching offset in another (for example to keep the caret after reloading
 * a file that changed on disk).
 */
QuikdownEditor.mapOffset = mapOffset;

/** Static: command names accepted by format(). */
QuikdownEditor.FORMAT_COMMANDS = FORMAT_COMMANDS;

/** Static: curated safe HTML tag whitelist for allow_unsafe_html */
QuikdownEditor.SAFE_HTML_TAGS = SAFE_HTML_TAGS;

/** Semantic version (injected at build time) */
QuikdownEditor.version = quikdownEditorVersion;

// Export for CommonJS (needed for bundled ESM to work with Jest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuikdownEditor;
}

// Also export for UMD builds
if (typeof window !== 'undefined') {
    window.QuikdownEditor = QuikdownEditor;
}

module.exports = QuikdownEditor;
