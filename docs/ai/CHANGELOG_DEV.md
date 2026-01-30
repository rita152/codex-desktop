# 开发变更日志

本文件记录项目的实质性变更，用于追踪进度和回滚参考。

---

## 2026-01-30

### 完成阶段 4：App.tsx 和组件层重构

**变更点**:
- 更新 `App.tsx`：添加迁移状态文档注释
- 验证组件依赖：确认只有 App.tsx 使用 Context
- 保留 Providers 作为过渡层（内部有复杂事件处理逻辑）

**影响面**:
- `src/App.tsx` - 添加迁移文档和 TODO 注释

**测试点**:
- `npm run lint` - 通过
- `npm run test:unit` - 101 测试全部通过
- `npx tsc --noEmit` - 类型检查通过

**决策说明**:
- Providers 暂时保留因为 CodexContext 内部使用 useCodexSessionSync 处理 Tauri 事件
- 完全移除需要重构事件处理逻辑，推迟到阶段 5

---

### 完成阶段 3：CodexContext 迁移基础

**变更点**:
- 增强 `CodexStore`：添加会话映射 (codexSessionByChat/chatSessionByCodex)
- 创建 `useCodexEffects.ts`：处理 Codex 初始化副作用
- 创建 `useCodexActions.ts`：提供 model/mode 变更、消息发送、会话删除等操作
- 更新 `CodexContext.tsx`：标记为 @deprecated
- 更新 `App.tsx`：添加 `useCodexEffects()` 初始化调用

**影响面**:
- `src/stores/codexStore.ts` - 添加会话映射 state 和 actions
- `src/hooks/useCodexEffects.ts` - 新增
- `src/hooks/useCodexActions.ts` - 新增
- `src/contexts/CodexContext.tsx` - 标记 deprecated
- `src/App.tsx` - 添加 useCodexEffects 调用

**测试点**:
- `npm run lint` - 通过
- `npm run test:unit` - 101 测试全部通过
- `npx tsc --noEmit` - 类型检查通过

**回滚要点**:
- 删除 `useCodexEffects.ts` 和 `useCodexActions.ts`
- 恢复 `CodexStore` 中的会话映射相关代码
- 恢复 `CodexContext.tsx` 注释
- 移除 `App.tsx` 中的 useCodexEffects 调用

---

### 完成阶段 2：SessionContext 迁移基础

**变更点**:
- 创建 `useSessionEffects.ts`：处理自动选择 model/mode 的副作用
- 重构 `useFileAndCwdActions.ts`：添加 `useFileAndCwdActionsFromStore()` (Store-based)
- 更新 `SessionContext.tsx`：标记为 @deprecated，移除重复的 auto-select 逻辑
- 更新 `App.tsx`：添加 `useSessionEffects()` 初始化调用

**影响面**:
- `src/hooks/useSessionEffects.ts` - 新增
- `src/hooks/useFileAndCwdActions.ts` - 添加 Store-based 版本
- `src/contexts/SessionContext.tsx` - 标记 deprecated
- `src/App.tsx` - 添加 useSessionEffects 调用

**测试点**:
- `npm run lint` - 通过
- `npm run test:unit` - 101 测试全部通过
- `npx tsc --noEmit` - 类型检查通过

**回滚要点**:
- 删除 `useSessionEffects.ts`
- 恢复 `useFileAndCwdActions.ts` 中的旧代码
- 恢复 `SessionContext.tsx` 中的 auto-select useEffect
- 移除 `App.tsx` 中的 useSessionEffects 调用

---

### 完成阶段 1：UIContext 迁移

**变更点**:
- 修改 App.tsx：移除 UIProvider，使用 useUIStoreInit()
- 修改 App.tsx：将 useUIContext() 替换为 UIStore 直接订阅
- 简化 UIContext.tsx：UIProvider 变为 no-op pass-through
- 增强 UIContext.tsx：添加完整的 @deprecated 文档

**影响面**:
- `src/App.tsx` - 移除 UIProvider，直接使用 UIStore
- `src/contexts/UIContext.tsx` - 简化为向后兼容层

**测试点**:
- `npm run lint` - 通过
- `npm run test:unit` - 101 测试全部通过
- `npx tsc --noEmit` - 类型检查通过

**回滚要点**:
- 恢复 App.tsx 使用 UIProvider 和 useUIContext
- 恢复 UIContext.tsx 中的响应式布局逻辑

---

### 完成阶段 0：迁移准备工作

**变更点**:
- 为四个 Store 添加 devtools 中间件（开发模式启用）
- 完善 `src/stores/index.ts` 类型导出和文档注释
- 创建测试工具文件 `src/stores/testUtils.ts`
- 创建 Store 单元测试（40 个测试用例全部通过）

**影响面**:
- `src/stores/uiStore.ts` - 添加 devtools
- `src/stores/sessionStore.ts` - 添加 devtools
- `src/stores/codexStore.ts` - 添加 devtools
- `src/stores/settingsStore.ts` - 添加 devtools
- `src/stores/index.ts` - 增强导出
- `src/stores/testUtils.ts` - 新文件
- `src/stores/*.test.ts` - 新测试文件

**测试点**:
- `npm run test:unit -- src/stores/*.test.ts` - 40 测试全部通过

**回滚要点**:
- 撤销 devtools 中间件添加
- 删除测试文件和 testUtils.ts

---

### 创建 Context → Store 迁移计划

**变更点**:
- 创建 `docs/ai/` 目录及标准文件
- 创建迁移计划文档 `MIGRATION_CONTEXT_TO_STORE.md`

**影响面**:
- 文档变更，无代码影响

**测试点**:
- N/A

**回滚要点**:
- 删除 `docs/ai/` 目录即可

---

## 模板

```markdown
## YYYY-MM-DD

### 变更标题

**变更点**:
- 具体改动 1
- 具体改动 2

**影响面**:
- 模块/接口/数据结构影响

**测试点**:
- 需要验证的功能点

**回滚要点**:
- 如何回滚此变更
```
