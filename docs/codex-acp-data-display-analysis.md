# Codex-ACP 数据类型与前端显示分析

## 概述

本文档分析 Codex Desktop 项目如何处理 codex-acp 返回的不同类型数据，以及这些数据在前端的显示方式。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           codex-acp (Rust)                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐ │
│  │ CodexAgent  │───▶│    Thread    │───▶│ SessionClient (通知发送)    │ │
│  └─────────────┘    └──────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ ACP Protocol (stdio)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        src-tauri (Rust)                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │ AcpConnection   │───▶│ session_notification│───▶│ Tauri Events    │  │
│  └─────────────────┘    └──────────────────┘    └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Tauri Event System
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         前端 (React/TypeScript)                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐ │
│  │ App.tsx     │◀───│ listen()     │◀───│ Tauri Events               │ │
│  │ (事件监听)   │    │ (事件订阅)    │    │                            │ │
│  └─────────────┘    └──────────────┘    └─────────────────────────────┘ │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    组件层                                        │   │
│  │  ChatMessageList ──▶ ChatMessage ──▶ Markdown / Thinking        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 一、事件类型定义

### 1.1 后端事件定义 (src-tauri/src/codex/events.rs)

```rust
pub const EVENT_MESSAGE_CHUNK: &str = "codex:message";
pub const EVENT_THOUGHT_CHUNK: &str = "codex:thought";
pub const EVENT_TOOL_CALL: &str = "codex:tool-call";
pub const EVENT_TOOL_CALL_UPDATE: &str = "codex:tool-call-update";
pub const EVENT_APPROVAL_REQUEST: &str = "codex:approval-request";
pub const EVENT_PLAN: &str = "codex:plan";
pub const EVENT_AVAILABLE_COMMANDS: &str = "codex:available-commands";
pub const EVENT_CURRENT_MODE: &str = "codex:current-mode";
pub const EVENT_CONFIG_OPTION_UPDATE: &str = "codex:config-option-update";
pub const EVENT_TURN_COMPLETE: &str = "codex:turn-complete";
pub const EVENT_ERROR: &str = "codex:error";
pub const EVENT_DEBUG: &str = "codex:debug";
```

### 1.2 前端类型定义 (src/types/codex.ts)

```typescript
export type CodexEvent =
  | { event: 'codex:message'; payload: MessageChunk }
  | { event: 'codex:thought'; payload: MessageChunk }
  | { event: 'codex:tool-call'; payload: { sessionId: string; toolCall: ToolCall } }
  | { event: 'codex:tool-call-update'; payload: { sessionId: string; update: ToolCallUpdate } }
  | { event: 'codex:approval-request'; payload: ApprovalRequest }
  | { event: 'codex:plan'; payload: { sessionId: string; plan: unknown } }
  | { event: 'codex:available-commands'; payload: { sessionId: string; update: unknown } }
  | { event: 'codex:current-mode'; payload: { sessionId: string; update: unknown } }
  | { event: 'codex:config-option-update'; payload: { sessionId: string; update: unknown } }
  | { event: 'codex:turn-complete'; payload: TurnCompleteEvent }
  | { event: 'codex:error'; payload: CodexErrorEvent }
  | { event: 'codex:debug'; payload: CodexDebugEvent };
```

---

## 二、数据类型详细分析

### 2.1 消息文本 (codex:message)

**数据来源**: `AgentMessageContentDelta` 事件

**后端处理** (protocol.rs):
```rust
SessionUpdate::AgentMessageChunk(chunk) => {
    if let Some(text) = content_block_text(&chunk.content) {
        let _ = self.app.emit(
            EVENT_MESSAGE_CHUNK,
            json!({ "sessionId": session_id, "text": text }),
        );
    }
}
```

**前端处理** (App.tsx):
```typescript
listen<{ sessionId: string; text: string }>('codex:message', (event) => {
  appendStreamingChunk('assistant', event.payload.text);
});
```

**显示组件**: `ChatMessage` → `Markdown`

**显示特点**:
- 流式输出，逐字符/逐块追加
- 支持 Markdown 渲染 (GFM, 数学公式)
- 打字机效果 (useTypewriterText hook)

---

### 2.2 思考内容 (codex:thought)

**数据来源**: `AgentThoughtChunk` / `ReasoningContentDelta` 事件

