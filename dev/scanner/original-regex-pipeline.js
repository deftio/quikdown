/**
 * Original regex pipeline from v1.2.9 — Step 4 of quikdown()
 *
 * This is the code that has the issue #3 bug: emphasis regexes run on
 * the full HTML string after links/images are rendered, so underscores
 * and asterisks inside href/src attribute values get interpreted as
 * emphasis markers.
 *
 * Preserved here for reference.
 */

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
