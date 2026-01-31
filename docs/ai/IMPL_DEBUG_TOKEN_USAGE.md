# Debug & Token Usage 实现指南

**更新日期**: 2026-01-31
**状态**: 待实施

---

## 一、概述

### 1.1 目标

实现 codex-acp 发送但前端未处理的两个事件：
- `codex:token-usage` - 显示对话的 Token 消耗
- `codex:debug` - 开发调试面板

### 1.2 现有基础

| 项目 | 状态 | 位置 |
|------|------|------|
| TokenUsageEvent 类型 | ✅ 已存在 | `src/types/codex.ts` |
| DebugState 后端实现 | ✅ 已存在 | `src-tauri/src/codex/debug.rs` |
| 事件常量定义 | ✅ 已存在 | `src-tauri/src/codex/events.rs` |
| 前端监听 | ❌ 未实现 | `src/hooks/useCodexEvents.ts` |

---

## 二、数据结构

### 2.1 Token Usage

**后端 Payload** (从 `codex/token-usage` ExtNotification):

```typescript
// 已存在于 src/types/codex.ts
export interface TokenUsageEvent {
  sessionId: string;
  totalTokens: number;
  lastTokens?: number;
  contextWindow?: number | null;
  percentRemaining?: number | null;
}
```

**前端存储结构**:

```typescript
// 新增到 SessionState
interface TokenUsageData {
  totalTokens: number;
  lastTokens?: number;
  contextWindow?: number | null;
  percentRemaining?: number | null;
  updatedAt: number;
}

// sessionStore 扩展
sessionTokenUsage: Record<string, TokenUsageData>;
```

### 2.2 Debug Event

**后端 Payload** (从 `src-tauri/src/codex/debug.rs`):

```typescript
// 新增到 src/types/codex.ts
export interface DebugEvent {
  label: string;
  sessionId?: string;
  tsMs: number;
  dtMs: number;
  sincePromptMs?: number;
  sinceLastEventMs?: number;
  extra?: Record<string, unknown>;
}
```

**前端存储结构**:

```typescript
// 新建 src/stores/debugStore.ts
interface DebugState {
  enabled: boolean;
  events: DebugEvent[];
  maxEvents: number; // 默认 500，防止内存泄漏
}

interface DebugActions {
  setEnabled: (enabled: boolean) => void;
  addEvent: (event: DebugEvent) => void;
  clearEvents: () => void;
}
```

---

## 三、实现步骤

### Phase 1: Token Usage（~2h）

#### Step 1.1: 扩展 sessionStore

**文件**: `src/stores/sessionStore.ts`

**改动**:

```typescript
// 1. 添加类型
interface TokenUsageData {
  totalTokens: number;
  lastTokens?: number;
  contextWindow?: number | null;
  percentRemaining?: number | null;
  updatedAt: number;
}

// 2. 扩展 SessionState
interface SessionState {
  // ... existing
  sessionTokenUsage: Record<string, TokenUsageData>;
}

// 3. 扩展 SessionActions
interface SessionActions {
  // ... existing
  updateTokenUsage: (sessionId: string, usage: TokenUsageData) => void;
  clearTokenUsage: (sessionId: string) => void;
}

// 4. 初始状态
sessionTokenUsage: {},

// 5. 实现 actions
updateTokenUsage: (sessionId, usage) =>
  set((state) => ({
    sessionTokenUsage: { ...state.sessionTokenUsage, [sessionId]: usage },
  })),

clearTokenUsage: (sessionId) =>
  set((state) => {
    const { [sessionId]: _, ...rest } = state.sessionTokenUsage;
    return { sessionTokenUsage: rest };
  }),

// 6. 添加 selector hook
export const useTokenUsage = (sessionId: string) =>
  useSessionStore((state) => state.sessionTokenUsage[sessionId]);
```

#### Step 1.2: 添加事件监听

**文件**: `src/hooks/useCodexEvents.ts`

**改动**:

