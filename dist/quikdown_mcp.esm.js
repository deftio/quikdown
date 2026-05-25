/**
 * quikdown_mcp - MCP Server Markdown Parser
 * @version 1.2.16
 * @license BSD-2-Clause
 * @copyright DeftIO 2025
 */
import quikdown from './quikdown.esm.js';
import quikdown_bd from './quikdown_bd.esm.js';
import quikdown_ast from './quikdown_ast.esm.js';
import quikdown_json from './quikdown_json.esm.js';
import nodePath from 'path';
import nodeFs from 'fs';
import nodeReadline from 'readline';

// Auto-generated version file - DO NOT EDIT MANUALLY
// This file is automatically updated by tools/updateVersion.js

const quikdownVersion = "1.2.16";

/**
 * quikdown_mcp — MCP (Model Context Protocol) server for quikdown
 * ════════════════════════════════════════════════════════════════
 *
 * One server, three tool groups:
 *   1. Headless  — always: parse, BD, stats on strings
 *   2. Filesystem — Node only: read/write markdown/HTML by path
 *   3. Editor    — when host passes { editor }: full buffer + preview
 *
 * Zero external dependencies. Implements JSON-RPC 2.0 over stdio.
 *
 * Usage:
 *   import { createMcpServer } from 'quikdown/mcp';
 *   const mcp = createMcpServer({ root: process.cwd() });
 *   mcp.listenStdio();
 */


// ── Helpers ───────────────────────────────────────────────────────────

function markdownStats(markdown) {
  const text = (markdown || '').trim();
  return {
    characters: text.length,
    words: text.split(/\s+/).filter(Boolean).length,
    lines: (markdown || '').split('\n').length,
    paragraphs: (markdown || '').split(/\n\s*\n/).filter(p => p.trim()).length
  };
}

function extractLines(markdown, startLine, endLine) {
  return (markdown || '').split('\n').slice((startLine || 1) - 1, endLine || 1).join('\n');
}

/**
 * Validate and resolve a path within the sandbox root.
 * Rejects paths containing '..' or absolute paths outside root.
 */
function safePath(root, requestedPath) {
  const resolved = nodePath.resolve(root, requestedPath);
  const normalizedRoot = nodePath.resolve(root);
  if (!resolved.startsWith(normalizedRoot + nodePath.sep) && resolved !== normalizedRoot) {
    throw new Error(`Path "${requestedPath}" is outside sandbox root`);
  }
  return resolved;
}

// ── Tool definitions ──────────────────────────────────────────────────

function headlessTools() {
  return [
    {
      name: 'markdown_to_html',
      description: 'Convert markdown to HTML using quikdown parser. Returns safe, XSS-protected HTML.',
      inputSchema: {
        type: 'object',
        properties: {
          markdown: { type: 'string', description: 'Markdown content to convert' },
          options: {
            type: 'object',
            description: 'Parser options',
            properties: {
              inline_styles: { type: 'boolean', description: 'Embed styles directly in elements (default: false)' },
              lazy_linefeeds: { type: 'boolean', description: 'Convert single newlines to <br> (default: false)' },
              allow_unsafe_html: { type: 'boolean', description: 'Skip HTML escaping for trusted input (default: false)' }
            }
          }
        },
        required: ['markdown']
      }
    },
    {
      name: 'html_to_markdown',
      description: 'Convert HTML back to markdown using quikdown bidirectional converter.',
      inputSchema: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'HTML content to convert to markdown' }
        },
        required: ['html']
      }
    },
    {
      name: 'markdown_stats',
      description: 'Get statistics about a markdown string: character count, word count, line count, paragraph count.',
      inputSchema: {
        type: 'object',
        properties: {
          markdown: { type: 'string', description: 'Markdown content to analyze' }
        },
        required: ['markdown']
      }
    },
    {
      name: 'quikdown_info',
      description: 'Get quikdown version, available modules, active tool groups, and usage hints.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'markdown_to_ast',
      description: 'Parse markdown into an AST (Abstract Syntax Tree) object. Returns structured node tree.',
      inputSchema: {
        type: 'object',
        properties: {
          markdown: { type: 'string', description: 'Markdown content to parse' }
        },
        required: ['markdown']
      }
    },
    {
      name: 'markdown_to_json',
      description: 'Parse markdown into a JSON string representation of the AST.',
      inputSchema: {
        type: 'object',
        properties: {
          markdown: { type: 'string', description: 'Markdown content to parse' }
        },
        required: ['markdown']
      }
    }
  ];
}

