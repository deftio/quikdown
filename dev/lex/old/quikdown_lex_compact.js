/**
 * quikdown_lex - Compact grammar-based markdown parser
 * @version __QUIKDOWN_VERSION__
 */

// ===========================================================================
// CONSTANTS & HELPERS
// ===========================================================================
const TOKEN = {};
'STAR UNDERSCORE BACKTICK TILDE HASH PIPE MINUS PLUS EQUALS GT LT BANG LBRACKET RBRACKET LPAREN RPAREN COLON SPACE TAB NEWLINE DOT DIGIT TEXT EOF'.split(' ').forEach(t => TOKEN[t] = t);

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

// Character to token type mapping
const CHAR_TOKENS = {
  '*': 'STAR', '_': 'UNDERSCORE', '`': 'BACKTICK', '~': 'TILDE',
  '#': 'HASH', '|': 'PIPE', '-': 'MINUS', '+': 'PLUS', '=': 'EQUALS',
  '>': 'GT', '<': 'LT', '!': 'BANG', '[': 'LBRACKET', ']': 'RBRACKET',
  '(': 'LPAREN', ')': 'RPAREN', ':': 'COLON', ' ': 'SPACE',
  '\t': 'TAB', '\n': 'NEWLINE', '.': 'DOT'
};

const SPECIAL_CHARS = '*_`~#|-+=><![](): \t\n.';
const ESC_MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};

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

  makeToken(type, value, line, col) {
    return { type, value, line, col };
  }

  *tokenize() {
    while (this.pos < this.input.length) {
      const token = this.nextToken();
      if (token) yield token;
    }
    yield this.makeToken(TOKEN.EOF, '', this.line, this.col);
  }

  nextToken() {
    const char = this.peek();
    const startLine = this.line;
    const startCol = this.col;

    // Check single-char tokens
    const tokenType = CHAR_TOKENS[char];
    if (tokenType) {
      this.advance();
      return this.makeToken(TOKEN[tokenType], char, startLine, startCol);
    }

    // Check digits
    if (char >= '0' && char <= '9') {
      this.advance();
      return this.makeToken(TOKEN.DIGIT, char, startLine, startCol);
    }

    // Collect text
    let text = '';
    while (this.pos < this.input.length) {
      const c = this.peek();
      if (SPECIAL_CHARS.includes(c) || (c >= '0' && c <= '9')) break;
      text += this.advance();
    }

    if (text) {
      return this.makeToken(TOKEN.TEXT, text, startLine, startCol);
    }

    // Unknown character, skip
    this.advance();
    return null;
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
    return this.peek().type === type ? this.advance() : null;
  }

  consumeSequence(...types) {
    const matches = types.every((t, i) => this.peek(i).type === t);
    if (matches) types.forEach(() => this.advance());
    return matches;
  }

  consumeWhile(type) {
    let count = 0;
    while (this.peek().type === type) {
      this.advance();
      count++;
    }
    return count;
  }

  collectUntil(...stopTypes) {
    let result = '';
    while (!stopTypes.includes(this.peek().type)) {
      result += this.advance().value;
    }
    return result;
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
    return this.opts.bidirectional ? ` data-qd="${this.escapeHtml(marker)}"` : '';
  }

  escapeHtml(text) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      result += ESC_MAP[char] || char;
    }
    return result;
  }

  sanitizeUrl(url) {
    if (this.opts.allow_unsafe_urls) return url;
    const lower = url.toLowerCase().trim();
    if (lower.startsWith('javascript:') || lower.startsWith('data:text/html') || lower.startsWith('vbscript:')) {
      return '#';
    }
    return url;
  }

  parse() {
    while (this.peek().type !== TOKEN.EOF) {
      if (!this.parseBlock()) {
        this.advance();
      }
    }
    return this.output.join('');
  }

  parseBlock() {
    // Skip empty lines
    if (this.peek().type === TOKEN.NEWLINE) {
      this.advance();
      return true;
    }

    return this.parseHeading() ||
           this.parseFence() ||
           this.parseHR() ||
           this.parseBlockquote() ||
           this.parseList() ||
           this.parseTable() ||
           this.parseParagraph();
  }

  parseHeading() {
    if (this.peek().type !== TOKEN.HASH) return false;

    const start = this.pos;
    const level = this.consumeWhile(TOKEN.HASH);

    if (level > 6 || this.peek().type !== TOKEN.SPACE) {
      this.pos = start;
      return false;
    }

    this.advance(); // consume space
    const content = this.collectUntil(TOKEN.NEWLINE, TOKEN.EOF);
    this.consume(TOKEN.NEWLINE);

    const tag = `h${level}`;
    const bidAttr = this.dataQd('#'.repeat(level));
    const processed = this.parseInline(content);
    this.output.push(`<${tag}${this.getAttr(tag)}${bidAttr}>${processed}</${tag}>`);
    return true;
  }

  parseFence() {
    if (this.peek().type !== TOKEN.BACKTICK) return false;

    const start = this.pos;
    const fenceCount = this.consumeWhile(TOKEN.BACKTICK);

    if (fenceCount < 3) {
      this.pos = start;
      return false;
    }

    // Get language
    const lang = this.collectUntil(TOKEN.NEWLINE, TOKEN.EOF).trim();
    this.consume(TOKEN.NEWLINE);

    // Collect code until closing fence
    let code = '';
    let lineStart = true;

    while (this.peek().type !== TOKEN.EOF) {
      if (lineStart && this.peek().type === TOKEN.BACKTICK) {
        const tempPos = this.pos;
        const closeCount = this.consumeWhile(TOKEN.BACKTICK);
        if (closeCount >= fenceCount) {
          this.consumeWhile(TOKEN.NEWLINE);
          break;
        }
        this.pos = tempPos;
        code += this.advance().value;
        lineStart = false;
      } else {
        const token = this.advance();
        code += token.value;
        lineStart = (token.type === TOKEN.NEWLINE);
      }
    }

    // Process with fence plugin if available
    let output = this.opts.fence_plugin ? this.opts.fence_plugin(code, lang) : undefined;

    if (output === undefined || output === null) {
      const langAttr = !this.opts.inline_styles && lang ? ` class="language-${lang}"` : '';
      const codeAttr = this.opts.inline_styles ? this.getAttr('code') : langAttr;
      output = `<pre${this.getAttr('pre')}><code${codeAttr}>${this.escapeHtml(code)}</code></pre>`;
    }

    this.output.push(output);
    return true;
  }

  parseHR() {
    const start = this.pos;
    const type = this.peek().type;

    if (type !== TOKEN.MINUS && type !== TOKEN.STAR && type !== TOKEN.UNDERSCORE) {
      return false;
    }

    let count = 0;
    let spaceCount = 0;

    while (this.peek().type === type || this.peek().type === TOKEN.SPACE) {
      if (this.peek().type === type) count++;
      else spaceCount++;
      this.advance();
    }

    if (count >= 3 && (this.peek().type === TOKEN.NEWLINE || this.peek().type === TOKEN.EOF)) {
      this.consume(TOKEN.NEWLINE);
      this.output.push(`<hr${this.getAttr('hr')}/>`);
      return true;
    }

    this.pos = start;
    return false;
  }

  parseBlockquote() {
    if (this.peek().type !== TOKEN.GT) return false;

    const lines = [];

    do {
      this.advance(); // consume >
      this.consume(TOKEN.SPACE); // optional space
      lines.push(this.collectUntil(TOKEN.NEWLINE, TOKEN.EOF));
      this.consume(TOKEN.NEWLINE);
    } while (this.peek().type === TOKEN.GT);

    const nestedContent = lines.join('\n');
    const processed = quikdown_lex(nestedContent, this.opts);
    this.output.push(`<blockquote${this.getAttr('blockquote')}>${processed}</blockquote>`);
    return true;
  }

  parseList() {
    const start = this.pos;
    const indent = this.consumeWhile(TOKEN.SPACE) + (this.consumeWhile(TOKEN.TAB) * 4);

    // Check for list marker
    let isOrdered = false;
    let markerType = this.peek().type;

    if (markerType === TOKEN.STAR || markerType === TOKEN.MINUS || markerType === TOKEN.PLUS) {
      this.advance();
    } else if (markerType === TOKEN.DIGIT) {
      const num = this.collectDigits();
      if (this.consume(TOKEN.DOT)) {
        isOrdered = true;
      } else {
        this.pos = start;
        return false;
      }
    } else {
      this.pos = start;
      return false;
    }

    // Require space after marker
    if (!this.consume(TOKEN.SPACE)) {
      this.pos = start;
      return false;
    }

    // Parse list items
    const listType = isOrdered ? 'ol' : 'ul';
    const items = [];

    // Parse first item
    items.push(this.collectUntil(TOKEN.NEWLINE, TOKEN.EOF));
    this.consume(TOKEN.NEWLINE);

    // Parse additional items
    while (this.parseListItem(isOrdered, markerType)) {
      items.push(this.collectUntil(TOKEN.NEWLINE, TOKEN.EOF));
      this.consume(TOKEN.NEWLINE);
    }

    // Generate HTML
    let html = `<${listType}${this.getAttr(listType)}>`;
    for (const item of items) {
      const taskHtml = this.parseTaskItem(item, isOrdered);
      if (taskHtml) {
        html += taskHtml;
      } else {
        const processed = this.parseInline(item);
        html += `<li${this.getAttr('li')}>${processed}</li>`;
      }
    }
    html += `</${listType}>`;

    this.output.push(html);
    return true;
  }

  parseListItem(isOrdered, markerType) {
    const itemStart = this.pos;
    this.consumeWhile(TOKEN.SPACE);
    this.consumeWhile(TOKEN.TAB);

    if (!isOrdered) {
      if (this.peek().type === markerType) {
        this.advance();
        return this.consume(TOKEN.SPACE);
      }
    } else if (this.peek().type === TOKEN.DIGIT) {
      this.collectDigits();
      if (this.consume(TOKEN.DOT)) {
        return this.consume(TOKEN.SPACE);
      }
    }

    this.pos = itemStart;
    return false;
  }

  parseTaskItem(item, isOrdered) {
    if (isOrdered || !item.startsWith('[') || item.length <= 3) return null;
    if ((item[1] !== 'x' && item[1] !== 'X' && item[1] !== ' ') || item[2] !== ']') return null;

    const checked = item[1].toLowerCase() === 'x';
    const checkboxAttr = this.opts.inline_styles
      ? ' style="margin-right:.5em"'
      : ` class="${this.opts.class_prefix}task-checkbox"`;
    const itemAttr = this.opts.inline_styles
      ? ' style="list-style:none"'
      : ` class="${this.opts.class_prefix}task-item"`;

    const checkbox = `<input type="checkbox"${checkboxAttr}${checked ? ' checked' : ''} disabled>`;
    const content = this.parseInline(item.substring(3).trim());
    return `<li${this.getAttr('li')}${itemAttr}>${checkbox}${content}</li>`;
  }

  collectDigits() {
    let num = '';
    while (this.peek().type === TOKEN.DIGIT) {
      num += this.advance().value;
    }
    return num;
  }

  parseTable() {
    const start = this.pos;
    const firstRow = this.parseTableRow();

    if (!firstRow || firstRow.length === 0) {
      this.pos = start;
      return false;
    }

    // Check for separator row
    if (!this.parseTableSeparator(firstRow.length)) {
      this.pos = start;
      return false;
    }

    // Parse data rows
    const rows = [];
    let row;
    while ((row = this.parseTableRow()) && row.length > 0) {
      rows.push(row);
    }

    // Generate table HTML
    let html = `<table${this.getAttr('table')}>`;
    html += '<thead><tr>';
    for (const cell of firstRow) {
      html += `<th${this.getAttr('th')}>${this.parseInline(cell)}</th>`;
    }
    html += '</tr></thead>';

    if (rows.length > 0) {
      html += '<tbody>';
      for (const row of rows) {
        html += '<tr>';
        for (let i = 0; i < firstRow.length; i++) {
          const cell = row[i] || '';
          html += `<td${this.getAttr('td')}>${this.parseInline(cell)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody>';
    }
    html += '</table>';

    this.output.push(html);
    return true;
  }

  parseTableRow() {
    const cells = [];
    let cell = '';
    let hasContent = false;

    // Skip leading pipe if present
    this.consume(TOKEN.PIPE);

    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      if (this.peek().type === TOKEN.PIPE) {
        cells.push(cell.trim());
        cell = '';
        this.advance();
        // Check if this is trailing pipe before newline
        if (this.peek().type === TOKEN.NEWLINE || this.peek().type === TOKEN.EOF) {
          break;
        }
      } else {
        const token = this.advance();
        cell += token.value;
        if (token.type !== TOKEN.SPACE && token.type !== TOKEN.TAB) {
          hasContent = true;
        }
      }
    }

    // Add last cell if not empty (unless it's a trailing empty after pipe)
    if (cell.trim() || cells.length === 0) {
      cells.push(cell.trim());
    }

    this.consume(TOKEN.NEWLINE);
    return hasContent ? cells : null;
  }

  parseTableSeparator(columnCount) {
    const start = this.pos;
    let validColumns = 0;

    // Skip leading pipe if present
    this.consume(TOKEN.PIPE);

    for (let i = 0; i < columnCount; i++) {
      // Skip spaces
      this.consumeWhile(TOKEN.SPACE);
      this.consumeWhile(TOKEN.TAB);

      // Check for optional colon (alignment)
      const hasLeftColon = this.consume(TOKEN.COLON);

      // Require at least 3 minus signs
      const minusCount = this.consumeWhile(TOKEN.MINUS);
      if (minusCount < 3) {
        this.pos = start;
        return false;
      }

      // Check for optional colon (alignment)
      this.consume(TOKEN.COLON);

      // Skip spaces
      this.consumeWhile(TOKEN.SPACE);
      this.consumeWhile(TOKEN.TAB);

      validColumns++;

      // Check for pipe separator
      if (i < columnCount - 1) {
        if (!this.consume(TOKEN.PIPE)) {
          break;
        }
      } else {
        // Optional trailing pipe
        this.consume(TOKEN.PIPE);
      }
    }

    // Must end with newline or EOF
    if (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      this.pos = start;
      return false;
    }

    this.consume(TOKEN.NEWLINE);
    return validColumns === columnCount;
  }

  parseParagraph() {
    let content = '';
    let hasContent = false;

    while (this.peek().type !== TOKEN.NEWLINE && this.peek().type !== TOKEN.EOF) {
      // Check for block-level elements
      if (this.looksLikeBlockElement()) {
        break;
      }

      const token = this.advance();
      content += token.value;
      if (token.type !== TOKEN.SPACE && token.type !== TOKEN.TAB) {
        hasContent = true;
      }
    }

    this.consume(TOKEN.NEWLINE);

    if (hasContent) {
      const processed = this.parseInline(content.trim());
      if (processed) {
        this.output.push(`<p${this.getAttr('p')}>${processed}</p>`);
      }
    }

    return true;
  }

  looksLikeBlockElement() {
    const type = this.peek().type;
    const next = this.peek(1).type;

    // Check for heading
    if (type === TOKEN.HASH && next === TOKEN.SPACE) return true;

    // Check for HR
    if ((type === TOKEN.MINUS || type === TOKEN.STAR || type === TOKEN.UNDERSCORE) &&
        (next === type || next === TOKEN.SPACE)) {
      const tempPos = this.pos;
      let count = 0;
      while (this.peek().type === type || this.peek().type === TOKEN.SPACE) {
        if (this.peek().type === type) count++;
        this.advance();
      }
      const isHR = count >= 3 && (this.peek().type === TOKEN.NEWLINE || this.peek().type === TOKEN.EOF);
      this.pos = tempPos;
      return isHR;
    }

    // Check for fence
    if (type === TOKEN.BACKTICK && this.peek(1).type === TOKEN.BACKTICK && this.peek(2).type === TOKEN.BACKTICK) {
      return true;
    }

    // Check for blockquote
    if (type === TOKEN.GT) return true;

    // Check for list
    if ((type === TOKEN.STAR || type === TOKEN.MINUS || type === TOKEN.PLUS) && next === TOKEN.SPACE) {
      return true;
    }

    if (type === TOKEN.DIGIT && next === TOKEN.DOT) return true;

    return false;
  }

  parseInline(text) {
    const tokenizer = new Tokenizer(text);
    const tokens = Array.from(tokenizer.tokenize());
    const parser = new InlineParser(tokens, this.opts);
    return parser.parse();
  }
}

// ===========================================================================
// INLINE PARSER
// ===========================================================================
class InlineParser {
  constructor(tokens, opts) {
    this.tokens = tokens;
    this.pos = 0;
    this.opts = opts;
    this.output = [];
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || { type: TOKEN.EOF };
  }

  advance() {
    return this.tokens[this.pos++];
  }

  consume(type) {
    return this.peek().type === type ? this.advance() : null;
  }

  countSequence(type) {
    let count = 0;
    for (let i = 0; this.peek(i).type === type; i++) count++;
    return count;
  }

  dataQd(marker) {
    return this.opts.bidirectional ? ` data-qd="${this.escapeHtml(marker)}"` : '';
  }

  escapeHtml(text) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      result += ESC_MAP[char] || char;
    }
    return result;
  }

  getAttr(tag) {
    if (this.opts.inline_styles) {
      const style = STYLES[tag] || '';
      return style ? ` style="${style}"` : '';
    }
    return ` class="${this.opts.class_prefix}${tag}"`;
  }

  sanitizeUrl(url) {
    if (this.opts.allow_unsafe_urls) return url;
    const lower = url.toLowerCase().trim();
    if (lower.startsWith('javascript:') || lower.startsWith('data:text/html') || lower.startsWith('vbscript:')) {
      return '#';
    }
    return url;
  }

  parse() {
    while (this.peek().type !== TOKEN.EOF) {
      if (!this.parseInlineElement()) {
        const token = this.advance();
        this.output.push(this.escapeHtml(token.value));
      }
    }
    return this.output.join('');
  }

  parseInlineElement() {
    const type = this.peek().type;
    const next = this.peek(1).type;

    // Check for inline code
    if (type === TOKEN.BACKTICK) {
      return this.parseInlineCode();
    }

    // Check for links and images
    if (type === TOKEN.BANG && next === TOKEN.LBRACKET) {
      return this.parseImage();
    }
    if (type === TOKEN.LBRACKET) {
      return this.parseLink();
    }

    // Check for emphasis markers
    if (type === TOKEN.STAR || type === TOKEN.UNDERSCORE) {
      return this.parseEmphasis(type);
    }

    // Check for strikethrough
    if (type === TOKEN.TILDE && next === TOKEN.TILDE) {
      return this.parseStrikethrough();
    }

    // Check for line break
    if (type === TOKEN.SPACE && next === TOKEN.SPACE) {
      return this.parseLineBreak();
    }

    // Lazy linefeeds
    if (this.opts.lazy_linefeeds && type === TOKEN.NEWLINE) {
      this.advance();
      this.output.push(`<br${this.getAttr('br')}/>`);
      return true;
    }

    return false;
  }

  parseEmphasis(markerType) {
    const count = this.countSequence(markerType);
    if (count < 1) return false;

    const start = this.pos;

    // Try bold (2+ markers)
    if (count >= 2) {
      this.advance();
      this.advance();
      const content = this.collectEmphasisContent(markerType, 2);
      if (content !== null) {
        const marker = markerType === TOKEN.STAR ? '**' : '__';
        const processed = new InlineParser(new Tokenizer(content).tokenize(), this.opts).parse();
        this.output.push(`<strong${this.getAttr('strong')}${this.dataQd(marker)}>${processed}</strong>`);
        return true;
      }
      this.pos = start;
    }

    // Try italic (1 marker)
    if (count >= 1) {
      this.advance();
      const content = this.collectEmphasisContent(markerType, 1);
      if (content !== null) {
        const marker = markerType === TOKEN.STAR ? '*' : '_';
        const processed = new InlineParser(new Tokenizer(content).tokenize(), this.opts).parse();
        this.output.push(`<em${this.getAttr('em')}${this.dataQd(marker)}>${processed}</em>`);
        return true;
      }
      this.pos = start;
    }

    return false;
  }

  collectEmphasisContent(markerType, requiredCount) {
    let content = '';
    let foundEnd = false;

    while (this.peek().type !== TOKEN.EOF) {
      if (this.peek().type === markerType) {
        const closeCount = this.countSequence(markerType);
        if (closeCount >= requiredCount) {
          for (let i = 0; i < requiredCount; i++) this.advance();
          foundEnd = true;
          break;
        }
      }
      content += this.advance().value;
    }

    return foundEnd ? content : null;
  }

  parseStrikethrough() {
    if (!this.consume(TOKEN.TILDE) || !this.consume(TOKEN.TILDE)) {
      return false;
    }

    let content = '';
    let foundEnd = false;

    while (this.peek().type !== TOKEN.EOF) {
      if (this.peek().type === TOKEN.TILDE && this.peek(1).type === TOKEN.TILDE) {
        this.advance();
        this.advance();
        foundEnd = true;
        break;
      }
      content += this.advance().value;
    }

    if (foundEnd) {
      const processed = new InlineParser(new Tokenizer(content).tokenize(), this.opts).parse();
      this.output.push(`<del${this.getAttr('del')}${this.dataQd('~~')}>${processed}</del>`);
      return true;
    }

    return false;
  }

  parseInlineCode() {
    const start = this.pos;
    const openCount = this.countSequence(TOKEN.BACKTICK);
    
    for (let i = 0; i < openCount; i++) this.advance();

    let code = '';
    let foundEnd = false;

    while (this.peek().type !== TOKEN.EOF) {
      if (this.peek().type === TOKEN.BACKTICK) {
        const closeCount = this.countSequence(TOKEN.BACKTICK);
        if (closeCount === openCount) {
          for (let i = 0; i < openCount; i++) this.advance();
          foundEnd = true;
          break;
        }
      }
      code += this.advance().value;
    }

    if (foundEnd) {
      const marker = '`'.repeat(openCount);
      this.output.push(`<code${this.getAttr('code')}${this.dataQd(marker)}>${this.escapeHtml(code)}</code>`);
      return true;
    }

    this.pos = start;
    return false;
  }

  parseLink() {
    const start = this.pos;

    if (!this.consume(TOKEN.LBRACKET)) return false;

    // Collect link text
    let linkText = '';
    while (this.peek().type !== TOKEN.RBRACKET && this.peek().type !== TOKEN.EOF) {
      linkText += this.advance().value;
    }

    if (!this.consume(TOKEN.RBRACKET) || !this.consume(TOKEN.LPAREN)) {
      this.pos = start;
      return false;
    }

    // Collect URL
    let url = '';
    while (this.peek().type !== TOKEN.RPAREN && this.peek().type !== TOKEN.EOF) {
      url += this.advance().value;
    }

    if (!this.consume(TOKEN.RPAREN)) {
      this.pos = start;
      return false;
    }

    const processedText = new InlineParser(new Tokenizer(linkText).tokenize(), this.opts).parse();
    const safeUrl = this.sanitizeUrl(url.trim());
    this.output.push(`<a href="${this.escapeHtml(safeUrl)}"${this.getAttr('a')}>${processedText}</a>`);
    return true;
  }

  parseImage() {
    const start = this.pos;

    if (!this.consume(TOKEN.BANG) || !this.consume(TOKEN.LBRACKET)) {
      return false;
    }

    // Collect alt text
    let altText = '';
    while (this.peek().type !== TOKEN.RBRACKET && this.peek().type !== TOKEN.EOF) {
      altText += this.advance().value;
    }

    if (!this.consume(TOKEN.RBRACKET) || !this.consume(TOKEN.LPAREN)) {
      this.pos = start;
      return false;
    }

    // Collect URL
    let url = '';
    while (this.peek().type !== TOKEN.RPAREN && this.peek().type !== TOKEN.EOF) {
      url += this.advance().value;
    }

    if (!this.consume(TOKEN.RPAREN)) {
      this.pos = start;
      return false;
    }

    const safeUrl = this.sanitizeUrl(url.trim());
    this.output.push(`<img src="${this.escapeHtml(safeUrl)}" alt="${this.escapeHtml(altText)}"${this.getAttr('img')}/>`);
    return true;
  }

  parseLineBreak() {
    let spaceCount = 0;
    while (this.peek().type === TOKEN.SPACE) {
      this.advance();
      spaceCount++;
    }

    if (spaceCount >= 2 && this.peek().type === TOKEN.NEWLINE) {
      this.advance();
      this.output.push(`<br${this.getAttr('br')}/>`);
      return true;
    }

    // Put back the spaces
    for (let i = 0; i < spaceCount; i++) {
      this.output.push(' ');
    }
    return false;
  }
}

// ===========================================================================
// MAIN FUNCTION
// ===========================================================================
function quikdown_lex(markdown, options = {}) {
  if (typeof markdown !== 'string') return '';
  
  const tokenizer = new Tokenizer(markdown);
  const parser = new Parser(tokenizer.tokenize(), options);
  return parser.parse();
}

// API compatibility
quikdown_lex.version = '__QUIKDOWN_VERSION__';

quikdown_lex.emitStyles = function(theme = 'light') {
  const prefix = theme === 'dark' ? '.quikdown-dark ' : '.quikdown-light ';
  let css = '';
  
  for (const [tag, style] of Object.entries(STYLES)) {
    if (style) {
      css += `${prefix}.quikdown-${tag}{${style}}`;
    }
  }
  
  return css;
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return quikdown_lex; });
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}

export default quikdown_lex;