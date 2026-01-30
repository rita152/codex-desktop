# Phase 1 实施指南：冷启动优化

**目标**: 将首次响应时间从 5-9s 降低到 1-2s
**优先级**: P0
**预计工作量**: 7h

---

## 1.1 App 启动时预热 codex-acp 连接

### 目标文件

`src/hooks/useCodexEffects.ts`

### 修改方案

在现有 `useEffect` 中添加预热逻辑：

```typescript
// src/hooks/useCodexEffects.ts

import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { initCodex, createSession, setSessionMode, setSessionModel } from '../api/codex';
import { devDebug } from '../utils/logger';
// ... other imports

// 新增：预热延迟常量
const WARMUP_DELAY_MS = 500;

export function useCodexEffects(): void {
  const { t } = useTranslation();
  const pendingSessionInitRef = useRef<Record<string, Promise<string>>>({});
  
  // 新增：预热状态
  const warmupSessionIdRef = useRef<string | null>(null);

  // 修改：初始化 + 预热
  useEffect(() => {
    let warmupTimer: number | undefined;
    
    const initAndWarmup = async () => {
      try {
        // 1. 初始化 Codex
        await initCodex();
        devDebug('[codex] initialized');
        
        // 2. 延迟预热（避免影响首屏渲染）
        warmupTimer = window.setTimeout(async () => {
          try {
            // 创建一个预热 session
            const result = await createSession('.');
            warmupSessionIdRef.current = result.sessionId;
            devDebug('[codex] warmup session created', result.sessionId);
            
            // 应用 mode/model 选项
            const sessionStore = useSessionStore.getState();
            const modeState = resolveModeOptions(result.modes, result.configOptions);
            if (modeState?.options?.length) {
              sessionStore.applyModeOptions({
                options: modeState.options,
                currentId: modeState.currentModeId,
                fallbackCurrentId: DEFAULT_MODE_ID,
              });
            }
            
            const modelState = resolveModelOptions(result.models, result.configOptions);
            if (modelState?.options?.length) {
              sessionStore.applyModelOptions({
                options: modelState.options,
                currentId: modelState.currentModelId,
                fallbackCurrentId: DEFAULT_MODEL_ID,
              });
            }
          } catch (err) {
            devDebug('[codex] warmup failed (non-fatal)', err);
          }
        }, WARMUP_DELAY_MS);
      } catch (err) {
        devDebug('[codex] init failed', err);
      }
    };
    
    void initAndWarmup();
    
    return () => {
      if (warmupTimer) {
        window.clearTimeout(warmupTimer);
      }
    };
  }, []);

  // 修改：ensureCodexSession 复用预热 session
  const ensureCodexSession = useCallback(
    async (chatSessionId: string): Promise<string> => {
      const codexStore = useCodexStore.getState();
      const sessionStore = useSessionStore.getState();

      // 检查是否已存在
      const existing = codexStore.getCodexSessionId(chatSessionId);
      if (existing) return existing;

      // 检查是否有 pending
      const pending = pendingSessionInitRef.current[chatSessionId];
      if (pending) return pending;

      // 新增：尝试复用预热 session
      const warmupSessionId = warmupSessionIdRef.current;
      if (warmupSessionId) {
        warmupSessionIdRef.current = null; // 只能用一次
        codexStore.registerCodexSession(chatSessionId, warmupSessionId);
        devDebug('[codex] reused warmup session', warmupSessionId);
        
        // 仍需同步 mode/model
        const sessions = sessionStore.sessions;
        const sessionMeta = sessions.find((s) => s.id === chatSessionId);
        
        // ... 保持原有的 mode/model 同步逻辑 ...
        
        return warmupSessionId;
      }

      // 原有逻辑：创建新 session
      const task = (async () => {
        // ... 保持原有实现 ...
      })();

      pendingSessionInitRef.current[chatSessionId] = task;
      try {
        return await task;
      } finally {
        delete pendingSessionInitRef.current[chatSessionId];
      }
    },
    [t]
  );

  // ... 保持其余代码不变 ...
}
```

### 测试要点

1. App 启动后 500ms 检查是否有 warmup session
2. 首次发送消息验证是否复用 warmup session
3. 测量首次响应时间改善

---

## 1.2 添加 warmup 命令（可选增强）

如果需要更细粒度的控制，可以添加专门的 warmup 命令。

### 后端修改

#### `src-tauri/src/codex/service.rs`

```rust
// 添加新的 ServiceCommand
enum ServiceCommand {
    // ... 现有命令 ...
    Warmup {
        reply: oneshot::Sender<Result<()>>,
    },
}

impl CodexService {
    /// Warmup the ACP connection without creating a session
    pub async fn warmup(&self) -> Result<()> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Warmup { reply: reply_tx })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        reply_rx
            .await
            .map_err(|_| anyhow!("codex service worker dropped response"))?
    }
}

// 在 worker_loop 中添加处理
async fn worker_loop(...) {
    // ...
    while let Some(cmd) = rx.recv().await {
        match cmd {
            // ... 现有命令处理 ...
            
            ServiceCommand::Warmup { reply } => {
                let timing = state.debug.mark_global();
                state.debug.emit(
                    &state.app,
                    None,
                    "warmup_start",
                    timing,
                    serde_json::json!({}),
                );

                let start = Instant::now();
                let result = ensure_connection(&mut state).await;
                let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);

                let timing = state.debug.mark_global();
                state.debug.emit(
                    &state.app,
                    None,
                    "warmup_end",
                    timing,
                    serde_json::json!({ "ok": result.is_ok(), "durationMs": duration_ms }),
                );

                let _ = reply.send(result.map(|_| ()));
            }
        }
    }
}
```

