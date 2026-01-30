# 当前任务

**更新日期**: 2026-01-30

---

## 🎯 当前状态

**Context → Store 迁移已完成 ✅**

React Context 状态管理已完全迁移到 Zustand Store，消除了双重状态源，简化了架构。

---

## 📋 迁移完成清单

| 阶段 | 任务 | 状态 |
|------|------|------|
| 阶段 0 | 准备工作 | ✅ 完成 |
| 阶段 1 | UIContext 迁移 | ✅ 完成 |
| 阶段 2 | SessionContext 迁移 | ✅ 完成 |
| 阶段 3 | CodexContext 迁移 | ✅ 完成 |
| 阶段 4 | App.tsx 重构 | ✅ 完成 |
| 阶段 5 | 清理和优化 | ✅ 完成 |

---

## 📊 最终架构

```
Store (SSOT)  <────  Effect Hooks (副作用)
     ↓                     ↓
 组件订阅               Tauri API / Events
```

### Stores (7)
- `UIStore` - UI 状态（侧边栏、面板、设置弹窗）
- `SessionStore` - 会话状态（sessions、messages、drafts、options）
- `CodexStore` - Codex 状态（approvals、queue、history、session mapping）
- `SettingsStore` - 应用设置

### Effect Hooks
- `useUIStoreInit` - 响应式布局
- `useSessionEffects` - 自动选择 model/mode
- `useCodexEffects` - Codex 初始化、事件监听、ensureCodexSession

### Action Hooks
- `useCodexActions` - model/mode 变更、消息发送、会话删除
- `useFileAndCwdActionsFromStore` - 文件和 CWD 操作
- `useApprovalCardsFromStore` - 审批卡片

---

## 🚧 已删除的文件

### src/contexts/ (整个目录)
- `index.ts`
- `UIContext.tsx`
- `SessionContext.tsx`
- `CodexContext.tsx`

### src/stores/
- `useSessionStoreSync.ts`
- `useCodexStoreSync.ts`

### src/hooks/
- `useCodexSessionSync.ts`

---

## 📝 性能测试结果

```json
{
  "date": "2026-01-30",
  "storeCount": 7,
  "contextCount": 0,
  "hookCount": 29,
  "totalJsSize": "1.18 MB",
  "buildTime": "4.24s",
  "testTime": "1.02s (101 tests)"
}
```

---

## ⏭️ 下一步

迁移已完成。可能的后续优化：

1. **性能优化**：分析组件渲染，添加更细粒度的 selectors
2. **代码清理**：移除 legacy API（如 `useApprovalCards` 的旧版本）
3. **测试增强**：为新的 hooks 添加更多测试用例
