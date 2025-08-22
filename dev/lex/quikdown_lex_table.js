/**
 * QuikDown Lexer - EBNF Table-Driven Parser
 * Auto-generated from EBNF grammar
 * 
 * This is a true table-driven parser with:
 * - Compact parsing tables (22 rules)
 * - Small runtime interpreter
 * - Character dispatch map
 */

// Parsing tables generated from EBNF
const TABLES = {
  // Compressed rule definitions
  rules: {"0":{"t":"repetition","r":"block"},"1":{"t":"choice","r":["heading","fence","hr","blockquote","list","table","paragraph","blank_line"]},"2":{"t":"sequence","r":[{"t":"terminal","p":0}]},"3":{"t":"sequence","r":[{"t":"terminal","p":1,"c":"level"},{"t":"terminal","p":2},{"t":"until","p":3,"c":"content","pr":"inline"},{"t":"terminal","p":4,"o":true},{"t":"terminal","p":5}],"e":"heading"},"4":{"t":"sequence","r":[{"t":"terminal","p":6,"c":"marker"},{"t":"until","p":3,"c":"lang"},{"t":"terminal","p":7},{"t":"until_fence","c":"content"},{"t":"backreference","ref":"marker"},{"t":"terminal","p":8}],"e":"fence"},"5":{"t":"sequence","r":[{"t":"terminal","p":9},{"t":"terminal","p":5}],"e":"hr"},"6":{"t":"sequence","r":[{"t":"terminal","p":10},{"t":"until","p":3,"c":"content","pr":"inline"},{"t":"terminal","p":5}],"e":"blockquote"},"7":{"t":"choice","r":["ordered_list","unordered_list"]},"8":{"t":"sequence","r":[{"t":"terminal","p":11,"c":"marker"},{"t":"list_items","o":true}],"e":"ol"},"9":{"t":"sequence","r":[{"t":"terminal","p":12,"c":"marker"},{"t":"list_items","o":false}],"e":"ul"},"10":{"t":"sequence","r":[{"t":"table_row","c":"header"},{"t":"terminal","p":13},{"t":"terminal","p":7},{"t":"table_rows","c":"rows"}],"e":"table"},"11":{"t":"sequence","r":[{"t":"paragraph_lines","c":"content","pr":"inline"}],"e":"p"},"12":{"t":"repetition","r":"inline_element"},"13":{"t":"choice","r":["escape","strong","emphasis","strikethrough","code","image","link","text"]},"14":{"t":"sequence","r":[{"t":"terminal","p":14},{"t":"terminal","p":15,"c":"char"}],"e":"escape"},"15":{"t":"choice","r":[{"t":"sequence","r":[{"t":"terminal","p":16},{"t":"until","p":17,"c":"content","pr":"inline"},{"t":"terminal","p":16}]},{"t":"sequence","r":[{"t":"terminal","p":18},{"t":"until","p":19,"c":"content","pr":"inline"},{"t":"terminal","p":18}]}],"e":"strong"},"16":{"t":"choice","r":[{"t":"sequence","r":[{"t":"terminal","p":20},{"t":"until","p":21,"c":"content","pr":"inline"},{"t":"terminal","p":22}]},{"t":"sequence","r":[{"t":"terminal","p":23},{"t":"until","p":24,"c":"content","pr":"inline"},{"t":"terminal","p":25}]}],"e":"em"},"17":{"t":"sequence","r":[{"t":"terminal","p":26},{"t":"until","p":27,"c":"content","pr":"inline"},{"t":"terminal","p":26}],"e":"del"},"18":{"t":"sequence","r":[{"t":"terminal","p":28},{"t":"until","p":29,"c":"content"},{"t":"terminal","p":28}],"e":"code"},"19":{"t":"sequence","r":[{"t":"terminal","p":30},{"t":"balanced_brackets","c":"alt"},{"t":"terminal","p":31},{"t":"until","p":32,"c":"url"},{"t":"terminal","p":33}],"e":"img"},"20":{"t":"sequence","r":[{"t":"terminal","p":34},{"t":"balanced_brackets","c":"text","pr":"inline"},{"t":"terminal","p":31},{"t":"until","p":32,"c":"url"},{"t":"terminal","p":33}],"e":"a"},"21":{"t":"terminal","p":35,"c":"content","e":"text"}},
  
  // Character dispatch map
  charMap: {"*":[2,8,9,15,16,21],"+":[2,8,9,15,16],"-":[2,5,8,9,15,16],"#":[3],"`":[4,18,21],">":[6],"~":[17],"!":[19],"^":[21],"\\":[21,21],"_":[21],"[":[21]},
  
  // HTML templates
  templates: {"heading":"<h{level}{attr}>{content}</h{level}>","fence":"<pre{attr}><code{lang}>{content}</code></pre>","hr":"<hr{attr}>","blockquote":"<blockquote{attr}>{content}</blockquote>","ol":"<ol{attr}>{items}</ol>","ul":"<ul{attr}>{items}</ul>","table":"<table{attr}>\n<thead{attr}>\n<tr{attr}>\n{header}</tr>\n</thead>\n{body}</table>","p":"<p{attr}>{content}</p>","escape":"{char}","strong":"<strong{attr}>{content}</strong>","em":"<em{attr}>{content}</em>","del":"<del{attr}>{content}</del>","code":"<code{attr}>{content}</code>","img":"<img{attr} src=\"{url}\" alt=\"{alt}\">","a":"<a{attr} href=\"{url}\"{rel}>{text}</a>","text":"{content}"},
  
  // Pattern list (deduplicated)
  patterns: [/^\n+/,/^(#{1,6})(?= )/,/^ +/,/\n|$/,/\s*#+\s*$/,/\n?/,/^(```|~~~)/,/\n/,/[^\n]*\n?/,/^---+\s*$/,/^> ?/,/^\d+\. /,/^[*+-] /,/^[\s\|:\-]+$/,/^\\/,/^./,/^\*\*/,/\*\*/,/^__/,/__/,/^\*(?!\*)/,/\*/,/^\*/,/^_(?!_)/,/_/,/^_/,/^~~/,/~~/,/^`/,/`/,/^!\[/,/^\(/,/\)/,/^\)/,/^\[/,/^[^\\`*_\[\]!~\n<]+|^./].map(p => 
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
      if (this.match(/^\n+/)) continue;
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
        const idx = this.input.indexOf('\n' + fence, this.pos);
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
    const marker = ordered ? /^\d+\. / : /^[*+-] /;
    const lines = [];
    
    lines.push(this.scanUntil(/\n|$/));
    this.match(/\n/);
    
    while (this.pos < this.input.length) {
      if (this.input[this.pos] === '\n') break;
      if (this.match(marker)) {
        lines.push(this.scanUntil(/\n|$/));
        this.match(/\n/);
      } else if (this.match(/^ {2,3}/)) {
        lines.push(this.scanUntil(/\n|$/));
        this.match(/\n/);
      } else {
        break;
      }
    }
    
    return lines.map(line => {
      const content = this.parseInline(line);
      return '<li' + this.getAttr('li') + '>' + content + '</li>';
    }).join('\n');
  }
  
  parseTableRow() {
    const row = this.scanUntil(/\n|$/);
    this.match(/\n/);
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
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      const line = this.scanUntil(/\n|$/);
      if (line.trim()) lines.push(line);
      this.match(/\n/);
    }
    const content = lines.join('\n');
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
        [/^\\/, () => { pos++; return '\\'; }],
        [/^\*\*/, () => this.parseDelimited(text, pos, '**', 'strong')],
        [/^__/, () => this.parseDelimited(text, pos, '__', 'strong')],
        [/^\*/, () => this.parseDelimited(text, pos, '*', 'em')],
        [/^_/, () => this.parseDelimited(text, pos, '_', 'em')],
        [/^~~/, () => this.parseDelimited(text, pos, '~~', 'del')],
        [/^`/, () => this.parseCode(text, pos)],
        [/^!\[/, () => this.parseImage(text, pos)],
        [/^\[/, () => this.parseLink(text, pos)]
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
    const end = text.indexOf('`', pos);
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
  
  getAttr(tag) {
    if (tag === 'p') return '';
    if (this.opts.inline_styles) {
      const styles = {"h1":"font-size:2em;font-weight:600;margin:.67em 0","h2":"font-size:1.5em;font-weight:600;margin:.83em 0","h3":"font-size:1.25em;font-weight:600;margin:1em 0","h4":"font-size:1em;font-weight:600;margin:1.33em 0","h5":"font-size:.875em;font-weight:600;margin:1.67em 0","h6":"font-size:.85em;font-weight:600;margin:2em 0","pre":"background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0","code":"background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace","blockquote":"border-left:4px solid #ddd;margin-left:0;padding-left:1em","table":"border-collapse:collapse;width:100%;margin:1em 0","th":"border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left","td":"border:1px solid #ddd;padding:8px;text-align:left","hr":"border:none;border-top:1px solid #ddd;margin:1em 0","img":"max-width:100%;height:auto","a":"color:#06c;text-decoration:underline","strong":"font-weight:bold","em":"font-style:italic","del":"text-decoration:line-through","ul":"margin:.5em 0;padding-left:2em","ol":"margin:.5em 0;padding-left:2em","li":"margin:.25em 0","br":"","p":"margin:1em 0"};
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