# Task 0.1 字段对齐清单（ACP ↔ Codex Desktop）

本文件用于记录 Codex Desktop（ACP Client）与 `codex-acp`（ACP Agent）的关键字段与事件对齐，便于后续实现 UI/审批/工具输出时保持一致。

## 录制方式（推荐）

使用仓库内的最小 ACP client 录制一轮真实交互（输出为 JSON 行，写到 stderr）：

```bash
cd src-tauri
cargo run --bin task0_acp_smoke
```

传入自定义 prompt（用于触发 `request_permission` / 工具调用）：

```bash
cd src-tauri
cargo run --bin task0_acp_smoke -- "请在当前目录创建文件 demo.txt，内容为 hello"
```

## request_permission（审批请求）

`codex-acp` 会通过 ACP 反向调用客户端 `request_permission`，客户端必须从 `options[*].option_id` 中选一个返回（不是简单 allow/reject）。

最小字段（对应 `task0_acp_smoke` 输出）：

- `sessionId`: ACP session id（字符串）
- `toolCall`: 本次需要审批的工具调用（包含 tool call id、kind、title、raw_input 等）
- `options`: 可选项数组（每项至少包含 `option_id` 与 `kind`，常见 kind：`allow-once` / `allow-always` / `reject-once` / `abort` 等）

Desktop 后端实现位置：

- `src-tauri/src/codex/protocol.rs`：接收 `request_permission`，通过 `codex_approve` 返回所选 `option_id`
- `src-tauri/src/codex/types.rs`：`ApprovalDecision` 与 `option_id` 映射

## SessionUpdate（流式事件）

`codex-acp` 会通过 `session_notification` 推送 `SessionUpdate`，Desktop 将其映射为前端事件：

- `SessionUpdate::AgentMessageChunk(Text)` → `codex:message`
- `SessionUpdate::AgentThoughtChunk(Text)` → `codex:thought`（默认转发；如需关闭可设置 `CODEX_DESKTOP_EMIT_THOUGHT_CHUNKS=0`）
- `SessionUpdate::ToolCall` → `codex:tool-call`
- `SessionUpdate::ToolCallUpdate` → `codex:tool-call-update`
- `SessionUpdate::Plan` → `codex:plan`
- `SessionUpdate::AvailableCommandsUpdate` → `codex:available-commands`
- `SessionUpdate::ConfigOptionUpdate` / `CurrentModeUpdate` → `codex:config-option-update` / `codex:current-mode`
- prompt 返回 → `codex:turn-complete`

事件常量定义：

- `src-tauri/src/codex/events.rs`

更详细的 Codex 事件 → ACP SessionUpdate 映射原理（基于 `codex-acp 0.8.2` 代码阅读）见：

- `docs/codex-acp-analysis.md`

## 终端输出（terminal_output meta）

若希望收到“终端输出增量”（而不是把输出折叠进消息文本），需要在 Initialize 时声明：

- `client_capabilities.meta.terminal_output = true`

Desktop 已在 Initialize 中默认开启该 capability（Dev/Prod 代码均设置）。
