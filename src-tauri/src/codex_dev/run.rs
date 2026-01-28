//! Dev-only ACP runner utilities.

use agent_client_protocol::{
    Agent, AuthenticateRequest, Client, ClientCapabilities, ClientSideConnection, ContentBlock,
    Implementation, InitializeRequest, Meta, PermissionOptionKind, PromptRequest, ProtocolVersion,
    RequestPermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
    SelectedPermissionOutcome, SessionNotification, SessionUpdate,
};
use anyhow::{anyhow, Context, Result};
use serde_json::json;
use std::{path::PathBuf, sync::Arc};
use tauri::{Emitter, Window};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use super::config::{codex_home_dir, load_codex_cli_config, redact_api_key, CodexCliConfig};
use crate::codex::{
    binary::CodexAcpBinary, events::*, process::resolve_cwd, thoughts::emit_thought_chunks,
    util::content_block_text,
};
use tauri::Manager;

#[derive(Clone)]
struct DevClient {
    window: Window,
    auto_approve: bool,
}

#[async_trait::async_trait(?Send)]
impl Client for DevClient {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        let request_id = args.tool_call.tool_call_id.0.as_ref();
        let _ = self.window.emit(
            EVENT_APPROVAL_REQUEST,
            json!({
                "sessionId": args.session_id.0,
                "requestId": request_id,
                "toolCall": args.tool_call,
                "options": args.options,
            }),
        );

        if !self.auto_approve {
            return Ok(RequestPermissionResponse::new(
                RequestPermissionOutcome::Cancelled,
            ));
        }

        let selected = args
            .options
            .iter()
            .find(|o| {
                matches!(
                    o.kind,
                    PermissionOptionKind::AllowOnce | PermissionOptionKind::AllowAlways
                )
            })
            .or_else(|| args.options.first())
            .ok_or_else(agent_client_protocol::Error::invalid_params)?;

        Ok(RequestPermissionResponse::new(
            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                selected.option_id.clone(),
            )),
        ))
    }

    async fn session_notification(
        &self,
        args: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        let SessionNotification {
            session_id, update, ..
        } = args;
        let session_id = session_id.0;
        match update {
            SessionUpdate::AgentMessageChunk(chunk) => {
                if let Some(text) = content_block_text(&chunk.content) {
                    let _ = self.window.emit(
                        EVENT_MESSAGE_CHUNK,
                        json!({ "sessionId": session_id.as_ref(), "text": text }),
                    );
                }
            }
            SessionUpdate::AgentThoughtChunk(chunk) => {
                if emit_thought_chunks() {
                    if let Some(text) = content_block_text(&chunk.content) {
                        let _ = self.window.emit(
                            EVENT_THOUGHT_CHUNK,
                            json!({ "sessionId": session_id.as_ref(), "text": text }),
                        );
                    }
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                let _ = self.window.emit(
                    EVENT_TOOL_CALL,
                    json!({ "sessionId": session_id.as_ref(), "toolCall": tool_call }),
                );
            }
            SessionUpdate::ToolCallUpdate(update) => {
                let _ = self.window.emit(
                    EVENT_TOOL_CALL_UPDATE,
                    json!({ "sessionId": session_id.as_ref(), "update": update }),
                );
            }
            SessionUpdate::Plan(plan) => {
                let _ = self.window.emit(
                    EVENT_PLAN,
                    json!({ "sessionId": session_id.as_ref(), "plan": plan }),
                );
            }
            SessionUpdate::AvailableCommandsUpdate(update) => {
                let _ = self.window.emit(
                    EVENT_AVAILABLE_COMMANDS,
                    json!({ "sessionId": session_id.as_ref(), "update": update }),
                );
            }
            SessionUpdate::CurrentModeUpdate(update) => {
                let _ = self.window.emit(
                    EVENT_CURRENT_MODE,
                    json!({ "sessionId": session_id.as_ref(), "update": update }),
                );
            }
            SessionUpdate::ConfigOptionUpdate(update) => {
                let _ = self.window.emit(
                    EVENT_CONFIG_OPTION_UPDATE,
                    json!({ "sessionId": session_id.as_ref(), "update": update }),
                );
            }
            _ => {}
        }
        Ok(())
    }
}

/// Validate dev prerequisites and emit the resolved config to the window.
pub async fn check_dev_prereqs(window: &Window) -> Result<CodexCliConfig> {
    let codex_home = codex_home_dir()?;
    let cfg = load_codex_cli_config(&codex_home)?;

    let _ = window.emit(
        "codex:dev:config",
        json!({
            "codexHome": codex_home,
            "modelProvider": cfg.model_provider.clone(),
            "baseUrl": cfg.base_url.clone(),
            "apiKey": cfg.api_key.as_deref().map(redact_api_key),
        }),
    );

    Ok(cfg)
}

