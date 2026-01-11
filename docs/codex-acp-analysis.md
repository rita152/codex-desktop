# Codex-ACP 项目深度分析

## 概述

`codex-acp` 是由 Zed 团队开发的 **ACP (Agent Client Protocol) 适配器**，用于将 OpenAI 的 Codex CLI 集成到支持 ACP 协议的客户端中（如 Zed 编辑器）。

- **版本**: 0.8.2
- **许可证**: Apache-2.0
- **仓库**: https://github.com/zed-industries/codex-acp

---

## 架构设计

```
┌─────────────────────┐     ACP Protocol (stdio)     ┌──────────────────────┐
│   ACP 客户端        │ ◄────────────────────────►   │     codex-acp        │
│   (Zed, 其他)       │                              │     (Rust 二进制)    │
└─────────────────────┘                              └──────────┬───────────┘
                                                                │
                                                     ┌──────────▼───────────┐
                                                     │     codex-core       │
                                                     │   (Codex CLI 核心)   │
                                                     └──────────────────────┘
```

## 代码级实现剖析（从调用链到状态机）

这一节专门回答“`codex-acp` 到底如何把 **ACP 的会话/请求** 转成 **Codex 的线程/事件**”，重点以代码为准（以 `codex-acp` 0.8.2 为例）。

### 1) 进程启动与 stdio 协议约束

- 入口在 `codex-acp/src/main.rs`：只负责解析 `codex_common::CliConfigOverrides`（例如 `-c key=value`）并调用 `codex_acp::run_main(...)`。
- 主逻辑在 `codex-acp/src/lib.rs`：
  - 初始化 `tracing_subscriber`，强制把日志写到 `stderr`。
  - 通过 `Config::load_with_cli_overrides_and_harness_overrides(...)` 装配最终 `Config`（CLI 覆盖 + “harness overrides”，例如 `codex_linux_sandbox_exe`）。
  - 创建 `agent_client_protocol::AgentSideConnection`，绑定 `stdin/stdout`，并用 `tokio::task::LocalSet` + `spawn_local` 运行 I/O 任务。
- 为了避免污染 ACP 的 stdio 帧，`codex-acp/src/lib.rs` 顶部有 `#![deny(clippy::print_stdout, clippy::print_stderr)]`，强制禁止用 `println!/eprintln!` 之类把非协议内容写进 stdio。

### 2) ACP 生命周期：Initialize/Auth/NewSession/Prompt

对应实现主要在 `codex-acp/src/codex_agent.rs`（实现 `agent_client_protocol::Agent`）：

- `initialize(...)`
  - 将传入的 `client_capabilities` 保存到 `self.client_capabilities`（后续文件系统代理、终端输出能力都会读它）。
  - 固定返回 `ProtocolVersion::V1`（即使请求里传了其他版本也会被覆盖为 V1）。
  - 声明能力：`PromptCapabilities.embedded_context(true).image(true)`、`McpCapabilities.http(true)`。
  - 认证方式：`chatgpt` / `codex-api-key` / `openai-api-key`；如果环境变量 `NO_BROWSER` 存在，会移除 `chatgpt`（因为设备码/浏览器登录不适合远程项目）。
- `authenticate(...)`
  - ChatGPT：启动 `codex_login::run_login_server(...)` 走浏览器/设备码流程。
  - API Key：从环境变量读取并调用 `codex_login::login_with_api_key(...)` 写入凭据。
- `new_session(...)`
  - 将 ACP 侧 `cwd` 写入 `Config.cwd`，并强制 `config.include_apply_patch_tool = true`（确保走补丁工具链路）。
  - 将客户端传入的 MCP 服务器配置写入 `config.mcp_servers`：
    - `McpServer::Http` → `McpServerTransportConfig::StreamableHttp`（支持 headers）。
    - `McpServer::Stdio` → `McpServerTransportConfig::Stdio`（command/args/env/cwd）。
    - `McpServer::Sse`：直接忽略（等价于“不支持 SSE 传输”）。
  - 通过 `ThreadManager::start_thread(config)` 创建 Codex 线程（thread），并将 `thread_id` 映射为 `SessionId`（字符串化）。
  - 记录 session 的根目录（用于后续文件系统沙箱 `ensure_within_root`）。