#### `src-tauri/src/codex/commands.rs`

```rust
/// Warmup the Codex backend connection
#[tauri::command]
pub async fn codex_warmup(
    app: AppHandle,
    state: State<'_, CodexManager>,
) -> Result<(), String> {
    let svc = state.get_or_create(app);
    svc.warmup().await.map_err(|e| e.to_string())
}
```

#### `src-tauri/src/lib.rs`

在 `generate_handler!` 中注册新命令：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    codex::commands::codex_warmup,
])
```

### 前端修改

#### `src/api/codex.ts`

```typescript
export async function warmupCodex(): Promise<void> {
  return invoke<void>('codex_warmup');
}
```

#### `src/hooks/useCodexEffects.ts`

```typescript
import { warmupCodex } from '../api/codex';

useEffect(() => {
  const initAndWarmup = async () => {
    try {
      await initCodex();
      devDebug('[codex] initialized');
      
      // 使用 warmup 命令预热连接
      setTimeout(async () => {
        try {
          await warmupCodex();
          devDebug('[codex] warmed up');
        } catch (err) {
          devDebug('[codex] warmup failed', err);
        }
      }, WARMUP_DELAY_MS);
    } catch (err) {
      devDebug('[codex] init failed', err);
    }
  };
  
  void initAndWarmup();
}, []);
```

---

## 1.3 添加首次加载指示器

### 目标文件

`src/components/business/ChatInput/` (或相关组件)

### 修改方案

```typescript
// src/hooks/useCodexReadyState.ts (新文件)
import { useState, useEffect } from 'react';
import { useCodexStore } from '../stores/codexStore';
import { useSessionStore } from '../stores/sessionStore';

export type CodexReadyState = 'initializing' | 'warming' | 'ready' | 'error';

export function useCodexReadyState(): CodexReadyState {
  const [state, setState] = useState<CodexReadyState>('initializing');
  
  const modelOptions = useSessionStore((s) => s.modelCache.options);
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const hasCodexSession = useCodexStore(
    (s) => !!s.codexSessionByChat[selectedSessionId]
  );
  
  useEffect(() => {
    if (hasCodexSession) {
      setState('ready');
    } else if (modelOptions && modelOptions.length > 0) {
      setState('warming'); // Options available but no session yet
    } else {
      setState('initializing');
    }
  }, [hasCodexSession, modelOptions]);
  
  return state;
}
```

```typescript
// 在 ChatInput 组件中使用
import { useCodexReadyState } from '../../hooks/useCodexReadyState';

export function ChatInput() {
  const readyState = useCodexReadyState();
  
  const placeholder = useMemo(() => {
    switch (readyState) {
      case 'initializing':
        return t('chat.initializingPlaceholder'); // "正在初始化..."
      case 'warming':
        return t('chat.warmingPlaceholder'); // "准备中..."
      default:
        return t('chat.inputPlaceholder'); // "输入消息..."
    }
  }, [readyState, t]);
  
  const isDisabled = readyState === 'initializing';
  
  return (
    <textarea
      placeholder={placeholder}
      disabled={isDisabled}
      // ...
    />
  );
}
```

---

## 1.4 i18n 更新

### `src/i18n/locales/zh.json`

```json
{
  "chat": {
    "initializingPlaceholder": "正在初始化 Codex...",
    "warmingPlaceholder": "准备就绪，可以开始对话",
    "inputPlaceholder": "输入消息，按 Enter 发送"
  }
}
```

### `src/i18n/locales/en.json`

```json
{
  "chat": {
    "initializingPlaceholder": "Initializing Codex...",
    "warmingPlaceholder": "Getting ready...",
    "inputPlaceholder": "Type a message, press Enter to send"
  }
}
```

---

## 验收标准

### 功能验收

- [ ] App 启动后自动预热 codex-acp 连接
- [ ] 首次发送消息复用预热的 session
- [ ] 初始化期间显示适当的 loading 状态
- [ ] 预热失败不影响正常功能（优雅降级）

### 性能验收

- [ ] 首次响应时间 < 2s（目标）
- [ ] 首屏渲染时间无明显影响（< 50ms 增加）
- [ ] 内存占用无明显增加（< 10MB）

### 回滚方案

1. 移除 `WARMUP_DELAY_MS` 相关代码
2. 移除 `warmupSessionIdRef` 和复用逻辑
3. 恢复原有的懒加载行为

---

## 下一步

完成 Phase 1 后，继续 [Phase 2: 响应可靠性](./IMPL_GUIDE_PHASE2.md)
