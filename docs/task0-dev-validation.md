# Task 0 开发验证记录（codex-acp + npm tauri dev）

## 目标

在开发阶段以 `codex-acp` 作为 ACP Agent，复用本机 `~/.codex/config.toml`（`model_provider` / `base_url` / `api-key` 等）快速跑通最小闭环：Desktop 发起 prompt → 收到流式消息 → 观察工具调用/审批事件。

## 当前实现（对应代码）

- 后端命令：`src-tauri/src/lib.rs` 暴露 `codex_dev_prompt_once`
- ACP client（Dev 版）：`src-tauri/src/codex_dev/run.rs`
  - 通过 `npx @zed-industries/codex-acp` 启动子进程
  - 设置 `CODEX_HOME=$HOME/.codex`
  - 从 `~/.codex/config.toml` 读取 `api-key` 时，会额外导出到 `OPENAI_API_KEY` / `CODEX_API_KEY` 并调用 `authenticate`（用于兼容 codex-acp 的认证路径；不在日志输出明文 key）
  - `request_permission` 当前为自动同意（Task0 先验证链路，后续接 ApprovalDialog）
- 前端接入：`src/App.tsx` 监听事件并流式更新 assistant 消息

## 事件对齐（已观测）

- `codex:message` ← `SessionUpdate::AgentMessageChunk(Text)`
- `codex:thought` ← `SessionUpdate::AgentThoughtChunk(Text)`（默认转发；如需关闭可设置 `CODEX_DESKTOP_EMIT_THOUGHT_CHUNKS=0`）
- `codex:tool-call` / `codex:tool-call-update` ← `SessionUpdate::ToolCall` / `ToolCallUpdate`
- `codex:approval-request` ← ACP `session/request_permission`（包含 `toolCall` 与 `options`，如 `approved-for-session` / `approved` / `abort`）
- `codex:turn-complete`：由 Desktop 在 `prompt` 返回后发出（携带 `stopReason`）

## 验证方式

### 1) ACP 录制/回归（无需 UI）

```bash
cd src-tauri
cargo run --bin task0_acp_smoke
```

可传入自定义 prompt，例如（用于触发 `request_permission`）：

```bash
cd src-tauri
cargo run --bin task0_acp_smoke -- "请在当前目录创建文件 demo.txt，内容为 hello"
```

也支持从文件读取长 prompt，并把所有流式增量（含 `tsMs`/`dtMs`）保存到 `.txt`（JSONL）：

```bash
cd src-tauri
cargo run --bin task0_acp_smoke -- --prompt-file ./prompt.txt --out ./output.txt
```

### 2) tauri dev（UI 闭环）

```bash
npm run tauri dev
```

在输入框发送消息后，assistant 回复应以流式方式增量显示；工具/审批事件可在 DevTools Console 观察（Task0 阶段先 console.debug）。
