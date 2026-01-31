# codex-desktop 迁移计划：ACP → codex-core 直接集成

**创建日期**: 2026-01-31  
**目标**: 将 codex-desktop 从基于 codex-acp 子进程的架构迁移到直接集成 codex-core

---

## 一、迁移背景与目标

### 1.1 当前架构（ACP）

```
┌─────────────────────────────────────────────────────────────────────┐
│                         codex-desktop                                │
├─────────────────────────────────────────────────────────────────────┤
│  前端 (React)                                                        │
│  └── useCodexEvents.ts  ← listen('codex:xxx')                       │
├─────────────────────────────────────────────────────────────────────┤
│  Tauri Bridge (Rust)                                                 │
│  ├── commands.rs        → CodexService.xxx()                        │
│  ├── service.rs         → AcpConnection.conn.xxx()                  │
│  ├── protocol.rs        → emit_session_update() → Tauri Events      │
│  └── process.rs         → spawn codex-acp 子进程                    │
├─────────────────────────────────────────────────────────────────────┤
│  codex-acp (子进程)     ← stdin/stdout JSON-RPC                     │
│  └── thread.rs          → EventMsg → SessionUpdate 转换             │
├─────────────────────────────────────────────────────────────────────┤
│  codex-core (内嵌于 codex-acp)                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 目标架构（codex-core 直接集成）

```
┌─────────────────────────────────────────────────────────────────────┐
│                         codex-desktop                                │
├─────────────────────────────────────────────────────────────────────┤
│  前端 (React)                                                        │
│  └── useCodexEvents.ts  ← listen('codex:xxx')   [事件名保持兼容]    │
├─────────────────────────────────────────────────────────────────────┤
│  Tauri Bridge (Rust)                                                 │
│  ├── commands.rs        → CodexCoreService.xxx()                    │
│  ├── core_service.rs    → ThreadManager / CodexThread 直接调用      │
│  └── event_bridge.rs    → EventMsg → Tauri Events                   │
├─────────────────────────────────────────────────────────────────────┤
│  codex-core (直接依赖)                                               │
│  └── ThreadManager, Config, EventMsg, Op                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 迁移核心收益

| 维度 | ACP 架构 | codex-core 直接集成 |
|------|----------|---------------------|
| 事件流 | ⚠️ 部分事件丢失 | ✅ 完整 40+ EventMsg |
| 启动延迟 | ⚠️ 子进程启动开销 | ✅ 直接调用 |
| 维护性 | ⚠️ 两层转换 | ✅ 单一转换层 |
| 远程服务器 | ✅ SSH 支持 | ⚠️ 需后续重新设计 |

> **注**: Token Usage、临时会话、Kill Session 等新功能需迁移完成后单独实现。

---

## 二、文件改动清单

### 2.1 需要删除的文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/codex/process.rs` | 子进程管理，不再需要 |
| `src-tauri/src/codex/binary.rs` | codex-acp 二进制定位，不再需要 |
| `src-tauri/src/codex/unified_process.rs` | 统一进程抽象，不再需要 |
| `codex-acp/` (submodule) | 整个子模块可删除 |

### 2.2 需要重写的文件

| 文件 | 原功能 | 新功能 |
|------|--------|--------|
| `src-tauri/src/codex/service.rs` | ACP 连接管理 | **codex-core 服务层** |
| `src-tauri/src/codex/protocol.rs` | ACP Client impl | **EventMsg 事件桥接** |
| `src-tauri/src/codex/types.rs` | ACP 类型包装 | codex-core 类型包装 |

### 2.3 需要修改的文件

| 文件 | 改动点 |
|------|--------|
| `src-tauri/Cargo.toml` | 依赖替换 |
| `src-tauri/src/codex/commands.rs` | 调用方式调整 |
| `src-tauri/src/codex/events.rs` | 事件常量调整 |
| `src-tauri/src/codex/mod.rs` | 模块导出调整 |

### 2.4 保持不变的文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/codex/debug.rs` | 调试状态管理 |
| `src-tauri/src/codex/thoughts.rs` | 思维过程处理 |
| `src-tauri/src/codex/util.rs` | 工具函数 |
| `src-tauri/src/git/*` | Git 集成 |
| `src-tauri/src/mcp/*` | MCP 管理 |
| `src/` (前端) | React UI |

