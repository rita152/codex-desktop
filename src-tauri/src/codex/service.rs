use crate::codex::{
    debug::DebugState,
    process::{resolve_cwd, CodexProcessConfig},
    protocol::{AcpConnection, ApprovalKey, ApprovalState},
    types::{ApprovalDecision, InitializeResult, NewSessionResult, PromptResult},
};
use agent_client_protocol::{
    Agent, AuthenticateRequest, CancelNotification, ClientCapabilities, Implementation,
    InitializeRequest, Meta, NewSessionRequest, PromptRequest, ProtocolVersion, SessionId,
    SetSessionConfigOptionRequest, TextContent,
};
use anyhow::{anyhow, Context, Result};
use std::{path::PathBuf, sync::Arc, time::Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot};

#[derive(Clone)]
pub struct CodexService {
    tx: mpsc::UnboundedSender<ServiceCommand>,
    approvals: Arc<ApprovalState>,
}

impl CodexService {
    pub fn new(app: AppHandle) -> Self {
        let approvals = Arc::new(ApprovalState::default());
        let debug = Arc::new(DebugState::new());
        let (tx, rx) = mpsc::unbounded_channel();

        std::thread::spawn({
            let approvals = approvals.clone();
            let debug = debug.clone();
            move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("failed to build tokio runtime");

                rt.block_on(async move {
                    tokio::task::LocalSet::new()
                        .run_until(worker_loop(app, approvals, debug, rx))
                        .await
                });
            }
        });

        Self { tx, approvals }
    }

    pub async fn initialize(&self) -> Result<InitializeResult> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Initialize { reply: reply_tx })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }

    pub async fn authenticate(&self, method_id: String, api_key: Option<String>) -> Result<()> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Authenticate {
                method_id,
                api_key,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }

    pub async fn create_session(&self, cwd: PathBuf) -> Result<NewSessionResult> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::NewSession {
                cwd,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }

    pub async fn send_prompt(&self, session_id: String, content: String) -> Result<PromptResult> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Prompt {
                session_id,
                content,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }

    pub async fn cancel(&self, session_id: String) -> Result<()> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Cancel {
                session_id,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }

    pub async fn set_config_option(
        &self,
        session_id: String,
        config_id: String,
        value_id: String,
    ) -> Result<()> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::SetConfigOption {
                session_id,
                config_id,
                value_id,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }

    pub fn respond_permission(
        &self,
        session_id: String,
        request_id: String,
        decision: Option<ApprovalDecision>,
        option_id: Option<String>,
    ) -> Result<()> {
        let key = ApprovalKey::new(session_id, request_id);
        self.approvals.respond(key, decision, option_id)
    }
}

enum ServiceCommand {
    Initialize {
        reply: oneshot::Sender<Result<InitializeResult>>,
    },
    Authenticate {
        method_id: String,
        api_key: Option<String>,
        reply: oneshot::Sender<Result<()>>,
    },
    NewSession {
        cwd: PathBuf,
        reply: oneshot::Sender<Result<NewSessionResult>>,
    },
    Prompt {
        session_id: String,
        content: String,
        reply: oneshot::Sender<Result<PromptResult>>,
    },
    Cancel {
        session_id: String,
        reply: oneshot::Sender<Result<()>>,
    },
    SetConfigOption {
        session_id: String,
        config_id: String,
        value_id: String,
        reply: oneshot::Sender<Result<()>>,
    },
}

struct WorkerState {
    app: AppHandle,
    approvals: Arc<ApprovalState>,
    debug: Arc<DebugState>,
    conn: Option<Arc<AcpConnection>>,
    initialized: bool,
    last_init: Option<InitializeResult>,
    api_key_env: Option<(String, String)>,
}

async fn ensure_connection(state: &mut WorkerState) -> Result<()> {
    if state.conn.is_some() {
        return Ok(());
    }

    let mut cfg = CodexProcessConfig::default();

    if let Some((k, v)) = state.api_key_env.clone() {
        cfg.set_env(k, v);
    }

    let conn = AcpConnection::spawn(
        state.app.clone(),
        state.approvals.clone(),
        state.debug.clone(),
        cfg,
    )
    .await?;
    state.conn = Some(Arc::new(conn));
    Ok(())
}

