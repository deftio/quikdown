#!/usr/bin/env node

/**
 * Fixed Trie-Based EBNF Compiler for QuikDown
 * ============================================
 * 
 * Fixes:
 * 1. Code fence closing detection
 * 2. List parsing (needs to consume initial marker)
 * 3. HR parsing (needs full line check)
 * 4. Table parsing (check for divider row)
 * 
 * Optimizations:
 * - Use JS regex for whitespace/comments
 * - Use JS string methods where they're more efficient
 * - Use JS objects/arrays as native data structures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { styles } from './quikdown_lex_styles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Terminal codes
const TOKENS = {
  HEADING: 1, FENCE: 2, HR: 3, BLOCKQUOTE: 4, 
  ORDERED_LIST: 5, UNORDERED_LIST: 6, TABLE: 7, PARAGRAPH: 8,
  NEWLINE: 9, STRONG_STAR: 10, STRONG_UNDER: 11,
  EM_STAR: 12, EM_UNDER: 13, STRIKE: 14, CODE: 15,
  LINK: 16, IMAGE: 17, ESCAPE: 18, TEXT: 19
};

function buildTrie() {
  const trie = [];
  let nodeId = 0;
  
  // Root node
  trie.push({ edges: {}, token: null });
  
  // Literal patterns for trie
  const literals = [
    // Headings - longest first for greedy matching
    { text: '######', token: TOKENS.HEADING, level: 6 },
    { text: '#####', token: TOKENS.HEADING, level: 5 },
    { text: '####', token: TOKENS.HEADING, level: 4 },
    { text: '###', token: TOKENS.HEADING, level: 3 },
    { text: '##', token: TOKENS.HEADING, level: 2 },
    { text: '#', token: TOKENS.HEADING, level: 1 },
    // Fences
    { text: '```', token: TOKENS.FENCE },
    { text: '~~~', token: TOKENS.FENCE },
    // HR (but needs full line check)
    { text: '---', token: TOKENS.HR },
    // Blockquote
    { text: '>', token: TOKENS.BLOCKQUOTE },
    // Inline
    { text: '**', token: TOKENS.STRONG_STAR },
    { text: '__', token: TOKENS.STRONG_UNDER },
    { text: '*', token: TOKENS.EM_STAR },
    { text: '_', token: TOKENS.EM_UNDER },
    { text: '~~', token: TOKENS.STRIKE },
    { text: '`', token: TOKENS.CODE },
    { text: '![', token: TOKENS.IMAGE },
    { text: '[', token: TOKENS.LINK },
    { text: '\\', token: TOKENS.ESCAPE },
    { text: '\n', token: TOKENS.NEWLINE }
  ];
  
  // Build trie
  for (const { text, token, level } of literals) {
    let current = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!trie[current].edges[char]) {
        const newNode = ++nodeId;
        trie[newNode] = { edges: {}, token: null };
        trie[current].edges[char] = newNode;
      }
      current = trie[current].edges[char];
      if (i === text.length - 1) {
        trie[current].token = token;
        if (level) trie[current].level = level;
      }
    }
  }
  
  // Regex patterns stored separately
  trie[0].patterns = [
    { regex: /^\d+\. /, token: TOKENS.ORDERED_LIST },
    { regex: /^[*+-] /, token: TOKENS.UNORDERED_LIST }
  ];
  
  return trie;
}

function generateStateMachine() {
  const trie = buildTrie();
  
  // Compact representation
  const edges = [];
  const tokens = [];
  
  for (let i = 0; i < trie.length; i++) {
    const node = trie[i];
    if (node.edges) {
      for (const [char, toNode] of Object.entries(node.edges)) {
        edges.push([i, char.charCodeAt(0), toNode]);
      }
    }
    if (node.token) {
      tokens.push([i, node.token, node.level || 0]);
    }
  }
  
  return `/**
 * QuikDown Lexer - Fixed Trie-Based Parser
 * Leverages JS built-ins where appropriate
 */

const T = {
  HEAD: 1, FENCE: 2, HR: 3, QUOTE: 4, OL: 5, UL: 6, TABLE: 7, PARA: 8, NL: 9,
  STRONG_S: 10, STRONG_U: 11, EM_S: 12, EM_U: 13, STRIKE: 14, CODE: 15,
  LINK: 16, IMG: 17, ESC: 18, TEXT: 19
};