```typescript
// 1. 导入类型
import type { TokenUsageEvent } from '../types/codex';

// 2. 在 unlistenPromises 数组中添加
listen<TokenUsageEvent>('codex:token-usage', (event) => {
  if (!isListenerActive()) return;
  const sessionId = resolveChatSessionId(event.payload.sessionId);
  if (!sessionId) return;
  useSessionStore.getState().updateTokenUsage(sessionId, {
    totalTokens: event.payload.totalTokens,
    lastTokens: event.payload.lastTokens,
    contextWindow: event.payload.contextWindow,
    percentRemaining: event.payload.percentRemaining,
    updatedAt: Date.now(),
  });
}),
```

#### Step 1.3: 创建 TokenUsage 组件

**文件**: `src/components/ui/feedback/TokenUsage/index.tsx`

```typescript
import { memo } from 'react';
import { useTokenUsage } from '../../../../stores/sessionStore';
import './TokenUsage.css';

interface TokenUsageProps {
  sessionId: string;
}

export const TokenUsage = memo(function TokenUsage({ sessionId }: TokenUsageProps) {
  const usage = useTokenUsage(sessionId);

  if (!usage) return null;

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="token-usage">
      <span className="token-usage-total">
        🔢 {formatNumber(usage.totalTokens)} tokens
      </span>
      {usage.percentRemaining != null && (
        <span className="token-usage-remaining">
          📊 {Math.round(usage.percentRemaining)}% remaining
        </span>
      )}
    </div>
  );
});

export default TokenUsage;
```

**文件**: `src/components/ui/feedback/TokenUsage/TokenUsage.css`

```css
.token-usage {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border-radius: 4px;
}

.token-usage-total {
  font-variant-numeric: tabular-nums;
}

.token-usage-remaining {
  font-variant-numeric: tabular-nums;
}
```

#### Step 1.4: 集成到 ChatContainer

**文件**: `src/components/business/ChatContainer/index.tsx`

在聊天区域底部添加 TokenUsage 组件（具体位置需读取现有代码确定）。

---

### Phase 2: Debug Panel（~3.5h）

#### Step 2.1: 添加 DebugEvent 类型

**文件**: `src/types/codex.ts`

```typescript
export interface DebugEvent {
  label: string;
  sessionId?: string;
  tsMs: number;
  dtMs: number;
  sincePromptMs?: number;
  sinceLastEventMs?: number;
  extra?: Record<string, unknown>;
}
```

#### Step 2.2: 创建 debugStore

**文件**: `src/stores/debugStore.ts`

```typescript
import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import type { DebugEvent } from '../types/codex';

const MAX_EVENTS = 500;

interface DebugState {
  enabled: boolean;
  events: DebugEvent[];
  maxEvents: number;
}

interface DebugActions {
  setEnabled: (enabled: boolean) => void;
  addEvent: (event: DebugEvent) => void;
  clearEvents: () => void;
}

export type DebugStore = DebugState & DebugActions;

export const useDebugStore = create<DebugStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // State
      enabled: false,
      events: [],
      maxEvents: MAX_EVENTS,

      // Actions
      setEnabled: (enabled) => set({ enabled }),

      addEvent: (event) =>
        set((state) => {
          const events = [...state.events, event];
          // Trim to maxEvents if exceeded
          if (events.length > state.maxEvents) {
            return { events: events.slice(-state.maxEvents) };
          }
          return { events };
        }),

      clearEvents: () => set({ events: [] }),
    })),
    { name: 'debug-store' }
  )
);

// Selectors
export const useDebugEnabled = () => useDebugStore((state) => state.enabled);
export const useDebugEvents = () => useDebugStore((state) => state.events);
```

#### Step 2.3: 添加事件监听

**文件**: `src/hooks/useCodexEvents.ts`

```typescript
// 1. 导入
import type { DebugEvent } from '../types/codex';
import { useDebugStore } from '../stores/debugStore';

// 2. 在 unlistenPromises 数组中添加
listen<DebugEvent>('codex:debug', (event) => {
  if (!isListenerActive()) return;
  const { enabled, addEvent } = useDebugStore.getState();
  if (!enabled) return;
  addEvent(event.payload);
}),
```

#### Step 2.4: 扩展 uiStore

**文件**: `src/stores/uiStore.ts`