async fn initialize_inner(state: &mut WorkerState) -> Result<InitializeResult> {
    if state.initialized {
        return state
            .last_init
            .clone()
            .ok_or_else(|| anyhow!("initialized but missing cached InitializeResult"));
    }

    ensure_connection(state).await?;
    let conn = state.conn.as_ref().context("connection missing")?;

    let mut meta = Meta::default();
    meta.insert("terminal_output".to_owned(), serde_json::Value::Bool(true));
    let client_capabilities = ClientCapabilities::new().meta(meta);

    let init = conn
        .conn
        .initialize(
            InitializeRequest::new(ProtocolVersion::V1)
                .client_info(Implementation::new(
                    "codex-desktop",
                    env!("CARGO_PKG_VERSION"),
                ))
                .client_capabilities(client_capabilities),
        )
        .await
        .context("initialize failed")?;

    let out: InitializeResult = init.into();
    state.initialized = true;
    state.last_init = Some(out.clone());
    Ok(out)
}

async fn authenticate_inner(
    state: &mut WorkerState,
    method_id: String,
    api_key: Option<String>,
) -> Result<()> {
    if let Some(api_key) = api_key {
        let env_key = if method_id.to_ascii_lowercase().contains("codex") {
            "CODEX_API_KEY"
        } else {
            "OPENAI_API_KEY"
        };
        state.api_key_env = Some((env_key.to_string(), api_key));

        if let Some(existing) = state.conn.take() {
            existing.kill().await?;
        }
        state.initialized = false;
        state.last_init = None;
    }

    let _ = initialize_inner(state).await?;

    let conn = state.conn.as_ref().context("connection missing")?;
    conn.conn
        .authenticate(AuthenticateRequest::new(method_id))
        .await
        .context("authenticate failed")?;

    Ok(())
}

async fn new_session_inner(state: &mut WorkerState, cwd: PathBuf) -> Result<NewSessionResult> {
    let _ = initialize_inner(state).await?;
    let conn = state.conn.as_ref().context("connection missing")?;

    let cwd = resolve_cwd(&cwd)?;
    let session = conn
        .conn
        .new_session(NewSessionRequest::new(cwd))
        .await
        .context("new_session failed")?;

    Ok(NewSessionResult {
        session_id: session.session_id.0.as_ref().to_string(),
        modes: session.modes,
        models: session.models,
        config_options: session.config_options,
    })
}

async fn prompt_inner(
    conn: Arc<AcpConnection>,
    app: AppHandle,
    debug: Arc<DebugState>,
    session_id: String,
    content: String,
) -> Result<PromptResult> {
    let session_id_typed = SessionId::from(session_id.clone());

    let timing = debug.mark_prompt(&session_id);
    debug.emit(
        &app,
        Some(&session_id),
        "prompt_start",
        timing,
        serde_json::json!({ "contentLen": content.len() }),
    );

    let request = PromptRequest::new(
        session_id_typed.clone(),
        vec![agent_client_protocol::ContentBlock::Text(TextContent::new(
            content,
        ))],
    );

    let resp = conn.conn.prompt(request).await.context("prompt failed")?;

    let _ = app.emit(
        crate::codex::events::EVENT_TURN_COMPLETE,
        serde_json::json!({ "sessionId": session_id, "stopReason": resp.stop_reason }),
    );

    let timing = debug.mark_event(&session_id);
    debug.emit(
        &app,
        Some(&session_id),
        "prompt_done",
        timing,
        serde_json::json!({
            "stopReason": serde_json::to_value(&resp.stop_reason).unwrap_or(serde_json::Value::Null),
        }),
    );

    Ok(PromptResult {
        stop_reason: serde_json::to_value(resp.stop_reason).unwrap_or(serde_json::Value::Null),
    })
}

async fn cancel_inner(state: &mut WorkerState, session_id: String) -> Result<()> {
    let _ = initialize_inner(state).await?;
    let conn = state.conn.as_ref().context("connection missing")?;
    conn.conn
        .cancel(CancelNotification::new(SessionId::from(session_id)))
        .await
        .context("cancel failed")?;
    Ok(())
}

async fn set_config_option_inner(
    state: &mut WorkerState,
    session_id: String,
    config_id: String,
    value_id: String,
) -> Result<()> {
    let _ = initialize_inner(state).await?;
    let conn = state.conn.as_ref().context("connection missing")?;
    conn.conn
        .set_session_config_option(SetSessionConfigOptionRequest::new(
            SessionId::from(session_id),
            config_id,
            value_id,
        ))
        .await
        .context("set_session_config_option failed")?;
    Ok(())
}

