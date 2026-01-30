# Context → Store 迁移计划

**创建日期**: 2026-01-30
**完成日期**: 2026-01-30
**状态**: ✅ 完成
**目标**: 将 React Context 状态管理完全迁移到 Zustand Store

---

## 一、迁移目标

### 迁移前架构
```
Context (状态 + 副作用)  ──sync──>  Store (状态副本)
         ↓                              ↓
     组件订阅                       组件订阅 (细粒度)
```

### 迁移后架构
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
| **SessionContext** | sessions, messages, drafts, options | 持久化、选项缓存、CWD 操作 | ⭐⭐⭐ 高 | ✅ 完成 |
| **CodexContext** | approvals, queue, history | Tauri 事件订阅、API 调用、会话同步 | ⭐⭐⭐⭐ 极高 | ✅ 完成 |

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
| 1.1 | 将响应式布局逻辑移到 useUIStoreInit | `src/stores/useUIStoreInit.ts` | ✅ 完成 |
| 1.2 | 标记 useUIContext 为 @deprecated | `src/contexts/UIContext.tsx` | ✅ 已删除 |
| 1.3 | 更新 App.tsx 使用 Store | `src/App.tsx` | ✅ 完成 |

### 阶段 2：迁移 SessionContext 核心状态
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 2.1 | 增强 SessionStore actions | `src/stores/sessionStore.ts` | ✅ 完成 |
| 2.2 | 创建 Session Effects Hook | `src/hooks/useSessionEffects.ts` | ✅ 完成 |
| 2.3 | 重构文件/CWD 操作 Hook | `src/hooks/useFileAndCwdActions.ts` | ✅ 完成 |
| 2.4 | 移除 SessionContext | `src/contexts/SessionContext.tsx` | ✅ 已删除 |

### 阶段 3：迁移 CodexContext
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 3.1 | 增强 CodexStore (会话映射) | `src/stores/codexStore.ts` | ✅ 完成 |
| 3.2 | 创建 Codex Effects Hook | `src/hooks/useCodexEffects.ts` | ✅ 完成 |
| 3.3 | 创建 Codex Actions Hook | `src/hooks/useCodexActions.ts` | ✅ 完成 |
| 3.4 | 移除 CodexContext | `src/contexts/CodexContext.tsx` | ✅ 已删除 |

### 阶段 4：重构 App.tsx 和组件层
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 4.1 | App.tsx 直接使用 Store | `src/App.tsx` | ✅ 完成 |
| 4.2 | 移除 Context Providers | `src/App.tsx` | ✅ 完成 |

### 阶段 5：清理和优化
**状态**: ✅ 完成

| ID | 任务 | 文件 | 状态 |
|----|------|------|------|
| 5.1 | 移除 src/contexts/ 目录 | `src/contexts/` | ✅ 已删除 |
| 5.2 | 移除同步 hooks | `src/stores/use*StoreSync.ts` | ✅ 已删除 |
| 5.3 | 移除 useCodexSessionSync | `src/hooks/useCodexSessionSync.ts` | ✅ 已删除 |
| 5.4 | 更新 stores/index.ts 导出 | `src/stores/index.ts` | ✅ 完成 |
| 5.5 | 运行全量测试 | - | ✅ 通过 (101 tests) |
| 5.6 | 性能测试 | `scripts/benchmark.mjs` | ✅ 完成 |

---

## 四、文件变更清单

### 新增文件
```
src/hooks/
├── useSessionEffects.ts      # Session 副作用 (auto-select model/mode)
├── useCodexEffects.ts        # Codex 副作用 (init, events, ensureSession)
├── useCodexActions.ts        # Codex 业务操作 (model/mode change, send)
└── useApprovalCards.ts       # 审批卡片 (重构为 Store-based)

scripts/
└── benchmark.mjs             # 性能测试脚本
```

### 修改文件
```
src/stores/
├── index.ts                  # 移除已删除文件的导出
├── sessionStore.ts           # 增强 actions
├── codexStore.ts             # 增加会话映射
└── uiStore.ts                # devtools 中间件

src/hooks/
├── useCodexEvents.ts         # 重构为直接使用 Store
└── useFileAndCwdActions.ts   # 添加 Store-based 版本

src/App.tsx                    # 完全移除 Context Providers
```

### 删除文件
```
src/contexts/                  # 整个目录删除
├── index.ts
├── UIContext.tsx
├── SessionContext.tsx
└── CodexContext.tsx

src/stores/
├── useSessionStoreSync.ts
└── useCodexStoreSync.ts

src/hooks/
└── useCodexSessionSync.ts
```

---

## 五、技术细节

