/**
 * quikdown_lex v2 - Grammar-driven markdown parser
 * @version __QUIKDOWN_VERSION__
 */

// Compiled grammar will be inlined here during build
// For now, we'll include a minimal working version

const STYLES = {
  h1: 'font-size:2em;font-weight:600;margin:.67em 0',
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
  br: '',
  p: 'margin:1em 0'
};

// Escape HTML helper
const escapeHtml = (text) => {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += map[text[i]] || text[i];
  }
  return result;
};

// Simplified scanner that works character by character
class Scanner {
  constructor(input) {
    this.input = input;
    this.pos = 0;
  }

  peek() {
    return this.input.slice(this.pos);
  }

  advance(n = 1) {
    const result = this.input.slice(this.pos, this.pos + n);
    this.pos += n;
    return result;
  }

  match(pattern) {
    const m = typeof pattern === 'string' 
      ? (this.input.startsWith(pattern, this.pos) && pattern)
      : this.input.slice(this.pos).match(pattern)?.[0];
    return m ? this.advance(m.length) : null;
  }

  scanUntil(pattern) {
    const start = this.pos;
    const idx = typeof pattern === 'string'
      ? this.input.indexOf(pattern, this.pos)
      : (this.input.slice(this.pos).match(pattern)?.index ?? -1) + this.pos;
    this.pos = idx >= this.pos ? idx : this.input.length;
    return this.input.slice(start, this.pos);
  }

  atEnd() {
    return this.pos >= this.input.length;
  }

  rest() {
    return this.input.slice(this.pos);
  }
}

// Main parser using grammar-driven approach
class GrammarParser {
  constructor(options = {}) {
    this.opts = {
      inline_styles: options.inline_styles || false,
      class_prefix: options.class_prefix || 'quikdown-',
      fence_plugin: options.fence_plugin || null,
      bidirectional: options.bidirectional || false,
      lazy_linefeeds: options.lazy_linefeeds || false,
      allow_unsafe_urls: options.allow_unsafe_urls || false
    };
  }

  // Helper methods for common patterns
  
  // Scan until newline/end and consume the newline
  scanLine(scanner) {
    const line = scanner.scanUntil(/\n|$/);
    scanner.match(/\n/);
    return line;
  }
  
  // Collect lines while a condition is met
  collectLines(scanner, condition) {
    const lines = [];
    while (!scanner.atEnd() && condition(scanner)) {
      lines.push(this.scanLine(scanner));
    }
    return lines;
  }
  
  // Parse inline content with symmetric delimiters (**, *, `, etc)
  parseDelimited(scanner, marker, tag) {
    const content = scanner.scanUntil(marker);
    if (scanner.match(marker)) {
      return `<${tag}${this.getAttr(tag)}>${this.parseInline(content)}</${tag}>`;
    }
    // Rollback - marker wasn't closed
    return escapeHtml(marker) + (content ? this.parseInline(content) : '');
  }
  
