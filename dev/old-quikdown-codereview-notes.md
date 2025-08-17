You’re right—you’re defining the same style map twice (once inside `quikdown()` and again in `quikdown.emitStyles`). Below is a compact refactor that:

* Dedupes styles into a single `STYLE_MAP`.
* Reuses a single `getAttr` (no re-declaring it in helpers).
* Fixes the fenced-code regex to allow non-word language labels.
* Avoids the buggy “merge consecutive blockquotes” step (that line was stripping tags).
* Adds very small, opt-in URL sanitization for links/images (prevents `javascript:` etc) while keeping the file tiny.
* Lets you override the class prefix (default `quikdown-`) and keeps `inline_styles` working.

````js
/**
 * quikdown - minimal markdown → HTML (tiny, LLM/chat-friendly)
 */

const STYLE_MAP = {
  h1: 'margin-top:0.5em;margin-bottom:0.3em',
  h2: 'margin-top:0.5em;margin-bottom:0.3em',
  h3: 'margin-top:0.5em;margin-bottom:0.3em',
  h4: 'margin-top:0.5em;margin-bottom:0.3em',
  h5: 'margin-top:0.5em;margin-bottom:0.3em',
  h6: 'margin-top:0.5em;margin-bottom:0.3em',
  pre: 'background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto',
  code: 'background:#f0f0f0;padding:2px 4px;border-radius:3px',
  blockquote: 'border-left:4px solid #ddd;margin-left:0;padding-left:1em;color:#666',
  table: 'border-collapse:collapse;width:100%;margin:1em 0',
  thead: '',
  tbody: '',
  tr: '',
  th: 'border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold',
  td: 'border:1px solid #ddd;padding:8px;text-align:left',
  hr: 'border:none;border-top:1px solid #ddd;margin:1em 0',
  img: 'max-width:100%;height:auto',
  a: 'color:#06c;text-decoration:underline',
  strong: 'font-weight:bold',
  em: 'font-style:italic',
  del: 'text-decoration:line-through',
  ul: 'margin:0.5em 0;padding-left:2em',
  ol: 'margin:0.5em 0;padding-left:2em',
  li: 'margin:0.25em 0',
  br: ''
};