function filesystemTools() {
  return [
    {
      name: 'read_file_info',
      description: 'Get file metadata: size in bytes, line count, and last modified time.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file (relative to root)' }
        },
        required: ['path']
      }
    },
    {
      name: 'read_file_lines',
      description: 'Read a range of lines from a file. Use for excerpts without loading full file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file (relative to root)' },
          start_line: { type: 'integer', description: 'Start line (1-based, inclusive)', default: 1 },
          end_line: { type: 'integer', description: 'End line (1-based, inclusive)' }
        },
        required: ['path', 'end_line']
      }
    },
    {
      name: 'read_file_markdown',
      description: 'Read the full contents of a markdown file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file (relative to root)' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_markdown_to_file',
      description: 'Write markdown content to a file. If content is omitted and editor is bound, writes current editor buffer.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to write (relative to root)' },
          content: { type: 'string', description: 'Markdown content (optional if editor bound)' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_html_to_file',
      description: 'Convert markdown to HTML and write to a file. Source can be explicit markdown, or current editor buffer.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to write (relative to root)' },
          markdown: { type: 'string', description: 'Markdown to convert (optional if editor bound)' }
        },
        required: ['path']
      }
    }
  ];
}

/** Large file threshold for load_file_to_editor (100 KB) */
const LARGE_FILE_THRESHOLD = 100 * 1024;

function editorTools() {
  return [
    {
      name: 'read_editor',
      description: 'Read the current markdown content from the editor buffer.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'write_editor',
      description: 'Replace the entire editor buffer with new markdown content.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'New markdown content' }
        },
        required: ['content']
      }
    },
    {
      name: 'find_regex',
      description: 'Search editor buffer with a regex pattern. Returns matches with line numbers and excerpts.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for (max 200 chars)' },
          flags: { type: 'string', description: 'Regex flags (default: "gi")', default: 'gi' },
          max_matches: { type: 'integer', description: 'Maximum matches to return (default: 50)', default: 50 }
        },
        required: ['pattern']
      }
    },
    {
      name: 'replace_regex',
      description: 'Replace text in editor buffer using a regex pattern.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to match (max 200 chars)' },
          replacement: { type: 'string', description: 'Replacement string (supports $1, $2, etc.)' },
          flags: { type: 'string', description: 'Regex flags (default: "g")', default: 'g' },
          limit: { type: 'string', enum: ['first', 'all'], description: 'Replace first match or all (default: "all")', default: 'all' }
        },
        required: ['pattern', 'replacement']
      }
    },
    {
      name: 'replace_text',
      description: 'Replace the first occurrence of a literal string in the editor buffer.',
      inputSchema: {
        type: 'object',
        properties: {
          find: { type: 'string', description: 'Text to find' },
          replace: { type: 'string', description: 'Replacement text' }
        },
        required: ['find', 'replace']
      }
    },
    {
      name: 'extract_text',
      description: 'Extract a range of lines from the editor buffer.',
      inputSchema: {
        type: 'object',
        properties: {
          start_line: { type: 'integer', description: 'Start line (1-based, inclusive)' },
          end_line: { type: 'integer', description: 'End line (1-based, inclusive)' }
        },
        required: ['start_line', 'end_line']
      }
    },
    {
      name: 'get_stats',
      description: 'Get word count, line count, character count, and paragraph count of the editor buffer.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_html',
      description: 'Get the HTML output of the current editor buffer (parser output).',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'undo',
      description: 'Undo the last editor change.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'redo',
      description: 'Redo the last undone editor change.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'load_file_to_editor',
      description: 'Read a file from disk and load it into the editor buffer. Requires filesystem root. Files over 100 KB return stats instead of loading.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file (relative to root)' }
        },
        required: ['path']
      }
    },
    {
      name: 'get_rendered',
      description: 'Get the rendered HTML from the editor preview (includes rasterized SVGs, Mermaid diagrams, etc.). Requires editor with getRenderedContent.',
      inputSchema: {
        type: 'object',
        properties: {
          output: { type: 'string', enum: ['default', 'stripped', 'quikdown'], description: 'Output profile (default: "default")', default: 'default' }
        }
      }
    },
    {
      name: 'write_rendered_to_file',
      description: 'Get the rendered HTML from the editor preview and write it to a file. Requires filesystem root and editor with getRenderedContent.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to write (relative to root)' },
          output: { type: 'string', enum: ['default', 'stripped', 'quikdown'], description: 'Output profile (default: "default")', default: 'default' }
        },
        required: ['path']
      }
    }
  ];
}

