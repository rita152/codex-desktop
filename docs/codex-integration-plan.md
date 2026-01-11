# Codex CLI 集成计划

## 概述

将 Codex CLI 集成到 Codex Desktop，通过子进程方式运行 `codex-acp`，使用 ACP 协议进行通信。

## 技术方案

- **集成方式**：子进程 + ACP 协议（stdio）
- **认证方式**：开发期优先复用 Codex CLI 本地配置与凭据（`~/.codex/config.toml` 等）；生产期再补齐应用内密钥管理/Keychain
- **二进制来源**：开发期通过 npm（`npx @zed-industries/codex-acp`）；发布期建议以 Tauri sidecar 方式随应用分发 codex-acp 可执行文件（避免依赖用户机器的 Node/npm）
- **开发验证方式**：以 `npm run tauri dev` 为主线，尽快跑通“发消息 -> 收流式回复 -> 工具/审批事件”闭环

## 关键对齐（基于 codex-acp 0.8.2，补充）

- **协议实现建议**：优先在 Desktop 后端直接使用 Rust crate `agent-client-protocol` 作为 ACP 客户端实现（避免手写 JSON-RPC、类型与双向请求）。
- **审批流方向**：codex-acp 会通过 ACP 的 `request_permission` 向客户端“发起请求”，客户端需要返回所选 `option_id`（不是单纯 allow/reject）。
- **开发期认证来源**：优先依赖用户现有的 `~/.codex` 配置与凭据；必要时才通过 env（`CODEX_API_KEY` / `OPENAI_API_KEY`）或 ChatGPT 订阅登录补齐。
- **会话恢复现状**：codex-acp 目前仅能 `load_session` 已存在于内存的 session；应用重启后无法直接恢复真实会话，需要定义“恢复策略”（例如：只恢复 UI 历史，继续对话时新建 session 并注入摘要/上下文）。
- **能力协商**：若客户端希望收到“终端输出流式更新”，需在 Initialize 的 `client_capabilities.meta` 中声明 `terminal_output: true`（否则工具输出可能不走 terminal meta 通道）。

---

## 阶段零：预研与对齐（建议先做）

### Task 0.1：ACP 交互录制与字段对齐

**目标**：用真实 codex-acp 跑通一次 Initialize/Auth/NewSession/Prompt/Cancel/Permission 的最小闭环，沉淀字段映射与边界行为。

**内容**：
- [x] 在本机用 `codex-acp`（或 `npx @zed-industries/codex-acp`）与一个简易 ACP client 做握手（`src-tauri/src/bin/task0_acp_smoke.rs`）
- [x] 记录 `request_permission` 请求形态（exec/patch/mcp elicitation）与 option_id 约定（见 `docs/task0-acp-field-alignment.md`）
- [x] 记录 `SessionUpdate` 的关键分支：`AgentMessageChunk`、`AgentThoughtChunk`、`ToolCall/ToolCallUpdate`、`Plan`、`AvailableCommandsUpdate`、`ConfigOptionUpdate` 等（见 `docs/task0-acp-field-alignment.md`）
- [x] 明确“终端输出”是走 `ToolCallUpdate.meta` 还是 `content`（与 `terminal_output` capability 相关；见 `docs/task0-acp-field-alignment.md` 与 `docs/codex-acp-analysis.md`）

**验收标准**：
- 输出一份字段对齐清单：`docs/task0-acp-field-alignment.md`

---

### Task 0.2：codex-acp 分发策略选型（Dev/Prod）

**目标**：明确 Desktop 在开发期与发布期如何获取并启动 codex-acp。

**内容**：
- [x] Dev：允许使用 `npx @zed-industries/codex-acp@0.8.2`（便于迭代，且默认锁定版本）
- [x] Prod：将 codex-acp 作为 Tauri sidecar 资源随应用打包（`src-tauri/tauri.conf.json` 的 `bundle.externalBin`）
- [x] 明确版本锁定（固定到 `0.8.2`）与升级策略（修改 `scripts/fetch-codex-acp.mjs` 的 `VERSION` 并回归验证 Task0/Task1/Task2）

