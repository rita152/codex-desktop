use agent_client_protocol::{
    Agent, AuthenticateRequest, Client, ClientCapabilities, ClientSideConnection, ContentBlock,
    InitializeRequest, Meta, PermissionOptionKind, PromptRequest, ProtocolVersion,
    RequestPermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
    SelectedPermissionOutcome, SessionConfigKind, SessionConfigSelectOptions, SessionNotification,
    SessionUpdate, SetSessionConfigOptionRequest,
};
use anyhow::{anyhow, Context, Result};
use serde_json::json;
use std::{
    fs::File,
    io::{BufWriter, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use codex_desktop_lib::codex::binary::CodexAcpBinary;
use codex_desktop_lib::codex::util::content_block_text;
use codex_desktop_lib::codex_dev::config;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[derive(Clone)]
struct OutputLog {
    path: PathBuf,
    start_ms: u64,
    writer: Arc<Mutex<BufWriter<File>>>,
}

impl OutputLog {
    fn new(path: PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("failed to create log dir: {}", parent.display()))?;
            }
        }
        let file =
            File::create(&path).with_context(|| format!("failed to create log: {}", path.display()))?;
        Ok(Self {
            path,
            start_ms: now_ms(),
            writer: Arc::new(Mutex::new(BufWriter::new(file))),
        })
    }

    fn write_json(&self, mut value: serde_json::Value) {
        let ts_ms = now_ms();
        if let Some(obj) = value.as_object_mut() {
            obj.insert("tsMs".to_string(), serde_json::Value::Number(ts_ms.into()));
            let dt = ts_ms.saturating_sub(self.start_ms);
            obj.insert("dtMs".to_string(), serde_json::Value::Number(dt.into()));
        }

        let line = match serde_json::to_string(&value) {
            Ok(s) => s,
            Err(_) => return,
        };

        if let Ok(mut guard) = self.writer.lock() {
            let _ = writeln!(guard, "{line}");
            let _ = guard.flush();
        }
    }
}

#[derive(Clone)]
struct StdoutClient {
    log: OutputLog,
}

#[async_trait::async_trait(?Send)]
impl Client for StdoutClient {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        let value = json!({
            "type": "request_permission",
            "sessionId": args.session_id.0,
            "toolCall": args.tool_call,
            "options": args.options,
        });
        self.log.write_json(value.clone());
        eprintln!("{value}");

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
        match &args.update {
            SessionUpdate::AgentMessageChunk(chunk) => {
                if let Some(text) = content_block_text(&chunk.content) {
                    let value = json!({ "type": "agent_message_chunk", "text": text });
                    self.log.write_json(value.clone());
                    eprintln!("{value}");
                }
            }
            SessionUpdate::AgentThoughtChunk(chunk) => {
                if let Some(text) = content_block_text(&chunk.content) {
                    let value = json!({ "type": "agent_thought_chunk", "text": text });
                    self.log.write_json(value.clone());
                    eprintln!("{value}");
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                let value = json!({ "type": "tool_call", "toolCall": tool_call });
                self.log.write_json(value.clone());
                eprintln!("{value}");
            }
            SessionUpdate::ToolCallUpdate(update) => {
                let value = json!({ "type": "tool_call_update", "update": update });
                self.log.write_json(value.clone());
                eprintln!("{value}");
            }
            SessionUpdate::Plan(plan) => {
                let value = json!({ "type": "plan", "plan": plan });
                self.log.write_json(value.clone());
                eprintln!("{value}");
            }
            SessionUpdate::AvailableCommandsUpdate(update) => {
                let value = json!({ "type": "available_commands_update", "update": update });
                self.log.write_json(value.clone());
                eprintln!("{value}");
            }
            SessionUpdate::CurrentModeUpdate(update) => {
                let value = json!({ "type": "current_mode_update", "update": update });
                self.log.write_json(value.clone());
                eprintln!("{value}");
            }
            SessionUpdate::ConfigOptionUpdate(update) => {
                let value = json!({ "type": "config_option_update", "update": update });
                self.log.write_json(value.clone());
                eprintln!("{value}");
            }
            _ => {}
        }
        Ok(())
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let codex_home = config::codex_home_dir()?;
    let cfg = config::load_codex_cli_config(&codex_home)?;

    let cwd = std::env::current_dir().context("failed to get current_dir")?;
    let (prompt, out_path) = parse_args()?;
    let out_log = OutputLog::new(out_path)?;
    let init_value = json!({
        "type": "output_file",
        "path": out_log.path.display().to_string(),
    });
    out_log.write_json(init_value.clone());
    eprintln!("{init_value}");

    tokio::task::LocalSet::new()
        .run_until(async move { run_smoke(codex_home, cfg, cwd, prompt, out_log).await })
        .await
}

fn default_out_path(cwd: &Path) -> PathBuf {
    cwd.join(format!("task0_acp_smoke_output_{}.txt", now_ms()))
}

fn parse_args() -> Result<(String, PathBuf)> {
    let cwd = std::env::current_dir().context("failed to get current_dir")?;

    let mut prompt: Option<String> = None;
    let mut prompt_file: Option<PathBuf> = None;
    let mut out: Option<PathBuf> = None;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--prompt-file" => {
                let path = args
                    .next()
                    .ok_or_else(|| anyhow!("--prompt-file requires a path"))?;
                prompt_file = Some(PathBuf::from(path));
            }
            "--out" => {
                let path = args.next().ok_or_else(|| anyhow!("--out requires a path"))?;
                out = Some(PathBuf::from(path));
            }
            "--help" | "-h" => {
                eprintln!(
                    "usage: task0_acp_smoke [PROMPT]\n  --prompt-file <path>\n  --out <path>"
                );
                std::process::exit(0);
            }
            other => {
                if prompt.is_none() {
                    prompt = Some(other.to_string());
                } else {
                    prompt = Some(format!("{} {}", prompt.unwrap(), other));
                }
            }
        }
    }

    let prompt = if let Some(path) = prompt_file {
        std::fs::read_to_string(&path)
            .with_context(|| format!("failed to read prompt file: {}", path.display()))?
    } else {
        prompt.unwrap_or_else(|| "请读取 README.md 并总结项目用途（如需读取文件请发起工具调用）".to_string())
    };

    let out = out.unwrap_or_else(|| default_out_path(&cwd));
    Ok((prompt, out))
}