function quikdown(markdown, options = {}) {
  if (!markdown || typeof markdown !== 'string') return '';

  const {
    fence_plugin,
    inline_styles = false,
    class_prefix = 'quikdown-',
    allow_unsafe_urls = false // set true to skip URL sanitization
  } = options;

  const getAttr = (tag, extra = '') => {
    if (inline_styles) {
      const base = STYLE_MAP[tag] || '';
      const style = extra ? (base ? base + ';' + extra : extra) : base;
      return style ? ` style="${style}"` : '';
    }
    return ` class="${class_prefix}${tag}"`;
  };

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const sanitizeUrl = (u) => {
    if (allow_unsafe_urls) return u;
    try {
      const url = u.trim();
      // allow http(s), mailto, tel, and data:image/*
      if (/^(https?:|mailto:|tel:|data:image\/)/i.test(url)) return url;
    } catch {}
    return '#';
  };

  // ---- Phase 1: protect code blocks & inline code ----
  let html = markdown;
  const codeBlocks = [];
  const inlineCodes = [];

  // fenced code: allow non-word langs like c++, tsx, etc.
  html = html.replace(/```([^\n]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    const i = codeBlocks.length;
    const isCustom = fence_plugin && typeof fence_plugin === 'function';
    codeBlocks.push({
      lang: (lang || '').trim(),
      code: isCustom ? code.trimEnd() : escapeHtml(code.trimEnd()),
      custom: !!isCustom
    });
    return `%%%CODEBLOCK${i}%%%`;
  });

  // inline code
  html = html.replace(/`([^`]+)`/g, (m, c) => {
    const i = inlineCodes.length;
    inlineCodes.push(escapeHtml(c));
    return `%%%INLINECODE${i}%%%`;
  });

  // escape the rest
  html = escapeHtml(html);

  // ---- Phase 2: block elements ----

  // tables
  html = processTable(html, getAttr);

  // headings
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (m, h, content) => {
    const lvl = h.length;
    return `<h${lvl}${getAttr('h' + lvl)}>${content}</h${lvl}>`;
  });

  // blockquotes (line-based; simple & robust)
  html = html.replace(/^&gt;\s+(.+)$/gm, `<blockquote${getAttr('blockquote')}>$1</blockquote>`);

  // hr
  html = html.replace(/^---+$/gm, `<hr${getAttr('hr')}>`);

  // lists
  html = processLists(html, getAttr);

  // ---- Phase 3: inline elements ----

  // images before links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) =>
    `<img${getAttr('img')} src="${sanitizeUrl(src)}" alt="${alt}">`
  );

  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, href) =>
    `<a${getAttr('a')} href="${sanitizeUrl(href)}" rel="noopener noreferrer">${text}</a>`
  );

  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, `<strong${getAttr('strong')}>$1</strong>`)
             .replace(/__(.+?)__/g, `<strong${getAttr('strong')}>$1</strong>`);

  // italic (simple; avoids lookbehind for widest browser support)
  html = html.replace(/(\s|^)\*(?!\s)([^*]+?)\*(?=\s|$)/g, `$1<em${getAttr('em')}>$2</em>`)
             .replace(/(\s|^)\_(?!\s)([^_]+?)\_(?=\s|$)/g, `$1<em${getAttr('em')}>$2</em>`);

  // strike
  html = html.replace(/~~(.+?)~~/g, `<del${getAttr('del')}>$1</del>`);

  // line breaks (two trailing spaces)
  html = html.replace(/  $/gm, `<br${getAttr('br')}>`);

  // paragraphs (double newlines)
  html = '<p>' + html.replace(/\n\n+/g, '</p><p>') + '</p>';

  // unwrap block elements inside <p>
  html = html
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-6][^>]*>)/g, '$1').replace(/(<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p>(<blockquote[^>]*>)/g, '$1').replace(/(<\/blockquote>)<\/p>/g, '$1')
    .replace(/<p>(<ul[^>]*>|<ol[^>]*>)/g, '$1').replace(/(<\/ul>|<\/ol>)<\/p>/g, '$1')
    .replace(/<p>(<hr[^>]*>)<\/p>/g, '$1')
    .replace(/<p>(<table[^>]*>)/g, '$1').replace(/(<\/table>)<\/p>/g, '$1')
    .replace(/<p>(<pre[^>]*>)/g, '$1').replace(/(<\/pre>)<\/p>/g, '$1')
    .replace(/<p>(%%%CODEBLOCK\d+%%%)<\/p>/g, '$1');

  // ---- Phase 4: restore code ----
  codeBlocks.forEach((b, i) => {
    const place = `%%%CODEBLOCK${i}%%%`;
    let rep;
    if (b.custom) {
      rep = fence_plugin(b.code, b.lang);
    } else {
      const langCls = !inline_styles && b.lang ? ` class="language-${b.lang}"` : '';
      const codeAttr = inline_styles ? getAttr('code') : langCls;
      rep = `<pre${getAttr('pre')}><code${codeAttr}>${b.code}</code></pre>`;
    }
    html = html.replace(place, rep);
  });

  inlineCodes.forEach((c, i) => {
    html = html.replace(`%%%INLINECODE${i}%%%`, `<code${getAttr('code')}>${c}</code>`);
  });

  return html.trim();
}

