import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';

import { ChatMessage } from '../ChatMessage';
import { Working } from '../../ui/feedback/Working';
import { cn } from '../../../utils/cn';

import type { ApprovalProps } from '../../ui/feedback/Approval';
import type { ToolCallProps } from '../../ui/feedback/ToolCall';
import type { WorkingItem } from '../../ui/feedback/Working';
import type { ChatMessageListProps, Message } from './types';

import './ChatMessageList.css';

type ChatGroup =
  | { type: 'message'; id: string; message: Message }
  | {
      type: 'working';
      id: string;
      items: WorkingItem[];
      isActive: boolean;
      startTime?: number;
    };
type WorkingGroup = Extract<ChatGroup, { type: 'working' }>;

const buildThinkingItem = (message: Message): WorkingItem => {
  const content = message.thinking?.content ?? message.content;
  const isStreaming = message.thinking?.isStreaming ?? message.isStreaming ?? false;
  const phase = message.thinking?.phase ?? (isStreaming ? 'thinking' : 'done');

  return {
    type: 'thinking',
    data: {
      content,
      headerVariant: 'title',
      isStreaming,
      phase,
      startTime: message.thinking?.startTime,
      duration: message.thinking?.duration,
    },
  };
};

const addToolCallItems = (
  toolCalls: ToolCallProps[] | undefined,
  pushItem: (item: WorkingItem, itemId: string) => void,
  fallbackId: string
): boolean => {
  if (!toolCalls || toolCalls.length === 0) return false;
  toolCalls.forEach((toolCall, index) => {
    const itemId = toolCall.toolCallId
      ? `toolcall-${toolCall.toolCallId}`
      : `${fallbackId}-${index}`;
    pushItem({ type: 'toolcall', data: toolCall }, itemId);
  });
  return true;
};

const isWorkingItemActive = (item: WorkingItem): boolean => {
  if (item.type === 'thinking') {
    return (
      item.data.isStreaming === true ||
      item.data.phase === 'thinking' ||
      item.data.phase === 'working'
    );
  }
  if (item.type === 'toolcall') {
    return item.data.status === 'pending' || item.data.status === 'in-progress';
  }
  return item.data.status === 'pending' || Boolean(item.data.loading);
};

const buildChatGroups = (
  messages: Message[],
  approvals?: ApprovalProps[],
  isGenerating?: boolean
): ChatGroup[] => {
  const groups: ChatGroup[] = [];
  let currentWorking: WorkingGroup | null = null;
  let lastUserMessageId: string | number | null = null;
  let lastUserMessageTime: number | null = null;
  const workingGroupCounts: Record<string, number> = {};

  const getWorkingGroupId = (fallbackId: string) => {
    const baseId =
      lastUserMessageId !== null ? `user-${lastUserMessageId}` : `fallback-${fallbackId}`;
    const count = workingGroupCounts[baseId] ?? 0;
    workingGroupCounts[baseId] = count + 1;
    return count === 0 ? `working-${baseId}` : `working-${baseId}-${count}`;
  };

  const pushWorkingItem = (item: WorkingItem, itemId: string) => {
    if (!currentWorking) {
      currentWorking = {
        type: 'working',
        id: getWorkingGroupId(itemId),
        items: [],
        isActive: false,
        startTime: lastUserMessageTime ?? Date.now(),
      };
      groups.push(currentWorking);
    }
    currentWorking.items.push(item);
  };

  const closeWorkingGroup = () => {
    currentWorking = null;
  };

  messages.forEach((message) => {
    if (message.role === 'user') {
      lastUserMessageId = message.id;
      lastUserMessageTime =
        message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now();
    }

    if (message.role === 'thought') {
      pushWorkingItem(buildThinkingItem(message), `thought-${message.id}`);
      return;
    }

    if (message.role === 'tool') {
      addToolCallItems(message.toolCalls, pushWorkingItem, `tool-${message.id}`);
      return;
    }

    let extractedWorking = false;
    if (message.thinking) {
      pushWorkingItem(buildThinkingItem(message), `thinking-${message.id}`);
      extractedWorking = true;
    }

    const hasToolCalls = addToolCallItems(message.toolCalls, pushWorkingItem, `tool-${message.id}`);
    extractedWorking = extractedWorking || hasToolCalls;

    const displayMessage = extractedWorking
      ? { ...message, thinking: undefined, toolCalls: undefined }
      : message;

    groups.push({ type: 'message', id: String(message.id), message: displayMessage });
    closeWorkingGroup();
  });

  if (approvals && approvals.length > 0) {
    approvals.forEach((approval, index) => {
      const itemId = approval.callId ? `approval-${approval.callId}` : `approval-${index}`;
      pushWorkingItem({ type: 'approval', data: approval }, itemId);
    });
  }

  groups.forEach((group) => {
    if (group.type === 'working') {
      group.isActive = group.items.some(isWorkingItemActive);
    }
  });

  const lastUserGroupIndex = (() => {
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      const group = groups[i];
      if (group.type === 'message' && group.message.role === 'user') {
        return i;
      }
    }
    return -1;
  })();
  const lastWorkingGroup =
    [...groups].reverse().find((group): group is WorkingGroup => group.type === 'working') ?? null;
  const currentWorkingGroup =
    lastUserMessageId !== null
      ? ([...groups]
          .reverse()
          .find(
            (group): group is WorkingGroup =>
              group.type === 'working' && group.id.startsWith(`working-user-${lastUserMessageId}`)
          ) ?? null)
      : null;

  if (isGenerating) {
    let activeWorking: WorkingGroup | null = null;
    if (currentWorkingGroup) {
      activeWorking = currentWorkingGroup;
    } else {
      activeWorking = lastWorkingGroup;
    }

    if (activeWorking) {
      activeWorking.isActive = true;
    }
  }

  if (isGenerating && (!currentWorkingGroup || (lastUserMessageId === null && !lastWorkingGroup))) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const startTime =
      lastUserMessage?.timestamp instanceof Date ? lastUserMessage.timestamp.getTime() : Date.now();
    if (lastUserMessage?.id !== undefined) {
      lastUserMessageId = lastUserMessage.id;
    }
    const placeholderGroup: WorkingGroup = {
      type: 'working',
      id: getWorkingGroupId(String(lastUserMessage?.id ?? startTime)),
      isActive: true,
      startTime,
      items: [
        {
          type: 'thinking',
          data: {
            content: '',
            headerVariant: 'default',
            isStreaming: true,
            phase: 'working',
            startTime,
          },
        },
      ],
    };
    if (lastUserGroupIndex >= 0 && lastUserGroupIndex < groups.length - 1) {
      groups.splice(lastUserGroupIndex + 1, 0, placeholderGroup);
    } else {
      groups.push(placeholderGroup);
    }
  }

  return groups;
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
  // eslint-disable-next-line react-hooks/incompatible-library
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
  }, [messages, approvalKey, autoScroll]);

  // 当消息内部在流式“打字”时（不一定触发 messages 变更），也要跟随滚动
  useEffect(() => {
    if (!autoScroll) return;

    const hasStreaming = messages.some(
      (message) =>
        message.isStreaming === true ||
        message.thinking?.isStreaming === true ||
        message.thinking?.phase === 'thinking' ||
        message.thinking?.phase === 'working'
    );
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
  }, [autoScroll, isGenerating, messages]);

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
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
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

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                paddingBottom: virtualRow.index === groups.length - 1 ? 0 : 'var(--spacing-lg)',
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
