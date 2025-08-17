/**
 * Ultra-optimized lexer-based quikdown
 * Hand-coded state machine with minimal overhead
 */

// Compact style map - shortened keys, no spaces after colons
const S={h1:'font-size:2em;font-weight:600;margin:.67em 0;text-align:left',h2:'font-size:1.5em;font-weight:600;margin:.83em 0',h3:'font-size:1.25em;font-weight:600;margin:1em 0',h4:'font-size:1em;font-weight:600;margin:1.33em 0',h5:'font-size:.875em;font-weight:600;margin:1.67em 0',h6:'font-size:.85em;font-weight:600;margin:2em 0',pre:'background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0',code:'background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace',blockquote:'border-left:4px solid #ddd;margin-left:0;padding-left:1em',table:'border-collapse:collapse;width:100%;margin:1em 0',th:'border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left',td:'border:1px solid #ddd;padding:8px;text-align:left',hr:'border:none;border-top:1px solid #ddd;margin:1em 0',img:'max-width:100%;height:auto',a:'color:#06c;text-decoration:underline',strong:'font-weight:bold',em:'font-style:italic',del:'text-decoration:line-through',ul:'margin:.5em 0;padding-left:2em',ol:'margin:.5em 0;padding-left:2em',li:'margin:.25em 0'};

