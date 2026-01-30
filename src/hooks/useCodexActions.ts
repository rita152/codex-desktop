/**
 * Codex Actions Hook
 *
 * Provides business operations related to Codex backend:
 * - Model/Mode changes with optimistic updates and rollback
 * - Message sending
 * - Session deletion with cleanup
 * - Message queue operations
 * - Prompt history navigation
 *
 * This hook uses SessionStore and CodexStore directly.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../stores/sessionStore';
import { useCodexStore } from '../stores/codexStore';
import { sendPrompt, setSessionMode, setSessionModel } from '../api/codex';
import { terminalKill } from '../api/terminal';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';
import { formatError, newMessageId } from '../utils/codexParsing';

import type { Message } from '../types/message';
import type { ChatSession } from '../types/session';

interface UseCodexActionsOptions {
  /**
   * Function to ensure a Codex session exists for a chat session.
   * Returns the Codex session ID.
   */
  ensureCodexSession: (chatSessionId: string) => Promise<string>;
}

/**
 * Hook providing Codex-related business actions.
 *
 * @param options - Configuration options including ensureCodexSession function
 */
export function useCodexActions({ ensureCodexSession }: UseCodexActionsOptions) {
  const { t } = useTranslation();

  // Get store actions
  const sessionStore = useSessionStore;
  const codexStore = useCodexStore;

  // Model change handler with optimistic update and rollback
  const handleModelChange = useCallback(
    async (modelId: string) => {
      const { selectedSessionId, sessions, updateSession, setNotice, clearSessionNotice } =
        sessionStore.getState();
      const { getCodexSessionId } = codexStore.getState();

      const activeSession = sessions.find((s) => s.id === selectedSessionId);
      const previousModel = activeSession?.model ?? DEFAULT_MODEL_ID;
      if (modelId === previousModel) return;

      // Optimistic update
      updateSession(selectedSessionId, { model: modelId });
      clearSessionNotice(selectedSessionId);

      const codexSessionId = getCodexSessionId(selectedSessionId);
      if (!codexSessionId) return;

      try {
        await setSessionModel(codexSessionId, modelId);
      } catch (err) {
        // Rollback on error
        updateSession(selectedSessionId, { model: previousModel });
        setNotice(selectedSessionId, {
          kind: 'error',
          message: t('errors.modelSwitchFailed', { error: formatError(err) }),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
    [t]
  );

  // Mode change handler with optimistic update and rollback
  const handleModeChange = useCallback(
    async (modeId: string) => {
      const { selectedSessionId, sessions, updateSession, setNotice, clearSessionNotice } =
        sessionStore.getState();
      const { getCodexSessionId } = codexStore.getState();

      const activeSession = sessions.find((s) => s.id === selectedSessionId);
      const previousMode = activeSession?.mode ?? DEFAULT_MODE_ID;
      if (modeId === previousMode) return;

      // Optimistic update
      updateSession(selectedSessionId, { mode: modeId });
      clearSessionNotice(selectedSessionId);

      const codexSessionId = getCodexSessionId(selectedSessionId);
      if (!codexSessionId) return;

      try {
        await setSessionMode(codexSessionId, modeId);
      } catch (err) {
        // Rollback on error
        updateSession(selectedSessionId, { mode: previousMode });
        setNotice(selectedSessionId, {
          kind: 'error',
          message: t('errors.modeSwitchFailed', { error: formatError(err) }),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
    [t]
  );

  // Send message to Codex backend
  const doSendMessage = useCallback(
    (sessionId: string, content: string) => {
      const { setSessions, setSessionMessages, setIsGenerating, sessionMessages } =
        sessionStore.getState();

      const now = Date.now();
      const userMessage: Message = {
        id: String(now),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setIsGenerating(sessionId, true);

      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        return { ...prev, [sessionId]: [...list, userMessage] };
      });

      // Update session title with first message content
      const currentMessages = sessionMessages[sessionId] ?? [];
      if (currentMessages.length === 0) {
        const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
      }

      void (async () => {
        try {
          const codexSessionId = await ensureCodexSession(sessionId);
          await sendPrompt(codexSessionId, content);
        } catch (err) {
          setSessionMessages((prev) => {
            const errMsg: Message = {
              id: newMessageId(),
              role: 'assistant',
              content: t('errors.requestFailed', { error: formatError(err) }),
              isStreaming: false,
              timestamp: new Date(),
            };
            return {
              ...prev,
              [sessionId]: [...(prev[sessionId] ?? []), errMsg],
            };
          });
          setIsGenerating(sessionId, false);
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore is a stable zustand reference
    [ensureCodexSession, t]
  );

  // Session delete handler with Codex cleanup
  const handleSessionDelete = useCallback(
    (sessionId: string) => {
      const {
        sessions,
        selectedSessionId,
        setSessions,
        setSessionMessages,
        setIsGeneratingBySession,
        setSessionDrafts,
        removeSessionMeta,
        setSelectedSessionId,
        clearSessionNotice,
        terminalBySession,
        setTerminalBySession,
      } = sessionStore.getState();
      const { clearCodexSession } = codexStore.getState();

      const shouldCreateNew = sessions.length <= 1;
      const sessionMeta = sessions.find((session) => session.id === sessionId);
      const selectedCwd = sessions.find((s) => s.id === selectedSessionId)?.cwd;
      const newSessionId = String(Date.now());
      const newSession: ChatSession = {
        id: newSessionId,
        title: t('chat.newSessionTitle'),
        cwd: sessionMeta?.cwd ?? selectedCwd,
        model: DEFAULT_MODEL_ID,
        mode: DEFAULT_MODE_ID,
      };

      clearCodexSession(sessionId);
      const terminalId = terminalBySession[sessionId];
      if (terminalId) {
        void terminalKill(terminalId);
        setTerminalBySession((prev) => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      }

      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        return shouldCreateNew ? [newSession] : next;
      });

      setSessionMessages((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        if (shouldCreateNew) {
          next[newSessionId] = [];
        }
        return next;
      });

      setIsGeneratingBySession((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        if (shouldCreateNew) {
          next[newSessionId] = false;
        }
        return next;
      });

      setSessionDrafts((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        if (shouldCreateNew) {
          next[newSessionId] = '';
        }
        return next;
      });

      removeSessionMeta(sessionId, shouldCreateNew ? newSessionId : undefined);

      // Switch to first session if deleting current
      if (sessionId === selectedSessionId) {
        if (shouldCreateNew) {
          setSelectedSessionId(newSessionId);
          clearSessionNotice(newSessionId);
        } else {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setSelectedSessionId(remaining[0].id);
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
    [t]
  );

  // Message queue handlers
  const handleSendMessage = useCallback(
    (content: string) => {
      const { selectedSessionId, isGeneratingBySession } = sessionStore.getState();
      const { addToHistory, enqueueMessage } = codexStore.getState();

      addToHistory(content);

      const isGenerating = isGeneratingBySession[selectedSessionId] ?? false;
      if (isGenerating) {
        // Queue the message if generating
        enqueueMessage(selectedSessionId, content);
      } else {
        doSendMessage(selectedSessionId, content);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
    [doSendMessage]
  );

  const handleClearQueue = useCallback(() => {
    const { selectedSessionId } = sessionStore.getState();
    const { clearQueue } = codexStore.getState();
    clearQueue(selectedSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
  }, []);

  const handleRemoveFromQueue = useCallback((messageId: string) => {
    const { selectedSessionId } = sessionStore.getState();
    const { removeFromQueue } = codexStore.getState();
    removeFromQueue(selectedSessionId, messageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
  }, []);

  const handleMoveToTopInQueue = useCallback((messageId: string) => {
    const { selectedSessionId } = sessionStore.getState();
    const { moveToTop } = codexStore.getState();
    moveToTop(selectedSessionId, messageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
  }, []);

  const handleEditInQueue = useCallback((messageId: string) => {
    const { selectedSessionId, setDraft } = sessionStore.getState();
    const { messageQueues, removeFromQueue } = codexStore.getState();
    const queue = messageQueues[selectedSessionId] ?? [];
    const message = queue.find((msg) => msg.id === messageId);
    if (message) {
      setDraft(selectedSessionId, message.content);
      removeFromQueue(selectedSessionId, messageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionStore and codexStore are stable zustand references
  }, []);

  // Prompt history navigation
  const navigateToPreviousPrompt = useCallback((currentDraft: string) => {
    const { goToPrevious } = codexStore.getState();
    return goToPrevious(currentDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- codexStore is a stable zustand reference
  }, []);

  const navigateToNextPrompt = useCallback(() => {
    const { goToNext } = codexStore.getState();
    return goToNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- codexStore is a stable zustand reference
  }, []);

  const resetPromptNavigation = useCallback(() => {
    const { resetNavigation } = codexStore.getState();
    resetNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- codexStore is a stable zustand reference
  }, []);

  return {
    // Model/Mode changes
    handleModelChange,
    handleModeChange,

    // Message sending
    handleSendMessage,
    doSendMessage,

    // Session management
    handleSessionDelete,

    // Message queue
    handleClearQueue,
    handleRemoveFromQueue,
    handleMoveToTopInQueue,
    handleEditInQueue,

    // Prompt history
    navigateToPreviousPrompt,
    navigateToNextPrompt,
    resetPromptNavigation,
  };
}
