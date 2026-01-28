import type { ApprovalProps } from '../components/ui/feedback/Approval';
import type { ToolCallProps } from '../components/ui/feedback/ToolCall';
import type { WorkingItem } from '../components/ui/feedback/Working';
import type { Message } from '../types/message';

export type ChatGroup =
  | { type: 'message'; id: string; message: Message }
  | {
      type: 'working';
      id: string;
      items: WorkingItem[];
      isActive: boolean;
      startTime?: number;
    };
export type WorkingGroup = Extract<ChatGroup, { type: 'working' }>;

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

export const buildChatGroups = (
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
    if (!currentWorking.isActive && isWorkingItemActive(item)) {
      currentWorking.isActive = true;
    }
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

  let lastUserGroupIndex = -1;
  let lastWorkingGroup: WorkingGroup | null = null;
  let currentWorkingGroup: WorkingGroup | null = null;
  const hasUserMessage = lastUserMessageId !== null;

  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (lastUserGroupIndex === -1 && group.type === 'message' && group.message.role === 'user') {
      lastUserGroupIndex = i;
    }
    if (group.type === 'working') {
      if (!lastWorkingGroup) {
        lastWorkingGroup = group;
      }
      if (
        hasUserMessage &&
        !currentWorkingGroup &&
        group.id.startsWith(`working-user-${lastUserMessageId}`)
      ) {
        currentWorkingGroup = group;
      }
    }
    if (
      lastWorkingGroup &&
      (lastUserGroupIndex !== -1 || !hasUserMessage) &&
      (!hasUserMessage || currentWorkingGroup)
    ) {
      break;
    }
  }

  const shouldInsertPlaceholder =
    isGenerating && (!currentWorkingGroup || (lastUserMessageId === null && !lastWorkingGroup));

  if (shouldInsertPlaceholder) {
    const startTime = lastUserMessageTime ?? Date.now();
    const placeholderGroup: WorkingGroup = {
      type: 'working',
      id: getWorkingGroupId(String(lastUserMessageId ?? startTime)),
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
    currentWorkingGroup = placeholderGroup;
  }

  if (isGenerating) {
    let activeWorking: WorkingGroup | null = null;
    if (currentWorkingGroup) {
      activeWorking = currentWorkingGroup;
    } else if (!hasUserMessage) {
      activeWorking = lastWorkingGroup;
    }

    if (activeWorking) {
      activeWorking.isActive = true;
    }
  }

  return groups;
};
