# Phase 3 实施指南：渲染性能优化

**目标**: 长对话流畅度提升，减少状态更新频率
**优先级**: P1
**预计工作量**: 8h

---

## 3.1 实现 Chunk 合并

### 目标文件

`src/hooks/codexEventMessageHandlers.ts`

### 修改方案

```typescript
// src/hooks/codexEventMessageHandlers.ts

import { closeActiveAssistantMessages, closeActiveThoughtMessages } from '../utils/messageUtils';
import { devDebug } from '../utils/logger';
import { applyToolCallUpdate, getToolCallId, newMessageId } from '../utils/codexParsing';
import { PERFORMANCE } from '../constants/performance';

// ... existing imports and types ...

// 新增：Chunk 合并配置
const CHUNK_MERGE_INTERVAL_MS = 50; // 50ms 合并窗口

// 新增：Chunk 缓冲区类型
interface ChunkBuffer {
  text: string;
  timer: ReturnType<typeof setTimeout>;
  lastUpdate: number;
}

export function createCodexMessageHandlers(
  setSessionMessagesRef: SetSessionMessagesRef
): CodexMessageHandlers {
  const updateMessages = buildUpdater(setSessionMessagesRef);
  
  // 新增：Chunk 缓冲区
  const assistantChunkBuffers: Record<string, ChunkBuffer> = {};
  const thoughtChunkBuffers: Record<string, ChunkBuffer> = {};

  // 新增：批量刷新助手消息
  const flushAssistantChunks = (sessionId: string) => {
    const buffer = assistantChunkBuffers[sessionId];
    if (!buffer || !buffer.text) return;
    
    const mergedText = buffer.text;
    delete assistantChunkBuffers[sessionId];
    
    // 使用合并后的文本进行单次更新
    updateMessages((prev) => {
      const baseList = prev[sessionId] ?? [];
      const now = Date.now();
      const list = closeActiveThoughtMessages(baseList, now);
      const lastMessage = list[list.length - 1];
      
      if (
        lastMessage?.role === 'assistant' &&
        lastMessage.isStreaming === true
      ) {
        const nextList = [...list];
        nextList[nextList.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + mergedText,
          isStreaming: true,
        };
        return { ...prev, [sessionId]: nextList };
      }

      const nextMessage: Message = {
        id: newMessageId(),
        role: 'assistant',
        content: mergedText,
        isStreaming: true,
      };
      return { ...prev, [sessionId]: [...list, nextMessage] };
    });
  };

  // 新增：批量刷新思考消息
  const flushThoughtChunks = (sessionId: string) => {
    const buffer = thoughtChunkBuffers[sessionId];
    if (!buffer || !buffer.text) return;
    
    const mergedText = buffer.text;
    delete thoughtChunkBuffers[sessionId];
    
    updateMessages((prev) => {
      const list = prev[sessionId] ?? [];
      const lastMessage = list[list.length - 1];
      const now = Date.now();

      if (!lastMessage || lastMessage.role !== 'thought' || !lastMessage.isStreaming) {
        const nextMessage: Message = {
          id: newMessageId(),
          role: 'thought',
          content: mergedText,
          isStreaming: true,
          thinking: {
            content: mergedText,
            phase: 'thinking',
            isStreaming: true,
            startTime: now,
          },
        };
        return { ...prev, [sessionId]: [...list, nextMessage] };
      }

      const current = lastMessage;
      const currentContent = current.thinking?.content ?? current.content;
      const nextContent = currentContent + mergedText;
      const startTime = current.thinking?.startTime ?? now;
      const nextList = [...list];
      nextList[nextList.length - 1] = {
        ...current,
        content: nextContent,
        isStreaming: true,
        thinking: {
          content: nextContent,
          phase: 'thinking',
          isStreaming: true,
          startTime,
          duration: current.thinking?.duration,
        },
      };
      return { ...prev, [sessionId]: nextList };
    });
  };

  // 修改：appendThoughtChunk 使用缓冲
  const appendThoughtChunk = (sessionId: string, text: string) => {
    const existing = thoughtChunkBuffers[sessionId];
    
    if (existing) {
      // 合并到现有缓冲区
      clearTimeout(existing.timer);
      existing.text += text;
      existing.lastUpdate = Date.now();
      existing.timer = setTimeout(() => flushThoughtChunks(sessionId), CHUNK_MERGE_INTERVAL_MS);
    } else {
      // 创建新缓冲区
      thoughtChunkBuffers[sessionId] = {
        text,
        lastUpdate: Date.now(),
        timer: setTimeout(() => flushThoughtChunks(sessionId), CHUNK_MERGE_INTERVAL_MS),
      };
    }
    
    devDebug('[appendThoughtChunk] buffered', {
      sessionId,
      textLen: text.length,
      bufferLen: thoughtChunkBuffers[sessionId]?.text.length ?? 0,
    });
  };

  // 修改：appendAssistantChunk 使用缓冲
  const appendAssistantChunk = (sessionId: string, text: string) => {
    const existing = assistantChunkBuffers[sessionId];
    
    if (existing) {
      // 合并到现有缓冲区
      clearTimeout(existing.timer);
      existing.text += text;
      existing.lastUpdate = Date.now();
      existing.timer = setTimeout(() => flushAssistantChunks(sessionId), CHUNK_MERGE_INTERVAL_MS);
    } else {
      // 创建新缓冲区
      assistantChunkBuffers[sessionId] = {
        text,
        lastUpdate: Date.now(),
        timer: setTimeout(() => flushAssistantChunks(sessionId), CHUNK_MERGE_INTERVAL_MS),
      };
    }
    
    devDebug('[appendAssistantChunk] buffered', {
      sessionId,
      textLen: text.length,
      bufferLen: assistantChunkBuffers[sessionId]?.text.length ?? 0,
    });
  };

  // 修改：finalizeStreamingMessages 先刷新缓冲区
  const finalizeStreamingMessages = (sessionId: string) => {
    // 先刷新所有缓冲的 chunks
    if (assistantChunkBuffers[sessionId]) {
      clearTimeout(assistantChunkBuffers[sessionId].timer);
      flushAssistantChunks(sessionId);
    }
    if (thoughtChunkBuffers[sessionId]) {
      clearTimeout(thoughtChunkBuffers[sessionId].timer);
      flushThoughtChunks(sessionId);
    }
    
    // 原有逻辑
    const nowMs = Date.now();
    const now = new Date(nowMs);
    updateMessages((prev) => {
      const list = prev[sessionId] ?? [];
      const next = list.map((m) => {
        if (m.role === 'user' || !m.isStreaming) return m;
        // ... rest of finalization logic
      });
      return { ...prev, [sessionId]: next };
    });
  };

  // ... 保持其他方法不变 ...

  return {
    appendThoughtChunk,
    appendAssistantChunk,
    upsertToolCallMessage,
    applyToolCallUpdateMessage,
    finalizeStreamingMessages,
    updatePlan,
  };
}
```

