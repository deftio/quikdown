/**
 * Markdown Grammar Definition
 * This defines the complete grammar for markdown parsing
 */

export const GRAMMAR = {
  // Token definitions with patterns
  tokens: {
    // Block-level markers
    HEADING: { pattern: /^#{1,6}(?=\s)/, block: true },
    FENCE_BACKTICK: { pattern: /^```/, block: true, fence: true },
    FENCE_TILDE: { pattern: /^~~~/, block: true, fence: true },
    BLOCKQUOTE: { pattern: /^>(?=\s?)/, block: true },
    HR_DASH: { pattern: /^---+$/, block: true },
    HR_STAR: { pattern: /^\*\*\*+$/, block: true },
    HR_UNDER: { pattern: /^___+$/, block: true },
    
    // List markers
    LIST_BULLET: { pattern: /^[*+-](?=\s)/, block: true, list: true },
    LIST_NUMBER: { pattern: /^\d+\.(?=\s)/, block: true, list: true },
    
    // Inline markers  
    BOLD_STAR: { pattern: '**', inline: true, pair: true },
    BOLD_UNDER: { pattern: '__', inline: true, pair: true },
    ITALIC_STAR: { pattern: '*', inline: true, pair: true },
    ITALIC_UNDER: { pattern: '_', inline: true, pair: true },
    STRIKE: { pattern: '~~', inline: true, pair: true },
    CODE: { pattern: '`', inline: true, pair: true, escape: true },
    
    // Links/Images
    IMAGE: { pattern: '![', inline: true, complex: true },
    LINK_OPEN: { pattern: '[', inline: true, complex: true },
    LINK_CLOSE: { pattern: '](', inline: true, complex: true },
    
    // Table
    PIPE: { pattern: '|', table: true },
    TABLE_SEP: { pattern: /^\|?[\s:]*-{3,}[\s:]*\|?/, table: true },
    
    // Special
    LINEBREAK: { pattern: /  $/, inline: true },
    NEWLINE: { pattern: '\n' },
    ESCAPE: { pattern: '\\', escape: true }
  },

  // Block-level grammar rules
  blocks: {
    heading: {
      start: 'HEADING',
      content: 'inline',
      end: 'NEWLINE',
      render: (level, content) => `<h${level}>${content}</h${level}>`
    },
    
    fence: {
      start: ['FENCE_BACKTICK', 'FENCE_TILDE'],
      lang: 'text_until_newline',
      content: 'raw_until_fence_close',
      render: (marker, lang, content, opts) => {
        if (opts.fence_plugin) {
          const result = opts.fence_plugin(content, lang);
          if (result !== undefined) return result;
        }
        const langAttr = lang && !opts.inline_styles ? ` class="language-${lang}"` : '';
        return `<pre><code${langAttr}>${escape(content)}</code></pre>`;
      }
    },
    
    blockquote: {
      start: 'BLOCKQUOTE',
      content: 'recursive_block',
      continuation: 'BLOCKQUOTE',
      render: (content) => `<blockquote>${content}</blockquote>`
    },
    
    list: {
      start: ['LIST_BULLET', 'LIST_NUMBER'],
      items: {
        marker: 'same_as_start',
        content: 'inline',
        continuation: 'indent'
      },
      render: (type, items, opts) => {
        const tag = type === 'LIST_NUMBER' ? 'ol' : 'ul';
        const itemsHtml = items.map(item => {
          // Check for task list
          if (type === 'LIST_BULLET' && item.match(/^\[[ xX]\]/)) {
            const checked = item[1].toLowerCase() === 'x';
            const content = item.slice(3).trim();
            return `<li><input type="checkbox"${checked ? ' checked' : ''} disabled> ${content}</li>`;
          }
          return `<li>${item}</li>`;
        }).join('');
        return `<${tag}>${itemsHtml}</${tag}>`;
      }
    },
    
    table: {
      start: 'table_row',
      separator: 'TABLE_SEP',
      rows: 'table_row+',
      render: (headers, alignments, rows) => {
        let html = '<table><thead><tr>';
        headers.forEach((h, i) => {
          const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
          html += `<th${align}>${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        rows.forEach(row => {
          html += '<tr>';
          row.forEach((cell, i) => {
            const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
            html += `<td${align}>${cell}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
      }
    },
    
    paragraph: {
      content: 'inline_until_block',
      render: (content) => content ? `<p>${content}</p>` : ''
    }
  },

  // Inline grammar rules
  inline: {
    bold: {
      start: ['BOLD_STAR', 'BOLD_UNDER'],
      content: 'recursive_inline',
      end: 'same_as_start',
      render: (content) => `<strong>${content}</strong>`
    },
    
    italic: {
      start: ['ITALIC_STAR', 'ITALIC_UNDER'],
      content: 'recursive_inline',
      end: 'same_as_start',
      render: (content) => `<em>${content}</em>`
    },
    
    strike: {
      start: 'STRIKE',
      content: 'recursive_inline',
      end: 'STRIKE',
      render: (content) => `<del>${content}</del>`
    },
    
    code: {
      start: 'CODE',
      content: 'raw',
      end: 'CODE',
      render: (content) => `<code>${escape(content)}</code>`
    },
    
    link: {
      start: 'LINK_OPEN',
      text: 'until(])',
      separator: 'LINK_CLOSE',
      url: 'until())',
      render: (text, url, opts) => {
        const safeUrl = sanitizeUrl(url, opts);
        const rel = safeUrl.startsWith('http') ? ' rel="noopener noreferrer"' : '';
        return `<a href="${safeUrl}"${rel}>${text}</a>`;
      }
    },
    
    image: {
      start: 'IMAGE',
      alt: 'until(])',
      separator: 'LINK_CLOSE',
      url: 'until())',
      render: (alt, url, opts) => {
        const safeUrl = sanitizeUrl(url, opts);
        return `<img src="${safeUrl}" alt="${escape(alt)}">`;
      }
    },
    
    autolink: {
      pattern: /https?:\/\/[^\s<]+/,
      render: (url, opts) => {
        const safeUrl = sanitizeUrl(url, opts);
        return `<a href="${safeUrl}" rel="noopener noreferrer">${url}</a>`;
      }
    },
    
    linebreak: {
      start: 'LINEBREAK',
      render: () => '<br>'
    }
  },

  // Helper patterns
  patterns: {
    text_until_newline: /[^\n]*/,
    raw_until_fence_close: /[\s\S]*?(?=```|~~~|$)/,
    table_row: /\|?([^|\n]+\|?)+/,
    indent: /^(?:  |\t)/,
    until: (char) => new RegExp(`[^${char}]*`)
  }
};

// Helper functions that will be inlined
const escape = (text) => {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  return text.replace(/[&<>"']/g, c => map[c]);
};

const sanitizeUrl = (url, opts) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (opts.allow_unsafe_urls) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return lower.startsWith('data:image/') ? trimmed : '#';
  }
  return trimmed;
};