---

## 三、详细实施步骤

### 阶段 1：依赖切换（估计 2 小时）

#### 1.1 修改 Cargo.toml

```toml
# src-tauri/Cargo.toml

[dependencies]
# === 移除 ===
# agent-client-protocol = { version = "=0.9.3", features = ["unstable"] }

# === 新增 ===
# 方式 A: 本地路径（开发阶段推荐）
codex-core = { path = "../../codex/my-fork-codex/codex-rs/core" }
codex-protocol = { path = "../../codex/my-fork-codex/codex-rs/protocol" }
codex-common = { path = "../../codex/my-fork-codex/codex-rs/common" }

# 方式 B: Git 依赖（发布时使用）
# codex-core = { git = "https://github.com/rita152/codex.git", rev = "7902f1a89" }
# codex-protocol = { git = "https://github.com/rita152/codex.git", rev = "7902f1a89" }

# === 保留 ===
tauri = { version = "2", features = ["macos-private-api"] }
# ... 其他依赖
```

#### 1.2 验证编译

```bash
cd src-tauri
cargo check
```

---

### 阶段 2：创建核心服务层（估计 4 小时）

#### 2.1 创建 `src-tauri/src/codex/core_service.rs`

```rust
//! Direct codex-core integration service.

use anyhow::{Context, Result};
use codex_core::{
    AuthManager, CodexThread, Config, NewThread, ThreadManager,
    protocol::{Event, EventMsg, Op, SessionSource},
};
use codex_protocol::ThreadId;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Arc,
};
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, RwLock};

use crate::codex::{
    debug::DebugState,
    events::*,
    types::{NewSessionResult, PromptResult, ApprovalDecision},
};

/// Session state for a single codex thread.
struct SessionState {
    thread: Arc<CodexThread>,
    thread_id: ThreadId,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

/// Core service managing codex threads directly.
pub struct CodexCoreService {
    app: AppHandle,
    thread_manager: Arc<ThreadManager>,
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    debug: Arc<DebugState>,
    codex_home: PathBuf,
    approvals: Arc<ApprovalState>,
}

impl CodexCoreService {
    /// Create a new CodexCoreService.
    pub async fn new(app: AppHandle) -> Result<Self> {
        let codex_home = dirs::home_dir()
            .context("failed to get home directory")?
            .join(".codex");

        let auth_manager = Arc::new(AuthManager::new());
        let thread_manager = ThreadManager::new(
            codex_home.clone(),
            auth_manager,
            SessionSource::Desktop,
        );

        Ok(Self {
            app,
            thread_manager: Arc::new(thread_manager),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            debug: Arc::new(DebugState::new()),
            codex_home,
            approvals: Arc::new(ApprovalState::default()),
        })
    }

    /// Create a new session with the given working directory.
    pub async fn create_session(&self, cwd: PathBuf) -> Result<NewSessionResult> {
        let config = Config::load_from_home(&self.codex_home)
            .await
            .unwrap_or_default();
        
        let mut config = config;
        config.cwd = cwd;

        let NewThread {
            thread,
            thread_id,
            ..
        } = self.thread_manager
            .start_thread(config)
            .await
            .context("failed to start thread")?;

        let session_id = thread_id.to_string();
        let session_id_clone = session_id.clone();

        // Set up event loop for this session
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let event_thread = thread.clone();
        let event_app = self.app.clone();
        let event_debug = self.debug.clone();
        let event_approvals = self.approvals.clone();

        tokio::spawn(async move {
            Self::event_loop(
                event_app,
                event_debug,
                event_approvals,
                event_thread,
                session_id_clone,
                shutdown_rx,
            ).await;
        });

        // Store session state
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), SessionState {
                thread,
                thread_id,
                shutdown_tx: Some(shutdown_tx),
            });
        }

        Ok(NewSessionResult {
            session_id,
            modes: None,
            models: None,
            config_options: None,
        })
    }

    /// Send a prompt to the session.
    pub async fn send_prompt(
        &self,
        session_id: &str,
        content: String,
    ) -> Result<PromptResult> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .context("session not found")?;

        session.thread
            .submit(Op::UserInput {
                id: None,
                items: vec![codex_protocol::models::ResponseInputItem::Text {
                    text: content,
                }],
                text_elements: None,
            })
            .await
            .context("failed to submit user input")?;

        Ok(PromptResult {
            stop_reason: serde_json::json!("pending"),
        })
    }

    /// Cancel the current turn for a session.
    pub async fn cancel(&self, session_id: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .context("session not found")?;

        session.thread
            .submit(Op::Interrupt)
            .await
            .context("failed to cancel")?;

        Ok(())
    }

    /// Respond to an approval request.
    pub fn respond_approval(
        &self,
        session_id: &str,
        request_id: &str,
        decision: ApprovalDecision,
    ) -> Result<()> {
        self.approvals.respond(session_id, request_id, decision)
    }

    /// Event loop for processing codex events.
    async fn event_loop(
        app: AppHandle,
        debug: Arc<DebugState>,
        approvals: Arc<ApprovalState>,
        thread: Arc<CodexThread>,
        session_id: String,
        mut shutdown_rx: oneshot::Receiver<()>,
    ) {
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    tracing::info!(session_id = %session_id, "event loop shutdown");
                    break;
                }
                event_result = thread.next_event() => {
                    match event_result {
                        Ok(event) => {
                            Self::handle_event(&app, &debug, &approvals, &session_id, event).await;
                        }
                        Err(e) => {
                            tracing::error!(error = %e, "event loop error");
                            let _ = app.emit(EVENT_ERROR, serde_json::json!({
                                "sessionId": session_id,
                                "error": e.to_string(),
                            }));
                            break;
                        }
                    }
                }
            }
        }
    }

    async fn handle_event(
        app: &AppHandle,
        debug: &DebugState,
        approvals: &ApprovalState,
        session_id: &str,
        event: Event,
    ) {
        use crate::codex::event_bridge::emit_codex_event;
        emit_codex_event(app, debug, approvals, session_id, &event.msg).await;
    }
}

/// Approval state management.
pub struct ApprovalState {
    pending: std::sync::Mutex<HashMap<(String, String), oneshot::Sender<ApprovalDecision>>>,
}

impl Default for ApprovalState {
    fn default() -> Self {
        Self {
            pending: std::sync::Mutex::new(HashMap::new()),
        }
    }
}

impl ApprovalState {
    pub fn insert(
        &self,
        session_id: &str,
        request_id: &str,
        tx: oneshot::Sender<ApprovalDecision>,
    ) {
        let mut guard = self.pending.lock().unwrap();
        guard.insert((session_id.to_string(), request_id.to_string()), tx);
    }

    pub fn respond(
        &self,
        session_id: &str,
        request_id: &str,
        decision: ApprovalDecision,
    ) -> Result<()> {
        let mut guard = self.pending.lock().unwrap();
        if let Some(tx) = guard.remove(&(session_id.to_string(), request_id.to_string())) {
            let _ = tx.send(decision);
        }
        Ok(())
    }
}
```