**后端处理** (protocol.rs):
```rust
SessionUpdate::AgentThoughtChunk(chunk) => {
    if emit_thought_chunks() {
        if let Some(text) = content_block_text(&chunk.content) {
            let _ = self.app.emit(
                EVENT_THOUGHT_CHUNK,
                json!({ "sessionId": session_id, "text": text }),
            );
        }
    }
}
```

**前端处理** (App.tsx):
```typescript
listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
  appendStreamingChunk('thought', event.payload.text);
});
```

**显示组件**: `ChatMessage` → `Thinking` → `Markdown`

**显示特点**:
- 可折叠的思考区块
- 实时计时显示 ("思考中... X 秒")
- 思考结束后自动折叠
- 支持 Markdown 渲染

---

### 2.3 工具调用 (codex:tool-call)

**数据来源**: `ToolCall` SessionUpdate

**后端处理** (protocol.rs):
```rust
SessionUpdate::ToolCall(tool_call) => {
    let _ = self.app.emit(
        EVENT_TOOL_CALL,
        json!({ "sessionId": session_id, "toolCall": tool_call }),
    );
}
```

**前端处理** (App.tsx):
```typescript
listen<{ sessionId: string; toolCall: unknown }>('codex:tool-call', (event) => {
  const toolCall = event.payload.toolCall as any;
  const msg: Message = {
    id: newMessageId(),
    role: 'tool',
    content: `**Tool Call** \`${toolCall.name}\`\n\n\`\`\`json\n${safeJson(toolCall)}\n\`\`\`\n`,
    isStreaming: true,
  };
  // 添加到消息列表
});
```

**显示组件**: `ChatMessage` (role='tool') → `Markdown`

**显示特点**:
- 以 JSON 代码块形式显示完整工具调用信息
- 包含工具名称、参数、调用 ID
- 使用 `tool` 角色样式区分

**工具调用类型** (来自 codex-acp/thread.rs):

| 类型 | ToolKind | 说明 |
|------|----------|------|
| 文件读取 | `Read` | 读取文件内容 |
| 文件搜索 | `Search` | 搜索文件/目录 |
| 命令执行 | `Execute` | 执行 shell 命令 |
| 文件编辑 | `Edit` | 应用补丁/修改文件 |
| 网络请求 | `Fetch` | Web 搜索 |

---

### 2.4 工具调用更新 (codex:tool-call-update)

**数据来源**: `ToolCallUpdate` SessionUpdate

**后端处理** (protocol.rs):
```rust
SessionUpdate::ToolCallUpdate(update) => {
    let _ = self.app.emit(
        EVENT_TOOL_CALL_UPDATE,
        json!({ "sessionId": session_id, "update": update }),
    );
}
```

**前端处理** (App.tsx):
```typescript
listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
  const msg: Message = {
    role: 'tool',
    content: `**Tool Update**\n\n\`\`\`json\n${safeJson(update)}\n\`\`\`\n`,
    isStreaming: true,
  };
});
```

**显示特点**:
- 更新工具调用状态 (InProgress → Completed/Failed)
- 可包含命令输出、终端数据
- 支持终端输出流式显示

---

### 2.5 审批请求 (codex:approval-request)

**数据来源**: `request_permission` 调用

**后端处理** (protocol.rs):
```rust
let _ = self.app.emit(
    EVENT_APPROVAL_REQUEST,
    json!({
        "sessionId": session_id,
        "requestId": tool_call_id,
        "toolCall": args.tool_call,
        "options": args.options,
    }),
);
```

**前端处理** (App.tsx):
```typescript
listen('codex:approval-request', (event) => {
  console.debug('[codex approval]', event.payload);
  // TODO: 接入 ApprovalDialog
});
```

**当前状态**: 仅 console 输出，未实现 UI

**审批类型**:
1. **命令执行审批** (`ExecApprovalRequest`)
2. **补丁应用审批** (`ApplyPatchApprovalRequest`)
3. **MCP 工具审批** (`ElicitationRequest`)

**审批选项**:
```typescript
interface PermissionOption {
  optionId: string;
  kind: 'allow-always' | 'allow-once' | 'reject-always' | 'reject-once';
  label: string;
  description?: string;
}
```

---

### 2.6 计划更新 (codex:plan)

**数据来源**: `PlanUpdate` 事件

**后端处理** (protocol.rs):
```rust
SessionUpdate::Plan(plan) => {
    let _ = self.app.emit(
        EVENT_PLAN, 
        json!({ "sessionId": session_id, "plan": plan })
    );
}
```

**前端处理** (useCodex.ts):
```typescript
onPlan: () => {},  // 当前未处理
```

**当前状态**: 未实现显示

**Plan 数据结构** (来自 ACP 协议):
```typescript
interface Plan {
  entries: PlanEntry[];
}

