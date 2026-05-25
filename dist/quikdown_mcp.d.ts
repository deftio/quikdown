/**
 * quikdown_mcp — MCP (Model Context Protocol) server for quikdown.
 *
 * One server, three tool groups:
 *   1. Headless  — always: parse, BD, stats on strings
 *   2. Filesystem — Node only: read/write markdown/HTML by path
 *   3. Editor    — when host passes { editor }: full buffer + preview
 */

/** MCP tool definition returned by getTools(). */
export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

/** MCP tool result (content array). */
export interface McpToolResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

/** JSON-RPC 2.0 request message. */
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response message. */
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: { code: number; message: string };
}

/** Result from getRenderedContent (rich HTML export). */
export interface RenderedContentResult {
    success: boolean;
    html?: string;
    text?: string;
}

/** Minimal editor interface expected by the MCP server. */
export interface McpEditorBinding {
    getMarkdown(): string;
    setMarkdown(md: string): void;
    getHTML(): string;
    canUndo?(): boolean;
    canRedo?(): boolean;
    undo?(): void;
    redo?(): void;
    /** Rich rendered content export (requires Path B host with preview DOM). */
    getRenderedContent?(options?: { output?: 'default' | 'stripped' | 'quikdown' }): RenderedContentResult;
}

/** Options for createMcpServer(). */
export interface McpServerOptions {
    /** QuikdownEditor instance (enables editor tools). */
    editor?: McpEditorBinding;
    /** Filesystem sandbox root (enables filesystem tools). */
    root?: string;
}

/** MCP server instance. */
export interface McpServer {
    /** Process a single JSON-RPC message and return the response (or null for notifications). */
    handleMessage(message: JsonRpcRequest): JsonRpcResponse | null;
    /** Listen on stdin for JSON-RPC messages and write responses to stdout. */
    listenStdio(): void;
    /** Get the list of currently available tools. */
    getTools(): McpTool[];
    /** Call a tool by name with arguments. */
    callTool(name: string, args: Record<string, unknown>): McpToolResult;
}

/**
 * Create a quikdown MCP server.
 *
 * @param options - Server configuration.
 * @returns MCP server instance with handleMessage, listenStdio, getTools, callTool.
 */
export declare function createMcpServer(options?: McpServerOptions): McpServer;

export default createMcpServer;
