/**
 * quikdown_ast_html - AST to HTML converter
 * Converts AST (or markdown/JSON/YAML) to HTML
 * @param {string|Object} input - Markdown string, AST object, JSON string, or YAML string
 * @param {Object} options - Optional configuration object
 * @returns {string} - HTML string
 */

import quikdown_ast from './quikdown_ast.js';

// Version will be injected at build time
const quikdownVersion = '__QUIKDOWN_VERSION__';

// Constants
const CLASS_PREFIX = 'quikdown-';

// Escape map for HTML
const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

// Style definitions (matching quikdown.js)
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

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, m => ESC_MAP[m]);
}

/**
 * Create attribute string generator
 */
function createGetAttr(inline_styles) {
    return function(tag, additionalStyle = '') {
        if (inline_styles) {
            let style = QUIKDOWN_STYLES[tag];
            if (!style && !additionalStyle) return '';

            if (additionalStyle && additionalStyle.includes('text-align') && style && style.includes('text-align')) {
                style = style.replace(/text-align:[^;]+;?/, '').trim();
                if (style && !style.endsWith(';')) style += ';';
            }

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

/**
 * Sanitize URLs
 */
function sanitizeUrl(url) {
    if (!url) return '';
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
 * Convert input to AST
 * Accepts markdown string, AST object, JSON string, or YAML string
 */
function toAst(input, options = {}) {
    if (!input) {
        return { type: 'document', children: [] };
    }

    // Already an AST object
    if (typeof input === 'object' && input.type) {
        return input;
    }

    if (typeof input === 'string') {
        const trimmed = input.trim();

        // Try JSON first (starts with { or [)
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.type === 'document') {
                    return parsed;
                }
                // If it's an array, wrap it as document children
                if (Array.isArray(parsed)) {
                    return { type: 'document', children: parsed };
                }
                return parsed;
            } catch (e) {
                // Not valid JSON, fall through to markdown
            }
        }

        // Try YAML detection (has type: and children: patterns typical of AST)
        if (trimmed.includes('type:') && (trimmed.includes('children:') || trimmed.includes('value:'))) {
            try {
                const parsed = parseYaml(trimmed);
                if (parsed && parsed.type) {
                    return parsed;
                }
            } catch (e) {
                // Not valid YAML AST, fall through to markdown
            }
        }

        // Treat as markdown
        return quikdown_ast(input, options);
    }

    return { type: 'document', children: [] };
}

/**
 * Simple YAML parser for AST format
 * Only handles the subset needed for quikdown AST
 */
function parseYaml(yaml) {
    const lines = yaml.split('\n');
    return parseYamlNode(lines, 0, 0).value;
}

/**
 * Parse a YAML node starting at given line and indent
 */
function parseYamlNode(lines, startLine, minIndent) {
    if (startLine >= lines.length) {
        return { value: null, nextLine: startLine };
    }

    const line = lines[startLine];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
        return parseYamlNode(lines, startLine + 1, minIndent);
    }

    // Get current indent
    const indent = line.search(/\S/);
    if (indent < minIndent && indent >= 0) {
        return { value: null, nextLine: startLine };
    }

    // Array item
    if (trimmed.startsWith('- ')) {
        return parseYamlArray(lines, startLine, indent);
    }

    // Empty array
    if (trimmed === '[]') {
        return { value: [], nextLine: startLine + 1 };
    }

    // Empty object
    if (trimmed === '{}') {
        return { value: {}, nextLine: startLine + 1 };
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
        return parseYamlObject(lines, startLine, indent);
    }

    // Scalar value
    return { value: parseYamlScalar(trimmed), nextLine: startLine + 1 };
}

/**
 * Parse YAML array
 */