// Trie structure
const SM = {
  e: [${edges.map(e => `[${e.join(',')}]`).join(',')}],
  t: [${tokens.map(t => `[${t.join(',')}]`).join(',')}]
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
    
    // Try regex patterns (using JS regex directly)
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
  
  // Leverage JS string methods
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
    const line = this.until(/\\n|$/);
    this.match(/\\n/);
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
          // Require space after heading marker
          if (s.i[s.p] === ' ') {
            s.match(/ +/);
            const content = s.scanLine().replace(/\\s*#+\\s*$/, '');
            blocks.push(HTML[T.HEAD]
              .replace(/{L}/g, tok.meta || 1)
              .replace('{C}', this.inline(content))
              .replace('{A}', this.attr('h' + (tok.meta || 1))));
          } else {
            s.p = tok.start + 1; // Just a #, not a heading
          }
          break;
          
        case T.FENCE:
          const marker = s.i.slice(tok.start, tok.end);
          const lang = s.scanLine().trim();
          
          // Find closing fence using JS string indexOf
          const closePattern = '\\n' + marker;
          const closeIdx = s.i.indexOf(closePattern, s.p);
          let content;
          
          if (closeIdx !== -1) {
            content = s.i.slice(s.p, closeIdx);
            s.p = closeIdx + closePattern.length;
            s.match(/[^\\n]*\\n?/); // Skip rest of fence line
          } else {
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
          // Check if rest of line is just dashes and whitespace
          s.p = tok.start; // Back up
          if (s.match(/^---+\\s*$/m)) {
            blocks.push(HTML[T.HR].replace('{A}', this.attr('hr')));
            s.match(/\\n/);
          } else {
            s.p = tok.end; // Not a HR, continue
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
          s.p = tok.start; // Back up to re-match markers
          blocks.push(this.list(s, tok.type));
          break;
          
        case T.NL:
          // Skip blank lines
          break;
          
        default:
          // Check for table
          s.p = tok.start;
          if (s.i.slice(s.p, s.i.indexOf('\\n', s.p)).includes('|')) {
            blocks.push(this.table(s));
          } else {
            // Paragraph
            blocks.push(this.paragraph(s));
          }
      }
    }
    
    return this.processBlocks(blocks);
  }
  
  list(s, type) {
    const items = [];
    const isOrdered = type === T.OL;
    const marker = isOrdered ? /^\\d+\\. / : /^[*+-] /;
    
    while (s.match(marker)) {
      const line = s.scanLine();
      
      // Check for task list
      if (!isOrdered && line.match(/^\\[[ xX]\\]/)) {
        const checked = /^\\[[xX]\\]/.test(line);
        const content = line.slice(3).trim();
        items.push('<li class="quikdown-task-item"><input type="checkbox" class="quikdown-task-checkbox"' + 
                   (checked ? ' checked' : '') + ' disabled> ' + this.inline(content) + '</li>');
      } else {
        items.push('<li' + this.attr('li') + '>' + this.inline(line) + '</li>');
      }
      
      // Check for continuation or nested items
      while (s.p < s.i.length && s.i[s.p] !== '\\n') {
        if (s.match(/^  /)) {
          // Continuation line
          const cont = s.scanLine();
          items[items.length - 1] = items[items.length - 1].replace('</li>', ' ' + this.inline(cont) + '</li>');
        } else if (!s.i.slice(s.p).match(marker)) {
          break;
        } else {
          break;
        }
      }
    }
    
    return HTML[type]
      .replace('{C}', items.join('\n'))
      .replace('{A}', this.attr(isOrdered ? 'ol' : 'ul'));
  }
  
  table(s) {
    const lines = [];
    
    // Collect table lines
    while (s.p < s.i.length) {
      const line = s.scanLine();
      if (!line.includes('|')) break;
      lines.push(line);
    }
    
    if (lines.length < 2) return this.paragraph(s);
    
    // Check for divider row
    if (!lines[1].match(/^[\\s\\|:\\-]+$/)) {
      // Not a table, back up and parse as paragraph
      s.p = s.p - lines.join('\\n').length - lines.length;
      return this.paragraph(s);
    }
    
    // Parse cells
    const parseCells = line => {
      let cells = line.split('|');
      if (cells[0] === '' || !cells[0].trim()) cells.shift();
      if (cells[cells.length - 1] === '' || !cells[cells.length - 1].trim()) cells.pop();
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
          const align = alignments[i] !== 'left' ? ' style="text-align:' + alignments[i] + '"' : '';
          html += '<td' + this.attr('td') + align + '>' + this.inline(row[i] || '') + '</td>\n';
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
      
      // Check for block start on next line
      if (s.p < s.i.length && s.i[s.p] !== '\n') {
        const nextChar = s.i[s.p];
        if ('#>-*+\`~'.includes(nextChar) || /^\\d/.test(nextChar)) {
          break;
        }
      }
    }
    
    if (!lines.length) return '';
    
    const content = this.opts.lazy_linefeeds ?
      lines.map((l, i) => i < lines.length - 1 ? this.inline(l) + '<br>' : this.inline(l)).join('') :
      this.inline(lines.join('\\n'));
    
    return HTML[T.PARA]
      .replace('{C}', content)
      .replace('{A}', this.attr('p'));
  }
  
  inline(text) {
    if (!text) return '';
    text = text.replace(/  \\n/g, '§BR§\\n'); // Handle line breaks
    
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
          const code = s.until('\`');
          if (s.match('\`')) {
            result += HTML[T.CODE]
              .replace('{C}', esc(code))
              .replace('{A}', this.attr('code'));
          } else {
            result += '\`';
          }
          break;
          
        case T.LINK:
        case T.IMG:
          result += this.parseLink(s, tok.type === T.IMG);
          break;
          
        case T.ESC:
          if (s.p < s.i.length) {
            const nextChar = s.i[s.p++];
            result += '[]'.includes(nextChar) ? nextChar : '\\\\' + nextChar;
          } else {
            result += '\\\\';
          }
          break;
          
        default:
          result += esc(s.i.slice(tok.start, tok.end));
      }
    }
    
    return result.replace(/§BR§/g, '<br' + this.attr('br') + '>');
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
      
      // Bug compatibility
      if (i > 0 && block.startsWith('<p')) {
        const prev = blocks[i - 1];
        if (prev.startsWith('<h') || 
            ((prev.endsWith('</ol>') || prev.endsWith('</ul>')) && 
             block.match(/^<p[^>]*>\\s{3,}/))) {
          block = block.replace(/^<p[^>]*>/, '\\n');
        }
      }
      
      result += block;
      
      if (i < blocks.length - 1) {
        const current = blocks[i];
        const next = blocks[i + 1];
        if ((current.startsWith('<h') && next.startsWith('<h')) ||
            (current.startsWith('<blockquote') && next.startsWith('<blockquote'))) {
          result += '\\n';
        }
      }
    }
    return result;
  }
  
  attr(tag) {
    if (tag === 'p') return '';
    if (this.opts.inline_styles) {
      const styles = ${JSON.stringify(styles)};
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

quikdown_lex.version = '__QUIKDOWN_VERSION__';

quikdown_lex.emitStyles = function(prefix = 'quikdown-') {
  const styles = ${JSON.stringify(styles)};
  let css = '';
  for (const [tag, style] of Object.entries(styles)) {
    if (style) css += '.' + prefix + tag + ' { ' + style + ' }\\n';
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
}`;
}

export default async function build() {
  console.log('🔨 Building fixed trie-based lexer...');
  
  let code = generateStateMachine();
  
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
  );
  code = code.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
  
  const outputPath = path.join(__dirname, 'quikdown_lex_trie_fixed.js');
  fs.writeFileSync(outputPath, code);
  
  console.log(`  💾 Written to: quikdown_lex_trie_fixed.js`);
  console.log(`  📏 Source size: ${(code.length / 1024).toFixed(1)}KB`);
  
  const { minify } = await import('terser');
  const minified = await minify(code, {
    module: true,
    compress: {
      passes: 2,
      pure_getters: true,
      unsafe: true,
      unsafe_comps: true,
    },
    mangle: true
  });
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex_trie_fixed.min.js'), minified.code);
  console.log(`  🗜️  Minified size: ${(minified.code.length / 1024).toFixed(1)}KB`);
  
  const grammar1Path = path.join(__dirname, 'grammar1/quikdown_lex.min.js');
  if (fs.existsSync(grammar1Path)) {
    const grammar1Size = fs.statSync(grammar1Path).size / 1024;
    const trieSize = minified.code.length / 1024;
    const diff = ((trieSize - grammar1Size) / grammar1Size * 100).toFixed(1);
    
    console.log(`\n📊 Size comparison:`);
    console.log(`  Grammar1:       ${grammar1Size.toFixed(1)}KB`);
    console.log(`  Trie-fixed:     ${trieSize.toFixed(1)}KB`);
    console.log(`  Difference:     ${diff > 0 ? '+' : ''}${diff}%`);
  }
  
  console.log('\n✅ Build complete!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch(console.error);
}