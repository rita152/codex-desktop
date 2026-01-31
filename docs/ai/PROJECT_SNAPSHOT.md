# 项目快照

**更新日期**: 2026-01-31
**分支**: main

---

## 一、项目概述

**Codex Desktop**: Tauri 2 桌面应用（Rust 后端）+ React 19 + TypeScript + Vite 7 前端。

核心功能：
- Codex ACP sidecar 运行
- 多会话对话管理
- 远程服务器支持（SSH）
- Git 集成
- MCP 服务器管理
- 终端面板

---

## 二、技术架构

### 事件流架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         codex-acp (Rust sidecar)                        │
│   thread.rs → SessionUpdate (ACP Protocol via stdin/stdout)             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    src-tauri/src/codex/protocol.rs                      │
│   AcpClient.session_notification() → emit_session_update()              │
│   → Tauri IPC Event (codex:xxx)                                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     src/hooks/useCodexEvents.ts                         │
│   listen('codex:xxx') → Store updates                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Codex 事件对应关系

| SessionUpdate (codex-acp) | Tauri Event | 前端处理 |
|---------------------------|-------------|----------|
| AgentMessageChunk | codex:message | ✅ |
| AgentThoughtChunk | codex:thought | ✅ |
| ToolCall | codex:tool-call | ✅ |
| ToolCallUpdate | codex:tool-call-update | ✅ |
| Plan | codex:plan | ✅ |
| AvailableCommandsUpdate | codex:available-commands | ✅ |
| CurrentModeUpdate | codex:current-mode | ✅ |
| ConfigOptionUpdate | codex:config-option-update | ✅ |
| UserMessageChunk | (忽略) | 不需要 |

| 其他事件 | 来源 | 前端处理 |
|----------|------|----------|
| codex:approval-request | request_permission RPC | ✅ |
| codex:turn-complete | service.rs | ✅ |
| codex:error | IO 错误 | ✅ |
| codex:debug | DebugState | ❌ 待实现 |
| codex:token-usage | ExtNotification | ❌ 待实现 |

### 前端状态管理 (Zustand)

| Store | 职责 | 持久化 |
|-------|------|--------|
| UIStore | 侧边栏、面板、设置弹窗 | ❌ |
| SessionStore | 会话列表、消息、草稿、终端 | ✅ localStorage |
| CodexStore | 审批请求、消息队列、会话映射 | ❌ |
| SettingsStore | 应用设置（主题、快捷键） | ✅ localStorage + Tauri |
| DebugStore | 调试事件（待创建） | ❌ |

---

## 三、目录结构

```
./
├── src/                # React 前端
│   ├── api/            # Tauri invoke 包装
│   ├── components/     # UI + 业务组件
│   ├── hooks/          # 自定义 hooks
│   ├── stores/         # Zustand stores
│   ├── types/          # TypeScript 类型
│   └── utils/          # 工具函数
├── src-tauri/          # Rust 后端
│   └── src/
│       ├── codex/      # Codex ACP 集成
│       ├── git/        # Git 操作
│       ├── mcp/        # MCP 服务器管理
│       └── remote/     # 远程服务器
├── codex-acp/          # git 子模块 (ACP 实现)
├── docs/               # 文档
│   └── ai/             # AI 工程资产
└── scripts/            # 构建脚本
```

---

## 四、关键调用链

### 消息发送流程
```
ChatInput → useCodexActions.handleSendMessage
         → useMessageQueue.enqueueMessage
         → api/codex.sendPrompt
         → Tauri invoke
         → Rust codex/service.rs
         → Codex ACP sidecar
```

### Codex 事件流
```
Codex ACP → Rust protocol.rs emit
         → Tauri event
         → useCodexEvents listener
         → SessionStore/CodexStore update
         → 组件重渲染
```
