//! MCP configuration service for reading/writing ~/.codex/config.toml.
//!
//! Uses toml_edit to preserve comments and formatting.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use toml_edit::{Array, DocumentMut, Item, Table, Value};

use super::types::{
    AddMcpServerRequest, HttpConfig, McpServer, McpServerBase, McpServerType, StdioConfig,
    UpdateMcpServerRequest,
};

/// Get the Codex config directory path.
pub fn get_codex_config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".codex")
}

/// Get the Codex config.toml path.
pub fn get_codex_config_path() -> PathBuf {
    get_codex_config_dir().join("config.toml")
}

/// Read the config.toml content as a string.
fn read_config_text() -> Result<String, String> {
    let path = get_codex_config_path();
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read config.toml: {}", e))
    } else {
        Ok(String::new())
    }
}

/// Write content to config.toml atomically (temp file + rename).
fn write_config_text(content: &str) -> Result<(), String> {
    let path = get_codex_config_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Write to temp file first
    let temp_path = path.with_extension("toml.tmp");
    let mut file =
        fs::File::create(&temp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync temp file: {}", e))?;

    // Atomic rename
    fs::rename(&temp_path, &path).map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

/// Parse the config.toml into a DocumentMut.
fn parse_config() -> Result<DocumentMut, String> {
    let text = read_config_text()?;
    if text.trim().is_empty() {
        Ok(DocumentMut::new())
    } else {
        text.parse::<DocumentMut>()
            .map_err(|e| format!("Failed to parse config.toml: {}", e))
    }
}

/// Convert a TOML table entry to McpServer.
fn table_to_mcp_server(id: &str, table: &toml_edit::Table) -> Option<McpServer> {
    let server_type = table
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("stdio");

    let enabled = table
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let startup_timeout_sec = table
        .get("startup_timeout_sec")
        .and_then(|v| v.as_integer())
        .map(|v| v as u32);

    let tool_timeout_sec = table
        .get("tool_timeout_sec")
        .and_then(|v| v.as_integer())
        .map(|v| v as u32);

    let enabled_tools = table.get("enabled_tools").and_then(|v| {
        v.as_array().map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(String::from))
                .collect()
        })
    });

    let disabled_tools = table.get("disabled_tools").and_then(|v| {
        v.as_array().map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(String::from))
                .collect()
        })
    });

    let base = McpServerBase {
        id: id.to_string(),
        server_type: match server_type {
            "http" => McpServerType::Http,
            "sse" => McpServerType::Sse,
            _ => McpServerType::Stdio,
        },
        enabled,
        startup_timeout_sec,
        tool_timeout_sec,
        enabled_tools,
        disabled_tools,
    };

    match server_type {
        "stdio" | "" => {
            let command = table
                .get("command")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let args = table.get("args").and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|item| item.as_str().map(String::from))
                        .collect()
                })
            });

            let env = table.get("env").and_then(|v| {
                v.as_table().map(|t| {
                    t.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.to_string(), s.to_string())))
                        .collect()
                })
            });

            let env_vars = table.get("env_vars").and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|item| item.as_str().map(String::from))
                        .collect()
                })
            });

            let cwd = table.get("cwd").and_then(|v| v.as_str()).map(String::from);

            Some(McpServer::Stdio {
                base,
                config: StdioConfig {
                    command,
                    args,
                    env,
                    env_vars,
                    cwd,
                },
            })
        }
        "http" | "sse" => {
            let url = table
                .get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let bearer_token_env_var = table
                .get("bearer_token_env_var")
                .and_then(|v| v.as_str())
                .map(String::from);

            let http_headers = table.get("http_headers").and_then(|v| {
                v.as_table().map(|t| {
                    t.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.to_string(), s.to_string())))
                        .collect()
                })
            });

            let env_http_headers = table.get("env_http_headers").and_then(|v| {
                v.as_table().map(|t| {
                    t.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.to_string(), s.to_string())))
                        .collect()
                })
            });

            let config = HttpConfig {
                url,
                bearer_token_env_var,
                http_headers,
                env_http_headers,
            };

            if server_type == "sse" {
                Some(McpServer::Sse { base, config })
            } else {
                Some(McpServer::Http { base, config })
            }
        }
        _ => {
            tracing::warn!("Unknown MCP server type: {}", server_type);
            None
        }
    }
}

