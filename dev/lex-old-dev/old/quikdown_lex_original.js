/**
 * quikdown_lex - True grammar-based markdown parser
 * 
 * Zero regex parsing - pure character-by-character tokenization
 * with grammar rules and state machines.
 * 
 * @version __QUIKDOWN_VERSION__
 */

// ===========================================================================
// TOKEN TYPES
// ===========================================================================
const TOKEN = {
  // Single characters
  STAR: 'STAR',
  UNDERSCORE: 'UNDERSCORE', 
  BACKTICK: 'BACKTICK',
  TILDE: 'TILDE',
  HASH: 'HASH',
  PIPE: 'PIPE',
  MINUS: 'MINUS',
  PLUS: 'PLUS',
  EQUALS: 'EQUALS',
  GT: 'GT',
  LT: 'LT',
  BANG: 'BANG',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COLON: 'COLON',
  SPACE: 'SPACE',
  TAB: 'TAB',
  NEWLINE: 'NEWLINE',
  DOT: 'DOT',
  DIGIT: 'DIGIT',
  TEXT: 'TEXT',
  EOF: 'EOF'
};

// ===========================================================================
// STYLES
// ===========================================================================
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

// ===========================================================================
// TOKENIZER
// ===========================================================================
class Tokenizer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  peek(offset = 0) {
    return this.input[this.pos + offset] || null;
  }

  advance() {
    const char = this.input[this.pos];
    if (char === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    this.pos++;
    return char;
  }

  *tokenize() {
    while (this.pos < this.input.length) {
      const char = this.peek();
      const token = this.nextToken();
      if (token) yield token;
    }
    yield { type: TOKEN.EOF, value: '', line: this.line, col: this.col };
  }

  nextToken() {
    const char = this.peek();
    const startLine = this.line;
    const startCol = this.col;

    switch (char) {
      case '*': 
        this.advance();
        return { type: TOKEN.STAR, value: '*', line: startLine, col: startCol };
      
      case '_':
        this.advance();
        return { type: TOKEN.UNDERSCORE, value: '_', line: startLine, col: startCol };
      
      case '`':
        this.advance();
        return { type: TOKEN.BACKTICK, value: '`', line: startLine, col: startCol };
      
      case '~':
        this.advance();
        return { type: TOKEN.TILDE, value: '~', line: startLine, col: startCol };
      
      case '#':
        this.advance();
        return { type: TOKEN.HASH, value: '#', line: startLine, col: startCol };
      
      case '|':
        this.advance();
        return { type: TOKEN.PIPE, value: '|', line: startLine, col: startCol };
      
      case '-':
        this.advance();
        return { type: TOKEN.MINUS, value: '-', line: startLine, col: startCol };
      
      case '+':
        this.advance();
        return { type: TOKEN.PLUS, value: '+', line: startLine, col: startCol };
      
      case '=':
        this.advance();
        return { type: TOKEN.EQUALS, value: '=', line: startLine, col: startCol };
      
      case '>':
        this.advance();
        return { type: TOKEN.GT, value: '>', line: startLine, col: startCol };
      
      case '<':
        this.advance();
        return { type: TOKEN.LT, value: '<', line: startLine, col: startCol };
      
      case '!':
        this.advance();
        return { type: TOKEN.BANG, value: '!', line: startLine, col: startCol };
      
      case '[':
        this.advance();
        return { type: TOKEN.LBRACKET, value: '[', line: startLine, col: startCol };
      
      case ']':
        this.advance();
        return { type: TOKEN.RBRACKET, value: ']', line: startLine, col: startCol };
      
      case '(':
        this.advance();
        return { type: TOKEN.LPAREN, value: '(', line: startLine, col: startCol };
      
      case ')':
        this.advance();
        return { type: TOKEN.RPAREN, value: ')', line: startLine, col: startCol };
      
      case ':':
        this.advance();
        return { type: TOKEN.COLON, value: ':', line: startLine, col: startCol };
      
      case ' ':
        this.advance();
        return { type: TOKEN.SPACE, value: ' ', line: startLine, col: startCol };
      
      case '\t':
        this.advance();
        return { type: TOKEN.TAB, value: '\t', line: startLine, col: startCol };
      
      case '\n':
        this.advance();
        return { type: TOKEN.NEWLINE, value: '\n', line: startLine, col: startCol };
      
      case '.':
        this.advance();
        return { type: TOKEN.DOT, value: '.', line: startLine, col: startCol };
      
      default:
        if (char >= '0' && char <= '9') {
          this.advance();
          return { type: TOKEN.DIGIT, value: char, line: startLine, col: startCol };
        }
        
        // Collect text until next special character
        let text = '';
        while (this.pos < this.input.length) {
          const c = this.peek();
          if ('*_`~#|-+=><![](): \t\n.'.includes(c) || (c >= '0' && c <= '9')) {
            break;
          }
          text += this.advance();
        }
        
        if (text) {
          return { type: TOKEN.TEXT, value: text, line: startLine, col: startCol };
        }
        
        // Unknown character, skip it
        this.advance();
        return null;
    }
  }
}

