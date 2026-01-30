# Prompt 执行链路优化方案

**创建日期**: 2026-01-30
**状态**: 待实施
**优先级**: 高

---

## 一、执行链路全景图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端层                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ChatInput                                                                   │
│      ↓                                                                       │
│  useCodexActions.handleSendMessage()                                        │
│      ├─ addToHistory(content)                                               │
│      ├─ setIsGenerating(true)                                               │
│      ├─ setSessionMessages(userMessage)                                     │
│      └─ doSendMessage() ──────────────────────────────┐                     │
│           ↓                                            │                     │
│      ensureCodexSession(chatSessionId) ◄──────────────┘                     │
│           ↓                                                                  │
│      createSession() / sendPrompt()  ─────────┐                             │
│           ↓                                    │                             │
│      src/api/codex.ts (Tauri invoke)          │                             │
└───────────────────────────────────────────────┼─────────────────────────────┘
                                                │
                    ════════════════════════════╪═════════════════════════════
                              IPC 边界 (Tauri WebView ↔ Rust)
                    ════════════════════════════╪═════════════════════════════
                                                │
┌───────────────────────────────────────────────┼─────────────────────────────┐
│                         Tauri/Rust 后端层      ↓                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  commands.rs: codex_prompt()                                                │
│      ↓                                                                       │
│  CodexService.send_prompt()                                                 │
│      ↓                                                                       │
│  mpsc::unbounded_channel().send(ServiceCommand::Prompt)   ◄─── 阻塞点 ①     │
│      ↓                                                                       │
│  oneshot::channel() - 等待响应                             ◄─── 阻塞点 ②     │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────┼─────────────────────────────┐
│                    Worker Thread (LocalSet)    ↓                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  worker_loop() - 单线程 tokio runtime                                       │
│      ↓                                                                       │
│  rx.recv().await ──── 串行处理命令            ◄─── 阻塞点 ③                  │
│      ↓                                                                       │
│  ServiceCommand::Prompt:                                                    │
│      ├─ initialize_inner() (如果未初始化)     ◄─── 阻塞点 ④                  │
│      │      └─ ensure_connection()                                          │
│      │           └─ AcpConnection::spawn()                                  │
│      │                └─ CodexProcess::spawn() ◄─── 阻塞点 ⑤                │
│      └─ tokio::task::spawn_local(prompt_inner())                            │
│              ↓                                                               │
│         conn.conn.prompt(request).await       ◄─── 阻塞点 ⑥                 │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
                    ════════════════════════════╪═════════════════════════════
                              进程间通信 (stdin/stdout pipe)
                    ════════════════════════════╪═════════════════════════════
                                                │
┌───────────────────────────────────────────────┼─────────────────────────────┐
│                        codex-acp 子进程        ↓                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ACP Protocol (JSON-RPC over stdio)                                         │
│      ├─ 接收 PromptRequest                                                   │
│      ├─ LLM API 调用                          ◄─── 阻塞点 ⑦                 │
│      ├─ 流式发送 SessionNotification                                        │
│      └─ 返回 PromptResponse                                                 │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────┼─────────────────────────────┐
│                      事件流回传                 ↓                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  io_task: 读取 stdout → 解析 ACP 消息                                       │
│      ↓                                                                       │
│  AcpClient::session_notification()                                          │
│      ↓                                                                       │
│  emit_session_update() → Tauri app.emit()     ◄─── 阻塞点 ⑧                 │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
                    ════════════════════════════╪═════════════════════════════
                              IPC 边界 (Rust → WebView)
                    ════════════════════════════╪═════════════════════════════
                                                │
┌───────────────────────────────────────────────┼─────────────────────────────┐
│                      前端事件处理               ↓                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  useCodexEvents: listen('codex:message')                                    │
│      ↓                                                                       │
│  messageHandlers.appendAssistantChunk()       ◄─── 阻塞点 ⑨                 │
│      ↓                                                                       │
│  useSessionStore.getState().setSessionMessages()                            │
│      ↓                                                                       │
│  Zustand 触发订阅 → React 重渲染               ◄─── 阻塞点 ⑩                │
│      ↓                                                                       │
│  MessageList / MessageItem 组件渲染                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、阻塞点详细分析

