/**
 * MCP server management API.
 * Thin, typed wrappers around Tauri invoke() commands.
 */

import { invoke } from '@tauri-apps/api/core';

import type { McpServer, AddMcpServerRequest, UpdateMcpServerRequest } from '../types/mcp';

/**
 * List all MCP servers from config.toml.
 */
export async function listMcpServers(): Promise<McpServer[]> {
  return invoke<McpServer[]>('mcp_list_servers');
}

/**
 * Add a new MCP server.
 */
export async function addMcpServer(request: AddMcpServerRequest): Promise<McpServer> {
  return invoke<McpServer>('mcp_add_server', { request });
}

/**
 * Add MCP server(s) from raw TOML text.
 * Accepts TOML in format: [mcp_servers.name] or [name]
 */
export async function addMcpServerFromToml(tomlText: string): Promise<McpServer[]> {
  return invoke<McpServer[]>('mcp_add_from_toml', { tomlText });
}

/**
 * Update an existing MCP server.
 */
export async function updateMcpServer(request: UpdateMcpServerRequest): Promise<McpServer> {
  return invoke<McpServer>('mcp_update_server', { request });
}

/**
 * Delete an MCP server.
 */
export async function deleteMcpServer(id: string): Promise<void> {
  await invoke('mcp_delete_server', { id });
}

/**
 * Toggle a server's enabled status.
 */
export async function toggleMcpServer(id: string, enabled: boolean): Promise<McpServer> {
  return invoke<McpServer>('mcp_toggle_server', { id, enabled });
}

/**
 * Check if Codex config directory exists.
 */
export async function mcpConfigExists(): Promise<boolean> {
  return invoke<boolean>('mcp_config_exists');
}
