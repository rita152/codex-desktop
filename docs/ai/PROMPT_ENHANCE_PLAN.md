# Prompt Enhance 功能实施计划

**创建日期**: 2026-02-01  
**状态**: 进行中

---

## 一、功能概述

在用户输入 prompt 后，提供一键「优化 Prompt」功能：
- 创建一个**临时 ephemeral session** 专门用于 prompt 优化
- 发送优化请求，获取优化后的 prompt
- 完成后**立即 kill session**，释放资源
- 优化结果**直接替换输入框内容**

---

## 二、技术方案

### 方案选型：Ephemeral Session

| 特性 | 说明 |
|------|------|
| Session 类型 | `ephemeral: true`（不写 rollout 文件） |
| 生命周期 | 单次请求后立即销毁 |
| 上下文传递 | 不传递当前会话上下文 |
| 资源隔离 | 完全独立，不影响主会话 |

### 架构图

```
ChatInput
    │
    ├─ 点击「优化」按钮
    │
    ▼
usePromptEnhance (hook)
    │
    ├─ 1. createSession(cwd, ephemeral: true)
    ├─ 2. sendPrompt(sessionId, enhancePrompt)
    ├─ 3. 监听事件，收集响应
    ├─ 4. killSession(sessionId)
    │
    ▼
返回优化结果 → 替换输入框
```

---

## 三、实施步骤

### Step 1: 前端 API 层扩展

**文件**: `src/api/codex.ts`

| 改动 | 说明 |
|------|------|
| 修改 `createSession` | 添加 `ephemeral?: boolean` 参数 |
| 新增 `killSession` | 暴露 `codex_kill_session` command |

```typescript
// 新增
export async function killSession(sessionId: string): Promise<void> {
  await invoke<void>('codex_kill_session', { sessionId, session_id: sessionId });
}

// 修改
export async function createSession(cwd: string, ephemeral?: boolean): Promise<NewSessionResult> {
  return invoke<NewSessionResult>('codex_new_session', { cwd, ephemeral });
}
```

**状态**: [ ] 待实现

---

### Step 2: Prompt Enhance Hook

**文件**: `src/hooks/usePromptEnhance.ts` (新建)

**接口设计**:

```typescript
interface UsePromptEnhanceOptions {
  cwd?: string;
  systemPrompt?: string;
}

interface UsePromptEnhanceReturn {
  enhance: (prompt: string) => Promise<string | null>;
  isEnhancing: boolean;
  error: string | null;
  cancel: () => void;
}
```

**核心流程**:

1. `enhance(prompt)` 被调用
2. 创建 ephemeral session
3. 构造 enhance prompt（system prompt + 用户 prompt）
4. 发送到 session
5. 订阅事件，收集 `AgentMessage` / `AgentMessageDelta`
6. 监听 `TurnComplete` 事件
7. Kill session
8. 返回优化后的 prompt

**状态**: [ ] 待实现

---

### Step 3: UI 集成

**文件**: `src/components/business/ChatInput/index.tsx`

| 改动 | 说明 |
|------|------|
| 工具栏新增按钮 | 「优化 Prompt」图标按钮 |
| 状态展示 | `isEnhancing` 时显示 loading |
| 结果处理 | 优化成功后调用 `onInputChange(result)` |
| 错误处理 | 优化失败时显示 notice/toast |

**按钮位置**: 在工具栏（添加文件按钮旁边）

**交互流程**:
1. 用户在输入框输入内容
2. 点击「优化」按钮
3. 按钮显示 loading 状态，输入框可选禁用
4. 优化完成 → 替换输入框内容
5. 优化失败 → 显示错误提示，保留原内容

**状态**: [ ] 待实现

---

### Step 4: 类型定义

**文件**: `src/components/business/ChatInput/types.ts`

新增 props（如需要从外部传入配置）:

```typescript
// 可选：如果 hook 完全内聚，可能不需要新增 props
enhanceSystemPrompt?: string;
```

**状态**: [ ] 待实现

---

### Step 5: System Prompt 配置

**文件**: `src/constants/prompts.ts` (新建，待后续补充)

```typescript
export const PROMPT_ENHANCE_SYSTEM_PROMPT = `
You are a prompt optimization assistant.
... (待定义)
`;
```

**状态**: [ ] 待后续补充

---

## 四、关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/api/codex.ts` | 修改 | 添加 `killSession`, 修改 `createSession` |
| `src/hooks/usePromptEnhance.ts` | 新建 | 核心 hook |
| `src/components/business/ChatInput/index.tsx` | 修改 | 添加 UI 按钮和逻辑 |
| `src/components/business/ChatInput/ChatInput.css` | 修改 | 按钮样式 |
| `src/constants/prompts.ts` | 新建 | System prompt（待后续） |

---

## 五、依赖关系

```
Step 1 (API) 
    ↓
Step 2 (Hook) ← 依赖 Step 1
    ↓
Step 3 (UI) ← 依赖 Step 2
    ↓
Step 4/5 (类型/常量) ← 可并行
```

---

## 六、测试策略

- [ ] 单元测试：`usePromptEnhance` hook（可选）
- [ ] 手动测试：多次触发优化，验证 session 正确清理
- [ ] 边界测试：空 prompt、超长 prompt、网络错误
- [ ] 回归测试：确保主会话功能不受影响

---

## 七、风险与注意事项

| 风险 | 缓解措施 |
|------|----------|
| Session 泄漏 | 在 hook unmount 时自动 cleanup |
| 并发请求 | 同时只允许一个 enhance 请求 |
| 事件监听冲突 | 使用独立的 sessionId 过滤事件 |
| 用户取消 | 提供 `cancel()` 方法，kill session |

---

## 八、进度追踪

| Step | 任务 | 状态 | 完成日期 |
|------|------|------|----------|
| 1 | 前端 API 层扩展 | [ ] 待开始 | - |
| 2 | usePromptEnhance Hook | [ ] 待开始 | - |
| 3 | UI 集成 | [ ] 待开始 | - |
| 4 | 类型定义 | [ ] 待开始 | - |
| 5 | System Prompt | [ ] 待后续 | - |

---

## 九、验收标准

- [ ] 点击优化按钮，能够成功发送请求并获取结果
- [ ] 优化完成后，输入框内容被替换
- [ ] 优化失败时，显示错误提示且保留原内容
- [ ] 每次优化完成后，ephemeral session 被正确销毁
- [ ] 不影响主会话的正常使用
