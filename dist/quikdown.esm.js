/**
 * quikdown - Lightweight Markdown Parser
 * @version 1.2.21
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
const quikdownVersion = '1.2.21';

/** CSS class prefix used for all generated elements */
const CLASS_PREFIX = 'quikdown-';

/** Placeholder sigils — chosen to be extremely unlikely in real text */
const PLACEHOLDER_CB = '§CB';   // fenced code blocks
const PLACEHOLDER_IC = '§IC';   // inline code spans
const PLACEHOLDER_HT = '§HT';  // safe HTML tags (limited mode)
const PLACEHOLDER_BE = '§BE';  // backslash escapes

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

/**
 * processIndentedCodeBlocks — line walker for 4-space / tab indented code
 * @param {Function} escapeHtmlFn  Escape helper (for title attrs; code already escaped)
 */
function processIndentedCodeBlocks(text, getAttr, dataQd) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        if (!isIndentedCodeLine(lines[i])) {
            result.push(lines[i]);
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

        const codeBody = codeLines.join('\n');
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
            html = html.replace(`${PLACEHOLDER_HT}${i}§`, tag);
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
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, dest) => {
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
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, dest) => {
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
            return `<a${getAttr('a')} href="${sanitizedHref}"${rel}${titleAttr}${refAttr}${dataQd('[ref')}>${displayText}</a>`;
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
            return `<sup${getAttr('sup')}${fnAttr}${dataQd('[^')}><a href="#fn-${escapeHtml(id)}" id="fnref-${escapeHtml(id)}">${fnNum}</a></sup>`;
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
                replacement = replacement.replace(/^<(\w+)/,
                    `<$1 data-qd-fence="${escapeHtml(block.fence)}" data-qd-lang="${escapeHtml(block.lang)}" data-qd-source="${escapeHtml(block.code)}"`);
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
        html = html.replace(placeholder, replacement);
    });

    // Restore inline code spans
    inlineCodes.forEach((code, i) => {
        const placeholder = `${PLACEHOLDER_IC}${i}§`;
        html = html.replace(placeholder, `<code${getAttr('code')}${dataQd('`')}>${code}</code>`);
    });

    // Restore backslash escapes
    backslashEscapes.forEach((char, i) => {
        html = html.replace(`${PLACEHOLDER_BE}${i}§`, char);
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

export { quikdown as default };