function parseYamlArray(lines, startLine, baseIndent) {
    const items = [];
    let i = startLine;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            i++;
            continue;
        }

        const indent = line.search(/\S/);
        if (indent < baseIndent && indent >= 0) break;
        if (indent > baseIndent && items.length > 0) {
            // Continuation of previous item
            i++;
            continue;
        }

        if (!trimmed.startsWith('- ')) break;

        // Parse the item after "- "
        const itemContent = trimmed.slice(2);

        if (itemContent.includes(':')) {
            // Object item - parse inline and following properties
            const obj = {};
            const colonIdx = itemContent.indexOf(':');
            const key = itemContent.slice(0, colonIdx).trim();
            let value = itemContent.slice(colonIdx + 1).trim();

            if (value === '' || value.startsWith('\n')) {
                // Value on next lines
                const result = parseYamlNode(lines, i + 1, indent + 2);
                obj[key] = result.value;
                i = result.nextLine;
            } else {
                obj[key] = parseYamlScalar(value);
                i++;
            }

            // Parse remaining properties at same indent
            while (i < lines.length) {
                const nextLine = lines[i];
                const nextTrimmed = nextLine.trim();
                if (nextTrimmed === '') {
                    i++;
                    continue;
                }

                const nextIndent = nextLine.search(/\S/);
                if (nextIndent <= baseIndent) break;
                if (nextTrimmed.startsWith('- ')) break;

                const nextColonIdx = nextTrimmed.indexOf(':');
                if (nextColonIdx > 0) {
                    const nextKey = nextTrimmed.slice(0, nextColonIdx).trim();
                    let nextValue = nextTrimmed.slice(nextColonIdx + 1).trim();

                    if (nextValue === '' || nextValue.startsWith('\n')) {
                        const result = parseYamlNode(lines, i + 1, nextIndent + 2);
                        obj[nextKey] = result.value;
                        i = result.nextLine;
                    } else {
                        obj[nextKey] = parseYamlScalar(nextValue);
                        i++;
                    }
                } else {
                    i++;
                }
            }

            items.push(obj);
        } else {
            items.push(parseYamlScalar(itemContent));
            i++;
        }
    }

    return { value: items, nextLine: i };
}

/**
 * Parse YAML object
 */
function parseYamlObject(lines, startLine, baseIndent) {
    const obj = {};
    let i = startLine;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            i++;
            continue;
        }

        const indent = line.search(/\S/);
        if (indent < baseIndent && indent >= 0) break;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx <= 0) {
            i++;
            continue;
        }

        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();

        if (value === '' || value === '|' || value === '>') {
            // Value on next lines
            const result = parseYamlNode(lines, i + 1, indent + 2);
            obj[key] = result.value;
            i = result.nextLine;
        } else {
            obj[key] = parseYamlScalar(value);
            i++;
        }
    }

    return { value: obj, nextLine: i };
}

/**
 * Parse YAML scalar value
 */
function parseYamlScalar(str) {
    if (!str) return null;

    const trimmed = str.trim();

    if (trimmed === 'null' || trimmed === '~') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Quoted string
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }

    // Number
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    return trimmed;
}

/**
 * Convert AST (or any valid input) to HTML
 * @param {string|Object} input - Markdown, AST, JSON, or YAML
 * @param {Object} options - Configuration options
 * @returns {string} - HTML string
 */
function quikdown_ast_html(input, options = {}) {
    const ast = toAst(input, options);
    return renderAst(ast, options);
}

/**
 * Render an AST node to HTML
 */
function renderAst(node, options = {}) {
    if (!node) return '';

    const { inline_styles = false } = options;
    const getAttr = createGetAttr(inline_styles);

    return renderNode(node, getAttr, options);
}

/**
 * Render a single node
 */
