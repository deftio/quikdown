/**
 * QuikDown Lexer - Trie-Based State Machine
 * Generated from EBNF grammar → Trie → Compact arrays
 */

// Token constants
const T = {
  HEAD: 1, FENCE: 2, HR: 3, QUOTE: 4, OL: 5, UL: 6, TABLE: 7, PARA: 8, NL: 9,
  STRONG_S: 10, STRONG_U: 11, EM_S: 12, EM_U: 13, STRIKE: 14, CODE: 15,
  LINK: 16, IMG: 17, ESC: 18, TEXT: 19
};

// Trie as compact arrays
const SM = {
  // Edge transitions: [fromNode, charCode, toNode]
  e: [[0,35,1],[0,96,7],[0,126,10],[0,45,13],[0,62,16],[0,42,17],[0,95,19],[0,33,21],[0,91,23],[0,92,24],[0,10,25],[1,35,2],[2,35,3],[3,35,4],[4,35,5],[5,35,6],[7,96,8],[8,96,9],[10,126,11],[11,126,12],[13,45,14],[14,45,15],[17,42,18],[19,95,20],[21,91,22]],
  
  // Token terminals: [nodeId, token, metadata]
  t: [[1,1,1],[2,1,2],[3,1,3],[4,1,4],[5,1,5],[6,1,6],[7,15,0],[9,2,0],[11,14,0],[12,2,0],[15,3,0],[16,4,0],[17,12,0],[18,10,0],[19,13,0],[20,11,0],[22,17,0],[23,16,0],[24,18,0],[25,9,0],[26,5,0],[27,6,0],[28,7,0]],
  
  // Regex patterns: [nodeId, patternIndex]
  p: [[26,0],[27,1],[28,2]],
  
  // Pattern strings
  r: [/^\d+\. /,/^[*+-] /,/.*\|.*/]
};