**验收标准**：
- 打包产物在“无 Node 环境”下仍可启动 codex-acp（sidecar 由 `npm run fetch:codex-acp` 预取并随包分发）

---

### Task 0.3：认证与敏感信息存储方案

**目标**：决定 API Key 与 codex 配置/凭据的落盘位置与安全策略。

**内容**：
- [x] 开发期：优先读取 `~/.codex/config.toml`（`src-tauri/src/codex_dev/config.rs`）并复用已有凭据（不在 Desktop 内管理 Key）
- [x] 生产期：Key 存储优先系统 Keychain/Credential Vault；无法使用时降级为加密存储或仅内存（当前后端支持通过 env 注入 key；Keychain 集成留到阶段三）
- [x] `CODEX_HOME`：开发期默认 `~/.codex`；Release 默认迁移到应用数据目录（可通过 `CODEX_DESKTOP_CODEX_HOME`/`CODEX_HOME` 覆盖，见 `src-tauri/src/codex/binary.rs`）
- [x] ChatGPT 订阅登录：`codex-acp` 侧会在 `NO_BROWSER` 场景下移除 `chatgpt` auth method（详见 `docs/codex-acp-analysis.md`）

**验收标准**：
- 不在日志/崩溃报告中泄露 Key；Release 默认将 Codex 数据写入应用数据目录（便于卸载清理）

---

### Task 0.4：npm tauri dev 端到端验证（开发优先）

**目标**：以 Desktop 为 ACP client，跑通与 codex-acp 的最小可用闭环。

**内容**：
- [x] 前置条件：本机 `~/.codex/config.toml` 已配置可用的 `model_provider` / `base_url` / `api-key`（或已通过 Codex CLI 登录写入凭据）
- [x] 启动：`npm run tauri dev`
- [x] 操作：创建 session（cwd 任选），发送一条普通 prompt，确保收到 `AgentMessageChunk` 流式事件
- [x] 覆盖：至少触发一次工具/审批事件（例如让 agent 执行一个读文件/搜索类工具）

**验收标准**：
- Desktop 在 `tauri dev` 下可稳定完成一次 turn（含 turn-complete），无崩溃/死锁
- 验证记录与当前实现见 `docs/task0-dev-validation.md`

---

## 阶段一：后端基础设施

### Task 1.0：codex-acp 子进程分发与定位

**目标**：后端可稳定找到并启动 codex-acp（Dev/Prod 两套路径）。

**文件**（建议）：
- `src-tauri/src/codex/binary.rs`

**内容**：
- [x] Dev：支持通过 `npx @zed-industries/codex-acp` 启动（可配置开关）
- [x] Prod：支持通过 Tauri sidecar 启动（优先）
- [x] Dev：启动时设置 `CODEX_HOME=$HOME/.codex`（确保读取 `~/.codex/config.toml`）
- [x] 明确 `PATH`、工作目录、以及 `CODEX_HOME`/`RUST_LOG`/认证相关 env 的注入策略（开发期尽量不传 Key）
- [x] 启动时打印一行可诊断信息（版本号/路径/模式），但避免输出敏感 env

**实现备注**：
- `CODEX_DESKTOP_ACP_MODE`: `npx|sidecar`（Debug 默认 npx；Release 默认 sidecar）
- `CODEX_DESKTOP_NPX_BIN`: 覆盖 npx 可执行文件（默认 `npx`）
- `CODEX_DESKTOP_ACP_NPX_SPEC`: 覆盖 npx spec（默认 `@zed-industries/codex-acp@0.8.2`；同时会附带 `--yes` 避免交互）
- `CODEX_DESKTOP_ACP_PATH`: 显式指定 sidecar 路径（用于本地/CI/自定义打包验证）
- `CODEX_DESKTOP_ACP_SIDECAR_NAME`: sidecar 文件名（默认 `codex-acp`；会自动追加 `.exe` 后缀）

