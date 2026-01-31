# codex-desktop 迁移计划：ACP → codex-core 直接集成

**创建日期**: 2026-01-31  
**最后更新**: 2026-01-31 (迁移完成)  
**状态**: ✅ 迁移完成 - 所有测试通过，ACP 已移除，codex-core 直接集成

---

## 零、已完成：项目结构迁移

### 新项目结构

```
codex-desktop/
├── src-tauri -> codex-upstream/codex-rs/desktop  (symlink)
├── codex-upstream/
│   └── codex-rs/
│       ├── Cargo.toml          # workspace，包含 desktop 成员
│       ├── core/               # codex-core
│       ├── protocol/           # codex-protocol
│       ├── common/             # codex-common
│       └── desktop/            # 原 src-tauri（实际位置）
│           └── Cargo.toml      # 使用 workspace = true
└── src/                        # 前端代码（不变）
```

### 关键配置

**codex-upstream/codex-rs/Cargo.toml** (workspace):
```toml
[workspace]
members = [
    # ... 原有成员 ...
    "desktop",  # 新增
]
```

**desktop/Cargo.toml**:
```toml
[dependencies]
# 现在可以使用 workspace 依赖
codex-core = { workspace = true }
codex-protocol = { workspace = true }
codex-common = { workspace = true }

# 保留 ACP 用于渐进迁移
agent-client-protocol = { version = "=0.9.3", features = ["unstable"] }
```

### 编译验证

```bash
# ✅ Release 编译成功 (5分22秒)
cd codex-upstream/codex-rs && cargo build -p codex-desktop --release

# ✅ 开发模式可用
cd codex-desktop && npx tauri dev
```

---

## 一、可行性深度分析

### 1.1 API 验证结果

| 计划中的 API | 实际 API | 状态 |
|-------------|----------|------|
| `Config::load_from_home()` | 不存在 | ❌ 需修正 |
| `AuthManager::new()` | `AuthManager::new(codex_home, enable_env, store_mode)` | ❌ 需修正 |
| `ThreadManager::new(home, auth, source)` | ✅ 正确 | ✅ |
| `thread_manager.start_thread(config)` | ✅ 返回 `NewThread` | ✅ |
| `thread.submit(Op::UserInput { items, .. })` | ✅ 正确 | ✅ |
| `thread.next_event()` | ✅ 返回 `Event { id, msg }` | ✅ |
| `thread_manager.remove_thread(&id)` | ✅ 正确 | ✅ |
| `config.ephemeral` | ✅ 存在，默认 `false` | ✅ |
| `Op::Interrupt` | ✅ 正确 | ✅ |
| `Op::ExecApproval` / `Op::PatchApproval` | ✅ 正确 | ✅ |

### 1.2 关键修正点

#### 修正 1: Config 加载

**错误写法**:
```rust
let config = Config::load_from_home(&self.codex_home).await.unwrap_or_default();
// 或
let config = Config::load_from_base_config_with_overrides(...); // 这是 #[cfg(test)] 方法！
```

**正确写法**:
```rust
use codex_core::config::{Config, ConfigBuilder, ConfigOverrides};

// 方式 A: 使用 ConfigBuilder（推荐）
let config = ConfigBuilder::default()
    .codex_home(codex_home.clone())
    .harness_overrides(ConfigOverrides {
        cwd: Some(cwd),
        ephemeral: Some(ephemeral),
        ..Default::default()
    })
    .build()
    .await?;

// 方式 B: 使用 CLI overrides（适用于命令行参数场景）
let config = Config::load_with_cli_overrides(vec![]).await?;
```

**注意**: `Config::load_from_base_config_with_overrides` 是 `#[cfg(test)]` 方法，仅供测试使用，生产代码必须使用 `ConfigBuilder`。

#### 修正 2: AuthManager 初始化

**错误写法**:
```rust
let auth_manager = Arc::new(AuthManager::new());
```

**正确写法**:
```rust
use codex_core::auth::{AuthManager, AuthCredentialsStoreMode};

let auth_manager = AuthManager::shared(
    codex_home.clone(),
    false,  // enable_codex_api_key_env
    AuthCredentialsStoreMode::File,  // 或从 config 获取
);
```

