import { useMemo, useRef } from 'react';

import { buildChatGroups, type ChatGroup } from '../utils/chatGroups';

import type { ApprovalProps } from '../components/ui/feedback/Approval';
import type { Message } from '../types/message';

interface UseChatGroupsOptions {
  messages: Message[];
  approvals?: ApprovalProps[];
  isGenerating?: boolean;
}

interface UseChatGroupsResult {
  groups: ChatGroup[];
  groupCount: number;
  hasWorkingGroup: boolean;
  lastWorkingGroupId: string | null;
}

/**
 * Hook to build and manage chat groups from messages and approvals.
 * Provides memoized groups and derived state for efficient rendering.
 *
 * @param options - Configuration options
 * @returns Chat groups and derived state
 */
export function useChatGroups({
  messages,
  approvals,
  isGenerating,
}: UseChatGroupsOptions): UseChatGroupsResult {
  // Track previous values for potential future incremental updates
  const prevMessagesLengthRef = useRef(0);
  const prevApprovalsLengthRef = useRef(0);

  const groups = useMemo(() => {
    const result = buildChatGroups(messages, approvals, isGenerating);

    // Update tracking refs
    prevMessagesLengthRef.current = messages.length;
    prevApprovalsLengthRef.current = approvals?.length ?? 0;

    return result;
  }, [messages, approvals, isGenerating]);

  // Derive commonly needed values
  const lastWorkingGroupId = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      const group = groups[i];
      if (group.type === 'working') return group.id;
    }
    return null;
  }, [groups]);

  const hasWorkingGroup = lastWorkingGroupId !== null;

  return {
    groups,
    groupCount: groups.length,
    hasWorkingGroup,
    lastWorkingGroupId,
  };
}