/// Run a single Codex ACP prompt round-trip for dev smoke testing.
pub async fn prompt_once(window: Window, cwd: PathBuf, content: String) -> Result<()> {
    let cfg = check_dev_prereqs(&window).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .context("failed to build tokio runtime")?;

        rt.block_on(async move {
            tokio::task::LocalSet::new()
                .run_until(async move { prompt_once_inner(window, cwd, content, cfg).await })
                .await
        })
    })
    .await
    .map_err(|e| anyhow!("failed to join blocking task: {e}"))?
}

async fn prompt_once_inner(
    window: Window,
    cwd: PathBuf,
    content: String,
    cfg: CodexCliConfig,
) -> Result<()> {
    let cwd = resolve_cwd(cwd)?;

    let codex_home = codex_home_dir()?;
    let app_handle = window.app_handle();
    let binary = CodexAcpBinary::resolve(Some(app_handle))?;
    tracing::info!(message = %binary.diagnostics_line(), "codex-acp diagnostics");
    let mut cmd = binary.command(&codex_home);

    // Dev: prefer reading ~/.codex/config.toml; if api_key is present there,
    // also export it to env so codex-acp's `authenticate` path can succeed.
    if let Some(api_key) = cfg.api_key.as_deref() {
        let provider = cfg
            .model_provider
            .as_deref()
            .unwrap_or("openai")
            .to_ascii_lowercase();

        if provider.contains("codex") {
            cmd.env("CODEX_API_KEY", api_key);
        } else {
            cmd.env("OPENAI_API_KEY", api_key);
        }
    }

    let mut child = cmd.spawn().context("failed to spawn codex-acp via npx")?;
    let child_stdin = child
        .stdin
        .take()
        .ok_or_else(|| anyhow!("codex-acp stdin unavailable"))?;
    let child_stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("codex-acp stdout unavailable"))?;

    let client = DevClient {
        window: window.clone(),
        auto_approve: true,
    };

    let mut meta = Meta::default();
    meta.insert("terminal_output".to_owned(), serde_json::Value::Bool(true));

    let client_capabilities = ClientCapabilities::new().meta(meta);

    let (conn, io_task) = ClientSideConnection::new(
        Arc::new(client),
        child_stdin.compat_write(),
        child_stdout.compat(),
        |fut| {
            tokio::task::spawn_local(fut);
        },
    );

    let io_window = window.clone();
    tokio::task::spawn_local(async move {
        if let Err(err) = io_task.await {
            let _ = io_window.emit(EVENT_ERROR, json!({ "error": err.to_string() }));
        }
    });

    let init = conn
        .initialize(
            InitializeRequest::new(ProtocolVersion::V1)
                .client_info(Implementation::new(
                    "codex-desktop",
                    env!("CARGO_PKG_VERSION"),
                ))
                .client_capabilities(client_capabilities),
        )
        .await
        .map_err(|e| anyhow!("initialize failed: {e:?}"))?;

    let _ = window.emit(
        "codex:dev:initialize",
        json!({
            "protocolVersion": init.protocol_version,
            "authMethods": init.auth_methods,
            "agentInfo": init.agent_info,
        }),
    );

    // If the user has api_key in ~/.codex/config.toml, attempt to authenticate so
    // CodexAuth check passes (codex-acp reads key from env during authenticate).
    if cfg.api_key.is_some() {
        let provider = cfg
            .model_provider
            .as_deref()
            .unwrap_or("openai")
            .to_ascii_lowercase();
        let method_id = if provider.contains("codex") {
            "codex-api-key"
        } else {
            "openai-api-key"
        };

        let _ = conn
            .authenticate(AuthenticateRequest::new(method_id))
            .await
            .map_err(|e| anyhow!("authenticate failed: {e:?}"))?;
    }

    let session = conn
        .new_session(agent_client_protocol::NewSessionRequest::new(cwd))
        .await
        .map_err(|e| anyhow!("new_session failed: {e:?}"))?;

    let _ = window.emit(
        "codex:dev:new-session",
        json!({
            "sessionId": session.session_id.0,
            "modes": session.modes,
            "models": session.models,
            "configOptions": session.config_options,
        }),
    );

    let prompt = PromptRequest::new(
        session.session_id.clone(),
        vec![ContentBlock::Text(agent_client_protocol::TextContent::new(
            content,
        ))],
    );

    let response = conn
        .prompt(prompt)
        .await
        .map_err(|e| anyhow!("prompt failed: {e:?}"))?;

    let _ = window.emit(
        EVENT_TURN_COMPLETE,
        json!({ "sessionId": session.session_id.0, "stopReason": response.stop_reason }),
    );

    let _ = child.kill().await;
    let _ = child.wait().await;

    Ok(())
}