/// Convert McpServer to a toml_edit Table.
fn mcp_server_to_table(server: &McpServer) -> Table {
    let mut table = Table::new();

    match server {
        McpServer::Stdio { base, config } => {
            table["type"] = toml_edit::value("stdio");
            table["command"] = toml_edit::value(&config.command);

            if let Some(args) = &config.args {
                if !args.is_empty() {
                    let mut arr = Array::new();
                    for arg in args {
                        arr.push(arg.as_str());
                    }
                    table["args"] = Item::Value(Value::Array(arr));
                }
            }

            if let Some(env) = &config.env {
                if !env.is_empty() {
                    let mut env_table = Table::new();
                    for (k, v) in env {
                        env_table[k] = toml_edit::value(v);
                    }
                    table["env"] = Item::Table(env_table);
                }
            }

            if let Some(cwd) = &config.cwd {
                if !cwd.is_empty() {
                    table["cwd"] = toml_edit::value(cwd);
                }
            }

            if !base.enabled {
                table["enabled"] = toml_edit::value(false);
            }

            add_base_fields_to_table(&mut table, base);
        }
        McpServer::Http { base, config } | McpServer::Sse { base, config } => {
            let type_str = if matches!(server, McpServer::Sse { .. }) {
                "sse"
            } else {
                "http"
            };
            table["type"] = toml_edit::value(type_str);
            table["url"] = toml_edit::value(&config.url);

            if let Some(token_var) = &config.bearer_token_env_var {
                if !token_var.is_empty() {
                    table["bearer_token_env_var"] = toml_edit::value(token_var);
                }
            }

            if let Some(headers) = &config.http_headers {
                if !headers.is_empty() {
                    let mut headers_table = Table::new();
                    for (k, v) in headers {
                        headers_table[k] = toml_edit::value(v);
                    }
                    table["http_headers"] = Item::Table(headers_table);
                }
            }

            if !base.enabled {
                table["enabled"] = toml_edit::value(false);
            }

            add_base_fields_to_table(&mut table, base);
        }
    }

    table
}

/// Add optional base fields to table.
fn add_base_fields_to_table(table: &mut Table, base: &McpServerBase) {
    if let Some(timeout) = base.startup_timeout_sec {
        table["startup_timeout_sec"] = toml_edit::value(timeout as i64);
    }

    if let Some(timeout) = base.tool_timeout_sec {
        table["tool_timeout_sec"] = toml_edit::value(timeout as i64);
    }

    if let Some(tools) = &base.enabled_tools {
        if !tools.is_empty() {
            let mut arr = Array::new();
            for tool in tools {
                arr.push(tool.as_str());
            }
            table["enabled_tools"] = Item::Value(Value::Array(arr));
        }
    }

    if let Some(tools) = &base.disabled_tools {
        if !tools.is_empty() {
            let mut arr = Array::new();
            for tool in tools {
                arr.push(tool.as_str());
            }
            table["disabled_tools"] = Item::Value(Value::Array(arr));
        }
    }
}

/// List all MCP servers from config.toml.
pub fn list_servers() -> Result<Vec<McpServer>, String> {
    let doc = parse_config()?;
    let mut servers = Vec::new();

    if let Some(mcp_servers) = doc.get("mcp_servers").and_then(|v| v.as_table()) {
        for (id, entry) in mcp_servers.iter() {
            if let Some(table) = entry.as_table() {
                if let Some(server) = table_to_mcp_server(id, table) {
                    servers.push(server);
                }
            }
        }
    }

    // Sort by ID for consistent ordering
    servers.sort_by(|a, b| a.id().cmp(b.id()));

    Ok(servers)
}

