/**
 * Character-walking inline scanner — archived from fix/url-underscore-parsing-bug-3
 *
 * This replaced the regex pipeline in Step 4 of quikdown() to fix issue #3
 * (emphasis markers inside URL attributes). It was subsequently replaced with
 * a simpler attribute-placeholder approach.
 *
 * Preserved here for reference. This is the final single-function version
 * (refactored from the initial 7-helper-function implementation).
 */

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

// ────────────────────────────────────────────────────────────────
// Call site (replaced Step 4 in quikdown()):
//
//   html = scanInline(html, getAttr, dataQd, sanitizeUrl, {
//       bidirectional,
//       allow_unsafe_urls: options.allow_unsafe_urls,
//       escapeHtml
//   });
// ────────────────────────────────────────────────────────────────
