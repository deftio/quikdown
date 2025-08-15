/**
 * QuikDown - Lightweight Markdown Parser
 * @version 2.0
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.quikdown = factory());
})(this, (function () { 'use strict';

    // Auto-generated version file - DO NOT EDIT MANUALLY
    // This file is automatically updated by tools/updateVersion.js

    const quikdownVersion = "2.0";

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


    function quikdown(markdown, options = {}) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }
        
        const { fence_plugin, inline_styles = false } = options;

        // Style definitions for elements
        const styles = {
            h1: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h2: 'margin-top: 0.5em; margin-bottom: 0.3em', 
            h3: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h4: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h5: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h6: 'margin-top: 0.5em; margin-bottom: 0.3em',
            pre: 'background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto',
            code: 'background: #f0f0f0; padding: 2px 4px; border-radius: 3px',
            blockquote: 'border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666',
            table: 'border-collapse: collapse; width: 100%; margin: 1em 0',
            thead: '',
            tbody: '',
            tr: '',
            th: 'border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; font-weight: bold',
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
            br: ''
        };

        // Helper to get class or style attribute
        function getAttr(tag, additionalStyle = '') {
            if (inline_styles) {
                const style = styles[tag] || '';
                const fullStyle = additionalStyle ? `${style}; ${additionalStyle}` : style;
                return fullStyle ? ` style="${fullStyle}"` : '';
            } else {
                return ` class="quikdown-${tag}"`;
            }
        }

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

        // Process the markdown in phases
        let html = markdown;
        
        // Phase 1: Extract and protect code blocks and inline code
        const codeBlocks = [];
        const inlineCodes = [];
        
        // Extract fenced code blocks first
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `%%%CODEBLOCK${codeBlocks.length}%%%`;
            
            // If custom fence plugin is provided, use it
            if (fence_plugin && typeof fence_plugin === 'function') {
                codeBlocks.push({
                    lang: lang || '',
                    code: code.trimEnd(),
                    custom: true
                });
            } else {
                codeBlocks.push({
                    lang: lang || '',
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
        
        // Process headings
        html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
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
        
        // Images (must come before links)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            return `<img${getAttr('img')} src="${src}" alt="${alt}">`;
        });
        
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
            return `<a${getAttr('a')} href="${href}">${text}</a>`;
        });
        
        // Bold (must use non-greedy matching)
        html = html.replace(/\*\*(.+?)\*\*/g, `<strong${getAttr('strong')}>$1</strong>`);
        html = html.replace(/__(.+?)__/g, `<strong${getAttr('strong')}>$1</strong>`);
        
        // Italic (must not match bold markers)
        html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, `<em${getAttr('em')}>$1</em>`);
        html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, `<em${getAttr('em')}>$1</em>`);
        
        // Strikethrough
        html = html.replace(/~~(.+?)~~/g, `<del${getAttr('del')}>$1</del>`);
        
        // Line breaks (two spaces at end of line)
        html = html.replace(/  $/gm, `<br${getAttr('br')}>`);
        
        // Paragraphs (double newlines)
        html = html.replace(/\n\n+/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        // Clean up empty paragraphs and unwrap block elements (account for attributes)
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
        html = html.replace(/<p>(<pre[^>]*>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        // Also unwrap code block placeholders
        html = html.replace(/<p>(%%%CODEBLOCK\d+%%%)<\/p>/g, '$1');
        
        // Phase 4: Restore code blocks and inline code
        
        // Restore code blocks
        codeBlocks.forEach((block, i) => {
            let replacement;
            
            if (block.custom && fence_plugin) {
                // Use custom fence plugin
                replacement = fence_plugin(block.code, block.lang);
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
        // Helper to get attributes
        function getAttr(tag, additionalStyle = '') {
            if (inline_styles) {
                const style = styles[tag] || '';
                const fullStyle = additionalStyle ? `${style}; ${additionalStyle}` : style;
                return fullStyle ? ` style="${fullStyle}"` : '';
            } else {
                return ` class="quikdown-${tag}"`;
            }
        }
        
        // Process bold
        text = text.replace(/\*\*(.+?)\*\*/g, `<strong${getAttr('strong')}>$1</strong>`);
        text = text.replace(/__(.+?)__/g, `<strong${getAttr('strong')}>$1</strong>`);
        
        // Process italic (must not match bold markers)
        text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, `<em${getAttr('em')}>$1</em>`);
        text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, `<em${getAttr('em')}>$1</em>`);
        
        // Process strikethrough
        text = text.replace(/~~(.+?)~~/g, `<del${getAttr('del')}>$1</del>`);
        
        // Process inline code
        text = text.replace(/`([^`]+)`/g, `<code${getAttr('code')}>$1</code>`);
        
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
            
            // Check if this line looks like a table row
            if (line.startsWith('|') && line.endsWith('|')) {
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
        // Helper to get attributes
        function getAttr(tag, additionalStyle = '') {
            if (inline_styles) {
                const style = styles[tag] || '';
                const fullStyle = additionalStyle ? `${style}; ${additionalStyle}` : style;
                return fullStyle ? ` style="${fullStyle}"` : '';
            } else {
                return ` class="quikdown-${tag}"`;
            }
        }
        
        if (lines.length < 2) return null;
        
        // Check for separator line (second line should be the separator)
        let separatorIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (/^\|[\s\-:|]+\|$/.test(lines[i])) {
                separatorIndex = i;
                break;
            }
        }
        
        if (separatorIndex === -1) return null;
        
        const headerLines = lines.slice(0, separatorIndex);
        const bodyLines = lines.slice(separatorIndex + 1);
        
        // Parse alignment from separator
        const separator = lines[separatorIndex];
        const alignments = separator
            .split('|')
            .slice(1, -1)
            .map(cell => {
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
                const cells = line.split('|').slice(1, -1);
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
                const cells = line.split('|').slice(1, -1);
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
        // Helper to get attributes
        function getAttr(tag, additionalStyle = '') {
            if (inline_styles) {
                const style = styles[tag] || '';
                const fullStyle = additionalStyle ? `${style}; ${additionalStyle}` : style;
                return fullStyle ? ` style="${fullStyle}"` : '';
            } else {
                return ` class="quikdown-${tag}"`;
            }
        }
        
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
                
                result.push(`<li${getAttr('li')}>${content}</li>`);
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
        const styles = {
            h1: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h2: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h3: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h4: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h5: 'margin-top: 0.5em; margin-bottom: 0.3em',
            h6: 'margin-top: 0.5em; margin-bottom: 0.3em',
            pre: 'background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto',
            code: 'background: #f0f0f0; padding: 2px 4px; border-radius: 3px',
            blockquote: 'border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666',
            table: 'border-collapse: collapse; width: 100%; margin: 1em 0',
            th: 'border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; font-weight: bold',
            td: 'border: 1px solid #ddd; padding: 8px; text-align: left',
            hr: 'border: none; border-top: 1px solid #ddd; margin: 1em 0',
            img: 'max-width: 100%; height: auto',
            a: 'color: #0066cc; text-decoration: underline',
            strong: 'font-weight: bold',
            em: 'font-style: italic',
            del: 'text-decoration: line-through',
            ul: 'margin: 0.5em 0; padding-left: 2em',
            ol: 'margin: 0.5em 0; padding-left: 2em',
            li: 'margin: 0.25em 0'
        };
        
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

    return quikdown;

}));
