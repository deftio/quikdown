/**
 * quikdown_yaml - YAML Markdown Parser
 * @version 1.2.0
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
const quikdownVersion$1 = '1.2.0';

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
    let text = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const children = parseBlocks(text);

    return {
        type: 'document',
        children
    };
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

        // Blockquote
        if (line.match(/^>\s*/)) {
            const quoteLines = [];
            while (i < lines.length && lines[i].match(/^>\s*/)) {
                quoteLines.push(lines[i].replace(/^>\s*/, ''));
                i++;
            }
            blocks.push({
                type: 'blockquote',
                children: parseBlocks(quoteLines.join('\n'))
            });
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

    // Parse headers with inline formatting
    const headers = headerCells.map(cell => parseInline(cell.trim()));

    // Parse body rows
    const rows = [];
    let i = startIndex + 2;
    while (i < lines.length) {
        const rowLine = lines[i];
        if (!rowLine.includes('|') || rowLine.trim() === '') break;

        const cells = parseTableRow(rowLine);
        rows.push(cells.map(cell => parseInline(cell.trim())));
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

/**
 * Parse inline elements
 */
function parseInline(text, options) {
    if (!text) return [];

    const nodes = [];
    let remaining = text;

    while (remaining.length > 0) {
        let matched = false;

        // Line break (1+ trailing spaces or explicit \n after processing)
        // Handle inline line breaks (two spaces at end of line or backslash before newline)
        const brMatch = remaining.match(/^(.+?)(?:  |\\\n|\n)/);
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
                matched = true;
                continue;
            }
        }

        // Images: ![alt](url)
        const imgMatch = remaining.match(/^!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/);
        if (imgMatch) {
            nodes.push({
                type: 'image',
                alt: imgMatch[1],
                url: imgMatch[2].trim()  // Forgiving: trim whitespace in URL
            });
            remaining = remaining.slice(imgMatch[0].length);
            matched = true;
            continue;
        }

        // Links: [text](url)
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/);
        if (linkMatch) {
            nodes.push({
                type: 'link',
                url: linkMatch[2].trim(),  // Forgiving: trim whitespace in URL
                children: parseInlineContent(linkMatch[1])
            });
            remaining = remaining.slice(linkMatch[0].length);
            matched = true;
            continue;
        }

        // Inline code: `code`
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            nodes.push({
                type: 'code',
                value: codeMatch[1]
            });
            remaining = remaining.slice(codeMatch[0].length);
            matched = true;
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
            matched = true;
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
            matched = true;
            continue;
        }

        // Italic: *text* or _text_ (not at word boundary for underscores)
        const emMatch = remaining.match(/^(\*|_)(?!\1)(.+?)(?<!\1)\1(?!\1)/);
        if (emMatch) {
            nodes.push({
                type: 'em',
                children: parseInlineContent(emMatch[2])
            });
            remaining = remaining.slice(emMatch[0].length);
            matched = true;
            continue;
        }

        // Autolinks: URLs starting with http:// or https://
        const urlMatch = remaining.match(/^(https?:\/\/[^\s<>\[\]]+)/);
        if (urlMatch) {
            nodes.push({
                type: 'link',
                url: urlMatch[1],
                children: [{ type: 'text', value: urlMatch[1] }]
            });
            remaining = remaining.slice(urlMatch[0].length);
            matched = true;
            continue;
        }

        // Plain text - consume until next potential inline element or end
        if (!matched) {
            // Find next potential inline marker
            const nextMarker = remaining.search(/[`*_~!\[\n]|https?:\/\//);
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
 * quikdown_yaml - Markdown to YAML converter
 * Converts markdown to YAML via AST
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @returns {string} - YAML string representation of the AST
 */


// Version will be injected at build time
const quikdownVersion = '1.2.0';

/**
 * Convert markdown to YAML
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @returns {string} - YAML string
 */
function quikdown_yaml(markdown, options = {}) {
    const ast = quikdown_ast(markdown, options);
    return astToYaml(ast, 0);
}

/**
 * Convert an AST node to YAML string
 * Minimal YAML serializer - no external dependencies
 * @param {Object|Array|string|number|boolean|null} node - The value to serialize
 * @param {number} indent - Current indentation level
 * @returns {string} - YAML string
 */
function astToYaml(node, indent) {
    const spaces = '  '.repeat(indent);

    if (node === null || node === undefined) {
        return 'null';
    }

    if (typeof node === 'boolean') {
        return node ? 'true' : 'false';
    }

    if (typeof node === 'number') {
        return String(node);
    }

    if (typeof node === 'string') {
        return formatYamlString(node);
    }

    if (Array.isArray(node)) {
        if (node.length === 0) {
            return '[]';
        }

        const lines = [];
        for (const item of node) {
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                // Object item - inline the first property on the same line as dash
                const props = Object.entries(item);
                if (props.length > 0) {
                    const [firstKey, firstValue] = props[0];
                    const firstValueStr = formatValue(firstValue, indent + 1);
                    lines.push(`${spaces}- ${firstKey}: ${firstValueStr}`);

                    // Remaining properties
                    for (let i = 1; i < props.length; i++) {
                        const [key, value] = props[i];
                        const valueStr = formatValue(value, indent + 1);
                        lines.push(`${spaces}  ${key}: ${valueStr}`);
                    }
                } else {
                    lines.push(`${spaces}- {}`);
                }
            } else {
                // Simple value
                const valueStr = astToYaml(item, indent + 1);
                lines.push(`${spaces}- ${valueStr}`);
            }
        }
        return '\n' + lines.join('\n');
    }

    if (typeof node === 'object') {
        const entries = Object.entries(node);
        if (entries.length === 0) {
            return '{}';
        }

        const lines = [];
        for (const [key, value] of entries) {
            const valueStr = formatValue(value, indent);
            lines.push(`${spaces}${key}: ${valueStr}`);
        }
        return lines.join('\n');
    }

    return String(node);
}

/**
 * Format a value for YAML (handles nested objects/arrays)
 */
function formatValue(value, indent) {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (typeof value === 'string') {
        return formatYamlString(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        return astToYaml(value, indent + 1);
    }

    if (typeof value === 'object') {
        // Nested object - format on new lines with increased indent
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return '{}';
        }
        return '\n' + astToYaml(value, indent + 1);
    }

    return String(value);
}

/**
 * Format a string for YAML (handle quoting and escaping)
 */
function formatYamlString(str) {
    // Check if string needs quoting
    const needsQuoting = (
        str === '' ||
        str.includes('\n') ||
        str.includes(':') ||
        str.includes('#') ||
        str.includes("'") ||
        str.includes('"') ||
        str.startsWith(' ') ||
        str.endsWith(' ') ||
        str.startsWith('-') ||
        str.startsWith('[') ||
        str.startsWith('{') ||
        str === 'true' ||
        str === 'false' ||
        str === 'null' ||
        str === 'yes' ||
        str === 'no' ||
        str === 'on' ||
        str === 'off' ||
        /^\d+$/.test(str) ||
        /^\d+\.\d+$/.test(str)
    );

    if (!needsQuoting) {
        return str;
    }

    // Use double quotes and escape special characters
    if (str.includes('\n')) {
        // For multiline strings, use literal block style
        const escaped = str.replace(/\n/g, '\\n');
        return `"${escaped.replace(/"/g, '\\"')}"`;
    }

    // Simple string quoting
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Expose the AST parser for direct access
quikdown_yaml.parse = quikdown_ast;

// Expose the YAML serializer for direct AST-to-YAML conversion
quikdown_yaml.stringify = function(ast) {
    return astToYaml(ast, 0);
};

// Attach version
quikdown_yaml.version = quikdownVersion;

// Export for both CommonJS and ES6
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown_yaml;
}

// For browser global
/* istanbul ignore next */
if (typeof window !== 'undefined') {
    window.quikdown_yaml = quikdown_yaml;
}

export { quikdown_yaml as default };
