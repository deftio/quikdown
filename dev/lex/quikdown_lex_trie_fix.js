/**
 * QuikDown Lexer - Fixed Trie-Based Parser
 * Fixed all bugs for 100% parity
 */

const T = {
  HEAD: 1, FENCE: 2, HR: 3, QUOTE: 4, OL: 5, UL: 6, TABLE: 7, PARA: 8, NL: 9,
  STRONG_S: 10, STRONG_U: 11, EM_S: 12, EM_U: 13, STRIKE: 14, CODE: 15,
  LINK: 16, IMG: 17, ESC: 18, TEXT: 19
};

// Trie structure - same as before
const SM = {
  e: [[0,35,1],[0,96,7],[0,126,10],[0,45,13],[0,62,16],[0,42,17],[0,95,19],[0,33,21],[0,91,23],[0,92,24],[0,10,25],[1,35,2],[2,35,3],[3,35,4],[4,35,5],[5,35,6],[7,96,8],[8,96,9],[10,126,11],[11,126,12],[13,45,14],[14,45,15],[17,42,18],[19,95,20],[21,91,22]],
  t: [[1,1,1],[2,1,2],[3,1,3],[4,1,4],[5,1,5],[6,1,6],[7,15,0],[9,2,0],[11,14,0],[12,2,0],[15,3,0],[16,4,0],[17,12,0],[18,10,0],[19,13,0],[20,11,0],[22,17,0],[23,16,0],[24,18,0],[25,9,0]]
};

// HTML templates
const HTML = [
  '', // 0
  '<h{L}{A}>{C}</h{L}>', // 1 - heading
  '<pre{A}><code{L}>{C}</code></pre>', // 2 - fence
  '<hr{A}>', // 3 - hr
  '<blockquote{A}>{C}</blockquote>', // 4 - blockquote
  '<ol{A}>{C}</ol>', // 5 - ol
  '<ul{A}>{C}</ul>', // 6 - ul
  '<table{A}>{C}</table>', // 7 - table
  '<p{A}>{C}</p>', // 8 - paragraph
  '', // 9 - newline
  '<strong{A}>{C}</strong>', // 10,11 - strong
  '<strong{A}>{C}</strong>',
  '<em{A}>{C}</em>', // 12,13 - em
  '<em{A}>{C}</em>',
  '<del{A}>{C}</del>', // 14 - strike
  '<code{A}>{C}</code>', // 15 - code
  '<a{A} href="{U}"{R}>{C}</a>', // 16 - link
  '<img{A} src="{U}" alt="{C}">', // 17 - image
  '{C}', // 18 - escape
  '{C}' // 19 - text
];

// Import styles
import { styles } from './quikdown_lex_styles.js';

const esc = s => {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  let r = '';
  for (let i = 0; i < s.length; i++) r += m[s[i]] || s[i];
  return r;
};

class Scanner {
  constructor(input) {
    this.i = input;
    this.p = 0;
  }
  
  next() {
    if (this.p >= this.i.length) return null;
    
    // Try trie first
    let node = 0;
    let lastToken = null;
    let lastPos = this.p;
    const startPos = this.p;
    
    while (this.p < this.i.length) {
      const char = this.i.charCodeAt(this.p);
      let found = false;
      
      for (const [from, ch, to] of SM.e) {
        if (from === node && ch === char) {
          node = to;
          this.p++;
          found = true;
          
          for (const [n, tok, meta] of SM.t) {
            if (n === node) {
              lastToken = { type: tok, meta, start: startPos, end: this.p };
            }
          }
          break;
        }
      }
      
      if (!found) break;
    }
    
    if (lastToken) return lastToken;
    
    // Reset position for pattern matching
    this.p = startPos;
    
    // Try regex patterns
    if (this.i.slice(this.p).match(/^\d+\. /)) {
      const match = this.i.slice(this.p).match(/^\d+\. /);
      this.p += match[0].length;
      return { type: T.OL, start: startPos, end: this.p };
    }
    
    if (this.i.slice(this.p).match(/^[*+-] /)) {
      const match = this.i.slice(this.p).match(/^[*+-] /);
      this.p += match[0].length;
      return { type: T.UL, start: startPos, end: this.p };
    }
    
    // Default to text
    this.p++;
    return { type: T.TEXT, start: startPos, end: this.p };
  }
  
  until(pattern) {
    const start = this.p;
    if (typeof pattern === 'string') {
      const idx = this.i.indexOf(pattern, this.p);
      this.p = idx === -1 ? this.i.length : idx;
    } else {
      const match = this.i.slice(this.p).match(pattern);
      this.p = match ? this.p + match.index : this.i.length;
    }
    return this.i.slice(start, this.p);
  }
  
