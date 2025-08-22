/**
 * Compiled Grammar (Auto-generated)
 * DO NOT EDIT - Generated from grammar.js
 */

// Token Trie for efficient matching
export const TOKEN_TRIE = {
  "children": {
    "*": {
      "children": {
        "*": {
          "children": {},
          "tokens": [
            {
              "name": "BOLD_STAR",
              "pattern": "**",
              "inline": true,
              "pair": true
            }
          ]
        }
      },
      "tokens": [
        {
          "name": "ITALIC_STAR",
          "pattern": "*",
          "inline": true,
          "pair": true
        }
      ]
    },
    "_": {
      "children": {
        "_": {
          "children": {},
          "tokens": [
            {
              "name": "BOLD_UNDER",
              "pattern": "__",
              "inline": true,
              "pair": true
            }
          ]
        }
      },
      "tokens": [
        {
          "name": "ITALIC_UNDER",
          "pattern": "_",
          "inline": true,
          "pair": true
        }
      ]
    },
    "~": {
      "children": {
        "~": {
          "children": {},
          "tokens": [
            {
              "name": "STRIKE",
              "pattern": "~~",
              "inline": true,
              "pair": true
            }
          ]
        }
      },
      "tokens": []
    },
    "`": {
      "children": {},
      "tokens": [
        {
          "name": "CODE",
          "pattern": "`",
          "inline": true,
          "pair": true,
          "escape": true
        }
      ]
    },
    "!": {
      "children": {
        "[": {
          "children": {},
          "tokens": [
            {
              "name": "IMAGE",
              "pattern": "![",
              "inline": true,
              "complex": true
            }
          ]
        }
      },
      "tokens": []
    },
    "[": {
      "children": {},
      "tokens": [
        {
          "name": "LINK_OPEN",
          "pattern": "[",
          "inline": true,
          "complex": true
        }
      ]
    },
    "]": {
      "children": {
        "(": {
          "children": {},
          "tokens": [
            {
              "name": "LINK_CLOSE",
              "pattern": "](",
              "inline": true,
              "complex": true
            }
          ]
        }
      },
      "tokens": []
    },
    "|": {
      "children": {},
      "tokens": [
        {
          "name": "PIPE",
          "pattern": "|",
          "table": true
        }
      ]
    },
    "\n": {
      "children": {},
      "tokens": [
        {
          "name": "NEWLINE",
          "pattern": "\n"
        }
      ]
    },
    "\\": {
      "children": {},
      "tokens": [
        {
          "name": "ESCAPE",
          "pattern": "\\",
          "escape": true
        }
      ]
    }
  },
  "tokens": []
};

// Token definitions
export const TOKENS = {
  "HEADING": {
    "pattern": {},
    "block": true,
    "regex": {}
  },
  "FENCE_BACKTICK": {
    "pattern": {},
    "block": true,
    "fence": true,
    "regex": {}
  },
  "FENCE_TILDE": {
    "pattern": {},
    "block": true,
    "fence": true,
    "regex": {}
  },
  "BLOCKQUOTE": {
    "pattern": {},
    "block": true,
    "regex": {}
  },
  "HR_DASH": {
    "pattern": {},
    "block": true,
    "regex": {}
  },
  "HR_STAR": {
    "pattern": {},
    "block": true,
    "regex": {}
  },
  "HR_UNDER": {
    "pattern": {},
    "block": true,
    "regex": {}
  },
  "LIST_BULLET": {
    "pattern": {},
    "block": true,
    "list": true,
    "regex": {}
  },
  "LIST_NUMBER": {
    "pattern": {},
    "block": true,
    "list": true,
    "regex": {}
  },
  "BOLD_STAR": {
    "pattern": "**",
    "inline": true,
    "pair": true
  },
  "BOLD_UNDER": {
    "pattern": "__",
    "inline": true,
    "pair": true
  },
  "ITALIC_STAR": {
    "pattern": "*",
    "inline": true,
    "pair": true
  },
  "ITALIC_UNDER": {
    "pattern": "_",
    "inline": true,
    "pair": true
  },
  "STRIKE": {
    "pattern": "~~",
    "inline": true,
    "pair": true
  },
  "CODE": {
    "pattern": "`",
    "inline": true,
    "pair": true,
    "escape": true
  },
  "IMAGE": {
    "pattern": "![",
    "inline": true,
    "complex": true
  },
  "LINK_OPEN": {
    "pattern": "[",
    "inline": true,
    "complex": true
  },
  "LINK_CLOSE": {
    "pattern": "](",
    "inline": true,
    "complex": true
  },
  "PIPE": {
    "pattern": "|",
    "table": true
  },
  "TABLE_SEP": {
    "pattern": {},
    "table": true,
    "regex": {}
  },
  "LINEBREAK": {
    "pattern": {},
    "inline": true,
    "regex": {}
  },
  "NEWLINE": {
    "pattern": "\n"
  },
  "ESCAPE": {
    "pattern": "\\",
    "escape": true
  }
};

