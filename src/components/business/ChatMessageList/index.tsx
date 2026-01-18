import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';

import { ChatMessage } from '../ChatMessage';
import { Working } from '../../ui/feedback/Working';
import { cn } from '../../../utils/cn';
import { buildChatGroups } from '../../../utils/chatGroups';

import type { ChatMessageListProps } from './types';

import './ChatMessageList.css';

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  approvals,
  isGenerating = false,
  autoScroll = true,
  className = '',
}: ChatMessageListProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [workingOpenMap, setWorkingOpenMap] = useState<Record<string, boolean>>({});
  const approvalCount = approvals?.length ?? 0;
  const approvalKey = useMemo(
    () => (approvals ? approvals.map((approval) => approval.callId).join('|') : ''),
    [approvals]
  );
  const groups = useMemo(
    () => buildChatGroups(messages, approvals, isGenerating),
    [messages, approvals, isGenerating]
  );
  const hasStreaming = useMemo(
    () =>
      messages.some(
        (message) =>
          message.isStreaming === true ||
          message.thinking?.isStreaming === true ||
          message.thinking?.phase === 'thinking' ||
          message.thinking?.phase === 'working'
      ),
    [messages]
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer follows hooks rules but is not recognized by this eslint rule.
  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 120,
    overscan: 6,
    getItemKey: (index) => groups[index]?.id ?? index,
  });
  const lastWorkingId = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      const group = groups[i];
      if (group.type === 'working') return group.id;
    }
    return null;
  }, [groups]);

  // 检测用户是否在滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      isUserScrollingRef.current = !isAtBottom;
    };

    const scrollListenerOptions: AddEventListenerOptions = { passive: true };
    container.addEventListener('scroll', handleScroll, scrollListenerOptions);
    return () => container.removeEventListener('scroll', handleScroll, scrollListenerOptions);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (!autoScroll || isUserScrollingRef.current) return;

    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, approvalKey, autoScroll]);

  // 当消息内部在流式“打字”时（不一定触发 messages 变更），也要跟随滚动
  useEffect(() => {
    if (!autoScroll) return;

    if (!hasStreaming && !isGenerating) return;

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
  }, [autoScroll, hasStreaming, isGenerating]);

  const classNames = cn('chat-message-list', className);

  if (!isGenerating && messages.length === 0 && approvalCount === 0) {
    return (
      <div className={classNames} ref={containerRef}>
        <div className="chat-message-list__empty">{t('chat.empty')}</div>
      </div>
    );
  }

  return (
    <div className={classNames} ref={containerRef}>
      <div
        className="chat-message-list__virtualizer"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const group = groups[virtualRow.index];
          if (!group) return null;

          let content: JSX.Element | null = null;
          if (group.type === 'message') {
            const message = group.message;
            content = (
              <ChatMessage
                key={`message-${group.id}`}
                role={message.role}
                content={message.content}
                thinking={message.thinking}
                toolCalls={message.toolCalls}
                isStreaming={message.role !== 'user' ? message.isStreaming : false}
                timestamp={message.timestamp}
              />
            );
          } else {
            const isOpen = workingOpenMap[group.id] ?? group.id === lastWorkingId;
            const handleToggle = () => {
              const fallbackOpen = group.id === lastWorkingId;
              setWorkingOpenMap((prev) => ({
                ...prev,
                [group.id]: !(prev[group.id] ?? fallbackOpen),
              }));
            };

            content = (
              <Working
                key={group.id}
                items={group.items}
                startTime={group.startTime}
                isOpen={isOpen}
                isActive={group.isActive}
                onToggle={handleToggle}
              />
            );
          }

          const isLast = virtualRow.index === groups.length - 1;
          const isWorkingGroup = group.type === 'working';

          return (
            <div
              key={virtualRow.key}
              className={cn(
                'chat-message-list__virtual-item',
                isWorkingGroup && 'chat-message-list__virtual-item--working',
                isLast && 'chat-message-list__virtual-item--last'
              )}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ChatMessageList.displayName = 'ChatMessageList';

export type { ChatMessageListProps, Message } from './types';