**验收标准**：
- 在 Dev 与 Prod 模式都能成功启动并进入 ACP 握手（Initialize 可返回）

---

### Task 1.1：ACP 协议类型定义

**目标**：定义 ACP 协议的 Rust 类型

**文件**：
- `src-tauri/src/codex/types.rs`

**内容**：
- [x] **方案 A（推荐）**：直接引入 `agent-client-protocol` crate，尽量复用其类型（减少维护成本与协议漂移风险）
- [x] **方案 B（兜底）**：暂不实现（已满足 Task1 需要）
- [x] 定义 `ApprovalDecision`（用于 `codex_approve` 的 decision→option 映射）
- [x] 前后端交互使用轻量 JSON 结果/事件，避免强耦合（见 `src-tauri/src/codex/types.rs`）

**验收标准**：
```bash
cd src-tauri && cargo check
# 编译通过，无错误
```

---

### Task 1.2：子进程管理器

**目标**：实现 codex-acp 子进程的启动和管理

**文件**：
- `src-tauri/src/codex/process.rs`

**内容**：
- [x] `CodexProcess` 结构体，管理子进程生命周期（`src-tauri/src/codex/process.rs`）
- [x] `spawn()`：启动 codex-acp，绑定 stdin/stdout
- [x] `kill()` / `is_alive()`：进程管理与错误处理
- [x] 环境变量注入：默认 `CODEX_HOME=$HOME/.codex`；可按需注入 API Key 与 `RUST_LOG`

**依赖**：
- Dev 模式：需要系统可用 `npx`
- Prod 模式：需要将 codex-acp 作为 sidecar 随应用分发

**验收标准**：
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_spawn_and_kill() {
        let process = CodexProcess::spawn().await.unwrap();
        assert!(process.is_alive());
        process.kill().await.unwrap();
        assert!(!process.is_alive());
    }
}
```

---

### Task 1.3：ACP 协议通信层

**目标**：实现与 codex-acp 的 JSON-RPC 通信

**文件**：
- `src-tauri/src/codex/protocol.rs`

**内容**：
- [x] 使用 `agent-client-protocol`：实现 `Client`（`session_notification`/`request_permission`）并建立 `ClientSideConnection`
- [x] `AcpConnection`：封装子进程 + stdio + io_task（`src-tauri/src/codex/protocol.rs`）
- [x] `request_permission`：通过 `codex_approve` 回传所选 `option_id`

**验收标准**：
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_send_initialize() {
        let mut conn = AcpConnection::new(process).await.unwrap();
        let response = conn.send_request(AcpRequest::Initialize { ... }).await;
        assert!(response.is_ok());
    }
}
```

---

### Task 1.4：Codex 服务封装

**目标**：封装完整的 Codex 会话管理

**文件**：
- `src-tauri/src/codex/service.rs`
- `src-tauri/src/codex/mod.rs`

**内容**：
- [x] `CodexService`：封装 Initialize/Auth/NewSession/Prompt/Cancel/Approve（`src-tauri/src/codex/service.rs`）
- [x] Auth：若传入 `api_key` 会重启子进程并以 env 注入后再 authenticate
- [x] Approve：以 `(sessionId, toolCallId)` 作为 requestId 进行匹配，回传 option_id