#### 修正 3: UserInput 格式

**错误写法**:
```rust
Op::UserInput {
    id: None,
    items: vec![codex_protocol::models::ResponseInputItem::Text { text }],
    text_elements: None,
}
```

**正确写法**:
```rust
use codex_core::protocol::{Op, UserInput};

Op::UserInput {
    items: vec![UserInput::Text {
        text: content,
        text_elements: vec![],
    }],
    final_output_json_schema: None,
}
```

#### 修正 4: SessionSource

**错误写法**:
```rust
SessionSource::Desktop  // 不存在
```

**正确写法**:
```rust
use codex_core::protocol::SessionSource;

// 推荐使用 Exec（程序化调用场景）
SessionSource::Exec

// 可用的枚举值：Cli, VSCode, Exec, Mcp, SubAgent, Unknown
```

### 1.3 结论

**迁移方案可行**，但计划中的代码示例需要按照上述修正进行调整。核心 API（`ThreadManager`, `CodexThread`, `EventMsg`, `Op`）都存在且符合预期。

---

## 二、修正后的架构设计

### 2.1 当前架构（ACP）

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

### 2.2 目标架构（codex-core 直接集成）

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

---

## 三、文件改动清单

### 3.1 需要删除的文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/codex/process.rs` | 子进程管理 |
| `src-tauri/src/codex/binary.rs` | codex-acp 二进制定位 |
| `src-tauri/src/codex/unified_process.rs` | 统一进程抽象 |
| `codex-acp/` (submodule) | 整个子模块 |

### 3.2 需要重写的文件

| 文件 | 原功能 | 新功能 |
|------|--------|--------|
| `src-tauri/src/codex/service.rs` | ACP 连接管理 | **core_service.rs** |
| `src-tauri/src/codex/protocol.rs` | ACP Client impl | **event_bridge.rs** |

### 3.3 需要修改的文件

| 文件 | 改动点 |
|------|--------|
| `src-tauri/Cargo.toml` | 依赖替换 |
| `src-tauri/src/codex/commands.rs` | 调用方式调整 |
| `src-tauri/src/codex/events.rs` | 事件常量调整 |
| `src-tauri/src/codex/mod.rs` | 模块导出调整 |
| `src-tauri/src/codex/types.rs` | 类型定义调整 |

---

## 四、详细实施步骤

### 阶段 1：依赖切换（2h）

#### 1.1 修改 Cargo.toml

```toml
# src-tauri/Cargo.toml

[dependencies]
# === 移除 ===
# agent-client-protocol = { version = "=0.9.3", features = ["unstable"] }

# === 新增 ===
# 开发阶段使用本地路径
codex-core = { path = "../../codex/my-fork-codex/codex-rs/core" }
codex-protocol = { path = "../../codex/my-fork-codex/codex-rs/protocol" }

# === 保留 ===
tauri = { version = "2", features = ["macos-private-api"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
tracing = "0.1"
```

#### 1.2 验证编译

```bash
cd src-tauri
cargo check 2>&1 | head -50
```

---

### 阶段 2：核心服务层（4h）

#### 2.1 创建 `src-tauri/src/codex/core_service.rs`

