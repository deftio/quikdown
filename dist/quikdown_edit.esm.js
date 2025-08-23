/**
 * Quikdown Editor - Drop-in Markdown Parser
 * @version 1.0.6dev1
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
/**
 * quikdown - A minimal markdown parser optimized for chat/LLM output
 * Supports tables, code blocks, lists, and common formatting
 * @param {string} markdown - The markdown source text
 * @param {Object} options - Optional configuration object
 * @param {Function} options.fence_plugin - Custom renderer for fenced code blocks
 *                   (content, fence_string) => html string
 * @param {boolean} options.inline_styles - If true, uses inline styles instead of classes
 * @param {boolean} options.bidirectional - If true, adds data-qd attributes for source tracking
 * @param {boolean} options.lazy_linefeeds - If true, single newlines become <br> tags
 * @returns {string} - The rendered HTML
 */

// Version will be injected at build time  
const quikdownVersion = '1.0.6dev1';

// Constants for reuse
const CLASS_PREFIX = 'quikdown-';
const PLACEHOLDER_CB = '§CB';
const PLACEHOLDER_IC = '§IC';

// Escape map at module level
const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

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
            let style = styles[tag];
            if (!style && !additionalStyle) return '';
            
            // Remove default text-align if we're adding a different alignment
            if (additionalStyle && additionalStyle.includes('text-align') && style && style.includes('text-align')) {
                style = style.replace(/text-align:[^;]+;?/, '').trim();
                if (style && !style.endsWith(';')) style += ';';
            }
            
            /* istanbul ignore next - defensive: additionalStyle without style doesn't occur with current tags */
            const fullStyle = additionalStyle ? (style ? `${style}${additionalStyle}` : additionalStyle) : style;
            return ` style="${fullStyle}"`;
        } else {
            const classAttr = ` class="${CLASS_PREFIX}${tag}"`;
            // Apply inline styles for alignment even when using CSS classes
            if (additionalStyle) {
                return `${classAttr} style="${additionalStyle}"`;
            }
            return classAttr;
        }
    };
}

