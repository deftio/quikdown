/**
 * quikdown - A minimal markdown parser optimized for chat/LLM output
 * Supports tables, code blocks, lists, and common formatting
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @param {Function} options.fence_plugin - Custom renderer for fenced code blocks
 *                   (content, fence_string) => html string
 * @param {boolean} options.inline_styles - If true, uses inline styles instead of classes
 * @returns {string} - The rendered HTML
 */

import quikdownVersion from './quikdown_version.js';

// Single source of truth for all style definitions
const QUIKDOWN_STYLES = {
    h1: 'font-size: 2em; font-weight: 600; margin: 0.67em 0; text-align: left',
    h2: 'font-size: 1.5em; font-weight: 600; margin: 0.83em 0',
    h3: 'font-size: 1.25em; font-weight: 600; margin: 1em 0',
    h4: 'font-size: 1em; font-weight: 600; margin: 1.33em 0',
    h5: 'font-size: 0.875em; font-weight: 600; margin: 1.67em 0',
    h6: 'font-size: 0.85em; font-weight: 600; margin: 2em 0',
    pre: 'background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 1em 0',
    code: 'background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace',
    blockquote: 'border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em',
    table: 'border-collapse: collapse; width: 100%; margin: 1em 0',
    thead: '',
    tbody: '',
    tr: '',
    th: 'border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; font-weight: bold; text-align: left',
    td: 'border: 1px solid #ddd; padding: 8px; text-align: left',
    hr: 'border: none; border-top: 1px solid #ddd; margin: 1em 0',
    img: 'max-width: 100%; height: auto',
    a: 'color: #0066cc; text-decoration: underline',
    strong: 'font-weight: bold',
    em: 'font-style: italic',
    del: 'text-decoration: line-through',
    ul: 'margin: 0.5em 0; padding-left: 2em',
    ol: 'margin: 0.5em 0; padding-left: 2em',
    li: 'margin: 0.25em 0',
    br: '',
    // Task list specific styles
    'task-item': 'list-style: none',
    'task-checkbox': 'margin-right: 0.5em'
};

// Factory function to create getAttr for a given context
function createGetAttr(inline_styles, styles) {
    return function(tag, additionalStyle = '') {
        if (inline_styles) {
            const style = styles[tag] || '';
            const fullStyle = additionalStyle ? `${style}; ${additionalStyle}` : style;
            return fullStyle ? ` style="${fullStyle}"` : '';
        } else {
            return ` class="quikdown-${tag}"`;
        }
    };
}