// ===========================================================================
// PARSER
// ===========================================================================
class Parser {
  constructor(tokens, options = {}) {
    this.tokens = Array.from(tokens);
    this.pos = 0;
    this.opts = {
      inline_styles: options.inline_styles || false,
      class_prefix: options.class_prefix || 'quikdown-',
      fence_plugin: options.fence_plugin || null,
      bidirectional: options.bidirectional || false,
      lazy_linefeeds: options.lazy_linefeeds || false,
      allow_unsafe_urls: options.allow_unsafe_urls || false
    };
    this.output = [];
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || { type: TOKEN.EOF };
  }

  advance() {
    return this.tokens[this.pos++];
  }

  consume(type) {
    if (this.peek().type === type) {
      return this.advance();
    }
    return null;
  }

  consumeSequence(...types) {
    for (let i = 0; i < types.length; i++) {
      if (this.peek(i).type !== types[i]) {
        return false;
      }
    }
    for (let i = 0; i < types.length; i++) {
      this.advance();
    }
    return true;
  }

  getAttr(tag, style = '') {
    if (this.opts.inline_styles) {
      const baseStyle = STYLES[tag] || '';
      const fullStyle = style ? `${baseStyle};${style}` : baseStyle;
      return fullStyle ? ` style="${fullStyle}"` : '';
    }
    const classAttr = ` class="${this.opts.class_prefix}${tag}"`;
    return style ? `${classAttr} style="${style}"` : classAttr;
  }

  dataQd(marker) {
    if (!this.opts.bidirectional) return '';
    return ` data-qd="${this.escapeHtml(marker)}"`;
  }

