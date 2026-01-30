# Context → Store 迁移计划

**创建日期**: 2026-01-30
**状态**: 📋 计划中
**目标**: 将 React Context 状态管理完全迁移到 Zustand Store

---

## 一、迁移目标

### 当前架构
```
Context (状态 + 副作用)  ──sync──>  Store (状态副本)
         ↓                              ↓
     组件订阅                       组件订阅 (细粒度)
```

### 目标架构
```
Store (SSOT)  <────  Effect Hooks (副作用)
     ↓                     ↓
 组件订阅               Tauri API / Events
```

### 核心原则
- Store 是唯一状态源（Single Source of Truth）
- 副作用逻辑独立到专门的 Effect Hooks
- 移除 Context → Store 的同步层
- 组件直接订阅 Store

---

## 二、迁移范围

| Context | 状态 | 副作用 | 复杂度 | 状态 |
|---------|------|--------|--------|------|
| **UIContext** | 已委托给 UIStore | 响应式布局检测 | ⭐ 低 | ✅ 完成 |
| **SessionContext** | sessions, messages, drafts, options | 持久化、选项缓存、CWD 操作 | ⭐⭐⭐ 高 | 🔄 进行中 |
| **CodexContext** | approvals, queue, history | Tauri 事件订阅、API 调用、会话同步 | ⭐⭐⭐⭐ 极高 | ⏳ 待开始 |

---

## 三、分阶段计划

### 阶段 0：准备工作
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 0.1 | 创建迁移追踪文件 | `docs/ai/MIGRATION_CONTEXT_TO_STORE.md` | ✅ 完成 |
| 0.2 | 添加 Zustand devtools 中间件 | `src/stores/*.ts` | ✅ 完成 |
| 0.3 | 完善 Store 类型导出 | `src/stores/index.ts` | ✅ 完成 |
| 0.4 | 创建测试基础设施 | `src/stores/*.test.ts` | ✅ 完成 |

### 阶段 1：完成 UIContext 迁移
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 1.1 | 将响应式布局逻辑移到 useUIStoreInit | `src/stores/useUIStoreInit.ts` | ✅ 完成 (已有) |
| 1.2 | 标记 useUIContext 为 @deprecated | `src/contexts/UIContext.tsx` | ✅ 完成 |
| 1.3 | 更新 App.tsx 使用 Store | `src/App.tsx` | ✅ 完成 |

### 阶段 2：迁移 SessionContext 核心状态
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 2.1 | 增强 SessionStore actions | `src/stores/sessionStore.ts` | ✅ 完成 (已有) |
| 2.2 | 创建 Session Effects Hook | `src/hooks/useSessionEffects.ts` | ✅ 完成 |
| 2.3 | 重构文件/CWD 操作 Hook | `src/hooks/useFileAndCwdActions.ts` | ✅ 完成 |
| 2.4 | 标记 SessionContext 为 @deprecated | `src/contexts/SessionContext.tsx` | ✅ 完成 |

**注**: useSessionStoreSync 的移除推迟到阶段 5（需要先完成 CodexContext 迁移）

### 阶段 3：迁移 CodexContext
**状态**: ⏳ 待开始

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 3.1 | 增强 CodexStore (会话映射) | `src/stores/codexStore.ts` | ⏳ 待开始 |
| 3.2 | 创建 Codex Effects Hook | `src/hooks/useCodexEffects.ts` | ⏳ 待开始 |
| 3.3 | 创建 Codex Actions Hook | `src/hooks/useCodexActions.ts` | ⏳ 待开始 |
| 3.4 | 移除 useCodexStoreSync | `src/stores/useCodexStoreSync.ts` | ⏳ 待开始 |

### 阶段 4：重构 App.tsx 和组件层
**状态**: ⏳ 待开始

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 4.1 | 重构 App.tsx 移除 Providers | `src/App.tsx` | ⏳ 待开始 |
| 4.2 | 更新依赖 Context 的组件 | 多个组件文件 | ⏳ 待开始 |

### 阶段 5：清理和优化
**状态**: ⏳ 待开始

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 5.1 | 移除 src/contexts/ 目录 | `src/contexts/` | ⏳ 待开始 |
| 5.2 | 移除同步 hooks | `src/stores/use*StoreSync.ts` | ⏳ 待开始 |
| 5.3 | 更新 MIGRATION.md 为完成状态 | `src/stores/MIGRATION.md` | ⏳ 待开始 |
| 5.4 | 更新 AGENTS.md 文档 | 多个 AGENTS.md | ⏳ 待开始 |
| 5.5 | 运行全量测试 | - | ⏳ 待开始 |
| 5.6 | 性能测试 | - | ⏳ 待开始 |

---

## 四、文件变更清单

### 新增文件
```
src/hooks/
├── useSessionEffects.ts      # Session 副作用 (auto-select model/mode)
├── useCodexEffects.ts        # Codex 副作用 (init, events)
├── useCodexActions.ts        # Codex 业务操作 (model/mode change, send)
└── useApprovalCards.ts       # 审批卡片派生状态 (重构)

src/stores/__tests__/
├── sessionStore.test.ts
├── codexStore.test.ts
└── integration.test.ts
```

