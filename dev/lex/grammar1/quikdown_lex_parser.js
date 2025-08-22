/**
 * QuikDown Grammar-Driven Parser
 * Uses compiled grammar rules to parse markdown
 */

import { compileGrammar } from './quikdown_lex_compiler.js';

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

// Scanner class for tokenization
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
    const str = typeof pattern === 'string' 
      ? (this.input.startsWith(pattern, this.pos) && pattern)
      : this.input.slice(this.pos).match(pattern)?.[0];
    return str ? this.advance(str.length) : null;
  }

  scanUntil(pattern) {
    const start = this.pos;
    const end = typeof pattern === 'string'
      ? this.input.indexOf(pattern, this.pos)
      : (this.input.slice(this.pos).match(pattern)?.index ?? -1) + this.pos;
    this.pos = end < this.pos ? this.input.length : end;
    return this.input.slice(start, this.pos);
  }

  atEnd() {
    return this.pos >= this.input.length;
  }

  rest() {
    return this.input.slice(this.pos);
  }
}

// Grammar-driven parser
export class GrammarParser {
  constructor(options = {}, grammar = null) {
    this.opts = {
      inline_styles: options.inline_styles || false,
      class_prefix: options.class_prefix || 'quikdown-',
      fence_plugin: options.fence_plugin || null,
      bidirectional: options.bidirectional || false,
      lazy_linefeeds: options.lazy_linefeeds || false,
      allow_unsafe_urls: options.allow_unsafe_urls || false
    };
    
    // Use provided grammar or compile default
    this.grammar = grammar || compileGrammar();
    
    // Bind methods that grammar rules reference
    this.escapeHtml = escapeHtml;
  }

  // Helper methods used by grammar rules
  scanLine(scanner) {
    const line = scanner.scanUntil(/\n|$/);
    scanner.match(/\n/);
    return line;
  }

  collectLines(scanner, condition) {
    const lines = [];
    while (!scanner.atEnd() && condition(scanner)) {
      lines.push(this.scanLine(scanner));
    }
    return lines;
  }

