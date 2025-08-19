/**
 * quikdown (lexer+AST prototype) – minimal Markdown → HTML tuned for chat/LLM
 * - Pure JS, no deps. Hand-rolled line tokenizer + small block parser + inline pass.
 * - Feature parity goal with original quikdown: headings, hr, fences (```/~~~ 3+),
 *   blockquotes, ordered/unordered lists (+ task lists), tables (GFM-lite),
 *   images/links with URL sanitization, autolinks, bold/italic/strike, inline code,
 *   optional inline styles vs classes, fence_plugin hook, emitStyles, configure, version.
 */

const STYLE_MAP = {
  h1: 'margin-top:0.5em;margin-bottom:0.3em',
  h2: 'margin-top:0.5em;margin-bottom:0.3em',
  h3: 'margin-top:0.5em;margin-bottom:0.3em',
  h4: 'margin-top:0.5em;margin-bottom:0.3em',
  h5: 'margin-top:0.5em;margin-bottom:0.3em',
  h6: 'margin-top:0.5em;margin-bottom:0.3em',
  pre: 'background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0',
  code: 'background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace',
  blockquote: 'border-left:4px solid #ddd;margin-left:0;padding-left:1em;color:#666',
  table: 'border-collapse:collapse;width:100%;margin:1em 0',
  th: 'border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left',
  td: 'border:1px solid #ddd;padding:8px;text-align:left',
  hr: 'border:none;border-top:1px solid #ddd;margin:1em 0',
  img: 'max-width:100%;height:auto',
  a: 'color:#06c;text-decoration:underline',
  strong: 'font-weight:bold',
  em: 'font-style:italic',
  del: 'text-decoration:line-through',
  ul: 'margin:0.5em 0;padding-left:2em',
  ol: 'margin:0.5em 0;padding-left:2em',
  li: 'margin:0.25em 0'
};

function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));}

