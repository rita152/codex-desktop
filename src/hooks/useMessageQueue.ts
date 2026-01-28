import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * 队列中的消息项
 */
export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: Date;
}

/**
 * 按会话分组的消息队列
 */
export type SessionMessageQueue = Record<string, QueuedMessage[]>;

/**
 * useMessageQueue 的参数
 */
export interface UseMessageQueueParams {
  /** 当前选中的会话 ID */
  selectedSessionId: string;
  /** 各会话的生成状态 */
  isGeneratingBySession: Record<string, boolean>;
  /** 实际发送消息的处理函数 */
  onSendMessage: (sessionId: string, content: string) => void;
}

/**
 * useMessageQueue 的返回值
 */
export interface UseMessageQueueReturn {
  /** 获取指定会话的队列 */
  getSessionQueue: (sessionId: string) => QueuedMessage[];
  /** 获取当前会话的队列 */
  currentQueue: QueuedMessage[];
  /** 队列是否有待处理的消息 */
  hasQueuedMessages: boolean;
  /** 添加消息到队列或直接发送 */
  enqueueMessage: (content: string) => void;
  /** 清空指定会话的队列 */
  clearQueue: (sessionId: string) => void;
  /** 从队列中移除指定消息 */
  removeFromQueue: (sessionId: string, messageId: string) => void;
  /** 将消息移到队首 */
  moveToTop: (sessionId: string, messageId: string) => void;
}

/**
 * 消息队列 Hook
 *
 * 当 AI 正在生成时，新的 prompt 会被加入队列等待。
 * 当当前任务完成后，会自动发送队列中的下一条消息。
 */
export function useMessageQueue({
  selectedSessionId,
  isGeneratingBySession,
  onSendMessage,
}: UseMessageQueueParams): UseMessageQueueReturn {
  // 使用 state 存储队列，确保 UI 能够实时响应变化
  const [queueMap, setQueueMap] = useState<SessionMessageQueue>({});

  // 跟踪上一次的生成状态，用于检测任务完成
  const prevGeneratingRef = useRef<Record<string, boolean>>({});
  // 标记是否正在处理队列，防止重复处理
  const processingRef = useRef<Set<string>>(new Set());

  /**
   * 获取指定会话的队列
   */
  const getSessionQueue = useCallback((sessionId: string): QueuedMessage[] => {
    return queueMap[sessionId] ?? [];
  }, [queueMap]);

  /**
   * 处理队列中的下一条消息
   */
  const processNextInQueue = useCallback(
    (sessionId: string) => {
      // 防止重复处理
      if (processingRef.current.has(sessionId)) return;

      setQueueMap((prev) => {
        const queue = prev[sessionId];
        if (!queue || queue.length === 0) return prev;

        // 检查是否正在生成
        if (isGeneratingBySession[sessionId]) return prev;

        // 取出队列中的第一条消息
        const nextMessage = queue[0];
        if (!nextMessage) return prev;

        // 标记正在处理
        processingRef.current.add(sessionId);

        // 发送消息
        onSendMessage(sessionId, nextMessage.content);

        // 处理完成后移除标记
        // 使用 setTimeout 确保状态更新后再移除
        setTimeout(() => {
          processingRef.current.delete(sessionId);
        }, 100);

        // 返回移除第一条消息后的新队列
        return {
          ...prev,
          [sessionId]: queue.slice(1),
        };
      });
    },
    [isGeneratingBySession, onSendMessage]
  );

  /**
   * 监听生成状态变化，当任务完成时自动处理队列
   */
  useEffect(() => {
    // 检查每个会话的状态变化
    Object.keys(isGeneratingBySession).forEach((sessionId) => {
      const wasGenerating = prevGeneratingRef.current[sessionId] ?? false;
      const isGenerating = isGeneratingBySession[sessionId] ?? false;

      // 从生成中变为非生成中（任务完成）
      if (wasGenerating && !isGenerating) {
        // 延迟一点处理，确保 UI 状态更新完成
        setTimeout(() => {
          processNextInQueue(sessionId);
        }, 50);
      }
    });

    // 更新上一次状态
    prevGeneratingRef.current = { ...isGeneratingBySession };
  }, [isGeneratingBySession, processNextInQueue]);

  /**
   * 添加消息到队列或直接发送
   */
  const enqueueMessage = useCallback(
    (content: string) => {
      const sessionId = selectedSessionId;
      const isGenerating = isGeneratingBySession[sessionId] ?? false;

      if (isGenerating) {
        // 正在生成，添加到队列
        const newMessage: QueuedMessage = {
          id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          content,
          timestamp: new Date(),
        };

        setQueueMap((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), newMessage],
        }));
      } else {
        // 没有在生成，直接发送
        onSendMessage(sessionId, content);
      }
    },
    [selectedSessionId, isGeneratingBySession, onSendMessage]
  );

  /**
   * 清空指定会话的队列
   */
  const clearQueue = useCallback((sessionId: string) => {
    setQueueMap((prev) => ({
      ...prev,
      [sessionId]: [],
    }));
  }, []);

  /**
   * 从队列中移除指定消息
   */
  const removeFromQueue = useCallback((sessionId: string, messageId: string) => {
    setQueueMap((prev) => {
      const queue = prev[sessionId];
      if (!queue) return prev;
      return {
        ...prev,
        [sessionId]: queue.filter((msg) => msg.id !== messageId),
      };
    });
  }, []);

  /**
   * 将消息移到队首
   */
  const moveToTop = useCallback((sessionId: string, messageId: string) => {
    setQueueMap((prev) => {
      const queue = prev[sessionId];
      if (!queue) return prev;

      const item = queue.find((msg) => msg.id === messageId);
      if (!item) return prev;

      const rest = queue.filter((msg) => msg.id !== messageId);
      return {
        ...prev,
        [sessionId]: [item, ...rest],
      };
    });
  }, []);

  // 当前会话的队列
  const currentQueue = getSessionQueue(selectedSessionId);
  const hasQueuedMessages = currentQueue.length > 0;

  return {
    getSessionQueue,
    currentQueue,
    hasQueuedMessages,
    enqueueMessage,
    clearQueue,
    removeFromQueue,
    moveToTop,
  };
}
