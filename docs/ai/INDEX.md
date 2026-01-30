# AI 工程资产索引

**更新日期**: 2026-01-30

---

## 目录结构

```
docs/ai/
├── INDEX.md                           # 本文件 - 资产索引
├── PROJECT_SNAPSHOT.md                # 项目快照 - 架构与关键路径
├── TODO_NOW.md                        # 当前任务清单
├── CHANGELOG_DEV.md                   # 开发变更日志
├── PROMPT_PIPELINE_OPTIMIZATION.md    # Prompt 链路优化方案（总览）
├── IMPL_GUIDE_PHASE1.md               # Phase 1: 冷启动优化
├── IMPL_GUIDE_PHASE2.md               # Phase 2: 响应可靠性
└── IMPL_GUIDE_PHASE3.md               # Phase 3: 渲染性能
```

---

## 文档说明

| 文档 | 用途 | 更新频率 |
|------|------|----------|
| [PROJECT_SNAPSHOT.md](./PROJECT_SNAPSHOT.md) | 项目架构、技术栈、关键调用链 | 架构变更时 |
| [TODO_NOW.md](./TODO_NOW.md) | 当前任务、阻塞项、待定决策 | 每次任务变更 |
| [CHANGELOG_DEV.md](./CHANGELOG_DEV.md) | 开发变更记录、影响面、回滚点 | 每次代码变更 |
| [PROMPT_PIPELINE_OPTIMIZATION.md](./PROMPT_PIPELINE_OPTIMIZATION.md) | Prompt 执行链路优化方案总览 | 优化实施时 |
| [IMPL_GUIDE_PHASE1.md](./IMPL_GUIDE_PHASE1.md) | Phase 1: 冷启动优化实施指南 | Phase 1 实施时 |
| [IMPL_GUIDE_PHASE2.md](./IMPL_GUIDE_PHASE2.md) | Phase 2: 响应可靠性实施指南 | Phase 2 实施时 |
| [IMPL_GUIDE_PHASE3.md](./IMPL_GUIDE_PHASE3.md) | Phase 3: 渲染性能实施指南 | Phase 3 实施时 |

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
3. 根据任务类型查阅相关优化/设计文档

### 关键文件快速定位

| 功能 | 前端 | 后端 |
|------|------|------|
| Codex 初始化 | `src/hooks/useCodexEffects.ts` | `src-tauri/src/codex/commands.rs` |
| 消息发送 | `src/hooks/useCodexActions.ts` | `src-tauri/src/codex/service.rs` |
| 事件处理 | `src/hooks/useCodexEvents.ts` | `src-tauri/src/codex/protocol.rs` |
| 消息渲染 | `src/hooks/codexEventMessageHandlers.ts` | - |
| 状态管理 | `src/stores/sessionStore.ts` | - |
| API 包装 | `src/api/codex.ts` | - |
| 进程管理 | - | `src-tauri/src/codex/process.rs` |
| 事件定义 | - | `src-tauri/src/codex/events.rs` |

---

## 相关 AGENTS.md 索引

| 位置 | 职责 |
|------|------|
| `/AGENTS.md` | 项目根 - 全局规范与构建命令 |
| `src/AGENTS.md` | 前端 - React/Zustand/Tauri 交互规范 |
| `src/hooks/AGENTS.md` | Hooks - 状态管理与事件订阅模式 |
| `src/api/AGENTS.md` | API 层 - invoke 包装规范 |
| `src-tauri/AGENTS.md` | 后端入口 - Tauri 命令注册 |
| `src-tauri/src/AGENTS.md` | 后端核心 - 模块边界与事件规范 |
| `src-tauri/src/codex/AGENTS.md` | Codex 域 - ACP 集成细节 |
| `docs/AGENTS.md` | 文档 - 文档规范 |