function quikdown(markdown, options = {}) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }
    
    const { fence_plugin, inline_styles = false } = options;
    const styles = QUIKDOWN_STYLES; // Use module-level styles
    const getAttr = createGetAttr(inline_styles, styles); // Create getAttr once

    // Escape HTML entities to prevent XSS
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    // Sanitize URLs to prevent XSS attacks
    function sanitizeUrl(url, allowUnsafe = false) {
        if (!url) return '';
        
        // If unsafe URLs are explicitly allowed, return as-is
        if (allowUnsafe) return url;
        
        // Trim and lowercase for checking
        const trimmedUrl = url.trim();
        const lowerUrl = trimmedUrl.toLowerCase();
        
        // Block dangerous protocols
        const dangerousProtocols = ['javascript:', 'vbscript:', 'data:'];
        
        for (const protocol of dangerousProtocols) {
            if (lowerUrl.startsWith(protocol)) {
                // Exception: Allow data:image/* for images
                if (protocol === 'data:' && lowerUrl.startsWith('data:image/')) {
                    return trimmedUrl;
                }
                // Return safe empty link for dangerous protocols
                return '#';
            }
        }
        
        return trimmedUrl;
    }

    // Process the markdown in phases
    let html = markdown;
    
    // Phase 1: Extract and protect code blocks and inline code
    const codeBlocks = [];
    const inlineCodes = [];
    
    // Extract fenced code blocks first (supports both ``` and ~~~)
    // Match paired fences - ``` with ``` and ~~~ with ~~~
    // Fence must be at start of line
    html = html.replace(/^(```|~~~)([^\n]*)\n([\s\S]*?)^\1$/gm, (match, fence, lang, code) => {
        const placeholder = `%%%CODEBLOCK${codeBlocks.length}%%%`;
        
        // Trim the language specification
        const langTrimmed = lang ? lang.trim() : '';
        
        // If custom fence plugin is provided, use it
        if (fence_plugin && typeof fence_plugin === 'function') {
            codeBlocks.push({
                lang: langTrimmed,
                code: code.trimEnd(),
                custom: true
            });
        } else {
            codeBlocks.push({
                lang: langTrimmed,
                code: escapeHtml(code.trimEnd()),
                custom: false
            });
        }
        return placeholder;
    });
    
    // Extract inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `%%%INLINECODE${inlineCodes.length}%%%`;
        inlineCodes.push(escapeHtml(code));
        return placeholder;
    });
    
    // Now escape HTML in the rest of the content
    html = escapeHtml(html);
    
    // Phase 2: Process block elements
    
    // Process tables
    html = processTable(html, inline_styles, styles);
    
    // Process headings (supports optional trailing #'s)
    html = html.replace(/^(#{1,6})\s+(.+?)\s*#*$/gm, (match, hashes, content) => {
        const level = hashes.length;
        return `<h${level}${getAttr('h' + level)}>${content}</h${level}>`;
    });
    
    // Process blockquotes (must handle escaped > since we already escaped HTML)
    html = html.replace(/^&gt;\s+(.+)$/gm, `<blockquote${getAttr('blockquote')}>$1</blockquote>`);
    // Merge consecutive blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
    
    // Process horizontal rules
    html = html.replace(/^---+$/gm, `<hr${getAttr('hr')}>`);
    
    // Process lists
    html = processLists(html, inline_styles, styles);
    
    // Phase 3: Process inline elements
    
    // Images (must come before links, with URL sanitization)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        const sanitizedSrc = sanitizeUrl(src, options.allow_unsafe_urls);
        return `<img${getAttr('img')} src="${sanitizedSrc}" alt="${alt}">`;
    });
    
    // Links (with URL sanitization)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
        // Sanitize URL to prevent XSS
        const sanitizedHref = sanitizeUrl(href, options.allow_unsafe_urls);
        const isExternal = /^https?:\/\//i.test(sanitizedHref);
        const rel = isExternal ? ' rel="noopener noreferrer"' : '';
        return `<a${getAttr('a')} href="${sanitizedHref}"${rel}>${text}</a>`;
    });
    
    // Autolinks - convert bare URLs to clickable links
    html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
        const sanitizedUrl = sanitizeUrl(url, options.allow_unsafe_urls);
        return `${prefix}<a${getAttr('a')} href="${sanitizedUrl}" rel="noopener noreferrer">${url}</a>`;
    });
    
    // Process inline formatting (bold, italic, strikethrough)
    const inlinePatterns = [
        [/\*\*(.+?)\*\*/g, 'strong'],
        [/__(.+?)__/g, 'strong'],
        [/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, 'em'],
        [/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, 'em'],
        [/~~(.+?)~~/g, 'del']
    ];
    
    inlinePatterns.forEach(([pattern, tag]) => {
        html = html.replace(pattern, `<${tag}${getAttr(tag)}>$1</${tag}>`);
    });
    
    // Line breaks (two spaces at end of line)
    html = html.replace(/  $/gm, `<br${getAttr('br')}>`);
    
    // Paragraphs (double newlines)
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs and unwrap block elements
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
        [/<p>(%%%CODEBLOCK\d+%%%)<\/p>/g, '$1']
    ];
    
    cleanupPatterns.forEach(([pattern, replacement]) => {
        html = html.replace(pattern, replacement);
    });
    
    // Phase 4: Restore code blocks and inline code
    
    // Restore code blocks
    codeBlocks.forEach((block, i) => {
        let replacement;
        
        if (block.custom && fence_plugin) {
            // Use custom fence plugin
            replacement = fence_plugin(block.code, block.lang);
            // If plugin returns undefined, fall back to default rendering
            if (replacement === undefined) {
                const langClass = !inline_styles && block.lang ? ` class="language-${block.lang}"` : '';
                const codeAttr = inline_styles ? getAttr('code') : langClass;
                replacement = `<pre${getAttr('pre')}><code${codeAttr}>${escapeHtml(block.code)}</code></pre>`;
            }
        } else {
            // Default rendering
            const langClass = !inline_styles && block.lang ? ` class="language-${block.lang}"` : '';
            const codeAttr = inline_styles ? getAttr('code') : langClass;
            replacement = `<pre${getAttr('pre')}><code${codeAttr}>${block.code}</code></pre>`;
        }
        
        const placeholder = `%%%CODEBLOCK${i}%%%`;
        html = html.replace(placeholder, replacement);
    });
    
    // Restore inline code
    inlineCodes.forEach((code, i) => {
        const placeholder = `%%%INLINECODE${i}%%%`;
        html = html.replace(placeholder, `<code${getAttr('code')}>${code}</code>`);
    });
    
    return html.trim();
}

/**
 * Process inline markdown formatting
 */
function processInlineMarkdown(text, inline_styles, styles) {
    const getAttr = createGetAttr(inline_styles, styles);
    
    // Process inline formatting patterns
    const patterns = [
        [/\*\*(.+?)\*\*/g, 'strong'],
        [/__(.+?)__/g, 'strong'],
        [/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, 'em'],
        [/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, 'em'],
        [/~~(.+?)~~/g, 'del'],
        [/`([^`]+)`/g, 'code']
    ];
    
    patterns.forEach(([pattern, tag]) => {
        text = text.replace(pattern, `<${tag}${getAttr(tag)}>$1</${tag}>`);
    });
    
    return text;
}

/**
 * Process markdown tables
 */
function processTable(text, inline_styles, styles) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    let tableLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this line looks like a table row (with or without trailing |)
        if (line.includes('|') && (line.startsWith('|') || /[^\\|]/.test(line))) {
            if (!inTable) {
                inTable = true;
                tableLines = [];
            }
            tableLines.push(line);
        } else {
            // Not a table line
            if (inTable) {
                // Process the accumulated table
                const tableHtml = buildTable(tableLines, inline_styles, styles);
                if (tableHtml) {
                    result.push(tableHtml);
                } else {
                    // Not a valid table, restore original lines
                    result.push(...tableLines);
                }
                inTable = false;
                tableLines = [];
            }
            result.push(lines[i]);
        }
    }
    
    // Handle table at end of text
    if (inTable && tableLines.length > 0) {
        const tableHtml = buildTable(tableLines, inline_styles, styles);
        if (tableHtml) {
            result.push(tableHtml);
        } else {
            result.push(...tableLines);
        }
    }
    
    return result.join('\n');
}