#### 2.2 创建 `src-tauri/src/codex/event_bridge.rs`

```rust
//! Bridge between codex-core EventMsg and Tauri events.

use codex_core::protocol::EventMsg;
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::codex::{
    debug::DebugState,
    events::*,
    core_service::ApprovalState,
};

/// Emit a codex event to the frontend.
pub async fn emit_codex_event(
    app: &AppHandle,
    debug: &DebugState,
    _approvals: &ApprovalState,
    session_id: &str,
    event: &EventMsg,
) {
    match event {
        // === 消息事件 ===
        EventMsg::AgentMessage(msg) => {
            let timing = debug.mark_event(session_id);
            debug.emit(app, Some(session_id), "agent_message", timing, json!({}));
            let _ = app.emit(EVENT_MESSAGE_CHUNK, json!({
                "sessionId": session_id,
                "text": &msg.message,
            }));
        }

        EventMsg::AgentMessageContentDelta(delta) => {
            let _ = app.emit(EVENT_MESSAGE_CHUNK, json!({
                "sessionId": session_id,
                "text": &delta.delta,
            }));
        }

        // === 推理事件 ===
        EventMsg::AgentReasoning(reasoning) => {
            let _ = app.emit(EVENT_THOUGHT_CHUNK, json!({
                "sessionId": session_id,
                "text": &reasoning.text,
            }));
        }

        EventMsg::ReasoningContentDelta(delta) => {
            let _ = app.emit(EVENT_THOUGHT_CHUNK, json!({
                "sessionId": session_id,
                "text": &delta.delta,
            }));
        }

        // === 命令执行事件 ===
        EventMsg::ExecCommandBegin(begin) => {
            let _ = app.emit(EVENT_TOOL_CALL, json!({
                "sessionId": session_id,
                "toolCallId": &begin.call_id,
                "title": format!("exec: {:?}", begin.command),
                "kind": "command",
                "status": "running",
            }));
        }

        EventMsg::ExecCommandOutputDelta(delta) => {
            let _ = app.emit(EVENT_TOOL_CALL_UPDATE, json!({
                "sessionId": session_id,
                "toolCallId": &delta.call_id,
                "output": &delta.delta,
            }));
        }

        EventMsg::ExecCommandEnd(end) => {
            let _ = app.emit(EVENT_TOOL_CALL_UPDATE, json!({
                "sessionId": session_id,
                "toolCallId": &end.call_id,
                "status": if end.exit_code == 0 { "completed" } else { "failed" },
                "exitCode": end.exit_code,
            }));
        }

        // === Patch 事件 ===
        EventMsg::PatchApplyBegin(begin) => {
            let _ = app.emit(EVENT_TOOL_CALL, json!({
                "sessionId": session_id,
                "toolCallId": &begin.call_id,
                "title": "Apply Patch",
                "kind": "patch",
                "status": "running",
                "changes": &begin.changes,
            }));
        }

        EventMsg::PatchApplyEnd(end) => {
            let _ = app.emit(EVENT_TOOL_CALL_UPDATE, json!({
                "sessionId": session_id,
                "toolCallId": &end.call_id,
                "status": if end.success { "completed" } else { "failed" },
            }));
        }

        // === 审批事件 ===
        EventMsg::ExecApprovalRequest(req) => {
            let _ = app.emit(EVENT_APPROVAL_REQUEST, json!({
                "sessionId": session_id,
                "requestId": &req.call_id,
                "type": "exec",
                "command": &req.command,
                "reason": &req.reason,
            }));
        }

        EventMsg::ApplyPatchApprovalRequest(req) => {
            let _ = app.emit(EVENT_APPROVAL_REQUEST, json!({
                "sessionId": session_id,
                "requestId": &req.call_id,
                "type": "patch",
                "changes": &req.changes,
                "reason": &req.reason,
            }));
        }

        // === Turn 完成 ===
        EventMsg::TurnComplete(complete) => {
            let _ = app.emit(EVENT_TURN_COMPLETE, json!({
                "sessionId": session_id,
                "stopReason": "end_turn",
                "lastMessage": &complete.last_agent_message,
            }));
        }

        EventMsg::TurnAborted(aborted) => {
            let _ = app.emit(EVENT_TURN_COMPLETE, json!({
                "sessionId": session_id,
                "stopReason": "cancelled",
                "reason": format!("{:?}", aborted.reason),
            }));
        }

        // === 计划事件 ===
        EventMsg::PlanUpdate(plan) => {
            let _ = app.emit(EVENT_PLAN, json!({
                "sessionId": session_id,
                "explanation": &plan.explanation,
                "plan": &plan.plan,
            }));
        }

        // === MCP 事件 ===
        EventMsg::McpToolCallBegin(begin) => {
            let _ = app.emit(EVENT_TOOL_CALL, json!({
                "sessionId": session_id,
                "toolCallId": &begin.call_id,
                "title": format!("MCP: {} - {}", begin.invocation.server, begin.invocation.tool),
                "kind": "mcp",
                "status": "running",
            }));
        }

        EventMsg::McpToolCallEnd(end) => {
            let _ = app.emit(EVENT_TOOL_CALL_UPDATE, json!({
                "sessionId": session_id,
                "toolCallId": &end.call_id,
                "status": "completed",
                "duration": end.duration.map(|d| d.as_millis()),
            }));
        }

        // === 错误事件 ===
        EventMsg::Error(err) => {
            let _ = app.emit(EVENT_ERROR, json!({
                "sessionId": session_id,
                "message": &err.message,
                "errorInfo": &err.codex_error_info,
            }));
        }

        EventMsg::StreamError(err) => {
            let _ = app.emit(EVENT_ERROR, json!({
                "sessionId": session_id,
                "message": &err.message,
                "errorInfo": &err.codex_error_info,
            }));
        }

        // === 其他事件（暂时忽略）===
        _ => {
            tracing::trace!(event = ?event, "unhandled event");
        }
    }
}
```