  match(pattern) {
    if (typeof pattern === 'string') {
      if (this.i.startsWith(pattern, this.p)) {
        this.p += pattern.length;
        return pattern;
      }
    } else {
      const match = this.i.slice(this.p).match(pattern);
      if (match && match.index === 0) {
        this.p += match[0].length;
        return match[0];
      }
    }
    return null;
  }
  
  scanLine() {
    const line = this.until(/\n|$/);
    this.match(/\n/);
    return line;
  }
}

class Parser {
  constructor(opts = {}) {
    this.opts = {
      inline_styles: opts.inline_styles || false,
      class_prefix: opts.class_prefix || 'quikdown-',
      fence_plugin: opts.fence_plugin || null,
      lazy_linefeeds: opts.lazy_linefeeds || false,
      allow_unsafe_urls: opts.allow_unsafe_urls || false
    };
  }
  
  parse(input) {
    if (!input) return '';
    const s = new Scanner(input);
    const blocks = [];
    
    while (s.p < s.i.length) {
      const tok = s.next();
      if (!tok) break;
      
      switch (tok.type) {
        case T.HEAD:
          // Check for space after # to confirm it's a heading
          if (s.i[s.p] === ' ') {
            s.match(/ +/);
            const content = s.scanLine().replace(/\s*#+\s*$/, '');
            blocks.push(HTML[T.HEAD]
              .replace(/{L}/g, tok.meta || 1)
              .replace('{C}', this.inline(content))
              .replace('{A}', this.attr('h' + (tok.meta || 1))));
          } else {
            // Not a heading, treat as text
            s.p = tok.start;
            blocks.push(this.paragraph(s));
          }
          break;
          
        case T.FENCE:
          const fenceStart = tok.start;
          const marker = s.i.slice(tok.start, tok.end);
          const lang = s.scanLine().trim();
          
          // Find closing fence - must be on its own line
          const closePattern = '\n' + marker;
          const closeIdx = s.i.indexOf(closePattern, s.p);
          let content;
          
          if (closeIdx !== -1) {
            content = s.i.slice(s.p, closeIdx);
            s.p = closeIdx + closePattern.length;
            // Skip rest of closing fence line
            s.match(/[^\n]*\n?/);
          } else {
            // No closing fence found
            content = s.i.slice(s.p);
            s.p = s.i.length;
          }
          
          if (this.opts.fence_plugin) {
            const result = this.opts.fence_plugin(content, lang);
            if (result !== undefined) {
              blocks.push(result);
              break;
            }
          }
          
          const langAttr = lang && !this.opts.inline_styles ? 
            ' class="language-' + lang + '"' : '';
          
          blocks.push(HTML[T.FENCE]
            .replace('{C}', esc(content))
            .replace('{L}', langAttr)
            .replace('{A}', this.attr('pre')));
          break;
          
        case T.HR:
          // Check if the rest of the line is just dashes and whitespace
          const hrStart = tok.start;
          s.p = hrStart; // Back up
          if (s.match(/^---+\s*$/m)) {
            blocks.push(HTML[T.HR].replace('{A}', this.attr('hr')));
            s.match(/\n/);
          } else {
            // Not an HR, parse as paragraph
            s.p = hrStart;
            blocks.push(this.paragraph(s));
          }
          break;
          
        case T.QUOTE:
          s.match(/ ?/);
          const quoteContent = s.scanLine();
          blocks.push(HTML[T.QUOTE]
            .replace('{C}', this.inline(quoteContent))
            .replace('{A}', this.attr('blockquote')));
          break;
          
        case T.OL:
        case T.UL:
          // Back up to beginning of list marker
          s.p = tok.start;
          blocks.push(this.list(s, tok.type));
          break;
          
        case T.NL:
          // Skip blank lines
          break;
          
        default:
          // Check if it could be a table
          s.p = tok.start;
          const lineEnd = s.i.indexOf('\n', s.p);
          const firstLine = s.i.slice(s.p, lineEnd === -1 ? s.i.length : lineEnd);
          
          if (firstLine.includes('|')) {
            const tableResult = this.table(s);
            if (tableResult) {
              blocks.push(tableResult);
            } else {
              // Not a valid table, parse as paragraph
              s.p = tok.start;
              blocks.push(this.paragraph(s));
            }
          } else {
            // Regular paragraph
            s.p = tok.start;
            blocks.push(this.paragraph(s));
          }
      }
    }
    
    return this.processBlocks(blocks);
  }
  
  list(s, type) {
    const items = [];
    const isOrdered = type === T.OL;
    const marker = isOrdered ? /^\d+\. / : /^[*+-] /;
    
    while (s.match(marker)) {
      const line = s.scanLine();
      
      // Check for task list items
      if (!isOrdered && line.match(/^\[[ xX]\]/)) {
        const checked = /^\[[xX]\]/.test(line);
        const content = line.slice(3).trim();
        items.push('<li class="quikdown-task-item"><input type="checkbox" class="quikdown-task-checkbox"' + 
                   (checked ? ' checked' : '') + ' disabled> ' + this.inline(content) + '</li>');
      } else {
        items.push('<li' + this.attr('li') + '>' + this.inline(line) + '</li>');
      }
      
      // Check for nested lists (3 spaces followed by list marker)
      if (s.p < s.i.length && s.i.slice(s.p).match(/^   [*+-] /)) {
        const nestedItems = [];
        
        // Collect nested list items
        while (s.p < s.i.length && s.i.slice(s.p).match(/^   /)) {
          s.match(/^   /); // Consume indent
          
          if (s.match(/^[*+-] /)) {
            const nestedLine = s.scanLine();
            
            // Check for nested task list
            if (nestedLine.match(/^\[[ xX]\]/)) {
              const checked = /^\[[xX]\]/.test(nestedLine);
              const content = nestedLine.slice(3).trim();
              nestedItems.push('<li class="quikdown-task-item"><input type="checkbox" class="quikdown-task-checkbox"' + 
                             (checked ? ' checked' : '') + ' disabled> ' + this.inline(content) + '</li>');
            } else {
              nestedItems.push('<li' + this.attr('li') + '>' + this.inline(nestedLine) + '</li>');
            }
          } else if (s.match(/^\d+\. /)) {
            // Nested ordered list
            const nestedLine = s.scanLine();
            nestedItems.push('<li' + this.attr('li') + '>' + this.inline(nestedLine) + '</li>');
          } else {
            // Continuation line for nested item
            const cont = s.scanLine();
            if (nestedItems.length > 0) {
              nestedItems[nestedItems.length - 1] = nestedItems[nestedItems.length - 1]
                .replace('</li>', ' ' + this.inline(cont) + '</li>');
            }
          }
        }
        
        // Add nested list as a separate item in the parent list
        if (nestedItems.length > 0) {
          const nestedTag = 'ul'; // Default to unordered for nested
          const nestedHtml = '<' + nestedTag + this.attr(nestedTag) + '>\n' + 
                           nestedItems.join('\n') + '\n</' + nestedTag + '>';
          
          // Add as separate list item, not inside parent <li>
          items.push(nestedHtml);
        }
      }
    }
    
    // Add newlines between items for formatting
    const itemsHtml = items.join('\n');
    
    return HTML[type]
      .replace('{C}', '\n' + itemsHtml + '\n')
      .replace('{A}', this.attr(isOrdered ? 'ol' : 'ul'));
  }
  
  table(s) {
    const startPos = s.p;
    const lines = [];
    
    // Collect potential table lines
    while (s.p < s.i.length) {
      const line = s.scanLine();
      if (!line.includes('|')) break;
      lines.push(line);
    }
    
    // Need at least 2 lines for a table
    if (lines.length < 2) {
      s.p = startPos;
      return null;
    }
    
    // Check if second line is a divider
    if (!lines[1].match(/^[\s\|:\-]+$/)) {
      s.p = startPos;
      return null;
    }
    
    // Parse cells
    const parseCells = line => {
      let cells = line.split('|');
      // Remove empty first/last cells
      if (cells[0] === '' || cells[0].trim() === '') cells.shift();
      if (cells[cells.length - 1] === '' || cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(c => c.trim());
    };
    
    const headers = parseCells(lines[0]);
    const alignments = parseCells(lines[1]).map(cell => {
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      if (cell.endsWith(':')) return 'right';
      return 'left';
    });
    
    const rows = lines.slice(2).map(parseCells);
    
    // Build HTML
    let html = '<table' + this.attr('table') + '>\n';
    html += '<thead' + this.attr('thead') + '>\n<tr' + this.attr('tr') + '>\n';
    
    for (let i = 0; i < headers.length; i++) {
      const align = alignments[i] !== 'left' ? ' style="text-align:' + alignments[i] + '"' : '';
      html += '<th' + this.attr('th') + align + '>' + this.inline(headers[i]) + '</th>\n';
    }
    
    html += '</tr>\n</thead>';
    
    if (rows.length) {
      html += '\n<tbody' + this.attr('tbody') + '>\n';
      for (const row of rows) {
        html += '<tr' + this.attr('tr') + '>\n';
        for (let i = 0; i < row.length; i++) {
          const align = alignments[i] && alignments[i] !== 'left' ? 
            ' style="text-align:' + alignments[i] + '"' : '';
          html += '<td' + this.attr('td') + align + '>' + 
                  this.inline(row[i] || '') + '</td>\n';
        }
        html += '</tr>\n';
      }
      html += '</tbody>';
    }
    
    html += '\n</table>';
    return html;
  }
  
  paragraph(s) {
    const lines = [];
    
    while (s.p < s.i.length && s.i[s.p] !== '\n') {
      const line = s.scanLine();
      if (line.trim()) lines.push(line);
      
      // Check if next line starts a block element
      if (s.p < s.i.length) {
        const nextChar = s.i[s.p];
        if (nextChar === '\n') break; // Blank line ends paragraph
        
        // Check for block starters
        if ('#>-*+`~|'.includes(nextChar)) break;
        if (/^\d+\. /.test(s.i.slice(s.p))) break;
      }
    }
    
    if (!lines.length) return '';
    
    // Handle line breaks - process before parseInline
    let content = lines.join('\n');
    content = content.replace(/  \n/g, '§BR§\n');
    
    const parsedContent = this.parseInline(content);
    const finalContent = parsedContent.replace(/§BR§/g, '<br' + this.attr('br') + '>');
    
    return HTML[T.PARA]
      .replace('{C}', finalContent)
      .replace('{A}', this.attr('p'));
  }
  
  parseInline(text) {
    if (!text) return '';
    
    const s = new Scanner(text);
    let result = '';
    
    while (s.p < s.i.length) {
      const tok = s.next();
      if (!tok) break;
      
      switch (tok.type) {
        case T.STRONG_S:
        case T.STRONG_U:
          const strongMarker = tok.type === T.STRONG_S ? '**' : '__';
          const strongContent = s.until(strongMarker);
          if (s.match(strongMarker)) {
            result += HTML[T.STRONG_S]
              .replace('{C}', this.parseInline(strongContent))
              .replace('{A}', this.attr('strong'));
          } else {
            result += esc(strongMarker) + this.parseInline(strongContent);
          }
          break;
          
        case T.EM_S:
        case T.EM_U:
          const emMarker = tok.type === T.EM_S ? '*' : '_';
          const emContent = s.until(emMarker);
          if (s.match(emMarker)) {
            result += HTML[T.EM_S]
              .replace('{C}', this.parseInline(emContent))
              .replace('{A}', this.attr('em'));
          } else {
            result += esc(emMarker) + this.parseInline(emContent);
          }
          break;
          
        case T.STRIKE:
          const strikeContent = s.until('~~');
          if (s.match('~~')) {
            result += HTML[T.STRIKE]
              .replace('{C}', this.parseInline(strikeContent))
              .replace('{A}', this.attr('del'));
          } else {
            result += '~~' + this.parseInline(strikeContent);
          }
          break;
          
        case T.CODE:
          const code = s.until('`');
          if (s.match('`')) {
            result += HTML[T.CODE]
              .replace('{C}', esc(code))
              .replace('{A}', this.attr('code'));
          } else {
            result += '`';
          }
          break;
          
        case T.LINK:
        case T.IMG:
          result += this.parseLink(s, tok.type === T.IMG);
          break;
          
        case T.ESC:
          // Need to output literal backslash for escaped markdown chars
          if (s.p < s.i.length) {
            const nextChar = s.i[s.p++];
            if ('*_[]'.includes(nextChar)) {
              // These chars stay escaped in output
              result += '\\' + nextChar;
            } else {
              // Other chars - just output the char without backslash
              result += nextChar;
            }
          } else {
            result += '\\';
          }
          break;
          
        default:
          result += esc(s.i.slice(tok.start, tok.end));
      }
    }
    
    return result;
  }
  
  inline(text) {
    if (!text) return '';
    
    const s = new Scanner(text);
    let result = '';
    
    while (s.p < s.i.length) {
      const tok = s.next();
      if (!tok) break;
      
      switch (tok.type) {
        case T.STRONG_S:
        case T.STRONG_U:
          const strongMarker = tok.type === T.STRONG_S ? '**' : '__';
          const strongContent = s.until(strongMarker);
          if (s.match(strongMarker)) {
            result += HTML[T.STRONG_S]
              .replace('{C}', this.inline(strongContent))
              .replace('{A}', this.attr('strong'));
          } else {
            result += esc(strongMarker) + this.inline(strongContent);
          }
          break;
          
        case T.EM_S:
        case T.EM_U:
          const emMarker = tok.type === T.EM_S ? '*' : '_';
          const emContent = s.until(emMarker);
          if (s.match(emMarker)) {
            result += HTML[T.EM_S]
              .replace('{C}', this.inline(emContent))
              .replace('{A}', this.attr('em'));
          } else {
            result += esc(emMarker) + this.inline(emContent);
          }
          break;
          
        case T.STRIKE:
          const strikeContent = s.until('~~');
          if (s.match('~~')) {
            result += HTML[T.STRIKE]
              .replace('{C}', this.inline(strikeContent))
              .replace('{A}', this.attr('del'));
          } else {
            result += '~~' + this.inline(strikeContent);
          }
          break;
          
        case T.CODE:
          const code = s.until('`');
          if (s.match('`')) {
            result += HTML[T.CODE]
              .replace('{C}', esc(code))
              .replace('{A}', this.attr('code'));
          } else {
            result += '`';
          }
          break;
          
        case T.LINK:
        case T.IMG:
          result += this.parseLink(s, tok.type === T.IMG);
          break;
          
        case T.ESC:
          if (s.p < s.i.length) {
            const nextChar = s.i[s.p++];
            if ('\\`*_{}[]()#+-.!|'.includes(nextChar)) {
              result += nextChar;
            } else {
              result += '\\' + nextChar;
            }
          } else {
            result += '\\';
          }
          break;
          
        default:
          result += esc(s.i.slice(tok.start, tok.end));
      }
    }
    
    return result;
  }
  
  parseLink(s, isImage) {
    let depth = 1, text = '';
    
    while (s.p < s.i.length && depth > 0) {
      const char = s.i[s.p++];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) break;
      }
      text += char;
    }
    
    if (depth === 0 && s.match('(')) {
      const url = s.until(')');
      if (s.match(')')) {
        if (isImage) {
          return HTML[T.IMG]
            .replace('{U}', esc(this.sanitizeUrl(url)))
            .replace('{C}', esc(text))
            .replace('{A}', this.attr('img'));
        } else {
          const safeUrl = this.sanitizeUrl(url);
          return HTML[T.LINK]
            .replace('{U}', esc(safeUrl))
            .replace('{C}', this.inline(text))
            .replace('{R}', safeUrl.startsWith('http') ? ' rel="noopener noreferrer"' : '')
            .replace('{A}', this.attr('a'));
        }
      }
    }
    
    return (isImage ? '![' : '[') + this.inline(text);
  }
  