// Regex patterns for complex tokens
export const REGEX_TOKENS = [
  { name: 'HEADING', pattern: /^#{1,6}(?=\s)/, ...{"pattern":{},"block":true} },
  { name: 'FENCE_BACKTICK', pattern: /^```/, ...{"pattern":{},"block":true,"fence":true} },
  { name: 'FENCE_TILDE', pattern: /^~~~/, ...{"pattern":{},"block":true,"fence":true} },
  { name: 'BLOCKQUOTE', pattern: /^>(?=\s?)/, ...{"pattern":{},"block":true} },
  { name: 'HR_DASH', pattern: /^---+$/, ...{"pattern":{},"block":true} },
  { name: 'HR_STAR', pattern: /^\*\*\*+$/, ...{"pattern":{},"block":true} },
  { name: 'HR_UNDER', pattern: /^___+$/, ...{"pattern":{},"block":true} },
  { name: 'LIST_BULLET', pattern: /^[*+-](?=\s)/, ...{"pattern":{},"block":true,"list":true} },
  { name: 'LIST_NUMBER', pattern: /^\d+\.(?=\s)/, ...{"pattern":{},"block":true,"list":true} },
  { name: 'TABLE_SEP', pattern: /^\|?[\s:]*-{3,}[\s:]*\|?/, ...{"pattern":{},"table":true} },
  { name: 'LINEBREAK', pattern: /  $/, ...{"pattern":{},"inline":true} }
];

// Block-level rules
export const BLOCK_RULES = {
  "heading": {
    "start": [
      "HEADING"
    ],
    "content": "inline",
    "end": "NEWLINE",
    "renderStr": "(level, content) => `<h${level}>${content}</h${level}>`"
  },
  "fence": {
    "start": [
      "FENCE_BACKTICK",
      "FENCE_TILDE"
    ],
    "lang": "text_until_newline",
    "content": "raw_until_fence_close",
    "renderStr": "(marker, lang, content, opts) => {\n        if (opts.fence_plugin) {\n          const result = opts.fence_plugin(content, lang);\n          if (result !== undefined) return result;\n        }\n        const langAttr = lang && !opts.inline_styles ? ` class=\"language-${lang}\"` : '';\n        return `<pre><code${langAttr}>${escape(content)}</code></pre>`;\n      }"
  },
  "blockquote": {
    "start": [
      "BLOCKQUOTE"
    ],
    "content": "recursive_block",
    "continuation": "BLOCKQUOTE",
    "renderStr": "(content) => `<blockquote>${content}</blockquote>`"
  },
  "list": {
    "start": [
      "LIST_BULLET",
      "LIST_NUMBER"
    ],
    "items": {
      "marker": "same_as_start",
      "content": "inline",
      "continuation": "indent"
    },
    "renderStr": "(type, items, opts) => {\n        const tag = type === 'LIST_NUMBER' ? 'ol' : 'ul';\n        const itemsHtml = items.map(item => {\n          // Check for task list\n          if (type === 'LIST_BULLET' && item.match(/^\\[[ xX]\\]/)) {\n            const checked = item[1].toLowerCase() === 'x';\n            const content = item.slice(3).trim();\n            return `<li><input type=\"checkbox\"${checked ? ' checked' : ''} disabled> ${content}</li>`;\n          }\n          return `<li>${item}</li>`;\n        }).join('');\n        return `<${tag}>${itemsHtml}</${tag}>`;\n      }"
  },
  "table": {
    "start": [
      "table_row"
    ],
    "separator": "TABLE_SEP",
    "rows": "table_row+",
    "renderStr": "(headers, alignments, rows) => {\n        let html = '<table><thead><tr>';\n        headers.forEach((h, i) => {\n          const align = alignments[i] ? ` style=\"text-align:${alignments[i]}\"` : '';\n          html += `<th${align}>${h}</th>`;\n        });\n        html += '</tr></thead><tbody>';\n        rows.forEach(row => {\n          html += '<tr>';\n          row.forEach((cell, i) => {\n            const align = alignments[i] ? ` style=\"text-align:${alignments[i]}\"` : '';\n            html += `<td${align}>${cell}</td>`;\n          });\n          html += '</tr>';\n        });\n        html += '</tbody></table>';\n        return html;\n      }"
  },
  "paragraph": {
    "content": "inline_until_block",
    "renderStr": "(content) => content ? `<p>${content}</p>` : ''"
  }
};

// Inline rules  
export const INLINE_RULES = {
  "bold": {
    "start": [
      "BOLD_STAR",
      "BOLD_UNDER"
    ],
    "content": "recursive_inline",
    "end": "same_as_start",
    "renderStr": "(content) => `<strong>${content}</strong>`"
  },
  "italic": {
    "start": [
      "ITALIC_STAR",
      "ITALIC_UNDER"
    ],
    "content": "recursive_inline",
    "end": "same_as_start",
    "renderStr": "(content) => `<em>${content}</em>`"
  },
  "strike": {
    "start": [
      "STRIKE"
    ],
    "content": "recursive_inline",
    "end": "STRIKE",
    "renderStr": "(content) => `<del>${content}</del>`"
  },
  "code": {
    "start": [
      "CODE"
    ],
    "content": "raw",
    "end": "CODE",
    "renderStr": "(content) => `<code>${escape(content)}</code>`"
  },
  "link": {
    "start": [
      "LINK_OPEN"
    ],
    "text": "until(])",
    "separator": "LINK_CLOSE",
    "url": "until())",
    "renderStr": "(text, url, opts) => {\n        const safeUrl = sanitizeUrl(url, opts);\n        const rel = safeUrl.startsWith('http') ? ' rel=\"noopener noreferrer\"' : '';\n        return `<a href=\"${safeUrl}\"${rel}>${text}</a>`;\n      }"
  },
  "image": {
    "start": [
      "IMAGE"
    ],
    "alt": "until(])",
    "separator": "LINK_CLOSE",
    "url": "until())",
    "renderStr": "(alt, url, opts) => {\n        const safeUrl = sanitizeUrl(url, opts);\n        return `<img src=\"${safeUrl}\" alt=\"${escape(alt)}\">`;\n      }"
  },
  "autolink": {
    "pattern": {},
    "renderStr": "(url, opts) => {\n        const safeUrl = sanitizeUrl(url, opts);\n        return `<a href=\"${safeUrl}\" rel=\"noopener noreferrer\">${url}</a>`;\n      }"
  },
  "linebreak": {
    "start": [
      "LINEBREAK"
    ],
    "renderStr": "() => '<br>'"
  }
};

// Helper functions
export const escape = (text) => {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += map[text[i]] || text[i];
  }
  return result;
};

export const sanitizeUrl = (url, opts = {}) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (opts.allow_unsafe_urls) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return lower.startsWith('data:image/') ? trimmed : '#';
  }
  return trimmed;
};
