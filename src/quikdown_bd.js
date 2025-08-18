/**
 * quikdown_bd - Bidirectional markdown/HTML converter
 * Extends core quikdown with HTML→Markdown conversion
 * 
 * Uses data-qd attributes to preserve original markdown syntax
 * Enables HTML→Markdown conversion for quikdown-generated HTML
 */

import quikdown from './quikdown.js';

// Version - uses same version as core quikdown
const VERSION = '__QUIKDOWN_VERSION__';

/**
 * Create bidirectional version by extending quikdown
 * This wraps quikdown and adds the toMarkdown method
 */
function quikdown_bd(markdown, options = {}) {
    // Use core quikdown with bidirectional flag to add data-qd attributes
    return quikdown(markdown, { ...options, bidirectional: true });
}

// Copy all properties and methods from quikdown
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
                    if (!childContent) return ''; // Don't add markers for empty content
                    const boldMarker = dataQd || '**';
                    return `${boldMarker}${childContent}${boldMarker}`;
                }
                return childContent;
                
            case 'em':
            case 'i':
                // Check for italic through style
                if (styles.fontStyle === 'italic' || tag === 'em' || tag === 'i') {
                    if (!childContent) return ''; // Don't add markers for empty content
                    const emMarker = dataQd || '*';
                    return `${emMarker}${childContent}${emMarker}`;
                }
                return childContent;
                
            case 'del':
            case 's':
            case 'strike':
                if (!childContent) return ''; // Don't add markers for empty content
                const delMarker = dataQd || '~~';
                return `${delMarker}${childContent}${delMarker}`;
                
            case 'code':
                // Skip if inside pre (handled by pre)
                if (parentContext.parentTag === 'pre') {
                    return childContent;
                }
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
                    return childContent.trim() + '\n\n';
                }
                return '';
                
            case 'div':
                // Check if it's a mermaid container
                if (node.classList && node.classList.contains('mermaid-container')) {
                    const fence = node.getAttribute('data-qd-fence') || '```';
                    const lang = node.getAttribute('data-qd-lang') || 'mermaid';
                    
                    // First check for data-qd-source attribute
                    const source = node.getAttribute('data-qd-source');
                    if (source) {
                        // Decode HTML entities from the attribute (mainly &quot;)
                        const temp = document.createElement('textarea');
                        temp.innerHTML = source;
                        const code = temp.value;
                        return `${fence}${lang}\n${code}\n${fence}\n\n`;
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
quikdown_bd.version = VERSION;

// Export for both module and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = quikdown_bd;
}

if (typeof window !== 'undefined') {
    window.quikdown_bd = quikdown_bd;
}

export default quikdown_bd;