### 性能常量更新

```typescript
// src/constants/performance.ts
export const PERFORMANCE = {
  // Typewriter effect
  TYPEWRITER_SPEED_CHARS_PER_SEC: 120,
  TYPEWRITER_MAX_CHARS_PER_FRAME: 12,

  // Message handling
  ASSISTANT_APPEND_GRACE_MS: 1500,
  
  // 新增：Chunk 合并配置
  CHUNK_MERGE_INTERVAL_MS: 50, // 50ms 合并窗口
  CHUNK_MAX_BUFFER_SIZE: 10000, // 最大缓冲字符数（防止内存泄漏）

  // Virtualization
  MESSAGE_ESTIMATE_HEIGHT: 120,
  MESSAGE_OVERSCAN: 10, // 从 6 增加到 10
  
  // 新增：渲染节流
  RENDER_THROTTLE_MS: 16, // ~60fps

  // Working timer
  WORKING_TIMER_INTERVAL_MS: 200,

  // Scroll detection
  SCROLL_BOTTOM_THRESHOLD: 50,

  // Panel resize
  MIN_CONVERSATION_WIDTH: 240,
} as const;
```

---

## 3.2 MessageItem Memo 化

### 目标文件

`src/components/business/MessageList/MessageItem.tsx` (或类似文件)