```typescript
// 添加到 UIState
showDebugPanel: boolean;

// 添加到 UIActions
setShowDebugPanel: (show: boolean) => void;
toggleDebugPanel: () => void;

// 实现
showDebugPanel: false,

setShowDebugPanel: (show) => set({ showDebugPanel: show }),

toggleDebugPanel: () =>
  set((state) => ({ showDebugPanel: !state.showDebugPanel })),
```

#### Step 2.5: 创建 DebugPanel 组件

**文件**: `src/components/business/DebugPanel/index.tsx`

```typescript
import { memo, useCallback } from 'react';
import { useDebugStore, useDebugEvents, useDebugEnabled } from '../../../stores/debugStore';
import { useUIStore } from '../../../stores/uiStore';
import './DebugPanel.css';

export const DebugPanel = memo(function DebugPanel() {
  const showPanel = useUIStore((state) => state.showDebugPanel);
  const events = useDebugEvents();
  const enabled = useDebugEnabled();
  const { setEnabled, clearEvents } = useDebugStore.getState();
  const closePanel = useUIStore((state) => state.setShowDebugPanel);

  const handleClose = useCallback(() => closePanel(false), [closePanel]);
  const handleToggleEnabled = useCallback(
    () => setEnabled(!enabled),
    [enabled]
  );
  const handleClear = useCallback(() => clearEvents(), []);

  if (!showPanel) return null;

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <h3>🔧 Debug Panel</h3>
        <div className="debug-panel-actions">
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggleEnabled}
            />
            Enabled
          </label>
          <button onClick={handleClear}>Clear</button>
          <button onClick={handleClose}>×</button>
        </div>
      </div>
      <div className="debug-panel-content">
        <table>
          <thead>
            <tr>
              <th>Time (ms)</th>
              <th>Since Prompt</th>
              <th>Event</th>
              <th>Session</th>
              <th>Extra</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={index}>
                <td>{event.dtMs}</td>
                <td>{event.sincePromptMs ?? '-'}</td>
                <td>{event.label}</td>
                <td>{event.sessionId?.slice(0, 8) ?? '-'}</td>
                <td>
                  <code>{JSON.stringify(event.extra)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default DebugPanel;
```

#### Step 2.6: 添加快捷键

**文件**: `src/App.tsx` 或相关快捷键处理位置

```typescript
// 注册快捷键 Cmd+Shift+D (Mac) / Ctrl+Shift+D (Windows)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
      e.preventDefault();
      useUIStore.getState().toggleDebugPanel();
      // 同时启用 debug 收集
      const { enabled, setEnabled } = useDebugStore.getState();
      if (!enabled) setEnabled(true);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## 四、文件变更清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `src/stores/debugStore.ts` | Debug 状态管理 |
| `src/components/ui/feedback/TokenUsage/index.tsx` | Token 用量组件 |
| `src/components/ui/feedback/TokenUsage/TokenUsage.css` | Token 用量样式 |
| `src/components/business/DebugPanel/index.tsx` | Debug 面板组件 |
| `src/components/business/DebugPanel/DebugPanel.css` | Debug 面板样式 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/codex.ts` | 添加 DebugEvent 类型 |
| `src/stores/sessionStore.ts` | 添加 tokenUsage 状态和 actions |
| `src/stores/uiStore.ts` | 添加 showDebugPanel 状态 |
| `src/hooks/useCodexEvents.ts` | 添加两个事件监听 |
| `src/components/business/ChatContainer/index.tsx` | 集成 TokenUsage |
| `src/App.tsx` | 添加快捷键 + DebugPanel |

---

## 五、测试策略

### 单元测试

- [ ] `sessionStore.updateTokenUsage` 状态更新
- [ ] `debugStore.addEvent` 事件添加与裁剪
- [ ] `debugStore.clearEvents` 清空

### 组件测试 (Storybook)

- [ ] `TokenUsage` 各种数据状态
- [ ] `DebugPanel` 空状态、多事件状态

### 集成测试

- [ ] 发送 prompt 后 token-usage 事件显示
- [ ] 设置 `CODEX_DEBUG_TIMING=1` 后 debug 事件显示
- [ ] 快捷键切换 Debug Panel

---

## 六、回滚要点

如需回滚：

1. 删除新建的文件
2. 从修改的文件中移除相关代码
3. 核心代码无破坏性变更，可安全回滚
