/**
 * quikdown_ast - AST Markdown Parser
 * @version 1.2.17
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
/**
 * quikdown_ast - Forgiving markdown to AST parser
 * Converts markdown to a structured Abstract Syntax Tree
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @returns {Object} - The AST object
 */

// Version will be injected at build time
const quikdownVersion = '1.2.17';

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
            const lang = langPart.trim();
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

            blocks.push({
                type: 'code_block',
                lang: lang || null,
                content: codeLines.join('\n'),
                fence: openFence
            });
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
            if (pLine.includes('|') && i + 1 < lines.length && /^\|?[\s\-:|]+\|?$/.test(lines[i + 1])) break;

            paragraphLines.push(pLine);
            i++;
        }

        if (paragraphLines.length > 0) {
            blocks.push({
                type: 'paragraph',
                children: parseInline(paragraphLines.join('\n'))
            });
        }
    }

    return blocks;
}

/**
 * Try to parse a table starting at the given line
 */
function tryParseTable(lines, startIndex, options) {
    // Need at least 2 lines (header + separator)
    if (startIndex + 1 >= lines.length) return null;

    const headerLine = lines[startIndex];
    const separatorLine = lines[startIndex + 1];

    // Check if separator line is valid
    if (!/^\|?[\s\-:|]+\|?$/.test(separatorLine) || !separatorLine.includes('-')) {
        return null;
    }

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

/**
 * Parse a list starting at the given line
 */
function parseList(lines, startIndex, options) {
    const items = [];
    let i = startIndex;
    let loopCount = 0;

    // Determine initial list type
    const firstMatch = lines[i].match(/^(\s*)([*\-+]|\d+\.)\s+(.*)$/);
    const isOrdered = /^\d+\./.test(firstMatch[2]);
    const baseIndent = firstMatch[1].length;

    while (i < lines.length && loopCount < MAX_LOOP_ITERATIONS) {
        loopCount++;
        const line = lines[i];
        const match = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.*)$/);

        if (!match) break;

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
                if (!subMatch) break;
                if (subMatch[1].length < baseIndent) break;
                if (subMatch[1].length === baseIndent) break;
                subLines.push(subLine);
                i++;
            }

            if (subLines.length > 0 && items.length > 0) {
                // Add nested list to last item
                const nestedResult = parseList(subLines, 0);
                const lastItem = items[items.length - 1];
                if (!lastItem.children) {
                    lastItem.children = [];
                } else if (!Array.isArray(lastItem.children)) {
                    lastItem.children = [{ type: 'paragraph', children: lastItem.children }];
                }
                lastItem.children.push(nestedResult.node);
            }
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
            itemNode.children = parseInline(taskMatch[2]);
        } else {
            itemNode.children = parseInline(content);
        }

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

/**
 * Parse inline elements
 */
function parseInline(text, options) {
    if (!text) return [];

    const nodes = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Line break (1+ trailing spaces or explicit \n after processing)
        // Handle inline line breaks (two spaces at end of line or backslash before newline)
        const brMatch = remaining.match(/^(.+?)(?: {2}|\\\n|\n)/);
        if (brMatch && remaining.includes('\n')) {
            const beforeBr = remaining.indexOf('\n');
            const beforeText = remaining.slice(0, beforeBr);
            const afterText = remaining.slice(beforeBr + 1);

            // Check if line break is significant (2+ trailing spaces or backslash)
            if (beforeText.endsWith('  ') || beforeText.endsWith('\\')) {
                const cleanText = beforeText.replace(/\\$/, '').replace(/  +$/, '');
                if (cleanText) {
                    nodes.push(...parseInlineContent(cleanText));
                }
                nodes.push({ type: 'br' });
                remaining = afterText;
                continue;
            }
        }

        // Images: ![alt](url) or ![alt](url "title")
        const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) {
            const { url, title } = parseLinkDestinationAst(imgMatch[2]);
            const node = {
                type: 'image',
                alt: imgMatch[1],
                url: url.trim()
            };
            if (title) node.title = title;
            nodes.push(node);
            remaining = remaining.slice(imgMatch[0].length);
            continue;
        }

        // Links: [text](url) or [text](url "title")
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            const { url, title } = parseLinkDestinationAst(linkMatch[2]);
            const node = {
                type: 'link',
                url: url.trim(),
                children: parseInlineContent(linkMatch[1])
            };
            if (title) node.title = title;
            nodes.push(node);
            remaining = remaining.slice(linkMatch[0].length);
            continue;
        }

        // Inline code: `code`
        const codeMatch = remaining.match(/^`([^`\n]+)`/);
        if (codeMatch) {
            nodes.push({
                type: 'code',
                value: codeMatch[1]
            });
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }

        // Bold: **text** or __text__
        const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
        if (boldMatch) {
            nodes.push({
                type: 'strong',
                children: parseInlineContent(boldMatch[2])
            });
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }

        // Strikethrough: ~~text~~
        const strikeMatch = remaining.match(/^~~(.+?)~~/);
        if (strikeMatch) {
            nodes.push({
                type: 'del',
                children: parseInlineContent(strikeMatch[1])
            });
            remaining = remaining.slice(strikeMatch[0].length);
            continue;
        }

        // Italic: *text* or _text_. Single underscores require word boundaries
        // so identifiers like snake_case_variable stay plain text.
        const previousChar = text[text.length - remaining.length - 1] || '';
        const canOpenUnderscore = !/[A-Za-z0-9_]/.test(previousChar);
        const emMatch = remaining.match(/^\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
            || (canOpenUnderscore && remaining.match(/^_(?![_\s])(.+?)(?<![\s_])_(?![A-Za-z0-9_])/));
        if (emMatch) {
            nodes.push({
                type: 'em',
                children: parseInlineContent(emMatch[1])
            });
            remaining = remaining.slice(emMatch[0].length);
            continue;
        }

        // Autolinks: URLs starting with http:// or https://
        const urlMatch = remaining.match(/^(https?:\/\/[^\s<>[\]]+)/);
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
            remaining = remaining.slice(urlMatch[0].length);
            continue;
        }

        // Plain text - consume until next potential inline element or end
        // Find next potential inline marker
        const nextMarker = remaining.search(/[`*_~![\\n]|https?:\/\//);
        if (nextMarker === -1) {
            // No more markers, consume rest as text
            nodes.push({ type: 'text', value: remaining });
            break;
        } else if (nextMarker === 0) {
            // Current char is a marker but didn't match - consume it as text
            nodes.push({ type: 'text', value: remaining[0] });
            remaining = remaining.slice(1);
        } else {
            // Consume text up to next marker
            nodes.push({ type: 'text', value: remaining.slice(0, nextMarker) });
            remaining = remaining.slice(nextMarker);
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
quikdown_ast.version = quikdownVersion;

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

export { quikdown_ast as default };