  escapeHtml(text) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      result += escapeMap[char] || char;
    }
    return result;
  }

  sanitizeUrl(url) {
    if (!url) return '';
    
    const trimmed = url.trim();
    
    if (this.opts.allow_unsafe_urls) {
      return trimmed;
    }
    
    // Check for dangerous protocols
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || 
        lower.startsWith('vbscript:') || 
        lower.startsWith('data:')) {
      // Allow data URLs for images
      if (lower.startsWith('data:image/')) {
        return trimmed;
      }
      return '#';
    }
    
    return trimmed;
  }

  parse() {
    while (this.peek().type !== TOKEN.EOF) {
      this.parseBlock();
    }
    return this.output.join('');
  }

  parseBlock() {
    const token = this.peek();
    
    // Check for blank lines
    if (token.type === TOKEN.NEWLINE) {
      this.advance();
      return;
    }
    
    // Try to parse different block types
    if (this.parseHeading()) return;
    if (this.parseHorizontalRule()) return;
    if (this.parseFence()) return;
    if (this.parseBlockquote()) return;
    if (this.parseList()) return;
    if (this.parseTable()) return;
    
    // Default to paragraph
    this.parseParagraph();
  }

  parseHeading() {
    const start = this.pos;
    let level = 0;
    
    // Count hashes at start of line
    while (this.peek().type === TOKEN.HASH && level < 6) {
      this.advance();
      level++;
    }
    
    if (level === 0) return false;
    
    // Require space after hashes
    if (this.peek().type !== TOKEN.SPACE) {
      this.pos = start;
      return false;
    }
    
    // Skip spaces
    while (this.peek().type === TOKEN.SPACE) {
      this.advance();
    }
    
    // Collect heading text until newline
    let text = '';
    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      const token = this.advance();
      text += token.value;
    }
    
    // Consume newline
    this.consume(TOKEN.NEWLINE);
    
    // Remove trailing hashes and spaces
    let trimmed = text;
    while (trimmed.endsWith('#') || trimmed.endsWith(' ')) {
      trimmed = trimmed.slice(0, -1);
    }
    
    this.output.push(`<h${level}${this.getAttr('h' + level)}>${this.parseInline(trimmed)}</h${level}>`);
    return true;
  }

  parseHorizontalRule() {
    const start = this.pos;
    let count = 0;
    let char = null;
    
    // Check for --- or *** or ___
    const firstToken = this.peek();
    if (firstToken.type === TOKEN.MINUS) {
      char = TOKEN.MINUS;
    } else if (firstToken.type === TOKEN.STAR) {
      char = TOKEN.STAR;
    } else if (firstToken.type === TOKEN.UNDERSCORE) {
      char = TOKEN.UNDERSCORE;
    } else {
      return false;
    }
    
    // Count occurrences (with optional spaces between)
    while (this.pos < this.tokens.length) {
      if (this.peek().type === char) {
        this.advance();
        count++;
      } else if (this.peek().type === TOKEN.SPACE) {
        this.advance();
      } else if (this.peek().type === TOKEN.NEWLINE || this.peek().type === TOKEN.EOF) {
        break;
      } else {
        // Not a horizontal rule
        this.pos = start;
        return false;
      }
    }
    
    if (count >= 3) {
      this.consume(TOKEN.NEWLINE);
      this.output.push(`<hr${this.getAttr('hr')}>`);
      return true;
    }
    
    this.pos = start;
    return false;
  }

  parseFence() {
    const start = this.pos;
    
    // Check for ``` or ~~~
    let fenceChar = null;
    let count = 0;
    
    if (this.peek().type === TOKEN.BACKTICK) {
      fenceChar = TOKEN.BACKTICK;
    } else if (this.peek().type === TOKEN.TILDE) {
      fenceChar = TOKEN.TILDE;
    } else {
      return false;
    }
    
    // Count fence characters
    while (this.peek().type === fenceChar) {
      this.advance();
      count++;
    }
    
    if (count < 3) {
      this.pos = start;
      return false;
    }
    
    // Get language identifier (optional)
    let lang = '';
    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      lang += this.advance().value;
    }
    lang = lang.trim();
    
    // Consume newline
    this.consume(TOKEN.NEWLINE);
    
    // Collect code content until closing fence
    let code = '';
    let lineStart = true;
    let fenceCount = 0;
    
    while (this.pos < this.tokens.length) {
      if (lineStart && this.peek().type === fenceChar) {
        // Check if this is a closing fence
        let tempPos = this.pos;
        fenceCount = 0;
        while (this.peek().type === fenceChar) {
          this.advance();
          fenceCount++;
        }
        
        if (fenceCount >= count) {
          // Found closing fence
          // Skip to end of line
          while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
            this.advance();
          }
          // Consume newline if present (might be EOF)
          if (this.peek().type === TOKEN.NEWLINE) {
            this.advance();
          }
          break;
        } else {
          // Not enough fence chars, treat as content
          this.pos = tempPos;
          code += this.advance().value;
          lineStart = false;
        }
      } else {
        const token = this.advance();
        code += token.value;
        lineStart = (token.type === TOKEN.NEWLINE);
      }
    }
    
    // Process with fence plugin if available
    let output;
    if (this.opts.fence_plugin) {
      output = this.opts.fence_plugin(code, lang);
    }
    
    // Fall back to default if no output from plugin
    if (output === undefined || output === null) {
      const langAttr = !this.opts.inline_styles && lang 
        ? ` class="language-${lang}"` 
        : '';
      const codeAttr = this.opts.inline_styles ? this.getAttr('code') : langAttr;
      output = `<pre${this.getAttr('pre')}><code${codeAttr}>${this.escapeHtml(code)}</code></pre>`;
    }
    
    this.output.push(output);
    return true;
  }

  parseBlockquote() {
    if (this.peek().type !== TOKEN.GT) {
      return false;
    }
    
    this.advance();
    
    // Skip optional space after >
    if (this.peek().type === TOKEN.SPACE) {
      this.advance();
    }
    
    // Collect quote content until newline
    let content = '';
    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      content += this.advance().value;
    }
    
    this.consume(TOKEN.NEWLINE);
    
    // Check for continuation lines
    let lines = [content];
    while (this.peek().type === TOKEN.GT) {
      this.advance();
      if (this.peek().type === TOKEN.SPACE) {
        this.advance();
      }
      
      let line = '';
      while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
        line += this.advance().value;
      }
      lines.push(line);
      this.consume(TOKEN.NEWLINE);
    }
    
    // Process nested markdown in blockquote
    const nestedContent = lines.join('\n');
    const processed = quikdown_lex(nestedContent, this.opts);
    
    this.output.push(`<blockquote${this.getAttr('blockquote')}>${processed}</blockquote>`);
    return true;
  }

  parseList() {
    const start = this.pos;
    
    // Check indentation
    let indent = 0;
    while (this.peek().type === TOKEN.SPACE || this.peek().type === TOKEN.TAB) {
      const token = this.advance();
      indent += token.type === TOKEN.TAB ? 4 : 1;
    }
    
    // Check for list marker
    let isOrdered = false;
    let marker = '';
    
    // Check for unordered list markers (*, -, +)
    if (this.peek().type === TOKEN.STAR || 
        this.peek().type === TOKEN.MINUS || 
        this.peek().type === TOKEN.PLUS) {
      marker = this.advance().value;
    }
    // Check for ordered list (digit followed by .)
    else if (this.peek().type === TOKEN.DIGIT) {
      let num = '';
      while (this.peek().type === TOKEN.DIGIT) {
        num += this.advance().value;
      }
      if (this.peek().type === TOKEN.DOT) {
        this.advance();
        marker = num + '.';
        isOrdered = true;
      } else {
        // Not a list, restore position
        this.pos = start;
        return false;
      }
    } else {
      // Not a list
      this.pos = start;
      return false;
    }
    
    // Require space after marker
    if (this.peek().type !== TOKEN.SPACE) {
      this.pos = start;
      return false;
    }
    this.advance();
    
    // Parse list items
    const listType = isOrdered ? 'ol' : 'ul';
    const items = [];
    
    // Parse first item
    let itemContent = '';
    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      itemContent += this.advance().value;
    }
    items.push(itemContent);
    this.consume(TOKEN.NEWLINE);
    
    // Parse additional items
    while (true) {
      const itemStart = this.pos;
      
      // Check indentation
      let itemIndent = 0;
      while (this.peek().type === TOKEN.SPACE || this.peek().type === TOKEN.TAB) {
        const token = this.advance();
        itemIndent += token.type === TOKEN.TAB ? 4 : 1;
      }
      
      // Check for same type of list marker
      let continueList = false;
      if (!isOrdered) {
        if (this.peek().type === TOKEN.STAR || 
            this.peek().type === TOKEN.MINUS || 
            this.peek().type === TOKEN.PLUS) {
          this.advance();
          continueList = true;
        }
      } else {
        if (this.peek().type === TOKEN.DIGIT) {
          while (this.peek().type === TOKEN.DIGIT) {
            this.advance();
          }
          if (this.peek().type === TOKEN.DOT) {
            this.advance();
            continueList = true;
          }
        }
      }
      
      if (continueList && this.peek().type === TOKEN.SPACE) {
        this.advance();
        
        // Collect item content
        let content = '';
        while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
          content += this.advance().value;
        }
        items.push(content);
        this.consume(TOKEN.NEWLINE);
      } else {
        // End of list
        this.pos = itemStart;
        break;
      }
    }
    
    // Generate HTML
    let html = `<${listType}${this.getAttr(listType)}>`;
    for (const item of items) {
      // Check for task list syntax
      let taskCheckbox = '';
      let processedItem = item;
      
      if (!isOrdered && item.startsWith('[') && item.length > 3) {
        if ((item[1] === 'x' || item[1] === 'X' || item[1] === ' ') && item[2] === ']') {
          const checked = item[1].toLowerCase() === 'x';
          const checkboxAttr = this.opts.inline_styles 
            ? ' style="margin-right:.5em"' 
            : ` class="${this.opts.class_prefix}task-checkbox"`;
          const itemAttr = this.opts.inline_styles 
            ? ' style="list-style:none"' 
            : ` class="${this.opts.class_prefix}task-item"`;
          
          taskCheckbox = `<input type="checkbox"${checkboxAttr}${checked ? ' checked' : ''} disabled> `;
          processedItem = item.substring(3).trim();
          
          html += `\n<li${itemAttr}>${taskCheckbox}${this.parseInline(processedItem)}</li>`;
        } else {
          html += `\n<li${this.getAttr('li')}>${this.parseInline(processedItem)}</li>`;
        }
      } else {
        html += `\n<li${this.getAttr('li')}>${this.parseInline(processedItem)}</li>`;
      }
    }
    html += `\n</${listType}>`;
    
    this.output.push(html);
    return true;
  }

  parseTable() {
    const start = this.pos;
    const rows = [];
    let alignments = null;
    
    // First check if this line contains any pipes
    let hasPipe = false;
    let checkPos = this.pos;
    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      if (this.peek().type === TOKEN.PIPE) {
        hasPipe = true;
        break;
      }
      this.advance();
    }
    this.pos = checkPos;
    
    if (!hasPipe) {
      return false;
    }
    
    // Parse potential table row
    const parseRow = () => {
      const cells = [];
      let cell = '';
      
      // Skip leading pipe if present
      if (this.peek().type === TOKEN.PIPE) {
        this.advance();
      }
      
      while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
        if (this.peek().type === TOKEN.PIPE) {
          cells.push(cell.trim());
          cell = '';
          this.advance();
        } else {
          cell += this.advance().value;
        }
      }
      
      // Add last cell if not empty (unless it's a trailing empty cell after a pipe)
      if (cell.trim()) {
        cells.push(cell.trim());
      } else if (cells.length === 0) {
        // Single cell that might be empty
        cells.push(cell.trim());
      }
      
      return cells;
    };
    
    // Parse first row
    const firstRow = parseRow();
    if (firstRow.length === 0 || firstRow.length === 1) {
      this.pos = start;
      return false;
    }
    this.consume(TOKEN.NEWLINE);
    
    // Check for separator row
    const sepStart = this.pos;
    const sepRow = parseRow();
    
    // Check if this is a valid separator
    let isValidSep = true;
    alignments = [];
    
    for (const cell of sepRow) {
      let trimmed = cell.trim();
      let align = 'left';
      
      // Check alignment markers
      if (trimmed.startsWith(':')) {
        trimmed = trimmed.substring(1);
        if (trimmed.endsWith(':')) {
          trimmed = trimmed.substring(0, trimmed.length - 1);
          align = 'center';
        } else {
          align = 'left';
        }
      } else if (trimmed.endsWith(':')) {
        trimmed = trimmed.substring(0, trimmed.length - 1);
        align = 'right';
      }
      
      // Check if it's all dashes
      let allDashes = true;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] !== '-') {
          allDashes = false;
          break;
        }
      }
      
      if (!allDashes || trimmed.length === 0) {
        isValidSep = false;
        break;
      }
      
      alignments.push(align);
    }
    
    if (!isValidSep) {
      this.pos = start;
      return false;
    }
    
    this.consume(TOKEN.NEWLINE);
    rows.push(firstRow);
    
    // Parse body rows
    while (this.pos < this.tokens.length) {
      const rowStart = this.pos;
      
      // Check if line contains pipes
      let hasPipe = false;
      let tempPos = this.pos;
      while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
        if (this.peek().type === TOKEN.PIPE) {
          hasPipe = true;
          break;
        }
        this.advance();
      }
      this.pos = tempPos;
      
      if (!hasPipe) {
        break;
      }
      
      const row = parseRow();
      if (row.length === 0) {
        this.pos = rowStart;
        break;
      }
      
      rows.push(row);
      this.consume(TOKEN.NEWLINE);
    }
    
    // Generate table HTML
    let html = `<table${this.getAttr('table')}>`;
    
    // Header
    if (rows.length > 0) {
      html += '\n<thead>\n<tr>';
      for (let i = 0; i < rows[0].length; i++) {
        const align = alignments && alignments[i] !== 'left' 
          ? ` style="text-align:${alignments[i]}"` 
          : '';
        html += `\n<th${this.getAttr('th')}${align}>${this.parseInline(rows[0][i])}</th>`;
      }
      html += '\n</tr>\n</thead>';
    }
    
    // Body
    if (rows.length > 1) {
      html += '\n<tbody>';
      for (let r = 1; r < rows.length; r++) {
        html += '\n<tr>';
        for (let i = 0; i < rows[r].length; i++) {
          const align = alignments && alignments[i] !== 'left' 
            ? ` style="text-align:${alignments[i]}"` 
            : '';
          html += `\n<td${this.getAttr('td')}${align}>${this.parseInline(rows[r][i])}</td>`;
        }
        html += '\n</tr>';
      }
      html += '\n</tbody>';
    }
    
    html += '\n</table>';
    this.output.push(html);
    return true;
  }

  parseParagraph() {
    const lines = [];
    
    // Collect paragraph lines
    while (this.pos < this.tokens.length) {
      // Check if this starts a new block type
      const savedPos = this.pos;
      
      // Check for block starters
      if (this.peek().type === TOKEN.HASH ||
          this.peek().type === TOKEN.GT ||
          (this.peek().type === TOKEN.BACKTICK && this.peek(1).type === TOKEN.BACKTICK && this.peek(2).type === TOKEN.BACKTICK) ||
          (this.peek().type === TOKEN.TILDE && this.peek(1).type === TOKEN.TILDE && this.peek(2).type === TOKEN.TILDE)) {
        break;
      }
      
      // Check for table (but need to verify it's valid)
      if (this.peek().type === TOKEN.PIPE) {
        // Don't break - let parseParagraph handle lines with pipes that aren't tables
        // Tables will be caught by parseTable in parseBlock
      }
      
      // Check for list or hr
      if (this.peek().type === TOKEN.STAR || 
          this.peek().type === TOKEN.MINUS || 
          this.peek().type === TOKEN.PLUS ||
          this.peek().type === TOKEN.UNDERSCORE) {
        // Could be list or HR, need to check
        let tempPos = this.pos;
        let count = 0;
        const firstType = this.peek().type;
        
        // Count consecutive markers
        while (this.peek().type === firstType || this.peek().type === TOKEN.SPACE) {
          if (this.peek().type === firstType) count++;
          this.advance();
        }
        
        this.pos = tempPos;
        
        // If 3+ of same char with spaces/newline after, it's HR
        if (count >= 3 && (this.peek(count).type === TOKEN.NEWLINE || this.peek(count).type === TOKEN.EOF)) {
          break;
        }
        
        // Check if it's a list
        if (this.peek(1).type === TOKEN.SPACE) {
          break;
        }
      }
      
      // Check for ordered list
      if (this.peek().type === TOKEN.DIGIT) {
        let tempPos = this.pos;
        while (this.peek().type === TOKEN.DIGIT) {
          this.advance();
        }
        if (this.peek().type === TOKEN.DOT && this.peek(1).type === TOKEN.SPACE) {
          this.pos = tempPos;
          break;
        }
        this.pos = tempPos;
      }
      
      // Check for blank line (paragraph break)
      if (this.peek().type === TOKEN.NEWLINE) {
        if (lines.length === 0) {
          this.advance();
          continue;
        }
        // Check if next line is also blank
        if (this.peek(1).type === TOKEN.NEWLINE || this.peek(1).type === TOKEN.EOF) {
          break;
        }
      }
      
      // Collect line content
      let line = '';
      while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
        line += this.advance().value;
      }
      
      if (line.trim()) {
        lines.push(line);
      }
      
      // Consume newline
      if (this.peek().type === TOKEN.NEWLINE) {
        this.advance();
      } else {
        break; // EOF
      }
    }
    
    if (lines.length > 0) {
      let content = '';
      
      if (this.opts.lazy_linefeeds) {
        // Join lines with <br> tags
        content = lines.map((line, idx) => {
          const processed = this.parseInline(line);
          return idx < lines.length - 1 
            ? processed + `<br${this.getAttr('br')}>` 
            : processed;
        }).join('');
      } else {
        content = this.parseInline(lines.join('\n'));
      }
      
      this.output.push(`<p${this.getAttr('p')}>${content}</p>`);
    }
  }

  parseInline(text) {
    // Convert text to tokens for inline parsing
    const tokenizer = new Tokenizer(text);
    const tokens = Array.from(tokenizer.tokenize());
    
    let result = '';
    let pos = 0;
    
    while (pos < tokens.length && tokens[pos].type !== TOKEN.EOF) {
      const token = tokens[pos];
      
      // Check for inline patterns
      if (token.type === TOKEN.STAR) {
        // Check for bold (**) or italic (*)
        if (tokens[pos + 1] && tokens[pos + 1].type === TOKEN.STAR) {
          // Look for closing **
          let end = pos + 2;
          let content = '';
          while (end < tokens.length - 1) {
            if (tokens[end].type === TOKEN.STAR && tokens[end + 1].type === TOKEN.STAR) {
              // Found closing
              result += `<strong${this.getAttr('strong')}${this.dataQd('**')}>${this.parseInline(content)}</strong>`;
              pos = end + 2;
              break;
            }
            content += tokens[end].value;
            end++;
          }
          if (end >= tokens.length - 1) {
            // No closing found
            result += token.value;
            pos++;
          }
        } else {
          // Single star - look for closing
          let end = pos + 1;
          let content = '';
          while (end < tokens.length) {
            if (tokens[end].type === TOKEN.STAR) {
              // Found closing
              result += `<em${this.getAttr('em')}${this.dataQd('*')}>${this.parseInline(content)}</em>`;
              pos = end + 1;
              break;
            }
            content += tokens[end].value;
            end++;
          }
          if (end >= tokens.length) {
            // No closing found
            result += token.value;
            pos++;
          }
        }
      }
      else if (token.type === TOKEN.UNDERSCORE) {
        // Check for bold (__) or italic (_)
        if (tokens[pos + 1] && tokens[pos + 1].type === TOKEN.UNDERSCORE) {
          // Look for closing __
          let end = pos + 2;
          let content = '';
          while (end < tokens.length - 1) {
            if (tokens[end].type === TOKEN.UNDERSCORE && tokens[end + 1].type === TOKEN.UNDERSCORE) {
              result += `<strong${this.getAttr('strong')}>${this.parseInline(content)}</strong>`;
              pos = end + 2;
              break;
            }
            content += tokens[end].value;
            end++;
          }
          if (end >= tokens.length - 1) {
            result += token.value;
            pos++;
          }
        } else {
          // Single underscore
          let end = pos + 1;
          let content = '';
          while (end < tokens.length) {
            if (tokens[end].type === TOKEN.UNDERSCORE) {
              result += `<em${this.getAttr('em')}>${this.parseInline(content)}</em>`;
              pos = end + 1;
              break;
            }
            content += tokens[end].value;
            end++;
          }
          if (end >= tokens.length) {
            result += token.value;
            pos++;
          }
        }
      }
      else if (token.type === TOKEN.TILDE) {
        // Check for strikethrough (~~)
        if (tokens[pos + 1] && tokens[pos + 1].type === TOKEN.TILDE) {
          let end = pos + 2;
          let content = '';
          while (end < tokens.length - 1) {
            if (tokens[end].type === TOKEN.TILDE && tokens[end + 1].type === TOKEN.TILDE) {
              result += `<del${this.getAttr('del')}>${this.parseInline(content)}</del>`;
              pos = end + 2;
              break;
            }
            content += tokens[end].value;
            end++;
          }
          if (end >= tokens.length - 1) {
            result += token.value;
            pos++;
          }
        } else {
          result += token.value;
          pos++;
        }
      }
      else if (token.type === TOKEN.BACKTICK) {
        // Inline code
        let end = pos + 1;
        let content = '';
        while (end < tokens.length) {
          if (tokens[end].type === TOKEN.BACKTICK) {
            result += `<code${this.getAttr('code')}>${this.escapeHtml(content)}</code>`;
            pos = end + 1;
            break;
          }
          content += tokens[end].value;
          end++;
        }
        if (end >= tokens.length) {
          result += token.value;
          pos++;
        }
      }
      else if (token.type === TOKEN.LBRACKET) {
        // Check for link or image
        if (pos > 0 && tokens[pos - 1] && tokens[pos - 1].type === TOKEN.BANG) {
          // Already handled as image
          result += token.value;
          pos++;
        } else {
          // Look for closing bracket and parentheses
          let end = pos + 1;
          let linkText = '';
          while (end < tokens.length && tokens[end].type !== TOKEN.RBRACKET) {
            linkText += tokens[end].value;
            end++;
          }
          
          if (end < tokens.length && tokens[end].type === TOKEN.RBRACKET) {
            end++;
            if (end < tokens.length && tokens[end].type === TOKEN.LPAREN) {
              end++;
              let url = '';
              while (end < tokens.length && tokens[end].type !== TOKEN.RPAREN) {
                url += tokens[end].value;
                end++;
              }
              
              if (end < tokens.length && tokens[end].type === TOKEN.RPAREN) {
                // Valid link
                const href = this.sanitizeUrl(url);
                const rel = href.startsWith('http') ? ' rel="noopener noreferrer"' : '';
                result += `<a${this.getAttr('a')} href="${href}"${rel}>${this.parseInline(linkText)}</a>`;
                pos = end + 1;
              } else {
                result += token.value;
                pos++;
              }
            } else {
              result += token.value;
              pos++;
            }
          } else {
            result += token.value;
            pos++;
          }
        }
      }
      else if (token.type === TOKEN.BANG) {
        // Check for image
        if (tokens[pos + 1] && tokens[pos + 1].type === TOKEN.LBRACKET) {
          pos++; // Skip !
          let end = pos + 1;
          let altText = '';
          while (end < tokens.length && tokens[end].type !== TOKEN.RBRACKET) {
            altText += tokens[end].value;
            end++;
          }
          
          if (end < tokens.length && tokens[end].type === TOKEN.RBRACKET) {
            end++;
            if (end < tokens.length && tokens[end].type === TOKEN.LPAREN) {
              end++;
              let url = '';
              while (end < tokens.length && tokens[end].type !== TOKEN.RPAREN) {
                url += tokens[end].value;
                end++;
              }
              
              if (end < tokens.length && tokens[end].type === TOKEN.RPAREN) {
                // Valid image
                const src = this.sanitizeUrl(url);
                result += `<img${this.getAttr('img')} src="${src}" alt="${this.escapeHtml(altText)}">`;
                pos = end + 1;
              } else {
                result += '!' + tokens[pos].value;
                pos++;
              }
            } else {
              result += '!' + tokens[pos].value;
              pos++;
            }
          } else {
            result += token.value;
            pos++;
          }
        } else {
          result += token.value;
          pos++;
        }
      }
      else if (token.type === TOKEN.LT) {
        // Check for autolink
        let end = pos + 1;
        let url = '';
        while (end < tokens.length && tokens[end].type !== TOKEN.GT) {
          url += tokens[end].value;
          end++;
        }
        
        if (end < tokens.length && tokens[end].type === TOKEN.GT) {
          // Check if it looks like a URL
          if (url.includes('://')) {
            const href = this.sanitizeUrl(url);
            result += `<a${this.getAttr('a')} href="${href}" rel="noopener noreferrer">${url}</a>`;
            pos = end + 1;
          } else {
            result += this.escapeHtml(token.value);
            pos++;
          }
        } else {
          result += this.escapeHtml(token.value);
          pos++;
        }
      }
      else {
        // Regular text or other tokens
        if (token.type === TOKEN.TEXT || 
            token.type === TOKEN.SPACE || 
            token.type === TOKEN.TAB ||
            token.type === TOKEN.DIGIT ||
            token.type === TOKEN.DOT) {
          result += this.escapeHtml(token.value);
        } else {
          result += this.escapeHtml(token.value);
        }
        pos++;
      }
    }
    
    return result;
  }
}

// ===========================================================================
// MAIN FUNCTION
// ===========================================================================
function quikdown_lex(markdown, options = {}) {
  if (!markdown || typeof markdown !== 'string') return '';
  
  const tokenizer = new Tokenizer(markdown);
  const tokens = tokenizer.tokenize();
  const parser = new Parser(tokens, options);
  
  return parser.parse();
}

// Export version (injected at build time)
quikdown_lex.version = typeof __QUIKDOWN_VERSION__ !== 'undefined' ? __QUIKDOWN_VERSION__ : '1.0.6';

// Export emitStyles
quikdown_lex.emitStyles = function(prefix = 'quikdown-', theme = 'light') {
  let css = '';
  
  for (const [tag, style] of Object.entries(STYLES)) {
    if (style) {
      css += `.${prefix}${tag} { ${style} }\n`;
    }
  }
  
  return css;
};

// Export configure
quikdown_lex.configure = function(options) {
  return function(markdown) {
    return quikdown_lex(markdown, options);
  };
};

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
}

if (typeof window !== 'undefined') {
  window.quikdown_lex = quikdown_lex;
}

export default quikdown_lex;