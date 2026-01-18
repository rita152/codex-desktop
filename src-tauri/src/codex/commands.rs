//! Tauri command handlers for Codex interactions.

use crate::codex::service::CodexService;
use crate::codex::types::{ApprovalDecision, InitializeResult, NewSessionResult, PromptResult};
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
        self.service
            .get_or_init(|| CodexService::new(app))
            .clone()
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
