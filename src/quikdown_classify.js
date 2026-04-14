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
export function isHRLine(trimmed) {
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
export function isDashHRLine(trimmed) {
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
export function fenceOpen(trimmed) {
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
export function isFenceClose(trimmed, openChar, openLen) {
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
export function classifyLine(trimmed) {
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
export function looksLikeTableRow(line) {
    return line.includes('|');
}