// ------------ helpers (now share getAttr) ------------
function processInlineMarkdown(text, getAttr) {
  return text
    .replace(/\*\*(.+?)\*\*/g, `<strong${getAttr('strong')}>$1</strong>`)
    .replace(/__(.+?)__/g, `<strong${getAttr('strong')}>$1</strong>`)
    .replace(/(\s|^)\*(?!\s)([^*]+?)\*(?=\s|$)/g, `$1<em${getAttr('em')}>$2</em>`)
    .replace(/(\s|^)\_(?!\s)([^_]+?)\_(?=\s|$)/g, `$1<em${getAttr('em')}>$2</em>`)
    .replace(/~~(.+?)~~/g, `<del${getAttr('del')}>$1</del>`)
    .replace(/`([^`]+)`/g, `<code${getAttr('code')}>$1</code>`);
}

function processTable(text, getAttr) {
  const lines = text.split('\n');
  const out = [];
  let buf = null;
  const flush = () => {
    if (!buf) return;
    const html = buildTable(buf, getAttr);
    out.push(html || buf.join('\n'));
    buf = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      buf = buf || [];
      buf.push(line);
    } else { flush(); out.push(raw); }
  }
  flush();
  return out.join('\n');
}

function buildTable(lines, getAttr) {
  if (!lines || lines.length < 2) return null;
  let sepIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^\|[\s\-:|]+\|$/.test(lines[i])) { sepIdx = i; break; }
  }
  if (sepIdx === -1) return null;

  const headers = lines.slice(0, sepIdx);
  const body = lines.slice(sepIdx + 1);
  const aligns = lines[sepIdx].split('|').slice(1, -1).map(c => {
    const t = c.trim(); if (t.startsWith(':') && t.endsWith(':')) return 'center';
    if (t.endsWith(':')) return 'right'; return 'left';
  });

  let html = `<table${getAttr('table')}>\n`;
  if (headers.length) {
    html += `<thead${getAttr('thead')}>\n`;
    headers.forEach(line => {
      html += `<tr${getAttr('tr')}>\n`;
      line.split('|').slice(1, -1).forEach((cell, i) => {
        const a = aligns[i] !== 'left' ? `text-align:${aligns[i]}` : '';
        html += `<th${getAttr('th', a)}>${processInlineMarkdown(cell.trim(), getAttr)}</th>\n`;
      });
      html += '</tr>\n';
    });
    html += '</thead>\n';
  }
  if (body.length) {
    html += `<tbody${getAttr('tbody')}>\n`;
    body.forEach(line => {
      html += `<tr${getAttr('tr')}>\n`;
      line.split('|').slice(1, -1).forEach((cell, i) => {
        const a = aligns[i] !== 'left' ? `text-align:${aligns[i]}` : '';
        html += `<td${getAttr('td', a)}>${processInlineMarkdown(cell.trim(), getAttr)}</td>\n`;
      });
      html += '</tr>\n';
    });
    html += '</tbody>\n';
  }
  html += '</table>';
  return html;
}

function processLists(text, getAttr) {
  const lines = text.split('\n');
  const out = [];
  const stack = []; // {type, level}
  const closeTo = (lvl) => { while (stack.length > lvl) out.push(`</${stack.pop().type}>`); };
  for (const line of lines) {
    const m = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);
    if (!m) { closeTo(0); out.push(line); continue; }
    const [, indent, marker, content] = m;
    const level = Math.floor(indent.length / 2);
    const type = /^\d+\./.test(marker) ? 'ol' : 'ul';
    while (stack.length > level + 1) closeTo(stack.length - 1);
    if (stack.length === level) { stack.push({type, level}); out.push(`<${type}${getAttr(type)}>`); }
    else if (stack.length === level + 1 && stack[stack.length - 1].type !== type) {
      out.push(`</${stack.pop().type}>`); stack.push({type, level}); out.push(`<${type}${getAttr(type)}>`); }
    out.push(`<li${getAttr('li')}>${content}</li>`);
  }
  while (stack.length) out.push(`</${stack.pop().type}>`);
  return out.join('\n');
}

// ---- emitStyles: now uses the single STYLE_MAP and class_prefix
quikdown.emitStyles = function(class_prefix = 'quikdown-') {
  let css = '';
  for (const [tag, style] of Object.entries(STYLE_MAP)) {
    if (style) css += `.${class_prefix}${tag}{${style}}\n`;
  }
  return css;
};

quikdown.configure = (options) => (markdown) => quikdown(markdown, options);

// CJS + ESM + browser globals
if (typeof module !== 'undefined' && module.exports) module.exports = quikdown;
if (typeof window !== 'undefined') window.quikdown = quikdown;
export default quikdown;
````

### Other quick recommendations (still tiny):

1. **Drop lookbehind in italics** (done). It breaks on older Safari.
2. **Support `~~~` fences** if you want parity with GitHub: add another regex or a tiny alternation.
3. **Auto-links (URLs without brackets):** a tiny pass like `/\bhttps?:\/\/\S+/g` → `<a ...>` is useful in chat logs.
4. **Optional `class_prefix`** (done) lets you embed multiple renderers on a page without CSS collisions.
5. **Security note:** you already escape HTML; the simple `sanitizeUrl()` prevents `javascript:` URLs. Keep it—costs just a few bytes and avoids a footgun.
6. **Remove blockquote merge line** (done). The original replacement deleted tags between consecutive `> ...` lines and could un-quote content. A smarter merger adds complexity—leaving one line per blockquote is safer for a “small” script.
7. **Fence plugin contract:** your `(content, lang)` is clean; document that `content` is raw (unescaped) when a plugin is present (as implemented above).
8. **Tests:** add 5–6 tiny fixtures (headings, lists, tables, nested lists, code, links) so changes don’t regress.

If you want, I can add minimal auto-linking and `~~~` support in <20 lines, still keeping it lean.


Overall: it’s a solid, tiny, no-deps markdown→HTML for chat output. The design choices (pre-escape + placeholders, optional inline styles, pluggable fence renderer, class prefix) are smart for your use case. For “LLM/chat markdown” it hits the 80/20 very well.

### What it does really well

* **Small & readable:** minimal state, easy to audit.
* **Safety first:** escape-then-restore is the right default; simple URL allowlist is good.
* **Pragmatic features:** tables, lists, code fences, and a **fence plugin** hook cover most LLM outputs.
* **CSS flexibility:** inline vs class + `class_prefix` avoids collisions.

### Where it’ll bite (edge cases)

* **Regex markdown limits:** nested blockquotes, mixed `*`/`_` emphasis inside links, or `***bold+italic***` can misparse.
* **List nesting heuristic:** assumes 2-space indents; real-world markdown mixes 2/4 spaces + tabs.
* **Tables:** requires leading/trailing pipes; GFM allows more variants (no closing `|`, header row with trailing spaces).
* **Paragraph wrapping:** custom HTML blocks (if ever allowed) could get wrapped in `<p>…</p>`.
* **Lookahead/backtracking risk:** large inputs with many `*` can slow greedy/ungreedy combos (unlikely but worth testing).

### Missing (by design, probably fine)

* Task lists (`- [ ]`), autolinks (`https://…`), reference-style links, footnotes, heading IDs, trailing-`#` ATX headings, HTML passthrough.

