import { useRef, useEffect, useMemo, useState } from 'react';

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
  | { type: 'working'; id: string; items: WorkingItem[]; isActive: boolean };
type WorkingGroup = Extract<ChatGroup, { type: 'working' }>;

const buildThinkingItem = (message: Message): WorkingItem => {
  const content = message.thinking?.content ?? message.content;
  const isStreaming = message.thinking?.isStreaming ?? message.isStreaming ?? false;
  const phase = message.thinking?.phase ?? (isStreaming ? 'thinking' : 'done');

  return {
    type: 'thinking',
    data: {
      content,
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
  approvals?: ApprovalProps[]
): ChatGroup[] => {
  const groups: ChatGroup[] = [];
  let currentWorking: WorkingGroup | null = null;

  const pushWorkingItem = (item: WorkingItem, itemId: string) => {
    if (!currentWorking) {
      currentWorking = {
        type: 'working',
        id: `working-${itemId}`,
        items: [],
        isActive: false,
      };
      groups.push(currentWorking);
    }
    currentWorking.items.push(item);
  };

  const closeWorkingGroup = () => {
    currentWorking = null;
  };

  messages.forEach((message) => {
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

    const hasToolCalls = addToolCallItems(
      message.toolCalls,
      pushWorkingItem,
      `tool-${message.id}`
    );
    extractedWorking = extractedWorking || hasToolCalls;

    const displayMessage = extractedWorking
      ? { ...message, thinking: undefined, toolCalls: undefined }
      : message;

    groups.push({ type: 'message', id: String(message.id), message: displayMessage });
    closeWorkingGroup();
  });

  if (approvals && approvals.length > 0) {
    approvals.forEach((approval, index) => {
      const itemId = approval.callId
        ? `approval-${approval.callId}`
        : `approval-${index}`;
      pushWorkingItem({ type: 'approval', data: approval }, itemId);
    });
  }

  groups.forEach((group) => {
    if (group.type === 'working') {
      group.isActive = group.items.some(isWorkingItemActive);
    }
  });

  return groups;
};

export function ChatMessageList({
  messages,
  approvals,
  autoScroll = true,
  className = '',
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [workingOpenMap, setWorkingOpenMap] = useState<Record<string, boolean>>({});
  const approvalCount = approvals?.length ?? 0;
  const approvalKey = approvals
    ? approvals.map((approval) => approval.callId).join('|')
    : '';
  const groups = useMemo(() => buildChatGroups(messages, approvals), [messages, approvals]);
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

  if (messages.length === 0 && approvalCount === 0) {
    return (
      <div className={classNames} ref={containerRef}>
        <div className="chat-message-list__empty">开始新的对话</div>
      </div>
    );
  }

  return (
    <div className={classNames} ref={containerRef}>
      {groups.map((group) => {
        if (group.type === 'message') {
          const message = group.message;
          return (
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
        }

        const isOpen = workingOpenMap[group.id] ?? group.id === lastWorkingId;
        const handleToggle = () => {
          const fallbackOpen = group.id === lastWorkingId;
          setWorkingOpenMap((prev) => ({
            ...prev,
            [group.id]: !(prev[group.id] ?? fallbackOpen),
          }));
        };

        return (
          <Working
            key={group.id}
            items={group.items}
            isOpen={isOpen}
            isActive={group.isActive}
            onToggle={handleToggle}
          />
        );
      })}
    </div>
  );
}

export type { ChatMessageListProps, Message } from './types';
