#!/usr/bin/env node

/**
 * Proper EBNF Compiler for QuikDown
 * Generates compact parsing tables and a minimal runtime
 * 
 * Like traditional compiler tools (yacc, ANTLR), this:
 * 1. Parses EBNF grammar into AST
 * 2. Generates state machine/parsing tables
 * 3. Outputs minimal runtime + data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { styles } from './quikdown_lex_styles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * EBNF Grammar Definition as JavaScript data structure
 * This represents the parsed EBNF rules
 */
const GRAMMAR = {
  // Block-level rules
  document: {
    type: 'repetition',
    rule: 'block'
  },
  
  block: {
    type: 'choice',
    rules: ['heading', 'fence', 'hr', 'blockquote', 'list', 'table', 'paragraph', 'blank_line']
  },
  
  blank_line: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^\n+/ }
    ]
  },
  
  heading: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^(#{1,6})(?= )/, capture: 'level' },
      { type: 'terminal', pattern: /^ +/ },
      { type: 'until', pattern: /\n|$/, capture: 'content', process: 'inline' },
      { type: 'terminal', pattern: /\s*#+\s*$/, optional: true },
      { type: 'terminal', pattern: /\n?/ }
    ],
    emit: 'heading'
  },
  
  fence: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^(```|~~~)/, capture: 'marker' },
      { type: 'until', pattern: /\n|$/, capture: 'lang' },
      { type: 'terminal', pattern: /\n/ },
      { type: 'until_fence', capture: 'content' },
      { type: 'backreference', ref: 'marker' },
      { type: 'terminal', pattern: /[^\n]*\n?/ }
    ],
    emit: 'fence'
  },
  
  hr: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^---+\s*$/ },
      { type: 'terminal', pattern: /\n?/ }
    ],
    emit: 'hr'
  },
  
  blockquote: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^> ?/ },
      { type: 'until', pattern: /\n|$/, capture: 'content', process: 'inline' },
      { type: 'terminal', pattern: /\n?/ }
    ],
    emit: 'blockquote'
  },
  
  list: {
    type: 'choice',
    rules: ['ordered_list', 'unordered_list']
  },
  
  ordered_list: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^\d+\. /, capture: 'marker' },
      { type: 'list_items', ordered: true }
    ],
    emit: 'ol'
  },
  
  unordered_list: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^[*+-] /, capture: 'marker' },
      { type: 'list_items', ordered: false }
    ],
    emit: 'ul'
  },
  
  table: {
    type: 'sequence',
    rules: [
      { type: 'table_row', capture: 'header' },
      { type: 'terminal', pattern: /^[\s\|:\-]+$/ },
      { type: 'terminal', pattern: /\n/ },
      { type: 'table_rows', capture: 'rows' }
    ],
    emit: 'table'
  },
  
  paragraph: {
    type: 'sequence',
    rules: [
      { type: 'paragraph_lines', capture: 'content', process: 'inline' }
    ],
    emit: 'p'
  },
  
  // Inline rules
  inline: {
    type: 'repetition',
    rule: 'inline_element'
  },
  
  inline_element: {
    type: 'choice',
    rules: ['escape', 'strong', 'emphasis', 'strikethrough', 'code', 'image', 'link', 'text']
  },
  
  escape: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^\\/ },
      { type: 'terminal', pattern: /^./, capture: 'char' }
    ],
    emit: 'escape'
  },
  
  strong: {
    type: 'choice',
    rules: [
      {
        type: 'sequence',
        rules: [
          { type: 'terminal', pattern: /^\*\*/ },
          { type: 'until', pattern: /\*\*/, capture: 'content', process: 'inline' },
          { type: 'terminal', pattern: /^\*\*/ }
        ]
      },
      {
        type: 'sequence',
        rules: [
          { type: 'terminal', pattern: /^__/ },
          { type: 'until', pattern: /__/, capture: 'content', process: 'inline' },
          { type: 'terminal', pattern: /^__/ }
        ]
      }
    ],
    emit: 'strong'
  },
  
  emphasis: {
    type: 'choice',
    rules: [
      {
        type: 'sequence',
        rules: [
          { type: 'terminal', pattern: /^\*(?!\*)/ },
          { type: 'until', pattern: /\*/, capture: 'content', process: 'inline' },
          { type: 'terminal', pattern: /^\*/ }
        ]
      },
      {
        type: 'sequence',
        rules: [
          { type: 'terminal', pattern: /^_(?!_)/ },
          { type: 'until', pattern: /_/, capture: 'content', process: 'inline' },
          { type: 'terminal', pattern: /^_/ }
        ]
      }
    ],
    emit: 'em'
  },
  
  strikethrough: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^~~/ },
      { type: 'until', pattern: /~~/, capture: 'content', process: 'inline' },
      { type: 'terminal', pattern: /^~~/ }
    ],
    emit: 'del'
  },
  
  code: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^`/ },
      { type: 'until', pattern: /`/, capture: 'content' },
      { type: 'terminal', pattern: /^`/ }
    ],
    emit: 'code'
  },
  
  image: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^!\[/ },
      { type: 'balanced_brackets', capture: 'alt' },
      { type: 'terminal', pattern: /^\(/ },
      { type: 'until', pattern: /\)/, capture: 'url' },
      { type: 'terminal', pattern: /^\)/ }
    ],
    emit: 'img'
  },
  
  link: {
    type: 'sequence',
    rules: [
      { type: 'terminal', pattern: /^\[/ },
      { type: 'balanced_brackets', capture: 'text', process: 'inline' },
      { type: 'terminal', pattern: /^\(/ },
      { type: 'until', pattern: /\)/, capture: 'url' },
      { type: 'terminal', pattern: /^\)/ }
    ],
    emit: 'a'
  },
  
  text: {
    type: 'terminal',
    pattern: /^[^\\`*_\[\]!~\n<]+|^./,
    capture: 'content',
    emit: 'text'
  }
};

/**
 * Compile grammar to compact data structures
 */
function compileGrammar() {
  const compiled = {
    // Rule definitions (compact format)
    rules: {},
    // First-character dispatch table
    charMap: {},
    // HTML emission templates
    templates: {},
    // Rule IDs for compact storage
    ruleIds: {},
    // Patterns array (deduplicated)
    patterns: [],
    // Pattern map for deduplication
    patternMap: new Map()
  };
  
  let ruleIdCounter = 0;
  let patternIdCounter = 0;
  
  // Function to get or create pattern ID
  function getPatternId(pattern) {
    const key = pattern instanceof RegExp ? pattern.toString() : pattern;
    if (!compiled.patternMap.has(key)) {
      compiled.patternMap.set(key, patternIdCounter);
      compiled.patterns.push(pattern);
      patternIdCounter++;
    }
    return compiled.patternMap.get(key);
  }
  
  // Compile each rule
  for (const [name, rule] of Object.entries(GRAMMAR)) {
    const ruleId = ruleIdCounter++;
    compiled.ruleIds[name] = ruleId;
    
    // Compile rule to compact format
    const compiledRule = compileRule(rule, getPatternId);
    compiled.rules[ruleId] = compiledRule;
    
    // Build character map for block rules
    if (name !== 'document' && name !== 'inline' && name !== 'inline_element') {
      const firstPattern = findFirstPattern(rule);
      if (firstPattern) {
        const chars = extractFirstChars(firstPattern);
        for (const char of chars) {
          if (!compiled.charMap[char]) {
            compiled.charMap[char] = [];
          }
          compiled.charMap[char].push(ruleId);
        }
      }
    }
    
    // Add HTML template if rule emits
    if (rule.emit) {
      compiled.templates[rule.emit] = getTemplate(rule.emit);
    }
  }
  
  return compiled;
}

function compileRule(rule, getPatternId) {
  const compiled = { t: rule.type };
  
  switch (rule.type) {
    case 'terminal':
      compiled.p = getPatternId(rule.pattern);
      if (rule.capture) compiled.c = rule.capture;
      if (rule.optional) compiled.o = true;
      if (rule.emit) compiled.e = rule.emit;
      break;
      
    case 'sequence':
    case 'choice':
      compiled.r = rule.rules.map(r => 
        typeof r === 'string' ? r : compileRule(r, getPatternId)
      );
      if (rule.emit) compiled.e = rule.emit;
      break;
      
    case 'repetition':
      compiled.r = rule.rule;
      break;
      
    case 'until':
    case 'until_fence':
      if (rule.pattern) compiled.p = getPatternId(rule.pattern);
      if (rule.capture) compiled.c = rule.capture;
      if (rule.process) compiled.pr = rule.process;
      break;
      
    case 'balanced_brackets':
    case 'list_items':
    case 'table_row':
    case 'table_rows':
    case 'paragraph_lines':
    case 'backreference':
      // Special handlers
      if (rule.capture) compiled.c = rule.capture;
      if (rule.process) compiled.pr = rule.process;
      if (rule.ref) compiled.ref = rule.ref;
      if (rule.ordered !== undefined) compiled.o = rule.ordered;
      break;
  }
  
  return compiled;
}

function findFirstPattern(rule) {
  if (rule.type === 'terminal') return rule.pattern;
  if (rule.type === 'sequence' && rule.rules.length > 0) {
    const first = rule.rules[0];
    if (first.type === 'terminal') return first.pattern;
  }
  if (rule.type === 'choice' && rule.rules.length > 0) {
    // Return first pattern from first choice
    const first = rule.rules[0];
    if (typeof first === 'object' && first.type === 'sequence') {
      return findFirstPattern(first);
    }
  }
  return null;
}

function extractFirstChars(pattern) {
  if (!pattern) return [];
  const str = pattern.toString();
  
  // Extract literal characters from regex
  if (str.startsWith('/^')) {
    const match = str.match(/^\/\^([^[\\()|*+?{])/);
    if (match) return [match[1]];
    
    // Character class
    const classMatch = str.match(/^\/\^\[([^\]]+)\]/);
    if (classMatch) {
      const chars = classMatch[1].replace(/\\(.)/g, '$1');
      return chars.split('');
    }
    
    // Specific patterns
    if (str.includes('#')) return ['#'];
    if (str.includes('>')) return ['>'];
    if (str.includes('```')) return ['`'];
    if (str.includes('~~~')) return ['~'];
    if (str.includes('---')) return ['-'];
    if (str.includes('|')) return ['|'];
    if (str.match(/\d/)) return ['0','1','2','3','4','5','6','7','8','9'];
    if (str.includes('*') || str.includes('+') || str.includes('-')) {
      return ['*', '+', '-'];
    }
  }
  
  return [];
}

function getTemplate(name) {
  const templates = {
    heading: '<h{level}{attr}>{content}</h{level}>',
    fence: '<pre{attr}><code{lang}>{content}</code></pre>',
    hr: '<hr{attr}>',
    blockquote: '<blockquote{attr}>{content}</blockquote>',
    ol: '<ol{attr}>{items}</ol>',
    ul: '<ul{attr}>{items}</ul>',
    li: '<li{attr}>{content}</li>',
    table: '<table{attr}>\n<thead{attr}>\n<tr{attr}>\n{header}</tr>\n</thead>\n{body}</table>',
    p: '<p{attr}>{content}</p>',
    strong: '<strong{attr}>{content}</strong>',
    em: '<em{attr}>{content}</em>',
    del: '<del{attr}>{content}</del>',
    code: '<code{attr}>{content}</code>',
    a: '<a{attr} href="{url}"{rel}>{text}</a>',
    img: '<img{attr} src="{url}" alt="{alt}">',
    text: '{content}',
    escape: '{char}'
  };
  return templates[name] || '';
}

/**
 * Generate the runtime interpreter
 */
function generateRuntime(compiled) {
  // Convert Map to object for serialization
  const patternStrings = compiled.patterns.map(p => 
    p instanceof RegExp ? `/${p.source}/${p.flags}` : JSON.stringify(p)
  );
  
  return `/**
 * QuikDown Lexer - EBNF Table-Driven Parser
 * Auto-generated from EBNF grammar
 * 
 * This is a true table-driven parser with:
 * - Compact parsing tables (${Object.keys(compiled.rules).length} rules)
 * - Small runtime interpreter
 * - Character dispatch map
 */

// Parsing tables generated from EBNF
const TABLES = {
  // Compressed rule definitions
  rules: ${JSON.stringify(compiled.rules)},
  
  // Character dispatch map
  charMap: ${JSON.stringify(compiled.charMap)},
  
  // HTML templates
  templates: ${JSON.stringify(compiled.templates)},
  
  // Pattern list (deduplicated)
  patterns: [${patternStrings.join(',')}].map(p => 
    typeof p === 'string' && p.startsWith('/') ? 
      new RegExp(p.slice(1, p.lastIndexOf('/')), p.slice(p.lastIndexOf('/') + 1)) : p
  )
};

// HTML escape
const esc = s => {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  let r = '';
  for (let i = 0; i < s.length; i++) r += m[s[i]] || s[i];
  return r;
};

// Runtime interpreter
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
    this.input = input;
    this.pos = 0;
    this.captures = {};
    
    const blocks = [];
    while (this.pos < this.input.length) {
      if (this.match(/^\\n+/)) continue;
      const block = this.parseBlock();
      if (block) blocks.push(block);
    }
    
    return this.processBlocks(blocks);
  }
  
  parseBlock() {
    // Fast character dispatch
    const char = this.input[this.pos];
    const rules = TABLES.charMap[char];
    
    if (rules) {
      for (const ruleId of rules) {
        const result = this.execRule(TABLES.rules[ruleId]);
        if (result !== null) return result;
      }
    }
    
    // Try all block rules
    for (const ruleId of [2,3,4,5,6,7,8]) { // block rule IDs
      const saved = this.pos;
      const result = this.execRule(TABLES.rules[ruleId]);
      if (result !== null) return result;
      this.pos = saved;
    }
    
    // Default to paragraph
    return this.execRule(TABLES.rules[8]);
  }
  
  execRule(rule) {
    if (!rule) return null;
    
    switch (rule.t) {
      case 'terminal':
        const pattern = TABLES.patterns[rule.p];
        const match = this.match(pattern);
        if (!match && !rule.o) return null;
        if (match && rule.c) this.captures[rule.c] = match;
        if (rule.e) return this.emit(rule.e);
        return match || '';
        
      case 'sequence':
        const saved = this.pos;
        const oldCaptures = {...this.captures};
        const results = [];
        
        for (const r of rule.r) {
          const result = typeof r === 'string' ? 
            this.execRule(TABLES.rules[TABLES.ruleIds[r]]) :
            this.execRule(r);
            
          if (result === null) {
            this.pos = saved;
            this.captures = oldCaptures;
            return null;
          }
          results.push(result);
        }
        
        if (rule.e) return this.emit(rule.e);
        return results.join('');
        
      case 'choice':
        for (const r of rule.r) {
          const saved = this.pos;
          const result = typeof r === 'string' ?
            this.execRule(TABLES.rules[TABLES.ruleIds[r]]) :
            this.execRule(r);
            
          if (result !== null) return result;
          this.pos = saved;
        }
        return null;
        
      case 'repetition':
        const items = [];
        while (this.pos < this.input.length) {
          const result = this.execRule(TABLES.rules[TABLES.ruleIds[rule.r]]);
          if (result === null) break;
          items.push(result);
        }
        return items.join('');
        
      case 'until':
        const pattern2 = TABLES.patterns[rule.p];
        const content = this.scanUntil(pattern2);
        if (rule.c) this.captures[rule.c] = content;
        if (rule.pr === 'inline') {
          this.captures[rule.c] = this.parseInline(content);
        }
        return content;
        
      case 'until_fence':
        const fence = this.captures.marker;
        const idx = this.input.indexOf('\\n' + fence, this.pos);
        const fenceContent = idx !== -1 ? 
          this.input.slice(this.pos, idx) :
          this.input.slice(this.pos);
        this.pos = idx !== -1 ? idx + 1 : this.input.length;
        if (rule.c) this.captures[rule.c] = fenceContent;
        return fenceContent;
        
      case 'balanced_brackets':
        return this.parseBalancedBrackets(rule);
        
      case 'list_items':
        return this.parseListItems(rule.o);
        
      case 'table_row':
        return this.parseTableRow();
        
      case 'table_rows':
        return this.parseTableRows();
        
      case 'paragraph_lines':
        return this.parseParagraphLines(rule);
        
      case 'backreference':
        const ref = this.captures[rule.ref];
        return this.match(ref) || null;
    }
    
    return null;
  }
  
  match(pattern) {
    if (typeof pattern === 'string') {
      if (this.input.startsWith(pattern, this.pos)) {
        this.pos += pattern.length;
        return pattern;
      }
    } else if (pattern instanceof RegExp) {
      const match = this.input.slice(this.pos).match(pattern);
      if (match && match.index === 0) {
        this.pos += match[0].length;
        return match[1] || match[0];
      }
    }
    return null;
  }
  
  scanUntil(pattern) {
    const start = this.pos;
    if (typeof pattern === 'string') {
      const idx = this.input.indexOf(pattern, this.pos);
      this.pos = idx === -1 ? this.input.length : idx;
    } else {
      const match = this.input.slice(this.pos).match(pattern);
      this.pos = match ? this.pos + match.index : this.input.length;
    }
    return this.input.slice(start, this.pos);
  }
  
  parseBalancedBrackets(rule) {
    let depth = 1, text = '';
    while (this.pos < this.input.length && depth > 0) {
      const char = this.input[this.pos++];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) break;
      }
      text += char;
    }
    if (rule.c) {
      this.captures[rule.c] = rule.pr === 'inline' ? this.parseInline(text) : text;
    }
    return text;
  }
  
  parseListItems(ordered) {
    const marker = ordered ? /^\\d+\\. / : /^[*+-] /;
    const lines = [];
    
    lines.push(this.scanUntil(/\\n|$/));
    this.match(/\\n/);
    
    while (this.pos < this.input.length) {
      if (this.input[this.pos] === '\\n') break;
      if (this.match(marker)) {
        lines.push(this.scanUntil(/\\n|$/));
        this.match(/\\n/);
      } else if (this.match(/^ {2,3}/)) {
        lines.push(this.scanUntil(/\\n|$/));
        this.match(/\\n/);
      } else {
        break;
      }
    }
    
    return lines.map(line => {
      const content = this.parseInline(line);
      return '<li' + this.getAttr('li') + '>' + content + '</li>';
    }).join('\\n');
  }
  
  parseTableRow() {
    const row = this.scanUntil(/\\n|$/);
    this.match(/\\n/);
    let cells = row.split('|');
    if (!cells[0].trim()) cells.shift();
    if (!cells[cells.length - 1].trim()) cells.pop();
    return cells.map(c => c.trim());
  }
  
  parseTableRows() {
    const rows = [];
    while (this.pos < this.input.length && this.input.slice(this.pos).includes('|')) {
      rows.push(this.parseTableRow());
    }
    return rows;
  }
  
  parseParagraphLines(rule) {
    const lines = [];
    while (this.pos < this.input.length && this.input[this.pos] !== '\\n') {
      const line = this.scanUntil(/\\n|$/);
      if (line.trim()) lines.push(line);
      this.match(/\\n/);
    }
    const content = lines.join('\\n');
    if (rule.c) {
      this.captures[rule.c] = rule.pr === 'inline' ? 
        this.parseInline(content) : content;
    }
    return content;
  }
  
  parseInline(text) {
    if (!text) return '';
    let result = '', pos = 0;
    
    while (pos < text.length) {
      let matched = false;
      
      // Try inline patterns
      for (const [pattern, handler] of [
        [/^\\\\/, () => { pos++; return '\\\\'; }],
        [/^\\*\\*/, () => this.parseDelimited(text, pos, '**', 'strong')],
        [/^__/, () => this.parseDelimited(text, pos, '__', 'strong')],
        [/^\\*/, () => this.parseDelimited(text, pos, '*', 'em')],
        [/^_/, () => this.parseDelimited(text, pos, '_', 'em')],
        [/^~~/, () => this.parseDelimited(text, pos, '~~', 'del')],
        [/^\`/, () => this.parseCode(text, pos)],
        [/^!\\[/, () => this.parseImage(text, pos)],
        [/^\\[/, () => this.parseLink(text, pos)]
      ]) {
        if (pattern.test(text.slice(pos))) {
          const res = handler();
          if (res) {
            result += res.html;
            pos = res.pos;
            matched = true;
            break;
          }
        }
      }
      
      if (!matched) {
        result += esc(text[pos++]);
      }
    }
    
    return result;
  }
  
  parseDelimited(text, pos, marker, tag) {
    pos += marker.length;
    const end = text.indexOf(marker, pos);
    if (end === -1) return null;
    
    const content = this.parseInline(text.slice(pos, end));
    const html = '<' + tag + this.getAttr(tag) + '>' + content + '</' + tag + '>';
    return { html, pos: end + marker.length };
  }
  
  parseCode(text, pos) {
    pos++;
    const end = text.indexOf('\`', pos);
    if (end === -1) return null;
    
    const content = text.slice(pos, end);
    const html = '<code' + this.getAttr('code') + '>' + esc(content) + '</code>';
    return { html, pos: end + 1 };
  }
  
  parseLink(text, pos) {
    pos++;
    let depth = 1, linkText = '';
    
    while (pos < text.length && depth > 0) {
      if (text[pos] === '[') depth++;
      else if (text[pos] === ']') {
        depth--;
        if (depth === 0) break;
      }
      linkText += text[pos++];
    }
    
    if (depth === 0 && text[++pos] === '(') {
      pos++;
      const urlEnd = text.indexOf(')', pos);
      if (urlEnd !== -1) {
        const url = text.slice(pos, urlEnd);
        const html = '<a' + this.getAttr('a') + ' href="' + esc(this.sanitizeUrl(url)) + '">' + 
                     this.parseInline(linkText) + '</a>';
        return { html, pos: urlEnd + 1 };
      }
    }
    
    return null;
  }
  
  parseImage(text, pos) {
    pos += 2;
    let depth = 1, alt = '';
    
    while (pos < text.length && depth > 0) {
      if (text[pos] === '[') depth++;
      else if (text[pos] === ']') {
        depth--;
        if (depth === 0) break;
      }
      alt += text[pos++];
    }
    
    if (depth === 0 && text[++pos] === '(') {
      pos++;
      const urlEnd = text.indexOf(')', pos);
      if (urlEnd !== -1) {
        const url = text.slice(pos, urlEnd);
        const html = '<img' + this.getAttr('img') + ' src="' + esc(this.sanitizeUrl(url)) + 
                     '" alt="' + esc(alt) + '">';
        return { html, pos: urlEnd + 1 };
      }
    }
    
    return null;
  }
  
  emit(type) {
    const template = TABLES.templates[type];
    if (!template) return '';
    
    let html = template;
    
    // Replace placeholders
    for (const [key, value] of Object.entries(this.captures)) {
      html = html.replace(new RegExp('{' + key + '}', 'g'), value || '');
    }
    
    // Handle special replacements
    if (type === 'heading') {
      const level = (this.captures.level || '#').length;
      html = html.replace(/{level}/g, level);
    }
    
    if (type === 'fence') {
      const lang = this.captures.lang;
      const langAttr = lang && !this.opts.inline_styles ? 
        ' class="language-' + lang.trim() + '"' : '';
      html = html.replace(/{lang}/g, langAttr);
      html = html.replace(/{content}/g, esc(this.captures.content || ''));
      
      if (this.opts.fence_plugin) {
        const result = this.opts.fence_plugin(this.captures.content, lang);
        if (result !== undefined) return result;
      }
    }
    
    html = html.replace(/{attr}/g, '');
    html = html.replace(/{rel}/g, '');
    
    return html;
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
  
  getAttr(tag) {
    if (tag === 'p') return '';
    if (this.opts.inline_styles) {
      const styles = ${JSON.stringify(styles)};
      const style = styles[tag];
      return style ? ' style="' + style + '"' : '';
    }
    return ' class="' + this.opts.class_prefix + tag + '"';
  }
  
  sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (this.opts.allow_unsafe_urls) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || 
        lower.startsWith('data:') && !lower.startsWith('data:image/')) {
      return '#';
    }
    return trimmed;
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
 * Build the table-driven lexer
 */
export default async function build() {
  console.log('🔨 Building table-driven EBNF lexer...');
  
  // Compile grammar to tables
  console.log('  📝 Compiling grammar to tables...');
  const compiled = compileGrammar();
  
  console.log(`  📊 Grammar stats:`);
  console.log(`     - ${Object.keys(compiled.rules).length} rules`);
  console.log(`     - ${compiled.patterns.length} unique patterns`);
  console.log(`     - ${Object.keys(compiled.charMap).length} dispatch characters`);
  
  // Generate runtime
  console.log('  🔧 Generating runtime...');
  let code = generateRuntime(compiled);
  
  // Add version
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
  );
  code = code.replace(/__QUIKDOWN_VERSION__/g, packageJson.version);
  
  // Styles are already inlined
  
  // Write output
  const outputPath = path.join(__dirname, 'quikdown_lex_table.js');
  fs.writeFileSync(outputPath, code);
  
  console.log(`  💾 Written to: quikdown_lex_table.js`);
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
    mangle: {
      properties: {
        regex: /^_/
      }
    }
  });
  
  fs.writeFileSync(path.join(__dirname, 'quikdown_lex_table.min.js'), minified.code);
  console.log(`  🗜️  Minified size: ${(minified.code.length / 1024).toFixed(1)}KB`);
  
  // Compare with Grammar1
  const grammar1Path = path.join(__dirname, 'grammar1/quikdown_lex.min.js');
  if (fs.existsSync(grammar1Path)) {
    const grammar1Size = fs.statSync(grammar1Path).size / 1024;
    const tableSize = minified.code.length / 1024;
    const diff = ((tableSize - grammar1Size) / grammar1Size * 100).toFixed(1);
    
    console.log(`\n📊 Size comparison:`);
    console.log(`  Grammar1:    ${grammar1Size.toFixed(1)}KB`);
    console.log(`  Table-driven: ${tableSize.toFixed(1)}KB`);
    console.log(`  Difference:   ${diff > 0 ? '+' : ''}${diff}%`);
  }
  
  console.log('\n✅ Build complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch(console.error);
}