  parseDelimited(scanner, marker, tag) {
    const content = scanner.scanUntil(marker);
    if (scanner.match(marker)) {
      return `<${tag}${this.getAttr(tag)}>${this.parseInline(content)}</${tag}>`;
    }
    return escapeHtml(marker) + (content ? this.parseInline(content) : '');
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
        if (!url && !prefix) {
          return '[' + this.parseInline(text) + ']()';
        }
        return handler(text, url);
      }
    }
    return prefix + '[' + (text ? this.parseInline(text) : '');
  }

  // Main parse function
  parse(input) {
    if (!input || typeof input !== 'string') return '';
    
    const scanner = new Scanner(input);
    const blocks = [];
    
    while (!scanner.atEnd()) {
      if (scanner.match(this.grammar.helpers.blankLine)) continue;
      
      const block = this.parseBlock(scanner);
      if (block) blocks.push(block);
    }
    
    return this.processBlocks(blocks);
  }

  // Process blocks with bug compatibility
  processBlocks(blocks) {
    let result = '';
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      
      // Bug compatibility: Main version doesn't open <p> tag after headings
      if (this.grammar.processing.missingParagraphOpen.afterHeading) {
        if (i > 0 && blocks[i - 1].startsWith('<h') && block.startsWith('<p>')) {
          block = block.replace(/^<p[^>]*>/, '\n');
        }
      }
      
      // Bug compatibility: After list with spaces
      if (i > 0 && block.startsWith('<p>')) {
        const prev = blocks[i - 1];
        if ((prev.endsWith('</ol>') || prev.endsWith('</ul>')) && 
            block.match(this.grammar.processing.missingParagraphOpen.afterListWithSpaces)) {
          block = block.replace(/^<p[^>]*>/, '\n');
        }
      }
      
      result += block;
      
      // Add newlines between certain blocks
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

  // Parse block using grammar rules
  parseBlock(scanner) {
    for (const rule of this.grammar.blocks) {
      const match = scanner.peek().match(rule.pattern);
      if (match) {
        // Handle string references to methods
        if (typeof rule.parse === 'string') {
          return this[rule.parse](scanner);
        }
        // Call parse function with context
        return rule.parse.call(this, match, scanner, this);
      }
    }
    return null;
  }

  // Parse inline content using grammar rules
  parseInline(text) {
    // Handle line breaks
    const lb = this.grammar.processing.lineBreak;
    text = text.replace(lb.pattern, lb.placeholder + '\n');
    
    const scanner = new Scanner(text);
    let result = '';
    
    while (!scanner.atEnd()) {
      // Check for inline blocks (headings, blockquotes in paragraphs)
      let matched = false;
      for (const rule of this.grammar.inlineBlocks) {
        if (rule.condition && !rule.condition(scanner)) continue;
        
        const match = scanner.peek().match(rule.pattern);
        if (match) {
          result += rule.parse.call(this, match, scanner, this);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      
      // Check character-mapped rules for faster lookup
      const char = scanner.peek()[0];
      const charRules = this.grammar.inline.charMap[char];
      if (charRules) {
        for (const rule of charRules) {
          if (scanner.match(rule.pattern)) {
            result += rule.parse.call(this, [rule.pattern], scanner, this);
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;
      
      // Check regex rules
      for (const rule of this.grammar.inline.regexRules) {
        const match = scanner.peek().match(rule.pattern);
        if (match && scanner.pos + match.index === scanner.pos) {
          scanner.advance(match[0].length);
          result += rule.parse.call(this, match, scanner, this);
          matched = true;
          break;
        }
      }
      if (!matched) {
        result += escapeHtml(scanner.advance());
      }
    }
    
    // Replace line break placeholders
    return result.replace(new RegExp(lb.placeholder, 'g'), this.getBrTag());
  }

  // Complex list parsing (referenced by grammar)
  parseList(scanner) {
    const lists = this.grammar.lists;
    const ordered = scanner.match(lists.ordered.marker);
    const unordered = scanner.match(lists.unordered.marker);
    
    if (!ordered && !unordered) return null;
    
    const tag = ordered ? 'ol' : 'ul';
    const lines = [];
    
    // Collect first line
    lines.push(scanner.scanUntil(/\n|$/));
    scanner.match(/\n/);
    
    // Continue collecting list items
    while (!scanner.atEnd()) {
      const rest = scanner.peek();
      if (rest.startsWith('\n')) break;
      
      if (ordered && rest.match(lists.ordered.marker)) {
        scanner.match(lists.ordered.marker);
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else if (unordered && rest.match(lists.unordered.marker)) {
        scanner.match(lists.unordered.marker);
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else if (rest.match(lists.nesting.nestedMarker)) {
        lines.push(scanner.scanUntil(/\n|$/));
        scanner.match(/\n/);
      } else {
        break;
      }
    }
    
    // Process lines
    let html = `<${tag}${this.getAttr(tag)}>`;
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Handle nested lists
      if (line.match(lists.nesting.nestedMarker)) {
        const nestedLines = [];
        while (i < lines.length && lines[i].match(lists.nesting.indent)) {
          const spaces = lines[i].match(lists.nesting.indent)[1].length;
          nestedLines.push(lines[i].slice(spaces));
          i++;
        }
        const nestedScanner = new Scanner(nestedLines.join('\n'));
        const nestedHtml = this.parseList(nestedScanner);
        if (nestedHtml) {
          html += '\n' + nestedHtml;
        }
        continue;
      }
      
      html += '\n';
      
      // Check for task list
      if (!ordered && line.match(lists.task.pattern)) {
        const checked = lists.task.checked.test(line);
        html += lists.task.parse(line, checked, this);
      } else {
        html += `<li${this.getAttr('li')}>${this.parseInline(line)}</li>`;
      }
      
      i++;
    }
    
    html += '\n' + `</${tag}>`;
    return html;
  }

  // Complex table parsing (referenced by grammar)
  parseTable(scanner) {
    const tables = this.grammar.tables;
    const saved = scanner.pos;
    
    if (!scanner.peek().includes(tables.cellSeparator)) {
      return null;
    }
    
    const headerRow = this.scanLine(scanner);
    const dividerRow = this.scanLine(scanner);
    
    if (!dividerRow.match(tables.divider)) {
      scanner.pos = saved;
      return null;
    }
    
    // Parse cells
    const parseCells = (row) => {
      let cells = row.split(tables.cellSeparator);
      if (cells[0] === '' || cells[0].trim() === '') cells.shift();
      if (cells[cells.length - 1] === '' || cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(cell => cell.trim());
    };
    
    const headers = parseCells(headerRow);
    const alignments = parseCells(dividerRow).map(cell => {
      if (cell.match(tables.alignment.center)) return 'center';
      if (cell.match(tables.alignment.right)) return 'right';
      return 'left';
    });
    
    const rows = [];
    while (!scanner.atEnd() && scanner.peek().includes(tables.cellSeparator)) {
      rows.push(parseCells(this.scanLine(scanner)));
    }
    
    // Build HTML
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

  // Paragraph parsing (referenced by grammar)
  parseParagraph(scanner) {
    const lines = [];
    
    while (!scanner.atEnd()) {
      if (scanner.peek().startsWith('\n')) break;
      
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

  // Utility methods
  getAttr(tag) {
    if (tag === 'p') return '';
    
    if (this.opts.inline_styles) {
      const style = this.grammar.styles[tag] || '';
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

// Main export function
export default function quikdown_lex(markdown, options = {}) {
  const parser = new GrammarParser(options);
  return parser.parse(markdown);
}

// API compatibility
quikdown_lex.version = '__QUIKDOWN_VERSION__';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  const styles = compileGrammar().styles;
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