```rust
//! Direct codex-core integration service.

use anyhow::{Context, Result};
use codex_core::{
    AuthManager, CodexThread, NewThread, ThreadManager,
    auth::AuthCredentialsStoreMode,
    config::{Config, ConfigBuilder, ConfigOverrides},
    protocol::{Event, EventMsg, Op, SessionSource, UserInput},
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
    types::{ApprovalDecision, NewSessionResult, PromptResult},
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

        // Initialize AuthManager with proper parameters
        let auth_manager = AuthManager::shared(
            codex_home.clone(),
            false,  // enable_codex_api_key_env - let config control this
            AuthCredentialsStoreMode::File,
        );

        let thread_manager = ThreadManager::new(
            codex_home.clone(),
            auth_manager,
            SessionSource::Exec,  // Desktop is a programmatic caller
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
    pub async fn create_session(
        &self,
        cwd: PathBuf,
        ephemeral: bool,
    ) -> Result<NewSessionResult> {
        // Build config using ConfigBuilder (NOT load_from_base_config_with_overrides which is test-only)
        let config = ConfigBuilder::default()
            .codex_home(self.codex_home.clone())
            .harness_overrides(ConfigOverrides {
                cwd: Some(cwd.clone()),
                ephemeral: Some(ephemeral),
                ..Default::default()
            })
            .build()
            .await
            .context("failed to load config")?;

        let NewThread {
            thread,
            thread_id,
            session_configured,
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
            // Extract from session_configured if needed
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

        // Use correct UserInput format
        session.thread
            .submit(Op::UserInput {
                items: vec![UserInput::Text {
                    text: content,
                    text_elements: vec![],
                }],
                final_output_json_schema: None,
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

    /// Kill and remove a session completely.
    pub async fn kill_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(mut session) = sessions.remove(session_id) {
            // Signal event loop to stop
            if let Some(tx) = session.shutdown_tx.take() {
                let _ = tx.send(());
            }
            // Shutdown the thread
            let _ = session.thread.submit(Op::Shutdown).await;
            // Remove from manager
            self.thread_manager.remove_thread(&session.thread_id).await;
        }
        Ok(())
    }

    /// Respond to an exec approval request.
    pub async fn respond_exec_approval(
        &self,
        session_id: &str,
        request_id: &str,
        decision: ApprovalDecision,
    ) -> Result<()> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .context("session not found")?;

        let review_decision = match decision {
            ApprovalDecision::AllowOnce => codex_core::protocol::ReviewDecision::Approved,
            ApprovalDecision::AllowAlways => codex_core::protocol::ReviewDecision::ApprovedForSession,
            ApprovalDecision::RejectOnce | ApprovalDecision::RejectAlways => {
                codex_core::protocol::ReviewDecision::Rejected
            }
        };

        session.thread
            .submit(Op::ExecApproval {
                id: request_id.to_string(),
                decision: review_decision,
            })
            .await
            .context("failed to submit approval")?;

        Ok(())
    }

    /// Respond to a patch approval request.
    pub async fn respond_patch_approval(
        &self,
        session_id: &str,
        request_id: &str,
        decision: ApprovalDecision,
    ) -> Result<()> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .context("session not found")?;

        let review_decision = match decision {
            ApprovalDecision::AllowOnce => codex_core::protocol::ReviewDecision::Approved,
            ApprovalDecision::AllowAlways => codex_core::protocol::ReviewDecision::ApprovedForSession,
            ApprovalDecision::RejectOnce | ApprovalDecision::RejectAlways => {
                codex_core::protocol::ReviewDecision::Rejected
            }
        };

        session.thread
            .submit(Op::PatchApproval {
                id: request_id.to_string(),
                decision: review_decision,
            })
            .await
            .context("failed to submit approval")?;

        Ok(())
    }

    /// Event loop for processing codex events.
    async fn event_loop(
        app: AppHandle,
        debug: Arc<DebugState>,
        _approvals: Arc<ApprovalState>,
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
                            Self::handle_event(&app, &debug, &session_id, event).await;
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
        session_id: &str,
        event: Event,
    ) {
        use crate::codex::event_bridge::emit_codex_event;
        emit_codex_event(app, debug, session_id, &event.msg).await;
    }
}

/// Approval state management (for future async approval flow).
#[derive(Default)]
pub struct ApprovalState {
    // Can be extended for async approval handling if needed
}
```

#### 2.2 创建 `src-tauri/src/codex/event_bridge.rs`