async fn worker_loop(
    app: AppHandle,
    approvals: Arc<ApprovalState>,
    debug: Arc<DebugState>,
    mut rx: mpsc::UnboundedReceiver<ServiceCommand>,
) {
    let mut state = WorkerState {
        app,
        approvals,
        debug,
        conn: None,
        initialized: false,
        last_init: None,
        api_key_env: None,
    };

    while let Some(cmd) = rx.recv().await {
        match cmd {
            ServiceCommand::Initialize { reply } => {
                let timing = state.debug.mark_global();
                state
                    .debug
                    .emit(&state.app, None, "initialize_start", timing, serde_json::json!({}));

                let start = Instant::now();
                let result = initialize_inner(&mut state).await;
                let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);

                let timing = state.debug.mark_global();
                state.debug.emit(
                    &state.app,
                    None,
                    "initialize_end",
                    timing,
                    serde_json::json!({ "ok": result.is_ok(), "durationMs": duration_ms }),
                );

                let _ = reply.send(result);
            }
            ServiceCommand::Authenticate {
                method_id,
                api_key,
                reply,
            } => {
                let timing = state.debug.mark_global();
                let method_id_label = method_id.clone();
                state.debug.emit(
                    &state.app,
                    None,
                    "authenticate_start",
                    timing,
                    serde_json::json!({ "methodId": method_id_label }),
                );

                let start = Instant::now();
                let result = authenticate_inner(&mut state, method_id, api_key).await;
                let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);

                let timing = state.debug.mark_global();
                state.debug.emit(
                    &state.app,
                    None,
                    "authenticate_end",
                    timing,
                    serde_json::json!({ "ok": result.is_ok(), "durationMs": duration_ms }),
                );

                let _ = reply.send(result);
            }
            ServiceCommand::NewSession { cwd, reply } => {
                let timing = state.debug.mark_global();
                let cwd_label = cwd.display().to_string();
                state.debug.emit(
                    &state.app,
                    None,
                    "new_session_start",
                    timing,
                    serde_json::json!({ "cwd": cwd_label }),
                );

                let start = Instant::now();
                let result = new_session_inner(&mut state, cwd).await;
                let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);

                let timing = state.debug.mark_global();
                state.debug.emit(
                    &state.app,
                    None,
                    "new_session_end",
                    timing,
                    serde_json::json!({ "ok": result.is_ok(), "durationMs": duration_ms }),
                );

                let _ = reply.send(result);
            }
            ServiceCommand::Prompt {
                session_id,
                content,
                reply,
            } => {
                // Ensure Initialize has happened once for this connection, then run prompt in a
                // separate local task so cancellation/config updates can still be processed.
                match initialize_inner(&mut state).await {
                    Ok(_) => {
                        let conn = state
                            .conn
                            .clone()
                            .expect("initialized implies connection exists");
                        let app = state.app.clone();
                        let debug = state.debug.clone();
                        tokio::task::spawn_local(async move {
                            let res = prompt_inner(conn, app, debug, session_id, content).await;
                            let _ = reply.send(res);
                        });
                    }
                    Err(err) => {
                        let _ = reply.send(Err(err));
                    }
                }
            }
            ServiceCommand::Cancel { session_id, reply } => {
                let timing = state.debug.mark_event(&session_id);
                state.debug.emit(
                    &state.app,
                    Some(&session_id),
                    "cancel_start",
                    timing,
                    serde_json::json!({}),
                );

                let start = Instant::now();
                let result = cancel_inner(&mut state, session_id.clone()).await;
                let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);

                let timing = state.debug.mark_event(&session_id);
                state.debug.emit(
                    &state.app,
                    Some(&session_id),
                    "cancel_end",
                    timing,
                    serde_json::json!({ "ok": result.is_ok(), "durationMs": duration_ms }),
                );

                let _ = reply.send(result);
            }
            ServiceCommand::SetConfigOption {
                session_id,
                config_id,
                value_id,
                reply,
            } => {
                let timing = state.debug.mark_event(&session_id);
                let config_id_label = config_id.clone();
                let value_id_label = value_id.clone();
                state.debug.emit(
                    &state.app,
                    Some(&session_id),
                    "set_config_option_start",
                    timing,
                    serde_json::json!({ "configId": config_id_label, "valueId": value_id_label }),
                );

                let start = Instant::now();
                let result =
                    set_config_option_inner(&mut state, session_id.clone(), config_id, value_id)
                        .await;
                let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);

                let timing = state.debug.mark_event(&session_id);
                state.debug.emit(
                    &state.app,
                    Some(&session_id),
                    "set_config_option_end",
                    timing,
                    serde_json::json!({ "ok": result.is_ok(), "durationMs": duration_ms }),
                );

                let _ = reply.send(result);
            }
        }
    }
}