// ── Tool execution ────────────────────────────────────────────────────

function executeHeadlessTool(name, args, ctx) {
  switch (name) {
    case 'markdown_to_html':
      return { content: [{ type: 'text', text: quikdown(args.markdown, args.options || {}) }] };
    case 'html_to_markdown':
      return { content: [{ type: 'text', text: quikdown_bd.toMarkdown(args.html) }] };
    case 'markdown_stats':
      return { content: [{ type: 'text', text: JSON.stringify(markdownStats(args.markdown), null, 2) }] };
    case 'quikdown_info': {
      const groups = ['headless'];
      if (ctx.root) groups.push('filesystem');
      if (ctx.editor) groups.push('editor');
      const info = {
        version: quikdownVersion,
        modules: ['quikdown', 'quikdown/bd', 'quikdown/edit', 'quikdown/ast', 'quikdown/json', 'quikdown/yaml', 'quikdown/ast-html', 'quikdown/mcp'],
        active_groups: groups,
        hints: {
          get_html: 'Returns parser HTML output. Available when editor is bound.',
          markdown_to_html: 'Headless parse — works on any string, no editor needed.',
          write_markdown_to_file: 'Writes to disk. Requires filesystem group (Node).',
          find_regex: 'Search editor buffer with regex. Max 200 char pattern, 50 match cap.'
        }
      };
      return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }
    case 'markdown_to_ast':
      return { content: [{ type: 'text', text: JSON.stringify(quikdown_ast(args.markdown), null, 2) }] };
    case 'markdown_to_json':
      return { content: [{ type: 'text', text: quikdown_json(args.markdown) }] };
    default:
      return null;
  }
}

function executeFilesystemTool(name, args, ctx) {
  switch (name) {
    case 'read_file_info': {
      const fp = safePath(ctx.root, args.path);
      const stat = nodeFs.statSync(fp);
      const content = nodeFs.readFileSync(fp, 'utf-8');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path: args.path,
            size: stat.size,
            lines: content.split('\n').length,
            modified: stat.mtime.toISOString()
          }, null, 2)
        }]
      };
    }
    case 'read_file_lines': {
      const fp = safePath(ctx.root, args.path);
      const content = nodeFs.readFileSync(fp, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(1, args.start_line || 1);
      const end = Math.min(lines.length, args.end_line || lines.length);
      return {
        content: [{
          type: 'text',
          text: lines.slice(start - 1, end).join('\n')
        }]
      };
    }
    case 'read_file_markdown': {
      const fp = safePath(ctx.root, args.path);
      return { content: [{ type: 'text', text: nodeFs.readFileSync(fp, 'utf-8') }] };
    }
    case 'write_markdown_to_file': {
      const fp = safePath(ctx.root, args.path);
      const md = args.content || (ctx.editor ? ctx.editor.getMarkdown() : null);
      if (md === null || md === undefined) throw new Error('No content provided and no editor bound');
      nodeFs.mkdirSync(nodePath.dirname(fp), { recursive: true });
      nodeFs.writeFileSync(fp, md, 'utf-8');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ path: args.path, bytes_written: Buffer.byteLength(md, 'utf-8'), lines: md.split('\n').length })
        }]
      };
    }
    case 'write_html_to_file': {
      const fp = safePath(ctx.root, args.path);
      const md = args.markdown || (ctx.editor ? ctx.editor.getMarkdown() : null);
      if (md === null || md === undefined) throw new Error('No markdown source provided and no editor bound');
      const html = quikdown(md);
      nodeFs.mkdirSync(nodePath.dirname(fp), { recursive: true });
      nodeFs.writeFileSync(fp, html, 'utf-8');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ path: args.path, bytes_written: Buffer.byteLength(html, 'utf-8') })
        }]
      };
    }
    default:
      return null;
  }
}