interface PlanEntry {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  priority: 'high' | 'medium' | 'low';
}
```

---

### 2.7 可用命令更新 (codex:available-commands)

**数据来源**: `AvailableCommandsUpdate` SessionUpdate

**前端处理** (useCodex.ts):
```typescript
onAvailableCommands: ({ update }) => {
  setAvailableSlashCommands(extractSlashCommands(update));
},
```

**用途**: 提取斜杠命令列表供输入框自动补全

---

### 2.8 模式更新 (codex:current-mode)

**数据来源**: `CurrentModeUpdate` SessionUpdate

**前端处理** (useCodex.ts):
```typescript
onCurrentMode: ({ sessionId: sid, update }) => {
  if (sid !== sessionId) return;
  setCurrentModeUpdate(update);
},
```

**用途**: 跟踪当前会话模式 (如 auto/manual)

---

### 2.9 配置选项更新 (codex:config-option-update)

**数据来源**: `ConfigOptionUpdate` SessionUpdate

**前端处理** (useCodex.ts):
```typescript
onConfigOptionUpdate: ({ sessionId: sid, update }) => {
  if (sid !== sessionId) return;
  setConfigOptionUpdates((prev) => [...prev, update]);
},
```

**用途**: 跟踪会话配置变更

---

### 2.10 回合完成 (codex:turn-complete)

**数据来源**: `TurnComplete` 事件

**前端处理** (App.tsx):
```typescript
listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', () => {
  setSessionMessages((prev) => {
    const list = prev[sessionId] ?? [];
    const next = list.map((m) => {
      if (m.role === 'user' || !m.isStreaming) return m;
      return { ...m, isStreaming: false, timestamp: now };
    });
    return { ...prev, [sessionId]: next };
  });
  setIsGenerating(false);
});
```

**作用**:
- 结束所有流式消息
- 添加时间戳
- 重置生成状态

---

### 2.11 错误事件 (codex:error)

**前端处理** (App.tsx):
```typescript
listen<{ error: string }>('codex:error', (event) => {
  const errMsg: Message = {
    role: 'assistant',
    content: `发生错误：${event.payload.error}`,
    isStreaming: false,
    timestamp: new Date(),
  };
  // 添加错误消息
  setIsGenerating(false);
});
```

**显示**: 作为 assistant 消息显示错误内容

---

## 三、消息角色与显示映射

### 3.1 消息角色定义 (ChatMessage/types.ts)

```typescript
export type MessageRole = 'user' | 'assistant' | 'thought' | 'tool';
```

### 3.2 角色显示对照表

| 角色 | 数据来源 | 显示位置 | 样式特点 |
|------|----------|----------|----------|
| `user` | 用户输入 | 右侧气泡 | 用户消息样式 |
| `assistant` | `codex:message` | 左侧气泡 | AI 回复样式，支持 Markdown |
| `thought` | `codex:thought` | 可折叠区块 | 思考过程，灰色背景 |
| `tool` | `codex:tool-call` / `codex:tool-call-update` | 左侧气泡 | 工具调用样式，代码块显示 |

### 3.3 渲染逻辑 (ChatMessage/index.tsx)

```typescript
const renderContent = () => {
  if (role === 'assistant' || role === 'tool') {
    return <Markdown content={isStreaming ? streamedContent : content} />;
  }
  if (role === 'thought') return null;  // 思考内容在 Thinking 组件中渲染
  return content;  // user 消息直接显示文本
};
```

---

## 四、数据流转详解

### 4.1 消息流式输出流程

```
codex-acp                    src-tauri                     前端
    │                            │                           │
    │ AgentMessageContentDelta   │                           │
    ├───────────────────────────▶│                           │
    │                            │ emit("codex:message")     │
    │                            ├──────────────────────────▶│
    │                            │                           │ appendStreamingChunk()
    │                            │                           │ ├─ 查找/创建消息
    │                            │                           │ ├─ 追加文本
    │                            │                           │ └─ 触发重渲染
    │                            │                           │
    │ TurnComplete               │                           │
    ├───────────────────────────▶│                           │
    │                            │ emit("codex:turn-complete")│
    │                            ├──────────────────────────▶│
    │                            │                           │ 结束流式状态
