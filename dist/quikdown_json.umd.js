/**
 * quikdown_json - JSON Markdown Parser
 * @version 1.3.3
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.quikdown_json = factory());
})(this, (function () { 'use strict';

    /**
     * quikdown_ast - Forgiving markdown to AST parser
     * Converts markdown to a structured Abstract Syntax Tree
     * @param {string} markdown - The markdown source text
     * @param {Object} options - Optional configuration object
     * @returns {Object} - The AST object
     */

    // Version will be injected at build time
    const quikdownVersion$1 = '1.3.3';

    // Safety limit to prevent infinite loops in list parsing
    const MAX_LOOP_ITERATIONS = 1000;

    /**
     * Parse markdown into an AST
     * @param {string} markdown - The markdown source text
     * @param {Object} options - Optional configuration object
     * @returns {Object} - The AST object
     */
    function quikdown_ast(markdown, options = {}) {
        if (!markdown || typeof markdown !== 'string') {
            return { type: 'document', children: [] };
        }

        // Normalize line endings (handle CRLF, CR, LF uniformly)
        const text = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const children = parseBlocks(text);

        return {
            type: 'document',
            children
        };
    }

    /**
     * Check if a line breaks lazy blockquote continuation (AST version).
     * Uses raw markdown (not HTML-escaped).
     */
    function isAstLazyContinuationBreaker(line) {
        const trimmed = line.trim();
        if (trimmed === '') return true;
        if (/^#{1,6}\s/.test(trimmed)) return true;
        if (/^---+\s*$/.test(trimmed) || /^\*\*\*+\s*$/.test(trimmed) || /^___+\s*$/.test(trimmed)) return true;
        if (/^>\s*/.test(trimmed)) return true;
        if (/^[-*+]\s/.test(trimmed)) return true;
        if (/^\d+\.\s/.test(trimmed)) return true;
        if (trimmed.startsWith('|')) return true;
        if (/^(```|~~~)/.test(trimmed)) return true;
        return false;
    }

    /**
     * Strip trailing punctuation from an autolinked URL (AST version).
     * Handles balanced parentheses (e.g. Wikipedia URLs).
     */
    function stripTrailingPunctuationAst(url) {
        let trailing = '';
        const punct = /[.,;:!?)]/;
        while (url.length > 0 && punct.test(url[url.length - 1])) {
            const ch = url[url.length - 1];
            if (ch === ')') {
                const opens = (url.match(/\(/g) || []).length;
                const closes = (url.match(/\)/g) || []).length;
                if (opens >= closes) break;
            }
            trailing = ch + trailing;
            url = url.slice(0, -1);
        }
        return { url, trailing };
    }

    /**
     * Parse block-level elements
     */
    function parseBlocks(text, options) {
        const blocks = [];
        const lines = text.split('\n');
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Empty line - skip
            if (line.trim() === '') {
                i++;
                continue;
            }

            // Fenced code block (``` or ~~~)
            const fenceMatch = line.match(/^(```|~~~)(.*)$/);
            if (fenceMatch) {
                const [, openFence, langPart] = fenceMatch;
                // Info string: the first word is the language, the rest (if any)
                // is kept as `meta`, following mdast.
                const info = langPart.trim();
                const lang = info.split(/\s/, 1)[0];
                const meta = info.slice(lang.length).trim();
                const codeLines = [];
                i++;

                // Find closing fence (forgiving: accept mismatched fences or EOF)
                while (i < lines.length) {
                    const closingMatch = lines[i].match(/^(```|~~~)\s*$/);
                    if (closingMatch) {
                        i++;
                        break;
                    }
                    codeLines.push(lines[i]);
                    i++;
                }

                const codeBlock = {
                    type: 'code_block',
                    lang: lang || null,
                    content: codeLines.join('\n'),
                    fence: openFence
                };
                if (meta) codeBlock.meta = meta;
                blocks.push(codeBlock);
                continue;
            }

            // Horizontal rule
            if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line) || /^___+\s*$/.test(line)) {
                blocks.push({ type: 'hr' });
                i++;
                continue;
            }

            // Heading (forgiving: accept #heading without space)
            const headingMatch = line.match(/^(#{1,6})\s*(.+?)\s*#*$/);
            if (headingMatch) {
                const [, hashes, content] = headingMatch;
                blocks.push({
                    type: 'heading',
                    level: hashes.length,
                    children: parseInline(content)
                });
                i++;
                continue;
            }

            // Table (look for separator line)
            if (line.includes('|')) {
                const tableResult = tryParseTable(lines, i);
                if (tableResult) {
                    blocks.push(tableResult.node);
                    i = tableResult.nextIndex;
                    continue;
                }
            }

            // Blockquote (with lazy continuation + GFM alert detection)
            if (line.match(/^>\s*/)) {
                const quoteLines = [];
                let inQuote = true;
                while (i < lines.length) {
                    if (lines[i].match(/^>\s*/)) {
                        quoteLines.push(lines[i].replace(/^>\s*/, ''));
                        inQuote = true;
                        i++;
                    } else if (inQuote && !isAstLazyContinuationBreaker(lines[i])) {
                        quoteLines.push(lines[i]);
                        i++;
                    } else {
                        break;
                    }
                }

                // Check for GFM alert syntax on first line
                const alertMatch = quoteLines.length > 0
                    ? quoteLines[0].trim().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i)
                    : null;

                if (alertMatch) {
                    const alertType = alertMatch[1].toLowerCase();
                    blocks.push({
                        type: 'alert',
                        alertType,
                        children: parseBlocks(quoteLines.slice(1).join('\n'))
                    });
                } else {
                    blocks.push({
                        type: 'blockquote',
                        children: parseBlocks(quoteLines.join('\n'))
                    });
                }
                continue;
            }

            // List (ordered or unordered)
            const listMatch = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.*)$/);
            if (listMatch) {
                const listResult = parseList(lines, i);
                blocks.push(listResult.node);
                i = listResult.nextIndex;
                continue;
            }

            // Paragraph - collect lines until empty line or block element
            const paragraphLines = [];
            while (i < lines.length) {
                const pLine = lines[i];

                // Stop on empty line
                if (pLine.trim() === '') break;

                // Stop on block elements
                if (/^(```|~~~)/.test(pLine)) break;
                if (/^#{1,6}\s/.test(pLine)) break;
                if (/^---+\s*$/.test(pLine) || /^\*\*\*+\s*$/.test(pLine) || /^___+\s*$/.test(pLine)) break;
                if (/^>\s*/.test(pLine)) break;
                if (/^(\s*)([*\-+]|\d+\.)\s+/.test(pLine)) break;
                if (pLine.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;

                paragraphLines.push(pLine);
                i++;
            }

            // Every pass must consume a line. If a line stopped the paragraph
            // but no block parser above took it, keep it as paragraph text.
            /* istanbul ignore next -- guard against a scanner hang; no known input reaches it */
            if (paragraphLines.length === 0) {
                paragraphLines.push(lines[i]);
                i++;
            }

            blocks.push({
                type: 'paragraph',
                children: parseInline(paragraphLines.join('\n'))
            });
        }

        return blocks;
    }

    /**
     * A table separator row: pipes, dashes, colons and spaces, with at least one dash.
     */
    function isTableSeparator(line) {
        return /^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-');
    }

    /**
     * Try to parse a table starting at the given line
     */
    function tryParseTable(lines, startIndex, options) {
        // Need at least 2 lines (header + separator)
        if (startIndex + 1 >= lines.length) return null;

        const headerLine = lines[startIndex];
        const separatorLine = lines[startIndex + 1];

        if (!isTableSeparator(separatorLine)) return null;

        // Parse header
        const headerCells = parseTableRow(headerLine);
        if (headerCells.length === 0) return null;

        // Parse alignments from separator
        const separatorCells = parseTableRow(separatorLine);
        const alignments = separatorCells.map(cell => {
            const trimmed = cell.trim();
            if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
            if (trimmed.endsWith(':')) return 'right';
            return 'left';
        });

        const colCount = alignments.length;

        // Parse headers with inline formatting, normalized to colCount
        const headers = [];
        for (let c = 0; c < colCount; c++) {
            const cell = c < headerCells.length ? headerCells[c] : '';
            headers.push(parseInline(cell.trim()));
        }

        // Parse body rows, normalized to colCount
        const rows = [];
        let i = startIndex + 2;
        while (i < lines.length) {
            const rowLine = lines[i];
            if (!rowLine.includes('|') || rowLine.trim() === '') break;

            const cells = parseTableRow(rowLine);
            const row = [];
            for (let c = 0; c < colCount; c++) {
                const cell = c < cells.length ? cells[c] : '';
                row.push(parseInline(cell.trim()));
            }
            rows.push(row);
            i++;
        }

        return {
            node: {
                type: 'table',
                headers,
                rows,
                alignments
            },
            nextIndex: i
        };
    }

    /**
     * Parse a table row into cells
     */
    function parseTableRow(line) {
        // Handle pipes at start/end or not
        let trimmed = line.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
        return trimmed.split('|');
    }

    /** Leading-whitespace width of a line (tabs count as 1, like list indents). */
    function astIndentWidth(line) {
        const m = line.match(/^[ \t]*/);
        return m[0].length;
    }

    /**
     * True when an indented, non-blank line is wrapped text belonging to the
     * list item above it (issue #36).  Mirrors isListContinuation in quikdown.js:
     * lines that start a block construct (fence, blockquote, table row, heading,
     * HR) are excluded.
     */
    function isAstListContinuation(line) {
        const m = line.match(/^[ \t]+(\S.*)$/);
        if (!m) return false;
        const t = m[1];
        if (/^(```|~~~|>|\||#{1,6}(\s|$))/.test(t)) return false;
        if (/^([-*_])\1{2,}\s*$/.test(t)) return false;
        return true;
    }

    /**
     * Parse a list starting at the given line
     *
     * An indented, non-blank line directly under an item is wrapped item text
     * and is appended to that item (joined with a space, or kept as a line
     * break when the item ends with two spaces or a backslash so parseInline
     * emits a `br` node).
     */
    function parseList(lines, startIndex, options) {
        const items = [];
        let i = startIndex;
        let loopCount = 0;
        let lastText = null;   // raw source text of the last direct item, for continuation lines

        // Determine initial list type
        const firstMatch = lines[i].match(/^(\s*)([*\-+]|\d+\.)\s+(.*)$/);
        const isOrdered = /^\d+\./.test(firstMatch[2]);
        const baseIndent = firstMatch[1].length;

        while (i < lines.length && loopCount < MAX_LOOP_ITERATIONS) {
            loopCount++;
            const line = lines[i];
            const match = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.*)$/);

            if (!match) {
                // Wrapped item text — append to the item above
                if (lastText !== null && isAstListContinuation(line) && astIndentWidth(line) >= baseIndent) {
                    const sep = /( {2}|\\)$/.test(lastText) ? '\n' : ' ';
                    lastText += sep + line.trim();
                    items[items.length - 1].children = parseInline(lastText);
                    i++;
                    continue;
                }
                break;
            }

            const [, indent, marker, content] = match;
            const indentLevel = indent.length;

            // If less indented than base, stop
            if (indentLevel < baseIndent) break;

            // If same indentation but different list type, stop
            const itemIsOrdered = /^\d+\./.test(marker);
            if (indentLevel === baseIndent && itemIsOrdered !== isOrdered) break;

            // If more indented, it's a nested list - handle by collecting sub-lines
            if (indentLevel > baseIndent) {
                // This is a nested list item, collect and parse as sublist
                const subLines = [];
                let subLoopCount = 0;
                while (i < lines.length && subLoopCount < MAX_LOOP_ITERATIONS) {
                    subLoopCount++;
                    const subLine = lines[i];
                    const subMatch = subLine.match(/^(\s*)([*\-+]|\d+\.)\s+/);
                    if (subMatch) {
                        if (subMatch[1].length <= baseIndent) break;
                    } else if (!(isAstListContinuation(subLine) && astIndentWidth(subLine) > baseIndent)) {
                        // Not a nested item and not wrapped text of one
                        break;
                    }
                    subLines.push(subLine);
                    i++;
                }

                if (subLines.length > 0 && items.length > 0) {
                    // Add nested list to last item
                    const nestedResult = parseList(subLines, 0);
                    const lastItem = items[items.length - 1];
                    /* istanbul ignore next -- defensive: parseInline always returns an array */
                    if (!lastItem.children) {
                        lastItem.children = [];
                    } else if (!Array.isArray(lastItem.children)) {
                        lastItem.children = [{ type: 'paragraph', children: lastItem.children }];
                    }
                    lastItem.children.push(nestedResult.node);
                }
                lastText = null;   // a continuation after a sublist belongs to the sublist
                continue;
            }

            // Parse list item
            const itemNode = {
                type: 'list_item',
                checked: null,
                children: null
            };

            // Check for task list syntax
            const taskMatch = content.match(/^\[([x ])\]\s*(.*)$/i);
            if (taskMatch && !isOrdered) {
                itemNode.checked = taskMatch[1].toLowerCase() === 'x';
                lastText = taskMatch[2];
            } else {
                lastText = content;
            }
            itemNode.children = parseInline(lastText);

            items.push(itemNode);
            i++;
        }

        return {
            node: {
                type: 'list',
                ordered: isOrdered,
                items
            },
            nextIndex: i
        };
    }

    /** Parse link/image destination with optional title (mirrors quikdown.js). */
    function parseLinkDestinationAst(raw) {
        if (raw === undefined || raw === null || raw === '') return { url: '', title: null };

        const dblQuote = raw.match(/^(.*)\s+"([^"]*)"\s*$/);
        if (dblQuote) return { url: dblQuote[1].replace(/\s+$/, ''), title: dblQuote[2] };

        const sglQuote = raw.match(/^(.*)\s+'([^']*)'\s*$/);
        if (sglQuote) return { url: sglQuote[1].replace(/\s+$/, ''), title: sglQuote[2] };

        if (raw.startsWith('<') && raw.endsWith('>')) {
            return { url: raw.slice(1, -1), title: null };
        }

        return { url: raw, title: null };
    }

    // Inline patterns. All are sticky: they are matched at an index into the
    // full text, so the scanner never has to copy the unparsed remainder.
    const INLINE_CODE = /`([^`\n]+)`/y;
    const INLINE_BOLD = /(\*\*|__)(.+?)\1/y;
    const INLINE_STRIKE = /~~(.+?)~~/y;
    const INLINE_EM_STAR = /\*(?!\*)(.+?)(?<!\*)\*(?!\*)/y;
    const INLINE_EM_UNDERSCORE = /_(?![_\s])(.+?)(?<![\s_])_(?![A-Za-z0-9_])/y;
    const INLINE_URL = /(https?:\/\/[^\s<>[\]]+)/y;
    // eslint-disable-next-line security/detect-unsafe-regex -- linear: the two alternatives differ on their first char, so each input has only one match path
    const INLINE_DESTINATION = /\(((?:[^()]|\([^()]*\))+)\)/y;
    const INLINE_MARKER = /[`*_~![\n]|https?:\/\//g;

    function matchAt(pattern, text, index) {
        pattern.lastIndex = index;
        return pattern.exec(text);
    }

    /**
     * Parse inline elements.
     *
     * The scanner walks the text by index. The lookups that would otherwise
     * rescan the rest of the text at every marker (next newline, next `]`,
     * next closing `_`) are cached, so the cost stays linear in the text length.
     */
    function parseInline(text, options) {
        if (!text) return [];

        const nodes = [];
        let pos = 0;
        // Cached forward lookups; -2 = not searched yet, -1 = none left.
        let newlineAt = -2;      // next '\n' at or after pos
        let bracketAt = -2;      // next ']' after the last '[' looked at
        let underscoreAt = -2;   // next '_' that can close an emphasis
        let destinationAt = -1;  // index of the ']' the cached destination follows
        let destination = null;

        // Match `[label](destination)` whose '[' is at `open`.
        const matchBracket = (open, minLabel) => {
            if (bracketAt !== -1 && bracketAt <= open) bracketAt = text.indexOf(']', open + 1);
            if (bracketAt === -1 || bracketAt - open - 1 < minLabel || text[bracketAt + 1] !== '(') return null;
            if (destinationAt !== bracketAt) {
                destinationAt = bracketAt;
                destination = matchAt(INLINE_DESTINATION, text, bracketAt + 1);
            }
            if (!destination) return null;
            return {
                label: text.slice(open + 1, bracketAt),
                target: destination[1],
                end: bracketAt + 1 + destination[0].length
            };
        };

        // True when a '_' that can close an emphasis opened at `open` exists on the same line.
        const hasUnderscoreCloser = (open) => {
            if (underscoreAt !== -1 && underscoreAt < open + 2) {
                underscoreAt = -1;
                for (let k = text.indexOf('_', open + 2); k !== -1; k = text.indexOf('_', k + 1)) {
                    if (!/[\s_]/.test(text[k - 1]) && !/[A-Za-z0-9_]/.test(text[k + 1] || '')) {
                        underscoreAt = k;
                        break;
                    }
                }
            }
            return underscoreAt !== -1 && (newlineAt === -1 || underscoreAt < newlineAt);
        };

        while (pos < text.length) {
            if (newlineAt !== -1 && newlineAt < pos) newlineAt = text.indexOf('\n', pos);

            // Hard line break: two trailing spaces or a backslash before the newline
            if (newlineAt !== -1) {
                const beforeText = text.slice(pos, newlineAt);
                if (beforeText.endsWith('  ') || beforeText.endsWith('\\')) {
                    const cleanText = beforeText.replace(/\\$/, '').replace(/  +$/, '');
                    if (cleanText) {
                        nodes.push(...parseInlineContent(cleanText));
                    }
                    nodes.push({ type: 'br' });
                    pos = newlineAt + 1;
                    continue;
                }
            }

            const ch = text[pos];

            // Images: ![alt](url) or ![alt](url "title")
            const img = ch === '!' && text[pos + 1] === '[' ? matchBracket(pos + 1, 0) : null;
            if (img) {
                const { url, title } = parseLinkDestinationAst(img.target);
                const node = {
                    type: 'image',
                    alt: img.label,
                    url: url.trim()
                };
                if (title) node.title = title;
                nodes.push(node);
                pos = img.end;
                continue;
            }

            // Links: [text](url) or [text](url "title")
            const link = ch === '[' ? matchBracket(pos, 1) : null;
            if (link) {
                const { url, title } = parseLinkDestinationAst(link.target);
                const node = {
                    type: 'link',
                    url: url.trim(),
                    children: parseInlineContent(link.label)
                };
                if (title) node.title = title;
                nodes.push(node);
                pos = link.end;
                continue;
            }

            // Inline code: `code`
            const codeMatch = matchAt(INLINE_CODE, text, pos);
            if (codeMatch) {
                nodes.push({
                    type: 'code',
                    value: codeMatch[1]
                });
                pos += codeMatch[0].length;
                continue;
            }

            // Bold: **text** or __text__
            const boldMatch = matchAt(INLINE_BOLD, text, pos);
            if (boldMatch) {
                nodes.push({
                    type: 'strong',
                    children: parseInlineContent(boldMatch[2])
                });
                pos += boldMatch[0].length;
                continue;
            }

            // Strikethrough: ~~text~~
            const strikeMatch = matchAt(INLINE_STRIKE, text, pos);
            if (strikeMatch) {
                nodes.push({
                    type: 'del',
                    children: parseInlineContent(strikeMatch[1])
                });
                pos += strikeMatch[0].length;
                continue;
            }

            // Italic: *text* or _text_. Single underscores require word boundaries
            // so identifiers like snake_case_variable stay plain text.
            const canOpenUnderscore = ch === '_' && !/[A-Za-z0-9_]/.test(text[pos - 1] || '');
            const emMatch = matchAt(INLINE_EM_STAR, text, pos)
                || (canOpenUnderscore && hasUnderscoreCloser(pos) && matchAt(INLINE_EM_UNDERSCORE, text, pos));
            if (emMatch) {
                nodes.push({
                    type: 'em',
                    children: parseInlineContent(emMatch[1])
                });
                pos += emMatch[0].length;
                continue;
            }

            // Autolinks: URLs starting with http:// or https://
            const urlMatch = matchAt(INLINE_URL, text, pos);
            if (urlMatch) {
                const { url: cleanUrl, trailing } = stripTrailingPunctuationAst(urlMatch[1]);
                nodes.push({
                    type: 'link',
                    url: cleanUrl,
                    children: [{ type: 'text', value: cleanUrl }]
                });
                if (trailing) {
                    nodes.push({ type: 'text', value: trailing });
                }
                pos += urlMatch[0].length;
                continue;
            }

            // Plain text: consume up to the next potential inline marker. A
            // newline is a marker so the hard-break check runs on every line.
            const marker = matchAt(INLINE_MARKER, text, pos);
            if (!marker) {
                nodes.push({ type: 'text', value: text.slice(pos) });
                break;
            } else if (marker.index === pos) {
                // Current char is a marker but didn't match - consume it as text
                nodes.push({ type: 'text', value: ch });
                pos += 1;
            } else {
                nodes.push({ type: 'text', value: text.slice(pos, marker.index) });
                pos = marker.index;
            }
        }

        // Merge adjacent text nodes
        return mergeTextNodes(nodes);
    }

    /**
     * Parse inline content (recursive helper for nested inline elements)
     */
    function parseInlineContent(text, options) {
        // For simple nested content, use parseInline
        // But handle newlines as spaces for inline content
        const normalized = text.replace(/\n/g, ' ');
        return parseInline(normalized);
    }

    /**
     * Merge adjacent text nodes
     */
    function mergeTextNodes(nodes) {
        const merged = [];
        for (const node of nodes) {
            if (node.type === 'text' && merged.length > 0 && merged[merged.length - 1].type === 'text') {
                merged[merged.length - 1].value += node.value;
            } else {
                merged.push(node);
            }
        }
        return merged;
    }

    // Attach version
    quikdown_ast.version = quikdownVersion$1;

    // Export for both CommonJS and ES6
    /* istanbul ignore next */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = quikdown_ast;
    }

    // For browser global
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
        window.quikdown_ast = quikdown_ast;
    }

    /**
     * quikdown_json - Markdown to JSON converter
     * Converts markdown to JSON via AST
     * @param {string} markdown - The markdown source text
     * @param {Object} options - Optional configuration object
     * @param {number} options.indent - JSON indentation (default: 2)
     * @returns {string} - JSON string representation of the AST
     */


    // Version will be injected at build time
    const quikdownVersion = '1.3.3';

    /**
     * Convert markdown to JSON
     * @param {string} markdown - The markdown source text
     * @param {Object} options - Optional configuration object
     * @returns {string} - JSON string
     */
    function quikdown_json(markdown, options = {}) {
        const ast = quikdown_ast(markdown, options);
        const indent = options.indent !== undefined ? options.indent : 2;
        return JSON.stringify(ast, null, indent);
    }

    // Expose the AST parser for direct access
    quikdown_json.parse = quikdown_ast;

    // Attach version
    quikdown_json.version = quikdownVersion;

    // Export for both CommonJS and ES6
    /* istanbul ignore next */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = quikdown_json;
    }

    // For browser global
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
        window.quikdown_json = quikdown_json;
    }

    return quikdown_json;

}));