function executeEditorTool(name, args, ctx) {
  const editor = ctx.editor;
  if (!editor) return null;

  switch (name) {
    case 'read_editor':
      return { content: [{ type: 'text', text: editor.getMarkdown() }] };
    case 'write_editor':
      editor.setMarkdown(String(args.content || ''));
      return { content: [{ type: 'text', text: 'Document replaced.' }] };
    case 'find_regex': {
      const pattern = String(args.pattern || '');
      if (pattern.length > 200) throw new Error('Pattern exceeds 200 character limit');
      const flags = String(args.flags || 'gi');
      const maxMatches = Math.min(args.max_matches || 50, 200);
      const re = new RegExp(pattern, flags);
      const md = editor.getMarkdown();
      const lines = md.split('\n');
      const matches = [];
      let m;
      while ((m = re.exec(md)) !== null && matches.length < maxMatches) {
        const lineNum = md.substring(0, m.index).split('\n').length;
        matches.push({
          match: m[0],
          line: lineNum,
          column: m.index - md.lastIndexOf('\n', m.index - 1),
          excerpt: lines[lineNum - 1] || ''
        });
        if (!re.global) break;
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: matches.length, matches }, null, 2)
        }]
      };
    }
    case 'replace_regex': {
      const pattern = String(args.pattern || '');
      if (pattern.length > 200) throw new Error('Pattern exceeds 200 character limit');
      const flags = args.limit === 'first' ? String(args.flags || 'g').replace('g', '') : String(args.flags || 'g');
      const re = new RegExp(pattern, flags);
      const md = editor.getMarkdown();
      const result = md.replace(re, args.replacement);
      const changed = result !== md;
      if (changed) editor.setMarkdown(result);
      return { content: [{ type: 'text', text: changed ? 'Replacement applied.' : 'No matches found.' }] };
    }
    case 'replace_text': {
      const find = String(args.find || '');
      const replace = String(args.replace || '');
      const md = editor.getMarkdown();
      const idx = md.indexOf(find);
      if (idx < 0) return { content: [{ type: 'text', text: 'No match found.' }] };
      editor.setMarkdown(md.slice(0, idx) + replace + md.slice(idx + find.length));
      return { content: [{ type: 'text', text: 'Replaced first occurrence.' }] };
    }
    case 'extract_text':
      return {
        content: [{
          type: 'text',
          text: extractLines(editor.getMarkdown(), args.start_line, args.end_line)
        }]
      };
    case 'get_stats':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(markdownStats(editor.getMarkdown()), null, 2)
        }]
      };
    case 'get_html':
      return { content: [{ type: 'text', text: editor.getHTML() }] };
    case 'undo':
      if (editor.canUndo && editor.canUndo()) {
        editor.undo();
        return { content: [{ type: 'text', text: editor.getMarkdown() }] };
      }
      return { content: [{ type: 'text', text: 'Nothing to undo.' }] };
    case 'redo':
      if (editor.canRedo && editor.canRedo()) {
        editor.redo();
        return { content: [{ type: 'text', text: editor.getMarkdown() }] };
      }
      return { content: [{ type: 'text', text: 'Nothing to redo.' }] };
    case 'load_file_to_editor': {
      if (!ctx.root) throw new Error('Filesystem root required for load_file_to_editor');
      const fp = safePath(ctx.root, args.path);
      const stat = nodeFs.statSync(fp);
      if (stat.size > LARGE_FILE_THRESHOLD) {
        const stats = {
          path: args.path,
          size: stat.size,
          lines: nodeFs.readFileSync(fp, 'utf-8').split('\n').length,
          skipped: true,
          reason: `File exceeds ${LARGE_FILE_THRESHOLD} byte threshold. Use read_file_lines for excerpts.`
        };
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }
      const content = nodeFs.readFileSync(fp, 'utf-8');
      editor.setMarkdown(content);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ path: args.path, bytes: stat.size, lines: content.split('\n').length, loaded: true })
        }]
      };
    }
    case 'get_rendered': {
      if (!editor.getRenderedContent) throw new Error('Editor binding does not support getRenderedContent (requires Path B host with preview DOM)');
      const output = args.output || 'default';
      const result = editor.getRenderedContent({ output });
      // Support both sync and async getRenderedContent
      if (result && typeof result.then === 'function') {
        throw new Error('Async getRenderedContent not supported in synchronous tool call. Use a Path B host with WebSocket bridge.');
      }
      if (!result || !result.success) throw new Error('Failed to get rendered content');
      return { content: [{ type: 'text', text: result.html || result.text || '' }] };
    }
    case 'write_rendered_to_file': {
      if (!ctx.root) throw new Error('Filesystem root required for write_rendered_to_file');
      if (!editor.getRenderedContent) throw new Error('Editor binding does not support getRenderedContent (requires Path B host with preview DOM)');
      const output = args.output || 'default';
      const result = editor.getRenderedContent({ output });
      if (result && typeof result.then === 'function') {
        throw new Error('Async getRenderedContent not supported in synchronous tool call. Use a Path B host with WebSocket bridge.');
      }
      if (!result || !result.success) throw new Error('Failed to get rendered content');
      const html = result.html || result.text || '';
      const fp = safePath(ctx.root, args.path);
      nodeFs.mkdirSync(nodePath.dirname(fp), { recursive: true });
      nodeFs.writeFileSync(fp, html, 'utf-8');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ path: args.path, bytes_written: Buffer.byteLength(html, 'utf-8') })
        }]
      };
    }
    default:
      return null;
  }
}

