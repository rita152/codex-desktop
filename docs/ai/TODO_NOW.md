# 当前任务清单

**更新日期**: 2026-01-31

---

## 进行中

### [MIGRATION-001] ACP → codex-core 迁移

**状态**: 🟡 计划完成，待实施  
**优先级**: P0  
**文档**: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)

#### 实施阶段

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 依赖切换 (Cargo.toml) | 2h | ⬜ |
| 2 | 核心服务层 (core_service.rs) | 4h | ⬜ |
| 3 | 事件桥接层 (event_bridge.rs) | 2h | ⬜ |
| 4 | 命令层更新 (commands.rs) | 1h | ⬜ |
| 5 | 类型/事件常量更新 | 1h | ⬜ |
| 6 | 清理旧代码 | 1h | ⬜ |
| 7 | 前端调整 | 1h | ⬜ |
| 8 | 测试 & 修复 | 4h | ⬜ |

**总计**: ~16h (2-3 天)

#### 下一步

1. [ ] 修改 `src-tauri/Cargo.toml` 添加 codex-core 依赖
2. [ ] 创建 `src-tauri/src/codex/core_service.rs`
3. [ ] 创建 `src-tauri/src/codex/event_bridge.rs`

---

## 待开始

| 任务 | 依赖 | 优先级 |
|------|------|--------|
| Token Usage UI | MIGRATION-001 | P2 |
| 临时会话支持 | MIGRATION-001 | P2 |
| Kill Session 功能 | MIGRATION-001 | P2 |

---

## 已完成

- [x] 迁移计划文档编写

---

## 阻塞项

无
