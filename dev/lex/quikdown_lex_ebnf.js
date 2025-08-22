/**
 * QuikDown Lexer - EBNF-Compiled State Machine
 * Auto-generated from simplified EBNF rules
 */

// HTML escape function
const escapeHtml = (str) => {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += escapeMap[str[i]] || str[i];
  }
  return result;
};

// Scanner with state machine
class Scanner {
  constructor(input) {
    this.input = input;
    this.pos = 0;
  }

  peek() {
    return this.input.slice(this.pos);
  }

  advance(count = 1) {
    const result = this.input.slice(this.pos, this.pos + count);
    this.pos += count;
    return result;
  }

  match(pattern) {
    if (typeof pattern === 'string') {
      // Use startsWith for literals (fast)
      if (this.input.startsWith(pattern, this.pos)) {
        return this.advance(pattern.length);
      }
    } else if (pattern instanceof RegExp) {
      const match = this.input.slice(this.pos).match(pattern);
      if (match && match.index === 0) {
        return this.advance(match[0].length);
      }
    }
    return null;
  }

  scanUntil(pattern) {
    const start = this.pos;
    if (typeof pattern === 'string') {
      // Use indexOf for strings (fast)
      const idx = this.input.indexOf(pattern, this.pos);
      this.pos = idx === -1 ? this.input.length : idx;
    } else {
      const match = this.input.slice(this.pos).match(pattern);
      this.pos = match ? this.pos + match.index : this.input.length;
    }
    return this.input.slice(start, this.pos);
  }

  atEnd() {
    return this.pos >= this.input.length;
  }
}

// EBNF-based Parser with state machine
class EBNFLexer {
  constructor(options = {}) {
    this.opts = {
      inline_styles: options.inline_styles || false,
      class_prefix: options.class_prefix || 'quikdown-',
      fence_plugin: options.fence_plugin || null,
      lazy_linefeeds: options.lazy_linefeeds || false,
      allow_unsafe_urls: options.allow_unsafe_urls || false
    };
    
    // Compiled state rules from EBNF
    this.initializeStates();
  }

