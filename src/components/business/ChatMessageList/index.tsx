import { useRef, useEffect } from 'react';

import { ChatMessage } from '../ChatMessage';

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

  const classNames = ['chat-message-list', className].filter(Boolean).join(' ');

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
          isStreaming={message.isStreaming}
          timestamp={message.timestamp}
        />
      ))}
    </div>
  );
}

export type { ChatMessageListProps, Message } from './types';
