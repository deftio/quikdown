/**
 * quikdown-lex - Lightweight Markdown Parser (Lexer Implementation)
 * @version 1.0.3dev4
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
'use strict';

/**
 * quikdown-lex - Hand-coded lexer/parser implementation
 * 
 * This is a state-machine based markdown parser that processes input
 * line-by-line with explicit state tracking. The approach trades regex
 * complexity for hand-coded state transitions, resulting in smaller
 * minified size and more predictable performance.
 * 
 * Architecture:
 * 1. Line-by-line processing with lookahead
 * 2. Explicit state tracking (NORMAL, FENCE, TABLE, LIST, BLOCKQUOTE)
 * 3. Single-pass inline processing
 * 4. Direct HTML generation (no intermediate AST)
 * 
 * @version __QUIKDOWN_VERSION__
 */

// ===========================================================================
// CONSTANTS & CONFIGURATION
// ===========================================================================

// Compact style map - keys match HTML tags, values are CSS strings
// Optimized: no spaces after colons, decimal values shortened
const STYLES = {
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

// HTML escape map for XSS prevention
const ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

// Line type constants for state machine
const LINE_BLANK = 0;
const LINE_HEADING = 1;
const LINE_HR = 2;
const LINE_FENCE = 3;
const LINE_BLOCKQUOTE = 4;
const LINE_LIST_UNORDERED = 5;
const LINE_LIST_ORDERED = 6;
const LINE_TABLE = 7;
const LINE_TABLE_SEP = 8;
const LINE_TEXT = 9;

// Parser states
const STATE_NORMAL = 0;
const STATE_FENCE = 1;
const STATE_BLOCKQUOTE = 4;
const STATE_PARAGRAPH = 5;

// ===========================================================================
// MAIN PARSER FUNCTION
// ===========================================================================

function quikdown(markdown, options = {}) {
  // Early return for invalid input
  if (!markdown || typeof markdown !== 'string') return '';
  
  // Parse options with defaults
  const opts = {
    inline_styles: options.inline_styles || false,
    class_prefix: options.class_prefix || 'quikdown-',
    allow_unsafe_urls: options.allow_unsafe_urls || false,
    fence_plugin: options.fence_plugin || null
  };
  
  // Split into lines for processing
  const lines = markdown.split('\n');
  const output = [];
  
  // Parser state
  let state = STATE_NORMAL;
  let stateData = null; // Holds state-specific data
  
  // Buffers for accumulating content
  let paragraphBuffer = [];
  let blockquoteBuffer = [];
  
  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================
  
  /**
   * Generate HTML attribute (class or inline style)
   * @param {string} tag - HTML tag name
   * @param {string} extraStyle - Additional inline styles
   * @returns {string} HTML attribute string
   */
  const getAttr = (tag, extraStyle = '') => {
    if (opts.inline_styles) {
      const baseStyle = STYLES[tag] || '';
      const combined = extraStyle 
        ? (baseStyle ? `${baseStyle};${extraStyle}` : extraStyle)
        : baseStyle;
      return combined ? ` style="${combined}"` : '';
    }
    return ` class="${opts.class_prefix}${tag}"`;
  };
  
  /**
   * Escape HTML entities to prevent XSS
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  const escapeHtml = (str) => {
    return str.replace(/[&<>"']/g, m => ESC_MAP[m]);
  };
  
  /**
   * Sanitize URLs to prevent XSS attacks
   * @param {string} url - Input URL
   * @returns {string} Sanitized URL or '#' if dangerous
   */
  const sanitizeUrl = (url) => {
    if (!url) return '';
    if (opts.allow_unsafe_urls) return url;
    
    const trimmed = url.trim();
    const lower = trimmed.toLowerCase();
    
    // Block dangerous protocols except data:image
    if (/^(javascript|vbscript|data):/i.test(lower)) {
      if (/^data:image\//i.test(lower)) return trimmed;
      return '#';
    }
    
    return trimmed;
  };
  
  /**
   * Process inline markdown elements (bold, italic, links, etc.)
   * Single-pass processing with minimal allocations
   * @param {string} text - Input text
   * @returns {string} HTML with inline formatting
   */
  const processInline = (text) => {
    if (!text) return '';
    
    // Step 1: Protect inline code by extracting it
    const codes = [];
    text = text.replace(/`([^`]+)`/g, (_, code) => {
      codes.push(escapeHtml(code));
      return `\x01${codes.length - 1}\x02`; // Use control chars as markers
    });
    
    // Step 2: Escape HTML entities
    text = escapeHtml(text);
    
    // Step 3: Process images (must come before links)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return `<img${getAttr('img')} src="${sanitizeUrl(src)}" alt="${alt}">`;
    });
    
    // Step 4: Process links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const url = sanitizeUrl(href);
      const isExternal = /^https?:\/\//i.test(url);
      const rel = isExternal ? ' rel="noopener noreferrer"' : '';
      return `<a${getAttr('a')} href="${url}"${rel}>${label}</a>`;
    });
    
    // Step 5: Process autolinks
    text = text.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, prefix, url) => {
      return `${prefix}<a${getAttr('a')} href="${sanitizeUrl(url)}" rel="noopener noreferrer">${url}</a>`;
    });
    
    // Step 6: Process bold (** and __)
    text = text.replace(/\*\*(.+?)\*\*/g, `<strong${getAttr('strong')}>$1</strong>`);
    text = text.replace(/__(.+?)__/g, `<strong${getAttr('strong')}>$1</strong>`);
    
    // Step 7: Process italic (* and _) - using lookahead/behind
    text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, `<em${getAttr('em')}>$1</em>`);
    text = text.replace(/(?<!_)_(?!_)([^_]+)_(?!_)/g, `<em${getAttr('em')}>$1</em>`);
    
    // Step 8: Process strikethrough
    text = text.replace(/~~(.+?)~~/g, `<del${getAttr('del')}>$1</del>`);
    
    // Step 9: Process line breaks (two spaces at end of line)
    text = text.replace(/  $/gm, `<br${getAttr('br')}>`);
    
    // Step 10: Restore inline code
    text = text.replace(/\x01(\d+)\x02/g, (_, idx) => {
      return `<code${getAttr('code')}>${codes[idx]}</code>`;
    });
    
    return text;
  };
  
  /**
   * Identify line type using optimized checks
   * @param {string} line - Input line
   * @returns {number} Line type constant
   */
  const getLineType = (line) => {
    const trimmed = line.trim();
    
    // Empty line
    if (!trimmed) return LINE_BLANK;
    
    // Use first character for quick discrimination
    const firstChar = trimmed[0];
    
    switch (firstChar) {
      case '#':
        // Heading: # through ######
        if (/^#{1,6}\s+/.test(trimmed)) return LINE_HEADING;
        break;
        
      case '-':
      case '*':
      case '_':
        // Could be HR or list
        if (/^[-*_](\s*[-*_]){2,}$/.test(trimmed)) return LINE_HR;
        if (/^[*+-]\s+/.test(trimmed)) return LINE_LIST_UNORDERED;
        break;
        
      case '+':
        // Unordered list with +
        if (/^\+\s+/.test(trimmed)) return LINE_LIST_UNORDERED;
        break;
        
      case '`':
      case '~':
        // Fence marker (3+ backticks or tildes)
        if (/^[`~]{3,}/.test(trimmed)) return LINE_FENCE;
        break;
        
      case '>':
        // Blockquote
        return LINE_BLOCKQUOTE;
        
      case '|':
        // Table (starts with pipe)
        if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed)) {
          return LINE_TABLE_SEP;
        }
        return LINE_TABLE;
        
      default:
        // Check for ordered list (digit)
        if (/^\d+\.\s+/.test(trimmed)) return LINE_LIST_ORDERED;
        
        // Check for table without leading pipe
        if (trimmed.includes('|')) {
          if (/^\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\s*$/.test(trimmed)) {
            return LINE_TABLE_SEP;
          }
          return LINE_TABLE;
        }
    }
    
    // Check indented list items
    if (/^\s+[*+-]\s+/.test(line)) return LINE_LIST_UNORDERED;
    if (/^\s+\d+\.\s+/.test(line)) return LINE_LIST_ORDERED;
    
    return LINE_TEXT;
  };
  
  /**
   * Flush accumulated paragraph buffer to output
   */
  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const content = paragraphBuffer.join('\n');
      output.push(`<p>${processInline(content)}</p>`);
      paragraphBuffer = [];
    }
  };
  
  /**
   * Flush accumulated blockquote buffer to output
   */
  const flushBlockquote = () => {
    if (blockquoteBuffer.length > 0) {
      const innerContent = blockquoteBuffer.join('\n').trim();
      
      // Check if it's a simple single-line blockquote without block elements
      if (blockquoteBuffer.length === 1 && !innerContent.includes('\n')) {
        // Simple blockquote - just process inline
        output.push(`<blockquote${getAttr('blockquote')}>${processInline(innerContent)}</blockquote>`);
      } else if (blockquoteBuffer.length === 2 && blockquoteBuffer[1] === '' && !blockquoteBuffer[0].includes('\n')) {
        // Two lines but second is empty - treat as single line
        output.push(`<blockquote${getAttr('blockquote')}>${processInline(blockquoteBuffer[0])}</blockquote>`);
      } else {
        // Multi-line blockquote - treat all lines as single block
        const lines = blockquoteBuffer.filter(line => line !== '');
        if (lines.length === 0) ; else if (lines.length === 2 && lines.every(line => !line.includes('\n') && line.trim().length > 0)) {
          // Two consecutive lines - keep them separate as two blockquotes
          output.push(`<blockquote${getAttr('blockquote')}>${processInline(lines[0])}</blockquote>`);
          output.push(`<blockquote${getAttr('blockquote')}>${processInline(lines[1])}</blockquote>`);
        } else {
          // Complex content - recursively parse
          const innerHtml = quikdown(innerContent, opts);
          output.push(`<blockquote${getAttr('blockquote')}>${innerHtml}</blockquote>`);
        }
      }
      blockquoteBuffer = [];
    }
  };
  
  /**
   * Process a list starting at current position
   * @param {number} startIdx - Starting line index
   * @returns {number} Next line index to process
   */
  const processList = (startIdx) => {
    const listStack = []; // Stack of { type, indent, items }
    let i = startIdx;
    
    while (i < lines.length) {
      const line = lines[i];
      const match = line.match(/^(\s*)([*+-]|\d+\.)\s+(.+)$/);
      
      if (!match) {
        // Not a list item, end list processing
        break;
      }
      
      const [, spaces, marker, content] = match;
      const indent = Math.floor(spaces.length / 2);
      const isOrdered = /^\d+\./.test(marker);
      const listType = isOrdered ? 'ol' : 'ul';
      
      // Process task list syntax
      let itemContent = content;
      let itemAttr = getAttr('li');
      
      if (!isOrdered) {
        const taskMatch = content.match(/^\[([x ])\]\s+(.*)$/i);
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === 'x';
          const checkboxAttr = opts.inline_styles 
            ? ' style="margin-right:.5em"' 
            : ` class="${opts.class_prefix}task-checkbox"`;
          itemAttr = opts.inline_styles 
            ? ' style="list-style:none"' 
            : ` class="${opts.class_prefix}task-item"`;
          itemContent = `<input type="checkbox"${checkboxAttr}${checked ? ' checked' : ''} disabled> ${taskMatch[2]}`;
        }
      }
      
      // Manage list stack based on indentation
      while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
        // Close deeper lists
        const closed = listStack.pop();
        closed.items.push(`\n</${closed.type}>`);
      }
      
      if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
        // Start new list level
        const newList = {
          type: listType,
          indent: indent,
          items: indent > 0 ? [`\n<${listType}${getAttr(listType)}>`] : [`<${listType}${getAttr(listType)}>`]
        };
        if (indent > 0 && listStack.length > 0) {
          // Nested list - add to parent's items
          listStack[listStack.length - 1].items.push(newList.items[0]);
          newList.items = [];
        }
        listStack.push(newList);
      } else if (listStack[listStack.length - 1].type !== listType) {
        // Different list type at same level - close and open new
        const closed = listStack.pop();
        closed.items.push(`\n</${closed.type}>`);
        if (listStack.length > 0) {
          listStack[listStack.length - 1].items.push(closed.items.join(''));
        } else {
          output.push(closed.items.join(''));
        }
        const newList = {
          type: listType,
          indent: indent,
          items: [`<${listType}${getAttr(listType)}>`]
        };
        listStack.push(newList);
      }
      
      // Add list item to current list
      listStack[listStack.length - 1].items.push(
        `\n<li${itemAttr}>${processInline(itemContent)}</li>`
      );
      
      i++;
    }
    
    // Close all open lists
    while (listStack.length > 1) {
      const closed = listStack.pop();
      closed.items.push(`\n</${closed.type}>`);
      listStack[listStack.length - 1].items.push(closed.items.join(''));
    }
    
    if (listStack.length > 0) {
      const finalList = listStack[0];
      finalList.items.push(`\n</${finalList.type}>`);
      output.push(finalList.items.join(''));
    }
    
    return i;
  };
  
  /**
   * Process a table starting at current position
   * @param {number} startIdx - Starting line index
   * @returns {number} Next line index to process
   */
  const processTable = (startIdx) => {
    let i = startIdx;
    const headerCells = [];
    let alignments = null;
    const bodyRows = [];
    
    // Parse first row as potential header
    const firstLine = lines[i].trim();
    const firstCells = firstLine.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    headerCells.push(...firstCells);
    i++;
    
    // Check for separator line - REQUIRED for valid table
    if (i < lines.length) {
      const lineType = getLineType(lines[i]);
      if (lineType === LINE_TABLE_SEP) {
        // Parse alignments from separator
        const sepLine = lines[i].trim();
        const sepCells = sepLine.replace(/^\|/, '').replace(/\|$/, '').split('|');
        alignments = sepCells.map(cell => {
          const trimmed = cell.trim();
          if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
          if (trimmed.endsWith(':')) return 'right';
          return 'left';
        });
        i++;
      } else {
        // No separator, not a valid table - return without processing
        return startIdx;
      }
    } else {
      // End of input without separator - not a valid table
      return startIdx;
    }
    
    // Parse body rows
    while (i < lines.length) {
      const lineType = getLineType(lines[i]);
      if (lineType !== LINE_TABLE && lineType !== LINE_TABLE_SEP) break;
      
      const line = lines[i].trim();
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      bodyRows.push(cells);
      i++;
    }
    
    // Generate table HTML
    let html = `<table${getAttr('table')}>`;
    
    // Add header if present
    if (headerCells.length > 0) {
      html += `\n<thead${getAttr('thead')}>\n<tr${getAttr('tr')}>\n`;
      headerCells.forEach((cell, idx) => {
        const align = alignments && alignments[idx] !== 'left' 
          ? `text-align:${alignments[idx]}` 
          : '';
        html += `<th${getAttr('th', align)}>${processInline(cell)}</th>\n`;
      });
      html += `</tr>\n</thead>`;
    }
    
    // Add body rows
    if (bodyRows.length > 0) {
      html += `\n<tbody${getAttr('tbody')}>\n`;
      bodyRows.forEach(row => {
        html += `<tr${getAttr('tr')}>\n`;
        row.forEach((cell, idx) => {
          const align = alignments && alignments[idx] !== 'left' 
            ? `text-align:${alignments[idx]}` 
            : '';
          html += `<td${getAttr('td', align)}>${processInline(cell)}</td>\n`;
        });
        html += `</tr>\n`;
      });
      html += `</tbody>`;
    }
    
    html += `\n</table>`;
    output.push(html);
    
    return i;
  };
  
  // ===========================================================================
  // MAIN PARSING LOOP - STATE MACHINE
  // ===========================================================================
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineType = getLineType(line);
    
    // STATE MACHINE - Handle current state and line type
    switch (state) {
      
      // -----------------------------------------------------------------------
      // NORMAL STATE - Can transition to any other state
      // -----------------------------------------------------------------------
      case STATE_NORMAL:
        switch (lineType) {
          case LINE_BLANK:
            // Blank line - just skip
            i++;
            break;
            
          case LINE_HEADING:
            // Parse heading
            const headingMatch = line.trim().match(/^(#{1,6})\s+(.+?)(?:\s*#*)?$/);
            if (headingMatch) {
              const level = headingMatch[1].length;
              const text = headingMatch[2];
              output.push(`<h${level}${getAttr('h' + level)}>${processInline(text)}</h${level}>`);
            }
            i++;
            break;
            
          case LINE_HR:
            // Horizontal rule
            output.push(`<hr${getAttr('hr')}>`);
            i++;
            break;
            
          case LINE_FENCE:
            // Start fence block
            const fenceMatch = line.trim().match(/^([`~]{3,})(.*)$/);
            if (fenceMatch) {
              state = STATE_FENCE;
              stateData = {
                marker: fenceMatch[1][0],
                count: fenceMatch[1].length,
                lang: (fenceMatch[2] || '').trim(),
                lines: []
              };
            }
            i++;
            break;
            
          case LINE_BLOCKQUOTE:
            // Start blockquote
            state = STATE_BLOCKQUOTE;
            blockquoteBuffer = [line.replace(/^\s*>\s?/, '')];
            i++;
            break;
            
          case LINE_LIST_UNORDERED:
          case LINE_LIST_ORDERED:
            // Process entire list
            i = processList(i);
            break;
            
          case LINE_TABLE:
          case LINE_TABLE_SEP:
            // Process entire table
            const newIdx = processTable(i);
            if (newIdx === i) {
              // Not a valid table, treat as text
              state = STATE_PARAGRAPH;
              paragraphBuffer = [line];
              i++;
            } else {
              i = newIdx;
            }
            break;
            
          case LINE_TEXT:
          default:
            // Start paragraph
            state = STATE_PARAGRAPH;
            paragraphBuffer = [line];
            i++;
            break;
        }
        break;
      
      // -----------------------------------------------------------------------
      // FENCE STATE - Inside a code fence
      // -----------------------------------------------------------------------
      case STATE_FENCE:
        // Check for closing fence
        const trimmed = line.trim();
        const closePattern = new RegExp(`^${stateData.marker}{${stateData.count},}\\s*$`);
        
        if (closePattern.test(trimmed)) {
          // End fence - output code block
          const code = stateData.lines.join('\n');
          let output_html = '';
          
          // Try fence plugin first
          if (opts.fence_plugin) {
            output_html = opts.fence_plugin(code, stateData.lang);
          }
          
          // Fall back to default rendering
          if (!output_html || output_html === undefined) {
            const langAttr = !opts.inline_styles && stateData.lang 
              ? ` class="language-${stateData.lang}"` 
              : '';
            const codeAttr = opts.inline_styles ? getAttr('code') : langAttr;
            output_html = `<pre${getAttr('pre')}><code${codeAttr}>${escapeHtml(code)}</code></pre>`;
          }
          
          output.push(output_html);
          state = STATE_NORMAL;
          stateData = null;
        } else {
          // Continue accumulating fence content
          stateData.lines.push(line);
        }
        i++;
        break;
      
      // -----------------------------------------------------------------------
      // PARAGRAPH STATE - Accumulating paragraph lines
      // -----------------------------------------------------------------------
      case STATE_PARAGRAPH:
        switch (lineType) {
          case LINE_BLANK:
            // End paragraph
            flushParagraph();
            state = STATE_NORMAL;
            i++;
            break;
            
          case LINE_HEADING:
          case LINE_HR:
          case LINE_FENCE:
          case LINE_BLOCKQUOTE:
          case LINE_LIST_UNORDERED:
          case LINE_LIST_ORDERED:
          case LINE_TABLE:
          case LINE_TABLE_SEP:
            // End paragraph and process new block
            flushParagraph();
            state = STATE_NORMAL;
            // Don't increment i - reprocess this line in NORMAL state
            break;
            
          case LINE_TEXT:
          default:
            // Continue paragraph
            paragraphBuffer.push(line);
            i++;
            break;
        }
        break;
      
      // -----------------------------------------------------------------------
      // BLOCKQUOTE STATE - Accumulating blockquote lines
      // -----------------------------------------------------------------------
      case STATE_BLOCKQUOTE:
        if (lineType === LINE_BLOCKQUOTE) {
          // Continue blockquote
          blockquoteBuffer.push(line.replace(/^\s*>\s?/, ''));
          i++;
        } else if (lineType === LINE_BLANK && i + 1 < lines.length && 
                   getLineType(lines[i + 1]) === LINE_BLOCKQUOTE) {
          // Blank line within blockquote
          blockquoteBuffer.push('');
          i++;
        } else {
          // End blockquote
          flushBlockquote();
          state = STATE_NORMAL;
          // Don't increment i - reprocess this line
        }
        break;
    }
  }
  
  // Flush any remaining content
  flushParagraph();
  flushBlockquote();
  
  return output.join('').trim();
}

// ===========================================================================
// STATIC METHODS
// ===========================================================================

/**
 * Emit CSS styles for all quikdown elements
 * @param {string} prefix - Class prefix (default: 'quikdown-')
 * @returns {string} CSS stylesheet
 */
quikdown.emitStyles = function(prefix = 'quikdown-') {
  let css = '';
  for (const [tag, style] of Object.entries(STYLES)) {
    if (style) {
      css += `.${prefix}${tag} { ${style} }\n`;
    }
  }
  return css;
};

/**
 * Create a configured parser function
 * @param {Object} options - Parser options
 * @returns {Function} Configured parser
 */
quikdown.configure = function(options) {
  return function(markdown) {
    return quikdown(markdown, options);
  };
};

/**
 * Version string
 */
quikdown.version = '1.0.3dev4';

// ===========================================================================
// EXPORTS
// ===========================================================================

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown;
}

// Browser global
if (typeof window !== 'undefined') {
  window.quikdown = quikdown;
}

module.exports = quikdown;
