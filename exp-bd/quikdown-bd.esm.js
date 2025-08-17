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

// Version will be injected at build time  
const quikdownVersion = '__QUIKDOWN_VERSION__';

// Constants for reuse
const CLASS_PREFIX = 'quikdown-';
const PLACEHOLDER_CB = '§CB';
const PLACEHOLDER_IC = '§IC';

// Escape map at module level
const ESC_MAP$1 = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

// Single source of truth for all style definitions - optimized
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
    // Task list specific styles
    'task-item': 'list-style:none',
    'task-checkbox': 'margin-right:.5em'
};

// Factory function to create getAttr for a given context
function createGetAttr(inline_styles, styles) {
    return function(tag, additionalStyle = '') {
        if (inline_styles) {
            const style = styles[tag];
            if (!style && !additionalStyle) return '';
            const fullStyle = additionalStyle ? (style ? `${style};${additionalStyle}` : additionalStyle) : style;
            return ` style="${fullStyle}"`;
        } else {
            return ` class="${CLASS_PREFIX}${tag}"`;
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
        return text.replace(/[&<>"']/g, m => ESC_MAP$1[m]);
    }
    
    // Sanitize URLs to prevent XSS attacks
    function sanitizeUrl(url, allowUnsafe = false) {
        if (!url) return '';
        
        // If unsafe URLs are explicitly allowed, return as-is
        if (allowUnsafe) return url;
        
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
        const placeholder = `${PLACEHOLDER_CB}${codeBlocks.length}§`;
        
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
        const placeholder = `${PLACEHOLDER_IC}${inlineCodes.length}§`;
        inlineCodes.push(escapeHtml(code));
        return placeholder;
    });
    
    // Now escape HTML in the rest of the content
    html = escapeHtml(html);
    
    // Phase 2: Process block elements
    
    // Process tables
    html = processTable(html, getAttr);
    
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
    html = processLists(html, getAttr, inline_styles);
    
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
        [new RegExp(`<p>(${PLACEHOLDER_CB}\\d+§)<\/p>`, 'g'), '$1']
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
        
        const placeholder = `${PLACEHOLDER_CB}${i}§`;
        html = html.replace(placeholder, replacement);
    });
    
    // Restore inline code
    inlineCodes.forEach((code, i) => {
        const placeholder = `${PLACEHOLDER_IC}${i}§`;
        html = html.replace(placeholder, `<code${getAttr('code')}>${code}</code>`);
    });
    
    return html.trim();
}

/**
 * Process inline markdown formatting
 */
