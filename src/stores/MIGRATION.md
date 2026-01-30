# Zustand 迁移指南

本文档说明如何将组件从 React Context 迁移到 Zustand stores。

## 当前状态

**迁移已完成！ ✅**

### Store 作为 SSOT（单一真实来源）

- `UIStore` - ✅ 完全迁移
- `SessionStore` - ✅ 完全迁移
- `CodexStore` - ✅ 完全迁移

### Context 状态

所有 Context 已删除：

- `src/contexts/` 目录已删除
- `useSessionStoreSync.ts` 已删除
- `useCodexStoreSync.ts` 已删除
- `useCodexSessionSync.ts` 已删除

### Effect Hooks（副作用处理）

- `useUIStoreInit` - 响应式布局检测
- `useSessionEffects` - 自动选择 model/mode
- `useCodexEffects` - Codex 初始化、事件监听、ensureCodexSession
- `useCodexActions` - 业务操作（model/mode 变更、消息发送等）

## 概述

Zustand stores 位于 `src/stores/` 目录：

- `uiStore.ts` - UI 状态（侧边栏、面板、设置）
- `sessionStore.ts` - 会话状态（消息、草稿、选项）
- `codexStore.ts` - Codex 交互状态（审批、队列、历史、会话映射）
- `useUIStoreInit.ts` - UI 副作用初始化

## 使用策略

**所有组件**：直接使用 store selectors + effect hooks

## 代码示例

### UI 状态

```tsx
import { useUIStore, useSidebarVisible } from '../stores';

function MyComponent() {
  // 方式 1：使用细粒度 selector（推荐，最小化重渲染）
  const sidebarVisible = useSidebarVisible();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  // 方式 2：使用组合 selector
  const { visible, toggle } = useSidebarState();

  return (
    <div>
      <button onClick={toggleSidebar}>{sidebarVisible ? 'Hide' : 'Show'}</button>
    </div>
  );
}
```

### Session 状态

```tsx
import { useCurrentMessages, useIsGenerating, useSessionStore } from '../stores';

function MessageList() {
  // 细粒度订阅 - 只在 messages 变化时重渲染
  const messages = useCurrentMessages();
  const isGenerating = useIsGenerating();
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);

  return <div>{messages.map(...)}</div>;
}
```

### Codex Actions

```tsx
import { useCodexActions } from '../hooks/useCodexActions';
import { useSessionStore, useModelOptions, useSelectedModel } from '../stores';

function ModelSelector() {
  // useCodexActions 自动获取 ensureCodexSession
  const { handleModelChange } = useCodexActions();
  const selectedModel = useSelectedModel();
  const modelOptions = useModelOptions();
  // ...
}
```

### Message Queue

```tsx
import { useCodexStore, useMessageQueueForSession } from '../stores';
import { useSessionStore } from '../stores';

function QueueIndicator() {
  const sessionId = useSessionStore((s) => s.selectedSessionId);
  const queue = useMessageQueueForSession(sessionId);
  const clearQueue = useCodexStore((s) => s.clearQueue);

  if (queue.length === 0) return null;
  return <button onClick={() => clearQueue(sessionId)}>Clear ({queue.length})</button>;
}
```

## 可用的 Selectors

### UIStore Selectors

```tsx
useSidebarVisible(); // boolean
useIsNarrowLayout(); // boolean
useSidePanelVisible(); // boolean
useActiveSidePanelTab(); // SidePanelTab
useSidePanelWidth(); // number
useSettingsOpen(); // boolean

// 组合 selectors
useSidebarState(); // { visible, isNarrowLayout, toggle }
useSidePanelState(); // { visible, activeTab, width, setVisible, ... }
useSettingsModalState(); // { isOpen, open, close }
```

### SessionStore Selectors

```tsx
useActiveSession(); // ChatSession | undefined
useCurrentMessages(); // Message[]
useCurrentDraft(); // string
useIsGenerating(); // boolean
useSelectedModel(); // string
useSelectedMode(); // string
useSelectedCwd(); // string | undefined
useSessionNotice(); // SessionNotice | undefined
useModelOptions(); // SelectOption[]
useAgentOptions(); // SelectOption[] | undefined
useSlashCommands(); // string[]
useCwdLocked(); // boolean
useActiveTerminalId(); // string | undefined
useCurrentPlan(); // PlanStep[] | undefined

// 完整视图状态（用于需要多个值的组件）
useSessionViewState(); // { activeSession, messages, ... }
```

### CodexStore Selectors

```tsx
usePendingApprovals(sessionId); // ApprovalRequest[]
useMessageQueueForSession(sessionId); // QueuedMessage[]
useHasQueuedMessages(sessionId); // boolean
usePromptHistory(); // string[]
useCodexSessionId(chatId); // string | undefined
useIsPendingSessionInit(chatId); // boolean
```

## 最佳实践

1. **优先使用细粒度 selectors**

   ```tsx
   // ✅ 好：只在 messages 变化时重渲染
   const messages = useCurrentMessages();

   // ❌ 避免：任何 session 状态变化都会重渲染
   const { messages, drafts, notices, ... } = useSessionStore();
   ```

2. **在组件外部定义 selectors（如需要复杂选择）**

   ```tsx
   // 在组件外部定义
   const selectUnreadCount = (state) => state.messages.filter((m) => !m.read).length;

   // 在组件内使用
   const unreadCount = useSessionStore(selectUnreadCount);
   ```

3. **使用 shallow 比较优化对象 selectors**

   ```tsx
   import { shallow } from 'zustand/shallow';

   const { a, b } = useSessionStore((state) => ({ a: state.a, b: state.b }), shallow);
   ```

## 注意事项

1. **副作用处理**：复杂的副作用（如 Tauri 事件监听）在 Effect Hooks 中处理
2. **持久化**：SessionStore 使用 `persist` middleware 自动持久化到 localStorage
3. **类型安全**：所有 stores 和 selectors 都有完整的 TypeScript 类型
4. **DevTools**：开发模式下可使用 Redux DevTools 查看 store 状态
