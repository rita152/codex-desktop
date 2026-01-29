import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';

import { ChatMessage } from '../ChatMessage';
import { Working } from '../../ui/feedback/Working';
import { cn } from '../../../utils/cn';
import { buildChatGroups, type ChatGroup } from '../../../utils/chatGroups';
import { PERFORMANCE } from '../../../constants/performance';

import type { ChatMessageListProps } from './types';

import './ChatMessageList.css';

/**
 * Estimate row height based on message type and content length.
 * This improves scroll behavior by reducing layout jumps.
 */
const estimateGroupHeight = (group: ChatGroup | undefined): number => {
  if (!group) return PERFORMANCE.MESSAGE_ESTIMATE_HEIGHT;

  if (group.type === 'working') {
    // Working groups: base height + per-item estimate
    // Collapsed: ~48px, Open: ~48px + items * 60px
    const baseHeight = 48;
    const itemHeight = 60;
    return baseHeight + group.items.length * itemHeight;
  }

  const message = group.message;

  // User messages: typically shorter, single line to few lines
  if (message.role === 'user') {
    const contentLength = message.content?.length ?? 0;
    const estimatedLines = Math.ceil(contentLength / 60); // ~60 chars per line
    return Math.max(60, Math.min(200, 40 + estimatedLines * 24));
  }

  // Tool messages: usually compact
  if (message.role === 'tool') {
    const toolCallCount = message.toolCalls?.length ?? 0;
    return 60 + toolCallCount * 80;
  }

  // Thought messages: variable based on thinking content
  if (message.role === 'thought') {
    const thinkingLength = message.thinking?.content?.length ?? message.content?.length ?? 0;
    if (thinkingLength < 200) return 80;
    if (thinkingLength < 500) return 120;
    return 180;
  }

  // Assistant messages: estimate based on content length
  const contentLength = message.content?.length ?? 0;
  const hasThinking = message.thinking !== undefined;
  const baseHeight = hasThinking ? 80 : 0; // Add height for thinking block

  if (contentLength < 100) return baseHeight + 80;
  if (contentLength < 300) return baseHeight + 120;
  if (contentLength < 800) return baseHeight + 200;
  if (contentLength < 1500) return baseHeight + 350;
  return baseHeight + 500;
};

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
  // Memoize estimateSize function to use dynamic height estimation
  const estimateSize = useCallback(
    (index: number) => estimateGroupHeight(groups[index]),
    [groups]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer follows hooks rules but is not recognized by this eslint rule.
  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan: PERFORMANCE.MESSAGE_OVERSCAN,
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
      const isAtBottom =
        scrollHeight - scrollTop - clientHeight < PERFORMANCE.SCROLL_BOTTOM_THRESHOLD;
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

  const virtualItems = virtualizer.getVirtualItems();
  const renderRow = useCallback(
    (virtualRow: (typeof virtualItems)[number]) => {
      const group = groups[virtualRow.index];
      if (!group) return null;

      let content: ReactNode = null;
      if (group.type === 'message') {
        const message = group.message;
        content = (
          <ChatMessage
            key={`message-${group.id}`}
            role={message.role}
            content={message.content}
            thinking={message.thinking}
            planSteps={message.planSteps}
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
    },
    [groups, lastWorkingId, virtualizer, workingOpenMap]
  );

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
        {virtualItems.map(renderRow)}
      </div>
    </div>
  );
});

ChatMessageList.displayName = 'ChatMessageList';

export type { ChatMessageListProps, Message } from './types';