// Escape map
const E={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

// Token types as numbers for speed
const T_TEXT=0,T_H=1,T_HR=2,T_FENCE_OPEN=3,T_FENCE_CLOSE=4,T_BQ=5,T_UL=6,T_OL=7,T_TABLE=8,T_BLANK=9;

// Ultra-compact tokenizer + parser + renderer in one pass
function quikdown(md,opt={}){
  if(!md||typeof md!=='string')return'';
  
  const lines=md.split('\n');
  const o=[];  // output buffer
  const inline=opt.inline_styles;
  const pfx=opt.class_prefix||'quikdown-';
  const unsafeUrl=opt.allow_unsafe_urls;
  
  // Attribute helper
  const A=(t,x='')=>inline?(S[t]||x?` style="${x?S[t]?S[t]+';'+x:x:S[t]}"`:``):` class="${pfx}${t}"`;
  
  // HTML escape
  const H=s=>s.replace(/[&<>"']/g,m=>E[m]);
  
  // URL sanitize
  const U=(u)=>{
    if(!u)return'';
    if(unsafeUrl)return u;
    const t=u.trim(),l=t.toLowerCase();
    if(/^(javascript|vbscript|data):/i.test(l)&&!/^data:image\//i.test(l))return'#';
    return t;
  };
  
  // Inline processing with single pass
  const I=(t)=>{
    if(!t)return'';
    // Protect inline code first
    const codes=[];
    t=t.replace(/`([^`]+)`/g,(_,c)=>{
      codes.push(H(c));
      return`\x01${codes.length-1}\x02`;
    });
    
    // Escape HTML
    t=H(t);
    
    // Process inline elements in order
    // Images
    t=t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(_,a,s)=>`<img${A('img')} src="${U(s)}" alt="${a}">`);
    // Links  
    t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,x,h)=>{
      const url=U(h);
      const rel=/^https?:\/\//i.test(url)?' rel="noopener noreferrer"':'';
      return`<a${A('a')} href="${url}"${rel}>${x}</a>`;
    });
    // Autolinks
    t=t.replace(/(^|\s)(https?:\/\/[^\s<]+)/g,(_,p,u)=>`${p}<a${A('a')} href="${U(u)}" rel="noopener noreferrer">${u}</a>`);
    // Bold
    t=t.replace(/\*\*(.+?)\*\*/g,`<strong${A('strong')}>$1</strong>`);
    t=t.replace(/__(.+?)__/g,`<strong${A('strong')}>$1</strong>`);
    // Italic - fixed to handle single asterisk properly
    t=t.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g,`<em${A('em')}>$1</em>`);
    t=t.replace(/(?<!_)_(?!_)([^_]+)_(?!_)/g,`<em${A('em')}>$1</em>`);
    // Strike
    t=t.replace(/~~(.+?)~~/g,`<del${A('del')}>$1</del>`);
    // Line breaks
    t=t.replace(/  $/gm,`<br${A('br')}>`);
    // Restore codes
    t=t.replace(/\x01(\d+)\x02/g,(_,i)=>`<code${A('code')}>${codes[i]}</code>`);
    
    return t;
  };
  
  let i=0;
  let fence=null;
  let para=[];
  let list=null;
  let table=null;
  let bq=[];
  
  const flushPara=()=>{
    if(para.length){
      o.push(`<p>${I(para.join('\n'))}</p>`);
      para=[];
    }
  };
  
  const flushList=()=>{
    if(list){
      o.push(list.html+'</'+list.tag+'>');
      list=null;
    }
  };
  
  const flushTable=()=>{
    if(table){
      let h='<table'+A('table')+'>';
      if(table.head){
        h+='<thead><tr'+A('tr')+'>';
        table.head.forEach((c,i)=>{
          const align=table.align&&table.align[i]!=='left'?`text-align:${table.align[i]}`:'';
          h+=`<th${A('th',align)}>${I(c)}</th>`;
        });
        h+='</tr></thead>';
      }
      if(table.rows.length){
        h+='<tbody>';
        table.rows.forEach(r=>{
          h+='<tr'+A('tr')+'>';
          r.forEach((c,i)=>{
            const align=table.align&&table.align[i]!=='left'?`text-align:${table.align[i]}`:'';
            h+=`<td${A('td',align)}>${I(c)}</td>`;
          });
          h+='</tr>';
        });
        h+='</tbody>';
      }
      o.push(h+'</table>');
      table=null;
    }
  };
  
  const flushBq=()=>{
    if(bq.length){
      // Recursively process blockquote content
      const inner=quikdown(bq.join('\n'),opt);
      o.push(`<blockquote${A('blockquote')}>${inner}</blockquote>`);
      bq=[];
    }
  };
  
  while(i<lines.length){
    const line=lines[i];
    const trimmed=line.trim();
    
    // Inside fence?
    if(fence){
      if(trimmed===fence.marker.repeat(fence.count)||trimmed.startsWith(fence.marker.repeat(fence.count)+' ')){
        // Close fence
        let out='';
        if(opt.fence_plugin){
          out=opt.fence_plugin(fence.code.join('\n'),fence.lang);
        }
        if(!out){
          const langAttr=!inline&&fence.lang?` class="language-${fence.lang}"`:'';
          const codeAttr=inline?A('code'):langAttr;
          out=`<pre${A('pre')}><code${codeAttr}>${H(fence.code.join('\n'))}</code></pre>`;
        }
        o.push(out);
        fence=null;
      }else{
        fence.code.push(line);
      }
      i++;
      continue;
    }
    
    // Blank line
    if(!trimmed){
      flushPara();
      flushBq();
      i++;
      continue;
    }
    
    // Heading
    let m=trimmed.match(/^(#{1,6})\s+(.+?)(?:\s*#*)?$/);
    if(m){
      flushPara();
      flushList();
      flushTable();
      flushBq();
      const lvl=m[1].length;
      o.push(`<h${lvl}${A('h'+lvl)}>${I(m[2])}</h${lvl}>`);
      i++;
      continue;
    }
    
    // HR
    if(/^[-*_](?:\s*[-*_]){2,}$/.test(trimmed)){
      flushPara();
      flushList();
      flushTable();
      flushBq();
      o.push(`<hr${A('hr')}>`);
      i++;
      continue;
    }
    
    // Fence open
    m=trimmed.match(/^([`~]{3,})(.*)$/);
    if(m){
      flushPara();
      flushList();
      flushTable();
      flushBq();
      fence={
        marker:m[1][0],
        count:m[1].length,
        lang:(m[2]||'').trim(),
        code:[]
      };
      i++;
      continue;
    }
    
    // Blockquote
    if(trimmed.startsWith('>')){
      flushPara();
      flushList();
      flushTable();
      bq.push(line.replace(/^\s*>\s?/,''));
      i++;
      continue;
    }
    
    // List item
    m=line.match(/^(\s*)([*+-]|\d+\.)\s+(.+)$/);
    if(m){
      flushPara();
      flushTable();
      flushBq();
      
      const indent=Math.floor(m[1].length/2);
      const ordered=/\d/.test(m[2]);
      const tag=ordered?'ol':'ul';
      let content=m[3];
      
      // Task list check
      let liAttr=A('li');
      if(!ordered){
        const task=content.match(/^\[([x ])\]\s+(.*)$/i);
        if(task){
          const checked=task[1].toLowerCase()==='x';
          const cbAttr=inline?' style="margin-right:.5em"':` class="${pfx}task-checkbox"`;
          liAttr=inline?' style="list-style:none"':` class="${pfx}task-item"`;
          content=`<input type="checkbox"${cbAttr}${checked?' checked':''} disabled> ${task[2]}`;
        }
      }
      
      if(!list||list.tag!==tag||list.indent!==indent){
        flushList();
        list={tag,indent,html:`<${tag}${A(tag)}>`};
      }
      
      list.html+=`<li${liAttr}>${I(content)}</li>`;
      i++;
      continue;
    }
    
    // Table
    if(trimmed.includes('|')){
      // Check if it's a separator
      if(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed)){
        if(table&&!table.align){
          // Parse alignment
          const cells=trimmed.replace(/^\|/,'').replace(/\|$/,'').split('|');
          table.align=cells.map(c=>{
            const t=c.trim();
            if(t.startsWith(':')&&t.endsWith(':'))return'center';
            if(t.endsWith(':'))return'right';
            return'left';
          });
        }
      }else{
        // Table row
        flushPara();
        flushList();
        flushBq();
        
        const cells=trimmed.replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
        
        if(!table){
          table={head:cells,align:null,rows:[]};
        }else{
          table.rows.push(cells);
        }
      }
      i++;
      continue;
    }
    
    // Default: paragraph text
    flushList();
    flushTable();
    flushBq();
    para.push(line);
    i++;
  }
  
  // Flush remaining
  flushPara();
  flushList();
  flushTable();
  flushBq();
  
  return o.join('\n').trim();
}

// Static methods
quikdown.emitStyles=()=>{
  let css='';
  for(const[k,v]of Object.entries(S)){
    if(v)css+=`.quikdown-${k}{${v}}\n`;
  }
  return css;
};

quikdown.configure=opt=>md=>quikdown(md,opt);
quikdown.version='1.0.3dev-ultra';

// Exports
if(typeof module!=='undefined'&&module.exports)module.exports=quikdown;
if(typeof window!=='undefined')window.quikdown=quikdown;
export default quikdown;