### 阻塞点 ① - mpsc channel 发送

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/service.rs:121-133` |
| **风险等级** | 低 |
| **阻塞类型** | 非阻塞（unbounded channel） |

**问题描述**:
`mpsc::unbounded_channel` 理论上不会阻塞发送方，但如果 worker 线程死锁或崩溃，发送会返回错误。

**当前代码**:
```rust
self.tx
    .send(ServiceCommand::Prompt { ... })
    .map_err(|_| anyhow!("codex service worker stopped"))?;
```

**优化建议**:
- 添加 worker 线程健康检查机制
- 考虑使用 bounded channel 防止内存泄漏

---

### 阻塞点 ② - oneshot channel 等待响应 ⚠️ 高优先级

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/service.rs:130-132` |
| **风险等级** | **高** |
| **阻塞类型** | 同步阻塞 |

**问题描述**:
`reply_rx.await` 会一直等待直到 prompt 完成，如果 LLM 响应慢（可能数分钟），整个 Tauri 命令会被阻塞。

**当前代码**:
```rust
reply_rx
    .await
    .map_err(|_| anyhow!("codex service worker dropped response"))?
```

**优化方案**:

```rust
// 方案 A: 添加超时
use tokio::time::{timeout, Duration};

const PROMPT_TIMEOUT_SECS: u64 = 300; // 5 分钟

pub async fn send_prompt(&self, session_id: String, content: String) -> Result<PromptResult> {
    let (reply_tx, reply_rx) = oneshot::channel();
    self.tx
        .send(ServiceCommand::Prompt {
            session_id,
            content,
            reply: reply_tx,
        })
        .map_err(|_| anyhow!("codex service worker stopped"))?;
    
    match timeout(Duration::from_secs(PROMPT_TIMEOUT_SECS), reply_rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err(anyhow!("codex service worker dropped response")),
        Err(_) => Err(anyhow!("prompt timed out after {} seconds", PROMPT_TIMEOUT_SECS)),
    }
}
```

```rust
// 方案 B: Fire-and-forget 模式（推荐）
// 前端不等待 prompt 完成，通过事件接收结果
pub async fn send_prompt_async(&self, session_id: String, content: String) -> Result<()> {
    self.tx
        .send(ServiceCommand::PromptAsync {
            session_id,
            content,
        })
        .map_err(|_| anyhow!("codex service worker stopped"))?;
    Ok(())
}
```

**实施优先级**: P0

---

### 阻塞点 ③ - Worker Loop 串行处理

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/service.rs:534-535` |
| **风险等级** | 中 |
| **阻塞类型** | 队列阻塞 |

**问题描述**:
Worker loop 是单线程 `LocalSet`，虽然 prompt 使用了 `spawn_local`，但 `Cancel`、`SetConfigOption` 等命令需要排队。

**当前代码**:
```rust
while let Some(cmd) = rx.recv().await {
    match cmd {
        // 串行处理...
    }
}
```

**优化方案**:

```rust
// 使用 tokio::select! 优先处理取消命令
use tokio::sync::mpsc;

struct WorkerState {
    // ... existing fields
    cancel_rx: mpsc::UnboundedReceiver<CancelCommand>,
}

async fn worker_loop(...) {
    loop {
        tokio::select! {
            // 优先处理取消
            Some(cancel) = state.cancel_rx.recv() => {
                handle_cancel(&mut state, cancel).await;
            }
            // 其他命令
            Some(cmd) = rx.recv() => {
                match cmd {
                    // ...
                }
            }
        }
    }
}
```

**实施优先级**: P2

---

### 阻塞点 ④ - 首次初始化 ⚠️ 高优先级

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/service.rs:308-340` |
| **风险等级** | **高（仅首次）** |
| **阻塞类型** | 冷启动延迟 |

**问题描述**:
首次发送 prompt 时需要：
1. 启动 codex-acp 进程（npx 模式 ~3s）
2. 建立 ACP 连接
3. 发送 Initialize 请求

**延迟估算**: 2-5 秒

**优化方案**:

