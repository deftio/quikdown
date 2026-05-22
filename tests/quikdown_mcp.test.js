/**
 * Tests for quikdown_mcp — MCP (Model Context Protocol) server
 *
 * Tests all three tool groups:
 *   1. Headless  — always available
 *   2. Filesystem — when root is set
 *   3. Editor    — when editor binding is provided
 *
 * Also tests JSON-RPC 2.0 protocol handling.
 */
import { createMcpServer } from '../dist/quikdown_mcp.esm.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

// ── Test helpers ──────────────────────────────────────────────────────

/** Create a JSON-RPC 2.0 request. */
function rpc(id, method, params) {
  return { jsonrpc: '2.0', id, method, params };
}

/** Simple mock editor for testing editor tools. */
function createMockEditor(initialMarkdown = '') {
  let md = initialMarkdown;
  const history = [initialMarkdown];
  let historyIndex = 0;

  return {
    getMarkdown: () => md,
    setMarkdown: (newMd) => {
      md = newMd;
      history.splice(historyIndex + 1);
      history.push(newMd);
      historyIndex = history.length - 1;
    },
    getHTML: () => `<p>${md}</p>`,
    canUndo: () => historyIndex > 0,
    canRedo: () => historyIndex < history.length - 1,
    undo: () => {
      if (historyIndex > 0) {
        historyIndex--;
        md = history[historyIndex];
      }
    },
    redo: () => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        md = history[historyIndex];
      }
    }
  };
}

// ── JSON-RPC protocol ─────────────────────────────────────────────────