/**
 * Build an HTML table from markdown table lines
 */
function buildTable(lines, inline_styles, styles) {
    const getAttr = createGetAttr(inline_styles, styles);
    
    if (lines.length < 2) return null;
    
    // Check for separator line (second line should be the separator)
    let separatorIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        // Support separator with or without leading/trailing pipes
        if (/^\|?[\s\-:|]+\|?$/.test(lines[i]) && lines[i].includes('-')) {
            separatorIndex = i;
            break;
        }
    }
    
    if (separatorIndex === -1) return null;
    
    const headerLines = lines.slice(0, separatorIndex);
    const bodyLines = lines.slice(separatorIndex + 1);
    
    // Parse alignment from separator
    const separator = lines[separatorIndex];
    // Handle pipes at start/end or not
    const separatorCells = separator.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    const alignments = separatorCells.map(cell => {
        const trimmed = cell.trim();
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
        if (trimmed.endsWith(':')) return 'right';
        return 'left';
    });
    
    let html = `<table${getAttr('table')}>\n`;
    
    // Build header
    if (headerLines.length > 0) {
        html += `<thead${getAttr('thead')}>\n`;
        headerLines.forEach(line => {
            html += `<tr${getAttr('tr')}>\n`;
            // Handle pipes at start/end or not
            const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
            cells.forEach((cell, i) => {
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align: ${alignments[i]}` : '';
                const processedCell = processInlineMarkdown(cell.trim(), inline_styles, styles);
                html += `<th${getAttr('th', alignStyle)}>${processedCell}</th>\n`;
            });
            html += '</tr>\n';
        });
        html += '</thead>\n';
    }
    
    // Build body
    if (bodyLines.length > 0) {
        html += `<tbody${getAttr('tbody')}>\n`;
        bodyLines.forEach(line => {
            html += `<tr${getAttr('tr')}>\n`;
            // Handle pipes at start/end or not
            const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
            cells.forEach((cell, i) => {
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align: ${alignments[i]}` : '';
                const processedCell = processInlineMarkdown(cell.trim(), inline_styles, styles);
                html += `<td${getAttr('td', alignStyle)}>${processedCell}</td>\n`;
            });
            html += '</tr>\n';
        });
        html += '</tbody>\n';
    }
    
    html += '</table>';
    return html;
}

