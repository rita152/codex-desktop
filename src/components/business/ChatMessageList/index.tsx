import { useRef, useEffect } from 'react';

import { ChatMessage } from '../ChatMessage';
import { cn } from '../../../utils/cn';

import type { ChatMessageListProps } from './types';

import './ChatMessageList.css';

export function ChatMessageList({
  messages,
  autoScroll = true,
  className = '',
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // 检测用户是否在滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      isUserScrollingRef.current = !isAtBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (!autoScroll || isUserScrollingRef.current) return;

    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, autoScroll]);

  // 当消息内部在流式“打字”时（不一定触发 messages 变更），也要跟随滚动
  useEffect(() => {
    if (!autoScroll) return;

    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const scheduleScrollToBottom = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (isUserScrollingRef.current) return;
        container.scrollTop = container.scrollHeight;
      });
    };

    const observer = new MutationObserver(() => scheduleScrollToBottom());
    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [autoScroll]);

  const classNames = cn('chat-message-list', className);

  if (messages.length === 0) {
    return (
      <div className={classNames} ref={containerRef}>
        <div className="chat-message-list__empty">开始新的对话</div>
      </div>
    );
  }

  return (
    <div className={classNames} ref={containerRef}>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          role={message.role}
          content={message.content}
          thinking={message.thinking}
          isStreaming={message.role !== 'user' ? message.isStreaming : false}
          timestamp={message.timestamp}
        />
      ))}
    </div>
  );
}

export type { ChatMessageListProps, Message } from './types';
