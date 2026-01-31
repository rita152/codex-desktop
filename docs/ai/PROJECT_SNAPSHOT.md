# 项目架构快照

**更新日期**: 2026-01-31

---

## 一、项目概述

**codex-desktop** 是一个基于 Tauri 的桌面应用，为 OpenAI Codex Agent 提供图形界面。

---

## 二、当前架构（ACP 模式）

```
┌─────────────────────────────────────────────────────────────────────┐
│                         codex-desktop                                │
├─────────────────────────────────────────────────────────────────────┤
│  前端 (React + TypeScript)                                           │
│  ├── src/components/     UI 组件                                     │
│  ├── src/stores/         Zustand 状态管理                            │
│  ├── src/hooks/          事件监听 (useCodexEvents)                   │
│  └── src/api/            Tauri 命令封装                              │
├─────────────────────────────────────────────────────────────────────┤
│  Tauri Bridge (Rust)                                                 │
│  ├── commands.rs         Tauri 命令处理                              │
│  ├── service.rs          ACP 连接管理                                │
│  ├── protocol.rs         ACP Client 实现                             │
│  └── process.rs          codex-acp 子进程管理                        │
├─────────────────────────────────────────────────────────────────────┤
│  codex-acp (子进程)      JSON-RPC over stdio                         │
│  └── 基于 agent-client-protocol 0.9.3                                │
├─────────────────────────────────────────────────────────────────────┤
│  codex-core (内嵌于 codex-acp)                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、目标架构（codex-core 直接集成）

```
┌─────────────────────────────────────────────────────────────────────┐
│                         codex-desktop                                │
├─────────────────────────────────────────────────────────────────────┤
│  前端 (React + TypeScript)                                           │
│  └── 保持不变，事件名兼容                                            │
├─────────────────────────────────────────────────────────────────────┤
│  Tauri Bridge (Rust)                                                 │
│  ├── commands.rs         Tauri 命令处理                              │
│  ├── core_service.rs     codex-core 直接调用                         │
│  └── event_bridge.rs     EventMsg → Tauri Events                    │
├─────────────────────────────────────────────────────────────────────┤
│  codex-core (直接依赖)                                               │
│  └── ThreadManager, Config, EventMsg, Op                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 四、关键模块

### 4.1 后端模块 (src-tauri/src/)

| 模块 | 当前状态 | 迁移后 |
|------|----------|--------|
| `codex/service.rs` | ACP 连接管理 | **重写** → core_service.rs |
| `codex/protocol.rs` | ACP Client | **重写** → event_bridge.rs |
| `codex/process.rs` | 子进程管理 | **删除** |
| `codex/commands.rs` | Tauri 命令 | 修改 |
| `codex/events.rs` | 事件常量 | 扩展 |

### 4.2 前端模块 (src/)

| 模块 | 说明 |
|------|------|
| `hooks/useCodexEvents.ts` | 监听 Tauri 事件 |
| `stores/sessionStore.ts` | 会话状态管理 |
| `api/codex.ts` | Tauri 命令封装 |

---

## 五、依赖关系

### 5.1 当前依赖

```toml
# src-tauri/Cargo.toml
agent-client-protocol = { version = "=0.9.3", features = ["unstable"] }
```

### 5.2 迁移后依赖

```toml
# src-tauri/Cargo.toml
codex-core = { path = "../../codex/my-fork-codex/codex-rs/core" }
codex-protocol = { path = "../../codex/my-fork-codex/codex-rs/protocol" }
```

---

## 六、事件流

### 6.1 当前事件流

```
codex-core EventMsg
    ↓
codex-acp (SessionUpdate 转换)
    ↓
JSON-RPC (stdio)
    ↓
Tauri (protocol.rs emit_session_update)
    ↓
前端 (useCodexEvents)
```

### 6.2 迁移后事件流

```
codex-core EventMsg
    ↓
Tauri (event_bridge.rs emit_codex_event)
    ↓
前端 (useCodexEvents)
```

---

## 七、迁移收益

| 特性 | 当前 | 迁移后 |
|------|------|--------|
| Token Usage | ❌ | ✅ TokenCountEvent |
| 临时会话 | ❌ | ✅ config.ephemeral |
| Kill Session | ❌ | ✅ remove_thread() |
| 完整事件流 | ⚠️ 部分 | ✅ 40+ EventMsg |
| 启动延迟 | ⚠️ 子进程 | ✅ 直接调用 |