```typescript
// src/hooks/useCodexEffects.ts - 预热连接
useEffect(() => {
  // 1. 初始化 Codex
  void initCodex().catch((err) => {
    devDebug('[codex] init failed', err);
  });
  
  // 2. 预创建一个默认 session（预热）
  const warmupSession = async () => {
    try {
      const result = await createSession('.');
      devDebug('[codex] warmup session created', result.sessionId);
    } catch (err) {
      devDebug('[codex] warmup failed', err);
    }
  };
  
  // 延迟 500ms 执行预热，避免影响首屏渲染
  const timer = setTimeout(warmupSession, 500);
  return () => clearTimeout(timer);
}, []);
```

```rust
// src-tauri/src/codex/service.rs - 添加预热命令
#[tauri::command]
pub async fn codex_warmup(
    app: AppHandle,
    state: State<'_, CodexManager>,
) -> Result<(), String> {
    let svc = state.get_or_create(app);
    svc.warmup().await.map_err(|e| e.to_string())
}

impl CodexService {
    pub async fn warmup(&self) -> Result<()> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Warmup { reply: reply_tx })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx.await.map_err(|_| anyhow!("warmup failed"))?
    }
}
```

**实施优先级**: P0

---

### 阻塞点 ⑤ - 进程启动

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/process.rs:57-89` |
| **风险等级** | 中（仅首次） |
| **阻塞类型** | 进程启动延迟 |

**问题描述**:
- Debug 模式使用 `npx`，启动较慢（~3s，需要 Node.js 初始化）
- Release 模式使用 sidecar，启动较快（~200ms）
- 远程 SSH 模式需要建立 SSH 连接（~1-5s）

**优化方案**:

1. **开发模式优化** - 使用全局安装替代 npx

```bash
# 开发时全局安装 codex-acp
npm install -g @anthropic/codex-acp

# 设置环境变量使用全局安装
export CODEX_DESKTOP_ACP_MODE=sidecar
export CODEX_DESKTOP_ACP_PATH=$(which codex-acp)
```

2. **进程池方案**（未来）

```rust
// 预启动进程池
pub struct CodexProcessPool {
    available: Vec<CodexProcess>,
    max_size: usize,
}

impl CodexProcessPool {
    pub async fn get(&mut self) -> Result<CodexProcess> {
        if let Some(process) = self.available.pop() {
            return Ok(process);
        }
        CodexProcess::spawn(None, CodexProcessConfig::default()).await
    }
    
    pub fn return_process(&mut self, process: CodexProcess) {
        if self.available.len() < self.max_size {
            self.available.push(process);
        }
    }
}
```

**实施优先级**: P1

---

### 阻塞点 ⑥ - ACP Protocol prompt 调用

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/service.rs:459` |
| **风险等级** | **高** |
| **阻塞类型** | LLM 响应延迟 |

**问题描述**:
这是最大阻塞点，等待 codex-acp 完成整个 prompt 处理，包括 LLM API 调用、工具执行等。

**当前缓解**:
- ✅ 流式事件通过 `session_notification` 回调实时返回
- ✅ prompt 在 `spawn_local` 中运行，不阻塞 worker loop
- ✅ 用户体验不会被阻塞，因为流式内容已经在展示

**关键观察**: 
虽然 `prompt_inner` 会阻塞直到 LLM 完成，但流式事件已经在实时返回，**这是设计正确的地方**。

**进一步优化**:
- 添加流式进度指示器
- 实现 token 使用量实时显示

**实施优先级**: P3（已基本正确）

---

### 阻塞点 ⑦ - LLM API 调用（外部）

| 属性 | 值 |
|------|-----|
| **位置** | codex-acp 进程内部 |
| **风险等级** | 高 |
| **阻塞类型** | 外部服务延迟 |

**问题描述**:
完全依赖外部 LLM 服务，包括：
- 网络延迟
- API 限流
- 模型推理时间

**优化建议**:
1. 添加 API 调用超时配置
2. 实现指数退避重试
3. 考虑本地 fallback 模型

**实施优先级**: P2（需要 codex-acp 上游支持）

---

### 阻塞点 ⑧ - Tauri Event Emit

| 属性 | 值 |
|------|-----|
| **位置** | `src-tauri/src/codex/protocol.rs:266` |
| **风险等级** | 低 |
| **阻塞类型** | 事件队列延迟 |