### 修改方案

```typescript
// src/components/business/MessageList/MessageItem.tsx
import { memo, useMemo } from 'react';
import type { Message } from '../../../types/message';

interface MessageItemProps {
  message: Message;
  isLast?: boolean;
  onRetry?: () => void;
}

// 自定义比较函数
function arePropsEqual(prevProps: MessageItemProps, nextProps: MessageItemProps): boolean {
  const prev = prevProps.message;
  const next = nextProps.message;
  
  // 快速路径：ID 不同肯定不同
  if (prev.id !== next.id) return false;
  
  // 比较关键字段
  return (
    prev.content === next.content &&
    prev.isStreaming === next.isStreaming &&
    prev.role === next.role &&
    prevProps.isLast === nextProps.isLast &&
    // 深度比较 thinking
    prev.thinking?.content === next.thinking?.content &&
    prev.thinking?.phase === next.thinking?.phase &&
    // 深度比较 toolCalls (只比较长度和最后一个状态)
    prev.toolCalls?.length === next.toolCalls?.length &&
    prev.toolCalls?.[prev.toolCalls.length - 1]?.status === 
      next.toolCalls?.[next.toolCalls.length - 1]?.status
  );
}

function MessageItemInner({ message, isLast, onRetry }: MessageItemProps) {
  // 使用 useMemo 缓存计算结果
  const formattedContent = useMemo(() => {
    // 格式化消息内容的计算...
    return formatMessageContent(message.content);
  }, [message.content]);
  
  const thinkingState = useMemo(() => {
    if (!message.thinking) return null;
    return {
      content: message.thinking.content,
      phase: message.thinking.phase,
      duration: message.thinking.duration,
    };
  }, [message.thinking?.content, message.thinking?.phase, message.thinking?.duration]);

  return (
    <div className={`message-item message-${message.role}`}>
      {/* ... 渲染逻辑 ... */}
    </div>
  );
}

// 导出 memo 化的组件
export const MessageItem = memo(MessageItemInner, arePropsEqual);
```

### 消息列表优化

```typescript
// src/components/business/MessageList/MessageList.tsx
import { memo, useCallback, useMemo } from 'react';
import { MessageItem } from './MessageItem';
import { useCurrentMessages } from '../../../stores/sessionStore';

function MessageListInner() {
  const messages = useCurrentMessages();
  
  // 使用 useMemo 缓存渲染列表
  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => (
      <MessageItem
        key={message.id}
        message={message}
        isLast={index === messages.length - 1}
      />
    ));
  }, [messages]);

  return (
    <div className="message-list">
      {renderedMessages}
    </div>
  );
}

export const MessageList = memo(MessageListInner);
```

---

## 3.3 虚拟化调优

### 目标文件

如果使用 `@tanstack/react-virtual` 或类似库：

