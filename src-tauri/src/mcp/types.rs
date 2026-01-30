//! MCP server type definitions.
//!
//! Based on Codex CLI's official MCP configuration format.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MCP server transport type.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum McpServerType {
    #[default]
    Stdio,
    Http,
    Sse,
}

/// Base configuration shared by all MCP server types.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpServerBase {
    /// Server identifier (TOML table name).
    pub id: String,
    /// Transport type.
    #[serde(rename = "type", default)]
    pub server_type: McpServerType,
    /// Whether the server is enabled.
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Startup timeout in seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub startup_timeout_sec: Option<u32>,
    /// Tool execution timeout in seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_timeout_sec: Option<u32>,
    /// Allow list of tools.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled_tools: Option<Vec<String>>,
    /// Deny list of tools (applied after enabled_tools).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled_tools: Option<Vec<String>>,
}

fn default_true() -> bool {
    true
}

/// STDIO transport configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StdioConfig {
    /// Command to start the server.
    pub command: String,
    /// Arguments to pass to the command.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    /// Environment variables.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    /// Environment variables to allow and forward.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_vars: Option<Vec<String>>,
    /// Working directory.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

/// HTTP/SSE transport configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HttpConfig {
    /// Server URL.
    pub url: String,
    /// Environment variable name for bearer token.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bearer_token_env_var: Option<String>,
    /// Static HTTP headers.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_headers: Option<HashMap<String, String>>,
    /// Header names mapped to environment variable names.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_http_headers: Option<HashMap<String, String>>,
}

/// Complete MCP server configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpServer {
    Stdio {
        #[serde(flatten)]
        base: McpServerBase,
        #[serde(flatten)]
        config: StdioConfig,
    },
    Http {
        #[serde(flatten)]
        base: McpServerBase,
        #[serde(flatten)]
        config: HttpConfig,
    },
    Sse {
        #[serde(flatten)]
        base: McpServerBase,
        #[serde(flatten)]
        config: HttpConfig,
    },
}

impl McpServer {
    /// Get the server ID.
    pub fn id(&self) -> &str {
        match self {
            McpServer::Stdio { base, .. } => &base.id,
            McpServer::Http { base, .. } => &base.id,
            McpServer::Sse { base, .. } => &base.id,
        }
    }
}

/// Request payload for adding a new MCP server.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AddMcpServerRequest {
    Stdio {
        id: String,
        command: String,
        #[serde(default)]
        args: Option<Vec<String>>,
        #[serde(default)]
        env: Option<HashMap<String, String>>,
        #[serde(default)]
        cwd: Option<String>,
        #[serde(default = "default_true")]
        enabled: bool,
    },
    Http {
        id: String,
        url: String,
        #[serde(default)]
        bearer_token_env_var: Option<String>,
        #[serde(default)]
        http_headers: Option<HashMap<String, String>>,
        #[serde(default = "default_true")]
        enabled: bool,
    },
    Sse {
        id: String,
        url: String,
        #[serde(default)]
        bearer_token_env_var: Option<String>,
        #[serde(default)]
        http_headers: Option<HashMap<String, String>>,
        #[serde(default = "default_true")]
        enabled: bool,
    },
}

impl AddMcpServerRequest {
    /// Get the server ID from the request.
    pub fn id(&self) -> &str {
        match self {
            AddMcpServerRequest::Stdio { id, .. } => id,
            AddMcpServerRequest::Http { id, .. } => id,
            AddMcpServerRequest::Sse { id, .. } => id,
        }
    }
}

/// Request payload for updating an MCP server.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateMcpServerRequest {
    pub id: String,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub env: Option<HashMap<String, String>>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub bearer_token_env_var: Option<String>,
    #[serde(default)]
    pub http_headers: Option<HashMap<String, String>>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub startup_timeout_sec: Option<u32>,
    #[serde(default)]
    pub tool_timeout_sec: Option<u32>,
}
