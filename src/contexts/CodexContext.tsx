/**
 * Codex Context - Manages Codex backend communication
 *
 * This context handles:
 * - Codex session synchronization
 * - Model/Mode changes via Codex API
 * - Message sending to Codex backend
 * - Session deletion with Codex cleanup
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useCodexSessionSync } from '../hooks/useCodexSessionSync';
import { useApprovalState } from '../hooks/useApprovalState';
import { useApprovalCards } from '../hooks/useApprovalCards';
import { initCodex, sendPrompt, setSessionMode, setSessionModel } from '../api/codex';
import { terminalKill } from '../api/terminal';
import { useSessionContext } from './SessionContext';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';
import { formatError, newMessageId } from '../utils/codexParsing';
import { devDebug } from '../utils/logger';

import type { Message } from '../types/message';
import type { ChatSession } from '../types/session';
import type { ApprovalRequest } from '../types/codex';
import type { ApprovalProps, ApprovalStatus } from '../components/ui/feedback/Approval';

// Types
interface CodexContextValue {
  // Codex session functions
  clearCodexSession: (chatSessionId: string) => void;
  ensureCodexSession: (chatSessionId: string) => Promise<string>;
  getCodexSessionId: (chatSessionId: string) => string | undefined;
  resolveChatSessionId: (codexSessionId?: string) => string | null;

  // Codex actions
  handleModelChange: (modelId: string) => Promise<void>;
  handleModeChange: (modeId: string) => Promise<void>;
  doSendMessage: (sessionId: string, content: string) => void;
  handleSessionDelete: (sessionId: string) => void;

  // Approval state and cards
  approvalCards: ApprovalProps[];
}

const CodexContext = createContext<CodexContextValue | null>(null);

// Provider Component
interface CodexProviderProps {
  children: ReactNode;
}

export function CodexProvider({ children }: CodexProviderProps) {
  const { t } = useTranslation();

  // Get session context dependencies
  const {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionMessages,
    setSessionMessages,
    setSessionDrafts,
    setSessionNotices,
    clearSessionNotice,
    removeSessionMeta,
    setSessionSlashCommands,
    setSessionModeOptions,
    setSessionModelOptions,
    applyModelOptions,
    applyModeOptions,
    setIsGeneratingBySession,
    terminalBySession,
    setTerminalBySession,
    activeSessionIdRef,
    activeSession,
    selectedCwd,
  } = useSessionContext();

  // Approval state
  const {
    pendingApprovals,
    approvalStatuses,
    approvalLoading,
    setApprovalStatuses,
    setApprovalLoading,
    registerApprovalRequest,
    clearApproval,
  } = useApprovalState();

  // Codex session sync
  const { clearCodexSession, ensureCodexSession, getCodexSessionId, resolveChatSessionId } =
    useCodexSessionSync({
      sessions,
      activeSessionIdRef,
      setSessions,
      setSessionMessages,
      setIsGeneratingBySession,
      setSessionSlashCommands,
      setSessionModeOptions,
      setSessionModelOptions,
      setSessionNotices,
      clearSessionNotice,
      applyModeOptions,
      applyModelOptions,
      registerApprovalRequest,
      defaultModeId: DEFAULT_MODE_ID,
      defaultModelId: DEFAULT_MODEL_ID,
      t,
    });

  // Initialize Codex on mount
  useEffect(() => {
    void initCodex().catch((err) => {
      devDebug('[codex] init failed', err);
    });
  }, []);

  // Model change handler
  const handleModelChange = useCallback(
    async (modelId: string) => {
      const sessionId = selectedSessionId;
      const previousModel = activeSession?.model ?? DEFAULT_MODEL_ID;
      if (modelId === previousModel) return;

      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, model: modelId } : session))
      );
      clearSessionNotice(sessionId);

      const codexSessionId = getCodexSessionId(sessionId);
      if (!codexSessionId) return;

      try {
        await setSessionModel(codexSessionId, modelId);
      } catch (err) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, model: previousModel } : session
          )
        );
        setSessionNotices((prev) => ({
          ...prev,
          [sessionId]: {
            kind: 'error',
            message: t('errors.modelSwitchFailed', { error: formatError(err) }),
          },
        }));
      }
    },
    [
      activeSession?.model,
      clearSessionNotice,
      getCodexSessionId,
      selectedSessionId,
      setSessionNotices,
      setSessions,
      t,
    ]
  );

  // Mode change handler
  const handleModeChange = useCallback(
    async (modeId: string) => {
      const sessionId = selectedSessionId;
      const previousMode = activeSession?.mode ?? DEFAULT_MODE_ID;
      if (modeId === previousMode) return;

      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, mode: modeId } : session))
      );
      clearSessionNotice(sessionId);

      const codexSessionId = getCodexSessionId(sessionId);
      if (!codexSessionId) return;

      try {
        await setSessionMode(codexSessionId, modeId);
      } catch (err) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, mode: previousMode } : session
          )
        );
        setSessionNotices((prev) => ({
          ...prev,
          [sessionId]: {
            kind: 'error',
            message: t('errors.modeSwitchFailed', { error: formatError(err) }),
          },
        }));
      }
    },
    [
      activeSession?.mode,
      clearSessionNotice,
      getCodexSessionId,
      selectedSessionId,
      setSessionNotices,
      setSessions,
      t,
    ]
  );

  // Send message to Codex backend
  const doSendMessage = useCallback(
    (sessionId: string, content: string) => {
      const now = Date.now();
      const userMessage: Message = {
        id: String(now),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      activeSessionIdRef.current = sessionId;
      setIsGeneratingBySession((prev) => ({ ...prev, [sessionId]: true }));

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
          setIsGeneratingBySession((prev) => ({ ...prev, [sessionId]: false }));
        }
      })();
    },
    [ensureCodexSession, sessionMessages, setSessions, setSessionMessages, setIsGeneratingBySession, t]
  );

  // Session delete handler with Codex cleanup
  const handleSessionDelete = useCallback(
    (sessionId: string) => {
      const shouldCreateNew = sessions.length <= 1;
      const sessionMeta = sessions.find((session) => session.id === sessionId);
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
          activeSessionIdRef.current = newSessionId;
        } else {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setSelectedSessionId(remaining[0].id);
          }
        }
      }
    },
    [
      clearCodexSession,
      clearSessionNotice,
      removeSessionMeta,
      selectedCwd,
      sessions,
      selectedSessionId,
      setSelectedSessionId,
      setSessionDrafts,
      setSessionMessages,
      setSessions,
      setIsGeneratingBySession,
      terminalBySession,
      setTerminalBySession,
      t,
    ]
  );

  // Approval cards - computed from approval state
  const approvalCards = useApprovalCards({
    pendingApprovals,
    approvalStatuses,
    approvalLoading,
    setApprovalStatuses,
    setApprovalLoading,
    clearApproval,
    resolveChatSessionId,
    selectedSessionId,
    setSessionNotices,
    t,
  });

  const value = useMemo<CodexContextValue>(
    () => ({
      // Codex session functions
      clearCodexSession,
      ensureCodexSession,
      getCodexSessionId,
      resolveChatSessionId,

      // Codex actions
      handleModelChange,
      handleModeChange,
      doSendMessage,
      handleSessionDelete,

      // Approval cards
      approvalCards,
    }),
    [
      clearCodexSession,
      ensureCodexSession,
      getCodexSessionId,
      resolveChatSessionId,
      handleModelChange,
      handleModeChange,
      doSendMessage,
      handleSessionDelete,
      approvalCards,
    ]
  );

  return <CodexContext.Provider value={value}>{children}</CodexContext.Provider>;
}

// Hook to use Codex Context
export function useCodexContext(): CodexContextValue {
  const context = useContext(CodexContext);
  if (!context) {
    throw new Error('useCodexContext must be used within a CodexProvider');
  }
  return context;
}

// Export types
export type { CodexContextValue };