  processBlocks(blocks) {
    let result = '';
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      
      // Bug compatibility - missing <p> after headings
      if (i > 0 && block.startsWith('<p')) {
        const prev = blocks[i - 1];
        if (prev.startsWith('<h') || 
            ((prev.endsWith('</ol>') || prev.endsWith('</ul>')) && 
             block.match(/^<p[^>]*>\s{3,}/))) {
          block = block.replace(/^<p[^>]*>/, '\n');
        }
      }
      
      result += block;
      
      // Add newline between certain blocks
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
  
  attr(tag) {
    if (tag === 'p') return '';
    if (this.opts.inline_styles) {
      return styles[tag] ? ' style="' + styles[tag] + '"' : '';
    }
    return ' class="' + this.opts.class_prefix + tag + '"';
  }
  
  sanitizeUrl(url) {
    if (!url) return '';
    const t = url.trim();
    if (this.opts.allow_unsafe_urls) return t;
    const l = t.toLowerCase();
    if (l.startsWith('javascript:') || l.startsWith('vbscript:') || 
        (l.startsWith('data:') && !l.startsWith('data:image/'))) {
      return '#';
    }
    return t;
  }
}

export default function quikdown_lex(markdown, options = {}) {
  return new Parser(options).parse(markdown);
}

quikdown_lex.version = '1.0.6dev1';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  let css = '';
  for (const [tag, style] of Object.entries(styles)) {
    if (style) css += '.' + prefix + tag + ' { ' + style + ' }\n';
  }
  return css;
};

quikdown_lex.configure = function(options) {
  return function(markdown) {
    return quikdown_lex(markdown, options);
  };
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], () => quikdown_lex);
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}