/**
 * Process markdown lists (ordered and unordered)
 */
function processLists(text, inline_styles, styles) {
    const getAttr = createGetAttr(inline_styles, styles);
    
    const lines = text.split('\n');
    const result = [];
    let listStack = []; // Track nested lists
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);
        
        if (match) {
            const [, indent, marker, content] = match;
            const level = Math.floor(indent.length / 2);
            const isOrdered = /^\d+\./.test(marker);
            const listType = isOrdered ? 'ol' : 'ul';
            
            // Check for task list items
            let listItemContent = content;
            let taskListClass = '';
            const taskMatch = content.match(/^\[([x ])\]\s+(.*)$/i);
            if (taskMatch && !isOrdered) {
                const [, checked, taskContent] = taskMatch;
                const isChecked = checked.toLowerCase() === 'x';
                const checkboxAttr = inline_styles 
                    ? ' style="margin-right: 0.5em"' 
                    : ' class="quikdown-task-checkbox"';
                listItemContent = `<input type="checkbox"${checkboxAttr}${isChecked ? ' checked' : ''} disabled> ${taskContent}`;
                taskListClass = inline_styles ? ' style="list-style: none"' : ' class="quikdown-task-item"';
            }
            
            // Close deeper levels
            while (listStack.length > level + 1) {
                const list = listStack.pop();
                result.push(`</${list.type}>`);
            }
            
            // Open new level if needed
            if (listStack.length === level) {
                // Need to open a new list
                listStack.push({ type: listType, level });
                result.push(`<${listType}${getAttr(listType)}>`);
            } else if (listStack.length === level + 1) {
                // Check if we need to switch list type
                const currentList = listStack[listStack.length - 1];
                if (currentList.type !== listType) {
                    result.push(`</${currentList.type}>`);
                    listStack.pop();
                    listStack.push({ type: listType, level });
                    result.push(`<${listType}${getAttr(listType)}>`);
                }
            }
            
            const liAttr = taskListClass || getAttr('li');
            result.push(`<li${liAttr}>${listItemContent}</li>`);
        } else {
            // Not a list item, close all lists
            while (listStack.length > 0) {
                const list = listStack.pop();
                result.push(`</${list.type}>`);
            }
            result.push(line);
        }
    }
    
    // Close any remaining lists
    while (listStack.length > 0) {
        const list = listStack.pop();
        result.push(`</${list.type}>`);
    }
    
    return result.join('\n');
}

/**
 * Emit CSS styles for quikdown elements
 * @returns {string} CSS string with quikdown styles
 */
quikdown.emitStyles = function() {
    const styles = QUIKDOWN_STYLES; // Use the same module-level styles
    
    let css = '';
    for (const [tag, style] of Object.entries(styles)) {
        if (style) {
            css += `.quikdown-${tag} { ${style} }\n`;
        }
    }
    
    return css;
};

/**
 * Configure quikdown with options and return a function
 * @param {Object} options - Configuration options
 * @returns {Function} Configured quikdown function
 */
quikdown.configure = function(options) {
    return function(markdown) {
        return quikdown(markdown, options);
    };
};

/**
 * Version information
 */
quikdown.version = quikdownVersion;

// Export for both CommonJS and ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown;
}

// For browser global
if (typeof window !== 'undefined') {
    window.quikdown = quikdown;
}

export default quikdown;