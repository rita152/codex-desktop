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

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Codex backend implementation and commands.
pub mod codex;
/// Development-only helpers for Codex ACP.
pub mod codex_dev;

#[tauri::command]
async fn codex_dev_prompt_once(
    window: tauri::Window,
    cwd: String,
    content: String,
) -> Result<(), String> {
    let cwd = std::path::PathBuf::from(cwd);
    codex_dev::run::prompt_once(window, cwd, content)
        .await
        .map_err(|e| e.to_string())
}

/// Start the Tauri application and register Codex commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(codex::commands::CodexManager::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            codex_dev_prompt_once,
            codex::commands::codex_init,
            codex::commands::codex_auth,
            codex::commands::codex_new_session,
            codex::commands::codex_prompt,
            codex::commands::codex_cancel,
            codex::commands::codex_approve,
            codex::commands::codex_set_mode,
            codex::commands::codex_set_model,
            codex::commands::codex_set_config_option
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            tracing::error!(error = %err, "error while running tauri application");
        });
}