// HTML templates (indexed by token)
const HTML = [
  '', // 0 - no token
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

// Escape HTML
const esc = s => {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  let r = '';
  for (let i = 0; i < s.length; i++) r += m[s[i]] || s[i];
  return r;
};

// Trie scanner
class Scanner {
  constructor(input, opts = {}) {
    this.i = input;
    this.p = 0;
    this.o = opts;
  }
  
  // Scan next token using trie
  next() {
    if (this.p >= this.i.length) return null;
    
    let node = 0; // Start at root
    let lastToken = null;
    let lastPos = this.p;
    
    // Follow trie edges
    while (this.p < this.i.length) {
      const char = this.i.charCodeAt(this.p);
      let found = false;
      
      // Check edges
      for (const [from, ch, to] of SM.e) {
        if (from === node && ch === char) {
          node = to;
          this.p++;
          found = true;
          
          // Check if this node has a token
          for (const [n, tok, meta] of SM.t) {
            if (n === node) {
              lastToken = { type: tok, meta, start: lastPos, end: this.p };
            }
          }
          break;
        }
      }
      
      if (!found) break;
    }
    
    // If we found a token, return it
    if (lastToken) {
      return lastToken;
    }
    
    // Try regex patterns
    for (const [nodeId, patIdx] of SM.p) {
      const pattern = SM.r[patIdx];
      const match = this.i.slice(this.p).match(pattern);
      if (match) {
        const tok = SM.t.find(t => t[0] === nodeId);
        if (tok) {
          const token = { type: tok[1], start: this.p, end: this.p + match[0].length };
          this.p += match[0].length;
          return token;
        }
      }
    }
    
    // Default to text
    const start = this.p++;
    return { type: T.TEXT, start, end: this.p };
  }
  
  // Scan until pattern
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
  
  // Match and consume
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
}

// Parser using scanner
class Parser {
  constructor(opts = {}) {
    this.opts = {
      inline_styles: opts.inline_styles || false,
      class_prefix: opts.class_prefix || 'quikdown-',
      fence_plugin: opts.fence_plugin || null
    };
  }
  
  parse(input) {
    if (!input) return '';
    const s = new Scanner(input, this.opts);
    const blocks = [];
    
    while (s.p < s.i.length) {
      const tok = s.next();
      if (!tok) break;
      
      switch (tok.type) {
        case T.HEAD:
          blocks.push(this.heading(s, tok));
          break;
        case T.FENCE:
          blocks.push(this.fence(s));
          break;
        case T.HR:
          if (s.match(/\s*$/m)) {
            blocks.push(HTML[T.HR].replace('{A}', this.attr('hr')));
            s.match(/\n/);
          }
          break;
        case T.QUOTE:
          if (s.match(/ ?/)) {
            const content = s.until(/\n|$/);
            blocks.push(HTML[T.QUOTE]
              .replace('{C}', this.inline(content))
              .replace('{A}', this.attr('blockquote')));
            s.match(/\n/);
          }
          break;
        case T.OL:
        case T.UL:
          blocks.push(this.list(s, tok.type));
          break;
        case T.TABLE:
          blocks.push(this.table(s));
          break;
        case T.NL:
          // Skip blank lines
          break;
        default:
          // Paragraph
          s.p = tok.start; // Back up
          blocks.push(this.paragraph(s));
      }
    }
    
    return this.processBlocks(blocks);
  }
  
  heading(s, tok) {
    s.match(/ +/);
    const content = s.until(/\n|$/).replace(/\s*#+\s*$/, '');
    s.match(/\n/);
    return HTML[T.HEAD]
      .replace(/{L}/g, tok.meta || 1)
      .replace('{C}', this.inline(content))
      .replace('{A}', this.attr('h' + (tok.meta || 1)));
  }
  
  fence(s) {
    const lang = s.until(/\n|$/).trim();
    s.match(/\n/);
    
    // Find closing fence
    const marker = s.i.slice(s.p - 4, s.p - 1); // Get the fence marker
    const idx = s.i.indexOf('\n' + marker, s.p);
    const content = idx !== -1 ? s.i.slice(s.p, idx) : s.i.slice(s.p);
    s.p = idx !== -1 ? idx + 4 : s.i.length;
    s.match(/[^\n]*\n?/);
    
    if (this.opts.fence_plugin) {
      const result = this.opts.fence_plugin(content, lang);
      if (result !== undefined) return result;
    }
    
    const langAttr = lang && !this.opts.inline_styles ? 
      ' class="language-' + lang + '"' : '';
    
    return HTML[T.FENCE]
      .replace('{C}', esc(content))
      .replace('{L}', langAttr)
      .replace('{A}', this.attr('pre'));
  }
  
  list(s, type) {
    const items = [];
    const isOrdered = type === T.OL;
    const marker = isOrdered ? /^\d+\. / : /^[*+-] /;
    
    do {
      const line = s.until(/\n|$/);
      items.push('<li' + this.attr('li') + '>' + this.inline(line) + '</li>');
      s.match(/\n/);
    } while (s.match(marker));
    
    return HTML[type]
      .replace('{C}', items.join('\n'))
      .replace('{A}', this.attr(isOrdered ? 'ol' : 'ul'));
  }
  
  table(s) {
    // Simplified table parsing
    const lines = [];
    while (s.p < s.i.length && s.i.slice(s.p).includes('|')) {
      lines.push(s.until(/\n|$/));
      s.match(/\n/);
      if (!s.i.slice(s.p).includes('|')) break;
    }
    
    if (lines.length < 2) return '';
    
    const rows = lines.map(l => {
      let cells = l.split('|');
      if (!cells[0].trim()) cells.shift();
      if (!cells[cells.length - 1].trim()) cells.pop();
      return cells.map(c => c.trim());
    });
    
    // Skip divider row
    if (rows[1] && rows[1][0].match(/^[\-:]+$/)) {
      rows.splice(1, 1);
    }
    
    const header = rows.shift();
    let html = '<table' + this.attr('table') + '>\n';
    html += '<thead>\n<tr>';
    html += header.map(h => '<th' + this.attr('th') + '>' + this.inline(h) + '</th>').join('');
    html += '</tr>\n</thead>\n';
    
    if (rows.length) {
      html += '<tbody>\n';
      html += rows.map(r => 
        '<tr>' + r.map(c => '<td' + this.attr('td') + '>' + this.inline(c) + '</td>').join('') + '</tr>'
      ).join('\n');
      html += '\n</tbody>';
    }
    
    html += '\n</table>';
    return html;
  }
  
  paragraph(s) {
    const lines = [];
    while (s.p < s.i.length && s.i[s.p] !== '\n') {
      const line = s.until(/\n|$/);
      if (line.trim()) lines.push(line);
      s.match(/\n/);
      
      // Check for block start
      const next = s.next();
      if (next && next.type !== T.TEXT) {
        s.p = next.start;
        break;
      }
    }
    
    if (!lines.length) return '';
    
    return HTML[T.PARA]
      .replace('{C}', this.inline(lines.join('\n')))
      .replace('{A}', this.attr('p'));
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
          const marker = tok.type === T.STRONG_S ? '**' : '__';
          const content = s.until(marker);
          if (s.match(marker)) {
            result += HTML[T.STRONG_S]
              .replace('{C}', this.inline(content))
              .replace('{A}', this.attr('strong'));
          } else {
            result += esc(marker) + this.inline(content);
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
          result += '\\';
          if (s.p < s.i.length) result += s.i[s.p++];
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
          return HTML[T.LINK]
            .replace('{U}', esc(this.sanitizeUrl(url)))
            .replace('{C}', this.inline(text))
            .replace('{R}', url.startsWith('http') ? ' rel="noopener noreferrer"' : '')
            .replace('{A}', this.attr('a'));
        }
      }
    }
    
    return (isImage ? '![' : '[') + this.inline(text);
  }
  
  processBlocks(blocks) {
    // Bug compatibility for missing <p> tags
    let result = '';
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      
      if (i > 0 && block.startsWith('<p')) {
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
  
  attr(tag) {
    if (tag === 'p') return '';
    if (this.opts.inline_styles) {
      const styles = {"h1":"font-size:2em;font-weight:600;margin:.67em 0","h2":"font-size:1.5em;font-weight:600;margin:.83em 0","h3":"font-size:1.25em;font-weight:600;margin:1em 0","h4":"font-size:1em;font-weight:600;margin:1.33em 0","h5":"font-size:.875em;font-weight:600;margin:1.67em 0","h6":"font-size:.85em;font-weight:600;margin:2em 0","pre":"background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0","code":"background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace","blockquote":"border-left:4px solid #ddd;margin-left:0;padding-left:1em","table":"border-collapse:collapse;width:100%;margin:1em 0","th":"border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left","td":"border:1px solid #ddd;padding:8px;text-align:left","hr":"border:none;border-top:1px solid #ddd;margin:1em 0","img":"max-width:100%;height:auto","a":"color:#06c;text-decoration:underline","strong":"font-weight:bold","em":"font-style:italic","del":"text-decoration:line-through","ul":"margin:.5em 0;padding-left:2em","ol":"margin:.5em 0;padding-left:2em","li":"margin:.25em 0","br":"","p":"margin:1em 0"};
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

// Main export
export default function quikdown_lex(markdown, options = {}) {
  return new Parser(options).parse(markdown);
}

quikdown_lex.version = '1.0.6dev1';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  const styles = {"h1":"font-size:2em;font-weight:600;margin:.67em 0","h2":"font-size:1.5em;font-weight:600;margin:.83em 0","h3":"font-size:1.25em;font-weight:600;margin:1em 0","h4":"font-size:1em;font-weight:600;margin:1.33em 0","h5":"font-size:.875em;font-weight:600;margin:1.67em 0","h6":"font-size:.85em;font-weight:600;margin:2em 0","pre":"background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0","code":"background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace","blockquote":"border-left:4px solid #ddd;margin-left:0;padding-left:1em","table":"border-collapse:collapse;width:100%;margin:1em 0","th":"border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left","td":"border:1px solid #ddd;padding:8px;text-align:left","hr":"border:none;border-top:1px solid #ddd;margin:1em 0","img":"max-width:100%;height:auto","a":"color:#06c;text-decoration:underline","strong":"font-weight:bold","em":"font-style:italic","del":"text-decoration:line-through","ul":"margin:.5em 0;padding-left:2em","ol":"margin:.5em 0;padding-left:2em","li":"margin:.25em 0","br":"","p":"margin:1em 0"};
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

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], () => quikdown_lex);
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}