/// Add a new MCP server.
pub fn add_server(request: AddMcpServerRequest) -> Result<McpServer, String> {
    let mut doc = parse_config()?;

    // Ensure mcp_servers table exists
    if !doc.contains_key("mcp_servers") {
        doc["mcp_servers"] = toml_edit::table();
    }

    let id = request.id();

    // Check if server already exists
    if let Some(mcp_servers) = doc.get("mcp_servers").and_then(|v| v.as_table()) {
        if mcp_servers.contains_key(id) {
            return Err(format!("MCP server '{}' already exists", id));
        }
    }

    // Create server from request
    let server = match request {
        AddMcpServerRequest::Stdio {
            id,
            command,
            args,
            env,
            cwd,
            enabled,
        } => McpServer::Stdio {
            base: McpServerBase {
                id,
                server_type: McpServerType::Stdio,
                enabled,
                ..Default::default()
            },
            config: StdioConfig {
                command,
                args,
                env,
                env_vars: None,
                cwd,
            },
        },
        AddMcpServerRequest::Http {
            id,
            url,
            bearer_token_env_var,
            http_headers,
            enabled,
        } => McpServer::Http {
            base: McpServerBase {
                id,
                server_type: McpServerType::Http,
                enabled,
                ..Default::default()
            },
            config: HttpConfig {
                url,
                bearer_token_env_var,
                http_headers,
                env_http_headers: None,
            },
        },
        AddMcpServerRequest::Sse {
            id,
            url,
            bearer_token_env_var,
            http_headers,
            enabled,
        } => McpServer::Sse {
            base: McpServerBase {
                id,
                server_type: McpServerType::Sse,
                enabled,
                ..Default::default()
            },
            config: HttpConfig {
                url,
                bearer_token_env_var,
                http_headers,
                env_http_headers: None,
            },
        },
    };

    let table = mcp_server_to_table(&server);
    doc["mcp_servers"][server.id()] = Item::Table(table);

    write_config_text(&doc.to_string())?;

    Ok(server)
}

/// Update an existing MCP server.
pub fn update_server(request: UpdateMcpServerRequest) -> Result<McpServer, String> {
    let mut doc = parse_config()?;

    let mcp_servers = doc
        .get_mut("mcp_servers")
        .and_then(|v| v.as_table_mut())
        .ok_or_else(|| format!("MCP server '{}' not found", request.id))?;

    let entry = mcp_servers
        .get_mut(&request.id)
        .and_then(|v| v.as_table_mut())
        .ok_or_else(|| format!("MCP server '{}' not found", request.id))?;

    // Update fields if provided
    if let Some(command) = &request.command {
        entry["command"] = toml_edit::value(command);
    }

    if let Some(args) = &request.args {
        let mut arr = Array::new();
        for arg in args {
            arr.push(arg.as_str());
        }
        entry["args"] = Item::Value(Value::Array(arr));
    }

    if let Some(env) = &request.env {
        let mut env_table = Table::new();
        for (k, v) in env {
            env_table[k] = toml_edit::value(v);
        }
        entry["env"] = Item::Table(env_table);
    }

    if let Some(cwd) = &request.cwd {
        entry["cwd"] = toml_edit::value(cwd);
    }

    if let Some(url) = &request.url {
        entry["url"] = toml_edit::value(url);
    }

    if let Some(token_var) = &request.bearer_token_env_var {
        entry["bearer_token_env_var"] = toml_edit::value(token_var);
    }

    if let Some(headers) = &request.http_headers {
        let mut headers_table = Table::new();
        for (k, v) in headers {
            headers_table[k] = toml_edit::value(v);
        }
        entry["http_headers"] = Item::Table(headers_table);
    }

    if let Some(enabled) = request.enabled {
        entry["enabled"] = toml_edit::value(enabled);
    }

    if let Some(timeout) = request.startup_timeout_sec {
        entry["startup_timeout_sec"] = toml_edit::value(timeout as i64);
    }

    if let Some(timeout) = request.tool_timeout_sec {
        entry["tool_timeout_sec"] = toml_edit::value(timeout as i64);
    }

    write_config_text(&doc.to_string())?;

    // Re-read to return updated server
    let servers = list_servers()?;
    servers
        .into_iter()
        .find(|s| s.id() == request.id)
        .ok_or_else(|| format!("Failed to find updated server '{}'", request.id))
}

/// Delete an MCP server.
pub fn delete_server(id: &str) -> Result<(), String> {
    let mut doc = parse_config()?;

    let mcp_servers = doc
        .get_mut("mcp_servers")
        .and_then(|v| v.as_table_mut())
        .ok_or_else(|| format!("MCP server '{}' not found", id))?;

    if !mcp_servers.contains_key(id) {
        return Err(format!("MCP server '{}' not found", id));
    }

    mcp_servers.remove(id);

    write_config_text(&doc.to_string())?;

    Ok(())
}

