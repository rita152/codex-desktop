use crate::codex::{
    events::*,
    process::{CodexProcess, CodexProcessConfig},
    thoughts::emit_thought_chunks,
    types::ApprovalDecision,
};
use agent_client_protocol::{
    Client, ClientSideConnection, ContentBlock, PermissionOption, PermissionOptionId,
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
pub struct ApprovalKey {
    pub session_id: String,
    pub tool_call_id: String,
}

impl ApprovalKey {
    pub fn new(session_id: impl Into<String>, tool_call_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            tool_call_id: tool_call_id.into(),
        }
    }

    pub fn as_map_key(&self) -> String {
        format!("{}:{}", self.session_id, self.tool_call_id)
    }
}

struct PendingApproval {
    options: Vec<PermissionOption>,
    tx: oneshot::Sender<PermissionOptionId>,
}

#[derive(Default)]
pub struct ApprovalState {
    pending: std::sync::Mutex<HashMap<String, PendingApproval>>,
}

impl ApprovalState {
    pub fn insert(
        &self,
        key: ApprovalKey,
        options: Vec<PermissionOption>,
        tx: oneshot::Sender<PermissionOptionId>,
    ) {
        let mut guard = self.pending.lock().expect("approval mutex poisoned");
        guard.insert(key.as_map_key(), PendingApproval { options, tx });
    }

    pub fn respond(
        &self,
        key: ApprovalKey,
        decision: Option<ApprovalDecision>,
        option_id: Option<String>,
    ) -> Result<()> {
        let mut guard = self.pending.lock().expect("approval mutex poisoned");
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
}

#[derive(Clone)]
struct AcpClient {
    app: AppHandle,
    approvals: Arc<ApprovalState>,
}

fn content_block_text(block: &ContentBlock) -> Option<&str> {
    match block {
        ContentBlock::Text(text) => Some(text.text.as_str()),
        _ => None,
    }
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
                    let _ = self.app.emit(
                        EVENT_MESSAGE_CHUNK,
                        json!({ "sessionId": session_id, "text": text }),
                    );
                }
            }
            SessionUpdate::AgentThoughtChunk(chunk) => {
                if emit_thought_chunks() {
                    if let Some(text) = content_block_text(&chunk.content) {
                        let _ = self.app.emit(
                            EVENT_THOUGHT_CHUNK,
                            json!({ "sessionId": session_id, "text": text }),
                        );
                    }
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                let _ = self.app.emit(
                    EVENT_TOOL_CALL,
                    json!({ "sessionId": session_id, "toolCall": tool_call }),
                );
            }
            SessionUpdate::ToolCallUpdate(update) => {
                let _ = self.app.emit(
                    EVENT_TOOL_CALL_UPDATE,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            SessionUpdate::Plan(plan) => {
                let _ = self
                    .app
                    .emit(EVENT_PLAN, json!({ "sessionId": session_id, "plan": plan }));
            }
            SessionUpdate::AvailableCommandsUpdate(update) => {
                let _ = self.app.emit(
                    EVENT_AVAILABLE_COMMANDS,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            SessionUpdate::CurrentModeUpdate(update) => {
                let _ = self.app.emit(
                    EVENT_CURRENT_MODE,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            SessionUpdate::ConfigOptionUpdate(update) => {
                let _ = self.app.emit(
                    EVENT_CONFIG_OPTION_UPDATE,
                    json!({ "sessionId": session_id, "update": update }),
                );
            }
            _ => {}
        }
        Ok(())
    }
}

pub struct AcpConnection {
    pub conn: Arc<ClientSideConnection>,
    process: tokio::sync::Mutex<CodexProcess>,
}

impl AcpConnection {
    pub async fn spawn(
        app: AppHandle,
        approvals: Arc<ApprovalState>,
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
        tokio::task::spawn_local(async move {
            if let Err(err) = io_task.await {
                let _ = io_app.emit(EVENT_ERROR, json!({ "error": err.to_string() }));
            }
        });

        Ok(Self {
            conn: Arc::new(conn),
            process: tokio::sync::Mutex::new(process),
        })
    }

    pub async fn kill(&self) -> Result<()> {
        let mut guard = self.process.lock().await;
        guard.kill().await
    }
}