- `prompt(...)` / `cancel(...)` / `set_session_mode(...)` / `set_session_model(...)` / `set_session_config_option(...)`
  - 统一下沉到 `codex-acp/src/thread.rs` 的 `Thread` actor 去处理：`prompt` 提交 `Op`，`cancel` 提交 `Op::Interrupt`，模式/模型/配置通过 `Op::OverrideTurnContext` 覆盖当前会话上下文。

### 3) ThreadActor：事件路由与 Submission 状态机

核心在 `codex-acp/src/thread.rs`，它把 Codex 的“提交一次 Op 得到一个 submission_id”抽象成 ACP 客户端可消费的“流式通知”：

- `ThreadActor::spawn()` 用 `tokio::select!` 同时监听：
  - UI/客户端侧消息（`ThreadMessage`，例如 Prompt/SetMode/Cancel）
  - Codex 侧事件（`thread.next_event()` 返回 `Event { id, msg }`）
- `Event.id`（submission_id）是路由关键字：`ThreadActor` 用 `HashMap<String, SubmissionState>` 把事件分发给对应的 submission；未知 id 会告警 `Received event for unknown submission ID`。
- `SubmissionState` 是一个小状态机：
  - `CustomPromptsState`：只等待 `ListCustomPromptsResponse`，用于把“自定义 prompt”变成 ACP 的 `AvailableCommandsUpdate`。
  - `PromptState`：处理常规用户 prompt 的完整事件流（消息流、工具调用、审批、web search、review 结果、turn 完成/中止等）。
  - `TaskState`：处理 `/compact`、`/undo` 这类“子任务型” Op（通常是合成事件，不需要像 prompt 那样完整跟踪工具调用）。

### 4) Slash Command 与自定义 Prompt 的真正实现方式

`codex-acp` 的 slash command 不是“ACP 客户端本地执行”，而是把输入重写成 Codex 的 `Op`：

- 解析入口：`extract_slash_command(...)`（只看 **第一个** `UserInput`，且必须是 `Text` 才会识别 `/...`）。
- 处理逻辑：`ThreadActor::handle_prompt(...)`：
  - `/compact` → `Op::Compact`
  - `/undo` → `Op::Undo`
  - `/init` → `Op::UserInput`（把 `prompt_for_init_command.md` 的内容当成用户输入发给 Codex，让 Codex 去生成/修改 `AGENTS.md`）
  - `/review`、`/review-branch`、`/review-commit` → `Op::Review { review_request: ... }`
  - `/logout`：直接调用 `AuthManager::logout()`，并返回 `Error::auth_required()` 让客户端重新走认证
  - 其他 `/xxx`：先尝试用 `expand_custom_prompt(...)` 做自定义 prompt 展开；失败则按普通 `Op::UserInput` 发送（也就意味着“未知 slash”会原样交给 Codex，而不是直接报错）。

### 5) 从 Codex EventMsg 到 ACP SessionUpdate 的映射（最关键的适配层）

`PromptState::handle_event(...)` 是“适配器”的核心：把 Codex 事件翻译成 ACP 的 `SessionUpdate` 通知流。

#### 文本/推理流

- `AgentMessageContentDelta` → `SessionUpdate::AgentMessageChunk`
- `ReasoningContentDelta` / `ReasoningRawContentDelta` → `SessionUpdate::AgentThoughtChunk`
- `AgentReasoningSectionBreak` → 发送 `\\n\\n`（仅用于让 UI 段落有间隔）
- 去重策略：如果已经收到过 delta（`seen_message_deltas/seen_reasoning_deltas`），则忽略非流式的 `AgentMessage` / `AgentReasoning`，避免 UI 重复显示。

#### 工具调用（命令执行）

- `ExecApprovalRequest` → `client.request_permission(...)`（AllowAlways/AllowOnce/RejectOnce）→ `Op::ExecApproval { decision }`
- `ExecCommandBegin` → 发 `SessionUpdate::ToolCall`（`ToolKind` 由 `parse_command_tool_call(...)` 推断：Read/Search/Execute）
- `ExecCommandOutputDelta` / `TerminalInteraction`
  - 如果客户端声明支持“终端输出通道”（`client_capabilities.meta.terminal_output == true` 且命令本身标记为 `terminal_output`）：通过 `ToolCallUpdate.meta` 发送增量 `terminal_output`。
  - 否则：把输出缓存在内存里并按代码块格式发送（` ```sh ... ``` ` 或带扩展名的 fenced code block）。