// ── JSON-RPC 2.0 server ──────────────────────────────────────────────

const JSONRPC_VERSION = '2.0';
const MCP_PROTOCOL_VERSION = '2024-11-05';

const SERVER_INFO = {
  name: 'quikdown-mcp',
  version: quikdownVersion
};

const SERVER_CAPABILITIES = {
  tools: {},
  resources: {}
};

/**
 * Create a quikdown MCP server.
 *
 * @param {object} [options]
 * @param {object} [options.editor]  QuikdownEditor instance (enables editor tools)
 * @param {string} [options.root]    Filesystem sandbox root (enables filesystem tools)
 * @returns {{ handleMessage, listenStdio, getTools, callTool }}
 */
function createMcpServer(options = {}) {
  const ctx = {
    editor: options.editor || null,
    root: options.root || null
  };

  function getTools() {
    const tools = [...headlessTools()];
    if (ctx.root) tools.push(...filesystemTools());
    if (ctx.editor) tools.push(...editorTools());
    return tools;
  }

  function callTool(name, args) {
    // Try each group in order
    let result = executeHeadlessTool(name, args, ctx);
    if (result) return result;

    if (ctx.root) {
      result = executeFilesystemTool(name, args, ctx);
      if (result) return result;
    }

    if (ctx.editor) {
      result = executeEditorTool(name, args, ctx);
      if (result) return result;
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  function handleMessage(message) {
    const { id, method, params } = message;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            serverInfo: SERVER_INFO,
            capabilities: SERVER_CAPABILITIES
          }
        };

      case 'notifications/initialized':
        // Client acknowledgment — no response needed
        return null;

      case 'tools/list':
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: { tools: getTools() }
        };

      case 'tools/call': {
        const toolName = params && params.name;
        const toolArgs = (params && params.arguments) || {};
        try {
          const result = callTool(toolName, toolArgs);
          return { jsonrpc: JSONRPC_VERSION, id, result };
        } catch (err) {
          return {
            jsonrpc: JSONRPC_VERSION,
            id,
            result: {
              isError: true,
              content: [{ type: 'text', text: err.message }]
            }
          };
        }
      }

      case 'resources/list':
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: {
            resources: [{
              uri: 'quikdown://meta',
              name: 'quikdown server metadata',
              mimeType: 'application/json',
              description: 'Version, active tool groups, and usage guidance'
            }]
          }
        };

      case 'resources/read': {
        const uri = params && params.uri;
        if (uri === 'quikdown://meta') {
          const groups = ['headless'];
          if (ctx.root) groups.push('filesystem');
          if (ctx.editor) groups.push('editor');
          return {
            jsonrpc: JSONRPC_VERSION,
            id,
            result: {
              contents: [{
                uri: 'quikdown://meta',
                mimeType: 'application/json',
                text: JSON.stringify({
                  version: quikdownVersion,
                  active_groups: groups,
                  guidance: 'Editor tools require a host with QuikdownEditor. Filesystem tools require a Node.js environment with a root directory.'
                }, null, 2)
              }]
            }
          };
        }
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          error: { code: -32602, message: `Unknown resource: ${uri}` }
        };
      }

      case 'ping':
        return { jsonrpc: JSONRPC_VERSION, id, result: {} };

      default:
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }
  }

  function listenStdio() {
    const rl = nodeReadline.createInterface({ input: process.stdin, terminal: false });
    let buffer = '';

    rl.on('line', (line) => {
      buffer += line;
      let msg;
      try {
        msg = JSON.parse(buffer);
        buffer = '';
      } catch {
        // Incomplete JSON — accumulate more lines
        return;
      }

      const response = handleMessage(msg);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    });

    rl.on('close', () => process.exit(0));
  }

  return { handleMessage, listenStdio, getTools, callTool };
}

export { createMcpServer, createMcpServer as default };