/// Toggle a server's enabled status.
pub fn toggle_server(id: &str, enabled: bool) -> Result<McpServer, String> {
    update_server(UpdateMcpServerRequest {
        id: id.to_string(),
        enabled: Some(enabled),
        command: None,
        args: None,
        env: None,
        cwd: None,
        url: None,
        bearer_token_env_var: None,
        http_headers: None,
        startup_timeout_sec: None,
        tool_timeout_sec: None,
    })
}

/// Check if Codex config directory exists.
pub fn codex_config_exists() -> bool {
    get_codex_config_dir().exists()
}

/// Add MCP server(s) from raw TOML text.
///
/// Accepts multiple formats:
/// 1. Full format: `[mcp_servers.name]\ncommand = "npx"\n...`
/// 2. Multiple servers: `[mcp_servers.a]\n...\n[mcp_servers.b]\n...`
/// 3. Table only (requires server name extraction): `command = "npx"\nargs = [...]`
pub fn add_servers_from_toml(toml_text: &str) -> Result<Vec<McpServer>, String> {
    let trimmed = toml_text.trim();
    if trimmed.is_empty() {
        return Err("TOML text is empty".to_string());
    }

    // Try to parse as a document
    let input_doc: DocumentMut = trimmed
        .parse()
        .map_err(|e| format!("Invalid TOML syntax: {}", e))?;

    let mut doc = parse_config()?;

    // Ensure mcp_servers table exists
    if !doc.contains_key("mcp_servers") {
        doc["mcp_servers"] = toml_edit::table();
    }

    let mut added_ids = Vec::new();

    // Check if input has [mcp_servers.xxx] format
    if let Some(mcp_servers_item) = input_doc.get("mcp_servers") {
        if let Some(mcp_servers_table) = mcp_servers_item.as_table() {
            for (id, entry) in mcp_servers_table.iter() {
                if let Some(server_table) = entry.as_table() {
                    // Check if server already exists
                    if let Some(existing) = doc
                        .get("mcp_servers")
                        .and_then(|v| v.as_table())
                        .and_then(|t| t.get(id))
                    {
                        if existing.as_table().is_some() {
                            return Err(format!("MCP server '{}' already exists", id));
                        }
                    }

                    // Clone the table to the config
                    doc["mcp_servers"][id] = Item::Table(server_table.clone());
                    added_ids.push(id.to_string());
                }
            }
        }
    } else {
        // Try single server format: the entire input is a server config
        // User needs to provide [mcp_servers.name] header
        // Or we try to detect if it's a bare table

        // Check if it looks like a bare server config (has command or url)
        let has_command = input_doc.get("command").is_some();
        let has_url = input_doc.get("url").is_some();

        if has_command || has_url {
            return Err(
                "Please include the server header, e.g.:\n[mcp_servers.my_server]\ncommand = \"npx\"\n..."
                    .to_string(),
            );
        }

        // Check for [name] format (without mcp_servers prefix)
        // e.g., [context7]\ncommand = "npx"
        for (key, value) in input_doc.iter() {
            if let Some(table) = value.as_table() {
                // This looks like [name] format
                let id = key;

                // Check if server already exists
                if let Some(existing) = doc
                    .get("mcp_servers")
                    .and_then(|v| v.as_table())
                    .and_then(|t| t.get(id))
                {
                    if existing.as_table().is_some() {
                        return Err(format!("MCP server '{}' already exists", id));
                    }
                }

                doc["mcp_servers"][id] = Item::Table(table.clone());
                added_ids.push(id.to_string());
            }
        }
    }

    if added_ids.is_empty() {
        return Err(
            "No valid MCP server configuration found. Expected format:\n[mcp_servers.name]\ncommand = \"npx\"\nargs = [\"-y\", \"@package/name\"]"
                .to_string(),
        );
    }

    write_config_text(&doc.to_string())?;

    // Return the added servers
    let all_servers = list_servers()?;
    let added_servers: Vec<McpServer> = all_servers
        .into_iter()
        .filter(|s| added_ids.contains(&s.id().to_string()))
        .collect();

    Ok(added_servers)
}