```

### 4.2 工具调用流程

```
codex-acp                    src-tauri                     前端
    │                            │                           │
    │ ToolCall (开始)            │                           │
    ├───────────────────────────▶│                           │
    │                            │ emit("codex:tool-call")   │
    │                            ├──────────────────────────▶│
    │                            │                           │ 创建 tool 消息
    │                            │                           │
    │ ToolCallUpdate (进度)      │                           │
    ├───────────────────────────▶│                           │
    │                            │ emit("codex:tool-call-update")
    │                            ├──────────────────────────▶│
    │                            │                           │ 更新/追加消息
    │                            │                           │
    │ ToolCallUpdate (完成)      │                           │
    ├───────────────────────────▶│                           │
    │                            │ emit("codex:tool-call-update")
    │                            ├──────────────────────────▶│
    │                            │                           │ 标记完成状态
```

---

## 五、当前实现状态总结

### 5.1 已完整实现

| 功能 | 状态 | 说明 |
|------|------|------|
| 消息流式输出 | ✅ | 支持打字机效果 |
| 思考内容显示 | ✅ | 可折叠，实时计时 |
| Markdown 渲染 | ✅ | GFM + 数学公式 |
| 工具调用显示 | ✅ | JSON 格式展示 |
| 错误处理 | ✅ | 显示错误消息 |
| 回合状态管理 | ✅ | 流式/完成状态切换 |

### 5.2 部分实现

| 功能 | 状态 | 说明 |
|------|------|------|
| 工具调用更新 | ⚠️ | 仅追加新消息，未关联更新 |
| 斜杠命令 | ⚠️ | 提取命令列表，未实现 UI |
| 模式/配置更新 | ⚠️ | 状态存储，未显示 |

### 5.3 未实现

| 功能 | 状态 | 说明 |
|------|------|------|
| 审批对话框 | ❌ | 仅 console 输出 |
| 计划显示 | ❌ | 事件未处理 |
| 终端输出 | ❌ | 未实现终端组件 |
| 文件差异显示 | ❌ | 补丁内容未可视化 |

---

## 六、改进建议

### 6.1 短期改进

1. **审批对话框**: 实现 `ApprovalDialog` 组件处理 `codex:approval-request`
2. **工具调用关联**: 通过 `toolCallId` 关联 `tool-call` 和 `tool-call-update`
3. **计划面板**: 显示任务计划和进度

### 6.2 中期改进

1. **终端组件**: 实现 xterm.js 集成显示命令输出
2. **文件差异视图**: 使用 diff 库显示补丁内容
3. **工具调用卡片**: 专用组件替代 JSON 显示

### 6.3 长期改进

1. **类型安全**: 完善 `unknown` 类型的具体定义
2. **状态管理**: 考虑引入状态管理库处理复杂状态
3. **性能优化**: 大量消息时的虚拟滚动

---

## 七、附录：完整事件类型参考

### 7.1 codex-acp 内部事件 (EventMsg)

```rust
// 消息相关
AgentMessageContentDelta    // 消息内容增量
AgentMessage                // 完整消息
ReasoningContentDelta       // 推理内容增量
AgentReasoning              // 完整推理

// 工具调用相关
ExecCommandBegin            // 命令开始
ExecCommandOutputDelta      // 命令输出增量
ExecCommandEnd              // 命令结束
McpToolCallBegin            // MCP 工具开始
McpToolCallEnd              // MCP 工具结束
PatchApplyBegin             // 补丁应用开始
PatchApplyEnd               // 补丁应用结束
WebSearchBegin              // 网络搜索开始
WebSearchEnd                // 网络搜索结束

// 审批相关
ExecApprovalRequest         // 命令执行审批
ApplyPatchApprovalRequest   // 补丁应用审批
ElicitationRequest          // MCP 工具审批

// 状态相关
TurnStarted                 // 回合开始
TurnComplete                // 回合完成
TurnAborted                 // 回合中止
PlanUpdate                  // 计划更新

// 错误相关
Error                       // 错误
StreamError                 // 流错误
Warning                     // 警告
```

### 7.2 前端消息结构 (Message)

```typescript
interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'thought' | 'tool';
  content: string;
  thinking?: ThinkingData;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  timestamp?: Date;
}
```