- `ExecCommandEnd` → `ToolCallUpdate.status = Completed/Failed`，并附带 `raw_output`；如果走终端通道，还会通过 `meta.terminal_exit` 发 exit code。

#### 工具调用（补丁应用）

- `ApplyPatchApprovalRequest` → `client.request_permission(...)`（AllowOnce/RejectOnce）→ `Op::PatchApproval { decision }`
- `PatchApplyBegin` / `PatchApplyEnd` → `SessionUpdate::ToolCall` / `ToolCallUpdate`（以 `Diff` 的方式把 `FileChange` 转成可预览的变更）

#### 工具调用（MCP）

- `McpToolCallBegin` → `SessionUpdate::ToolCall`（标题 `Tool: server/tool`，`raw_input` 是 invocation）
- `McpToolCallEnd` → `ToolCallUpdate`（根据 `CallToolResult.is_error` 判定 Completed/Failed；`content` 会被转换为 ACP 的 `ContentBlock`）
- `ElicitationRequest`（MCP 侧向用户要信息）→ `client.request_permission(...)` → `Op::ResolveElicitation { decision }`

#### Web Search / View Image

- `WebSearchBegin` → 建立 `ToolCall(kind=Fetch)`；`WebSearchEnd` 只表示“拿到了 query”，并不代表结果已返回，结果仍通过后续 `AgentMessage*` 事件流入。
- `ViewImageToolCall` → 构造一个 `ToolCall(kind=Read)`，内容是 `ResourceLink`（用于在 UI 中把图片路径显示为可点击资源）。

### 6) 会话配置项：Mode/Model/Reasoning Effort

`codex-acp` 会通过 ACP 的 `config_options` 暴露可选项（见 `codex-acp/src/thread.rs` 的 `config_options(...)`）：

- `mode`：从 `codex_common::approval_presets::builtin_approval_presets()` 生成 `Approval Preset` 下拉框；切换时会提交 `Op::OverrideTurnContext` 覆盖 `approval_policy` 和 `sandbox_policy`，并在非只读沙箱下调用 `set_project_trust_level(..., Trusted)`。
- `model`：列出 `ModelsManager::list_models(...)` 的可选项；切换时写 `Config.model` 并提交 `Op::OverrideTurnContext { model: ... }`。
- `reasoning_effort`：只在“当前模型 preset 支持多个 effort”时出现；切换时提交 `Op::OverrideTurnContext { effort: ... }`。

### 7) 文件系统访问：本地直读 vs ACP 代理

`codex-acp/src/local_spawner.rs` 的 `AcpFs` 同时实现了：

- `codex_apply_patch::Fs`（给补丁应用用）
- `codex_core::codex::Fs`（给 Codex core 读文件上下文用，例如 `file_buffer`）

它的决策逻辑是：

- 如果 ACP 客户端支持 `fs.read_text_file`/`fs.write_text_file`：通过 `AgentSideConnection` 反向调用客户端 API（也就是“文件由客户端提供/写入”，适合远程工作区、沙箱、或编辑器统一管理文件）。
- 否则：回退到 `codex_apply_patch::StdFs`，直接访问本地文件系统。

当走 ACP 文件代理路径时，会用 `ensure_within_root(...)` 把路径限制在 session root（`new_session` 时记录的 `cwd`）内，避免越界访问；当回退到本地 `StdFs` 时，这一层不再做 root 检查（依赖 Codex 自身的 `SandboxPolicy`/宿主环境权限来约束）。

### 8) NPM 分发层：一个很薄的多平台二进制选择器

`codex-acp/npm/bin/codex-acp.js` 做了两件事：

- 根据 `process.platform`/`process.arch` 选择对应的可选依赖包（例如 `@zed-industries/codex-acp-darwin-arm64`）。
- 找到其中的 `bin/codex-acp[.exe]` 并 `spawnSync(..., stdio: "inherit")`，把 CLI 的 stdio 完整透传给用户/编辑器。

这解释了为什么 `npx @zed-industries/codex-acp` 能像“直接运行一个本地二进制”一样工作。

### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 入口 | `main.rs` | 程序入口，解析命令行参数 |
| 库入口 | `lib.rs` | ACP 连接初始化，stdio 通信 |
| Agent 实现 | `codex_agent.rs` | 实现 ACP Agent trait，处理协议请求 |
| 会话管理 | `thread.rs` | 会话状态管理，事件处理，命令解析 |
| 文件系统 | `local_spawner.rs` | 文件读写代理，沙箱隔离 |
| 命令解析 | `prompt_args.rs` | 斜杠命令和自定义提示词解析 |

---

## 功能特性

### 1. 认证方式

支持三种认证方式：

| 方式 | 环境变量 | 说明 |
|------|----------|------|
| ChatGPT 订阅 | - | 浏览器登录，需付费订阅，不支持远程项目 |
| Codex API Key | `CODEX_API_KEY` | 直接使用 API 密钥 |
| OpenAI API Key | `OPENAI_API_KEY` | 使用 OpenAI API 密钥 |

```rust
enum CodexAuthMethod {
    ChatGpt,      // 浏览器设备码登录
    CodexApiKey,  // CODEX_API_KEY 环境变量
    OpenAiApiKey, // OPENAI_API_KEY 环境变量
}
```

### 2. 斜杠命令

内置命令：

| 命令 | 功能 | 参数 |
|------|------|------|
| `/review` | 审查当前未提交的更改 | 可选：自定义审查指令 |
| `/review-branch <branch>` | 审查相对于指定分支的更改 | 分支名 |
| `/review-commit <sha>` | 审查指定提交引入的更改 | 提交 SHA |
| `/init` | 生成 AGENTS.md 项目指南文件 | 无 |
| `/compact` | 压缩对话历史，防止超出上下文限制 | 无 |
| `/undo` | 撤销 Codex 最近一轮的操作 | 无 |
| `/logout` | 登出 Codex | 无 |

### 3. 自定义提示词 (Custom Prompts)

支持项目级自定义提示词，支持两种参数格式：

**命名参数格式**：
```markdown
<!-- /my-prompt.md -->
Review $USER changes on $BRANCH
```
调用：`/my-prompt USER=Alice BRANCH=main`

**位置参数格式**：
```markdown
<!-- /my-prompt.md -->
Review $1 changes on $2
```
调用：`/my-prompt Alice main`

**特殊变量**：
- `$1` - `$9`：位置参数
- `$ARGUMENTS`：所有参数的聚合
- `$$`：转义的 `$` 符号

### 4. 会话模式 (Approval Presets)

预设的审批和沙箱策略组合：

| 模式 | 审批策略 | 沙箱策略 |
|------|----------|----------|
| 只读 | 需审批 | ReadOnly |
| 工作区写入 | 需审批 | WorkspaceWrite |
| 完全访问 | 自动批准 | DangerFullAccess |

### 5. 模型配置

支持动态切换模型和推理强度：

```rust
// 模型 ID 格式: "{preset_id}/{reasoning_effort}"
// 例如: "gpt-4/high"

enum ReasoningEffort {
    Low,
    Medium,
    High,
}
```

---

## 事件系统

### 事件类型完整列表

`codex-acp` 会接收 `codex-core` 的事件流，并在 `PromptState` / `TaskState` 中对其中一部分事件做 ACP 通知映射（其余事件会被忽略或仅记录日志）：

#### 消息类事件
| 事件 | 说明 |
|------|------|
| `AgentMessageContentDelta` | AI 回复文本流（增量） |
| `AgentMessage` | AI 回复文本（完整） |
| `ReasoningContentDelta` | 推理过程文本流 |
| `AgentReasoning` | 推理过程文本（完整） |
| `AgentReasoningSectionBreak` | 推理段落分隔 |

#### 工具调用事件
| 事件 | 说明 |
|------|------|
| `ExecApprovalRequest` | 命令执行审批请求 |
| `ExecCommandBegin` | 命令开始执行 |
| `ExecCommandOutputDelta` | 命令输出流 |
| `ExecCommandEnd` | 命令执行结束 |
| `TerminalInteraction` | 终端交互（stdin） |

#### 代码补丁事件
| 事件 | 说明 |
|------|------|
| `ApplyPatchApprovalRequest` | 补丁应用审批请求 |
| `PatchApplyBegin` | 补丁开始应用 |
| `PatchApplyEnd` | 补丁应用结束 |