function sanitizeUrl(u, allowUnsafe){
  if(!u) return '';
  if(allowUnsafe) return u.trim();
  const url = u.trim();
  if(/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if(/^data:image\//i.test(url)) return url;
  return '#';
}

function makeGetAttr({inline_styles,class_prefix}){
  return (tag, extra='')=>{
    if(inline_styles){
      const base = STYLE_MAP[tag]||'';
      const style = extra ? (base? base+';'+extra : extra) : base;
      return style?` style="${style}"`:'';
    }
    return ` class="${class_prefix}${tag}"`;
  };
}

// Token types (line-oriented)
const T={
  BLANK:'BLANK',
  HEADING:'HEADING', // {level, text}
  HR:'HR',
  FENCE_OPEN:'FENCE_OPEN', // {marker, count, info}
  FENCE_CLOSE:'FENCE_CLOSE',
  BQ:'BQ', // {depth, text}
  OLIST:'OLIST', // {indent, text, index}
  ULIST:'ULIST', // {indent, text, bullet}
  TABLE_SEP:'TABLE_SEP', // {align:[]}
  TABLE_ROW:'TABLE_ROW', // {cells:[]}
  TEXT:'TEXT'
};

function detab(s){return s.replace(/\t/g,'    ');} // tabs=>4
function indentLevel(s){const m=/^(\s*)/.exec(s); return Math.floor((m?m[1].length:0)/2);} // 2-space level

function isHr(line){return /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);}
function headingTok(line){const m=/^ {0,3}(#{1,6})\s+(.*?)(?:\s*#*\s*)?$/.exec(line); if(!m) return null; return {type:T.HEADING, level:m[1].length, text:m[2]};}
function fenceOpenTok(line){const m=/^ {0,3}([`~])\1{2,}\s*([^\n]*)$/.exec(line); if(!m) return null; const marker=m[1]; const count=(line.match(new RegExp(`^ {0,3}\${marker}+`))[0].trim().length); return {type:T.FENCE_OPEN, marker, count, info:(m[2]||'').trim()};}
function fenceCloseTok(line, open){if(!open) return null; const re=new RegExp(`^ {0,3}\${open.marker}{${open.count},}\s*$`); return re.test(line)?{type:T.FENCE_CLOSE}:null;}
function bqTok(line){const m=/^ {0,3}(>+)\s?(.*)$/.exec(line); if(!m) return null; return {type:T.BQ, depth:m[1].length, text:m[2]};}
function olistTok(line){const m=/^ {0,}(\s*)(\d+)\.\s+(.*)$/.exec(line); if(!m) return null; return {type:T.OLIST, indent:indentLevel(m[1]), index:parseInt(m[2],10), text:m[3]};}
function ulistTok(line){const m=/^ {0,}(\s*)([*+-])\s+(.*)$/.exec(line); if(!m) return null; return {type:T.ULIST, indent:indentLevel(m[1]), bullet:m[2], text:m[3]};}
function tableSepTok(line){const s=line.trim(); if(!/\|/.test(s)) return null; const body=s.replace(/^\|/,'').replace(/\|$/,''); if(!/^\s*:?[-]{3,}:?\s*(\|\s*:?[-]{3,}:?\s*)*$/.test(body)) return null; const aligns=body.split('|').map(cell=>{const t=cell.trim(); if(/^:?-{3,}:?$/.test(t)){ if(t.startsWith(':')&&t.endsWith(':')) return 'center'; if(t.endsWith(':')) return 'right'; } return 'left';}); return {type:T.TABLE_SEP, align:aligns};}
function tableRowTok(line){ if(!/\|/.test(line)) return null; const body=line.trim().replace(/^\|/,'').replace(/\|$/,''); const cells=body.split('|').map(c=>c.trim()); return {type:T.TABLE_ROW, cells};}

function tokenize(md){
  const lines = md.split(/\r?\n/).map(detab);
  const toks=[]; let fence=null;
  for(let i=0;i<lines.length;i++){
    const raw=lines[i]; const line=raw; if(fence){ // inside fence, only check close
      if(fenceCloseTok(line, fence)) { toks.push({type:T.FENCE_CLOSE}); fence=null; } else { toks.push({type:'FENCE_TEXT', text:raw}); }
      continue;
    }
    if(/^\s*$/.test(line)){ toks.push({type:T.BLANK}); continue; }
    const h=headingTok(line); if(h){ toks.push(h); continue; }
    if(isHr(line)){ toks.push({type:T.HR}); continue; }
    const fo=fenceOpenTok(line); if(fo){ toks.push(fo); fence=fo; continue; }
    const bq=bqTok(line); if(bq){ toks.push(bq); continue; }
    const ol=olistTok(line); if(ol){ toks.push(ol); continue; }
    const ul=ulistTok(line); if(ul){ toks.push(ul); continue; }
    const sep=tableSepTok(line); if(sep){ toks.push(sep); continue; }
    const tr=tableRowTok(line); if(tr){ toks.push(tr); continue; }
    toks.push({type:T.TEXT, text:raw});
  }
  return toks;
}

// AST nodes: {type, ...}
function parseBlocks(toks){
  const nodes=[]; let i=0;
  const peek=()=>toks[i]; const next=()=>toks[i++];

  function parseParagraph(){
    const parts=[]; while(i<toks.length){
      const t=peek(); if(!t) break;
      if([T.BLANK,T.HEADING,T.HR,T.FENCE_OPEN,T.BQ,T.OLIST,T.ULIST,T.TABLE_ROW,T.TABLE_SEP].includes(t.type)) break;
      if(t.type===T.TEXT){ parts.push(next().text); continue; }
      break;
    }
    return {type:'Paragraph', text:parts.join('\n')};
  }

  function parseFence(open){
    const lines=[]; while(i<toks.length){ const t=next(); if(!t) break; if(t.type==='FENCE_TEXT'){ lines.push(t.text); continue; } if(t.type===T.FENCE_CLOSE) break; }
    return {type:'Fence', lang:open.info.split(/\s+/)[0]||'', code:lines.join('\n')};
  }

  function parseBlockquote(){
    const innerLines=[]; let startDepth=peek().depth;
    while(i<toks.length){ const t=peek(); if(!t||t.type!==T.BQ||t.depth<startDepth) break; innerLines.push(next().text); if(i<toks.length && toks[i]?.type===T.BLANK){ innerLines.push(''); i++; }
    }
    // recurse by parsing inner block string
    const inner=quikdown(innerLines.join('\n'), _currentOptions, true); // returns HTML; but for AST we want nodes; quick approach: parse again via tokenizer
    // Simpler: parse recursively via tokenize+parseBlocks
    const innerNodes=parseBlocks(tokenize(innerLines.join('\n')));
    return {type:'Blockquote', children:innerNodes};
  }

  function parseList(first){
    const ordered = first.type===T.OLIST;
    const base = first.indent;
    const stack=[{type:'List', ordered, items:[], indent:base}];
    function addItem(item, lvl){
      while(stack.length && lvl<stack[stack.length-1].indent){ stack.pop(); }
      while(lvl>stack[stack.length-1].indent){ // open nested list
        const sub={type:'List', ordered:item.type===T.OLIST, items:[], indent:lvl};
        const parent=stack[stack.length-1];
        if(parent.items.length===0||parent.items[parent.items.length-1].type!=='ListItem') parent.items.push({type:'ListItem', children:[]});
        parent.items[parent.items.length-1].children.push(sub);
        stack.push(sub);
      }
      const cur=stack[stack.length-1];
      cur.items.push({type:'ListItem', text:item.text, ordered:item.type===T.OLIST});
    }
    addItem(first, first.indent);
    while(i<toks.length){
      const t=peek(); if(!t) break;
      if(t.type!==T.OLIST && t.type!==T.ULIST) break;
      if(Math.abs(t.indent-base)>20) break; // safety
      addItem(next(), t.indent);
    }
    return stack[0];
  }

  function parseTable(headerRow){
    const header=headerRow.cells; let align=null; const rows=[];
    if(i<toks.length && peek().type===T.TABLE_SEP){ align=next().align; }
    while(i<toks.length && peek().type===T.TABLE_ROW){ rows.push(next().cells); }
    return {type:'Table', header, align, rows};
  }

  while(i<toks.length){
    const t=next(); if(!t) break;
    if(t.type===T.BLANK) continue;
    if(t.type===T.HEADING){ nodes.push({type:'Heading', level:t.level, text:t.text}); continue; }
    if(t.type===T.HR){ nodes.push({type:'Hr'}); continue; }
    if(t.type===T.FENCE_OPEN){ nodes.push(parseFence(t)); continue; }
    if(t.type===T.BQ){ i--; nodes.push(parseBlockquote()); continue; }
    if(t.type===T.OLIST||t.type===T.ULIST){ nodes.push(parseList(t)); continue; }
    if(t.type===T.TABLE_ROW){ nodes.push(parseTable(t)); continue; }
    if(t.type===T.TEXT){ i--; nodes.push(parseParagraph()); continue; }
  }
  return nodes;
}

// Inline processing on leaf text
function processInline(text, getAttr, allowUnsafe){
  if(!text) return '';
  // protect inline code
  const codes=[]; text=text.replace(/`([^`]+)`/g,(m,c)=>{const i=codes.length; codes.push(escapeHtml(c)); return `%%%IC${i}%%%`;});
  // escape rest
  text=escapeHtml(text);
  // images
  text=text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(m,alt,src)=>`<img${getAttr('img')} src="${sanitizeUrl(src,allowUnsafe)}" alt="${alt}">`);
  // links
  text=text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(m,label,href)=>`<a${getAttr('a')} href="${sanitizeUrl(href,allowUnsafe)}" rel="noopener noreferrer">${label}</a>`);
  // autolinks (trim trailing common punctuation)
  text=text.replace(/(^|\s)(https?:\/\/[^\s<]+[^\s<\.)\]\!\?,;:])/g,(m,prefix,url)=>`${prefix}<a${getAttr('a')} href="${sanitizeUrl(url,allowUnsafe)}" rel="noopener noreferrer">${url}</a>`);
  // strong
  text=text.replace(/\*\*(.+?)\*\*/g,`<strong${getAttr('strong')}>$1</strong>`).replace(/__(.+?)__/g,`<strong${getAttr('strong')}>$1</strong>`);
  // em (lookbehind-free heuristics)
  text=text.replace(/(\s|^)\/\*(?!\s)([^*]+?)\*(?=\s|$)/g,`$1<em${getAttr('em')}>$2</em>`);
  text=text.replace(/(\s|^)_(?!\s)([^_]+?)_(?=\s|$)/g,`$1<em${getAttr('em')}>$2</em>`);
  // strike
  text=text.replace(/~~(.+?)~~/g,`<del${getAttr('del')}>$1</del>`);
  // line breaks (two spaces at EOL)
  text=text.replace(/  (\n|$)/g,`<br${getAttr('br')}>$1`);
  // restore inline code
  text=text.replace(/%%%IC(\d+)%%%/g,(m,i)=>`<code${getAttr('code')}>${codes[+i]|''}</code>`);
  return text;
}

function render(nodes, options){
  const getAttr = makeGetAttr(options);
  const allowUnsafe = !!options.allow_unsafe_urls;
  function r(node){
    switch(node.type){
      case 'Heading': return `<h${node.level}${getAttr('h'+node.level)}>${processInline(node.text,getAttr,allowUnsafe)}</h${node.level}>`;
      case 'Paragraph': return `<p>${processInline(node.text,getAttr,allowUnsafe)}</p>`;
      case 'Hr': return `<hr${getAttr('hr')}>`;
      case 'Fence':{
        const lang=node.lang||'';
        if(options.fence_plugin){ const out=options.fence_plugin(node.code, lang); if(out!==undefined) return out; }
        const langCls = !options.inline_styles && lang ? ` class="language-${lang}"` : '';
        const codeAttr = options.inline_styles ? getAttr('code') : langCls;
        const safe = escapeHtml(node.code);
        return `<pre${getAttr('pre')}><code${codeAttr}>${safe}</code></pre>`;
      }
      case 'Blockquote': return `<blockquote${getAttr('blockquote')}>${node.children.map(r).join('\n')}</blockquote>`;
      case 'List':{
        const tag=node.ordered?'ol':'ul';
        const open=`<${tag}${getAttr(tag)}>`; const close=`</${tag}>`;
        const items=node.items.map(it=>{
          // task list: [ ] or [x] at start of text (unordered only)
          let content=it.text||'';
          let liAttr=getAttr('li');
          if(!node.ordered){
            const m=/^\[([xX\s])\]\s+(.*)$/.exec(content);
            if(m){
              const checked=/x/i.test(m[1]);
              const checkboxAttr = options.inline_styles ? ' style="margin-right:.5em"' : ' class="'+options.class_prefix+'task-checkbox"';
              liAttr = options.inline_styles ? ' style="list-style:none"' : ' class="'+options.class_prefix+'task-item"';
              content = `<input type="checkbox"${checkboxAttr}${checked?' checked':''} disabled> ${m[2]}`;
            }
          }
          return `<li${liAttr}>${processInline(content,getAttr,allowUnsafe)}${(it.children?it.children.map(r).join(''):'')}</li>`;
        }).join('');
        return open+items+close;
      }
      case 'Table':{
        const thead = `<thead>${`<tr${getAttr('tr')}>`+node.header.map((c,i)=>{
          const a=(node.align&&node.align[i]&&node.align[i]!=='left')?`text-align:${node.align[i]}`:'';
          return `<th${getAttr('th',a)}>${processInline(c,getAttr,allowUnsafe)}</th>`;}).join('')}</tr></thead>`;
        const tbody = node.rows.length?`<tbody>${node.rows.map(row=>`<tr${getAttr('tr')}>${row.map((c,i)=>{
          const a=(node.align&&node.align[i]&&node.align[i]!=='left')?`text-align:${node.align[i]}`:'';
          return `<td${getAttr('td',a)}>${processInline(c,getAttr,allowUnsafe)}</td>`;}).join('')}</tr>`).join('')}</tbody>`:'';
        return `<table${getAttr('table')}>${thead}${tbody}</table>`;
      }
      default: return '';
    }
  }
  return nodes.map(r).join('\n').trim();
}

function quikdown(markdown, options={}, _internal){
  if(!markdown||typeof markdown!=="string") return '';
  const opts={
    inline_styles: !!options.inline_styles,
    class_prefix: options.class_prefix||'quikdown-',
    fence_plugin: options.fence_plugin,
    allow_unsafe_urls: !!options.allow_unsafe_urls
  };
  // store options for nested parse (blockquote)
  _currentOptions = opts;
  const toks = tokenize(markdown);
  const ast = parseBlocks(toks);
  return render(ast, opts);
}

// keep a module-scoped reference for recursive blockquote parsing
let _currentOptions={inline_styles:false,class_prefix:'quikdown-'};

quikdown.emitStyles = function(class_prefix='quikdown-'){
  let css=''; for(const [tag,style] of Object.entries(STYLE_MAP)){ if(style) css+=`.${class_prefix}${tag}{${style}}\n`; }
  // task list classes (used conditionally)
  css+=`.${class_prefix}task-item{list-style:none}\n.${class_prefix}task-checkbox{margin-right:.5em}\n`;
  return css;
};

quikdown.configure = (options)=> (markdown)=> quikdown(markdown, options);
quikdown.version = 'dev-lexer-ast';

// CJS + browser global + ESM default
if(typeof module!=='undefined' && module.exports){ module.exports = quikdown; }
if(typeof window!=='undefined'){ window.quikdown = quikdown; }
export default quikdown;