**问题描述**:
`app.emit()` 是异步的，不会阻塞 Rust 端，但：
- WebView 主线程繁忙时事件可能延迟处理
- 大量事件可能导致队列积压

**当前代码**:
```rust
let _ = app.emit(EVENT_MESSAGE_CHUNK, TextChunkPayload { session_id, text });
```

**优化方案**:

```rust
// 事件批量合并
use std::collections::HashMap;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

struct EventBatcher {
    pending: Mutex<HashMap<String, Vec<String>>>, // session_id -> chunks
}

impl EventBatcher {
    async fn add_chunk(&self, session_id: &str, text: &str) {
        let mut pending = self.pending.lock().await;
        pending.entry(session_id.to_string())
            .or_default()
            .push(text.to_string());
    }
    
    async fn flush(&self, app: &AppHandle) {
        let mut pending = self.pending.lock().await;
        for (session_id, chunks) in pending.drain() {
            if !chunks.is_empty() {
                let merged = chunks.join("");
                let _ = app.emit(EVENT_MESSAGE_CHUNK, TextChunkPayload {
                    session_id: &session_id,
                    text: &merged,
                });
            }
        }
    }
}

// 每 50ms flush 一次
async fn event_batcher_task(batcher: Arc<EventBatcher>, app: AppHandle) {
    let mut interval = interval(Duration::from_millis(50));
    loop {
        interval.tick().await;
        batcher.flush(&app).await;
    }
}
```

**实施优先级**: P3

---

### 阻塞点 ⑨ - 前端消息处理 ⚠️ 中优先级

| 属性 | 值 |
|------|-----|
| **位置** | `src/hooks/codexEventMessageHandlers.ts:93-142` |
| **风险等级** | 中 |
| **阻塞类型** | 状态更新开销 |

**问题描述**:
- 每次 chunk 都触发完整状态更新
- `closeActiveThoughtMessages` 涉及数组遍历
- 频繁的状态更新可能导致卡顿

**当前代码**:
```typescript
const appendAssistantChunk = (sessionId: string, text: string) => {
  updateMessages((prev) => {
    const baseList = prev[sessionId] ?? [];
    const now = Date.now();
    const list = closeActiveThoughtMessages(baseList, now);
    // ... 大量状态计算
    return { ...prev, [sessionId]: nextList };
  });
};
```

**优化方案**:

```typescript
// 方案 A: Chunk 合并 + Debounce
import { useMemo, useRef } from 'react';

const CHUNK_MERGE_INTERVAL_MS = 50;

export function createCodexMessageHandlers(
  setSessionMessagesRef: SetSessionMessagesRef
): CodexMessageHandlers {
  // Chunk 缓冲区
  const chunkBufferRef = useRef<Record<string, { text: string; timer: number }>>({});
  
  const flushChunks = (sessionId: string) => {
    const buffer = chunkBufferRef.current[sessionId];
    if (!buffer) return;
    
    const { text } = buffer;
    delete chunkBufferRef.current[sessionId];
    
    // 批量更新
    updateMessages((prev) => {
      // ... existing logic with merged text
    });
  };
  
  const appendAssistantChunk = (sessionId: string, text: string) => {
    const existing = chunkBufferRef.current[sessionId];
    
    if (existing) {
      // 合并 chunk
      window.clearTimeout(existing.timer);
      existing.text += text;
      existing.timer = window.setTimeout(() => flushChunks(sessionId), CHUNK_MERGE_INTERVAL_MS);
    } else {
      // 新建缓冲
      chunkBufferRef.current[sessionId] = {
        text,
        timer: window.setTimeout(() => flushChunks(sessionId), CHUNK_MERGE_INTERVAL_MS),
      };
    }
  };
  
  // ... rest
}
```

```typescript
// 方案 B: 使用 Immer 优化不可变更新
import { produce } from 'immer';

const appendAssistantChunk = (sessionId: string, text: string) => {
  updateMessages(produce((draft) => {
    const list = draft[sessionId] ?? [];
    const lastMessage = list[list.length - 1];
    
    if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
      lastMessage.content += text;
    } else {
      list.push({
        id: newMessageId(),
        role: 'assistant',
        content: text,
        isStreaming: true,
      });
    }
    
    draft[sessionId] = list;
  }));
};
```