#### MCP 工具事件
| 事件 | 说明 |
|------|------|
| `McpToolCallBegin` | MCP 工具调用开始 |
| `McpToolCallEnd` | MCP 工具调用结束 |
| `McpStartupUpdate` | MCP 服务器启动状态 |
| `McpStartupComplete` | MCP 服务器启动完成 |
| `ElicitationRequest` | MCP 信息请求 |

#### 搜索事件
| 事件 | 说明 |
|------|------|
| `WebSearchBegin` | 网络搜索开始 |
| `WebSearchEnd` | 网络搜索结束（含查询） |

#### 审查事件
| 事件 | 说明 |
|------|------|
| `EnteredReviewMode` | 进入审查模式 |
| `ExitedReviewMode` | 退出审查模式（含结果） |

#### 计划事件
| 事件 | 说明 |
|------|------|
| `PlanUpdate` | 任务计划更新 |

#### 生命周期事件
| 事件 | 说明 |
|------|------|
| `TurnStarted` | 回合开始 |
| `TurnComplete` | 回合完成 |
| `TurnAborted` | 回合中止 |
| `ItemStarted` | 项目开始 |
| `ItemCompleted` | 项目完成 |

#### 其他事件
| 事件 | 说明 |
|------|------|
| `UserMessage` | 用户消息回显 |
| `ViewImageToolCall` | 查看图片工具调用 |
| `UndoStarted` | 撤销开始 |
| `UndoCompleted` | 撤销完成 |
| `Error` | 错误 |
| `StreamError` | 流错误 |
| `Warning` | 警告 |
| `ShutdownComplete` | 关闭完成 |

---

## 操作类型 (Op)

向 Codex 提交的操作类型：

```rust
enum Op {
    // 用户输入
    UserInput { items: Vec<UserInput>, final_output_json_schema: Option<...> },
    
    // 内置命令
    Compact,           // 压缩上下文
    Undo,              // 撤销操作
    Interrupt,         // 中断当前操作
    ListCustomPrompts, // 列出自定义提示词
    
    // 审查
    Review { review_request: ReviewRequest },
    
    // 审批响应
    ExecApproval { id: String, decision: ReviewDecision },
    PatchApproval { id: String, decision: ReviewDecision },
    ResolveElicitation { server_name, request_id, decision },
    
    // 配置覆盖
    OverrideTurnContext {
        cwd: Option<PathBuf>,
        approval_policy: Option<...>,
        sandbox_policy: Option<...>,
        model: Option<String>,
        effort: Option<Option<ReasoningEffort>>,
        summary: Option<String>,
    },
}
```

---

## MCP 服务器集成

支持客户端传入的 MCP 服务器配置：

### 支持的传输方式

| 类型 | 说明 |
|------|------|
| Stdio | 标准输入输出进程 |
| HTTP (Streamable) | HTTP 流式传输 |
| SSE | 不支持 |

### 配置示例

```rust
McpServerConfig {
    transport: McpServerTransportConfig::Stdio {
        command: "uvx".to_string(),
        args: vec!["some-mcp-server"],
        env: Some(HashMap::from([("KEY", "value")])),
        cwd: Some(cwd.clone()),
    },
    enabled: true,
    startup_timeout_sec: None,
    tool_timeout_sec: None,
    disabled_tools: None,
    enabled_tools: None,
}
```

---

## 文件系统沙箱

`AcpFs` 实现了文件系统访问的沙箱隔离：

```rust
impl AcpFs {
    // 确保路径在会话根目录内
    fn ensure_within_root(&self, path: &Path) -> io::Result<PathBuf> {
        let root = absolute(self.session_root()?)?;
        let abs_path = absolute(path)?;
        if abs_path.starts_with(&root) {
            Ok(abs_path)
        } else {
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                format!("access denied (outside session root)")
            ))
        }
    }
}
```

### 文件操作代理

当客户端支持文件操作时，通过 ACP 协议代理：

| 操作 | 方法 |
|------|------|
| 读取文件 | `read_text_file` |
| 写入文件 | `write_text_file` |
| 限制读取 | `read_text_file` with limit |

---

## 权限请求流程

### 命令执行审批

```
1. ExecApprovalRequest 事件
   ↓
2. 显示权限请求 UI
   - "Always" (AllowAlways) → ApprovedForSession
   - "Yes" (AllowOnce) → Approved
   - "No, provide feedback" (RejectOnce) → Abort
   ↓
3. 提交 Op::ExecApproval { decision }
```

### 补丁应用审批