---

### 阶段 3：更新命令层（估计 2 小时）

#### 3.1 修改 `src-tauri/src/codex/commands.rs`

```rust
//! Tauri command handlers for Codex interactions.

use crate::codex::core_service::CodexCoreService;
use crate::codex::types::{ApprovalDecision, NewSessionResult, PromptResult};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::OnceCell;

/// Tauri state wrapper for the Codex service.
pub struct CodexManager {
    service: OnceCell<Arc<CodexCoreService>>,
}

impl Default for CodexManager {
    fn default() -> Self {
        Self {
            service: OnceCell::new(),
        }
    }
}

impl CodexManager {
    async fn get_or_create(&self, app: AppHandle) -> anyhow::Result<Arc<CodexCoreService>> {
        self.service
            .get_or_try_init(|| async {
                let svc = CodexCoreService::new(app).await?;
                Ok(Arc::new(svc))
            })
            .await
            .cloned()
    }

    fn get(&self) -> Option<Arc<CodexCoreService>> {
        self.service.get().cloned()
    }
}

/// Initialize the Codex backend.
#[tauri::command]
pub async fn codex_init(
    app: AppHandle,
    state: State<'_, CodexManager>,
) -> Result<serde_json::Value, String> {
    state.get_or_create(app).await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "status": "initialized",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Create a new session.
#[tauri::command]
pub async fn codex_new_session(
    state: State<'_, CodexManager>,
    cwd: String,
) -> Result<NewSessionResult, String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;
    svc.create_session(PathBuf::from(cwd))
        .await
        .map_err(|e| e.to_string())
}

/// Send a prompt to the session.
#[tauri::command]
pub async fn codex_prompt(
    state: State<'_, CodexManager>,
    session_id: String,
    content: String,
) -> Result<PromptResult, String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;
    svc.send_prompt(&session_id, content)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel the current turn.
#[tauri::command]
pub async fn codex_cancel(
    state: State<'_, CodexManager>,
    session_id: String,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;
    svc.cancel(&session_id).await.map_err(|e| e.to_string())
}

/// Respond to an approval request.
#[tauri::command]
pub async fn codex_approve(
    state: State<'_, CodexManager>,
    session_id: String,
    request_id: String,
    decision: ApprovalDecision,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;
    svc.respond_approval(&session_id, &request_id, decision)
        .map_err(|e| e.to_string())
}

// 保留其他现有命令（list_local_directory 等）
```