### 修改文件
```
src/stores/
├── index.ts                  # 导出新 hooks
├── sessionStore.ts           # 增强 actions
├── codexStore.ts             # 增加会话映射
├── uiStore.ts                # 添加 devtools
└── useUIStoreInit.ts         # 增加响应式布局逻辑

src/hooks/
├── useFileAndCwdActions.ts   # 重构为使用 Store
├── useCodexSessionSync.ts    # 重构为使用 Store
└── useMessageQueue.ts        # 重构为使用 Store

src/App.tsx                    # 移除 Context Providers
```

### 删除文件
```
src/contexts/
├── index.ts
├── UIContext.tsx
├── SessionContext.tsx
└── CodexContext.tsx

src/stores/
├── useSessionStoreSync.ts
└── useCodexStoreSync.ts
```

---

## 五、技术细节

### 5.1 UIStore 增强 - devtools 中间件

```typescript
// src/stores/uiStore.ts
import { devtools } from 'zustand/middleware';

export const useUIStore = create<UIStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({ /* ... */ })),
    { name: 'UIStore', enabled: import.meta.env.DEV }
  )
);
```

### 5.2 SessionStore 新增 Actions

```typescript
// src/stores/sessionStore.ts
interface SessionActions {
  // 现有 actions...
  
  // 新增
  createNewChat: (cwd?: string, title?: string) => string;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  applyModelOptions: (payload: OptionsPayload) => void;
  applyModeOptions: (payload: OptionsPayload) => void;
}
```

### 5.3 CodexStore 新增会话映射

```typescript
// src/stores/codexStore.ts
interface CodexState {
  // 现有 state...
  
  // 新增
  codexSessionByChat: Record<string, string>;
  chatSessionByCodex: Record<string, string>;
}

interface CodexActions {
  // 现有 actions...
  
  // 新增
  registerCodexSession: (chatId: string, codexId: string) => void;
  clearCodexSession: (chatId: string) => void;
  getCodexSessionId: (chatId: string) => string | undefined;
  resolveChatSessionId: (codexId: string) => string | undefined;
}
```

### 5.4 Effect Hooks 模式

```typescript
// src/hooks/useSessionEffects.ts
export function useSessionEffects() {
  const store = useSessionStore;
  
  // 订阅 store 变化，执行副作用
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state) => state.modelOptions,
      (modelOptions) => {
        // 自动选择可用模型
        const { selectedModel, selectedSessionId } = store.getState();
        if (!modelOptions?.length) return;
        // ...
      }
    );
    return unsubscribe;
  }, []);
}
```

### 5.5 Actions Hook 模式

```typescript
// src/hooks/useCodexActions.ts
export function useCodexActions() {
  const sessionStore = useSessionStore;
  const codexStore = useCodexStore;
  const { t } = useTranslation();
  
  const handleModelChange = useCallback(async (modelId: string) => {
    const { selectedSessionId, sessions, updateSession, setNotice } = sessionStore.getState();
    // Optimistic update + API call + Rollback on error
  }, [t]);
  
  return { handleModelChange, handleModeChange, handleSendMessage, handleSessionDelete };
}
```

---

## 六、风险控制

| 风险 | 缓解措施 |
|------|----------|
| 功能回归 | 每阶段完成后运行 `npm run quality:gate` |
| 性能退化 | 使用 React DevTools Profiler 对比渲染次数 |
| 类型错误 | 迁移过程中保持 TypeScript strict 模式 |
| 向后兼容 | 阶段 1-4 保留 Context hooks（标记 deprecated），阶段 5 再删除 |

---

## 七、验收标准

- [ ] 所有测试通过 (`npm run test && npm run test:unit`)
- [ ] Quality gate 通过 (`npm run quality:gate`)
- [ ] 无 `useSessionContext`、`useCodexContext`、`useUIContext` 调用
- [ ] 无 `useSessionStoreSync`、`useCodexStoreSync` 文件
- [ ] `src/contexts/` 目录已删除
- [ ] Store devtools 在开发模式可用
- [ ] 渲染性能无明显退化

---

## 八、变更日志

| 日期 | 阶段 | 变更内容 |
|------|------|----------|
| 2026-01-30 | 2 | 完成 SessionContext 迁移基础：创建 useSessionEffects，添加 useFileAndCwdActionsFromStore |
| 2026-01-30 | 1 | 完成 UIContext 迁移：App.tsx 使用 UIStore，UIProvider 简化为 no-op |
| 2026-01-30 | 0 | 完成准备工作：devtools、测试基础设施 |
| 2026-01-30 | 0.1 | 创建迁移计划文档 |

---

## 九、参考资料

- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)
- [src/stores/MIGRATION.md](../../src/stores/MIGRATION.md) - 现有迁移指南
- [src/AGENTS.md](../../src/AGENTS.md) - 前端架构规范
