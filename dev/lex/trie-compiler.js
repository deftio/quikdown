#!/usr/bin/env node

/**
 * Trie-Based EBNF Compiler for QuikDown
 * ======================================
 * 
 * Compiles EBNF patterns into a compact trie/DFA structure
 * that can be efficiently traversed by a minimal scanner.
 * 
 * Architecture:
 * 1. Patterns → Trie nodes with state transitions
 * 2. Terminal states emit codes (HEADING=1, BOLD=2, etc.)
 * 3. Scanner traverses trie and collects codes
 * 4. Codes → HTML via lookup table
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { styles } from './quikdown_lex_styles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Terminal codes for compact representation
const TOKENS = {
  // Block tokens
  HEADING: 1,
  FENCE: 2,
  HR: 3,
  BLOCKQUOTE: 4,
  ORDERED_LIST: 5,
  UNORDERED_LIST: 6,
  TABLE: 7,
  PARAGRAPH: 8,
  NEWLINE: 9,
  
  // Inline tokens
  STRONG_STAR: 10,
  STRONG_UNDER: 11,
  EM_STAR: 12,
  EM_UNDER: 13,
  STRIKE: 14,
  CODE: 15,
  LINK: 16,
  IMAGE: 17,
  ESCAPE: 18,
  TEXT: 19,
  
  // Special tokens
  LINE_CONTENT: 20,
  FENCE_CONTENT: 21,
  TABLE_ROW: 22,
  LIST_ITEM: 23
};

/**
 * Build trie from patterns
 * Each node: { 
 *   edges: { char: nodeIndex },  // transitions
 *   token: TOKENS.X,             // terminal token
 *   pattern: regex               // for complex matches
 * }
 */
function buildTrie() {
  const trie = [];
  let nodeId = 0;
  
  // Create root node
  trie.push({ edges: {}, token: null });
  
  // Add literal patterns to trie
  const literalPatterns = [
    { text: '######', token: TOKENS.HEADING, level: 6 },
    { text: '#####', token: TOKENS.HEADING, level: 5 },
    { text: '####', token: TOKENS.HEADING, level: 4 },
    { text: '###', token: TOKENS.HEADING, level: 3 },
    { text: '##', token: TOKENS.HEADING, level: 2 },
    { text: '#', token: TOKENS.HEADING, level: 1 },
    { text: '```', token: TOKENS.FENCE },
    { text: '~~~', token: TOKENS.FENCE },
    { text: '---', token: TOKENS.HR },
    { text: '>', token: TOKENS.BLOCKQUOTE },
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
  
  // Build trie from literal patterns
  for (const { text, token, level } of literalPatterns) {
    let currentNode = 0; // Start at root
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (!trie[currentNode].edges[char]) {
        // Create new node
        const newNode = ++nodeId;
        trie[newNode] = { edges: {}, token: null };
        trie[currentNode].edges[char] = newNode;
      }
      
      currentNode = trie[currentNode].edges[char];
      
      // Mark terminal node
      if (i === text.length - 1) {
        trie[currentNode].token = token;
        if (level) trie[currentNode].level = level;
      }
    }
  }
  
  // Add regex patterns as special nodes
  const regexPatterns = [
    { pattern: /^\d+\. /, token: TOKENS.ORDERED_LIST },
    { pattern: /^[*+-] /, token: TOKENS.UNORDERED_LIST },
    { pattern: /.*\|.*/, token: TOKENS.TABLE }
  ];
  
  for (const { pattern, token } of regexPatterns) {
    const node = ++nodeId;
    trie[node] = { pattern, token };
  }
  
  // Store regex node IDs for runtime lookup
  trie[0].regexNodes = regexPatterns.map((_, i) => nodeId - regexPatterns.length + i + 1);
  
  return trie;
}

/**
 * Generate compact state machine code
 */
