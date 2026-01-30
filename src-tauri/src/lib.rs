//! Tauri backend entrypoint and command wiring for Codex Desktop.

use std::sync::Once;

static INIT_TRACING: Once = Once::new();

fn init_tracing() {
    INIT_TRACING.call_once(|| {
        let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_target(false)
            .with_ansi(cfg!(debug_assertions))
            .init();
    });
}

/// Codex backend implementation and commands.
pub mod codex;
/// Development-only helpers for Codex ACP.
pub mod codex_dev;
/// Git integration helpers.
pub mod git;
/// MCP (Model Context Protocol) server management.
pub mod mcp;
/// Remote server connection module.
pub mod remote;
/// Local terminal PTY integration.
pub mod terminal;

/// Start the Tauri application and register Codex commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    // Remote server configuration storage path
    let remote_config_path = dirs::config_dir()
        .unwrap_or_default()
        .join("codex-desktop")
        .join("remote-servers.json");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(codex::commands::CodexManager::default())
        .manage(terminal::TerminalManager::default())
        .manage(remote::RemoteServerManager::new(remote_config_path))
        .invoke_handler(tauri::generate_handler![
            codex::commands::codex_init,
            codex::commands::codex_auth,
            codex::commands::codex_load_cli_config,
            codex::commands::codex_set_env,
            codex::commands::codex_new_session,
            codex::commands::codex_prompt,
            codex::commands::codex_cancel,
            codex::commands::codex_approve,
            codex::commands::codex_set_mode,
            codex::commands::codex_set_model,
            codex::commands::codex_set_config_option,
            codex::commands::codex_warmup,
            terminal::terminal_spawn,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            git::commands::git_status,
            git::commands::git_history,
            git::commands::git_checkout,
            git::commands::git_reset,
            remote::commands::remote_add_server,
            remote::commands::remote_remove_server,
            remote::commands::remote_list_servers,
            remote::commands::remote_test_connection,
            remote::commands::remote_list_directory,
            remote::commands::remote_list_entries,
            remote::commands::remote_git_history,
            codex::commands::list_local_directory,
            mcp::commands::mcp_list_servers,
            mcp::commands::mcp_add_server,
            mcp::commands::mcp_add_from_toml,
            mcp::commands::mcp_update_server,
            mcp::commands::mcp_delete_server,
            mcp::commands::mcp_toggle_server,
            mcp::commands::mcp_config_exists
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            tracing::error!(error = %err, "error while running tauri application");
        });
}