```
1. ApplyPatchApprovalRequest 事件
   ↓
2. 显示 Diff 预览和权限请求
   - "Yes" → Approved
   - "No, provide feedback" → Abort
   ↓
3. 提交 Op::PatchApproval { decision }
```

---

## 输入内容处理

支持的输入内容类型：

| 类型 | 处理方式 |
|------|----------|
| Text | 直接作为文本输入 |
| Image | 转换为 data URL |
| ResourceLink | 格式化为 Markdown 链接 |
| EmbeddedResource (Text) | 包装为 `<context>` 标签 |
| Audio | 忽略 |

```rust
fn build_prompt_items(prompt: Vec<ContentBlock>) -> Vec<UserInput> {
    // Text → UserInput::Text
    // Image → UserInput::Image { image_url: "data:mime;base64,..." }
    // ResourceLink → UserInput::Text { "[@name](uri)" }
    // EmbeddedResource → UserInput::Text { "[@name](uri)\n<context>...</context>" }
}
```

---

## 工具调用类型

| ToolKind | 用途 |
|----------|------|
| Read | 读取文件 |
| Edit | 编辑/写入文件 |
| Execute | 执行命令 |
| Search | 搜索文件/内容 |
| Fetch | 网络请求 |

---

## 终端输出支持

当客户端支持终端输出时（通过 `meta.terminal_output` 能力），命令输出通过专用终端通道传输：

```rust
// 检查客户端能力
fn supports_terminal_output(&self, active_command: &ActiveCommand) -> bool {
    active_command.terminal_output
        && self.client_capabilities.meta
            .get("terminal_output")
            .is_some_and(|v| v.as_bool().unwrap_or_default())
}

// 终端输出元数据
Meta::from_iter([
    ("terminal_output", json!({
        "terminal_id": call_id,
        "data": output_data
    }))
])
```

---

## 依赖关系

### 核心依赖

| Crate | 用途 |
|-------|------|
| `agent-client-protocol` | ACP 协议实现 |
| `codex-core` | Codex CLI 核心功能 |
| `codex-protocol` | Codex 协议定义 |
| `codex-apply-patch` | 补丁应用 |
| `codex-login` | 认证登录 |
| `codex-mcp-server` | MCP 服务器支持 |
| `mcp-types` | MCP 类型定义 |

### 运行时依赖

| Crate | 用途 |
|-------|------|
| `tokio` | 异步运行时 |
| `tokio-util` | 异步工具 |
| `serde` / `serde_json` | 序列化 |
| `tracing` | 日志追踪 |
| `clap` | 命令行解析 |

---

## 使用方式

### 直接运行

```bash
# 使用 OpenAI API Key
OPENAI_API_KEY=sk-... codex-acp

# 使用 Codex API Key
CODEX_API_KEY=... codex-acp

# 设置日志级别
RUST_LOG=debug codex-acp
```

### 通过 npm

```bash
npx @zed-industries/codex-acp
```

### 在 Zed 中使用

Zed 编辑器已内置支持，通过 Agent Panel 的 "New Codex Thread" 启动。

---

## 对 Codex Desktop 的集成建议

### 方案一：直接依赖 codex-core（推荐）

在 Tauri 后端直接使用 Codex 核心库：

```toml
# src-tauri/Cargo.toml
[dependencies]
codex-core = { git = "https://github.com/zed-industries/codex", branch = "acp" }
codex-protocol = { git = "https://github.com/zed-industries/codex", branch = "acp" }
```

参考 `thread.rs` 中的事件处理逻辑，将 Codex 事件转换为前端可用的格式。

### 方案二：作为子进程运行

启动 `codex-acp` 作为子进程，通过 ACP 协议通信：

```rust
// 启动 codex-acp 进程
let child = Command::new("codex-acp")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .spawn()?;

// 通过 stdin/stdout 进行 ACP 协议通信
```

### 关键集成点

1. **事件流处理**：参考 `PromptState::handle_event` 方法
2. **权限请求**：实现 `request_permission` UI
3. **终端输出**：支持实时命令输出显示
4. **Diff 预览**：代码补丁的可视化审查
5. **模型切换**：动态模型和推理强度配置

---

## 版本历史

- **0.8.2** - 当前版本
- 使用 Rust 2024 Edition
- 依赖 `agent-client-protocol` 0.9.3
