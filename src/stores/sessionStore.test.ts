// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './sessionStore';
import { resetSessionStore, createTestSession, createTestMessage } from './testUtils';

describe('SessionStore', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  describe('session list', () => {
    it('should start with one session', () => {
      const state = useSessionStore.getState();
      expect(state.sessions.length).toBe(1);
      expect(state.selectedSessionId).toBe(state.sessions[0].id);
    });

    it('should add a new session', () => {
      const newSession = createTestSession({ title: 'Test Session' });
      useSessionStore.getState().addSession(newSession);

      const state = useSessionStore.getState();
      expect(state.sessions.length).toBe(2);
      expect(state.sessions[0].title).toBe('Test Session');
      expect(state.sessionMessages[newSession.id]).toEqual([]);
      expect(state.sessionDrafts[newSession.id]).toBe('');
    });

    it('should update a session', () => {
      const sessionId = useSessionStore.getState().sessions[0].id;
      useSessionStore.getState().updateSession(sessionId, { title: 'Updated Title' });

      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
      expect(session?.title).toBe('Updated Title');
    });

    it('should remove a session and clean up related data', () => {
      // Get the initial session id
      const initialState = useSessionStore.getState();
      const initialSessionId = initialState.sessions[0].id;

      // Add a second session
      const newSession = createTestSession({ id: 'new-session-id' });
      useSessionStore.getState().addSession(newSession);

      // Verify we have 2 sessions now
      expect(useSessionStore.getState().sessions.length).toBe(2);

      // Remove the initial session
      useSessionStore.getState().removeSession(initialSessionId);

      const state = useSessionStore.getState();
      expect(state.sessions.length).toBe(1);
      expect(state.sessions[0].id).toBe(newSession.id);
      expect(state.sessionMessages[initialSessionId]).toBeUndefined();
      expect(state.sessionDrafts[initialSessionId]).toBeUndefined();
    });

    it('should create new chat', () => {
      const newId = useSessionStore.getState().createNewChat('/test/path', 'New Test Chat');

      const state = useSessionStore.getState();
      expect(state.sessions.length).toBe(2);
      expect(state.selectedSessionId).toBe(newId);

      const newSession = state.sessions.find((s) => s.id === newId);
      expect(newSession?.title).toBe('New Test Chat');
      expect(newSession?.cwd).toBe('/test/path');
    });
  });

  describe('messages', () => {
    it('should add a message to session', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;
      const message = createTestMessage({ content: 'Hello world' });

      useSessionStore.getState().addMessage(sessionId, message);

      const messages = useSessionStore.getState().sessionMessages[sessionId];
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Hello world');
    });

    it('should update a message', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;
      const message = createTestMessage({ content: 'Original' });

      useSessionStore.getState().addMessage(sessionId, message);
      useSessionStore.getState().updateMessage(sessionId, message.id, { content: 'Updated' });

      const messages = useSessionStore.getState().sessionMessages[sessionId];
      expect(messages[0].content).toBe('Updated');
    });

    it('should clear messages for a session', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;
      useSessionStore.getState().addMessage(sessionId, createTestMessage());
      useSessionStore.getState().addMessage(sessionId, createTestMessage());

      useSessionStore.getState().clearMessages(sessionId);

      const messages = useSessionStore.getState().sessionMessages[sessionId];
      expect(messages.length).toBe(0);
    });
  });

  describe('drafts', () => {
    it('should set draft for session', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;

      useSessionStore.getState().setDraft(sessionId, 'My draft message');

      expect(useSessionStore.getState().sessionDrafts[sessionId]).toBe('My draft message');
    });
  });

  describe('notices', () => {
    it('should set and clear notices', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;

      useSessionStore.getState().setNotice(sessionId, { kind: 'error', message: 'Test error' });
      expect(useSessionStore.getState().sessionNotices[sessionId]).toEqual({
        kind: 'error',
        message: 'Test error',
      });

      useSessionStore.getState().clearSessionNotice(sessionId);
      expect(useSessionStore.getState().sessionNotices[sessionId]).toBeUndefined();
    });
  });

  describe('generation state', () => {
    it('should track generating state per session', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;

      expect(useSessionStore.getState().isGeneratingBySession[sessionId]).toBe(false);

      useSessionStore.getState().setIsGenerating(sessionId, true);
      expect(useSessionStore.getState().isGeneratingBySession[sessionId]).toBe(true);

      useSessionStore.getState().setIsGenerating(sessionId, false);
      expect(useSessionStore.getState().isGeneratingBySession[sessionId]).toBe(false);
    });
  });

  describe('terminal state', () => {
    it('should set and clear terminal for session', () => {
      const sessionId = useSessionStore.getState().selectedSessionId;

      useSessionStore.getState().setTerminal(sessionId, 'terminal-123');
      expect(useSessionStore.getState().terminalBySession[sessionId]).toBe('terminal-123');

      useSessionStore.getState().clearTerminal(sessionId);
      expect(useSessionStore.getState().terminalBySession[sessionId]).toBeUndefined();
    });
  });

  describe('options', () => {
    it('should apply model options', () => {
      const options = [
        { value: 'model-1', label: 'Model 1' },
        { value: 'model-2', label: 'Model 2' },
      ];

      useSessionStore.getState().applyModelOptions({
        options,
        currentId: 'model-1',
      });

      expect(useSessionStore.getState().modelCache.options).toEqual(options);
      expect(useSessionStore.getState().modelCache.currentId).toBe('model-1');
    });

    it('should apply mode options', () => {
      const options = [
        { value: 'mode-1', label: 'Mode 1' },
        { value: 'mode-2', label: 'Mode 2' },
      ];

      useSessionStore.getState().applyModeOptions({
        options,
        currentId: 'mode-1',
      });

      expect(useSessionStore.getState().modeCache.options).toEqual(options);
      expect(useSessionStore.getState().modeCache.currentId).toBe('mode-1');
    });
  });
});
