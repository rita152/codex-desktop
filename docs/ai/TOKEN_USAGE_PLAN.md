# Token Usage 功能实施计划

**创建日期**: 2026-02-01  
**更新日期**: 2026-02-01  
**状态**: 待实施  
**目标**: 在 ChatInput 工具栏展示当前对话的剩余上下文 token 百分比

---

## 一、需求概述

### 1.1 功能目标

在 ChatInput 工具栏展示当前对话的**剩余上下文 token 百分比**，帮助用户了解对话上下文的使用情况。

### 1.2 展示形式

- 格式：**圆形进度条**（环形）
- 位置：ChatInput 工具栏右侧，ModelSelector 左边
- 交互：鼠标悬浮时显示 tooltip **"72% left"**
- 颜色编码：
  - `>= 40%`：正常灰色
  - `20% - 39%`：警告黄色
  - `< 20%`：危险红色
- 无数据时：不显示

### 1.3 UI 布局

```
┌─────────────────────────────────────────────────────────┐
│ [TextArea]                                              │
├─────────────────────────────────────────────────────────┤
│ [+] [Agent ▾]                   [◐]  [Model ▾] [Send]  │
└─────────────────────────────────────────────────────────┘
                                   ↑
                         圆形进度条，悬浮显示百分比
```

---

## 二、技术方案

### 2.1 方案选择：后端计算（方案 A）

**选择理由**：
- 直接复用 codex-protocol 的 `percent_of_context_window_remaining` 方法
- 与 TUI (codex-cli) 计算逻辑 100% 一致
- 前端只需读取 `percentRemaining` 字段，无需维护计算代码

### 2.2 TUI 参考实现

TUI 的计算逻辑（`codex-protocol/src/protocol.rs`）：

```rust
const BASELINE_TOKENS: i64 = 12000;  // 系统预留

pub fn percent_of_context_window_remaining(&self, context_window: i64) -> i64 {
    if context_window <= BASELINE_TOKENS { return 0; }
    
    let effective_window = context_window - BASELINE_TOKENS;
    let used = (self.tokens_in_context_window() - BASELINE_TOKENS).max(0);
    let remaining = (effective_window - used).max(0);
    
    ((remaining as f64 / effective_window as f64) * 100.0)
        .clamp(0.0, 100.0)
        .round() as i64
}
```

### 2.3 数据流

```
codex-core (TokenCountEvent)
    ↓
event_bridge.rs (计算 percentRemaining)
    ↓
Tauri Event: codex:token-usage
    ↓
useCodexEvents.ts (监听事件)
    ↓
sessionStore (存储 percentRemaining)
    ↓
ChatInput (展示 "72% left")
```

---

## 三、实施步骤

### Step 1：修改后端事件发送

**文件**: `src-tauri/src/codex/event_bridge.rs`

**改动内容**:

```rust
// === Token usage ===
EventMsg::TokenCount(token_event) => {
    // 计算剩余百分比（复用 codex-protocol 方法）
    let percent_remaining = token_event.info.as_ref().and_then(|info| {
        info.model_context_window.map(|window| {
            info.last_token_usage.percent_of_context_window_remaining(window)
        })
    });
    
    let _ = app.emit(
        EVENT_TOKEN_USAGE,
        json!({
            "sessionId": session_id,
            "info": &token_event.info,
            "rateLimits": &token_event.rate_limits,
            "percentRemaining": percent_remaining,
        }),
    );
}
```

**验收标准**: 编译通过，事件包含 `percentRemaining` 字段

---

### Step 2：更新前端类型定义

**文件**: `src/types/codex.ts`

**改动内容**:

```typescript
// 更新 TokenUsageEvent 接口
export interface TokenUsageEvent {
  sessionId: string;
  info: {
    totalTokenUsage: {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      reasoningOutputTokens: number;
      totalTokens: number;
    };
    lastTokenUsage: {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      reasoningOutputTokens: number;
      totalTokens: number;
    };
    modelContextWindow: number | null;
  } | null;
  rateLimits: unknown;
  percentRemaining: number | null;  // 后端计算好的百分比
}
```

**验收标准**: TypeScript 编译通过

---

### Step 3：新增 Store 状态和 Action

**文件**: `src/stores/sessionStore.ts`

**改动内容**:

1. 新增状态字段：
```typescript
interface SessionState {
  // ... 现有字段
  contextRemaining: Record<string, number | null>;  // sessionId -> percentRemaining
}
```

2. 初始值：
```typescript
contextRemaining: {},
```

3. 新增 action：
```typescript
setContextRemaining: (sessionId: string, percent: number | null) => void;
```

4. 新增 selector hook：
```typescript
export const useContextRemaining = () =>
  useSessionStore((state) => {
    const sessionId = state.selectedSessionId;
    return state.contextRemaining[sessionId] ?? null;
  });
```

5. 在 `clearSession` 中清理：
```typescript
const { [sessionId]: _ctx, ...restCtx } = state.contextRemaining;
// ...
contextRemaining: restCtx,
```

