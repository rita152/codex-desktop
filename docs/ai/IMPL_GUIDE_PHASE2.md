# Phase 2 实施指南：响应可靠性

**目标**: 避免 UI 永久卡住，提升错误处理
**优先级**: P0-P1
**预计工作量**: 9h

---

## 2.1 添加 prompt 超时机制

### 目标文件

`src-tauri/src/codex/service.rs`

### 修改方案

```rust
// src-tauri/src/codex/service.rs

use tokio::time::{timeout, Duration};

/// Default timeout for prompt requests (5 minutes)
const PROMPT_TIMEOUT_SECS: u64 = 300;

impl CodexService {
    /// Send a prompt to the ACP session with timeout.
    pub async fn send_prompt(&self, session_id: String, content: String) -> Result<PromptResult> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Prompt {
                session_id,
                content,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        
        // 添加超时保护
        match timeout(Duration::from_secs(PROMPT_TIMEOUT_SECS), reply_rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(anyhow!("codex service worker dropped response")),
            Err(_) => Err(anyhow!(
                "prompt timed out after {} seconds. The request may still be processing.",
                PROMPT_TIMEOUT_SECS
            )),
        }
    }
}
```

### 配置化超时（可选增强）

```rust
// src-tauri/src/codex/types.rs
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CodexConfig {
    /// Prompt timeout in seconds (default: 300)
    #[serde(default = "default_prompt_timeout")]
    pub prompt_timeout_secs: u64,
}

fn default_prompt_timeout() -> u64 {
    300
}

// 在 CodexService 中使用配置
impl CodexService {
    pub async fn send_prompt_with_timeout(
        &self,
        session_id: String,
        content: String,
        timeout_secs: Option<u64>,
    ) -> Result<PromptResult> {
        let timeout_duration = Duration::from_secs(
            timeout_secs.unwrap_or(PROMPT_TIMEOUT_SECS)
        );
        // ... rest of implementation
    }
}
```

---

## 2.2 实现用户可取消功能

### 后端修改

#### `src-tauri/src/codex/service.rs`

```rust
impl CodexService {
    /// Cancel an in-flight prompt for the ACP session.
    /// Returns immediately after sending the cancel signal.
    pub async fn cancel(&self, session_id: String) -> Result<()> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(ServiceCommand::Cancel {
                session_id,
                reply: reply_tx,
            })
            .map_err(|_| anyhow!("codex service worker stopped"))?;
        
        // Cancel 操作使用较短的超时（30秒）
        match timeout(Duration::from_secs(30), reply_rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(anyhow!("cancel operation dropped")),
            Err(_) => {
                // Cancel 超时也视为成功（best-effort）
                tracing::warn!("cancel timed out, but continuing");
                Ok(())
            }
        }
    }
}
```

### 前端修改

#### `src/api/codex.ts`

```typescript
export async function cancelPrompt(sessionId: string): Promise<void> {
  await invoke<void>('codex_cancel', {
    sessionId,
    session_id: sessionId,
  });
}
```

#### `src/hooks/useCodexActions.ts`

```typescript
// 添加取消功能
const handleCancelGeneration = useCallback(async () => {
  const { selectedSessionId, setIsGenerating } = sessionStore.getState();
  const { getCodexSessionId } = codexStore.getState();
  
  const codexSessionId = getCodexSessionId(selectedSessionId);
  if (!codexSessionId) {
    // 没有 codex session，直接重置状态
    setIsGenerating(selectedSessionId, false);
    return;
  }
  
  try {
    await cancelPrompt(codexSessionId);
  } catch (err) {
    devDebug('[codex] cancel failed', err);
  } finally {
    // 无论成功失败都重置状态
    setIsGenerating(selectedSessionId, false);
  }
}, []);

return {
  // ... 现有返回值
  handleCancelGeneration,
};
```

#### 组件中使用

```typescript
// src/components/business/ChatInput/ChatInput.tsx
import { useCodexActions } from '../../../hooks/useCodexActions';
import { useIsGenerating } from '../../../stores/sessionStore';

export function ChatInput() {
  const { handleSendMessage, handleCancelGeneration } = useCodexActions();
  const isGenerating = useIsGenerating();
  
  const handleSubmit = useCallback(() => {
    if (isGenerating) {
      // 正在生成时，点击变为取消
      handleCancelGeneration();
    } else {
      handleSendMessage(draft);
    }
  }, [isGenerating, handleCancelGeneration, handleSendMessage, draft]);
  
  return (
    <div className="chat-input">
      <textarea ... />
      <button onClick={handleSubmit}>
        {isGenerating ? (
          <>
            <StopIcon />
            {t('chat.cancel')}
          </>
        ) : (
          <>
            <SendIcon />
            {t('chat.send')}
          </>
        )}
      </button>
    </div>
  );
}
```