function processInlineMarkdown(text, getAttr) {
    
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
function processTable(text, getAttr) {
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
                const tableHtml = buildTable(tableLines, getAttr);
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
        const tableHtml = buildTable(tableLines, getAttr);
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
function buildTable(lines, getAttr) {
    
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
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                const processedCell = processInlineMarkdown(cell.trim(), getAttr);
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
                const alignStyle = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                const processedCell = processInlineMarkdown(cell.trim(), getAttr);
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
function processLists(text, getAttr, inline_styles) {
    
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
                    ? ' style="margin-right:.5em"' 
                    : ` class="${CLASS_PREFIX}task-checkbox"`;
                listItemContent = `<input type="checkbox"${checkboxAttr}${isChecked ? ' checked' : ''} disabled> ${taskContent}`;
                taskListClass = inline_styles ? ' style="list-style:none"' : ` class="${CLASS_PREFIX}task-item"`;
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
 * @param {string} prefix - Optional class prefix (default: 'quikdown-')
 * @param {string} theme - Optional theme: 'light' (default) or 'dark'
 * @returns {string} CSS string with quikdown styles
 */
quikdown.emitStyles = function(prefix = 'quikdown-', theme = 'light') {
    const styles = QUIKDOWN_STYLES;
    
    // Define theme color overrides
    const themeOverrides = {
        dark: {
            '#f4f4f4': '#2a2a2a', // pre background
            '#f0f0f0': '#2a2a2a', // code background
            '#f2f2f2': '#2a2a2a', // th background
            '#ddd': '#3a3a3a',    // borders
            '#06c': '#6db3f2',    // links
            _textColor: '#e0e0e0'
        },
        light: {
            _textColor: '#333'    // Explicit text color for light theme
        }
    };
    
    let css = '';
    for (const [tag, style] of Object.entries(styles)) {
        if (style) {
            let themedStyle = style;
            
            // Apply theme overrides if dark theme
            if (theme === 'dark' && themeOverrides.dark) {
                // Replace colors
                for (const [oldColor, newColor] of Object.entries(themeOverrides.dark)) {
                    if (!oldColor.startsWith('_')) {
                        themedStyle = themedStyle.replace(new RegExp(oldColor, 'g'), newColor);
                    }
                }
                
                // Add text color for certain elements in dark theme
                const needsTextColor = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'li', 'blockquote'];
                if (needsTextColor.includes(tag)) {
                    themedStyle += `;color:${themeOverrides.dark._textColor}`;
                }
            } else if (theme === 'light' && themeOverrides.light) {
                // Add explicit text color for light theme elements too
                const needsTextColor = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'li', 'blockquote'];
                if (needsTextColor.includes(tag)) {
                    themedStyle += `;color:${themeOverrides.light._textColor}`;
                }
            }
            
            css += `.${prefix}${tag} { ${themedStyle} }\n`;
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

/**
 * quikdown-bd - Bidirectional markdown/HTML converter
 * Experimental extension of quikdown with round-trip conversion support
 * 
 * Uses data-qd attributes to preserve original markdown syntax
 * Enables lossless HTML→Markdown conversion for quikdown-generated HTML
 */


// Version
const VERSION = '1.0.0-experimental';

// Helper to escape HTML (same as core)
const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ESC_MAP[m]);
}

// Modified getAttr that adds data-qd attributes
function createGetAttrBD(inline_styles, styles) {
    return function(tag, additionalStyle = '', sourceMarker = '') {
        let attrs = '';
        
        // Add data-qd attribute if source marker provided
        if (sourceMarker) {
            attrs += ` data-qd="${escapeHtml(sourceMarker)}"`;
        }
        
        // Add style or class
        if (inline_styles) {
            const style = styles[tag];
            if (style || additionalStyle) {
                const fullStyle = additionalStyle ? (style ? `${style};${additionalStyle}` : additionalStyle) : style;
                attrs += ` style="${fullStyle}"`;
            }
        } else {
            attrs += ` class="quikdown-${tag}"`;
        }
        
        return attrs;
    };
}

/**
 * Enhanced markdown parser with bidirectional support
 * Wraps the core parser and adds data-qd attributes
 */
function quikdownBD(markdown, options = {}) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }
    
    const { fence_plugin, inline_styles = false, bidirectional = true } = options;
    
    // If not bidirectional mode, just use regular quikdown
    if (!bidirectional) {
        return quikdown(markdown, options);
    }
    
    // For bidirectional, we need to manually process with source tracking
    // This is a custom implementation that adds data-qd attributes
    
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
    
    const getAttr = createGetAttrBD(inline_styles, QUIKDOWN_STYLES);
    
    // Process markdown with source tracking
    let html = markdown;
    
    // Phase 1: Extract and protect code blocks
    const codeBlocks = [];
    const inlineCodes = [];
    
    // Extract fenced code blocks
    html = html.replace(/^(```|~~~)([^\n]*)\n([\s\S]*?)^\1$/gm, (match, fence, lang, code) => {
        const placeholder = `§CB${codeBlocks.length}§`;
        codeBlocks.push({
            fence,
            lang: lang.trim(),
            code: escapeHtml(code.trimEnd()),
            original: match
        });
        return placeholder;
    });
    
    // Extract inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `§IC${inlineCodes.length}§`;
        inlineCodes.push({
            code: escapeHtml(code),
            original: match
        });
        return placeholder;
    });
    
    // Escape HTML
    html = escapeHtml(html);
    
    // Process headings with source tracking
    html = html.replace(/^(#{1,6})\s+(.+?)\s*#*$/gm, (match, hashes, content) => {
        const level = hashes.length;
        const sourceMarker = hashes;
        return `<h${level}${getAttr('h' + level, '', sourceMarker)}>${content}</h${level}>`;
    });
    
    // Process bold/italic/strikethrough with source tracking
    html = html.replace(/\*\*(.+?)\*\*/g, `<strong${getAttr('strong', '', '**')}>$1</strong>`);
    html = html.replace(/__(.+?)__/g, `<strong${getAttr('strong', '', '__')}>$1</strong>`);
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, `<em${getAttr('em', '', '*')}>$1</em>`);
    html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, `<em${getAttr('em', '', '_')}>$1</em>`);
    html = html.replace(/~~(.+?)~~/g, `<del${getAttr('del', '', '~~')}>$1</del>`);
    
    // Process blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, `<blockquote${getAttr('blockquote', '', '>')}>$1</blockquote>`);
    html = html.replace(/<\/blockquote>\n<blockquote[^>]*>/g, '\n');
    
    // Process horizontal rules
    html = html.replace(/^---+$/gm, `<hr${getAttr('hr', '', '---')}>`);
    
    // Process lists (simplified for now)
    html = processListsBD(html, getAttr);
    
    // Process links and images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        return `<img${getAttr('img', '', '!')} src="${src}" alt="${alt}" data-qd-alt="${escapeHtml(alt)}" data-qd-src="${escapeHtml(src)}">`;
    });
    
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
        return `<a${getAttr('a', '', '[')} href="${href}" data-qd-text="${escapeHtml(text)}">${text}</a>`;
    });
    
    // Process tables
    html = processTablesBD(html, getAttr);
    
    // Line breaks
    html = html.replace(/  $/gm, '<br data-qd="  ">');
    
    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs and unwrap block elements
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6][^>]*>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote[^>]*>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul[^>]*>|<ol[^>]*>)/g, '$1');
    html = html.replace(/(<\/ul>|<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr[^>]*>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table[^>]*>)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    
    // Restore code blocks
    codeBlocks.forEach((block, i) => {
        const placeholder = `§CB${i}§`;
        let replacement;
        
        if (fence_plugin && typeof fence_plugin === 'function') {
            replacement = fence_plugin(block.code, block.lang);
            if (replacement === undefined) {
                replacement = `<pre${getAttr('pre', '', block.fence)}><code data-qd-lang="${block.lang}">${block.code}</code></pre>`;
            }
        } else {
            replacement = `<pre${getAttr('pre', '', block.fence)} data-qd-fence="${block.fence}" data-qd-lang="${block.lang}"><code>${block.code}</code></pre>`;
        }
        
        html = html.replace(placeholder, replacement);
    });
    
    // Restore inline codes
    inlineCodes.forEach((item, i) => {
        const placeholder = `§IC${i}§`;
        html = html.replace(placeholder, `<code${getAttr('code', '', '`')}>${item.code}</code>`);
    });
    
    return html.trim();
}

// Process lists with source tracking
function processListsBD(text, getAttr, inline_styles) {
    const lines = text.split('\n');
    const result = [];
    let listStack = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);
        
        if (match) {
            const [, indent, marker, content] = match;
            const level = Math.floor(indent.length / 2);
            const isOrdered = /^\d+\./.test(marker);
            const listType = isOrdered ? 'ol' : 'ul';
            const sourceMarker = isOrdered ? '1.' : marker;
            
            // Handle task lists
            let listItemContent = content;
            let taskAttrs = '';
            const taskMatch = content.match(/^\[([x ])\]\s+(.*)$/i);
            if (taskMatch && !isOrdered) {
                const [, checked, taskContent] = taskMatch;
                const isChecked = checked.toLowerCase() === 'x';
                listItemContent = `<input type="checkbox"${getAttr('task-checkbox', '', '[')}${isChecked ? ' checked' : ''}> ${taskContent}`;
                taskAttrs = getAttr('task-item', '', '- [ ]');
            }
            
            // Close deeper levels
            while (listStack.length > level + 1) {
                const list = listStack.pop();
                result.push(`</${list.type}>`);
            }
            
            // Open new level if needed
            if (listStack.length === level) {
                listStack.push({ type: listType, level, marker: sourceMarker });
                result.push(`<${listType}${getAttr(listType, '', sourceMarker)}>`);
            }
            
            const liAttr = taskAttrs || getAttr('li', '', sourceMarker);
            result.push(`<li${liAttr}>${listItemContent}</li>`);
        } else {
            // Close all lists
            while (listStack.length > 0) {
                const list = listStack.pop();
                result.push(`</${list.type}>`);
            }
            result.push(line);
        }
    }
    
    // Close remaining lists
    while (listStack.length > 0) {
        const list = listStack.pop();
        result.push(`</${list.type}>`);
    }
    
    return result.join('\n');
}

// Process tables with source tracking
function processTablesBD(text, getAttr) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    let tableLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('|')) {
            if (!inTable) {
                inTable = true;
                tableLines = [];
            }
            tableLines.push(line);
        } else {
            if (inTable) {
                const tableHtml = buildTableBD(tableLines, getAttr);
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
    
    if (inTable && tableLines.length > 0) {
        const tableHtml = buildTableBD(tableLines, getAttr);
        if (tableHtml) {
            result.push(tableHtml);
        } else {
            result.push(...tableLines);
        }
    }
    
    return result.join('\n');
}

// Build table with source tracking
function buildTableBD(lines, getAttr) {
    if (lines.length < 2) return null;
    
    // Find separator
    let separatorIndex = -1;
    let alignments = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (/^\|?[\s\-:|]+\|?$/.test(lines[i]) && lines[i].includes('-')) {
            separatorIndex = i;
            const cells = lines[i].replace(/^\|/, '').replace(/\|$/, '').split('|');
            alignments = cells.map(cell => {
                const trimmed = cell.trim();
                if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
                if (trimmed.endsWith(':')) return 'right';
                return 'left';
            });
            break;
        }
    }
    
    if (separatorIndex === -1) return null;
    
    let html = `<table${getAttr('table', '', '|')} data-qd-align="${alignments.join(',')}">\n`;
    
    // Headers
    if (separatorIndex > 0) {
        html += `<thead${getAttr('thead', '', '|')}>\n<tr${getAttr('tr', '', '|')}>\n`;
        const cells = lines[0].replace(/^\|/, '').replace(/\|$/, '').split('|');
        cells.forEach((cell, i) => {
            const align = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
            html += `<th${getAttr('th', align, '|')} data-qd-align="${alignments[i] || 'left'}">${escapeHtml(cell.trim())}</th>\n`;
        });
        html += '</tr>\n</thead>\n';
    }
    
    // Body
    const bodyLines = lines.slice(separatorIndex + 1);
    if (bodyLines.length > 0) {
        html += `<tbody${getAttr('tbody', '', '|')}>\n`;
        bodyLines.forEach(line => {
            html += `<tr${getAttr('tr', '', '|')}>\n`;
            const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|');
            cells.forEach((cell, i) => {
                const align = alignments[i] && alignments[i] !== 'left' ? `text-align:${alignments[i]}` : '';
                html += `<td${getAttr('td', align, '|')} data-qd-align="${alignments[i] || 'left'}">${escapeHtml(cell.trim())}</td>\n`;
            });
            html += '</tr>\n';
        });
        html += '</tbody>\n';
    }
    
    html += '</table>';
    return html;
}

/**
 * Convert HTML back to Markdown by walking the DOM tree
 * Uses data-qd attributes when available, falls back to canonical forms
 * Assumes browser environment with DOM API available
 */
quikdownBD.toMarkdown = function(htmlOrElement) {
    // Accept either HTML string or DOM element
    let container;
    if (typeof htmlOrElement === 'string') {
        container = document.createElement('div');
        container.innerHTML = htmlOrElement;
    } else if (htmlOrElement instanceof Element) {
        container = htmlOrElement;
    } else {
        return '';
    }
    
    // Walk the DOM tree and reconstruct markdown
    function walkNode(node, parentContext = {}) {
        if (node.nodeType === Node.TEXT_NODE) {
            // Return text content, preserving whitespace where needed
            return node.textContent;
        }
        
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }
        
        const tag = node.tagName.toLowerCase();
        const dataQd = node.getAttribute('data-qd');
        const styles = window.getComputedStyle ? window.getComputedStyle(node) : {};
        
        // Process children with context
        let childContent = '';
        for (let child of node.childNodes) {
            childContent += walkNode(child, { parentTag: tag, ...parentContext });
        }
        
        // Determine markdown based on element and attributes
        switch (tag) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                const level = parseInt(tag[1]);
                const prefix = dataQd || '#'.repeat(level);
                return `${prefix} ${childContent.trim()}\n\n`;
                
            case 'strong':
            case 'b':
                // Check if it's bold through style too
                if (styles.fontWeight === 'bold' || styles.fontWeight >= 700 || tag === 'strong' || tag === 'b') {
                    const boldMarker = dataQd || '**';
                    return `${boldMarker}${childContent}${boldMarker}`;
                }
                return childContent;
                
            case 'em':
            case 'i':
                // Check for italic through style
                if (styles.fontStyle === 'italic' || tag === 'em' || tag === 'i') {
                    const emMarker = dataQd || '*';
                    return `${emMarker}${childContent}${emMarker}`;
                }
                return childContent;
                
            case 'del':
            case 's':
            case 'strike':
                const delMarker = dataQd || '~~';
                return `${delMarker}${childContent}${delMarker}`;
                
            case 'code':
                // Skip if inside pre (handled by pre)
                if (parentContext.parentTag === 'pre') {
                    return childContent;
                }
                const codeMarker = dataQd || '`';
                return `${codeMarker}${childContent}${codeMarker}`;
                
            case 'pre':
                const fence = node.getAttribute('data-qd-fence') || dataQd || '```';
                const lang = node.getAttribute('data-qd-lang') || '';
                // Look for code element child
                const codeEl = node.querySelector('code');
                const codeContent = codeEl ? codeEl.textContent : childContent;
                return `${fence}${lang}\n${codeContent.trimEnd()}\n${fence}\n\n`;
                
            case 'blockquote':
                const quoteMarker = dataQd || '>';
                const lines = childContent.trim().split('\n');
                return lines.map(line => `${quoteMarker} ${line}`).join('\n') + '\n\n';
                
            case 'hr':
                const hrMarker = dataQd || '---';
                return `${hrMarker}\n\n`;
                
            case 'br':
                const brMarker = dataQd || '  ';
                return `${brMarker}\n`;
                
            case 'a':
                const linkText = node.getAttribute('data-qd-text') || childContent.trim();
                const href = node.getAttribute('href') || '';
                // Check for autolinks
                if (linkText === href && !dataQd) {
                    return `<${href}>`;
                }
                return `[${linkText}](${href})`;
                
            case 'img':
                const alt = node.getAttribute('data-qd-alt') || node.getAttribute('alt') || '';
                const src = node.getAttribute('data-qd-src') || node.getAttribute('src') || '';
                const imgMarker = dataQd || '!';
                return `${imgMarker}[${alt}](${src})`;
                
            case 'ul':
            case 'ol':
                return walkList(node, tag === 'ol') + '\n';
                
            case 'li':
                // Handled by list processor
                return childContent;
                
            case 'table':
                return walkTable(node) + '\n\n';
                
            case 'p':
                // Check if it's actually a paragraph or just a wrapper
                if (childContent.trim()) {
                    return childContent.trim() + '\n\n';
                }
                return '';
                
            case 'div':
                // Check if it's a mermaid diagram
                if (node.classList && node.classList.contains('mermaid')) {
                    const fence = node.getAttribute('data-qd-fence') || '```';
                    const lang = node.getAttribute('data-qd-lang') || 'mermaid';
                    // Try to get original source from data attribute
                    const source = node.getAttribute('data-mermaid-source');
                    if (source) {
                        // Decode HTML entities
                        const temp = document.createElement('div');
                        temp.innerHTML = source;
                        const code = temp.textContent;
                        return `${fence}${lang}\n${code}\n${fence}\n\n`;
                    }
                    // Fallback: try to extract from the text content
                    const code = node.textContent.trim();
                    return `${fence}${lang}\n${code}\n${fence}\n\n`;
                }
                // Pass through other divs
                return childContent;
            
            case 'span':
                // Pass through container elements
                return childContent;
                
            default:
                return childContent;
        }
    }
    
    // Walk list elements
    function walkList(listNode, isOrdered, depth = 0) {
        let result = '';
        let index = 1;
        const indent = '  '.repeat(depth);
        
        for (let child of listNode.children) {
            if (child.tagName !== 'LI') continue;
            
            const dataQd = child.getAttribute('data-qd');
            let marker = dataQd || (isOrdered ? `${index}.` : '-');
            
            // Check for task list checkbox
            const checkbox = child.querySelector('input[type="checkbox"]');
            if (checkbox) {
                const checked = checkbox.checked ? 'x' : ' ';
                marker = '-';
                // Get text without the checkbox
                let text = '';
                for (let node of child.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        text += node.textContent;
                    } else if (node.tagName && node.tagName !== 'INPUT') {
                        text += walkNode(node);
                    }
                }
                result += `${indent}${marker} [${checked}] ${text.trim()}\n`;
            } else {
                let itemContent = '';
                
                for (let node of child.childNodes) {
                    if (node.tagName === 'UL' || node.tagName === 'OL') {
                        itemContent += walkList(node, node.tagName === 'OL', depth + 1);
                    } else {
                        itemContent += walkNode(node);
                    }
                }
                
                result += `${indent}${marker} ${itemContent.trim()}\n`;
            }
            
            index++;
        }
        
        return result;
    }
    
    // Walk table elements
    function walkTable(table) {
        let result = '';
        const alignData = table.getAttribute('data-qd-align');
        const alignments = alignData ? alignData.split(',') : [];
        
        // Process header
        const thead = table.querySelector('thead');
        if (thead) {
            const headerRow = thead.querySelector('tr');
            if (headerRow) {
                const headers = [];
                for (let th of headerRow.querySelectorAll('th')) {
                    headers.push(th.textContent.trim());
                }
                result += '| ' + headers.join(' | ') + ' |\n';
                
                // Add separator with alignment
                const separators = headers.map((_, i) => {
                    const align = alignments[i] || th.getAttribute('data-qd-align') || 'left';
                    if (align === 'center') return ':---:';
                    if (align === 'right') return '---:';
                    return '---';
                });
                result += '| ' + separators.join(' | ') + ' |\n';
            }
        }
        
        // Process body
        const tbody = table.querySelector('tbody');
        if (tbody) {
            for (let row of tbody.querySelectorAll('tr')) {
                const cells = [];
                for (let td of row.querySelectorAll('td')) {
                    cells.push(td.textContent.trim());
                }
                if (cells.length > 0) {
                    result += '| ' + cells.join(' | ') + ' |\n';
                }
            }
        }
        
        return result.trim();
    }
    
    // Process the DOM tree
    let markdown = walkNode(container);
    
    // Clean up
    markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines
    markdown = markdown.trim();
    
    return markdown;
};

// Re-export core methods
quikdownBD.emitStyles = quikdown.emitStyles;
quikdownBD.configure = function(options) {
    return function(markdown) {
        return quikdownBD(markdown, options);
    };
};
quikdownBD.version = VERSION;

// Export for both module and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdownBD;
}

if (typeof window !== 'undefined') {
    window.quikdownBD = quikdownBD;
}

export { quikdownBD as default };
