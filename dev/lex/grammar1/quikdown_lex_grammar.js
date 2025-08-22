/**
 * QuikDown Grammar Definition
 * Declarative grammar rules for markdown parsing
 */

export const GRAMMAR = {
  // Block-level elements (order matters for precedence)
  blocks: [
    {
      name: 'heading',
      pattern: /^(#{1,6})(?= )/,
      parse: (match, scanner, parser) => {
        const level = match[1].length;
        scanner.match(/ +/);
        const content = parser.scanLine(scanner).replace(/\s*#+\s*$/, '');
        const tag = 'h' + level;
        return `<${tag}${parser.getAttr(tag)}>${parser.parseInline(content)}</${tag}>`;
      }
    },
    {
      name: 'fence',
      pattern: /^```|^~~~/,
      parse: (match, scanner, parser) => {
        const fence = match[0];
        const lang = parser.scanLine(scanner).trim();
        let code = scanner.scanUntil(new RegExp('^' + fence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm'));
        if (code.endsWith('\n')) code = code.slice(0, -1);
        scanner.match(fence);
        scanner.match(/[^\n]*\n?/);
        
        if (parser.opts.fence_plugin) {
          const result = parser.opts.fence_plugin(code, lang);
          if (result !== undefined) return result;
        }
        
        const langAttr = lang && !parser.opts.inline_styles ? ` class="language-${lang}"` : '';
        return `<pre${parser.getAttr('pre')}><code${langAttr}>${parser.escapeHtml(code)}</code></pre>`;
      }
    },
    {
      name: 'hr',
      pattern: /^---+\s*$/m,
      parse: (match, scanner, parser) => {
        scanner.match(/\n/);
        return `<hr${parser.getAttr('hr')}>`;
      }
    },
    {
      name: 'blockquote',
      pattern: /^> ?/,
      parse: (match, scanner, parser) => {
        const line = parser.scanLine(scanner);
        return `<blockquote${parser.getAttr('blockquote')}>${parser.parseInline(line)}</blockquote>`;
      }
    },
    {
      name: 'list',
      pattern: /^(?:\d+\. |[*+-] )/,
      parse: 'parseList' // Complex, use method reference
    },
    {
      name: 'table',
      pattern: /\|/, // Simplified check, full validation in parser
      parse: 'parseTable' // Complex, use method reference
    },
    {
      name: 'paragraph',
      pattern: /./, // Catch-all
      parse: 'parseParagraph'
    }
  ],

  // Inline elements
  inline: [
    // Special case: escapes
    {
      name: 'escape',
      pattern: /\\/,
      parse: (match, scanner, parser) => {
        let result = '\\';
        const next = scanner.peek()[0];
        if (next && '[]'.includes(next)) {
          result += scanner.advance();
        }
        return result;
      }
    },
    // Bold
    {
      name: 'bold',
      pattern: /\*\*|__/,
      parse: (match, scanner, parser) => {
        const marker = match[0];
        return parser.parseDelimited(scanner, marker, 'strong');
      }
    },
    // Italic
    {
      name: 'italic',
      pattern: /[*_]/,
      parse: (match, scanner, parser) => {
        const marker = match[0];
        return parser.parseDelimited(scanner, marker, 'em');
      }
    },
    // Strikethrough
    {
      name: 'strikethrough',
      pattern: /~~/,
      parse: (match, scanner, parser) => {
        return parser.parseDelimited(scanner, '~~', 'del');
      }
    },
    // Inline code
    {
      name: 'code',
      pattern: /`/,
      parse: (match, scanner, parser) => {
        const content = scanner.scanUntil('`');
        if (scanner.match('`')) {
          return `<code${parser.getAttr('code')}>${parser.escapeHtml(content)}</code>`;
        }
        return '`'; // Rollback
      }
    },
    // Image
    {
      name: 'image',
      pattern: /!\[/,
      parse: (match, scanner, parser) => {
        return parser.parseBracketed(scanner, '!', (alt, url) => {
          const safeUrl = parser.sanitizeUrl(url);
          return `<img${parser.getAttr('img')} src="${parser.escapeHtml(safeUrl)}" alt="${parser.escapeHtml(alt)}">`;
        });
      }
    },
    // Link
    {
      name: 'link',
      pattern: /\[/,
      parse: (match, scanner, parser) => {
        return parser.parseBracketed(scanner, '', (text, url) => {
          const safeUrl = parser.sanitizeUrl(url);
          const rel = safeUrl.startsWith('http') ? ' rel="noopener noreferrer"' : '';
          return `<a${parser.getAttr('a')} href="${parser.escapeHtml(safeUrl)}"${rel}>${parser.parseInline(text)}</a>`;
        });
      }
    },
    // Angle brackets (no autolink parsing to match main version)
    {
      name: 'angle',
      pattern: /</,
      parse: (match, scanner, parser) => {
        return parser.escapeHtml('<');
      }
    }
  ],

  // Inline block elements (can appear inside paragraphs)
  inlineBlocks: [
    {
      name: 'heading',
      // Only at start of line
      condition: (scanner) => scanner.pos === 0 || scanner.input[scanner.pos - 1] === '\n',
      pattern: /^(#{1,6}) (.*?)(?:\n|$)/,
      parse: (match, scanner, parser) => {
        scanner.advance(match[0].length);
        const level = match[1].length;
        const content = match[2].replace(/\s*#+\s*$/, '');
        let result = '';
        if (scanner.pos > match[0].length) result += '\n';
        result += `<h${level}${parser.getAttr('h' + level)}>${parser.parseInline(content)}</h${level}>`;
        if (!scanner.atEnd()) result += '\n';
        return result;
      }
    },
    {
      name: 'blockquote',
      condition: (scanner) => scanner.pos === 0 || scanner.input[scanner.pos - 1] === '\n',
      pattern: /^> /,
      parse: (match, scanner, parser) => {
        scanner.match('> ');
        const quoteLine = scanner.scanUntil(/\n|$/);
        let result = '';
        if (result && !result.endsWith('\n')) result += '\n';
        result += `<blockquote${parser.getAttr('blockquote')}>${parser.parseInline(quoteLine)}</blockquote>`;
        if (scanner.match(/\n/)) result += '\n';
        return result;
      }
    }
  ],

  // List parsing rules
  lists: {
    ordered: {
      marker: /^\d+\. /,
      tag: 'ol'
    },
    unordered: {
      marker: /^[*+-] /,
      tag: 'ul'
    },
    task: {
      pattern: /^\[[ xX]\]/,
      checked: /^\[[xX]\]/,
      parse: (line, checked, parser) => {
        const content = line.slice(3).trim();
        return `<li class="quikdown-task-item"><input type="checkbox" class="quikdown-task-checkbox"${checked ? ' checked' : ''} disabled> ${parser.parseInline(content)}</li>`;
      }
    },
    nesting: {
      indent: /^ {2,3}/,
      nestedMarker: /^ {2,3}(?:\d+\. |[*+-] )/
    },
    continuation: {
      // 3+ spaces without marker doesn't continue list (matches main version)
      pattern: /^ {3,}/,
      continues: false
    }
  },

  // Table parsing rules
  tables: {
    divider: /^[\s\|:\-]+$/,
    alignment: {
      left: /^:?-+$/,
      center: /^:-+:$/,
      right: /^-+:$/
    },
    cellSeparator: '|'
  },

  // Special processing rules
  processing: {
    // Line breaks with two spaces
    lineBreak: {
      pattern: /  \n/g,
      placeholder: '§BR§',
      replacement: '<br>'
    },
    // Bug compatibility with main version
    missingParagraphOpen: {
      afterHeading: true,
      afterListWithSpaces: /^<p[^>]*>\s{3,}/
    }
  },

  // Helper patterns
  helpers: {
    blankLine: /^\n/,
    trimTrailingHashes: /\s*#+\s*$/,
    escapeChars: '\\`*_{}[]()#+-.!|<>~'
  }
};

// Style definitions for inline styles mode
export const STYLES = {
  h1: 'font-size:2em;font-weight:600;margin:.67em 0',
  h2: 'font-size:1.5em;font-weight:600;margin:.83em 0',
  h3: 'font-size:1.25em;font-weight:600;margin:1em 0',
  h4: 'font-size:1em;font-weight:600;margin:1.33em 0',
  h5: 'font-size:.875em;font-weight:600;margin:1.67em 0',
  h6: 'font-size:.85em;font-weight:600;margin:2em 0',
  pre: 'background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;margin:1em 0',
  code: 'background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace',
  blockquote: 'border-left:4px solid #ddd;margin-left:0;padding-left:1em',
  table: 'border-collapse:collapse;width:100%;margin:1em 0',
  th: 'border:1px solid #ddd;padding:8px;background-color:#f2f2f2;font-weight:bold;text-align:left',
  td: 'border:1px solid #ddd;padding:8px;text-align:left',
  hr: 'border:none;border-top:1px solid #ddd;margin:1em 0',
  img: 'max-width:100%;height:auto',
  a: 'color:#06c;text-decoration:underline',
  strong: 'font-weight:bold',
  em: 'font-style:italic',
  del: 'text-decoration:line-through',
  ul: 'margin:.5em 0;padding-left:2em',
  ol: 'margin:.5em 0;padding-left:2em',
  li: 'margin:.25em 0',
  br: '',
  p: 'margin:1em 0'
};

export default GRAMMAR;