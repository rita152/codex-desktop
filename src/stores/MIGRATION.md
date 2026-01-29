# Zustand 迁移指南

本文档说明如何将组件从 React Context 迁移到 Zustand stores。

## 当前状态

**迁移已完成！** 所有 Contexts 现在内部使用 Zustand stores：

- `UIContext` → 委托给 `UIStore`
- `SessionContext` → 同步状态到 `SessionStore`
- `CodexContext` → 同步状态到 `CodexStore`

## 概述

Zustand stores 位于 `src/stores/` 目录：

- `uiStore.ts` - UI 状态（侧边栏、面板、设置）
- `sessionStore.ts` - 会话状态（消息、草稿、选项）
- `codexStore.ts` - Codex 交互状态（审批、队列、历史）
- `useSessionStoreSync.ts` - Context → Store 同步
- `useCodexStoreSync.ts` - Context → Store 同步

## 使用策略

**现有组件**：继续使用 `useXxxContext()` hooks，它们现在内部使用 stores

**新组件或性能优化**：直接使用 store selectors 获得更细粒度的订阅

## 迁移示例

### 从 UIContext 迁移

**旧代码（使用 Context）：**

```tsx
import { useUIContext } from '../contexts';

function MyComponent() {
  const { sidebarVisible, toggleSidebar, settingsOpen } = useUIContext();

  return (
    <div>
      <button onClick={toggleSidebar}>{sidebarVisible ? 'Hide' : 'Show'}</button>
    </div>
  );
}
```

**新代码（使用 Zustand）：**

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

### 从 SessionContext 迁移

**旧代码：**

```tsx
import { useSessionContext } from '../contexts';

function MessageList() {
  const { messages, isGenerating, selectedSessionId } = useSessionContext();

  return <div>{messages.map(...)}</div>;
}
```

**新代码：**

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

### 从 CodexContext 迁移

**旧代码：**

```tsx
import { useCodexContext } from '../contexts';

function QueueIndicator() {
  const { currentQueue, hasQueuedMessages, handleClearQueue } = useCodexContext();

  if (!hasQueuedMessages) return null;
  return <button onClick={handleClearQueue}>Clear ({currentQueue.length})</button>;
}
```

**新代码：**

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

1. **副作用处理**：复杂的副作用（如 Tauri 事件监听）仍保留在 hooks 中
2. **持久化**：SessionStore 使用 `persist` middleware 自动持久化到 localStorage
3. **类型安全**：所有 stores 和 selectors 都有完整的 TypeScript 类型