function quikdown(markdown, options = {}) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }
    
    const { fence_plugin, inline_styles = false, bidirectional = false, lazy_linefeeds = false } = options;
    const styles = QUIKDOWN_STYLES; // Use module-level styles
    const getAttr = createGetAttr(inline_styles, styles); // Create getAttr once

    // Escape HTML entities to prevent XSS
    function escapeHtml(text) {
        return text.replace(/[&<>"']/g, m => ESC_MAP[m]);
    }
    
    // Helper to add data-qd attributes for bidirectional support
    const dataQd = bidirectional ? (marker) => ` data-qd="${escapeHtml(marker)}"` : () => '';
    
    // Sanitize URLs to prevent XSS attacks
    function sanitizeUrl(url, allowUnsafe = false) {
        /* istanbul ignore next - defensive programming, regex ensures url is never empty */
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
                custom: true,
                fence: fence
            });
        } else {
            codeBlocks.push({
                lang: langTrimmed,
                code: escapeHtml(code.trimEnd()),
                custom: false,
                fence: fence
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
        return `<h${level}${getAttr('h' + level)}${dataQd(hashes)}>${content}</h${level}>`;
    });
    
    // Process blockquotes (must handle escaped > since we already escaped HTML)
    html = html.replace(/^&gt;\s+(.+)$/gm, `<blockquote${getAttr('blockquote')}>$1</blockquote>`);
    // Merge consecutive blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
    
    // Process horizontal rules (allow trailing spaces)
    html = html.replace(/^---+\s*$/gm, `<hr${getAttr('hr')}>`);
    
    // Process lists
    html = processLists(html, getAttr, inline_styles, bidirectional);
    
    // Phase 3: Process inline elements
    
    // Images (must come before links, with URL sanitization)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        const sanitizedSrc = sanitizeUrl(src, options.allow_unsafe_urls);
        const altAttr = bidirectional && alt ? ` data-qd-alt="${escapeHtml(alt)}"` : '';
        const srcAttr = bidirectional ? ` data-qd-src="${escapeHtml(src)}"` : '';
        return `<img${getAttr('img')} src="${sanitizedSrc}" alt="${alt}"${altAttr}${srcAttr}${dataQd('!')}>`;
    });
    
    // Links (with URL sanitization)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
        // Sanitize URL to prevent XSS
        const sanitizedHref = sanitizeUrl(href, options.allow_unsafe_urls);
        const isExternal = /^https?:\/\//i.test(sanitizedHref);
        const rel = isExternal ? ' rel="noopener noreferrer"' : '';
        const textAttr = bidirectional ? ` data-qd-text="${escapeHtml(text)}"` : '';
        return `<a${getAttr('a')} href="${sanitizedHref}"${rel}${textAttr}${dataQd('[')}>${text}</a>`;
    });
    
    // Autolinks - convert bare URLs to clickable links
    html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
        const sanitizedUrl = sanitizeUrl(url, options.allow_unsafe_urls);
        return `${prefix}<a${getAttr('a')} href="${sanitizedUrl}" rel="noopener noreferrer">${url}</a>`;
    });
    
    // Process inline formatting (bold, italic, strikethrough)
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
    
    // Line breaks
    if (lazy_linefeeds) {
        // Lazy linefeeds: single newline becomes <br> (except between paragraphs and after/before block elements)
        const blocks = [];
        let bi = 0;
        
        // Protect tables and lists  
        html = html.replace(/<(table|[uo]l)[^>]*>[\s\S]*?<\/\1>/g, m => {
            blocks[bi] = m;
            return `§B${bi++}§`;
        });
        
        // Handle paragraphs and block elements
        html = html.replace(/\n\n+/g, '§P§')
            // After block elements
            .replace(/(<\/(?:h[1-6]|blockquote|pre)>)\n/g, '$1§N§')
            .replace(/(<(?:h[1-6]|blockquote|pre|hr)[^>]*>)\n/g, '$1§N§')
            // Before block elements  
            .replace(/\n(<(?:h[1-6]|blockquote|pre|hr)[^>]*>)/g, '§N§$1')
            .replace(/\n(§B\d+§)/g, '§N§$1')
            .replace(/(§B\d+§)\n/g, '$1§N§')
            // Convert remaining newlines
            .replace(/\n/g, `<br${getAttr('br')}>`)
            // Restore
            .replace(/§N§/g, '\n')
            .replace(/§P§/g, '</p><p>');
        
        // Restore protected blocks
        blocks.forEach((b, i) => html = html.replace(`§B${i}§`, b));
        
        html = '<p>' + html + '</p>';
    } else {
        // Standard: two spaces at end of line for line breaks
        html = html.replace(/  $/gm, `<br${getAttr('br')}>`);
        
        // Paragraphs (double newlines)
        // Don't add </p> after block elements (they're not in paragraphs)
        html = html.replace(/\n\n+/g, (match, offset) => {
            // Check if we're after a block element closing tag
            const before = html.substring(0, offset);
            if (before.match(/<\/(h[1-6]|blockquote|ul|ol|table|pre|hr)>$/)) {
                return '<p>';  // Just open a new paragraph
            }
            return '</p><p>';  // Normal paragraph break
        });
        html = '<p>' + html + '</p>';
    }
    
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
    
    // Fix orphaned closing </p> tags after block elements
    // When a paragraph follows a block element, ensure it has opening <p>
    html = html.replace(/(<\/(?:h[1-6]|blockquote|ul|ol|table|pre|hr)>)\n([^<])/g, '$1\n<p>$2');
    
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
                const langAttr = bidirectional && block.lang ? ` data-qd-lang="${escapeHtml(block.lang)}"` : '';
                const fenceAttr = bidirectional ? ` data-qd-fence="${escapeHtml(block.fence)}"` : '';
                replacement = `<pre${getAttr('pre')}${fenceAttr}${langAttr}><code${codeAttr}>${escapeHtml(block.code)}</code></pre>`;
            }
        } else {
            // Default rendering
            const langClass = !inline_styles && block.lang ? ` class="language-${block.lang}"` : '';
            const codeAttr = inline_styles ? getAttr('code') : langClass;
            const langAttr = bidirectional && block.lang ? ` data-qd-lang="${escapeHtml(block.lang)}"` : '';
            const fenceAttr = bidirectional ? ` data-qd-fence="${escapeHtml(block.fence)}"` : '';
            replacement = `<pre${getAttr('pre')}${fenceAttr}${langAttr}><code${codeAttr}>${block.code}</code></pre>`;
        }
        
        const placeholder = `${PLACEHOLDER_CB}${i}§`;
        html = html.replace(placeholder, replacement);
    });
    
    // Restore inline code
    inlineCodes.forEach((code, i) => {
        const placeholder = `${PLACEHOLDER_IC}${i}§`;
        html = html.replace(placeholder, `<code${getAttr('code')}${dataQd('`')}>${code}</code>`);
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
    // Note: headerLines will always have length > 0 since separatorIndex starts from 1
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
function processLists(text, getAttr, inline_styles, bidirectional) {
    
    const lines = text.split('\n');
    const result = [];
    let listStack = []; // Track nested lists
    
    // Helper to escape HTML for data-qd attributes
    const escapeHtml = (text) => text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
    const dataQd = bidirectional ? (marker) => ` data-qd="${escapeHtml(marker)}"` : () => '';
    
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
            result.push(`<li${liAttr}${dataQd(marker)}>${listItemContent}</li>`);
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
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown;
}

// For browser global
/* istanbul ignore next */
if (typeof window !== 'undefined') {
    window.quikdown = quikdown;
}

/**
 * quikdown_bd - Bidirectional markdown/HTML converter
 * Extends core quikdown with HTML→Markdown conversion
 * 
 * Uses data-qd attributes to preserve original markdown syntax
 * Enables HTML→Markdown conversion for quikdown-generated HTML
 */


/**
 * Create bidirectional version by extending quikdown
 * This wraps quikdown and adds the toMarkdown method
 */
function quikdown_bd(markdown, options = {}) {
    // Use core quikdown with bidirectional flag to add data-qd attributes
    return quikdown(markdown, { ...options, bidirectional: true });
}

// Copy all properties and methods from quikdown (including version)
Object.keys(quikdown).forEach(key => {
    quikdown_bd[key] = quikdown[key];
});

// Add the toMarkdown method for HTML→Markdown conversion
quikdown_bd.toMarkdown = function(htmlOrElement) {
    // Accept either HTML string or DOM element
    let container;
    if (typeof htmlOrElement === 'string') {
        container = document.createElement('div');
        container.innerHTML = htmlOrElement;
    } else if (htmlOrElement instanceof Element) {
        /* istanbul ignore next - browser-only code path, not testable in jsdom */
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
                if (!childContent) return ''; // Don't add markers for empty content
                const boldMarker = dataQd || '**';
                return `${boldMarker}${childContent}${boldMarker}`;
                
            case 'em':
            case 'i':
                if (!childContent) return ''; // Don't add markers for empty content
                const emMarker = dataQd || '*';
                return `${emMarker}${childContent}${emMarker}`;
                
            case 'del':
            case 's':
            case 'strike':
                if (!childContent) return ''; // Don't add markers for empty content
                const delMarker = dataQd || '~~';
                return `${delMarker}${childContent}${delMarker}`;
                
            case 'code':
                // Note: code inside pre is handled directly by the pre case using querySelector
                if (!childContent) return ''; // Don't add markers for empty content
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
                    // Check if paragraph ends with a line that's just whitespace
                    // This indicates an intentional blank line before the next element
                    const lines = childContent.split('\n');
                    let content = childContent.trim();
                    
                    // If the last line(s) are just whitespace, preserve one blank line
                    if (lines.length > 1) {
                        let trailingBlankLines = 0;
                        for (let i = lines.length - 1; i >= 0; i--) {
                            if (lines[i].trim() === '') {
                                trailingBlankLines++;
                            } else {
                                break;
                            }
                        }
                        if (trailingBlankLines > 0) {
                            // Add a line with just a space, followed by single newline
                            // The \n\n will be added below for paragraph separation
                            content = content + '\n ';
                            // Only add one newline since we're preserving the space line
                            return content + '\n';
                        }
                    }
                    
                    return content + '\n\n';
                }
                return '';
                
            case 'div':
                // Check if it's a mermaid container
                if (node.classList && node.classList.contains('mermaid-container')) {
                    const fence = node.getAttribute('data-qd-fence') || '```';
                    const lang = node.getAttribute('data-qd-lang') || 'mermaid';
                    
                    // First check for data-qd-source attribute on the container
                    const source = node.getAttribute('data-qd-source');
                    if (source) {
                        // Decode HTML entities from the attribute (mainly &quot;)
                        const temp = document.createElement('textarea');
                        temp.innerHTML = source;
                        const code = temp.value;
                        return `${fence}${lang}\n${code}\n${fence}\n\n`;
                    }
                    
                    // Check for source on the pre.mermaid element
                    const mermaidPre = node.querySelector('pre.mermaid');
                    if (mermaidPre) {
                        const preSource = mermaidPre.getAttribute('data-qd-source');
                        if (preSource) {
                            const temp = document.createElement('textarea');
                            temp.innerHTML = preSource;
                            const code = temp.value;
                            return `${fence}${lang}\n${code}\n${fence}\n\n`;
                        }
                    }
                    
                    // Fallback: Look for the legacy .mermaid-source element
                    const sourceElement = node.querySelector('.mermaid-source');
                    if (sourceElement) {
                        // Decode HTML entities
                        const temp = document.createElement('div');
                        temp.innerHTML = sourceElement.innerHTML;
                        const code = temp.textContent;
                        return `${fence}${lang}\n${code}\n${fence}\n\n`;
                    }
                    
                    // Final fallback: try to extract from the mermaid element (unreliable after rendering)
                    const mermaidElement = node.querySelector('.mermaid');
                    if (mermaidElement && mermaidElement.textContent.includes('graph')) {
                        return `${fence}${lang}\n${mermaidElement.textContent.trim()}\n${fence}\n\n`;
                    }
                }
                // Check if it's a standalone mermaid diagram (legacy)
                if (node.classList && node.classList.contains('mermaid')) {
                    const fence = node.getAttribute('data-qd-fence') || '```';
                    const lang = node.getAttribute('data-qd-lang') || 'mermaid';
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
                    const align = alignments[i] || 'left';
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

// Override the configure method to return a bidirectional version
quikdown_bd.configure = function(options) {
    return function(markdown) {
        return quikdown_bd(markdown, options);
    };
};

// Set version
// Version is already copied from quikdown via Object.keys loop

// Export for both module and browser
/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown_bd;
}

/* istanbul ignore next */
if (typeof window !== 'undefined') {
    window.quikdown_bd = quikdown_bd;
}

/**
 * Quikdown Editor - A drop-in markdown editor control
 * @version 1.0.5
 * @license BSD-2-Clause
 */


// Default options
const DEFAULT_OPTIONS = {
    mode: 'split',          // 'source' | 'preview' | 'split'
    showToolbar: true,
    showRemoveHR: false,    // Show button to remove horizontal rules (---) 
    theme: 'auto',          // 'light' | 'dark' | 'auto'
    lazy_linefeeds: false,
    inline_styles: false,   // Use CSS classes (false) or inline styles (true)
    debounceDelay: 20,      // Reduced from 100ms for better responsiveness
    placeholder: 'Start typing markdown...',
    plugins: {
        highlightjs: false,
        mermaid: false
    },
    customFences: {}, // { 'language': (code, lang) => html }
    enableComplexFences: true // Enable CSV tables, math rendering, SVG, etc.
};

/**
 * Quikdown Editor - A complete markdown editing solution
 */
class QuikdownEditor {
    constructor(container, options = {}) {
        // Resolve container
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!this.container) {
            throw new Error('QuikdownEditor: Invalid container');
        }
        
        // Merge options
        this.options = { ...DEFAULT_OPTIONS, ...options };
        
        // State
        this._markdown = '';
        this._html = '';
        this.currentMode = this.options.mode;
        this.updateTimer = null;
        
        // Initialize
        this.initPromise = this.init();
    }
    
    /**
     * Initialize the editor
     */
    async init() {
        // Load plugins if requested
        await this.loadPlugins();
        
        // Build UI
        this.buildUI();
        
        // Attach event listeners
        this.attachEvents();
        
        // Apply initial theme
        this.applyTheme();
        
        // Set initial mode
        this.setMode(this.currentMode);
        
        // Set initial content if provided
        if (this.options.initialContent) {
            this.setMarkdown(this.options.initialContent);
        }
    }
    
    /**
     * Build the editor UI
     */
    buildUI() {
        // Clear container
        this.container.innerHTML = '';
        
        // Add editor class
        this.container.classList.add('qde-container');
        
        // Create toolbar if enabled
        if (this.options.showToolbar) {
            this.toolbar = this.createToolbar();
            this.container.appendChild(this.toolbar);
        }
        
        // Create editor area
        this.editorArea = document.createElement('div');
        this.editorArea.className = 'qde-editor';
        
        // Create source panel
        this.sourcePanel = document.createElement('div');
        this.sourcePanel.className = 'qde-source';
        
        this.sourceTextarea = document.createElement('textarea');
        this.sourceTextarea.className = 'qde-textarea';
        this.sourceTextarea.placeholder = this.options.placeholder;
        this.sourcePanel.appendChild(this.sourceTextarea);
        
        // Create preview panel
        this.previewPanel = document.createElement('div');
        this.previewPanel.className = 'qde-preview';
        this.previewPanel.contentEditable = true;
        
        // Add panels to editor
        this.editorArea.appendChild(this.sourcePanel);
        this.editorArea.appendChild(this.previewPanel);
        this.container.appendChild(this.editorArea);
        
        // Add built-in styles if not already present
        this.injectStyles();
    }
    
    /**
     * Create toolbar
     */
    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'qde-toolbar';
        
        // Mode buttons
        const modes = ['source', 'split', 'preview'];
        const modeLabels = { source: 'Source', split: 'Split', preview: 'Rendered' };
        modes.forEach(mode => {
            const btn = document.createElement('button');
            btn.className = 'qde-btn';
            btn.dataset.mode = mode;
            btn.textContent = modeLabels[mode];
            btn.title = `Switch to ${modeLabels[mode]} view`;
            toolbar.appendChild(btn);
        });
        
        // Spacer
        const spacer = document.createElement('span');
        spacer.className = 'qde-spacer';
        toolbar.appendChild(spacer);
        
        // Copy buttons
        const copyButtons = [
            { action: 'copy-markdown', text: 'Copy MD', title: 'Copy markdown to clipboard' },
            { action: 'copy-html', text: 'Copy HTML', title: 'Copy HTML to clipboard' }
        ];
        
        copyButtons.forEach(({ action, text, title }) => {
            const btn = document.createElement('button');
            btn.className = 'qde-btn';
            btn.dataset.action = action;
            btn.textContent = text;
            btn.title = title;
            toolbar.appendChild(btn);
        });
        
        // Remove HR button (if enabled)
        if (this.options.showRemoveHR) {
            const removeHRBtn = document.createElement('button');
            removeHRBtn.className = 'qde-btn';
            removeHRBtn.dataset.action = 'remove-hr';
            removeHRBtn.textContent = 'Remove HR';
            removeHRBtn.title = 'Remove all horizontal rules (---) from markdown';
            toolbar.appendChild(removeHRBtn);
        }
        
        return toolbar;
    }
    
    /**
     * Inject built-in styles
     */
    injectStyles() {
        if (document.getElementById('qde-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'qde-styles';
        style.textContent = `
            .qde-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                background: white;
            }
            
            .qde-toolbar {
                display: flex;
                align-items: center;
                padding: 8px;
                background: #f5f5f5;
                border-bottom: 1px solid #ddd;
                gap: 4px;
            }
            
            .qde-btn {
                padding: 6px 12px;
                border: 1px solid #ccc;
                background: white;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .qde-btn:hover {
                background: #e9e9e9;
                border-color: #999;
            }
            
            .qde-btn.active {
                background: #007bff;
                color: white;
                border-color: #0056b3;
            }
            
            .qde-spacer {
                flex: 1;
            }
            
            .qde-editor {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .qde-source, .qde-preview {
                flex: 1;
                overflow: auto;
                padding: 16px;
            }
            
            .qde-source {
                border-right: 1px solid #ddd;
            }
            
            .qde-textarea {
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
                resize: none;
                font-family: 'Monaco', 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .qde-preview {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                outline: none;
                cursor: text;  /* Standard text cursor */
            }
            
            /* Fence-specific styles */
            .qde-svg-container {
                max-width: 100%;
                overflow: auto;
            }
            
            .qde-svg-container svg {
                max-width: 100%;
                height: auto;
            }
            
            .qde-html-container {
                /* HTML containers inherit background */
                margin: 12px 0;
            }
            
            .qde-math-container {
                text-align: center;
                margin: 16px 0;
                overflow-x: auto;
            }
            
            /* All tables in preview (both regular markdown and CSV) */
            .qde-preview table {
                width: 100%;
                border-collapse: collapse;
                margin: 12px 0;
                font-size: 14px;
            }
            
            .qde-preview table th,
            .qde-preview table td {
                border: 1px solid #ddd;
                padding: 8px;
            }
            
            /* Support for alignment classes from quikdown */
            .qde-preview .quikdown-left { text-align: left; }
            .qde-preview .quikdown-center { text-align: center; }
            .qde-preview .quikdown-right { text-align: right; }
            
            .qde-preview table th {
                background: #f5f5f5;
                font-weight: bold;
            }
            
            .qde-preview table tr:nth-child(even) {
                background: #f9f9f9;
            }
            
            /* Specific to CSV-generated tables */
            .qde-data-table {
                /* Can add specific CSV table styles here if needed */
            }
            
            .qde-json {
                /* Let highlight.js handle styling */
                overflow-x: auto;
            }
            
            .qde-error {
                background: #fee;
                border: 1px solid #fcc;
                color: #c00;
                padding: 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
            }
            
            /* Read-only complex fence blocks in preview */
            .qde-preview [contenteditable="false"] {
                cursor: auto;  /* Use automatic cursor (arrow for non-text) */
                user-select: text;
                position: relative;
            }
            
            /* Ensure proper cursor for editable text elements */
            .qde-preview p,
            .qde-preview h1,
            .qde-preview h2,
            .qde-preview h3,
            .qde-preview h4,
            .qde-preview h5,
            .qde-preview h6,
            .qde-preview li,
            .qde-preview td,
            .qde-preview th,
            .qde-preview blockquote,
            .qde-preview pre[contenteditable="true"],
            .qde-preview code[contenteditable="true"] {
                cursor: text;
            }
            
            
            /* Non-editable complex renderers */
            .qde-preview .qde-svg-container[contenteditable="false"],
            .qde-preview .qde-html-container[contenteditable="false"],
            .qde-preview .qde-math-container[contenteditable="false"],
            .qde-preview .mermaid[contenteditable="false"] {
                opacity: 0.98;
            }
            
            /* Subtle hover effect for read-only blocks */
            .qde-preview [contenteditable="false"]:hover::after {
                content: "Read-only";
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 10px;
                color: #999;
                background: rgba(255, 255, 255, 0.9);
                padding: 2px 4px;
                border-radius: 2px;
                pointer-events: none;
            }
            
            /* Fix list padding in preview */
            .qde-preview ul,
            .qde-preview ol {
                padding-left: 2em;
                margin: 0.5em 0;
            }
            
            .qde-preview li {
                margin: 0.25em 0;
            }
            
            /* Mode-specific visibility */
            .qde-mode-source .qde-preview { display: none; }
            .qde-mode-source .qde-source { border-right: none; }
            .qde-mode-preview .qde-source { display: none; }
            .qde-mode-split .qde-source,
            .qde-mode-split .qde-preview { display: block; }
            
            /* Dark theme */
            .qde-dark {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            .qde-dark .qde-toolbar {
                background: #2d2d2d;
                border-color: #444;
            }
            
            .qde-dark .qde-btn {
                background: #3a3a3a;
                color: #e0e0e0;
                border-color: #555;
            }
            
            .qde-dark .qde-btn:hover {
                background: #4a4a4a;
            }
            
            .qde-dark .qde-source {
                border-color: #444;
            }
            
            .qde-dark .qde-textarea {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            .qde-dark .qde-preview {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            
            /* Dark mode table styles */
            .qde-dark .qde-preview table th,
            .qde-dark .qde-preview table td {
                border-color: #3a3a3a;
            }
            
            .qde-dark .qde-preview table th {
                background: #2d2d2d;
            }
            
            .qde-dark .qde-preview table tr:nth-child(even) {
                background: #252525;
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .qde-mode-split .qde-editor {
                    flex-direction: column;
                }
                
                .qde-mode-split .qde-source {
                    border-right: none;
                    border-bottom: 1px solid #ddd;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Attach event listeners
     */
    attachEvents() {
        // Source textarea input
        this.sourceTextarea.addEventListener('input', () => {
            this.handleSourceInput();
        });
        
        // Preview contenteditable input
        this.previewPanel.addEventListener('input', () => {
            this.handlePreviewInput();
        });
        
        // Toolbar buttons
        if (this.toolbar) {
            this.toolbar.addEventListener('click', (e) => {
                const btn = e.target.closest('.qde-btn');
                if (!btn) return;
                
                if (btn.dataset.mode) {
                    this.setMode(btn.dataset.mode);
                } else if (btn.dataset.action) {
                    this.handleAction(btn.dataset.action);
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '1':
                        e.preventDefault();
                        this.setMode('source');
                        break;
                    case '2':
                        e.preventDefault();
                        this.setMode('split');
                        break;
                    case '3':
                        e.preventDefault();
                        this.setMode('preview');
                        break;
                }
            }
        });
    }
    
    /**
     * Handle source textarea input
     */
    handleSourceInput() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updateFromMarkdown(this.sourceTextarea.value);
        }, this.options.debounceDelay);
    }
    
    /**
     * Handle preview panel input
     */
    handlePreviewInput() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updateFromHTML();
        }, this.options.debounceDelay);
    }
    
    /**
     * Update from markdown source
     */
    updateFromMarkdown(markdown) {
        this._markdown = markdown || '';
        
        // Show placeholder if empty
        if (!this._markdown.trim()) {
            this._html = '';
            if (this.currentMode !== 'source') {
                this.previewPanel.innerHTML = '<div style="color: #999; font-style: italic; padding: 16px;">Start typing markdown in the source panel...</div>';
            }
        } else {
            this._html = quikdown_bd(markdown, {
                fence_plugin: this.createFencePlugin(),
                lazy_linefeeds: this.options.lazy_linefeeds,
                inline_styles: this.options.inline_styles
            });
            
            // Update preview if visible
            if (this.currentMode !== 'source') {
                this.previewPanel.innerHTML = this._html;
                // Make all fence blocks non-editable
                this.makeFencesNonEditable();
            }
        }
        
        // Trigger change event
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html);
        }
    }
    
    /**
     * Update from HTML preview
     */
    updateFromHTML() {
        // Clone the preview panel to avoid modifying the actual DOM
        const clonedPanel = this.previewPanel.cloneNode(true);
        
        // Pre-process special elements on the clone
        this.preprocessSpecialElements(clonedPanel);
        
        this._html = this.previewPanel.innerHTML;
        this._markdown = quikdown_bd.toMarkdown(clonedPanel);
        
        // Update source if visible
        if (this.currentMode !== 'preview') {
            this.sourceTextarea.value = this._markdown;
        }
        
        // Trigger change event
        if (this.options.onChange) {
            this.options.onChange(this._markdown, this._html);
        }
    }
    
    /**
     * Pre-process special elements before markdown conversion
     */
    preprocessSpecialElements(panel) {
        if (!panel) return;
        
        
        // Restore non-editable complex fences from their data attributes
        const complexFences = panel.querySelectorAll('[contenteditable="false"][data-qd-source]');
        complexFences.forEach(element => {
            const source = element.getAttribute('data-qd-source');
            const fence = element.getAttribute('data-qd-fence') || '```';
            const lang = element.getAttribute('data-qd-lang') || '';
            
            // Create a pre element with the original source
            const pre = document.createElement('pre');
            pre.setAttribute('data-qd-fence', fence);
            if (lang) pre.setAttribute('data-qd-lang', lang);
            const code = document.createElement('code');
            // The source is already the original unescaped content when using setAttribute
            // No need to unescape since browser handles it automatically
            code.textContent = source;
            pre.appendChild(code);
            
            // Replace the complex element with pre
            element.parentNode.replaceChild(pre, element);
        });
        
        // Convert CSV tables back to CSV fence blocks (these ARE editable)
        const csvTables = panel.querySelectorAll('table.qde-csv-table[data-qd-lang]');
        csvTables.forEach(table => {
            const lang = table.getAttribute('data-qd-lang');
            if (!lang || !['csv', 'psv', 'tsv'].includes(lang)) return;
            
            const delimiter = lang === 'csv' ? ',' : lang === 'psv' ? '|' : '\t';
            
            // Extract data from table
            let csv = '';
            
            // Get headers
            const headers = [];
            const headerCells = table.querySelectorAll('thead th');
            headerCells.forEach(th => {
                const text = th.textContent.trim();
                // Quote if contains delimiter or quotes
                const needsQuoting = text.includes(delimiter) || text.includes('"') || text.includes('\n');
                headers.push(needsQuoting ? `"${text.replace(/"/g, '""')}"` : text);
            });
            csv += headers.join(delimiter) + '\n';
            
            // Get rows
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(tr => {
                const cells = [];
                tr.querySelectorAll('td').forEach(td => {
                    const text = td.textContent.trim();
                    const needsQuoting = text.includes(delimiter) || text.includes('"') || text.includes('\n');
                    cells.push(needsQuoting ? `"${text.replace(/"/g, '""')}"` : text);
                });
                csv += cells.join(delimiter) + '\n';
            });
            
            // Create a pre element with the CSV data
            const pre = document.createElement('pre');
            pre.setAttribute('data-qd-fence', '```');
            pre.setAttribute('data-qd-lang', lang);
            const code = document.createElement('code');
            code.textContent = csv.trim();
            pre.appendChild(code);
            
            // Replace table with pre
            table.parentNode.replaceChild(pre, table);
        });
    }
    
    /**
     * Create fence plugin for syntax highlighting
     */
    createFencePlugin() {
        return (code, lang) => {
            // Check custom fences first (they take precedence)
            if (this.options.customFences && this.options.customFences[lang]) {
                try {
                    return this.options.customFences[lang](code, lang);
                } catch (err) {
                    console.error(`Custom fence plugin error for ${lang}:`, err);
                    return `<pre><code class="language-${lang}">${this.escapeHtml(code)}</code></pre>`;
                }
            }
            
            // For bidirectional editing, only apply syntax highlighting
            // Skip complex transformations that break round-trip conversion
            const skipComplexRendering = !this.options.enableComplexFences;
            
            if (!skipComplexRendering) {
                // Built-in lazy loading fence handlers (disabled for now)
                switch(lang) {
                    case 'svg':
                        return this.renderSVG(code);
                        
                    case 'html':
                        return this.renderHTML(code);
                        
                    case 'math':
                    case 'katex':
                    case 'tex':
                    case 'latex':
                        return this.renderMath(code, lang);
                        
                    case 'csv':
                    case 'psv':
                    case 'tsv':
                        return this.renderTable(code, lang);
                        
                    case 'json':
                    case 'json5':
                        return this.renderJSON(code, lang);
                        
                    case 'mermaid':
                        if (window.mermaid) {
                            return this.renderMermaid(code);
                        }
                        break;
                }
            }
            
            // Syntax highlighting support - keep editable for bidirectional
            if (window.hljs && lang && hljs.getLanguage(lang)) {
                const highlighted = hljs.highlight(code, { language: lang }).value;
                // Don't add contenteditable="false" - the bidirectional system can extract text from the highlighted code
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
            }
            
            // Default: let quikdown handle it
            return undefined;
        };
    }
    
    /**
     * Render SVG content
     */
    renderSVG(code) {
        try {
            // Basic SVG validation
            const parser = new DOMParser();
            const doc = parser.parseFromString(code, 'image/svg+xml');
            const parseError = doc.querySelector('parsererror');
            
            if (parseError) {
                throw new Error('Invalid SVG');
            }
            
            // Sanitize SVG by removing script tags and event handlers
            const svg = doc.documentElement;
            svg.querySelectorAll('script').forEach(el => el.remove());
            
            // Remove event handlers
            const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
            let node;
            while (node = walker.nextNode()) {
                for (let i = node.attributes.length - 1; i >= 0; i--) {
                    const attr = node.attributes[i];
                    if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                        node.removeAttribute(attr.name);
                    }
                }
            }
            
            // Create container element programmatically to avoid attribute escaping issues
            const container = document.createElement('div');
            container.className = 'qde-svg-container';
            container.contentEditable = 'false';
            container.setAttribute('data-qd-fence', '```');
            container.setAttribute('data-qd-lang', 'svg');
            container.setAttribute('data-qd-source', code);  // No escaping needed when using setAttribute!
            container.innerHTML = new XMLSerializer().serializeToString(svg);
            
            // Return the HTML string
            return container.outerHTML;
        } catch (err) {
            const errorContainer = document.createElement('pre');
            errorContainer.className = 'qde-error';
            errorContainer.contentEditable = 'false';
            errorContainer.setAttribute('data-qd-fence', '```');
            errorContainer.setAttribute('data-qd-lang', 'svg');
            errorContainer.textContent = `Invalid SVG: ${err.message}`;
            return errorContainer.outerHTML;
        }
    }
    
    /**
     * Render HTML content with DOMPurify if available
     */
    renderHTML(code) {
        const id = `html-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // If DOMPurify is loaded, use it
        if (window.DOMPurify) {
            const clean = DOMPurify.sanitize(code);
            
            // Create container programmatically
            const container = document.createElement('div');
            container.className = 'qde-html-container';
            container.contentEditable = 'false';
            container.setAttribute('data-qd-fence', '```');
            container.setAttribute('data-qd-lang', 'html');
            container.setAttribute('data-qd-source', code);
            container.innerHTML = clean;
            
            return container.outerHTML;
        }
        
        // Try to lazy load DOMPurify
        this.lazyLoadLibrary(
            'DOMPurify',
            () => window.DOMPurify,
            'https://unpkg.com/dompurify/dist/purify.min.js'
        ).then(loaded => {
            if (loaded) {
                const element = document.getElementById(id);
                if (element) {
                    const clean = DOMPurify.sanitize(code);
                    element.innerHTML = clean;
                    // Update attributes after loading
                    element.setAttribute('data-qd-source', code);
                    element.setAttribute('data-qd-fence', '```');
                    element.setAttribute('data-qd-lang', 'html');
                }
            }
        });
        
        // Return placeholder with bidirectional attributes - non-editable
        const placeholder = document.createElement('div');
        placeholder.id = id;
        placeholder.className = 'qde-html-container';
        placeholder.contentEditable = 'false';
        placeholder.setAttribute('data-qd-fence', '```');
        placeholder.setAttribute('data-qd-lang', 'html');
        placeholder.setAttribute('data-qd-source', code);
        const pre = document.createElement('pre');
        pre.textContent = code;
        placeholder.appendChild(pre);
        
        return placeholder.outerHTML;
    }
    
    /**
     * Render math with KaTeX if available
     */
    renderMath(code, lang) {
        const id = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // If KaTeX is loaded, use it
        if (window.katex) {
            try {
                const rendered = katex.renderToString(code, {
                    displayMode: true,
                    throwOnError: false
                });
                
                // Create container programmatically
                const container = document.createElement('div');
                container.className = 'qde-math-container';
                container.contentEditable = 'false';
                container.setAttribute('data-qd-fence', '```');
                container.setAttribute('data-qd-lang', lang);
                container.setAttribute('data-qd-source', code);
                container.innerHTML = rendered;
                
                return container.outerHTML;
            } catch (err) {
                const errorContainer = document.createElement('pre');
                errorContainer.className = 'qde-error';
                errorContainer.contentEditable = 'false';
                errorContainer.setAttribute('data-qd-fence', '```');
                errorContainer.setAttribute('data-qd-lang', lang);
                errorContainer.setAttribute('data-qd-source', code);
                errorContainer.textContent = `Math error: ${err.message}`;
                return errorContainer.outerHTML;
            }
        }
        
        // Try to lazy load KaTeX
        this.lazyLoadLibrary(
            'KaTeX',
            () => window.katex,
            'https://unpkg.com/katex/dist/katex.min.js',
            'https://unpkg.com/katex/dist/katex.min.css'
        ).then(loaded => {
            if (loaded) {
                const element = document.getElementById(id);
                if (element) {
                    try {
                        katex.render(code, element, {
                            displayMode: true,
                            throwOnError: false
                        });
                        // Update attributes after rendering
                        element.setAttribute('data-qd-source', code);
                        element.setAttribute('data-qd-fence', '```');
                        element.setAttribute('data-qd-lang', lang);
                    } catch (err) {
                        element.innerHTML = `<pre class="qde-error">Math error: ${this.escapeHtml(err.message)}</pre>`;
                    }
                }
            }
        });
        
        // Return placeholder with bidirectional attributes - non-editable
        const placeholder = document.createElement('div');
        placeholder.id = id;
        placeholder.className = 'qde-math-container';
        placeholder.contentEditable = 'false';
        placeholder.setAttribute('data-qd-fence', '```');
        placeholder.setAttribute('data-qd-lang', lang);
        placeholder.setAttribute('data-qd-source', code);
        const pre = document.createElement('pre');
        pre.textContent = code;
        placeholder.appendChild(pre);
        
        return placeholder.outerHTML;
    }
    
    /**
     * Render CSV/PSV/TSV as HTML table
     */
    renderTable(code, lang) {
        const escapedCode = this.escapeHtml(code);
        try {
            const delimiter = lang === 'csv' ? ',' : lang === 'psv' ? '|' : '\t';
            const lines = code.trim().split('\n');
            
            if (lines.length === 0) {
                return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}">${escapedCode}</pre>`;
            }
            
            // CSV tables CAN be editable - we'll convert HTML table back to CSV
            // Don't need data-qd-source since we convert the table structure back to CSV
            let html = `<table class="qde-data-table qde-csv-table" data-qd-fence="\`\`\`" data-qd-lang="${lang}">`;
            
            // Parse header
            const header = this.parseCSVLine(lines[0], delimiter);
            html += '<thead><tr>';
            header.forEach(cell => {
                html += `<th>${this.escapeHtml(cell.trim())}</th>`;
            });
            html += '</tr></thead>';
            
            // Parse body
            if (lines.length > 1) {
                html += '<tbody>';
                for (let i = 1; i < lines.length; i++) {
                    const row = this.parseCSVLine(lines[i], delimiter);
                    html += '<tr>';
                    row.forEach(cell => {
                        html += `<td>${this.escapeHtml(cell.trim())}</td>`;
                    });
                    html += '</tr>';
                }
                html += '</tbody>';
            }
            
            html += '</table>';
            return html;
        } catch (err) {
            return `<pre data-qd-fence="\`\`\`" data-qd-lang="${lang}" data-qd-source="${escapedCode}">${escapedCode}</pre>`;
        }
    }
    
    /**
     * Parse CSV line handling quoted values
     */
    parseCSVLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }
    
    /**
     * Render JSON with syntax highlighting
     */
    renderJSON(code, lang) {
        // If highlight.js is available, use it for all JSON
        if (window.hljs && hljs.getLanguage('json')) {
            try {
                // Try to format if valid JSON
                let toHighlight = code;
                try {
                    const data = JSON.parse(code);
                    toHighlight = JSON.stringify(data, null, 2);
                } catch (e) {
                    // Use original if not valid JSON
                }
                
                const highlighted = hljs.highlight(toHighlight, { language: 'json' }).value;
                return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}"><code class="hljs language-json">${highlighted}</code></pre>`;
            } catch (e) {
                // Fall through if highlighting fails
            }
        }
        
        // No highlighting available - return plain
        return `<pre class="qde-json" data-qd-fence="\`\`\`" data-qd-lang="${lang}">${this.escapeHtml(code)}</pre>`;
    }
    
    /**
     * Render Mermaid diagram
     */
    renderMermaid(code) {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element && window.mermaid) {
                mermaid.render(id + '-svg', code).then(result => {
                    element.innerHTML = result.svg;
                }).catch(err => {
                    element.innerHTML = `<pre>Error rendering diagram: ${err.message}</pre>`;
                });
            }
        }, 0);
        
        // Create container programmatically
        const container = document.createElement('div');
        container.id = id;
        container.className = 'mermaid';
        container.contentEditable = 'false';
        container.setAttribute('data-qd-source', code);
        container.setAttribute('data-qd-fence', '```');
        container.setAttribute('data-qd-lang', 'mermaid');
        container.textContent = 'Loading diagram...';
        
        return container.outerHTML;
    }
    
    /**
     * Escape HTML for attributes
     */
    escapeHtml(text) {
        return (text ?? "").replace(/[&"'<>]/g, m => 
            ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[m]));
    }
    
    /**
     * Make complex fence blocks non-editable
     */
    makeFencesNonEditable() {
        if (!this.previewPanel) return;
        
        // Only make specific complex fence types non-editable
        // SVG, HTML, Math, Mermaid already have contenteditable="false" set
        // Syntax-highlighted code also has it set
        
        // Don't make regular code blocks or tables non-editable
        // They can be edited and properly round-trip
    }
    
    /**
     * Load plugins dynamically
     */
    async loadPlugins() {
        const promises = [];
        
        // Load highlight.js (check if already loaded)
        if (this.options.plugins.highlightjs && !window.hljs) {
            promises.push(
                this.loadScript('https://unpkg.com/@highlightjs/cdn-assets/highlight.min.js'),
                this.loadCSS('https://unpkg.com/@highlightjs/cdn-assets/styles/github.min.css')
            );
        }
        
        // Load mermaid (check if already loaded)
        if (this.options.plugins.mermaid && !window.mermaid) {
            promises.push(
                this.loadScript('https://unpkg.com/mermaid/dist/mermaid.min.js').then(() => {
                    if (window.mermaid) {
                        mermaid.initialize({ startOnLoad: false });
                    }
                })
            );
        }
        
        await Promise.all(promises);
    }
    
    /**
     * Lazy load library if not already loaded
     */
    async lazyLoadLibrary(name, check, scriptUrl, cssUrl = null) {
        // Check if library is already loaded
        if (check()) {
            return true;
        }
        
        try {
            const promises = [];
            
            // Load script
            if (scriptUrl) {
                promises.push(this.loadScript(scriptUrl));
            }
            
            // Load CSS if provided
            if (cssUrl) {
                promises.push(this.loadCSS(cssUrl));
            }
            
            await Promise.all(promises);
            
            // Verify library loaded
            return check();
        } catch (err) {
            console.error(`Failed to load ${name}:`, err);
            return false;
        }
    }
    
    /**
     * Load external script
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load external CSS
     */
    loadCSS(href) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
            // Resolve anyway after timeout (CSS doesn't always fire onload)
            setTimeout(resolve, 1000);
        });
    }
    
    /**
     * Apply theme
     */
    applyTheme() {
        const theme = this.options.theme;
        
        if (theme === 'auto') {
            // Check system preference
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.container.classList.toggle('qde-dark', isDark);
            
            // Listen for changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.container.classList.toggle('qde-dark', e.matches);
            });
        } else {
            this.container.classList.toggle('qde-dark', theme === 'dark');
        }
    }
    
    /**
     * Set lazy linefeeds option
     * @param {boolean} enabled - Whether to enable lazy linefeeds
     */
    setLazyLinefeeds(enabled) {
        this.options.lazy_linefeeds = enabled;
        // Re-render if we have content
        if (this._markdown) {
            this.updateFromSource();
        }
    }
    
    /**
     * Get lazy linefeeds option
     * @returns {boolean}
     */
    getLazyLinefeeds() {
        return this.options.lazy_linefeeds;
    }
    
    /**
     * Set debounce delay for input updates
     * @param {number} delay - Delay in milliseconds (0 for instant)
     */
    setDebounceDelay(delay) {
        this.options.debounceDelay = Math.max(0, delay);
    }
    
    /**
     * Get current debounce delay
     * @returns {number} Delay in milliseconds
     */
    getDebounceDelay() {
        return this.options.debounceDelay;
    }
    
    /**
     * Set editor mode
     */
    setMode(mode) {
        if (!['source', 'preview', 'split'].includes(mode)) return;
        
        this.currentMode = mode;
        this.container.className = `qde-container qde-mode-${mode}`;
        
        // Update toolbar buttons
        if (this.toolbar) {
            this.toolbar.querySelectorAll('.qde-btn[data-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }
        
        // Apply theme class
        if (this.container.classList.contains('qde-dark')) {
            this.container.classList.add('qde-dark');
        }
        
        // Make fence blocks non-editable when showing preview
        if (mode !== 'source') {
            setTimeout(() => this.makeFencesNonEditable(), 0);
        }
        
        // Trigger mode change event
        if (this.options.onModeChange) {
            this.options.onModeChange(mode);
        }
    }
    
    /**
     * Handle toolbar actions
     */
    handleAction(action) {
        switch(action) {
            case 'copy-markdown':
                this.copy('markdown');
                break;
            case 'copy-html':
                this.copy('html');
                break;
            case 'remove-hr':
                this.removeHR();
                break;
        }
    }
    
    /**
     * Copy content to clipboard
     */
    async copy(type) {
        const content = type === 'markdown' ? this._markdown : this._html;
        
        try {
            await navigator.clipboard.writeText(content);
            
            // Visual feedback
            const btn = this.toolbar.querySelector(`[data-action="copy-${type}"]`);
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
    
    // Public API
    
    /**
     * Get current markdown
     */
    get markdown() {
        return this._markdown;
    }
    
    /**
     * Set markdown content
     */
    set markdown(value) {
        this.setMarkdown(value);
    }
    
    /**
     * Get current HTML
     */
    get html() {
        return this._html;
    }
    
    /**
     * Get current mode
     */
    get mode() {
        return this.currentMode;
    }
    
    /**
     * Set markdown content
     */
    async setMarkdown(markdown) {
        // Wait for initialization if needed
        if (this.initPromise) {
            await this.initPromise;
        }
        
        this._markdown = markdown;
        if (this.sourceTextarea) {
            this.sourceTextarea.value = markdown;
        }
        this.updateFromMarkdown(markdown);
    }
    
    /**
     * Get markdown content
     */
    getMarkdown() {
        return this._markdown;
    }
    
    /**
     * Get HTML content
     */
    getHTML() {
        return this._html;
    }
    
    /**
     * Remove all horizontal rules (---) from markdown
     */
    async removeHR() {
        // Remove standalone HR lines (3 or more dashes/underscores/asterisks)
        // Matches: ---, ___, ***, ----, etc. with optional spaces
        const cleaned = this._markdown
            .split('\n')
            .filter(line => {
                // Keep lines that aren't just HR patterns
                const trimmed = line.trim();
                // Match HR patterns: 3+ of -, _, or * with optional spaces between
                return !(/^[-_*](\s*[-_*]){2,}\s*$/.test(trimmed));
            })
            .join('\n');
        
        // Update the markdown
        await this.setMarkdown(cleaned);
        
        // Visual feedback if toolbar button exists
        const btn = this.toolbar?.querySelector('[data-action="remove-hr"]');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Removed!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        }
    }
    
    /**
     * Destroy the editor
     */
    destroy() {
        // Clear timers
        clearTimeout(this.updateTimer);
        
        // Clear container
        this.container.innerHTML = '';
        this.container.classList.remove('qde-container', 'qde-dark');
        
        // Remove injected styles (only if no other editors exist)
        const otherEditors = document.querySelectorAll('.qde-container');
        if (otherEditors.length === 0) {
            const style = document.getElementById('qde-styles');
            if (style) style.remove();
        }
    }
}

// Export for CommonJS (needed for bundled ESM to work with Jest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuikdownEditor;
}

// Also export for UMD builds
if (typeof window !== 'undefined') {
    window.QuikdownEditor = QuikdownEditor;
}

export { QuikdownEditor as default };