---

### 阶段 4：更新事件常量（估计 30 分钟）

#### 4.1 修改 `src-tauri/src/codex/events.rs`

```rust
//! Event names emitted from the Codex backend.

// === 消息事件 ===
pub const EVENT_MESSAGE_CHUNK: &str = "codex:message";
pub const EVENT_THOUGHT_CHUNK: &str = "codex:thought";

// === 工具调用事件 ===
pub const EVENT_TOOL_CALL: &str = "codex:tool-call";
pub const EVENT_TOOL_CALL_UPDATE: &str = "codex:tool-call-update";

// === 审批事件 ===
pub const EVENT_APPROVAL_REQUEST: &str = "codex:approval-request";

// === 计划事件 ===
pub const EVENT_PLAN: &str = "codex:plan";

// === 配置事件 ===
pub const EVENT_AVAILABLE_COMMANDS: &str = "codex:available-commands";
pub const EVENT_CURRENT_MODE: &str = "codex:current-mode";
pub const EVENT_CONFIG_OPTION_UPDATE: &str = "codex:config-option-update";

// === 状态事件 ===
pub const EVENT_TURN_COMPLETE: &str = "codex:turn-complete";
pub const EVENT_ERROR: &str = "codex:error";

// === 调试事件 ===
pub const EVENT_DEBUG: &str = "codex:debug";
```

