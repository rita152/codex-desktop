//! Tauri command handlers for Codex interactions.

use crate::codex::service::CodexService;
use crate::codex::types::{
    ApprovalDecision, CodexCliConfigInfo, InitializeResult, NewSessionResult, PromptResult,
};
use crate::codex_dev::config::load_codex_cli_config;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, State};

#[derive(Default)]
/// Tauri state wrapper for the Codex service.
pub struct CodexManager {
    service: OnceLock<CodexService>,
}

impl CodexManager {
    fn get_or_create(&self, app: AppHandle) -> CodexService {
        self.service.get_or_init(|| CodexService::new(app)).clone()
    }

    fn get(&self) -> Option<CodexService> {
        self.service.get().cloned()
    }
}

/// Initialize the Codex backend and return agent metadata.
#[tauri::command]
pub async fn codex_init(
    app: AppHandle,
    state: State<'_, CodexManager>,
) -> Result<InitializeResult, String> {
    let svc = state.get_or_create(app);
    svc.initialize().await.map_err(|e| e.to_string())
}

/// Authenticate with the selected provider and optional API key.
#[tauri::command]
pub async fn codex_auth(
    state: State<'_, CodexManager>,
    method: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.authenticate(method, api_key)
        .await
        .map_err(|e| e.to_string())
}

/// Load the local Codex CLI configuration summary.
#[tauri::command]
pub async fn codex_load_cli_config(app: AppHandle) -> Result<CodexCliConfigInfo, String> {
    let codex_home = crate::codex::binary::CodexAcpBinary::default_codex_home(Some(&app))
        .map_err(|e| e.to_string())?;
    let config_path = codex_home.join("config.toml");
    let auth_path = codex_home.join("auth.json");
    let config_found = config_path.is_file();
    let auth_file_found = auth_path.is_file();
    let config = if config_found {
        Some(load_codex_cli_config(&codex_home).map_err(|e| e.to_string())?)
    } else {
        None
    };

    Ok(CodexCliConfigInfo {
        codex_home: codex_home.display().to_string(),
        config_path: config_path.display().to_string(),
        config_found,
        model_provider: config.as_ref().and_then(|cfg| cfg.model_provider.clone()),
        base_url: config.as_ref().and_then(|cfg| cfg.base_url.clone()),
        env_key: config.as_ref().and_then(|cfg| cfg.env_key.clone()),
        auth_file_found,
    })
}

/// Override an environment variable for codex-acp.
#[tauri::command]
pub async fn codex_set_env(
    state: State<'_, CodexManager>,
    key: String,
    value: String,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.set_env(key, value).await.map_err(|e| e.to_string())
}

/// Create a new ACP session rooted at the provided working directory.
#[tauri::command]
pub async fn codex_new_session(
    state: State<'_, CodexManager>,
    cwd: String,
) -> Result<NewSessionResult, String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.create_session(PathBuf::from(cwd))
        .await
        .map_err(|e| e.to_string())
}

/// Send a prompt to the ACP session.
#[tauri::command]
pub async fn codex_prompt(
    state: State<'_, CodexManager>,
    session_id: String,
    content: String,
) -> Result<PromptResult, String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.send_prompt(session_id, content)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel an in-flight prompt for the session.
#[tauri::command]
pub async fn codex_cancel(
    state: State<'_, CodexManager>,
    session_id: String,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.cancel(session_id).await.map_err(|e| e.to_string())
}

/// Respond to a permission request.
#[tauri::command]
pub async fn codex_approve(
    state: State<'_, CodexManager>,
    session_id: String,
    request_id: String,
    decision: Option<ApprovalDecision>,
    option_id: Option<String>,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.respond_permission(session_id, request_id, decision, option_id)
        .map_err(|e| e.to_string())
}

/// Update a session config option by id.
#[tauri::command]
pub async fn codex_set_config_option(
    state: State<'_, CodexManager>,
    session_id: String,
    config_id: String,
    value_id: String,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized; call codex_init first".to_string())?;
    svc.set_config_option(session_id, config_id, value_id)
        .await
        .map_err(|e| e.to_string())
}

/// Convenience wrapper to update the session mode.
#[tauri::command]
pub async fn codex_set_mode(
    state: State<'_, CodexManager>,
    session_id: String,
    mode_id: String,
) -> Result<(), String> {
    codex_set_config_option(state, session_id, "mode".to_string(), mode_id).await
}

/// Convenience wrapper to update the session model.
#[tauri::command]
pub async fn codex_set_model(
    state: State<'_, CodexManager>,
    session_id: String,
    model_id: String,
) -> Result<(), String> {
    codex_set_config_option(state, session_id, "model".to_string(), model_id).await
}

/// Warmup the Codex ACP connection.
/// This pre-spawns the codex-acp process and initializes the protocol,
/// reducing latency for the first actual session creation.
#[tauri::command]
pub async fn codex_warmup(
    app: AppHandle,
    state: State<'_, CodexManager>,
) -> Result<(), String> {
    let svc = state.get_or_create(app);
    svc.warmup().await.map_err(|e| e.to_string())
}

/// Entry in a local directory listing.
#[derive(serde::Serialize)]
pub struct LocalDirectoryEntry {
    /// File or directory name
    pub name: String,
    /// Absolute path
    pub path: String,
    /// true if this entry is a directory
    pub is_dir: bool,
    /// File size in bytes (0 for directories)
    pub size: u64,
    /// Last modified timestamp in milliseconds since epoch
    pub modified: Option<u64>,
}

/// Result of listing a local directory.
#[derive(serde::Serialize)]
pub struct LocalDirectoryListing {
    /// The path that was listed
    pub path: String,
    /// Entries in the directory
    pub entries: Vec<LocalDirectoryEntry>,
}

/// List files and directories in a local path.
#[tauri::command]
pub async fn list_local_directory(path: String) -> Result<LocalDirectoryListing, String> {
    use std::fs;
    use std::time::UNIX_EPOCH;

    let dir_path = PathBuf::from(&path);
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries = Vec::new();
    let read_result =
        fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_result {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files (starting with .)
        if file_name.starts_with('.') {
            continue;
        }

        let file_path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_dir = metadata.is_dir();
        let size = if is_dir { 0 } else { metadata.len() };
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);

        entries.push(LocalDirectoryEntry {
            name: file_name,
            path: file_path.to_string_lossy().to_string(),
            is_dir,
            size,
            modified,
        });
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(LocalDirectoryListing { path, entries })
}