function generateStateMachine() {
  const trie = buildTrie();
  
  // Convert trie to compact arrays for size
  const edges = [];     // [fromNode, char, toNode]
  const tokens = [];    // [nodeId, token, metadata]
  const patterns = [];  // [nodeId, patternIndex]
  const patternList = []; // Actual regex patterns
  
  // Flatten trie structure
  for (let i = 0; i < trie.length; i++) {
    const node = trie[i];
    
    // Add edges
    if (node.edges) {
      for (const [char, toNode] of Object.entries(node.edges)) {
        edges.push([i, char.charCodeAt(0), toNode]);
      }
    }
    
    // Add tokens
    if (node.token) {
      const meta = node.level || 0;
      tokens.push([i, node.token, meta]);
    }
    
    // Add patterns
    if (node.pattern) {
      patterns.push([i, patternList.length]);
      patternList.push(node.pattern.source);
    }
  }
  
  return `/**
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
  e: [${edges.map(e => `[${e.join(',')}]`).join(',')}],
  
  // Token terminals: [nodeId, token, metadata]
  t: [${tokens.map(t => `[${t.join(',')}]`).join(',')}],
  
  // Regex patterns: [nodeId, patternIndex]
  p: [${patterns.map(p => `[${p.join(',')}]`).join(',')}],
  
  // Pattern strings
  r: [${patternList.map(p => `/${p}/`).join(',')}]
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
          if (s.match(/\\s*$/m)) {
            blocks.push(HTML[T.HR].replace('{A}', this.attr('hr')));
            s.match(/\\n/);
          }
          break;
        case T.QUOTE:
          if (s.match(/ ?/)) {
            const content = s.until(/\\n|$/);
            blocks.push(HTML[T.QUOTE]
              .replace('{C}', this.inline(content))
              .replace('{A}', this.attr('blockquote')));
            s.match(/\\n/);
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
    const content = s.until(/\\n|$/).replace(/\\s*#+\\s*$/, '');
    s.match(/\\n/);
    return HTML[T.HEAD]
      .replace(/{L}/g, tok.meta || 1)
      .replace('{C}', this.inline(content))
      .replace('{A}', this.attr('h' + (tok.meta || 1)));
  }
  
  fence(s) {
    const lang = s.until(/\\n|$/).trim();
    s.match(/\\n/);
    
    // Find closing fence
    const marker = s.i.slice(s.p - 4, s.p - 1); // Get the fence marker
    const idx = s.i.indexOf('\\n' + marker, s.p);
    const content = idx !== -1 ? s.i.slice(s.p, idx) : s.i.slice(s.p);
    s.p = idx !== -1 ? idx + 4 : s.i.length;
    s.match(/[^\\n]*\\n?/);
    
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
    const marker = isOrdered ? /^\\d+\\. / : /^[*+-] /;
    
    do {
      const line = s.until(/\\n|$/);
      items.push('<li' + this.attr('li') + '>' + this.inline(line) + '</li>');
      s.match(/\\n/);
    } while (s.match(marker));
    
    return HTML[type]
      .replace('{C}', items.join('\\n'))
      .replace('{A}', this.attr(isOrdered ? 'ol' : 'ul'));
  }
  
  table(s) {
    // Simplified table parsing
    const lines = [];
    while (s.p < s.i.length && s.i.slice(s.p).includes('|')) {
      lines.push(s.until(/\\n|$/));
      s.match(/\\n/);
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
    if (rows[1] && rows[1][0].match(/^[\\-:]+$/)) {
      rows.splice(1, 1);
    }
    
    const header = rows.shift();
    let html = '<table' + this.attr('table') + '>\\n';
    html += '<thead>\\n<tr>';
    html += header.map(h => '<th' + this.attr('th') + '>' + this.inline(h) + '</th>').join('');
    html += '</tr>\\n</thead>\\n';
    
    if (rows.length) {
      html += '<tbody>\\n';
      html += rows.map(r => 
        '<tr>' + r.map(c => '<td' + this.attr('td') + '>' + this.inline(c) + '</td>').join('') + '</tr>'
      ).join('\\n');
      html += '\\n</tbody>';
    }
    
    html += '\\n</table>';
    return html;
  }
  
  paragraph(s) {
    const lines = [];
    while (s.p < s.i.length && s.i[s.p] !== '\\n') {
      const line = s.until(/\\n|$/);
      if (line.trim()) lines.push(line);
      s.match(/\\n/);
      
      // Check for block start
      const next = s.next();
      if (next && next.type !== T.TEXT) {
        s.p = next.start;
        break;
      }
    }
    
    if (!lines.length) return '';
    
    return HTML[T.PARA]
      .replace('{C}', this.inline(lines.join('\\n')))
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
          result += '\\\\';
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

// Main export
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

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quikdown_lex;
} else if (typeof define === 'function' && define.amd) {
  define([], () => quikdown_lex);
} else if (typeof globalThis !== 'undefined') {
  globalThis.quikdown_lex = quikdown_lex;
}`;
}

/**
 * Build the trie-based lexer
 */
export default async function build() {
  console.log('🔨 Building trie-based lexer...');
  
  // Generate the state machine code
  console.log('  📝 Generating trie state machine...');
  let code = generateStateMachine();
  
  // Add version
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
  );
  code = code.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
  
  // Write output
  const outputPath = path.join(__dirname, 'quikdown_lex_trie.js');
  fs.writeFileSync(outputPath, code);
  
  console.log(`  💾 Written to: quikdown_lex_trie.js`);
  console.log(`  📏 Source size: ${(code.length / 1024).toFixed(1)}KB`);
  
  // Minify
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
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex_trie.min.js'), minified.code);
  console.log(`  🗜️  Minified size: ${(minified.code.length / 1024).toFixed(1)}KB`);
  
  // Compare with Grammar1
  const grammar1Path = path.join(__dirname, 'grammar1/quikdown_lex.min.js');
  if (fs.existsSync(grammar1Path)) {
    const grammar1Size = fs.statSync(grammar1Path).size / 1024;
    const trieSize = minified.code.length / 1024;
    const diff = ((trieSize - grammar1Size) / grammar1Size * 100).toFixed(1);
    
    console.log(`\n📊 Size comparison:`);
    console.log(`  Grammar1:    ${grammar1Size.toFixed(1)}KB`);
    console.log(`  Trie-based:  ${trieSize.toFixed(1)}KB`);
    console.log(`  Difference:  ${diff > 0 ? '+' : ''}${diff}%`);
  }
  
  console.log('\n✅ Build complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch(console.error);
}