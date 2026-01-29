/**
 * Codex Store Sync Hook
 *
 * Synchronizes state from CodexContext to CodexStore.
 * This allows components to use fine-grained store selectors
 * while keeping the complex side-effect logic in CodexContext.
 */

import { useEffect } from 'react';
import { useCodexStore } from './codexStore';

import type { ApprovalStatus } from '../components/ui/feedback/Approval';
import type { ApprovalRequest } from '../types/codex';

interface QueuedMessage {
  id: string;
  content: string;
  timestamp: Date;
}

interface UseCodexStoreSyncArgs {
  pendingApprovals: ApprovalRequest[];
  approvalStatuses: Record<string, ApprovalStatus>;
  approvalLoading: Record<string, boolean>;
  currentQueue: QueuedMessage[];
  selectedSessionId: string;
}

/**
 * Sync codex state from Context to Store.
 * Call this in CodexProvider to keep the store in sync.
 */
export function useCodexStoreSync({
  pendingApprovals,
  approvalStatuses,
  approvalLoading,
  currentQueue,
  selectedSessionId,
}: UseCodexStoreSyncArgs): void {
  const store = useCodexStore;

  // Sync pending approvals - convert array to Record
  useEffect(() => {
    const approvalsRecord: Record<string, ApprovalRequest> = {};
    for (const approval of pendingApprovals) {
      approvalsRecord[approval.requestId] = approval;
    }
    store.setState({ pendingApprovals: approvalsRecord });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store is a stable zustand reference
  }, [pendingApprovals]);

  // Sync approval statuses
  useEffect(() => {
    store.setState({ approvalStatuses });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store is a stable zustand reference
  }, [approvalStatuses]);

  // Sync approval loading
  useEffect(() => {
    store.setState({ approvalLoading });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store is a stable zustand reference
  }, [approvalLoading]);

  // Sync message queue for current session - convert timestamp to number
  useEffect(() => {
    const convertedQueue = currentQueue.map((msg) => ({
      id: msg.id,
      content: msg.content,
      timestamp: msg.timestamp.getTime(),
    }));
    store.setState((state) => ({
      messageQueues: {
        ...state.messageQueues,
        [selectedSessionId]: convertedQueue,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store is a stable zustand reference
  }, [currentQueue, selectedSessionId]);
}
