# 开发变更日志

**更新日期**: 2026-01-31

---

## 2026-01-31

### [MIGRATION-001] 架构迁移计划制定

**类型**: 架构决策

**内容**:
- 分析 codex-acp 的限制（token usage 不支持、无法 kill session）
- 决定从 codex-acp 迁移到 codex-core 直接集成
- 创建详细迁移计划文档

**影响面**:
- `src-tauri/src/codex/` 目录大部分文件需要重写
- 依赖从 agent-client-protocol 切换到 codex-core

**新增能力**:
- TokenCountEvent 完整支持
- 临时会话 (ephemeral)
- Kill Session (remove_thread)
- 完整的 40+ EventMsg 事件流

**预估**: 2-3 天

---

## 变更记录模板

```markdown
### [变更标题]

**类型**: 功能 | Bug 修复 | 重构 | 文档

**内容**:
- 改动点

**影响面**:
- 文件/模块

**测试点**:
- [ ] 测试项

**回滚**:
- 步骤
```