### 5.1 useCodexEvents 重构

重构前：接收大量 setState 函数作为参数
```typescript
useCodexEvents({
  resolveChatSessionId,
  activeSessionIdRef,
  setSessionMessages,
  setIsGeneratingBySession,
  // ... 更多参数
});
```

重构后：直接使用 Store actions
```typescript
export function useCodexEvents(callbacks?: CodexEventsCallbacks): void {
  // 内部直接使用 Store
  useSessionStore.getState().setIsGenerating(sessionId, false);
  useCodexStore.getState().registerApprovalRequest(event.payload);
}
```

### 5.2 useCodexEffects 整合

整合 useCodexSessionSync 的 ensureCodexSession 逻辑：
```typescript
export function useCodexEffects(): void {
  // 初始化 Codex
  useEffect(() => { initCodex(); }, []);

  // 设置事件监听
  useCodexEvents({ onModeOptionsResolved, onModelOptionsResolved });

  // ensureCodexSession 逻辑
  const ensureCodexSession = useCallback(async (chatSessionId: string) => {
    // 创建 Codex session，同步 mode/model
  }, [t]);

  // 全局注册供 useCodexActions 使用
  useEffect(() => {
    setGlobalEnsureCodexSession(ensureCodexSession);
  }, [ensureCodexSession]);
}
```

### 5.3 App.tsx 简化

迁移前：
```typescript
export function App() {
  return (
    <SessionProvider>
      <CodexProvider>
        <AppContent />
      </CodexProvider>
    </SessionProvider>
  );
}
```

迁移后：
```typescript
export function App() {
  useUIStoreInit();
  useSessionEffects();
  useCodexEffects();

  return <AppContent />;  // 无 Providers
}
```

---

## 六、性能测试结果

### Benchmark (2026-01-30)

```json
{
  "date": "2026-01-30T12:53:54.066Z",
  "migration": "Context → Store",
  "status": "COMPLETE",
  "metrics": {
    "storeCount": 7,
    "contextCount": 0,
    "hookCount": 29,
    "mainBundleSize": 445975,
    "mainBundleName": "markdown-DwWbszTT.js",
    "totalJsSize": 1234917,
    "totalCssSize": 121785,
    "totalSize": 1356702,
    "jsFileCount": 15,
    "cssFileCount": 10,
    "buildTime": 4241,
    "testTime": 1025
  }
}
```

### 关键指标

| 指标 | 值 | 说明 |
|------|----|----|
| Zustand Stores | 7 | 状态管理模块 |
| React Contexts | 0 | 已全部移除 |
| Hooks | 29 | 包括 Effect 和 Action hooks |
| Total JS Bundle | 1.18 MB | 15 个 JS 文件 |
| Total CSS | 119 KB | 10 个 CSS 文件 |
| Build Time | 4.24s | 清洁构建 |
| Test Time | 1.02s | 101 个测试 |

---

## 七、验收标准

- [x] 所有测试通过 (`npm run test:unit` - 101 tests)
- [x] 构建成功 (`npm run build`)
- [x] 无 `useSessionContext`、`useCodexContext`、`useUIContext` 调用
- [x] 无 `useSessionStoreSync`、`useCodexStoreSync` 文件
- [x] `src/contexts/` 目录已删除
- [x] Store devtools 在开发模式可用
- [x] 性能测试完成

---

## 八、变更日志

| 日期 | 阶段 | 变更内容 |
|------|------|----------|
| 2026-01-30 | 5 | **完成迁移**：删除 contexts/、同步 hooks、useCodexSessionSync；运行 benchmark |
| 2026-01-30 | 5 | 重构 useCodexEvents 直接使用 Store；整合 useCodexEffects |
| 2026-01-30 | 4 | 重写 App.tsx 移除所有 Context Providers |
| 2026-01-30 | 3 | 完成 CodexContext 迁移：增强 CodexStore，创建 useCodexEffects 和 useCodexActions |
| 2026-01-30 | 2 | 完成 SessionContext 迁移：创建 useSessionEffects，useFileAndCwdActionsFromStore |
| 2026-01-30 | 1 | 完成 UIContext 迁移：App.tsx 使用 UIStore |
| 2026-01-30 | 0 | 完成准备工作：devtools、测试基础设施 |
| 2026-01-30 | 0.1 | 创建迁移计划文档 |

---

## 九、参考资料

- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)
- [src/stores/MIGRATION.md](../../src/stores/MIGRATION.md) - Store 迁移指南
- [src/AGENTS.md](../../src/AGENTS.md) - 前端架构规范
- [scripts/benchmark.mjs](../../scripts/benchmark.mjs) - 性能测试脚本
