// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useCodexStore } from './codexStore';
import { resetCodexStore } from './testUtils';

describe('CodexStore', () => {
  beforeEach(() => {
    resetCodexStore();
  });

  describe('approval state', () => {
    const createTestApprovalRequest = (id: string, sessionId = 'session-1') => ({
      requestId: id,
      sessionId,
      toolCall: { name: 'shell', arguments: { command: 'ls' } },
      options: [{ optionId: 'allow_once', label: 'Allow' }],
    });

    it('should register approval request', () => {
      const request = createTestApprovalRequest('req-1');

      useCodexStore.getState().registerApprovalRequest(request);

      const state = useCodexStore.getState();
      expect(state.pendingApprovals['req-1']).toEqual(request);
      expect(state.approvalStatuses['req-1']).toBe('pending');
    });

    it('should update approval status', () => {
      const request = createTestApprovalRequest('req-1');

      useCodexStore.getState().registerApprovalRequest(request);
      useCodexStore.getState().setApprovalStatus('req-1', 'approved');

      expect(useCodexStore.getState().approvalStatuses['req-1']).toBe('approved');
    });

    it('should track approval loading state', () => {
      useCodexStore.getState().setApprovalLoading('req-1', true);
      expect(useCodexStore.getState().approvalLoading['req-1']).toBe(true);

      useCodexStore.getState().setApprovalLoading('req-1', false);
      expect(useCodexStore.getState().approvalLoading['req-1']).toBe(false);
    });

    it('should clear single approval', () => {
      const request = createTestApprovalRequest('req-1');

      useCodexStore.getState().registerApprovalRequest(request);
      useCodexStore.getState().setApprovalLoading('req-1', true);
      useCodexStore.getState().clearApproval('req-1');

      const state = useCodexStore.getState();
      expect(state.pendingApprovals['req-1']).toBeUndefined();
      expect(state.approvalStatuses['req-1']).toBeUndefined();
      expect(state.approvalLoading['req-1']).toBeUndefined();
    });

    it('should clear all approvals', () => {
      useCodexStore.getState().registerApprovalRequest(createTestApprovalRequest('req-1'));
      useCodexStore.getState().registerApprovalRequest(createTestApprovalRequest('req-2'));

      useCodexStore.getState().clearAllApprovals();

      const state = useCodexStore.getState();
      expect(Object.keys(state.pendingApprovals).length).toBe(0);
      expect(Object.keys(state.approvalStatuses).length).toBe(0);
    });
  });

  describe('message queue', () => {
    const sessionId = 'session-1';

    it('should enqueue messages', () => {
      useCodexStore.getState().enqueueMessage(sessionId, 'First message');
      useCodexStore.getState().enqueueMessage(sessionId, 'Second message');

      const queue = useCodexStore.getState().messageQueues[sessionId];
      expect(queue.length).toBe(2);
      expect(queue[0].content).toBe('First message');
      expect(queue[1].content).toBe('Second message');
    });

    it('should dequeue messages in order', () => {
      useCodexStore.getState().enqueueMessage(sessionId, 'First');
      useCodexStore.getState().enqueueMessage(sessionId, 'Second');

      const first = useCodexStore.getState().dequeueMessage(sessionId);
      expect(first?.content).toBe('First');

      const second = useCodexStore.getState().dequeueMessage(sessionId);
      expect(second?.content).toBe('Second');

      const empty = useCodexStore.getState().dequeueMessage(sessionId);
      expect(empty).toBeUndefined();
    });

    it('should remove specific message from queue', () => {
      useCodexStore.getState().enqueueMessage(sessionId, 'First');
      useCodexStore.getState().enqueueMessage(sessionId, 'Second');
      useCodexStore.getState().enqueueMessage(sessionId, 'Third');

      const queue = useCodexStore.getState().messageQueues[sessionId];
      const middleId = queue[1].id;

      useCodexStore.getState().removeFromQueue(sessionId, middleId);

      const newQueue = useCodexStore.getState().messageQueues[sessionId];
      expect(newQueue.length).toBe(2);
      expect(newQueue[0].content).toBe('First');
      expect(newQueue[1].content).toBe('Third');
    });

    it('should move message to top', () => {
      useCodexStore.getState().enqueueMessage(sessionId, 'First');
      useCodexStore.getState().enqueueMessage(sessionId, 'Second');
      useCodexStore.getState().enqueueMessage(sessionId, 'Third');

      const queue = useCodexStore.getState().messageQueues[sessionId];
      const lastId = queue[2].id;

      useCodexStore.getState().moveToTop(sessionId, lastId);

      const newQueue = useCodexStore.getState().messageQueues[sessionId];
      expect(newQueue[0].content).toBe('Third');
      expect(newQueue[1].content).toBe('First');
      expect(newQueue[2].content).toBe('Second');
    });

    it('should clear queue for session', () => {
      useCodexStore.getState().enqueueMessage(sessionId, 'Message');
      useCodexStore.getState().clearQueue(sessionId);

      expect(useCodexStore.getState().messageQueues[sessionId].length).toBe(0);
    });

    it('should check if session has queued messages', () => {
      expect(useCodexStore.getState().hasQueuedMessages(sessionId)).toBe(false);

      useCodexStore.getState().enqueueMessage(sessionId, 'Message');
      expect(useCodexStore.getState().hasQueuedMessages(sessionId)).toBe(true);
    });
  });

  describe('prompt history', () => {
    it('should add prompts to history', () => {
      useCodexStore.getState().addToHistory('First prompt');
      useCodexStore.getState().addToHistory('Second prompt');

      const history = useCodexStore.getState().promptHistory;
      expect(history).toEqual(['Second prompt', 'First prompt']);
    });

    it('should deduplicate prompts', () => {
      useCodexStore.getState().addToHistory('Hello');
      useCodexStore.getState().addToHistory('World');
      useCodexStore.getState().addToHistory('Hello');

      const history = useCodexStore.getState().promptHistory;
      expect(history).toEqual(['Hello', 'World']);
    });

    it('should not add empty prompts', () => {
      useCodexStore.getState().addToHistory('');
      useCodexStore.getState().addToHistory('   ');

      expect(useCodexStore.getState().promptHistory.length).toBe(0);
    });

    it('should navigate through history', () => {
      useCodexStore.getState().addToHistory('First');
      useCodexStore.getState().addToHistory('Second');
      useCodexStore.getState().addToHistory('Third');

      // Navigate to previous
      const prev1 = useCodexStore.getState().goToPrevious('current draft');
      expect(prev1).toBe('Third');
      expect(useCodexStore.getState().historyIndex).toBe(0);

      const prev2 = useCodexStore.getState().goToPrevious('');
      expect(prev2).toBe('Second');
      expect(useCodexStore.getState().historyIndex).toBe(1);

      // Navigate back to next
      const next1 = useCodexStore.getState().goToNext();
      expect(next1).toBe('Third');
      expect(useCodexStore.getState().historyIndex).toBe(0);

      // Navigate back to draft
      const draft = useCodexStore.getState().goToNext();
      expect(draft).toBe('current draft');
      expect(useCodexStore.getState().historyIndex).toBe(-1);
    });

    it('should reset navigation', () => {
      useCodexStore.getState().addToHistory('Test');
      useCodexStore.getState().goToPrevious('draft');

      expect(useCodexStore.getState().historyIndex).toBe(0);

      useCodexStore.getState().resetNavigation();

      expect(useCodexStore.getState().historyIndex).toBe(-1);
      expect(useCodexStore.getState().tempDraft).toBeNull();
    });
  });
});