---

### 阶段 5：更新类型定义（估计 30 分钟）

#### 5.1 修改 `src-tauri/src/codex/types.rs`

```rust
//! Serde-friendly data types used between backend and frontend.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ApprovalDecision {
    AllowAlways,
    AllowOnce,
    RejectAlways,
    RejectOnce,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSessionResult {
    pub session_id: String,
    pub modes: Option<serde_json::Value>,
    pub models: Option<serde_json::Value>,
    pub config_options: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptResult {
    pub stop_reason: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCliConfigInfo {
    pub codex_home: String,
    pub config_path: String,
    pub config_found: bool,
    pub model_provider: Option<String>,
    pub base_url: Option<String>,
    pub env_key: Option<String>,
    pub auth_file_found: bool,
}
```

---

### 阶段 6：更新模块导出（估计 30 分钟）

#### 6.1 修改 `src-tauri/src/codex/mod.rs`

```rust
//! Core Codex backend modules.

pub mod commands;
pub mod core_service;
pub mod debug;
pub mod event_bridge;
pub mod events;
pub mod thoughts;
pub mod types;
pub mod util;

// 删除以下模块引用：
// pub mod binary;
// pub mod process;
// pub mod protocol;
// pub mod unified_process;
// pub mod remote_session;
```

---

### 阶段 7：清理旧代码（估计 1 小时）

#### 7.1 删除文件

```bash
cd src-tauri/src/codex

# 删除 ACP 相关文件
rm -f binary.rs
rm -f process.rs
rm -f protocol.rs
rm -f unified_process.rs
rm -f service.rs  # 被 core_service.rs 替代
```

#### 7.2 删除 submodule

```bash
cd /Users/zp/Desktop/codex-desktop

# 删除 codex-acp submodule
git submodule deinit -f codex-acp
git rm -f codex-acp
rm -rf .git/modules/codex-acp
```

---

## 四、测试计划

### 4.1 核心功能测试

| 测试场景 | 验证点 |
|----------|--------|
| 基本对话 | 消息发送、接收、流式显示 |
| 命令执行 | 工具调用、输出流、完成状态 |
| 审批流程 | 请求显示、用户响应、继续执行 |
| 取消操作 | 中断当前 turn |

### 4.2 回归测试

| 测试项 | 说明 |
|--------|------|
| 现有事件兼容 | 前端无需修改即可接收事件 |
| 命令兼容 | API 调用签名保持不变 |

---

## 五、回滚计划

如果迁移过程中遇到阻塞问题：

1. **Git 回滚**
   ```bash
   git checkout HEAD~n -- src-tauri/
   ```

2. **恢复 submodule**
   ```bash
   git submodule add https://github.com/zed-industries/codex.git codex-acp
   ```

3. **恢复依赖**
   ```toml
   # Cargo.toml
   agent-client-protocol = { version = "=0.9.3", features = ["unstable"] }
   ```

---

## 六、里程碑

| 阶段 | 任务 | 估计时间 | 状态 |
|------|------|----------|------|
| 1 | 依赖切换 | 2h | ⬜ |
| 2 | 核心服务层 | 4h | ⬜ |
| 3 | 命令层更新 | 2h | ⬜ |
| 4 | 事件常量更新 | 0.5h | ⬜ |
| 5 | 类型定义更新 | 0.5h | ⬜ |
| 6 | 模块导出更新 | 0.5h | ⬜ |
| 7 | 清理旧代码 | 1h | ⬜ |
| 8 | 测试 & 修复 | 4h | ⬜ |
| **总计** | | **~14h** | |

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| codex-core API 变化 | 编译失败 | 锁定特定 commit |
| 事件映射遗漏 | 功能缺失 | 对照 TUI 实现逐一检查 |
| 远程服务器支持丢失 | 功能回退 | 明确标注，后续单独实现 |

---

## 八、迁移完成后可扩展功能

以下功能在迁移完成后可单独实现：

1. **Token Usage** - 监听 `EventMsg::TokenCount`，前端显示用量
2. **临时会话** - 配置 `config.ephemeral = true`
3. **Kill Session** - 调用 `remove_thread()` 完全销毁会话
4. **远程服务器** - 基于 codex-core 重新设计 SSH 会话