async fn run_smoke(
    codex_home: PathBuf,
    cfg: config::CodexCliConfig,
    cwd: PathBuf,
    prompt: String,
    out_log: OutputLog,
) -> Result<()> {
    let binary = CodexAcpBinary::resolve(None)?;
    let diagnostics = binary.diagnostics_line();
    out_log.write_json(json!({ "type": "codex_acp_spawn", "diagnostics": diagnostics }));
    eprintln!("{diagnostics}");
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
        Arc::new(StdoutClient {
            log: out_log.clone(),
        }),
        stdin.compat_write(),
        stdout.compat(),
        |fut| {
            tokio::task::spawn_local(fut);
        },
    );

    let io_log = out_log.clone();
    tokio::task::spawn_local(async move {
        if let Err(err) = io_task.await {
            let value = json!({ "type": "io_error", "error": err.to_string() });
            io_log.write_json(value.clone());
            eprintln!("{value}");
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
    let value = json!({ "type": "initialize_ok", "agentInfo": init.agent_info, "authMethods": init.auth_methods });
    out_log.write_json(value.clone());
    eprintln!("{value}");

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
            .await?;
        let value = json!({ "type": "authenticate_ok", "methodId": method_id });
        out_log.write_json(value.clone());
        eprintln!("{value}");
    }

    let session = conn
        .new_session(agent_client_protocol::NewSessionRequest::new(cwd))
        .await?;
    let value = json!({
        "type": "new_session_ok",
        "sessionId": session.session_id.0,
        "configOptions": session.config_options,
        "modes": session.modes,
        "models": session.models,
    });
    out_log.write_json(value.clone());
    eprintln!("{value}");

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
                    .or_else(|| {
                        flat.iter().find(|o| {
                            let name = o.name.to_ascii_lowercase();
                            let id = o.value.0.as_ref().to_ascii_lowercase();
                            name.contains("ask")
                                || name.contains("untrusted")
                                || name.contains("prompt")
                                || id.contains("untrusted")
                                || id.contains("ask")
                        })
                    });

                if let Some(target) = pick {
                    let _ = conn
                        .set_session_config_option(SetSessionConfigOptionRequest::new(
                            session.session_id.clone(),
                            mode_option.id.clone(),
                            target.value.clone(),
                        ))
                        .await?;
                    let value = json!({
                        "type": "set_mode_attempted",
                        "configId": mode_option.id,
                        "value": target.value,
                        "name": target.name,
                    });
                    out_log.write_json(value.clone());
                    eprintln!("{value}");
                }
            }
        }
        if let Some(model_option) = config_options.iter().find(|o| o.id.0.as_ref() == "model") {
            if let SessionConfigKind::Select(select) = &model_option.kind {
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

                let pick = flat.iter().find(|o| o.value != select.current_value);
                if let Some(target) = pick {
                    let _ = conn
                        .set_session_config_option(SetSessionConfigOptionRequest::new(
                            session.session_id.clone(),
                            model_option.id.clone(),
                            target.value.clone(),
                        ))
                        .await?;
                    let value = json!({
                        "type": "set_model_attempted",
                        "configId": model_option.id,
                        "value": target.value,
                        "name": target.name,
                    });
                    out_log.write_json(value.clone());
                    eprintln!("{value}");
                }
            }
        }
    }

    let request = PromptRequest::new(
        session.session_id.clone(),
        vec![ContentBlock::Text(agent_client_protocol::TextContent::new(
            prompt,
        ))],
    );

    let response = conn.prompt(request).await?;
    let value = json!({ "type": "prompt_done", "stopReason": response.stop_reason });
    out_log.write_json(value.clone());
    eprintln!("{value}");

    let _ = child.kill().await;
    let _ = child.wait().await;

    Ok(())
}
