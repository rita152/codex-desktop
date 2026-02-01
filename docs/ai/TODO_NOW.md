# 当前任务追踪

**更新日期**: 2026-02-01

---

## 当前状态：无活跃任务

目前没有进行中的开发任务。

---

## 近期已完成功能

### 1. 历史会话加载与显示 (2026-02-01)

- ✅ 从 `~/.codex/sessions/` 加载 rollout 文件
- ✅ Sidebar 分组显示活跃/历史会话
- ✅ 点击历史会话恢复完整对话上下文
- ✅ 修复 `SessionConfigured` 事件消费问题

### 2. Prompt Enhance 功能 (2026-02-01)

- ✅ Ephemeral Session 方案实现
- ✅ `usePromptEnhance` Hook
- ✅ ChatInput 工具栏集成
- 详见：[PROMPT_ENHANCE_PLAN.md](./PROMPT_ENHANCE_PLAN.md)

### 3. 模型选择器优化 (2026-02-01)

- ✅ 修复启动时模型列表不加载问题
- ✅ 支持默认推理力度设置
- ✅ ModelSelector 子菜单边界检测

### 4. codex-acp 清理 (2026-02-01)

- ✅ 移除所有 codex-acp 依赖
- ✅ 统一使用 codex-core 直接集成
- ✅ 更新相关文档

---

## 详细变更记录

见 [CHANGELOG_DEV.md](./CHANGELOG_DEV.md)
