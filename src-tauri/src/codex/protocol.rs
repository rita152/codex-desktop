//! ACP client wiring and permission handling.

use crate::codex::{
    debug::DebugState,
    events::*,
    process::{CodexProcess, CodexProcessConfig},
    thoughts::emit_thought_chunks,
    types::ApprovalDecision,
    util::content_block_text,
};
use agent_client_protocol::{
    Client, ClientSideConnection, ExtNotification, PermissionOption, PermissionOptionId,
    PermissionOptionKind, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome, SessionNotification, SessionUpdate,
};
use anyhow::{anyhow, Context, Result};
use serde_json::json;
use std::{collections::HashMap, sync::Arc};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
/// Composite key for an approval request.
pub struct ApprovalKey {
    /// ACP session id.
    pub session_id: String,
    /// Tool call id.
    pub tool_call_id: String,
}

impl ApprovalKey {
    /// Create a new approval key from session and tool call ids.
    pub fn new(session_id: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            tool_call_id: tool_call_id.into(),
        }
    }

    /// Convert the key to a stable map-friendly string.
    pub fn as_map_key(&self) -> String {
        format!("{}:{}", self.session_id, self.tool_call_id)
    }
}

struct PendingApproval {
    options: Vec<PermissionOption>,
    tx: oneshot::Sender<PermissionOptionId>,
}

#[derive(Default)]
/// Shared state for pending approval requests.
pub struct ApprovalState {
    pending: std::sync::Mutex<HashMap<String, PendingApproval>>,
}

impl ApprovalState {
    /// Register a pending approval request.
    pub fn insert(
        &self,
        key: ApprovalKey,
        options: Vec<PermissionOption>,
        tx: oneshot::Sender<PermissionOptionId>,
    ) {
        let mut guard = self.lock_pending();
        guard.insert(key.as_map_key(), PendingApproval { options, tx });
    }

    /// Resolve a pending approval request with a decision or explicit option id.
    pub fn respond(
        &self,
        key: ApprovalKey,
        decision: Option<ApprovalDecision>,
        option_id: Option<String>,
    ) -> Result<()> {
        let mut guard = self.lock_pending();
        let pending = guard
            .remove(&key.as_map_key())
            .ok_or_else(|| anyhow!("no pending approval for session/tool_call"))?;

        let selected = if let Some(option_id) = option_id {
            PermissionOptionId::from(option_id)
        } else {
            let desired_kind = decision.unwrap_or(ApprovalDecision::AllowOnce);
            let kind = match desired_kind {
                ApprovalDecision::AllowAlways => PermissionOptionKind::AllowAlways,
                ApprovalDecision::AllowOnce => PermissionOptionKind::AllowOnce,
                ApprovalDecision::RejectAlways => PermissionOptionKind::RejectAlways,
                ApprovalDecision::RejectOnce => PermissionOptionKind::RejectOnce,
            };

            pending
                .options
                .iter()
                .find(|o| o.kind == kind)
                .or_else(|| pending.options.first())
                .map(|o| o.option_id.clone())
                .ok_or_else(|| anyhow!("approval request had no options"))?
        };

        let _ = pending.tx.send(selected);
        Ok(())
    }

    fn lock_pending(&self) -> std::sync::MutexGuard<'_, HashMap<String, PendingApproval>> {
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[derive(Clone)]
struct AcpClient {
    app: AppHandle,
    approvals: Arc<ApprovalState>,
    debug: Arc<DebugState>,
}

#[async_trait::async_trait(?Send)]
impl Client for AcpClient {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        let tool_call_id = args.tool_call.tool_call_id.0.as_ref().to_string();
        let session_id = args.session_id.0.as_ref().to_string();
        let key = ApprovalKey::new(session_id.clone(), tool_call_id.clone());

        let timing = self.debug.mark_event(&session_id);
        self.debug.emit(
            &self.app,
            Some(&session_id),
            "request_permission",
            timing,
            json!({ "toolCallId": tool_call_id }),
        );

        let (tx, rx) = oneshot::channel();
        self.approvals.insert(key, args.options.clone(), tx);

        let _ = self.app.emit(
            EVENT_APPROVAL_REQUEST,
            json!({
                "sessionId": session_id,
                "requestId": tool_call_id,
                "toolCall": args.tool_call,
                "options": args.options,
            }),
        );

        let selected = match rx.await {
            Ok(option_id) => option_id,
            Err(_) => {
                return Ok(RequestPermissionResponse::new(
                    RequestPermissionOutcome::Cancelled,
                ));
            }
        };