---

## 2.3 添加错误边界和重试 UI

### 错误边界组件

```typescript
// src/components/ui/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="error-boundary-fallback">
            <h3>出错了</h3>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}>
              重试
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### 错误消息组件

```typescript
// src/components/ui/feedback/ErrorMessage.tsx
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryable?: boolean;
}

export function ErrorMessage({ error, onRetry, onDismiss, retryable = true }: ErrorMessageProps) {
  const { t } = useTranslation();
  
  return (
    <div className={styles.errorMessage}>
      <div className={styles.errorIcon}>⚠️</div>
      <div className={styles.errorContent}>
        <p className={styles.errorText}>{error}</p>
        <div className={styles.errorActions}>
          {retryable && onRetry && (
            <button className={styles.retryButton} onClick={onRetry}>
              {t('common.retry')}
            </button>
          )}
          {onDismiss && (
            <button className={styles.dismissButton} onClick={onDismiss}>
              {t('common.dismiss')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

```css
/* src/components/ui/feedback/ErrorMessage.module.css */
.errorMessage {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: var(--border-radius-md);
  margin: var(--spacing-sm) 0;
}

.errorIcon {
  flex-shrink: 0;
  font-size: 1.25rem;
}

.errorContent {
  flex: 1;
}

.errorText {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-error-text);
}

.errorActions {
  display: flex;
  gap: var(--spacing-sm);
}

.retryButton {
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
}

.dismissButton {
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
}
```

### 在消息列表中使用

```typescript
// src/components/business/MessageList/MessageList.tsx
import { ErrorMessage } from '../../ui/feedback/ErrorMessage';

function MessageItem({ message, onRetry }: MessageItemProps) {
  const isError = message.role === 'assistant' && 
    message.content.includes('timed out') || 
    message.content.includes('failed');
  
  if (isError) {
    return (
      <ErrorMessage
        error={message.content}
        onRetry={onRetry}
        retryable={true}
      />
    );
  }
  
  return (
    // ... normal message rendering
  );
}
```

---

## 2.4 超时提示与用户操作

### 超时事件处理

```typescript
// src/hooks/useCodexEvents.ts

// 添加超时检测
listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', (event) => {
  // ... existing logic
  
  // 检测是否超时
  const stopReason = event.payload.stopReason;
  if (typeof stopReason === 'object' && stopReason !== null) {
    const reason = stopReason as Record<string, unknown>;
    if (reason.type === 'timeout' || reason.error?.includes?.('timed out')) {
      // 添加超时提示消息
      const timeoutMsg: Message = {
        id: newMessageId(),
        role: 'system',
        content: t('errors.promptTimeout'),
        isStreaming: false,
        timestamp: new Date(),
        metadata: {
          type: 'timeout',
          retryable: true,
        },
      };
      useSessionStore.getState().addMessage(sessionId, timeoutMsg);
    }
  }
});
```

### i18n 更新

```json
// src/i18n/locales/zh.json
{
  "errors": {
    "promptTimeout": "请求超时。您可以尝试重新发送，或者缩短提示内容。",
    "requestFailed": "请求失败：{{error}}",
    "networkError": "网络连接失败，请检查网络后重试。"
  },
  "common": {
    "retry": "重试",
    "dismiss": "关闭"
  }
}
```

---

## 验收标准

### 功能验收

- [ ] prompt 在 5 分钟后自动超时
- [ ] 超时后显示友好的错误提示
- [ ] 用户可以随时取消正在进行的生成
- [ ] 取消后 UI 状态正确重置
- [ ] 错误消息提供重试选项

### 可靠性验收

- [ ] 超时不会导致 UI 卡死
- [ ] 取消操作立即响应（< 1s）
- [ ] 连续错误不会累积影响性能
- [ ] 错误边界捕获未预期的异常

### 回滚方案

1. 移除超时逻辑，恢复无限等待
2. 移除取消按钮，保持原有发送逻辑
3. 移除错误边界组件

---

## 下一步

完成 Phase 2 后，继续 [Phase 3: 渲染性能](./IMPL_GUIDE_PHASE3.md)
