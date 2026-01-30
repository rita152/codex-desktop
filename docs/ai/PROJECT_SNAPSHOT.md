# 项目快照

**更新日期**: 2026-01-30
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

### 前端状态管理

```
┌─────────────────────────────────────────────────────────────────────┐
│                          组件层                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│   │ useXxxStore │  │useXxxContext│  │  直接订阅   │                 │
│   │  (新代码)   │  │ (旧代码兼容) │  │  Selectors  │                 │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
└──────────┼────────────────┼────────────────┼────────────────────────┘
           │                │                │
┌──────────▼────────────────▼────────────────▼────────────────────────┐
│                    Zustand Stores (SSOT)                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │  UIStore     │ │SessionStore  │ │ CodexStore   │ │SettingsStore│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
           ↑                ↑                ↑
┌──────────┴────────────────┴────────────────┴────────────────────────┐
│              React Contexts (副作用 + 向后兼容)                      │
│  ┌───────────┐  ┌───────────────┐  ┌─────────────┐                  │
│  │ UIContext │  │SessionContext │  │CodexContext │                  │
│  └───────────┘  └───────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

**当前状态**: 渐进式迁移中（Context → Store）

### 四个 Zustand Stores

| Store | 职责 | 持久化 |
|-------|------|--------|
| UIStore | 侧边栏、面板、设置弹窗 | ❌ |
| SessionStore | 会话列表、消息、草稿、终端 | ✅ localStorage |
| CodexStore | 审批请求、消息队列、历史记录 | ❌ |
| SettingsStore | 应用设置（主题、快捷键） | ✅ localStorage + Tauri |

---

## 三、目录结构

```
./
├── src/                # React 前端
│   ├── api/            # Tauri invoke 包装
│   ├── components/     # UI + 业务组件
│   ├── contexts/       # React Contexts (待迁移)
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
├── docs/               # 文档
│   ├── ai/             # AI 工程资产
│   └── *.md            # 功能文档
└── scripts/            # 构建脚本
```

---

## 四、关键调用链

### 消息发送流程
```
ChatInput → useCodexContext.handleSendMessage
         → useMessageQueue.enqueueMessage
         → CodexContext.doSendMessage
         → api/codex.sendPrompt
         → Tauri invoke
         → Rust codex/commands.rs
         → Codex ACP sidecar
```

### Codex 事件流
```
Codex ACP → Rust events.rs emit
         → Tauri event
         → useCodexEvents listener
         → SessionStore/CodexStore update
         → 组件重渲染
```

---

## 五、当前里程碑

**正在进行**: Context → Store 迁移

详见 [MIGRATION_CONTEXT_TO_STORE.md](./MIGRATION_CONTEXT_TO_STORE.md)

---

## 六、关键文件路径

| 功能 | 路径 |
|------|------|
| 前端入口 | `src/main.tsx` → `src/App.tsx` |
| Stores | `src/stores/*.ts` |
| Contexts | `src/contexts/*.tsx` |
| Codex 事件 | `src/hooks/useCodexEvents.ts` |
| Tauri 命令 | `src-tauri/src/lib.rs` |
| 迁移计划 | `docs/ai/MIGRATION_CONTEXT_TO_STORE.md` |
