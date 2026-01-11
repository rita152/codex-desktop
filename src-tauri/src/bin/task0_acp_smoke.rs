use anyhow::{anyhow, Context, Result};
use agent_client_protocol::{
    Agent, AuthenticateRequest, Client, ClientCapabilities, ClientSideConnection, ContentBlock,
    InitializeRequest, Meta, PermissionOptionKind, ProtocolVersion, PromptRequest,
    RequestPermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
    SelectedPermissionOutcome, SessionConfigKind, SessionConfigSelectOptions, SessionNotification,
    SessionUpdate, SetSessionConfigOptionRequest,
};
use serde_json::json;
use std::{path::PathBuf, sync::Arc};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use codex_desktop_lib::codex::binary::CodexAcpBinary;
use codex_desktop_lib::codex_dev::config;

#[derive(Clone)]
struct StdoutClient;

#[async_trait::async_trait(?Send)]
impl Client for StdoutClient {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        eprintln!(
            "{}",
            json!({
                "type": "request_permission",
                "sessionId": args.session_id.0,
                "toolCall": args.tool_call,
                "options": args.options,
            })
        );

        let selected = args
            .options
            .iter()
            .find(|o| matches!(o.kind, PermissionOptionKind::AllowOnce | PermissionOptionKind::AllowAlways))
            .or_else(|| args.options.first())
            .ok_or_else(agent_client_protocol::Error::invalid_params)?;

        Ok(RequestPermissionResponse::new(RequestPermissionOutcome::Selected(
            SelectedPermissionOutcome::new(selected.option_id.clone()),
        )))
    }

    async fn session_notification(
        &self,
        args: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        match &args.update {
            SessionUpdate::AgentMessageChunk(chunk) => {
                if let Some(text) = content_block_text(&chunk.content) {
                    eprintln!("{}", json!({ "type": "agent_message_chunk", "text": text }));
                }
            }
            SessionUpdate::AgentThoughtChunk(chunk) => {
                if let Some(text) = content_block_text(&chunk.content) {
                    eprintln!("{}", json!({ "type": "agent_thought_chunk", "text": text }));
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                eprintln!("{}", json!({ "type": "tool_call", "toolCall": tool_call }));
            }
            SessionUpdate::ToolCallUpdate(update) => {
                eprintln!("{}", json!({ "type": "tool_call_update", "update": update }));
            }
            SessionUpdate::Plan(plan) => {
                eprintln!("{}", json!({ "type": "plan", "plan": plan }));
            }
            _ => {}
        }
        Ok(())
    }
}

fn content_block_text(block: &ContentBlock) -> Option<&str> {
    match block {
        ContentBlock::Text(text) => Some(text.text.as_str()),
        _ => None,
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let codex_home = config::codex_home_dir()?;
    let cfg = config::load_codex_cli_config(&codex_home)?;

    let cwd = std::env::current_dir().context("failed to get current_dir")?;
    let prompt = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "请读取 README.md 并总结项目用途（如需读取文件请发起工具调用）".to_string());

    tokio::task::LocalSet::new()
        .run_until(async move {
            run_smoke(codex_home, cfg, cwd, prompt).await
        })
        .await
}

async fn run_smoke(
    codex_home: PathBuf,
    cfg: config::CodexCliConfig,
    cwd: PathBuf,
    prompt: String,
) -> Result<()> {
    let binary = CodexAcpBinary::resolve(None)?;
    eprintln!("{}", binary.diagnostics_line());
    let mut cmd = binary.command(&codex_home);

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
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| anyhow!("codex-acp stdin unavailable"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("codex-acp stdout unavailable"))?;

    let mut meta = Meta::default();
    meta.insert("terminal_output".to_owned(), serde_json::Value::Bool(true));
    let client_capabilities = ClientCapabilities::new().meta(meta);

    let (conn, io_task) = ClientSideConnection::new(
        Arc::new(StdoutClient),
        stdin.compat_write(),
        stdout.compat(),
        |fut| {
            tokio::task::spawn_local(fut);
        },
    );

    tokio::task::spawn_local(async move {
        if let Err(err) = io_task.await {
            eprintln!("{}", json!({ "type": "io_error", "error": err.to_string() }));
        }
    });

    let init = conn
        .initialize(
            InitializeRequest::new(ProtocolVersion::V1)
                .client_info(agent_client_protocol::Implementation::new(
                    "codex-desktop-task0-smoke",
                    env!("CARGO_PKG_VERSION"),
                ))
                .client_capabilities(client_capabilities),
        )
        .await?;
    eprintln!("{}", json!({ "type": "initialize_ok", "agentInfo": init.agent_info, "authMethods": init.auth_methods }));

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
        let _ = conn.authenticate(AuthenticateRequest::new(method_id)).await?;
        eprintln!("{}", json!({ "type": "authenticate_ok", "methodId": method_id }));
    }

    let session = conn.new_session(agent_client_protocol::NewSessionRequest::new(cwd)).await?;
    eprintln!(
        "{}",
        json!({
            "type": "new_session_ok",
            "sessionId": session.session_id.0,
            "configOptions": session.config_options,
            "modes": session.modes,
            "models": session.models,
        })
    );

    // Try to switch to a more restrictive approval preset so `request_permission` is exercised.
    if let Some(config_options) = session.config_options.as_ref() {
        if let Some(mode_option) = config_options.iter().find(|o| o.id.0.as_ref() == "mode") {
            if let SessionConfigKind::Select(select) = &mode_option.kind {
                let mut flat = Vec::new();
                match &select.options {
                    SessionConfigSelectOptions::Ungrouped(opts) => flat.extend(opts.iter()),
                    SessionConfigSelectOptions::Grouped(groups) => {
                        for g in groups {
                            flat.extend(g.options.iter());
                        }
                    }
                    _ => {}
                }

                let pick = flat
                    .iter()
                    .find(|o| o.value.0.as_ref() == "read-only")
                    .or_else(|| flat.iter().find(|o| {
                    let name = o.name.to_ascii_lowercase();
                    let id = o.value.0.as_ref().to_ascii_lowercase();
                    name.contains("ask")
                        || name.contains("untrusted")
                        || name.contains("prompt")
                        || id.contains("untrusted")
                        || id.contains("ask")
                }));

                if let Some(target) = pick {
                    let _ = conn
                        .set_session_config_option(SetSessionConfigOptionRequest::new(
                            session.session_id.clone(),
                            mode_option.id.clone(),
                            target.value.clone(),
                        ))
                        .await?;
                    eprintln!(
                        "{}",
                        json!({
                            "type": "set_mode_attempted",
                            "configId": mode_option.id,
                            "value": target.value,
                            "name": target.name,
                        })
                    );
                }
            }
        }
    }

    let request = PromptRequest::new(
        session.session_id.clone(),
        vec![ContentBlock::Text(agent_client_protocol::TextContent::new(prompt))],
    );

    let response = conn.prompt(request).await?;
    eprintln!("{}", json!({ "type": "prompt_done", "stopReason": response.stop_reason }));

    let _ = child.kill().await;
    let _ = child.wait().await;

    Ok(())
}
