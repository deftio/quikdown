#!/usr/bin/env node
/**
 * quikdown MCP doc-host — Path B
 * ═══════════════════════════════
 *
 * This is the MCP entry point for Cursor (or any MCP host).
 * It does three things:
 *   1. Starts a local HTTP + WebSocket server
 *   2. Opens a browser tab with QuikdownEditor
 *   3. Listens on stdio for JSON-RPC (MCP) and bridges editor tool calls
 *      to the browser over WebSocket
 *
 * Usage (Cursor .cursor/mcp.json):
 *   { "mcpServers": { "quikdown-doc": { "command": "node", "args": ["examples/mcp-doc-host/start-mcp.js"] } } }
 *
 * The human works in the browser tab. The agent drives the editor through MCP.
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createMcpServer } from '../../dist/quikdown_mcp.esm.js';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.QUIKDOWN_PORT || '7744', 10);
const ROOT = process.env.QUIKDOWN_ROOT || process.cwd();

// ── MIME types ───────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ── WebSocket bridge ─────────────────────────────────────────────────

let wsClient = null;
let pendingCalls = new Map(); // id → { resolve, reject }
let callId = 0;

/**
 * Send a tool call to the browser editor and wait for the response.
 * Returns synchronously by design — MCP tool calls are sync.
 * We use a blocking pattern: the MCP listenStdio() is line-based,
 * so we switch to an async handleMessage approach.
 */
function callEditorInBrowser(method, args) {
  if (!wsClient || wsClient.readyState !== 1) {
    throw new Error('Editor not connected. Open the browser tab first.');
  }
  const id = ++callId;
  const msg = JSON.stringify({ id, method, args });
  wsClient.send(msg);

  // Return a thenable so the MCP server can detect async
  // We'll handle this with the async MCP bridge below
  return new Promise((resolve, reject) => {
    pendingCalls.set(id, { resolve, reject });
    // Timeout after 30s
    setTimeout(() => {
      if (pendingCalls.has(id)) {
        pendingCalls.delete(id);
        reject(new Error(`Editor call timed out: ${method}`));
      }
    }, 30000);
  });
}

// ── Proxy editor binding ─────────────────────────────────────────────
// This is NOT a synchronous binding — it returns Promises.
// We use an async-aware MCP wrapper below.

const proxyEditor = {
  getMarkdown: () => callEditorInBrowser('getMarkdown', {}),
  setMarkdown: (md) => callEditorInBrowser('setMarkdown', { md }),
  getHTML: () => callEditorInBrowser('getHTML', {}),
  canUndo: () => callEditorInBrowser('canUndo', {}),
  canRedo: () => callEditorInBrowser('canRedo', {}),
  undo: () => callEditorInBrowser('undo', {}),
  redo: () => callEditorInBrowser('redo', {}),
  getRenderedContent: (options) => callEditorInBrowser('getRenderedContent', options || {}),
};

// ── Async MCP bridge ─────────────────────────────────────────────────
// The built-in createMcpServer expects a synchronous editor binding.
// For Path B, we use it for headless + filesystem (sync) and handle
// editor tools ourselves via the async WebSocket bridge.

const mcpHeadlessFs = createMcpServer({ root: ROOT });

// Editor tool names
const EDITOR_TOOLS_NAMES = new Set([
  'read_editor', 'write_editor', 'find_regex', 'replace_regex',
  'replace_text', 'extract_text', 'get_stats', 'get_html',
  'undo', 'redo', 'load_file_to_editor', 'get_rendered', 'write_rendered_to_file'
]);

async function handleMcpMessage(message) {
  const { id, method, params } = message;

  // For tools/call on editor tools, bridge async to browser
  if (method === 'tools/call' && params && EDITOR_TOOLS_NAMES.has(params.name)) {
    try {
      const result = await callEditorInBrowser('mcpTool', {
        name: params.name,
        arguments: params.arguments || {}
      });
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      return {
        jsonrpc: '2.0', id,
        result: { isError: true, content: [{ type: 'text', text: err.message }] }
      };
    }
  }

  // For tools/list, merge headless+fs tools with editor tools
  if (method === 'tools/list') {
    const base = mcpHeadlessFs.handleMessage(message);
    // Add editor tools to the list
    const editorToolDefs = await callEditorInBrowser('getToolDefs', {}).catch(() => []);
    if (Array.isArray(editorToolDefs) && editorToolDefs.length > 0) {
      base.result.tools = [...base.result.tools, ...editorToolDefs];
    }
    return base;
  }

  // Everything else (initialize, ping, resources, headless+fs tools) — sync
  return mcpHeadlessFs.handleMessage(message);
}

// ── HTTP server ──────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/editor-host.html';

  // Serve from this directory
  let filePath = resolve(__dirname, '.' + urlPath);

  // Allow serving dist/ and src/ from project root for imports
  if (urlPath.startsWith('/dist/') || urlPath.startsWith('/src/')) {
    filePath = resolve(__dirname, '../..', '.' + urlPath);
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
});

// ── WebSocket server ─────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  wsClient = ws;
  process.stderr.write('[mcp-doc-host] Editor connected via WebSocket\n');

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // Response to a pending call
    if (msg.id && pendingCalls.has(msg.id)) {
      const { resolve, reject } = pendingCalls.get(msg.id);
      pendingCalls.delete(msg.id);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.result);
    }
  });

  ws.on('close', () => {
    if (wsClient === ws) wsClient = null;
    process.stderr.write('[mcp-doc-host] Editor disconnected\n');
  });
});

// ── Start server and open browser ────────────────────────────────────

httpServer.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  process.stderr.write(`[mcp-doc-host] Server running at ${url}\n`);
  process.stderr.write(`[mcp-doc-host] Filesystem root: ${ROOT}\n`);

  // Auto-open browser
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} ${url}`, (err) => {
    if (err) {
      process.stderr.write(`[mcp-doc-host] Could not auto-open browser. Open manually: ${url}\n`);
    }
  });
});

// ── stdio MCP listener (async) ───────────────────────────────────────

import { createInterface } from 'readline';

const rl = createInterface({ input: process.stdin, terminal: false });
let buffer = '';

rl.on('line', async (line) => {
  buffer += line;
  let msg;
  try {
    msg = JSON.parse(buffer);
    buffer = '';
  } catch {
    return; // incomplete JSON
  }

  const response = await handleMcpMessage(msg);
  if (response) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
});

rl.on('close', () => {
  httpServer.close();
  process.exit(0);
});
