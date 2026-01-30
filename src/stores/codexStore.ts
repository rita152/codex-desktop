/**
 * Codex Store - Manages Codex-related state with Zustand
 *
 * This store handles:
 * - Approval state
 * - Message queue state
 * - Prompt history
 *
 * Note: Complex side effects (Tauri events, API calls) remain in hooks.
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';

import type { ApprovalStatus } from '../components/ui/feedback/Approval';
import type { ApprovalRequest } from '../types/codex';

// Queued message type
export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
}

// State types
interface CodexState {
  // Approval state
  pendingApprovals: Record<string, ApprovalRequest>;
  approvalStatuses: Record<string, ApprovalStatus>;
  approvalLoading: Record<string, boolean>;

  // Message queue (per session)
  messageQueues: Record<string, QueuedMessage[]>;

  // Prompt history
  promptHistory: string[];
  historyIndex: number;
  tempDraft: string | null;
}

interface CodexActions {
  // Approval actions
  registerApprovalRequest: (request: ApprovalRequest) => void;
  setApprovalStatus: (callId: string, status: ApprovalStatus) => void;
  setApprovalLoading: (callId: string, loading: boolean) => void;
  clearApproval: (callId: string) => void;
  clearAllApprovals: () => void;

  // Message queue actions
  enqueueMessage: (sessionId: string, content: string) => void;
  dequeueMessage: (sessionId: string) => QueuedMessage | undefined;
  removeFromQueue: (sessionId: string, messageId: string) => void;
  moveToTop: (sessionId: string, messageId: string) => void;
  clearQueue: (sessionId: string) => void;
  getQueue: (sessionId: string) => QueuedMessage[];
  hasQueuedMessages: (sessionId: string) => boolean;

  // Prompt history actions
  addToHistory: (prompt: string) => void;
  goToPrevious: (currentDraft: string) => string | null;
  goToNext: () => string | null;
  resetNavigation: () => void;
}

export type CodexStore = CodexState & CodexActions;

// Constants
const MAX_HISTORY_SIZE = 100;

// Initial state
const initialState: CodexState = {
  pendingApprovals: {},
  approvalStatuses: {},
  approvalLoading: {},
  messageQueues: {},
  promptHistory: [],
  historyIndex: -1,
  tempDraft: null,
};

// Create the store
export const useCodexStore = create<CodexStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Approval actions
      registerApprovalRequest: (request) =>
        set((state) => ({
          pendingApprovals: { ...state.pendingApprovals, [request.requestId]: request },
          approvalStatuses: { ...state.approvalStatuses, [request.requestId]: 'pending' },
        })),

      setApprovalStatus: (callId, status) =>
        set((state) => ({
          approvalStatuses: { ...state.approvalStatuses, [callId]: status },
        })),

      setApprovalLoading: (callId, loading) =>
        set((state) => ({
          approvalLoading: { ...state.approvalLoading, [callId]: loading },
        })),

      clearApproval: (callId) =>
        set((state) => {
          const { [callId]: _pending, ...restPending } = state.pendingApprovals;
          const { [callId]: _status, ...restStatuses } = state.approvalStatuses;
          const { [callId]: _loading, ...restLoading } = state.approvalLoading;
          return {
            pendingApprovals: restPending,
            approvalStatuses: restStatuses,
            approvalLoading: restLoading,
          };
        }),

      clearAllApprovals: () =>
        set({
          pendingApprovals: {},
          approvalStatuses: {},
          approvalLoading: {},
        }),

      // Message queue actions
      enqueueMessage: (sessionId, content) =>
        set((state) => {
          const queue = state.messageQueues[sessionId] ?? [];
          const newMessage: QueuedMessage = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            content,
            timestamp: Date.now(),
          };
          return {
            messageQueues: {
              ...state.messageQueues,
              [sessionId]: [...queue, newMessage],
            },
          };
        }),

      dequeueMessage: (sessionId) => {
        const state = get();
        const queue = state.messageQueues[sessionId] ?? [];
        if (queue.length === 0) return undefined;

        const [first, ...rest] = queue;
        set({
          messageQueues: {
            ...state.messageQueues,
            [sessionId]: rest,
          },
        });
        return first;
      },

      removeFromQueue: (sessionId, messageId) =>
        set((state) => {
          const queue = state.messageQueues[sessionId] ?? [];
          return {
            messageQueues: {
              ...state.messageQueues,
              [sessionId]: queue.filter((m) => m.id !== messageId),
            },
          };
        }),

      moveToTop: (sessionId, messageId) =>
        set((state) => {
          const queue = state.messageQueues[sessionId] ?? [];
          const index = queue.findIndex((m) => m.id === messageId);
          if (index <= 0) return state;

          const message = queue[index];
          const newQueue = [message, ...queue.slice(0, index), ...queue.slice(index + 1)];
          return {
            messageQueues: {
              ...state.messageQueues,
              [sessionId]: newQueue,
            },
          };
        }),

      clearQueue: (sessionId) =>
        set((state) => ({
          messageQueues: {
            ...state.messageQueues,
            [sessionId]: [],
          },
        })),

      getQueue: (sessionId) => {
        return get().messageQueues[sessionId] ?? [];
      },

      hasQueuedMessages: (sessionId) => {
        const queue = get().messageQueues[sessionId] ?? [];
        return queue.length > 0;
      },

      // Prompt history actions
      addToHistory: (prompt) => {
        const trimmed = prompt.trim();
        if (!trimmed) return;

        set((state) => {
          const history = state.promptHistory.filter((p) => p !== trimmed);
          const newHistory = [trimmed, ...history].slice(0, MAX_HISTORY_SIZE);
          return {
            promptHistory: newHistory,
            historyIndex: -1,
            tempDraft: null,
          };
        });
      },

      goToPrevious: (currentDraft) => {
        const state = get();
        const { promptHistory, historyIndex, tempDraft } = state;

        if (promptHistory.length === 0) return null;

        const nextIndex = historyIndex + 1;
        if (nextIndex >= promptHistory.length) return null;

        // Save current draft on first navigation
        const saveTempDraft = historyIndex === -1 ? currentDraft : tempDraft;

        set({
          historyIndex: nextIndex,
          tempDraft: saveTempDraft,
        });

        return promptHistory[nextIndex];
      },

      goToNext: () => {
        const state = get();
        const { promptHistory, historyIndex, tempDraft } = state;

        if (historyIndex <= 0) {
          if (historyIndex === 0) {
            set({ historyIndex: -1 });
            return tempDraft;
          }
          return null;
        }

        const nextIndex = historyIndex - 1;
        set({ historyIndex: nextIndex });
        return promptHistory[nextIndex];
      },

      resetNavigation: () =>
        set({
          historyIndex: -1,
          tempDraft: null,
        }),
    })),
    { name: 'CodexStore', enabled: import.meta.env.DEV }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get pending approvals for a session
 */
export const usePendingApprovals = (sessionId: string) =>
  useCodexStore((state) => {
    return Object.values(state.pendingApprovals).filter(
      (approval) => approval.sessionId === sessionId
    );
  });

/**
 * Get message queue for current session
 */
export const useMessageQueueForSession = (sessionId: string) =>
  useCodexStore((state) => state.messageQueues[sessionId] ?? []);

/**
 * Check if session has queued messages
 */
export const useHasQueuedMessages = (sessionId: string) =>
  useCodexStore((state) => (state.messageQueues[sessionId] ?? []).length > 0);

/**
 * Get prompt history
 */
export const usePromptHistory = () => useCodexStore((state) => state.promptHistory);