describe('MCP JSON-RPC protocol', () => {
  let mcp;

  beforeAll(() => {
    mcp = createMcpServer();
  });

  test('initialize returns protocol version and server info', () => {
    const res = mcp.handleMessage(rpc(1, 'initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test', version: '1.0' },
      capabilities: {}
    }));
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result.protocolVersion).toBe('2024-11-05');
    expect(res.result.serverInfo.name).toBe('quikdown-mcp');
    expect(res.result.serverInfo.version).toBe(packageJson.version);
    expect(res.result.capabilities).toBeDefined();
  });

  test('notifications/initialized returns null (no response)', () => {
    const res = mcp.handleMessage(rpc(undefined, 'notifications/initialized'));
    expect(res).toBeNull();
  });

  test('ping returns empty result', () => {
    const res = mcp.handleMessage(rpc(2, 'ping'));
    expect(res.id).toBe(2);
    expect(res.result).toEqual({});
  });

  test('unknown method returns error -32601', () => {
    const res = mcp.handleMessage(rpc(3, 'nonexistent/method'));
    expect(res.error.code).toBe(-32601);
    expect(res.error.message).toContain('nonexistent/method');
  });

  test('tools/list returns tool array', () => {
    const res = mcp.handleMessage(rpc(4, 'tools/list'));
    expect(res.result.tools).toBeInstanceOf(Array);
    expect(res.result.tools.length).toBeGreaterThan(0);
    for (const tool of res.result.tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  test('resources/list includes quikdown://meta', () => {
    const res = mcp.handleMessage(rpc(5, 'resources/list'));
    expect(res.result.resources).toBeInstanceOf(Array);
    const meta = res.result.resources.find(r => r.uri === 'quikdown://meta');
    expect(meta).toBeDefined();
    expect(meta.mimeType).toBe('application/json');
  });

  test('resources/read quikdown://meta returns JSON', () => {
    const res = mcp.handleMessage(rpc(6, 'resources/read', { uri: 'quikdown://meta' }));
    expect(res.result.contents).toBeInstanceOf(Array);
    const content = JSON.parse(res.result.contents[0].text);
    expect(content.version).toBe(packageJson.version);
    expect(content.active_groups).toContain('headless');
  });

  test('resources/read unknown URI returns error', () => {
    const res = mcp.handleMessage(rpc(7, 'resources/read', { uri: 'quikdown://nothing' }));
    expect(res.error.code).toBe(-32602);
  });
});

// ── Headless tools ────────────────────────────────────────────────────

describe('MCP headless tools', () => {
  let mcp;

  beforeAll(() => {
    mcp = createMcpServer();
  });

  test('headless-only server has exactly 6 tools', () => {
    const tools = mcp.getTools();
    expect(tools).toHaveLength(6);
    const names = tools.map(t => t.name);
    expect(names).toContain('markdown_to_html');
    expect(names).toContain('html_to_markdown');
    expect(names).toContain('markdown_stats');
    expect(names).toContain('quikdown_info');
    expect(names).toContain('markdown_to_ast');
    expect(names).toContain('markdown_to_json');
  });

  test('markdown_to_html converts basic markdown', () => {
    const result = mcp.callTool('markdown_to_html', { markdown: '# Hello\n\nWorld' });
    expect(result.content[0].text).toContain('<h1');
    expect(result.content[0].text).toContain('Hello');
    expect(result.content[0].text).toContain('World');
  });

  test('markdown_to_html with options', () => {
    const result = mcp.callTool('markdown_to_html', {
      markdown: '**bold**',
      options: { inline_styles: true }
    });
    expect(result.content[0].text).toContain('<strong');
    expect(result.content[0].text).toContain('bold');
  });

  test('html_to_markdown converts HTML', () => {
    const result = mcp.callTool('html_to_markdown', { html: '<h1>Title</h1><p>Text</p>' });
    const md = result.content[0].text;
    expect(md).toContain('# Title');
    expect(md).toContain('Text');
  });

  test('markdown_stats returns counts', () => {
    const result = mcp.callTool('markdown_stats', { markdown: 'Hello world\n\nSecond paragraph' });
    const stats = JSON.parse(result.content[0].text);
    expect(stats.words).toBe(4);
    expect(stats.lines).toBe(3);
    expect(stats.paragraphs).toBe(2);
    expect(stats.characters).toBeGreaterThan(0);
  });

  test('markdown_stats handles empty input', () => {
    const result = mcp.callTool('markdown_stats', { markdown: '' });
    const stats = JSON.parse(result.content[0].text);
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
  });

  test('quikdown_info returns version and groups', () => {
    const result = mcp.callTool('quikdown_info', {});
    const info = JSON.parse(result.content[0].text);
    expect(info.version).toBe(packageJson.version);
    expect(info.active_groups).toContain('headless');
    expect(info.active_groups).not.toContain('filesystem');
    expect(info.active_groups).not.toContain('editor');
    expect(info.modules).toContain('quikdown/mcp');
  });

  test('markdown_to_ast returns structured AST', () => {
    const result = mcp.callTool('markdown_to_ast', { markdown: '# Hello\n\nA paragraph.' });
    const ast = JSON.parse(result.content[0].text);
    expect(ast).toBeDefined();
    expect(ast.type).toBe('document');
    expect(Array.isArray(ast.children)).toBe(true);
    expect(ast.children.length).toBeGreaterThan(0);
  });

  test('markdown_to_ast with empty input', () => {
    const result = mcp.callTool('markdown_to_ast', { markdown: '' });
    const ast = JSON.parse(result.content[0].text);
    expect(ast).toBeDefined();
    expect(ast.type).toBe('document');
  });

  test('markdown_to_json returns JSON string', () => {
    const result = mcp.callTool('markdown_to_json', { markdown: '**bold** text' });
    const text = result.content[0].text;
    expect(typeof text).toBe('string');
    const parsed = JSON.parse(text);
    expect(parsed.type).toBe('document');
    expect(parsed.children.length).toBeGreaterThan(0);
  });

  test('markdown_to_json with empty input', () => {
    const result = mcp.callTool('markdown_to_json', { markdown: '' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.type).toBe('document');
  });

  test('unknown tool throws error', () => {
    expect(() => mcp.callTool('nonexistent_tool', {})).toThrow('Unknown tool');
  });

  test('tools/call via handleMessage returns tool result', () => {
    const res = mcp.handleMessage(rpc(10, 'tools/call', {
      name: 'markdown_to_html',
      arguments: { markdown: '**test**' }
    }));
    expect(res.result.content[0].text).toContain('strong');
  });

  test('tools/call unknown tool returns isError result', () => {
    const res = mcp.handleMessage(rpc(11, 'tools/call', {
      name: 'fake_tool',
      arguments: {}
    }));
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('Unknown tool');
  });
});

// ── Filesystem tools ──────────────────────────────────────────────────

describe('MCP filesystem tools', () => {
  let mcp;
  let tmpRoot;

  beforeAll(() => {
    tmpRoot = join(tmpdir(), `quikdown-mcp-test-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
    mcp = createMcpServer({ root: tmpRoot });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('filesystem server has headless + filesystem tools', () => {
    const tools = mcp.getTools();
    const names = tools.map(t => t.name);
    expect(names).toContain('markdown_to_html');
    expect(names).toContain('read_file_info');
    expect(names).toContain('read_file_lines');
    expect(names).toContain('read_file_markdown');
    expect(names).toContain('write_markdown_to_file');
    expect(names).toContain('write_html_to_file');
    expect(tools.length).toBe(11); // 6 headless + 5 filesystem
  });

  test('quikdown_info reports filesystem group', () => {
    const result = mcp.callTool('quikdown_info', {});
    const info = JSON.parse(result.content[0].text);
    expect(info.active_groups).toContain('filesystem');
  });

  test('write_markdown_to_file creates file', () => {
    const result = mcp.callTool('write_markdown_to_file', {
      path: 'test.md',
      content: '# Test\n\nHello world'
    });
    const info = JSON.parse(result.content[0].text);
    expect(info.path).toBe('test.md');
    expect(info.lines).toBe(3);

    const written = readFileSync(join(tmpRoot, 'test.md'), 'utf-8');
    expect(written).toBe('# Test\n\nHello world');
  });

  test('write_markdown_to_file creates subdirectories', () => {
    mcp.callTool('write_markdown_to_file', {
      path: 'sub/dir/nested.md',
      content: 'nested content'
    });
    expect(existsSync(join(tmpRoot, 'sub/dir/nested.md'))).toBe(true);
  });

  test('read_file_markdown reads file', () => {
    writeFileSync(join(tmpRoot, 'read-test.md'), '# Read me\n\nContent here');
    const result = mcp.callTool('read_file_markdown', { path: 'read-test.md' });
    expect(result.content[0].text).toBe('# Read me\n\nContent here');
  });

  test('read_file_info returns metadata', () => {
    writeFileSync(join(tmpRoot, 'info-test.md'), 'line1\nline2\nline3');
    const result = mcp.callTool('read_file_info', { path: 'info-test.md' });
    const info = JSON.parse(result.content[0].text);
    expect(info.path).toBe('info-test.md');
    expect(info.lines).toBe(3);
    expect(info.size).toBeGreaterThan(0);
    expect(info.modified).toBeDefined();
  });

  test('read_file_lines extracts line range', () => {
    writeFileSync(join(tmpRoot, 'lines-test.md'), 'line1\nline2\nline3\nline4\nline5');
    const result = mcp.callTool('read_file_lines', { path: 'lines-test.md', start_line: 2, end_line: 4 });
    expect(result.content[0].text).toBe('line2\nline3\nline4');
  });

  test('write_html_to_file converts and writes', () => {
    const result = mcp.callTool('write_html_to_file', {
      path: 'output.html',
      markdown: '# Title\n\nParagraph'
    });
    const info = JSON.parse(result.content[0].text);
    expect(info.path).toBe('output.html');
    const html = readFileSync(join(tmpRoot, 'output.html'), 'utf-8');
    expect(html).toContain('<h1');
    expect(html).toContain('Title');
  });

  test('sandbox rejects path traversal', () => {
    expect(() => {
      mcp.callTool('read_file_markdown', { path: '../../etc/passwd' });
    }).toThrow('outside sandbox');
  });

  test('sandbox rejects absolute paths outside root', () => {
    expect(() => {
      mcp.callTool('read_file_markdown', { path: '/etc/passwd' });
    }).toThrow('outside sandbox');
  });

  test('write_markdown_to_file without content and no editor throws', () => {
    expect(() => {
      mcp.callTool('write_markdown_to_file', { path: 'empty.md' });
    }).toThrow('No content');
  });

  test('write_html_to_file without markdown and no editor throws', () => {
    expect(() => {
      mcp.callTool('write_html_to_file', { path: 'empty.html' });
    }).toThrow('No markdown');
  });
});

// ── Editor tools ──────────────────────────────────────────────────────

describe('MCP editor tools', () => {
  let mcp;
  let editor;

  beforeEach(() => {
    editor = createMockEditor('# Hello\n\nThis is a test.\nAnother line.');
    mcp = createMcpServer({ editor });
  });

  test('editor server has headless + editor tools', () => {
    const tools = mcp.getTools();
    const names = tools.map(t => t.name);
    expect(names).toContain('markdown_to_html');
    expect(names).toContain('read_editor');
    expect(names).toContain('write_editor');
    expect(names).toContain('find_regex');
    expect(names).toContain('replace_regex');
    expect(names).toContain('replace_text');
    expect(names).toContain('extract_text');
    expect(names).toContain('get_stats');
    expect(names).toContain('get_html');
    expect(names).toContain('undo');
    expect(names).toContain('redo');
    expect(names).toContain('load_file_to_editor');
    expect(names).toContain('get_rendered');
    expect(names).toContain('write_rendered_to_file');
    expect(tools.length).toBe(19); // 6 headless + 13 editor
  });

  test('read_editor returns current buffer', () => {
    const result = mcp.callTool('read_editor', {});
    expect(result.content[0].text).toBe('# Hello\n\nThis is a test.\nAnother line.');
  });

  test('write_editor replaces buffer', () => {
    mcp.callTool('write_editor', { content: 'New content' });
    expect(editor.getMarkdown()).toBe('New content');
  });

  test('write_editor returns confirmation', () => {
    const result = mcp.callTool('write_editor', { content: 'New' });
    expect(result.content[0].text).toBe('Document replaced.');
  });

  test('find_regex returns matches with line numbers', () => {
    const result = mcp.callTool('find_regex', { pattern: 'line' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.matches[0].line).toBe(4);
    expect(data.matches[0].excerpt).toBe('Another line.');
  });

  test('find_regex with case-insensitive flag', () => {
    editor.setMarkdown('Hello hello HELLO');
    const result = mcp.callTool('find_regex', { pattern: 'hello', flags: 'gi' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(3);
  });

  test('find_regex rejects patterns over 200 chars', () => {
    expect(() => {
      mcp.callTool('find_regex', { pattern: 'a'.repeat(201) });
    }).toThrow('200 character limit');
  });

  test('find_regex respects max_matches', () => {
    editor.setMarkdown('a a a a a a a a a a');
    const result = mcp.callTool('find_regex', { pattern: 'a', flags: 'gi', max_matches: 3 });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(3);
  });

  test('replace_regex replaces matches', () => {
    const result = mcp.callTool('replace_regex', {
      pattern: 'test',
      replacement: 'document',
      flags: 'g'
    });
    expect(result.content[0].text).toBe('Replacement applied.');
    expect(editor.getMarkdown()).toContain('document');
    expect(editor.getMarkdown()).not.toContain('test');
  });

  test('replace_regex with limit first', () => {
    editor.setMarkdown('foo foo foo');
    mcp.callTool('replace_regex', {
      pattern: 'foo',
      replacement: 'bar',
      flags: 'g',
      limit: 'first'
    });
    expect(editor.getMarkdown()).toBe('bar foo foo');
  });

  test('replace_regex no match returns message', () => {
    const result = mcp.callTool('replace_regex', {
      pattern: 'zzzzz',
      replacement: 'nope'
    });
    expect(result.content[0].text).toBe('No matches found.');
  });

  test('replace_regex rejects patterns over 200 chars', () => {
    expect(() => {
      mcp.callTool('replace_regex', { pattern: 'a'.repeat(201), replacement: 'b' });
    }).toThrow('200 character limit');
  });

  test('replace_text replaces first occurrence', () => {
    editor.setMarkdown('hello world hello');
    const result = mcp.callTool('replace_text', { find: 'hello', replace: 'goodbye' });
    expect(result.content[0].text).toBe('Replaced first occurrence.');
    expect(editor.getMarkdown()).toBe('goodbye world hello');
  });

  test('replace_text no match returns message', () => {
    const result = mcp.callTool('replace_text', { find: 'zzzzz', replace: 'nope' });
    expect(result.content[0].text).toBe('No match found.');
  });

  test('extract_text returns line range', () => {
    const result = mcp.callTool('extract_text', { start_line: 1, end_line: 1 });
    expect(result.content[0].text).toBe('# Hello');
  });

  test('get_stats returns buffer statistics', () => {
    const result = mcp.callTool('get_stats', {});
    const stats = JSON.parse(result.content[0].text);
    expect(stats.words).toBeGreaterThan(0);
    expect(stats.lines).toBe(4);
  });

  test('get_html returns editor HTML', () => {
    const result = mcp.callTool('get_html', {});
    expect(result.content[0].text).toContain('<p>');
  });

  test('undo reverts last change', () => {
    mcp.callTool('write_editor', { content: 'changed' });
    expect(editor.getMarkdown()).toBe('changed');
    const result = mcp.callTool('undo', {});
    expect(result.content[0].text).toBe('# Hello\n\nThis is a test.\nAnother line.');
  });

  test('undo with nothing to undo', () => {
    const freshEditor = createMockEditor('fresh');
    const freshMcp = createMcpServer({ editor: freshEditor });
    const result = freshMcp.callTool('undo', {});
    expect(result.content[0].text).toBe('Nothing to undo.');
  });

  test('redo after undo', () => {
    mcp.callTool('write_editor', { content: 'changed' });
    mcp.callTool('undo', {});
    const result = mcp.callTool('redo', {});
    expect(result.content[0].text).toBe('changed');
  });

  test('redo with nothing to redo', () => {
    const result = mcp.callTool('redo', {});
    expect(result.content[0].text).toBe('Nothing to redo.');
  });
});

// ── Full server (all three groups) ────────────────────────────────────

describe('MCP full server (headless + filesystem + editor)', () => {
  let mcp;
  let editor;
  let tmpRoot;

  beforeAll(() => {
    tmpRoot = join(tmpdir(), `quikdown-mcp-full-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
    editor = createMockEditor('# Doc\n\nContent');
    mcp = createMcpServer({ editor, root: tmpRoot });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('full server has all three groups', () => {
    const tools = mcp.getTools();
    const names = tools.map(t => t.name);
    // 6 headless + 5 filesystem + 13 editor = 24
    expect(tools.length).toBe(24);
    expect(names).toContain('markdown_to_html');
    expect(names).toContain('read_file_info');
    expect(names).toContain('read_editor');
    expect(names).toContain('load_file_to_editor');
    expect(names).toContain('get_rendered');
    expect(names).toContain('write_rendered_to_file');
  });

  test('quikdown_info reports all groups', () => {
    const result = mcp.callTool('quikdown_info', {});
    const info = JSON.parse(result.content[0].text);
    expect(info.active_groups).toEqual(['headless', 'filesystem', 'editor']);
  });

  test('write_markdown_to_file with editor fallback', () => {
    // No content arg — should use editor buffer
    mcp.callTool('write_markdown_to_file', { path: 'from-editor.md' });
    const written = readFileSync(join(tmpRoot, 'from-editor.md'), 'utf-8');
    expect(written).toBe('# Doc\n\nContent');
  });

  test('write_html_to_file with editor fallback', () => {
    mcp.callTool('write_html_to_file', { path: 'from-editor.html' });
    const html = readFileSync(join(tmpRoot, 'from-editor.html'), 'utf-8');
    expect(html).toContain('<h1');
    expect(html).toContain('Doc');
  });

  test('resources/read meta reports all groups', () => {
    const res = mcp.handleMessage(rpc(20, 'resources/read', { uri: 'quikdown://meta' }));
    const content = JSON.parse(res.result.contents[0].text);
    expect(content.active_groups).toEqual(['headless', 'filesystem', 'editor']);
  });
});

// ── Edge cases and deep branch coverage ───────────────────────────────

describe('MCP edge cases', () => {
  test('createMcpServer with no options works', () => {
    const mcp = createMcpServer();
    expect(mcp.getTools().length).toBe(6);
  });

  test('createMcpServer with empty object works', () => {
    const mcp = createMcpServer({});
    expect(mcp.getTools().length).toBe(6);
  });

  test('tools/call with missing arguments defaults to empty object', () => {
    const mcp = createMcpServer();
    const res = mcp.handleMessage(rpc(30, 'tools/call', { name: 'quikdown_info' }));
    expect(res.result.content).toBeDefined();
    expect(res.result.isError).toBeUndefined();
  });

  test('each tool has valid inputSchema', () => {
    const mcp = createMcpServer({
      editor: createMockEditor(''),
      root: tmpdir()
    });
    for (const tool of mcp.getTools()) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });
});

// ── Deep branch coverage ──────────────────────────────────────────────

describe('MCP branch coverage — markdownStats', () => {
  let mcp;
  beforeAll(() => { mcp = createMcpServer(); });

  test('null markdown', () => {
    const result = mcp.callTool('markdown_stats', { markdown: null });
    const stats = JSON.parse(result.content[0].text);
    expect(stats.words).toBe(0);
    expect(stats.lines).toBe(1);
  });

  test('undefined markdown', () => {
    const result = mcp.callTool('markdown_stats', { markdown: undefined });
    const stats = JSON.parse(result.content[0].text);
    expect(stats.words).toBe(0);
  });

  test('whitespace-only markdown', () => {
    const result = mcp.callTool('markdown_stats', { markdown: '   \n\n  \n' });
    const stats = JSON.parse(result.content[0].text);
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.lines).toBe(4);
  });
});

describe('MCP branch coverage — markdown_to_html edge cases', () => {
  let mcp;
  beforeAll(() => { mcp = createMcpServer(); });

  test('markdown_to_html with no options (default)', () => {
    const result = mcp.callTool('markdown_to_html', { markdown: 'plain text' });
    expect(result.content[0].text).toContain('plain text');
  });

  test('markdown_to_html with lazy_linefeeds option', () => {
    const result = mcp.callTool('markdown_to_html', {
      markdown: 'line1\nline2',
      options: { lazy_linefeeds: true }
    });
    expect(result.content[0].text).toContain('<br');
  });
});

describe('MCP branch coverage — safePath', () => {
  let mcp;
  let tmpRoot;

  beforeAll(() => {
    tmpRoot = join(tmpdir(), `quikdown-mcp-safe-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
    writeFileSync(join(tmpRoot, 'root-file.md'), 'root content');
    mcp = createMcpServer({ root: tmpRoot });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('path resolving to root itself is allowed', () => {
    // Requesting '.' resolves to root — tests the `resolved === normalizedRoot` branch
    const result = mcp.callTool('read_file_info', { path: 'root-file.md' });
    const info = JSON.parse(result.content[0].text);
    expect(info.path).toBe('root-file.md');
  });
});

describe('MCP branch coverage — read_file_lines defaults', () => {
  let mcp;
  let tmpRoot;

  beforeAll(() => {
    tmpRoot = join(tmpdir(), `quikdown-mcp-lines-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
    writeFileSync(join(tmpRoot, 'lines.md'), 'A\nB\nC\nD\nE');
    mcp = createMcpServer({ root: tmpRoot });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('read_file_lines with no start_line defaults to 1', () => {
    const result = mcp.callTool('read_file_lines', { path: 'lines.md', end_line: 2 });
    expect(result.content[0].text).toBe('A\nB');
  });

  test('read_file_lines end_line beyond file length clamps', () => {
    const result = mcp.callTool('read_file_lines', { path: 'lines.md', start_line: 4, end_line: 100 });
    expect(result.content[0].text).toBe('D\nE');
  });

  test('read_file_lines start_line of 0 clamps to 1', () => {
    const result = mcp.callTool('read_file_lines', { path: 'lines.md', start_line: 0, end_line: 2 });
    expect(result.content[0].text).toBe('A\nB');
  });
});

describe('MCP branch coverage — find_regex non-global', () => {
  let mcp;
  let editor;

  beforeAll(() => {
    editor = createMockEditor('foo bar foo baz foo');
    mcp = createMcpServer({ editor });
  });

  test('non-global regex returns only first match', () => {
    // No 'g' flag — should break after first match
    const result = mcp.callTool('find_regex', { pattern: 'foo', flags: 'i' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.matches[0].match).toBe('foo');
  });

  test('find_regex with no flags defaults to gi', () => {
    const result = mcp.callTool('find_regex', { pattern: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(3); // global + case-insensitive
  });

  test('find_regex with no matches returns empty array', () => {
    const result = mcp.callTool('find_regex', { pattern: 'zzz' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.matches).toEqual([]);
  });
});

describe('MCP branch coverage — editor without canUndo/canRedo', () => {
  test('undo on editor without canUndo method', () => {
    // Minimal editor — no canUndo/canRedo
    const minimalEditor = {
      getMarkdown: () => 'text',
      setMarkdown: () => {},
      getHTML: () => '<p>text</p>'
    };
    const mcp = createMcpServer({ editor: minimalEditor });
    const result = mcp.callTool('undo', {});
    expect(result.content[0].text).toBe('Nothing to undo.');
  });

  test('redo on editor without canRedo method', () => {
    const minimalEditor = {
      getMarkdown: () => 'text',
      setMarkdown: () => {},
      getHTML: () => '<p>text</p>'
    };
    const mcp = createMcpServer({ editor: minimalEditor });
    const result = mcp.callTool('redo', {});
    expect(result.content[0].text).toBe('Nothing to redo.');
  });
});

describe('MCP branch coverage — write_editor with empty content', () => {
  test('write_editor with undefined content defaults to empty string', () => {
    const editor = createMockEditor('original');
    const mcp = createMcpServer({ editor });
    mcp.callTool('write_editor', {});
    expect(editor.getMarkdown()).toBe('');
  });
});

describe('MCP branch coverage — replace_regex flags', () => {
  test('replace_regex with limit all (explicit)', () => {
    const editor = createMockEditor('aaa');
    const mcp = createMcpServer({ editor });
    mcp.callTool('replace_regex', {
      pattern: 'a',
      replacement: 'b',
      flags: 'g',
      limit: 'all'
    });
    expect(editor.getMarkdown()).toBe('bbb');
  });

  test('replace_regex with no flags defaults to g', () => {
    const editor = createMockEditor('aaa');
    const mcp = createMcpServer({ editor });
    mcp.callTool('replace_regex', {
      pattern: 'a',
      replacement: 'b'
    });
    expect(editor.getMarkdown()).toBe('bbb');
  });

  test('replace_regex with capture groups', () => {
    const editor = createMockEditor('hello world');
    const mcp = createMcpServer({ editor });
    mcp.callTool('replace_regex', {
      pattern: '(hello) (world)',
      replacement: '$2 $1',
      flags: 'g'
    });
    expect(editor.getMarkdown()).toBe('world hello');
  });
});

describe('MCP branch coverage — replace_text edge cases', () => {
  test('replace_text with empty find string matches at start', () => {
    const editor = createMockEditor('abc');
    const mcp = createMcpServer({ editor });
    const result = mcp.callTool('replace_text', { find: '', replace: 'X' });
    expect(result.content[0].text).toBe('Replaced first occurrence.');
    expect(editor.getMarkdown()).toBe('Xabc');
  });

  test('replace_text with empty replace string deletes match', () => {
    const editor = createMockEditor('hello world');
    const mcp = createMcpServer({ editor });
    mcp.callTool('replace_text', { find: 'hello ', replace: '' });
    expect(editor.getMarkdown()).toBe('world');
  });
});

describe('MCP branch coverage — extract_text', () => {
  test('extract_text multi-line range', () => {
    const editor = createMockEditor('line1\nline2\nline3\nline4');
    const mcp = createMcpServer({ editor });
    const result = mcp.callTool('extract_text', { start_line: 2, end_line: 3 });
    expect(result.content[0].text).toBe('line2\nline3');
  });
});

describe('MCP branch coverage — tools/call error wrapping', () => {
  test('filesystem tool error is wrapped in isError result', () => {
    const tmpRoot = join(tmpdir(), `quikdown-mcp-err-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
    const mcp = createMcpServer({ root: tmpRoot });
    const res = mcp.handleMessage(rpc(40, 'tools/call', {
      name: 'read_file_markdown',
      arguments: { path: 'nonexistent-file.md' }
    }));
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toBeDefined();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('editor find_regex error is wrapped in isError result', () => {
    const editor = createMockEditor('text');
    const mcp = createMcpServer({ editor });
    const res = mcp.handleMessage(rpc(41, 'tools/call', {
      name: 'find_regex',
      arguments: { pattern: 'a'.repeat(201) }
    }));
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('200 character');
  });
});

describe('MCP branch coverage — quikdown_info with mixed groups', () => {
  test('quikdown_info with only editor (no filesystem)', () => {
    const editor = createMockEditor('test');
    const mcp = createMcpServer({ editor });
    const result = mcp.callTool('quikdown_info', {});
    const info = JSON.parse(result.content[0].text);
    expect(info.active_groups).toEqual(['headless', 'editor']);
    expect(info.active_groups).not.toContain('filesystem');
  });

  test('quikdown_info with only filesystem (no editor)', () => {
    const mcp = createMcpServer({ root: tmpdir() });
    const result = mcp.callTool('quikdown_info', {});
    const info = JSON.parse(result.content[0].text);
    expect(info.active_groups).toEqual(['headless', 'filesystem']);
    expect(info.active_groups).not.toContain('editor');
  });
});

describe('MCP branch coverage — resources/read meta with mixed groups', () => {
  test('meta resource with filesystem only', () => {
    const mcp = createMcpServer({ root: tmpdir() });
    const res = mcp.handleMessage(rpc(50, 'resources/read', { uri: 'quikdown://meta' }));
    const content = JSON.parse(res.result.contents[0].text);
    expect(content.active_groups).toEqual(['headless', 'filesystem']);
  });

  test('meta resource with editor only', () => {
    const mcp = createMcpServer({ editor: createMockEditor('') });
    const res = mcp.handleMessage(rpc(51, 'resources/read', { uri: 'quikdown://meta' }));
    const content = JSON.parse(res.result.contents[0].text);
    expect(content.active_groups).toEqual(['headless', 'editor']);
  });

  test('meta resource guidance text is present', () => {
    const mcp = createMcpServer();
    const res = mcp.handleMessage(rpc(52, 'resources/read', { uri: 'quikdown://meta' }));
    const content = JSON.parse(res.result.contents[0].text);
    expect(content.guidance).toBeDefined();
    expect(typeof content.guidance).toBe('string');
  });
});

// ── New tools: load_file_to_editor, get_rendered, write_rendered_to_file ─────

describe('MCP load_file_to_editor', () => {
  let mcp;
  let editor;
  let tmpRoot;

  beforeAll(() => {
    tmpRoot = join(tmpdir(), `quikdown-mcp-load-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
    editor = createMockEditor('initial');
    mcp = createMcpServer({ editor, root: tmpRoot });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('loads file into editor', () => {
    writeFileSync(join(tmpRoot, 'doc.md'), '# Loaded\n\nContent here');
    const result = mcp.callTool('load_file_to_editor', { path: 'doc.md' });
    const info = JSON.parse(result.content[0].text);
    expect(info.loaded).toBe(true);
    expect(info.lines).toBe(3);
    expect(editor.getMarkdown()).toBe('# Loaded\n\nContent here');
  });

  test('rejects large files (over 100KB)', () => {
    const largeContent = 'x'.repeat(101 * 1024);
    writeFileSync(join(tmpRoot, 'large.md'), largeContent);
    const result = mcp.callTool('load_file_to_editor', { path: 'large.md' });
    const info = JSON.parse(result.content[0].text);
    expect(info.skipped).toBe(true);
    expect(info.reason).toContain('threshold');
    // Editor should NOT have been updated
    expect(editor.getMarkdown()).not.toBe(largeContent);
  });

  test('throws without filesystem root', () => {
    const noRootMcp = createMcpServer({ editor: createMockEditor('') });
    expect(() => {
      noRootMcp.callTool('load_file_to_editor', { path: 'file.md' });
    }).toThrow('Filesystem root required');
  });

  test('rejects path traversal', () => {
    expect(() => {
      mcp.callTool('load_file_to_editor', { path: '../../etc/passwd' });
    }).toThrow('outside sandbox');
  });

  test('throws for nonexistent file', () => {
    expect(() => {
      mcp.callTool('load_file_to_editor', { path: 'nonexistent.md' });
    }).toThrow();
  });
});

describe('MCP get_rendered', () => {
  test('calls getRenderedContent on editor binding', () => {
    const editor = createMockEditor('# Hello');
    editor.getRenderedContent = (options) => ({
      success: true,
      html: '<h1>Hello</h1>',
      text: 'Hello'
    });
    const mcp = createMcpServer({ editor });
    const result = mcp.callTool('get_rendered', { output: 'default' });
    expect(result.content[0].text).toBe('<h1>Hello</h1>');
  });

  test('passes output option through', () => {
    let capturedOptions;
    const editor = createMockEditor('');
    editor.getRenderedContent = (options) => {
      capturedOptions = options;
      return { success: true, html: '<p>stripped</p>' };
    };
    const mcp = createMcpServer({ editor });
    mcp.callTool('get_rendered', { output: 'stripped' });
    expect(capturedOptions.output).toBe('stripped');
  });

  test('defaults to "default" output when not specified', () => {
    let capturedOptions;
    const editor = createMockEditor('');
    editor.getRenderedContent = (options) => {
      capturedOptions = options;
      return { success: true, html: '<p>test</p>' };
    };
    const mcp = createMcpServer({ editor });
    mcp.callTool('get_rendered', {});
    expect(capturedOptions.output).toBe('default');
  });

  test('throws when editor lacks getRenderedContent', () => {
    const editor = createMockEditor('');
    const mcp = createMcpServer({ editor });
    expect(() => {
      mcp.callTool('get_rendered', {});
    }).toThrow('does not support getRenderedContent');
  });

  test('throws when getRenderedContent returns failure', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => ({ success: false });
    const mcp = createMcpServer({ editor });
    expect(() => {
      mcp.callTool('get_rendered', {});
    }).toThrow('Failed to get rendered content');
  });

  test('throws when getRenderedContent returns a promise (async)', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => Promise.resolve({ success: true, html: '<p>async</p>' });
    const mcp = createMcpServer({ editor });
    expect(() => {
      mcp.callTool('get_rendered', {});
    }).toThrow('Async getRenderedContent');
  });

  test('falls back to text when html is empty', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => ({ success: true, text: 'plain text' });
    const mcp = createMcpServer({ editor });
    const result = mcp.callTool('get_rendered', {});
    expect(result.content[0].text).toBe('plain text');
  });

  test('returns empty string when both html and text are empty', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => ({ success: true });
    const mcp = createMcpServer({ editor });
    const result = mcp.callTool('get_rendered', {});
    expect(result.content[0].text).toBe('');
  });
});

describe('MCP write_rendered_to_file', () => {
  let tmpRoot;

  beforeAll(() => {
    tmpRoot = join(tmpdir(), `quikdown-mcp-render-write-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('writes rendered HTML to file', () => {
    const editor = createMockEditor('# Hello');
    editor.getRenderedContent = () => ({
      success: true,
      html: '<h1 style="font-size:2em">Hello</h1>'
    });
    const mcp = createMcpServer({ editor, root: tmpRoot });
    const result = mcp.callTool('write_rendered_to_file', { path: 'rendered.html' });
    const info = JSON.parse(result.content[0].text);
    expect(info.path).toBe('rendered.html');
    expect(info.bytes_written).toBeGreaterThan(0);
    const written = readFileSync(join(tmpRoot, 'rendered.html'), 'utf-8');
    expect(written).toBe('<h1 style="font-size:2em">Hello</h1>');
  });

  test('creates subdirectories', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => ({ success: true, html: '<p>nested</p>' });
    const mcp = createMcpServer({ editor, root: tmpRoot });
    mcp.callTool('write_rendered_to_file', { path: 'sub/dir/out.html' });
    expect(existsSync(join(tmpRoot, 'sub/dir/out.html'))).toBe(true);
  });

  test('throws without filesystem root', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => ({ success: true, html: '<p>x</p>' });
    const mcp = createMcpServer({ editor });
    expect(() => {
      mcp.callTool('write_rendered_to_file', { path: 'out.html' });
    }).toThrow('Filesystem root required');
  });

  test('throws without getRenderedContent', () => {
    const editor = createMockEditor('');
    const mcp = createMcpServer({ editor, root: tmpRoot });
    expect(() => {
      mcp.callTool('write_rendered_to_file', { path: 'out.html' });
    }).toThrow('does not support getRenderedContent');
  });

  test('throws when getRenderedContent returns failure', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => ({ success: false });
    const mcp = createMcpServer({ editor, root: tmpRoot });
    expect(() => {
      mcp.callTool('write_rendered_to_file', { path: 'fail.html' });
    }).toThrow('Failed to get rendered content');
  });

  test('throws when getRenderedContent returns a promise', () => {
    const editor = createMockEditor('');
    editor.getRenderedContent = () => Promise.resolve({ success: true, html: '<p>x</p>' });
    const mcp = createMcpServer({ editor, root: tmpRoot });
    expect(() => {
      mcp.callTool('write_rendered_to_file', { path: 'async.html' });
    }).toThrow('Async getRenderedContent');
  });

  test('passes output option through', () => {
    let capturedOptions;
    const editor = createMockEditor('');
    editor.getRenderedContent = (options) => {
      capturedOptions = options;
      return { success: true, html: '<p>quikdown</p>' };
    };
    const mcp = createMcpServer({ editor, root: tmpRoot });
    mcp.callTool('write_rendered_to_file', { path: 'qd.html', output: 'quikdown' });
    expect(capturedOptions.output).toBe('quikdown');
  });
});

describe('MCP integration — headless tools call quikdown/bd correctly', () => {
  let mcp;
  beforeAll(() => { mcp = createMcpServer(); });

  test('markdown_to_html handles complex markdown', () => {
    const md = '# Title\n\n- item 1\n- item 2\n\n**bold** and *italic*\n\n`code`';
    const result = mcp.callTool('markdown_to_html', { markdown: md });
    const html = result.content[0].text;
    expect(html).toContain('<h1');
    expect(html).toContain('<li');
    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('<code');
  });

  test('html_to_markdown roundtrip preserves structure', () => {
    const md = '# Heading\n\nA paragraph.';
    const htmlResult = mcp.callTool('markdown_to_html', { markdown: md });
    const html = htmlResult.content[0].text;
    const mdResult = mcp.callTool('html_to_markdown', { html });
    expect(mdResult.content[0].text).toContain('# Heading');
    expect(mdResult.content[0].text).toContain('A paragraph');
  });

  test('markdown_to_html with XSS attempt is escaped', () => {
    const result = mcp.callTool('markdown_to_html', {
      markdown: '<script>alert("xss")</script>'
    });
    expect(result.content[0].text).not.toContain('<script>');
  });

  test('markdown_to_html with tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = mcp.callTool('markdown_to_html', { markdown: md });
    expect(result.content[0].text).toContain('<table');
  });

  test('markdown_to_html with fenced code blocks', () => {
    const md = '```js\nconsole.log("hello");\n```';
    const result = mcp.callTool('markdown_to_html', { markdown: md });
    expect(result.content[0].text).toContain('<pre');
    expect(result.content[0].text).toContain('<code');
  });

  test('markdown_stats with complex document', () => {
    const md = '# Title\n\nParagraph one.\n\nParagraph two with **bold** and *italic*.';
    const result = mcp.callTool('markdown_stats', { markdown: md });
    const stats = JSON.parse(result.content[0].text);
    expect(stats.paragraphs).toBe(3);
    expect(stats.lines).toBe(5);
    expect(stats.words).toBeGreaterThan(5);
  });
});