### Security notes

* Keep HTML escaping as first step (you do).
* Your URL allowlist is good; if you want stricter: only `data:image/(png|jpeg|webp)` and strip everything else to `#`.
* Always include `rel="noopener noreferrer"` on links (you do); add `target="_blank"` only if desired.

### Priority fixes (tiny changes, high payoff)

1. **Autolinks:** turn bare `https?://\S+` into `<a>`—improves chat logs a lot.
2. **Support `~~~` fences** alongside \`\`\`—common in GFM.
3. **Tolerate heading trailing #’s:** `## Title ##` → `h2`.
4. **Lists:** accept both 2- and 4-space indents; treat tabs as 4.
5. **Tables:** allow rows without a trailing `|` (GFM style).

### Nice-to-haves (still small)

* **Heading IDs (slugify)** behind an option for in-page linking.
* **Very tiny emphasis tweaks:** avoid italic inside `**bold**` breaking; you can post-process to merge.
* **Micro-bench + fuzz tests:** 6–8 fixtures + a simple fuzz that inserts `*`, `_`, and backticks randomly.

### If you ever outgrow it

* **snarkdown** (\~2 KB) stays tiny but handles more GFM.
* **micromark** is rock-solid but bigger; probably overkill for your “keep it small” goal.

**Verdict:** For a “small markdown to HTML for chat,” this library is 👍. Keep it lean; add autolinks + `~~~` + minor list/table tolerance, and you’ll cover 95% of LLM outputs without bloat.
