/**
 * MCP (Model Context Protocol) server type definitions.
 * Based on Codex CLI's official MCP configuration format.
 */

/** MCP server transport type */
export type McpServerType = 'stdio' | 'http' | 'sse';

/** Base configuration shared by all MCP server types */
export interface McpServerBase {
  /** Server identifier (TOML table name) */
  id: string;
  /** Transport type */
  server_type: McpServerType;
  /** Whether the server is enabled */
  enabled: boolean;
  /** Startup timeout in seconds */
  startup_timeout_sec?: number;
  /** Tool execution timeout in seconds */
  tool_timeout_sec?: number;
  /** Allow list of tools */
  enabled_tools?: string[];
  /** Deny list of tools (applied after enabled_tools) */
  disabled_tools?: string[];
}

/** STDIO transport configuration */
export interface StdioConfig {
  /** Command to start the server */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Environment variables to allow and forward */
  env_vars?: string[];
  /** Working directory */
  cwd?: string;
}

/** HTTP/SSE transport configuration */
export interface HttpConfig {
  /** Server URL */
  url: string;
  /** Environment variable name for bearer token */
  bearer_token_env_var?: string;
  /** Static HTTP headers */
  http_headers?: Record<string, string>;
  /** Header names mapped to environment variable names */
  env_http_headers?: Record<string, string>;
}

/** STDIO MCP server */
export interface StdioMcpServer {
  type: 'Stdio';
  base: McpServerBase;
  config: StdioConfig;
}

/** HTTP MCP server */
export interface HttpMcpServer {
  type: 'Http';
  base: McpServerBase;
  config: HttpConfig;
}

/** SSE MCP server */
export interface SseMcpServer {
  type: 'Sse';
  base: McpServerBase;
  config: HttpConfig;
}

/** Complete MCP server configuration (discriminated union) */
export type McpServer = StdioMcpServer | HttpMcpServer | SseMcpServer;

/** Request payload for adding a new STDIO MCP server */
export interface AddStdioMcpServerRequest {
  type: 'stdio';
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  enabled?: boolean;
}

/** Request payload for adding a new HTTP MCP server */
export interface AddHttpMcpServerRequest {
  type: 'http';
  id: string;
  url: string;
  bearer_token_env_var?: string;
  http_headers?: Record<string, string>;
  enabled?: boolean;
}

/** Request payload for adding a new SSE MCP server */
export interface AddSseMcpServerRequest {
  type: 'sse';
  id: string;
  url: string;
  bearer_token_env_var?: string;
  http_headers?: Record<string, string>;
  enabled?: boolean;
}

/** Request payload for adding a new MCP server */
export type AddMcpServerRequest =
  | AddStdioMcpServerRequest
  | AddHttpMcpServerRequest
  | AddSseMcpServerRequest;

/** Request payload for updating an MCP server */
export interface UpdateMcpServerRequest {
  id: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  bearer_token_env_var?: string;
  http_headers?: Record<string, string>;
  enabled?: boolean;
  startup_timeout_sec?: number;
  tool_timeout_sec?: number;
}

// Helper functions

/** Get server display name (command or url) */
export function getServerDisplayInfo(server: McpServer): string {
  switch (server.type) {
    case 'Stdio':
      return server.config.command;
    case 'Http':
    case 'Sse':
      return server.config.url;
  }
}