function renderNode(node, getAttr, options) {
    if (!node) return '';

    switch (node.type) {
        case 'document':
            return renderChildren(node.children, getAttr, options);

        case 'paragraph':
            return `<p>${renderChildren(node.children, getAttr, options)}</p>`;

        case 'heading':
            const level = node.level || 1;
            return `<h${level}${getAttr('h' + level)}>${renderChildren(node.children, getAttr, options)}</h${level}>`;

        case 'code_block':
            const langClass = !options.inline_styles && node.lang ? ` class="language-${node.lang}"` : '';
            const codeAttr = options.inline_styles ? getAttr('code') : langClass;
            return `<pre${getAttr('pre')}><code${codeAttr}>${escapeHtml(node.content)}</code></pre>`;

        case 'blockquote':
            return `<blockquote${getAttr('blockquote')}>${renderChildren(node.children, getAttr, options)}</blockquote>`;

        case 'list':
            const listTag = node.ordered ? 'ol' : 'ul';
            const items = (node.items || []).map(item => renderNode(item, getAttr, options)).join('');
            return `<${listTag}${getAttr(listTag)}>${items}</${listTag}>`;

        case 'list_item':
            // Handle task list items
            if (node.checked !== null && node.checked !== undefined) {
                const checkboxAttr = options.inline_styles
                    ? ' style="margin-right:.5em"'
                    : ` class="${CLASS_PREFIX}task-checkbox"`;
                const checked = node.checked ? ' checked' : '';
                const itemAttr = options.inline_styles
                    ? ' style="list-style:none"'
                    : ` class="${CLASS_PREFIX}task-item"`;
                return `<li${itemAttr}><input type="checkbox"${checkboxAttr}${checked} disabled> ${renderChildren(node.children, getAttr, options)}</li>`;
            }
            return `<li${getAttr('li')}>${renderChildren(node.children, getAttr, options)}</li>`;

        case 'table':
            return renderTable(node, getAttr, options);

        case 'hr':
            return `<hr${getAttr('hr')}>`;

        case 'text':
            return escapeHtml(node.value || '');

        case 'strong':
            return `<strong${getAttr('strong')}>${renderChildren(node.children, getAttr, options)}</strong>`;

        case 'em':
            return `<em${getAttr('em')}>${renderChildren(node.children, getAttr, options)}</em>`;

        case 'del':
            return `<del${getAttr('del')}>${renderChildren(node.children, getAttr, options)}</del>`;

        case 'code':
            return `<code${getAttr('code')}>${escapeHtml(node.value || '')}</code>`;

        case 'link':
            const sanitizedHref = sanitizeUrl(node.url);
            const isExternal = /^https?:\/\//i.test(sanitizedHref);
            const rel = isExternal ? ' rel="noopener noreferrer"' : '';
            return `<a${getAttr('a')} href="${sanitizedHref}"${rel}>${renderChildren(node.children, getAttr, options)}</a>`;

        case 'image':
            const sanitizedSrc = sanitizeUrl(node.url);
            return `<img${getAttr('img')} src="${sanitizedSrc}" alt="${escapeHtml(node.alt || '')}">`;

        case 'br':
            return '<br>';

        default:
            // Unknown node type - try to render children if present
            if (node.children) {
                return renderChildren(node.children, getAttr, options);
            }
            if (node.value !== undefined) {
                return escapeHtml(String(node.value));
            }
            return '';
    }
}

/**
 * Render children array
 */
function renderChildren(children, getAttr, options) {
    if (!children) return '';
    if (!Array.isArray(children)) {
        return renderNode(children, getAttr, options);
    }
    return children.map(child => renderNode(child, getAttr, options)).join('');
}

/**
 * Render a table node
 */
function renderTable(node, getAttr, options) {
    const alignments = node.alignments || [];

    let html = `<table${getAttr('table')}>\n`;

    // Headers
    if (node.headers && node.headers.length > 0) {
        html += '<thead>\n<tr>\n';
        node.headers.forEach((header, i) => {
            const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
            html += `<th${getAttr('th', alignStyle)}>${renderChildren(header, getAttr, options)}</th>\n`;
        });
        html += '</tr>\n</thead>\n';
    }

    // Body
    if (node.rows && node.rows.length > 0) {
        html += '<tbody>\n';
        node.rows.forEach(row => {
            html += '<tr>\n';
            row.forEach((cell, i) => {
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                html += `<td${getAttr('td', alignStyle)}>${renderChildren(cell, getAttr, options)}</td>\n`;
            });
            html += '</tr>\n';
        });
        html += '</tbody>\n';
    }

    html += '</table>';
    return html;
}

// Expose helper functions
quikdown_ast_html.toAst = toAst;
quikdown_ast_html.renderAst = renderAst;

// Attach version
quikdown_ast_html.version = quikdownVersion;

// Export for both CommonJS and ES6
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown_ast_html;
}

// For browser global
/* istanbul ignore next */
if (typeof window !== 'undefined') {
    window.quikdown_ast_html = quikdown_ast_html;
}

export default quikdown_ast_html;
