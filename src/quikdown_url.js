/**
 * quikdown_url — Shared URL sanitizer
 * ═══════════════════════════════════
 *
 * Used by the main parser (quikdown.js) and the AST renderer
 * (quikdown_ast_html.js) so both block the same URLs.
 *
 * The check runs on a copy of the URL normalised the way a browser
 * would read it:
 *   1. Character references are decoded once, in a single pass, so a
 *      decoded '&' can never start a second reference
 *      (&#106;avascript:, javascript&colon;, java&Tab;script:).
 *   2. ASCII whitespace and control characters are dropped.  Browsers
 *      strip leading C0/space and remove tab/CR/LF anywhere, so
 *      "\x01javascript:" and "java\tscript:" both run as javascript:.
 * The URL returned is the caller's original (trimmed) string; the
 * normalised copy is only used for the decision.
 */

// Named references that can spell a scheme or hide one.  HTML has no
// named references for plain ASCII letters, so these are the only ones
// that matter for "javascript:", "vbscript:" and "data:".
const NAMED_REFS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', newline: '\n' };

function decodeRef(match, body) {
    if (body[0] === '#') {
        const code = body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        // Out-of-range or surrogate code points decode to U+FFFD in browsers
        return code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF) ? '�' : String.fromCodePoint(code);
    }
    const named = NAMED_REFS[body.toLowerCase()];
    return named === undefined ? match : named;
}

/**
 * Block javascript:, vbscript: and non-image data: URLs.
 * @param {string} url
 * @param {boolean} [allowUnsafe=false]  Skip the check entirely
 * @returns {string} the trimmed URL, or '#' when blocked
 */
export function sanitizeUrl(url, allowUnsafe = false) {
    if (!url) return '';
    if (allowUnsafe) return url;
    const trimmedUrl = url.trim();

    const decoded = trimmedUrl.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, decodeRef);
    let scheme = '';
    for (let i = 0; i < decoded.length; i++) {
        const c = decoded.charCodeAt(i);
        if (c > 0x20 && c !== 0x7f) scheme += decoded[i];
    }
    scheme = scheme.toLowerCase();

    if (scheme.startsWith('javascript:') || scheme.startsWith('vbscript:')) return '#';
    if (scheme.startsWith('data:') && !scheme.startsWith('data:image/')) return '#';
    return trimmedUrl;
}