```typescript
// src/components/business/MessageList/VirtualizedMessageList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useCallback } from 'react';
import { useCurrentMessages } from '../../../stores/sessionStore';
import { PERFORMANCE } from '../../../constants/performance';
import { MessageItem } from './MessageItem';

export function VirtualizedMessageList() {
  const messages = useCurrentMessages();
  const parentRef = useRef<HTMLDivElement>(null);
  
  // 动态估算行高
  const estimateSize = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return PERFORMANCE.MESSAGE_ESTIMATE_HEIGHT;
    
    // 根据内容长度估算高度
    const contentLength = message.content?.length ?? 0;
    const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
    const hasThinking = !!message.thinking;
    
    let baseHeight = PERFORMANCE.MESSAGE_ESTIMATE_HEIGHT;
    
    // 长内容增加高度
    if (contentLength > 500) {
      baseHeight += Math.min((contentLength - 500) / 10, 500);
    }
    
    // 工具调用增加高度
    if (hasToolCalls) {
      baseHeight += message.toolCalls!.length * 60;
    }
    
    // 思考过程增加高度
    if (hasThinking) {
      baseHeight += 80;
    }
    
    return baseHeight;
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: PERFORMANCE.MESSAGE_OVERSCAN,
    // 启用动态测量
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="message-list-container"
      style={{ height: '100%', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MessageItem
                message={message}
                isLast={virtualItem.index === messages.length - 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 3.4 添加渲染性能监控

### 性能监控工具

```typescript
// src/utils/performanceMonitor.ts
type PerformanceMetric = {
  name: string;
  value: number;
  timestamp: number;
};

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private enabled: boolean;
  
  constructor() {
    this.enabled = import.meta.env.DEV;
  }

  // 记录渲染次数
  private renderCounts: Record<string, number> = {};
  
  trackRender(componentName: string) {
    if (!this.enabled) return;
    
    this.renderCounts[componentName] = (this.renderCounts[componentName] ?? 0) + 1;
  }
  
  // 记录状态更新
  trackStateUpdate(storeName: string, actionName: string) {
    if (!this.enabled) return;
    
    this.metrics.push({
      name: `${storeName}.${actionName}`,
      value: 1,
      timestamp: Date.now(),
    });
  }
  
  // 记录时间指标
  markStart(name: string) {
    if (!this.enabled) return;
    performance.mark(`${name}-start`);
  }
  
  markEnd(name: string) {
    if (!this.enabled) return;
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  }
  
  // 获取统计
  getStats() {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 5000);
    
    return {
      renderCounts: { ...this.renderCounts },
      stateUpdatesPerSecond: recentMetrics.length / 5,
      measures: performance.getEntriesByType('measure').slice(-20),
    };
  }
  
  // 打印报告
  logReport() {
    if (!this.enabled) return;
    
    const stats = this.getStats();
    console.group('[Performance Report]');
    console.table(stats.renderCounts);
    console.log('State updates/sec:', stats.stateUpdatesPerSecond);
    console.log('Recent measures:', stats.measures);
    console.groupEnd();
  }
  
  // 重置
  reset() {
    this.metrics = [];
    this.renderCounts = {};
    performance.clearMarks();
    performance.clearMeasures();
  }
}

export const perfMonitor = new PerformanceMonitor();

// React hook for tracking renders
export function useTrackRender(componentName: string) {
  perfMonitor.trackRender(componentName);
}
```

### 在组件中使用

```typescript
// src/components/business/MessageList/MessageItem.tsx
import { useTrackRender } from '../../../utils/performanceMonitor';

function MessageItemInner({ message, isLast, onRetry }: MessageItemProps) {
  useTrackRender('MessageItem');
  
  // ... rest of component
}
```

### 开发者工具集成

```typescript
// src/utils/devTools.ts
import { perfMonitor } from './performanceMonitor';

// 在开发模式下暴露到 window
if (import.meta.env.DEV) {
  (window as unknown as { __codexPerf: typeof perfMonitor }).__codexPerf = perfMonitor;
}

// 使用方式（在浏览器控制台）：
// __codexPerf.logReport()
// __codexPerf.getStats()
// __codexPerf.reset()
```

---

## 验收标准

### 功能验收

- [ ] Chunk 合并不影响消息显示完整性
- [ ] 50ms 合并窗口对用户无感知
- [ ] MessageItem memo 正确工作
- [ ] 虚拟化列表滚动流畅

### 性能验收

| 指标 | 优化前 | 优化后目标 |
|------|--------|------------|
| 状态更新频率 | ~20-50/s | <20/s |
| MessageItem 重渲染 | 每次 chunk | 仅内容变化时 |
| 长对话 FPS (100条) | ~30 | >55 |
| 滚动 FPS | ~40 | >55 |

### 测试场景

1. **快速流式输出**: 模拟高频 chunk 到达
2. **长对话滚动**: 100+ 条消息时的滚动性能
3. **多工具调用**: 复杂消息结构的渲染
4. **内存稳定性**: 长时间使用内存不增长

### 回滚方案

1. 移除 chunk 缓冲逻辑，恢复直接更新
2. 移除 MessageItem memo，恢复普通组件
3. 恢复原有虚拟化配置

---

## 下一步

完成 Phase 3 后，评估是否需要 [Phase 4: 架构增强](./IMPL_GUIDE_PHASE4.md)