```rust
//! Bridge between codex-core EventMsg and Tauri events.

use codex_core::protocol::EventMsg;
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::codex::{debug::DebugState, events::*};

/// Emit a codex event to the frontend.
pub async fn emit_codex_event(
    app: &AppHandle,
    debug: &DebugState,
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

        // === 审批请求事件 ===
        EventMsg::ExecApprovalRequest(req) => {
            let _ = app.emit(EVENT_APPROVAL_REQUEST, json!({
                "sessionId": session_id,
                "requestId": &req.call_id,
                "type": "exec",
                "command": &req.parsed_cmd,
                "cwd": &req.cwd,
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

        // === Patch 事件 ===
        EventMsg::PatchApplyBegin(begin) => {
            let _ = app.emit(EVENT_TOOL_CALL, json!({
                "sessionId": session_id,
                "toolCallId": &begin.call_id,
                "title": "Apply Patch",
                "kind": "patch",
                "status": "running",
                "autoApproved": begin.auto_approved,
            }));
        }

        EventMsg::PatchApplyEnd(end) => {
            let _ = app.emit(EVENT_TOOL_CALL_UPDATE, json!({
                "sessionId": session_id,
                "toolCallId": &end.call_id,
                "status": if end.success { "completed" } else { "failed" },
            }));
        }

        // === Token 使用 ===
        EventMsg::TokenCount(info) => {
            let _ = app.emit(EVENT_TOKEN_USAGE, json!({
                "sessionId": session_id,
                "info": &info.info,
                "rateLimits": &info.rate_limits,
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

        EventMsg::TurnStarted(_) => {
            let timing = debug.mark_event(session_id);
            debug.emit(app, Some(session_id), "turn_started", timing, json!({}));
        }

        // === 计划事件 ===
        EventMsg::PlanUpdate(plan) => {
            let _ = app.emit(EVENT_PLAN, json!({
                "sessionId": session_id,
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

        // === Web 搜索事件 ===
        EventMsg::WebSearchBegin(begin) => {
            let _ = app.emit(EVENT_TOOL_CALL, json!({
                "sessionId": session_id,
                "toolCallId": &begin.call_id,
                "title": "Web Search",
                "kind": "web_search",
                "status": "running",
            }));
        }

        EventMsg::WebSearchEnd(end) => {
            let _ = app.emit(EVENT_TOOL_CALL_UPDATE, json!({
                "sessionId": session_id,
                "toolCallId": &end.call_id,
                "status": "completed",
                "query": &end.query,
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
                "retrying": true,
            }));
        }

        EventMsg::Warning(warn) => {
            let _ = app.emit(EVENT_ERROR, json!({
                "sessionId": session_id,
                "message": &warn.message,
                "isWarning": true,
            }));
        }

        // === 上下文压缩事件 ===
        EventMsg::ContextCompacted(event) => {
            let _ = app.emit("codex:context-compacted", json!({
                "sessionId": session_id,
                "summary": &event.summary,
            }));
        }

        // === MCP 启动事件 ===
        EventMsg::McpStartupUpdate(update) => {
            let _ = app.emit("codex:mcp-startup-update", json!({
                "sessionId": session_id,
                "serverName": &update.server_name,
                "status": format!("{:?}", update.status),
            }));
        }

        EventMsg::McpStartupComplete(complete) => {
            let _ = app.emit("codex:mcp-startup-complete", json!({
                "sessionId": session_id,
                "results": &complete.results,
            }));
        }

        // === Session 配置事件 ===
        EventMsg::SessionConfigured(config) => {
            let timing = debug.mark_event(session_id);
            debug.emit(app, Some(session_id), "session_configured", timing, json!({
                "model": &config.model,
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

### 阶段 3：命令层更新（1h）

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

#[tauri::command]
pub async fn codex_new_session(
    state: State<'_, CodexManager>,
    cwd: String,
    ephemeral: Option<bool>,
) -> Result<NewSessionResult, String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;
    svc.create_session(PathBuf::from(cwd), ephemeral.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

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

#[tauri::command]
pub async fn codex_kill_session(
    state: State<'_, CodexManager>,
    session_id: String,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;
    svc.kill_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn codex_approve(
    state: State<'_, CodexManager>,
    session_id: String,
    request_id: String,
    approval_type: String,  // "exec" or "patch"
    decision: ApprovalDecision,
) -> Result<(), String> {
    let svc = state
        .get()
        .ok_or_else(|| "codex service not initialized".to_string())?;

    match approval_type.as_str() {
        "exec" => svc.respond_exec_approval(&session_id, &request_id, decision).await,
        "patch" => svc.respond_patch_approval(&session_id, &request_id, decision).await,
        _ => Err(anyhow::anyhow!("unknown approval type: {}", approval_type)),
    }
    .map_err(|e| e.to_string())
}
```

