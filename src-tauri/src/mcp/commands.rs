//! Tauri commands for MCP server management.

use super::service;
use super::types::{AddMcpServerRequest, McpServer, UpdateMcpServerRequest};

/// List all MCP servers from config.toml.
#[tauri::command]
pub fn mcp_list_servers() -> Result<Vec<McpServer>, String> {
    service::list_servers()
}

/// Add a new MCP server.
#[tauri::command]
pub fn mcp_add_server(request: AddMcpServerRequest) -> Result<McpServer, String> {
    service::add_server(request)
}

/// Add MCP server(s) from raw TOML text.
/// Accepts TOML in format: [mcp_servers.name] or just the table content.
#[tauri::command]
pub fn mcp_add_from_toml(toml_text: String) -> Result<Vec<McpServer>, String> {
    service::add_servers_from_toml(&toml_text)
}

/// Update an existing MCP server.
#[tauri::command]
pub fn mcp_update_server(request: UpdateMcpServerRequest) -> Result<McpServer, String> {
    service::update_server(request)
}

/// Delete an MCP server.
#[tauri::command]
pub fn mcp_delete_server(id: String) -> Result<(), String> {
    service::delete_server(&id)
}

/// Toggle a server's enabled status.
#[tauri::command]
pub fn mcp_toggle_server(id: String, enabled: bool) -> Result<McpServer, String> {
    service::toggle_server(&id, enabled)
}

/// Check if Codex config directory exists.
#[tauri::command]
pub fn mcp_config_exists() -> bool {
    service::codex_config_exists()
}