**验收标准**: store 能正确存储和读取 contextRemaining 状态

---

### Step 4：添加事件监听

**文件**: `src/hooks/useCodexEvents.ts`

**改动内容**:

在 `useEffect` 的 `unlistenPromises` 数组中添加：

```typescript
listen<{
  sessionId: string;
  info: unknown;
  rateLimits: unknown;
  percentRemaining: number | null;
}>('codex:token-usage', (event) => {
  if (!isListenerActive()) return;
  const sessionId = resolveChatSessionId(event.payload.sessionId);
  if (!sessionId) return;
  
  useSessionStore.getState().setContextRemaining(
    sessionId,
    event.payload.percentRemaining
  );
}),
```

**验收标准**: 发送消息后，store 中 contextRemaining 正确更新

---

### Step 5：更新 ChatInput 组件类型

**文件**: `src/components/business/ChatInput/types.ts`

**改动内容**:

```typescript
export interface ChatInputProps {
  // ... 现有 props
  
  /** 剩余上下文百分比 (0-100)，null 时不显示 */
  contextRemainingPercent?: number | null;
}
```

**验收标准**: TypeScript 编译通过

---

### Step 6：实现 ChatInput UI 展示

**文件**: `src/components/business/ChatInput/index.tsx`

**改动内容**:

1. 解构新 prop：
```typescript
export const ChatInput = memo(function ChatInput({
  // ... 现有 props
  contextRemainingPercent,
}: ChatInputProps) {
```

2. 在工具栏右侧添加展示（ModelSelector 左边）：
```tsx
<div className="chat-input__toolbar-right">
  {contextRemainingPercent != null && (
    <span
      className={cn(
        'chat-input__context-indicator',
        contextRemainingPercent < 20 && 'chat-input__context-indicator--danger',
        contextRemainingPercent >= 20 &&
          contextRemainingPercent < 40 &&
          'chat-input__context-indicator--warning'
      )}
    >
      {contextRemainingPercent}% left
    </span>
  )}
  <ModelSelector ... />
  <IconButton ... />
</div>
```

**验收标准**: 传入百分比时正确显示，颜色随数值变化

---

### Step 7：添加 CSS 样式

**文件**: `src/components/business/ChatInput/ChatInput.css`

**改动内容**:

```css
/* Context indicator */
.chat-input__context-indicator {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  padding: 0 var(--spacing-xs);
  white-space: nowrap;
  user-select: none;
}

.chat-input__context-indicator--warning {
  color: var(--color-warning);
}

.chat-input__context-indicator--danger {
  color: var(--color-error);
}
```

**验收标准**: 样式符合设计要求，颜色使用 CSS 变量

---

### Step 8：连接数据到 ChatInput

**文件**: 调用 ChatInput 的父组件（需确认具体文件）

**改动内容**:

```typescript
import { useContextRemaining } from '../../../stores/sessionStore';

// 在组件内
const contextRemainingPercent = useContextRemaining();

// 传递给 ChatInput
<ChatInput
  // ... 现有 props
  contextRemainingPercent={contextRemainingPercent}
/>
```

**验收标准**: 完整数据通路打通，UI 正确展示

---

## 四、文件改动清单

| 文件 | 操作 | Step |
|------|------|------|
| `src-tauri/src/codex/event_bridge.rs` | 修改 | 1 |
| `src/types/codex.ts` | 修改 | 2 |
| `src/stores/sessionStore.ts` | 修改 | 3 |
| `src/hooks/useCodexEvents.ts` | 修改 | 4 |
| `src/components/business/ChatInput/types.ts` | 修改 | 5 |
| `src/components/business/ChatInput/index.tsx` | 修改 | 6 |
| `src/components/business/ChatInput/ChatInput.css` | 修改 | 7 |
| ChatInput 父组件 | 修改 | 8 |

**总计**：修改 8 个文件，无新建文件

---

## 五、测试策略

### 5.1 手动测试

1. 启动应用，创建新会话
2. 发送消息，观察工具栏是否显示百分比
3. 发送多轮消息，验证百分比递减
4. 切换会话，验证显示对应会话的百分比
5. 验证颜色变化（可通过 mock 数据测试低百分比场景）

### 5.2 后端验证

```bash
# 在 src-tauri 目录
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

---

## 六、风险与注意事项

| 风险 | 应对措施 |
|------|----------|
| 后端不返回 `model_context_window` | `percentRemaining` 为 null，不显示 UI |
| 首次请求前无数据 | 组件处理 null 状态，不显示 |
| 会话切换 | useContextRemaining selector 自动响应 selectedSessionId 变化 |
| 后端计算失败 | 使用 `and_then` 安全处理 Option |

---

## 七、后续扩展（可选）

- 点击展开详情面板（input/output/cached token 分离展示）
- 上下文压缩提示（当 < 20% 时提示用户）
- Rate limit 信息展示

---

## 八、变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-02-01 | 初始计划创建 | AI |
| 2026-02-01 | 采用方案 A（后端计算），移除前端计算步骤 | AI |