**验收标准**：
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_full_flow() {
        let service = CodexService::new().await.unwrap();
        service.initialize().await.unwrap();
        service.authenticate(AuthMethod::OpenAiApiKey).await.unwrap();
        let session_id = service.create_session("/tmp/test").await.unwrap();
        // 验证会话创建成功
        assert!(!session_id.is_empty());
    }
}
```

---

### Task 1.5：Tauri 命令注册

**目标**：暴露 Codex 功能给前端

**文件**：
- `src-tauri/src/codex/commands.rs`
- `src-tauri/src/lib.rs`（修改）

**内容**：
- [x] `codex_init` / `codex_auth` / `codex_new_session` / `codex_prompt` / `codex_cancel` / `codex_approve`
- [x] `codex_set_mode` / `codex_set_model` / `codex_set_config_option`
- [x] `src-tauri/src/lib.rs` 注册命令与 `CodexManager` 状态

**验收标准**：
```bash
cd src-tauri && cargo build
# 编译通过

# 前端可以调用：
invoke('codex_init')
// 开发期：优先复用 ~/.codex 配置/凭据（apiKey 可省略）
invoke('codex_auth', { method: 'openai-api-key' })
// 生产期：可通过 Keychain/安全存储注入 key（示例）
// invoke('codex_auth', { method: 'openai-api-key', apiKey: 'sk-...' })
```

---

### Task 1.6：事件推送机制

**目标**：将 Codex 事件实时推送到前端

**文件**：
- `src-tauri/src/codex/events.rs`
- `src-tauri/src/codex/commands.rs`（修改）

**内容**：
- [x] 事件常量：`src-tauri/src/codex/events.rs`
- [x] 事件发射：`src-tauri/src/codex/protocol.rs`（SessionUpdate/Permission/IO error）
- [x] `codex:message` / `codex:tool-call` / `codex:approval-request` / `codex:error` / `codex:turn-complete`

**验收标准**：
```typescript
// 前端可以监听事件
import { listen } from '@tauri-apps/api/event';

await listen('codex:message', (event) => {
  console.log('收到消息:', event.payload);
});
```

---

## 阶段二：前端基础设施

### Task 2.1：类型定义

**目标**：定义前端 TypeScript 类型

**文件**：
- `src/types/codex.ts`

**内容**：
- [x] `CodexAuthMethod` 类型
- [x] `CodexSession` 接口
- [x] `CodexEvent` 联合类型
- [x] `MessageChunk` 接口
- [x] `ToolCall` 接口
- [x] `ApprovalRequest` 接口
- [x] `ApprovalDecision` 类型

**验收标准**：
```bash
npm run build
# TypeScript 编译通过
```

---

### Task 2.2：API 封装层

**目标**：封装 Tauri invoke 调用

**文件**：
- `src/api/codex.ts`

**内容**：
- [x] `initCodex()` - 初始化
- [x] `authenticate(method, apiKey?)` - 认证
- [x] `createSession(cwd)` - 创建会话
- [x] `sendPrompt(sessionId, content)` - 发送消息
- [x] `cancelPrompt(sessionId)` - 取消
- [x] `approveRequest(sessionId, requestId, decision)` - 审批
- [x] `subscribeToEvents(handlers)` - 订阅事件
- [x] （补充）`setSessionMode(sessionId, modeId)` / `setSessionModel(sessionId, modelId)` / `setSessionConfigOption(sessionId, configId, valueId)`

**验收标准**：
```typescript
// 可以正常调用，类型正确
const sessionId = await createSession('/path/to/project');
// sessionId: string
```

---

### Task 2.3：useCodex Hook

**目标**：封装 Codex 状态管理

**文件**：
- `src/hooks/useCodex.ts`

**内容**：
- [x] 管理连接状态（disconnected, connecting, connected, authenticated）
- [x] 管理当前会话 ID
- [x] 管理消息流缓冲
- [x] 管理待处理的审批请求
- [x] 管理可用 slash commands（用于 `/` 自动补全）
- [x] 管理会话配置项（modes/models/config options）并支持更新
- [x] `connect()` 方法
- [x] `authenticate()` 方法
- [x] `sendMessage()` 方法
- [x] `approve()` 方法
- [x] `cancel()` 方法
- [x] 自动清理事件监听

**验收标准**：
```typescript
const { 
  status, 
  sendMessage, 
  pendingApprovals,
  approve 
} = useCodex(sessionId);