**实施优先级**: P1

---

### 阻塞点 ⑩ - React 重渲染 ⚠️ 中优先级

| 属性 | 值 |
|------|-----|
| **位置** | `src/stores/sessionStore.ts` + 组件层 |
| **风险等级** | 中 |
| **阻塞类型** | UI 渲染开销 |

**问题描述**:
- Zustand `subscribeWithSelector` 可能触发不必要的重渲染
- 消息列表缺少细粒度 memo
- 虚拟化配置可能不足

**优化方案**:

```typescript
// 1. 消息项 memo 化
// src/components/business/MessageList/MessageItem.tsx
import { memo } from 'react';

export const MessageItem = memo(function MessageItem({ message, ...props }) {
  // ...
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming
  );
});
```

```typescript
// 2. 更细粒度的 selector
// src/stores/sessionStore.ts
export const useMessageById = (sessionId: string, messageId: string) =>
  useSessionStore(
    (state) => state.sessionMessages[sessionId]?.find((m) => m.id === messageId),
    // 浅比较
    (a, b) => a?.id === b?.id && a?.content === b?.content && a?.isStreaming === b?.isStreaming
  );
```

```typescript
// 3. 虚拟化调优
// src/constants/performance.ts
export const PERFORMANCE = {
  // 增加 overscan 减少滚动时的空白
  MESSAGE_OVERSCAN: 10, // 从 6 增加到 10
  
  // 添加新的虚拟化配置
  MESSAGE_BATCH_SIZE: 20,
  SCROLL_DEBOUNCE_MS: 16,
} as const;
```

**实施优先级**: P1

---

## 三、延迟分析

### 首次发送消息（最慢路径）

| 阶段 | 延迟 | 累计 |
|------|------|------|
| 用户点击发送 | ~0ms | 0ms |
| ensureCodexSession() | ~50ms (有缓存) / ~2000-5000ms (首次) | 2000-5000ms |
| CodexProcess::spawn() (npx) | ~3000ms | 5000-8000ms |
| ACP Initialize | ~100ms | 5100-8100ms |
| sendPrompt() | ~10ms | 5110-8110ms |
| 到达 codex-acp | ~10ms | 5120-8120ms |
| LLM API 首 token | ~100-1000ms | 5220-9120ms |
| 首个 chunk 返回 | ~5ms | 5225-9125ms |
| UI 更新 | ~5ms | 5230-9130ms |

**首次总延迟**: 约 5-9 秒

### 后续发送消息（最快路径）

| 阶段 | 延迟 | 累计 |
|------|------|------|
| 用户点击发送 | ~0ms | 0ms |
| sendPrompt() (session 已存在) | ~10ms | 10ms |
| 到达 codex-acp | ~10ms | 20ms |
| LLM API 首 token | ~100-500ms | 120-520ms |
| 首个 chunk 返回 | ~5ms | 125-525ms |
| UI 更新 | ~5ms | 130-530ms |

**后续总延迟**: 约 130-530ms（主要取决于 LLM）

---

## 四、实施计划

### Phase 1: 冷启动优化（P0）

**目标**: 将首次响应时间从 5-9s 降低到 1-2s

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 1.1 App 启动时预热 codex-acp 连接 | `src/hooks/useCodexEffects.ts` | 2h |
| 1.2 添加 warmup 命令 | `src-tauri/src/codex/commands.rs` | 2h |
| 1.3 `initCodex()` 后自动 `createSession()` | `src/hooks/useCodexEffects.ts` | 1h |
| 1.4 添加首次加载指示器 | `src/components/...` | 2h |

**预期收益**: 首次响应快 3-5s

### Phase 2: 响应可靠性（P0-P1）

**目标**: 避免 UI 永久卡住，提升错误处理

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 2.1 添加 prompt 超时机制 (5min) | `src-tauri/src/codex/service.rs` | 2h |
| 2.2 实现用户可取消功能 | 前端 + 后端 | 4h |
| 2.3 添加错误边界和重试 UI | `src/components/...` | 3h |