---

### 阶段 4-6：事件、类型、模块更新（1h）

见原计划，API 已在上述代码中修正。

---

### 阶段 7：清理旧代码（1h）

```bash
cd src-tauri/src/codex

# 删除 ACP 相关文件
rm -f binary.rs process.rs protocol.rs unified_process.rs service.rs

# 重命名新文件
# core_service.rs 和 event_bridge.rs 已是新文件
```

---

## 五、测试计划

| 测试场景 | 验证点 |
|----------|--------|
| 基本对话 | 消息发送、接收、流式显示 |
| 命令执行 | 审批请求 → 用户响应 → 执行 → 输出 |
| Patch 应用 | 审批请求 → 用户响应 → 应用 → 结果 |
| Token 用量 | TokenCount 事件 → 前端显示 |
| 临时会话 | ephemeral=true → 无磁盘写入 |
| Kill 会话 | 资源清理、事件循环停止 |
| 取消操作 | Interrupt → TurnAborted |

---

## 六、里程碑

| 阶段 | 任务 | 时间 | 状态 |
|------|------|------|------|
| 1 | 依赖切换 | 2h | ✅ 完成 |
| 2 | 核心服务层 | 4h | ✅ 完成 |
| 3 | 命令层更新 | 1h | ✅ 完成 |
| 4-6 | 事件/类型/模块 | 1h | ✅ 完成 |
| 7 | 清理旧代码 | 1h | ✅ 完成 |
| 8 | 测试 & 修复 | 4h | ✅ 完成 |
| **总计** | | **~13h** | |

---

## 七、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| codex-core API 变化 | 锁定特定 git commit |
| Config 加载复杂 | 参考 codex-acp 实现 |
| 审批流程差异 | 直接发送 Op::XxxApproval |
| 远程服务器丢失 | 明确标注，后续重新设计 |

---

## 八、迁移后新增能力

| 功能 | 实现方式 |
|------|----------|
| Token Usage | 监听 `EventMsg::TokenCount` |
| 临时会话 | `ConfigOverrides { ephemeral: Some(true), .. }` |
| Kill Session | `thread_manager.remove_thread()` |
| 完整事件流 | 直接处理 40+ `EventMsg` 变体 |

---

## 九、API 验证结果 (2026-01-31)

### 已验证通过

| API | 状态 | 说明 |
|-----|------|------|
| `ThreadManager::new(codex_home, auth_manager, session_source)` | ✅ | 正确 |
| `AuthManager::shared(codex_home, enable_env, store_mode)` | ✅ | 返回 `Arc<Self>` |
| `ConfigBuilder::default().codex_home().harness_overrides().build().await` | ✅ | 生产代码使用 |
| `CodexThread.submit(Op::...)` | ✅ | 返回 `CodexResult<String>` |
| `CodexThread.next_event()` | ✅ | 返回 `CodexResult<Event>` |
| `Op::UserInput { items, final_output_json_schema }` | ✅ | 正确 |
| `Op::Interrupt` | ✅ | 正确 |
| `Op::ExecApproval { id, decision }` | ✅ | 正确 |
| `Op::PatchApproval { id, decision }` | ✅ | 正确 |
| `Op::Shutdown` | ✅ | 正确 |
| `SessionSource::Exec` | ✅ | 推荐用于 Desktop |
| `Config.ephemeral: bool` | ✅ | 通过 `ConfigOverrides` 设置 |

### 关键修正点

1. **Config 加载**: `load_from_base_config_with_overrides` 是 `#[cfg(test)]` 方法，生产代码必须使用 `ConfigBuilder`
2. **SessionSource**: 使用 `SessionSource::Exec` 而非 `Unknown`
3. **EventMsg 映射**: v2 格式（`AgentMessageContentDelta`）会自动转换为 v1 格式（`AgentMessageDelta`）