// status 正确反映连接状态
// sendMessage 可以发送消息
```

---

## 阶段三：核心 UI 组件

### Task 3.1：流式消息渲染

**目标**：支持 AI 消息的流式显示

**文件**：
- `src/components/business/ChatMessageList/types.ts`（修改）
- `src/components/business/ChatMessageList/index.tsx`（修改）

**内容**：
- [x] `Message` 类型添加 `isStreaming` 字段
- [x] `Message` 类型添加 `toolCalls` 字段
- [x] 流式消息显示光标动画
- [x] 消息内容增量更新

**验收标准**：
- 消息可以逐字显示
- 流式消息有闪烁光标
- 完成后光标消失

---

### Task 3.2：工具调用卡片

**目标**：展示 AI 的工具调用

**文件**：
- `src/components/ui/ToolCallCard/index.tsx`
- `src/components/ui/ToolCallCard/ToolCallCard.css`
- `src/components/ui/ToolCallCard/types.ts`
- `src/components/ui/ToolCallCard/ToolCallCard.stories.tsx`

**内容**：
- [ ] 根据 `ToolKind` 显示不同图标（读取、编辑、执行、搜索）
- [ ] 显示工具调用标题和状态（进行中、完成、失败）
- [ ] 可折叠的输出内容
- [ ] 执行命令显示终端样式输出

**验收标准**：
```bash
npm run storybook
# 在 Storybook 中可以看到不同状态的 ToolCallCard
```

---

### Task 3.3：审批对话框

**目标**：实现命令执行和补丁应用的审批 UI

**文件**：
- `src/components/ui/ApprovalDialog/index.tsx`
- `src/components/ui/ApprovalDialog/ApprovalDialog.css`
- `src/components/ui/ApprovalDialog/types.ts`
- `src/components/ui/ApprovalDialog/ApprovalDialog.stories.tsx`

**内容**：
- [ ] 显示待审批的命令或补丁内容
- [ ] 三个按钮：始终允许、允许一次、拒绝
- [ ] 拒绝时可输入反馈
- [ ] 命令审批显示命令内容
- [ ] 补丁审批显示 Diff 预览

**验收标准**：
```bash
npm run storybook
# 在 Storybook 中可以交互测试审批流程
```

---

### Task 3.4：Diff 预览组件

**目标**：展示代码变更的 Diff 视图

**文件**：
- `src/components/ui/DiffViewer/index.tsx`
- `src/components/ui/DiffViewer/DiffViewer.css`
- `src/components/ui/DiffViewer/types.ts`
- `src/components/ui/DiffViewer/DiffViewer.stories.tsx`

**内容**：
- [ ] 支持 unified diff 格式解析
- [ ] 添加行高亮（绿色添加、红色删除）
- [ ] 显示文件路径
- [ ] 行号显示

**验收标准**：
```bash
npm run storybook
# 在 Storybook 中可以看到格式化的 Diff 视图
```

---

## 阶段四：业务集成

### Task 4.1：认证流程

**目标**：实现应用启动时的认证流程

**文件**：
- `src/components/business/AuthDialog/index.tsx`
- `src/components/business/AuthDialog/AuthDialog.css`
- `src/components/business/AuthDialog/types.ts`

**内容**：
- [ ] 开发期：可先做“只读提示”——检测 `~/.codex/config.toml`/凭据是否存在与可用，并给出修复指引（不强制输入 Key）
- [ ] API Key 输入表单
- [ ] 支持选择认证方式（Codex API Key / OpenAI API Key）
- [ ] 认证状态显示
- [ ] 错误提示
- [ ] 记住 API Key（可选，存储到系统密钥链）

**验收标准**：
- 输入有效 API Key 后可以成功认证
- 无效 API Key 显示错误提示

---

### Task 4.2：App.tsx 集成

**目标**：将 Codex 集成到主应用

**文件**：
- `src/App.tsx`（修改）

**内容**：
- [ ] 应用启动时初始化 Codex
- [ ] 未认证时显示认证对话框
- [ ] 每个会话对应一个 Codex Session
- [ ] 替换模拟 AI 回复为真实 Codex 调用
- [ ] 处理流式消息更新
- [ ] 处理审批请求弹窗

**验收标准**：
- 可以发送消息并收到 AI 回复
- 工具调用正确显示
- 审批请求可以正常处理

---

### Task 4.3：会话状态持久化

**目标**：保存和恢复会话状态

**文件**：
- `src/hooks/useSessionPersistence.ts`
- `src/api/storage.ts`

**内容**：
- [ ] 保存会话列表到本地存储
- [ ] 保存每个会话的消息历史
- [ ] 应用启动时恢复会话
- [ ] 会话切换时的状态管理
- [ ] （补充）定义“会话恢复策略”：重启后 UI 会话为只读；继续对话时新建 codex session 并注入摘要/关键上下文（或另行实现 codex-acp 的可恢复加载能力）

**验收标准**：
- 关闭应用后重新打开，会话列表保留
- 历史消息可以查看
- 继续对话时不会误用失效的 session_id（应自动创建新 session 并提示用户）

---

## 阶段五：完善与优化

### Task 5.1：错误处理

**目标**：完善错误处理和用户提示

**内容**：
- [ ] Codex 进程崩溃时的重连机制
- [ ] 网络错误提示
- [ ] API 限流提示
- [ ] 认证过期处理

---

### Task 5.2：斜杠命令支持

**目标**：支持 Codex 内置斜杠命令

**内容**：
- [ ] 输入框支持 `/` 命令提示
- [ ] 支持 `/review`、`/compact`、`/undo` 等命令
- [ ] 命令自动补全

---

### Task 5.3：设置面板

**目标**：添加 Codex 相关设置

**内容**：
- [ ] 模型选择
- [ ] 审批模式选择
- [ ] 推理强度设置
- [ ] API Key 管理
- [ ] （补充）设置项尽量以 ACP 的 `config_options`/`modes`/`models` 为来源（避免硬编码与版本漂移）

---

### Task 5.4：打包回归与兼容性矩阵（补充）

**目标**：保证各平台打包后 codex-acp 可用、协议握手与审批流稳定。

**内容**：
- [ ] macOS/Windows/Linux 的 sidecar 启动验证
- [ ] “无 Node 环境”验证（确保未意外依赖 npx）
- [ ] 回归清单：Initialize/Auth/NewSession/Prompt/Cancel、exec/patch/mcp permission、图片输入、slash 命令、mcp servers（最小用例）

---

## 依赖关系

```
Task 1.0 ──► Task 1.1 ──┬──► Task 1.2 ──► Task 1.3 ──► Task 1.4 ──► Task 1.5 ──► Task 1.6
           │
           └──► Task 2.1 ──► Task 2.2 ──► Task 2.3
                                              │
Task 3.1 ──┬──────────────────────────────────┴──► Task 4.2
Task 3.2 ──┤
Task 3.3 ──┤
Task 3.4 ──┘
           │
           └──► Task 4.1 ──► Task 4.2 ──► Task 4.3 ──► Task 5.x
```

---

## 里程碑

| 里程碑 | 包含 Task | 目标 |
|--------|-----------|------|
| M0 | 0.1 - 0.4 | 协议/分发/认证与开发闭环 |
| M1 | 1.0 - 1.6 | 后端可以与 codex-acp 通信 |
| M2 | 2.1 - 2.3 | 前端可以调用后端 API |
| M3 | 3.1 - 3.4 | UI 组件就绪 |
| M4 | 4.1 - 4.3 | 完整可用的集成 |
| M5 | 5.1 - 5.4 | 生产就绪 |