        Ok(RequestPermissionResponse::new(
            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(selected)),
        ))
    }

    async fn session_notification(
        &self,
        args: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        let session_id = args.session_id.0.as_ref().to_string();

        match &args.update {
            SessionUpdate::AgentMessageChunk(chunk) => {
                if let Some(text) = content_block_text(&chunk.content) {
                    let timing = self.debug.mark_event(&session_id);
                    self.debug.emit(
                        &self.app,
                        Some(&session_id),
                        "agent_message_chunk",
                        timing,
                        json!({ "textLen": text.len() }),
                    );
                    let _ = self.app.emit(
                        EVENT_MESSAGE_CHUNK,
                        json!({ "sessionId": session_id, "text": text }),
                    );
                }
            }
            SessionUpdate::AgentThoughtChunk(chunk) => {
                if emit_thought_chunks() {
                    if let Some(text) = content_block_text(&chunk.content) {
                        let timing = self.debug.mark_event(&session_id);
                        self.debug.emit(
                            &self.app,
                            Some(&session_id),
                            "agent_thought_chunk",
                            timing,
                            json!({ "textLen": text.len() }),
                        );
                        let _ = self.app.emit(
                            EVENT_THOUGHT_CHUNK,
                            json!({ "sessionId": session_id, "text": text }),
                        );
                    }
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                let tool_call_id = tool_call.tool_call_id.0.as_ref();
                let timing = self.debug.mark_event(&session_id);
                self.debug.emit(
                    &self.app,
                    Some(&session_id),
                    "tool_call",
                    timing,
                    json!({
                        "toolCallId": tool_call_id,
                        "title": tool_call.title.as_str(),
                    }),
                );
                let _ = self.app.emit(
                    EVENT_TOOL_CALL,
                    json!({ "sessionId": session_id, "toolCall": tool_call }),
                );
            }
            SessionUpdate::ToolCallUpdate(update) => {
                let tool_call_id = update.tool_call_id.0.as_ref();
                let timing = self.debug.mark_event(&session_id);
                self.debug.emit(
                    &self.app,
                    Some(&session_id),
                    "tool_call_update",
                    timing,
                    json!({ "toolCallId": tool_call_id }),
                );
                let _ = self.app.emit(
                    EVENT_TOOL_CALL_UPDATE,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            SessionUpdate::Plan(plan) => {
                let timing = self.debug.mark_event(&session_id);
                self.debug.emit(
                    &self.app,
                    Some(&session_id),
                    "plan",
                    timing,
                    json!({ "entries": plan.entries.len() }),
                );
                let _ = self
                    .app
                    .emit(EVENT_PLAN, json!({ "sessionId": session_id, "plan": plan }));
            }
            SessionUpdate::AvailableCommandsUpdate(update) => {
                let timing = self.debug.mark_event(&session_id);
                self.debug.emit(
                    &self.app,
                    Some(&session_id),
                    "available_commands_update",
                    timing,
                    json!({ "count": update.available_commands.len() }),
                );
                let _ = self.app.emit(
                    EVENT_AVAILABLE_COMMANDS,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            SessionUpdate::CurrentModeUpdate(update) => {
                let timing = self.debug.mark_event(&session_id);
                self.debug.emit(
                    &self.app,
                    Some(&session_id),
                    "current_mode_update",
                    timing,
                    json!({ "mode": update.current_mode_id.0.as_ref() }),
                );
                let _ = self.app.emit(
                    EVENT_CURRENT_MODE,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            SessionUpdate::ConfigOptionUpdate(update) => {
                let timing = self.debug.mark_event(&session_id);
                self.debug.emit(
                    &self.app,
                    Some(&session_id),
                    "config_option_update",
                    timing,
                    json!({ "count": update.config_options.len() }),
                );
                let _ = self.app.emit(
                    EVENT_CONFIG_OPTION_UPDATE,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            _ => {}
        }
        Ok(())
    }

    async fn ext_notification(&self, args: ExtNotification) -> agent_client_protocol::Result<()> {
        if args.method.as_ref() == "codex/token-usage" {
            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(args.params.get()) {
                let _ = self.app.emit(EVENT_TOKEN_USAGE, payload);
            }
        }
        Ok(())
    }
}

/// Running ACP connection plus the managed child process.
pub struct AcpConnection {
    /// Shared connection handle for issuing ACP requests.
    pub conn: Arc<ClientSideConnection>,
    process: tokio::sync::Mutex<CodexProcess>,
}

impl AcpConnection {
    /// Spawn an ACP connection and background IO task.
    pub async fn spawn(
        app: AppHandle,
        approvals: Arc<ApprovalState>,
        debug: Arc<DebugState>,
        mut cfg: CodexProcessConfig,
    ) -> Result<Self> {
        cfg.set_env_if_missing("RUST_LOG", "warn");

        let mut process = CodexProcess::spawn(Some(&app), cfg)
            .await
            .context("failed to spawn codex-acp process")?;
        let (stdin, stdout) = process.take_stdio()?;

        let client = AcpClient {
            app: app.clone(),
            approvals,
            debug: debug.clone(),
        };

        let (conn, io_task) = ClientSideConnection::new(
            Arc::new(client),
            stdin.compat_write(),
            stdout.compat(),
            |fut| {
                tokio::task::spawn_local(fut);
            },
        );

        let io_app = app.clone();
        let io_debug = debug.clone();
        tokio::task::spawn_local(async move {
            if let Err(err) = io_task.await {
                let timing = io_debug.mark_global();
                io_debug.emit(
                    &io_app,
                    None,
                    "io_error",
                    timing,
                    json!({ "error": err.to_string() }),
                );
                let _ = io_app.emit(EVENT_ERROR, json!({ "error": err.to_string() }));
            }
        });

        Ok(Self {
            conn: Arc::new(conn),
            process: tokio::sync::Mutex::new(process),
        })
    }

    /// Terminate the underlying ACP process.
    pub async fn kill(&self) -> Result<()> {
        let mut guard = self.process.lock().await;
        guard.kill().await
    }
}