  // Parse bracketed content like [text](url) or ![alt](src)
  parseBracketed(scanner, prefix, handler) {
    // Handle nested brackets by counting depth
    let depth = 1;
    let text = '';
    while (!scanner.atEnd() && depth > 0) {
      const char = scanner.advance();
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) break;
      }
      text += char;
    }
    
    if (depth === 0 && scanner.match('(')) {
      const url = scanner.scanUntil(')');
      if (scanner.match(')')) {
        // Don't create link/image if URL is empty (match main version behavior)
        if (!url && !prefix) {
          return '[' + this.parseInline(text) + ']()';
        }
        return handler(text, url);
      }
    }
    // Rollback - not properly closed
    return prefix + '[' + (text ? this.parseInline(text) : '');
  }

  parse(input) {
    if (!input || typeof input !== 'string') return '';
    
    const scanner = new Scanner(input);
    const blocks = [];
    
    while (!scanner.atEnd()) {
      // Skip blank lines
      if (scanner.match(/^\n/)) continue;
      
      const block = this.parseBlock(scanner);
      if (block) blocks.push(block);
    }
    
    // Join blocks - most blocks should be directly concatenated
    // Only add newlines between certain block types for formatting
    let result = '';
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      
      // Bug compatibility: Main version doesn't open <p> tag after headings and lists
      if (i > 0 && block.startsWith('<p>')) {
        const prev = blocks[i - 1];
        // After heading always, after list only if paragraph starts with spaces
        if (prev.startsWith('<h') || 
            (prev.endsWith('</ol>') || prev.endsWith('</ul>')) && block.match(/^<p[^>]*>\s{3,}/)) {
          // Remove opening <p> tag to match main version's bug
          block = block.replace(/^<p[^>]*>/, '\n');
        }
      }
      
      result += block;
      
      // Add newline between certain block combinations for formatting
      if (i < blocks.length - 1) {
        const current = blocks[i];
        const next = blocks[i + 1];
        // Add newline between consecutive headings or blockquotes
        if ((current.startsWith('<h') && next.startsWith('<h')) ||
            (current.startsWith('<blockquote') && next.startsWith('<blockquote'))) {
          result += '\n';
        }
      }
    }
    return result;
  }

  parseBlock(scanner) {
    // Try each block type in order
    return this.parseHeading(scanner) ||
           this.parseFence(scanner) ||
           this.parseHR(scanner) ||
           this.parseBlockquote(scanner) ||
           this.parseList(scanner) ||
           this.parseTable(scanner) ||
           this.parseParagraph(scanner);
  }

  parseHeading(scanner) {
    const match = scanner.match(/^#{1,6}(?= )/);
    if (!match) return null;
    
    const level = match.length;
    scanner.match(/ +/); // skip spaces
    const text = this.scanLine(scanner);
    
    // Remove trailing hashes
    const content = text.replace(/\s*#+\s*$/, '');
    const tag = 'h' + level;
    
    return `<${tag}${this.getAttr(tag)}>${this.parseInline(content)}</${tag}>`;
  }

  parseFence(scanner) {
    const fence = scanner.match(/^```|^~~~/);
    if (!fence) return null;
    
    const lang = this.scanLine(scanner).trim();
    
    // Find closing fence
    let code = scanner.scanUntil(new RegExp('^' + fence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm'));
    // Remove trailing newline if present to match main version
    if (code.endsWith('\n')) code = code.slice(0, -1);
    scanner.match(fence);
    scanner.match(/[^\n]*\n?/); // skip rest of line after closing fence
    
    // Apply fence plugin if available
    if (this.opts.fence_plugin) {
      const result = this.opts.fence_plugin(code, lang);
      if (result !== undefined) return result;
    }
    
    const langAttr = lang && !this.opts.inline_styles ? ` class="language-${lang}"` : '';
    return `<pre${this.getAttr('pre')}><code${langAttr}>${escapeHtml(code)}</code></pre>`;
  }

  parseHR(scanner) {
    if (scanner.match(/^---+\s*$/m)) {
      scanner.match(/\n/);
      return `<hr${this.getAttr('hr')}>`;
    }
    return null;
  }

  parseBlockquote(scanner) {
    if (!scanner.match(/^> ?/)) return null;
    
    // Only parse single line at a time to match main version behavior
    const line = this.scanLine(scanner);
    return `<blockquote${this.getAttr('blockquote')}>${this.parseInline(line)}</blockquote>`;
  }

  parseList(scanner) {
    const ordered = scanner.match(/^\d+\. /);
    const unordered = scanner.match(/^[*+-] /);
    
    if (!ordered && !unordered) return null;
    
    const tag = ordered ? 'ol' : 'ul';
    
    // Collect all list lines including nested
    const lines = [];
    lines.push(scanner.scanUntil(/\n|$/));
    scanner.match(/\n/);
    
    // Continue collecting lines that are part of the list
    while (!scanner.atEnd()) {
      // Check if next line starts a list item
      const rest = scanner.peek();
      if (rest.startsWith('\n')) break; // blank line ends list
      
      if (ordered && rest.match(/^\d+\. /)) {
        scanner.match(/^\d+\. /); // consume marker
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else if (unordered && rest.match(/^[*+-] /)) {
        scanner.match(/^[*+-] /); // consume marker
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else if (rest.match(/^ {2,3}(?:\d+\. |[*+-] )/)) {
        // Nested list item (2-3 spaces followed by marker)
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else {
        break; // Any other line ends the list
      }
    }
    
    // Process lines to handle nesting
    let html = `<${tag}${this.getAttr(tag)}>`;
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Check if this line is a nested list item
      if (line.match(/^ {2,3}(?:\d+\. |[*+-] )/)) {
        // Collect all nested items at this level
        const nestedLines = [];
        while (i < lines.length && lines[i].match(/^ {2,3}/)) {
          const spaces = lines[i].match(/^( {2,3})/)[1].length;
          nestedLines.push(lines[i].slice(spaces)); // remove indent
          i++;
        }
        // Parse as nested list
        const nestedScanner = new Scanner(nestedLines.join('\n'));
        const nestedHtml = this.parseList(nestedScanner);
        if (nestedHtml) {
          html += '\n' + nestedHtml;
        }
        continue;
      }
      
      html += '\n';
      // Check for task list
      if (!ordered && line.match(/^\[[ xX]\]/)) {
        const checked = /^\[[xX]\]/.test(line);
        const content = line.slice(3).trim();
        html += `<li class="quikdown-task-item"><input type="checkbox" class="quikdown-task-checkbox"${checked ? ' checked' : ''} disabled> ${this.parseInline(content)}</li>`;
      } else {
        html += `<li${this.getAttr('li')}>${this.parseInline(line)}</li>`;
      }
      
      i++;
    }
    html += '\n' + `</${tag}>`;
    
    return html;
  }

  parseTable(scanner) {
    const saved = scanner.pos;
    
    // Parse header row
    if (!scanner.peek().includes('|')) {
      return null;
    }
    
    const headerLine = this.scanLine(scanner);
    
    // Parse separator
    const sepLine = this.scanLine(scanner);
    
    if (!sepLine.match(/^[\s\|:\-]+$/)) {
      scanner.pos = saved;
      return null;
    }
    
    // Parse cells - handle leading/trailing pipes
    const parseCells = (line) => {
      let cells = line.split('|');
      // Remove empty first/last cells from pipes at line edges
      if (cells[0] === '' || cells[0].trim() === '') cells.shift();
      if (cells[cells.length - 1] === '' || cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(s => s.trim());
    };
    
    // Parse header cells
    const headers = parseCells(headerLine);
    const alignments = parseCells(sepLine).map(s => {
      if (s.startsWith(':') && s.endsWith(':')) return 'center';
      if (s.endsWith(':')) return 'right';
      return 'left';
    });
    
    // Parse body rows - collect lines that contain pipes
    const rows = [];
    while (!scanner.atEnd() && scanner.peek().includes('|')) {
      rows.push(parseCells(this.scanLine(scanner)));
    }
    
    // Build table with all classes and newlines to match main version
    let html = `<table${this.getAttr('table')}>
<thead${this.getAttr('thead')}>
<tr${this.getAttr('tr')}>
`;
    for (let i = 0; i < headers.length; i++) {
      const align = alignments[i] !== 'left' ? ` style="text-align:${alignments[i]}"` : '';
      html += `<th${this.getAttr('th')}${align}>${this.parseInline(headers[i])}</th>\n`;
    }
    html += `</tr>
</thead>`;
    
    if (rows.length) {
      html += `
<tbody${this.getAttr('tbody')}>
`;
      for (const row of rows) {
        html += `<tr${this.getAttr('tr')}>
`;
        for (let i = 0; i < row.length; i++) {
          const align = alignments[i] !== 'left' ? ` style="text-align:${alignments[i]}"` : '';
          html += `<td${this.getAttr('td')}${align}>${this.parseInline(row[i] || '')}</td>\n`;
        }
        html += `</tr>
`;
      }
      html += '</tbody>';
    }
    html += '\n</table>';
    
    return html;
  }

  parseParagraph(scanner) {
    const lines = [];
    
    while (!scanner.atEnd()) {
      // Check for double newline (paragraph break) - only way to end paragraph
      if (scanner.peek().startsWith('\n')) break;
      
      // Collect the line
      const line = scanner.scanUntil(/\n|$/);
      if (line.trim()) lines.push(line);
      scanner.match(/\n/);
    }
    
    if (!lines.length) return null;
    
    const content = this.opts.lazy_linefeeds 
      ? lines.map((l, i) => i < lines.length - 1 ? this.parseInline(l) + '<br>' : this.parseInline(l)).join('')
      : this.parseInline(lines.join('\n'));
    
    return `<p${this.getAttr('p')}>${content}</p>`;
  }

  parseInline(text) {
    // Handle line breaks with two spaces - use placeholder to avoid escaping
    const BR_PLACEHOLDER = '§BR§';
    text = text.replace(/  \n/g, `${BR_PLACEHOLDER}\n`);
    
    const scanner = new Scanner(text);
    let result = '';
    
    while (!scanner.atEnd()) {
      // Check for block elements at start of line (headings, blockquotes)
      if (scanner.pos === 0 || scanner.input[scanner.pos - 1] === '\n') {
        // Heading
        const headingMatch = scanner.peek().match(/^(#{1,6}) (.*?)(?:\n|$)/);
        if (headingMatch) {
          scanner.advance(headingMatch[0].length);
          const level = headingMatch[1].length;
          const content = headingMatch[2].replace(/\s*#+\s*$/, '');
          // Add newline before if not at start
          if (scanner.pos > headingMatch[0].length) result += '\n';
          result += `<h${level}${this.getAttr('h' + level)}>${this.parseInline(content)}</h${level}>`;
          // Add newline after if more content
          if (!scanner.atEnd()) result += '\n';
          continue;
        }
        
        // Blockquote
        if (scanner.match('> ')) {
          const quoteLine = scanner.scanUntil(/\n|$/);
          // Don't consume the newline yet
          // Add newline before blockquote only if we have content
          if (result && !result.endsWith('\n')) result += '\n';
          result += `<blockquote${this.getAttr('blockquote')}>${this.parseInline(quoteLine)}</blockquote>`;
          // Consume the newline after processing
          if (scanner.match(/\n/)) {
            result += '\n';
          }
          continue;
        }
      }
      
      // Backslash - in main version, backslash doesn't prevent parsing, just gets output
      if (scanner.match('\\')) {
        result += '\\';
        // For brackets, consume them to prevent link parsing
        const next = scanner.peek()[0];
        if (next && '[]'.includes(next)) {
          result += scanner.advance();
          continue;
        }
        // For *, let it be parsed normally (weird but matches main version)
      }
      // Bold
      else if (scanner.match('**') || scanner.match('__')) {
        const marker = scanner.input.slice(scanner.pos - 2, scanner.pos);
        result += this.parseDelimited(scanner, marker, 'strong');
      }
      // Italic
      else if (scanner.match('*') || scanner.match('_')) {
        const marker = scanner.input[scanner.pos - 1];
        result += this.parseDelimited(scanner, marker, 'em');
      }
      // Strikethrough
      else if (scanner.match('~~')) {
        result += this.parseDelimited(scanner, '~~', 'del');
      }
      // Code - special case: no nested parsing
      else if (scanner.match('`')) {
        const content = scanner.scanUntil('`');
        if (scanner.match('`')) {
          result += `<code${this.getAttr('code')}>${escapeHtml(content)}</code>`;
          continue;
        }
        result += '`';
      }
      // Image
      else if (scanner.match('![')) {
        result += this.parseBracketed(scanner, '!', (alt, url) => {
          const safeUrl = this.sanitizeUrl(url);
          return `<img${this.getAttr('img')} src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}">`;
        });
      }
      // Link
      else if (scanner.match('[')) {
        result += this.parseBracketed(scanner, '', (text, url) => {
          const safeUrl = this.sanitizeUrl(url);
          const rel = safeUrl.startsWith('http') ? ' rel="noopener noreferrer"' : '';
          return `<a${this.getAttr('a')} href="${escapeHtml(safeUrl)}"${rel}>${this.parseInline(text)}</a>`;
        });
      }
      // Angle brackets - just escape them (main version doesn't parse autolinks)
      else if (scanner.match('<')) {
        result += escapeHtml('<');
      }
      // Regular character
      else {
        result += escapeHtml(scanner.advance());
      }
    }
    
    // Replace BR placeholder with actual br tag
    result = result.replace(/§BR§/g, this.getBrTag());
    
    return result;
  }

  getAttr(tag) {
    // Don't add class to p tags to match main version
    if (tag === 'p') return '';
    
    if (this.opts.inline_styles) {
      const style = STYLES[tag] || '';
      return style ? ` style="${style}"` : '';
    }
    return ` class="${this.opts.class_prefix}${tag}"`;
  }
  
  getBrTag() {
    // Special handling for br tag to include class properly
    return `<br${this.getAttr('br')}>`;
  }

  sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (this.opts.allow_unsafe_urls) return trimmed;
    
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
      return lower.startsWith('data:image/') ? trimmed : '#';
    }
    return trimmed;
  }
}

// Main export function
function quikdown_lex(markdown, options = {}) {
  const parser = new GrammarParser(options);
  return parser.parse(markdown);
}

// API compatibility
quikdown_lex.version = '__QUIKDOWN_VERSION__';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  let css = '';
  for (const [tag, style] of Object.entries(STYLES)) {
    if (style) {
      css += `.${prefix}${tag} { ${style} }\n`;
    }
  }
  return css;
};

quikdown_lex.configure = function(options) {
  return function(markdown) {
    return quikdown_lex(markdown, options);
  };
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return quikdown_lex; });
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}

export default quikdown_lex;