**预期收益**: 避免永久阻塞，用户可控

### Phase 3: 渲染性能（P1）

**目标**: 长对话流畅度提升

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 3.1 实现 chunk 合并 (100ms 窗口) | `src/hooks/codexEventMessageHandlers.ts` | 3h |
| 3.2 MessageItem memo 化 | `src/components/...` | 2h |
| 3.3 虚拟化调优 | `src/constants/performance.ts` | 1h |
| 3.4 添加渲染性能监控 | `src/utils/...` | 2h |

**预期收益**: 减少 50% 状态更新，长对话更流畅

### Phase 4: 架构增强（P2-P3）

**目标**: 长期架构健壮性

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 4.1 Cancel 命令优先处理 | `src-tauri/src/codex/service.rs` | 4h |
| 4.2 事件批量合并 | `src-tauri/src/codex/protocol.rs` | 4h |
| 4.3 Worker 健康检查 | `src-tauri/src/codex/service.rs` | 3h |
| 4.4 进程池方案评估 | 设计文档 | 2h |

**预期收益**: 架构更健壮，取消响应更快

---

## 五、监控指标

### 关键性能指标 (KPI)

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|----------|
| 首次响应延迟 (TTFB) | ~5-9s | <2s | debug event timing |
| 后续响应延迟 | ~130-530ms | <200ms | debug event timing |
| UI 更新频率 | ~20-50/s | <20/s | React DevTools |
| 长对话 FPS | ~30 | >55 | Performance monitor |
| 内存使用 (100条消息) | 未测量 | <100MB | Chrome DevTools |

### 监控实现

```typescript
// src/utils/performanceMonitor.ts
export const PerformanceMonitor = {
  markPromptStart: (sessionId: string) => {
    performance.mark(`prompt-start-${sessionId}`);
  },
  
  markFirstChunk: (sessionId: string) => {
    performance.mark(`first-chunk-${sessionId}`);
    performance.measure(
      `ttfb-${sessionId}`,
      `prompt-start-${sessionId}`,
      `first-chunk-${sessionId}`
    );
  },
  
  getMetrics: () => {
    return performance.getEntriesByType('measure');
  },
};
```

---

## 六、风险与回滚

### 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 预热失败影响首屏 | 低 | 中 | 异步预热，不阻塞渲染 |
| 超时设置过短 | 中 | 高 | 可配置超时，默认 5min |
| Chunk 合并引入延迟 | 中 | 低 | 50ms 窗口，用户无感知 |
| Memo 比较函数错误 | 低 | 中 | 充分测试，保守比较 |

### 回滚方案

每个 Phase 独立可回滚：

1. **Phase 1 回滚**: 移除预热代码，恢复懒加载
2. **Phase 2 回滚**: 移除超时，恢复无限等待
3. **Phase 3 回滚**: 移除 chunk 合并，恢复直接更新
4. **Phase 4 回滚**: 恢复串行命令处理

---

## 七、附录

### A. 相关文件清单

| 文件 | 职责 |
|------|------|
| `src/hooks/useCodexActions.ts` | 前端业务操作 |
| `src/hooks/useCodexEffects.ts` | Codex 初始化与副作用 |
| `src/hooks/useCodexEvents.ts` | Tauri 事件监听 |
| `src/hooks/codexEventMessageHandlers.ts` | 消息处理器 |
| `src/stores/sessionStore.ts` | 会话状态 |
| `src/stores/codexStore.ts` | Codex 状态 |
| `src/api/codex.ts` | Tauri invoke 包装 |
| `src-tauri/src/codex/commands.rs` | Tauri 命令 |
| `src-tauri/src/codex/service.rs` | 后台服务 |
| `src-tauri/src/codex/protocol.rs` | ACP 协议 |
| `src-tauri/src/codex/process.rs` | 进程管理 |
| `src-tauri/src/codex/events.rs` | 事件定义 |

### B. 参考资料

- [Tauri Event System](https://tauri.app/v2/learn/events/)
- [Zustand Performance Guide](https://zustand-demo.pmnd.rs/)
- [React Virtualization](https://tanstack.com/virtual/latest)
- [agent-client-protocol](https://crates.io/crates/agent-client-protocol)