  initializeStates() {
    // Character map for fast first-char dispatch
    this.charMap = {
      '#': 'heading',
      '`': 'fence',
      '~': 'fence',
      '-': 'hr',
      '>': 'blockquote',
      '*': 'listOrEmphasis',
      '+': 'list',
      '0': 'orderedList',
      '1': 'orderedList',
      '2': 'orderedList',
      '3': 'orderedList',
      '4': 'orderedList',
      '5': 'orderedList',
      '6': 'orderedList',
      '7': 'orderedList',
      '8': 'orderedList',
      '9': 'orderedList',
      '|': 'table'
    };
    
    // Block patterns compiled from EBNF
    this.blockPatterns = [
      { name: 'heading', pattern: /^#{1,6}(?= )/ },
      { name: 'fence', pattern: /^```|^~~~/ },
      { name: 'hr', pattern: /^---+\s*$/ },
      { name: 'blockquote', pattern: /^> ?/ },
      { name: 'orderedList', pattern: /^\d+\. / },
      { name: 'unorderedList', pattern: /^[*+-] / },
      { name: 'table', pattern: /\|/ }
    ];
    
    // Inline patterns compiled from EBNF
    this.inlinePatterns = {
      escape: /^\\/,
      strong: /^(\*\*|__)/,
      emphasis: /^(\*|_)/,
      strikethrough: /^~~/,
      code: /^`/,
      image: /^!\[/,
      link: /^\[/
    };
  }

  parse(input) {
    if (!input || typeof input !== 'string') return '';
    
    const scanner = new Scanner(input);
    const blocks = [];
    
    while (!scanner.atEnd()) {
      if (scanner.match(/^\n/)) continue;
      
      const block = this.parseBlock(scanner);
      if (block) blocks.push(block);
    }
    
    return this.processBlocks(blocks);
  }

  processBlocks(blocks) {
    let result = '';
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      
      // Bug compatibility
      if (i > 0 && block.startsWith('<p>')) {
        const prev = blocks[i - 1];
        if (prev.startsWith('<h') || 
            ((prev.endsWith('</ol>') || prev.endsWith('</ul>')) && 
             block.match(/^<p[^>]*>\s{3,}/))) {
          block = block.replace(/^<p[^>]*>/, '\n');
        }
      }
      
      result += block;
      
      if (i < blocks.length - 1) {
        const current = blocks[i];
        const next = blocks[i + 1];
        if ((current.startsWith('<h') && next.startsWith('<h')) ||
            (current.startsWith('<blockquote') && next.startsWith('<blockquote'))) {
          result += '\n';
        }
      }
    }
    return result;
  }

  parseBlock(scanner) {
    // Fast dispatch using first character
    const firstChar = scanner.peek()[0];
    if (this.charMap[firstChar]) {
      const handler = this['parse' + this.charMap[firstChar].charAt(0).toUpperCase() + 
                      this.charMap[firstChar].slice(1)];
      if (handler) {
        const result = handler.call(this, scanner);
        if (result) return result;
      }
    }
    
    // Try other patterns
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
    scanner.match(/ +/);
    const content = this.scanLine(scanner).replace(/\s*#+\s*$/, '');
    const tag = 'h' + level;
    
    return `<${tag}${this.getAttr(tag)}>${this.parseInline(content)}</${tag}>`;
  }

  parseFence(scanner) {
    const marker = scanner.match(/^```|^~~~/);
    if (!marker) return null;
    
    const lang = this.scanLine(scanner).trim();
    // Find closing fence - simpler approach
    const searchPattern = '\n' + marker;
    const idx = scanner.input.indexOf(searchPattern, scanner.pos);
    let content;
    if (idx !== -1) {
      content = scanner.input.slice(scanner.pos, idx);
      scanner.pos = idx + 1; // Skip newline
    } else {
      content = scanner.input.slice(scanner.pos);
      scanner.pos = scanner.input.length;
    }
    
    if (content.endsWith('\n')) {
      content = content.slice(0, -1);
    }
    
    scanner.match(marker);
    scanner.match(/[^\n]*\n?/);
    
    if (this.opts.fence_plugin) {
      const result = this.opts.fence_plugin(content, lang);
      if (result !== undefined) return result;
    }
    
    const langAttr = lang && !this.opts.inline_styles ? ` class="language-${lang}"` : '';
    return `<pre${this.getAttr('pre')}><code${langAttr}>${escapeHtml(content)}</code></pre>`;
  }

  parseHR(scanner) {
    if (!scanner.match(/^---+\s*$/m)) return null;
    scanner.match(/\n/);
    return `<hr${this.getAttr('hr')}>`;
  }

  parseBlockquote(scanner) {
    if (!scanner.match(/^> ?/)) return null;
    const content = this.scanLine(scanner);
    return `<blockquote${this.getAttr('blockquote')}>${this.parseInline(content)}</blockquote>`;
  }

  parseList(scanner) {
    const ordered = scanner.match(/^\d+\. /);
    const unordered = scanner.match(/^[*+-] /);
    
    if (!ordered && !unordered) return null;
    
    const tag = ordered ? 'ol' : 'ul';
    const lines = [];
    
    lines.push(scanner.scanUntil(/\n|$/));
    scanner.match(/\n/);
    
    while (!scanner.atEnd()) {
      const rest = scanner.peek();
      if (rest.startsWith('\n')) break;
      
      if (ordered && rest.match(/^\d+\. /)) {
        scanner.match(/^\d+\. /);
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else if (unordered && rest.match(/^[*+-] /)) {
        scanner.match(/^[*+-] /);
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else if (rest.match(/^ {2,3}(?:\d+\. |[*+-] )/)) {
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else {
        break;
      }
    }
    
    let html = `<${tag}${this.getAttr(tag)}>`;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Handle nested lists
      if (line.match(/^ {2,3}(?:\d+\. |[*+-] )/)) {
        const nestedLines = [];
        while (i < lines.length && lines[i].match(/^ {2,3}/)) {
          const spaces = lines[i].match(/^( {2,3})/)[1].length;
          nestedLines.push(lines[i].slice(spaces));
          i++;
        }
        const nestedScanner = new Scanner(nestedLines.join('\n'));
        const nestedHtml = this.parseList(nestedScanner);
        if (nestedHtml) {
          html += '\n' + nestedHtml;
        }
        i--; // Back up one since outer loop will increment
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
    }
    
    html += `\n</${tag}>`;
    return html;
  }

  parseListOrEmphasis(scanner) {
    // Disambiguate * at line start
    if (scanner.peek().match(/^\* /)) {
      return this.parseList(scanner);
    }
    return null;
  }

  parseOrderedList(scanner) {
    return this.parseList(scanner);
  }

  parseTable(scanner) {
    const saved = scanner.pos;
    
    if (!scanner.peek().includes('|')) {
      return null;
    }
    
    const headerRow = this.scanLine(scanner);
    const dividerRow = this.scanLine(scanner);
    
    if (!dividerRow.match(/^[\s\|:\-]+$/)) {
      scanner.pos = saved;
      return null;
    }
    
    const parseCells = (row) => {
      let cells = row.split('|');
      if (cells[0] === '' || cells[0].trim() === '') cells.shift();
      if (cells[cells.length - 1] === '' || cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(cell => cell.trim());
    };
    
    const headers = parseCells(headerRow);
    const alignments = parseCells(dividerRow).map(cell => {
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      if (cell.endsWith(':')) return 'right';
      return 'left';
    });
    
    const rows = [];
    while (!scanner.atEnd() && scanner.peek().includes('|')) {
      rows.push(parseCells(this.scanLine(scanner)));
    }
    
    let html = `<table${this.getAttr('table')}>\n<thead${this.getAttr('thead')}>\n<tr${this.getAttr('tr')}>\n`;
    
    for (let i = 0; i < headers.length; i++) {
      const align = alignments[i] !== 'left' ? ` style="text-align:${alignments[i]}"` : '';
      html += `<th${this.getAttr('th')}${align}>${this.parseInline(headers[i])}</th>\n`;
    }
    
    html += '</tr>\n</thead>';
    
    if (rows.length) {
      html += `\n<tbody${this.getAttr('tbody')}>\n`;
      for (const row of rows) {
        html += `<tr${this.getAttr('tr')}>\n`;
        for (let i = 0; i < row.length; i++) {
          const align = alignments[i] !== 'left' ? ` style="text-align:${alignments[i]}"` : '';
          html += `<td${this.getAttr('td')}${align}>${this.parseInline(row[i] || '')}</td>\n`;
        }
        html += '</tr>\n';
      }
      html += '</tbody>';
    }
    
    html += '\n</table>';
    return html;
  }

  parseParagraph(scanner) {
    const lines = [];
    
    while (!scanner.atEnd() && !scanner.peek().startsWith('\n')) {
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
    text = text.replace(/  \n/g, '§BR§\n');
    
    const scanner = new Scanner(text);
    let result = '';
    
    while (!scanner.atEnd()) {
      // Handle inline blocks
      if (scanner.pos === 0 || text[scanner.pos - 1] === '\n') {
        // Inline heading
        const headingMatch = scanner.peek().match(/^(#{1,6}) (.*?)(?:\n|$)/);
        if (headingMatch) {
          scanner.advance(headingMatch[0].length);
          const level = headingMatch[1].length;
          const content = headingMatch[2].replace(/\s*#+\s*$/, '');
          if (scanner.pos > headingMatch[0].length) result += '\n';
          result += `<h${level}${this.getAttr('h' + level)}>${this.parseInline(content)}</h${level}>`;
          if (!scanner.atEnd()) result += '\n';
          continue;
        }
        
        // Inline blockquote
        if (scanner.match('> ')) {
          const content = scanner.scanUntil(/\n|$/);
          if (result && !result.endsWith('\n')) result += '\n';
          result += `<blockquote${this.getAttr('blockquote')}>${this.parseInline(content)}</blockquote>`;
          if (scanner.match(/\n/)) result += '\n';
          continue;
        }
      }
      
      // Escape
      if (scanner.match('\\')) {
        result += '\\';
        const next = scanner.peek()[0];
        if (next && '[]'.includes(next)) {
          result += scanner.advance();
        }
        continue;
      }
      
      // Strong emphasis
      if (scanner.match('**') || scanner.match('__')) {
        const marker = text.slice(scanner.pos - 2, scanner.pos);
        const content = scanner.scanUntil(marker);
        if (scanner.match(marker)) {
          result += `<strong${this.getAttr('strong')}>${this.parseInline(content)}</strong>`;
        } else {
          result += escapeHtml(marker) + (content ? this.parseInline(content) : '');
        }
        continue;
      }
      
      // Emphasis
      if (scanner.match('*') || scanner.match('_')) {
        const marker = text[scanner.pos - 1];
        const content = scanner.scanUntil(marker);
        if (scanner.match(marker)) {
          result += `<em${this.getAttr('em')}>${this.parseInline(content)}</em>`;
        } else {
          result += escapeHtml(marker) + (content ? this.parseInline(content) : '');
        }
        continue;
      }
      
      // Strikethrough
      if (scanner.match('~~')) {
        const content = scanner.scanUntil('~~');
        if (scanner.match('~~')) {
          result += `<del${this.getAttr('del')}>${this.parseInline(content)}</del>`;
        } else {
          result += '~~' + (content ? this.parseInline(content) : '');
        }
        continue;
      }
      
      // Code
      if (scanner.match('`')) {
        const content = scanner.scanUntil('`');
        if (scanner.match('`')) {
          result += `<code${this.getAttr('code')}>${escapeHtml(content)}</code>`;
        } else {
          result += '`';
        }
        continue;
      }
      
      // Image
      if (scanner.match('![')) {
        result += this.parseBracketed(scanner, '!', (alt, url) => {
          const safeUrl = this.sanitizeUrl(url);
          return `<img${this.getAttr('img')} src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}">`;
        });
        continue;
      }
      
      // Link
      if (scanner.match('[')) {
        result += this.parseBracketed(scanner, '', (text, url) => {
          const safeUrl = this.sanitizeUrl(url);
          const rel = safeUrl.startsWith('http') ? ' rel="noopener noreferrer"' : '';
          return `<a${this.getAttr('a')} href="${escapeHtml(safeUrl)}"${rel}>${this.parseInline(text)}</a>`;
        });
        continue;
      }
      
      // HTML entities
      if (scanner.match('<')) {
        result += escapeHtml('<');
        continue;
      }
      
      // Default text
      result += escapeHtml(scanner.advance());
    }
    
    return result.replace(/§BR§/g, this.getBrTag());
  }

  parseBracketed(scanner, prefix, handler) {
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
        return (!url && !prefix) ? '[' + this.parseInline(text) + ']()' : handler(text, url);
      }
    }
    
    return prefix + '[' + (text ? this.parseInline(text) : '');
  }

  // Helper methods
  scanLine(scanner) {
    const line = scanner.scanUntil(/\n|$/);
    scanner.match(/\n/);
    return line;
  }

  getAttr(tag) {
    if (tag === 'p') return '';
    
    if (this.opts.inline_styles) {
      const styles = {"h1":"font-size:2em;font-weight:600;margin:.67em 0","h2":"font-size:1.5em;font-weight:600;margin:.83em 0","h3":"font-size:1.25em;font-weight:600;margin:1em 0","h4":"font-size:1em;font-weight:600;margin:1.33em 0","h5":"font-size:.875em;font-weight:600;margin:1.67em 0","h6":"font-size:.85em;font-weight:600;margin:2em 0","pre":"background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0","code":"background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace","blockquote":"border-left:4px solid #ddd;margin-left:0;padding-left:1em","table":"border-collapse:collapse;width:100%;margin:1em 0","th":"border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left","td":"border:1px solid #ddd;padding:8px;text-align:left","hr":"border:none;border-top:1px solid #ddd;margin:1em 0","img":"max-width:100%;height:auto","a":"color:#06c;text-decoration:underline","strong":"font-weight:bold","em":"font-style:italic","del":"text-decoration:line-through","ul":"margin:.5em 0;padding-left:2em","ol":"margin:.5em 0;padding-left:2em","li":"margin:.25em 0","br":"","p":"margin:1em 0"};
      const style = styles[tag] || '';
      return style ? ` style="${style}"` : '';
    }
    
    return ` class="${this.opts.class_prefix}${tag}"`;
  }

  getBrTag() {
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

// Main export
export default function quikdown_lex(markdown, options = {}) {
  const parser = new EBNFLexer(options);
  return parser.parse(markdown);
}

// API compatibility
quikdown_lex.version = '1.0.6dev1';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  const styles = {"h1":"font-size:2em;font-weight:600;margin:.67em 0","h2":"font-size:1.5em;font-weight:600;margin:.83em 0","h3":"font-size:1.25em;font-weight:600;margin:1em 0","h4":"font-size:1em;font-weight:600;margin:1.33em 0","h5":"font-size:.875em;font-weight:600;margin:1.67em 0","h6":"font-size:.85em;font-weight:600;margin:2em 0","pre":"background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0","code":"background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace","blockquote":"border-left:4px solid #ddd;margin-left:0;padding-left:1em","table":"border-collapse:collapse;width:100%;margin:1em 0","th":"border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left","td":"border:1px solid #ddd;padding:8px;text-align:left","hr":"border:none;border-top:1px solid #ddd;margin:1em 0","img":"max-width:100%;height:auto","a":"color:#06c;text-decoration:underline","strong":"font-weight:bold","em":"font-style:italic","del":"text-decoration:line-through","ul":"margin:.5em 0;padding-left:2em","ol":"margin:.5em 0;padding-left:2em","li":"margin:.25em 0","br":"","p":"margin:1em 0"};
  let css = '';
  for (const [tag, style] of Object.entries(styles)) {
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

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return quikdown_lex; });
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}
