# AI 工程资产索引

**更新日期**: 2026-01-31

---

## 目录结构

```
docs/ai/
├── INDEX.md                    # 本文件 - 资产索引
├── PROJECT_SNAPSHOT.md         # 项目快照 - 架构与关键路径
├── TODO_NOW.md                 # 当前任务清单
├── CHANGELOG_DEV.md            # 开发变更日志
└── IMPL_DEBUG_TOKEN_USAGE.md   # Debug & Token Usage 实现指南
```

---

## 文档说明

| 文档 | 用途 | 更新频率 |
|------|------|----------|
| [PROJECT_SNAPSHOT.md](./PROJECT_SNAPSHOT.md) | 项目架构、技术栈、关键调用链 | 架构变更时 |
| [TODO_NOW.md](./TODO_NOW.md) | 当前任务、阻塞项、待定决策 | 每次任务变更 |
| [CHANGELOG_DEV.md](./CHANGELOG_DEV.md) | 开发变更记录、影响面、回滚点 | 每次代码变更 |
| [IMPL_DEBUG_TOKEN_USAGE.md](./IMPL_DEBUG_TOKEN_USAGE.md) | Debug 与 Token Usage 功能实现 | 实施期间 |

---

## 快速导航

### 了解项目

1. 阅读 [PROJECT_SNAPSHOT.md](./PROJECT_SNAPSHOT.md) 了解整体架构
2. 查看 `/AGENTS.md` 了解项目规范
3. 查看 `src/AGENTS.md` 了解前端规范
4. 查看 `src-tauri/AGENTS.md` 了解后端规范

### 开始任务

1. 查看 [TODO_NOW.md](./TODO_NOW.md) 了解当前任务
2. 查看 [CHANGELOG_DEV.md](./CHANGELOG_DEV.md) 了解近期变更
3. 根据任务类型查阅相关实现文档

### 关键文件快速定位

| 功能 | 前端 | 后端 |
|------|------|------|
| Codex 事件 | `src/hooks/useCodexEvents.ts` | `src-tauri/src/codex/events.rs` |
| 消息发送 | `src/hooks/useCodexActions.ts` | `src-tauri/src/codex/service.rs` |
| 事件协议 | `src/utils/codexParsing.ts` | `src-tauri/src/codex/protocol.rs` |
| 会话状态 | `src/stores/sessionStore.ts` | - |
| Codex 状态 | `src/stores/codexStore.ts` | - |
| API 包装 | `src/api/codex.ts` | - |
| Debug 调试 | - | `src-tauri/src/codex/debug.rs` |
