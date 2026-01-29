import { useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatContainer } from './components/business/ChatContainer';

const SettingsModal = lazy(() =>
  import('./components/business/SettingsModal').then((module) => ({ default: module.SettingsModal }))
);
import { initCodex, sendPrompt, setSessionMode, setSessionModel } from './api/codex';
import { useApprovalCards } from './hooks/useApprovalCards';
import { useApprovalState } from './hooks/useApprovalState';
import { useCodexSessionSync } from './hooks/useCodexSessionSync';
import { usePanelResize } from './hooks/usePanelResize';
import { useRemoteCwdPicker } from './hooks/useRemoteCwdPicker';
import { useFileAndCwdActions } from './hooks/useFileAndCwdActions';
import { useTerminalLifecycle } from './hooks/useTerminalLifecycle';
import { useMessageQueue } from './hooks/useMessageQueue';
import { usePromptHistory } from './hooks/usePromptHistory';
import {
  UIProvider,
  useUIContext,
  SessionProvider,
  useSessionContext,
  MIN_SIDE_PANEL_WIDTH,
} from './contexts';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from './constants/chat';
import { formatError, newMessageId } from './utils/codexParsing';
import { resolveOptionId } from './utils/optionSelection';
import { devDebug } from './utils/logger';
import { terminalKill } from './api/terminal';

import type { Message } from './types/message';
import type { ChatSession } from './types/session';
import type { SelectOption } from './types/options';
import './App.css';

function AppContent() {
  const { t } = useTranslation();

  // UI Context - sidebar, side panel, settings
  const {
    sidebarVisible,
    isNarrowLayout,
    toggleSidebar,
    sidePanelVisible,
    setSidePanelVisible,
    activeSidePanelTab,
    setActiveSidePanelTab,
    sidePanelWidth,
    setSidePanelWidth,
    settingsOpen,
    openSettings,
    closeSettings,
    handleSideAction,
    handleSidePanelClose,
    handleSidePanelTabChange,
  } = useUIContext();

  // Session Context - session state, derived data, and actions
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
    modelCache,
    applyModelOptions,
    applyModeOptions,
    isGeneratingBySession,
    setIsGeneratingBySession,
    terminalBySession,
    setTerminalBySession,
    activeSessionIdRef,
    activeSession,
    messages,
    draftMessage,
    selectedModel,
    selectedMode,
    selectedCwd,
    sessionNotice,
    agentOptions,
    modelOptions,
    slashCommands,
    isGenerating,
    cwdLocked,
    activeTerminalId,
    // Session Actions
    handleDraftChange,
    handleNewChat,
    handleSessionSelect,
    handleSessionRename,
  } = useSessionContext();

  const pickRemoteCwd = useRemoteCwdPicker();

  const {
    pendingApprovals,
    approvalStatuses,
    approvalLoading,
    setApprovalStatuses,
    setApprovalLoading,
    registerApprovalRequest,
    clearApproval,
  } = useApprovalState();

  const bodyRef = useRef<HTMLDivElement | null>(null);
  // We can keep these hooks if they provide other utility, but we will ignore their visibility state for UI rendering
  // Ideally we should refactor them later to remove the UI state from them entirely if unused.
  // For now, let's just use usePanelResize for the unified panel directly.

  const handleSidePanelResize = usePanelResize({
    isOpen: sidePanelVisible,
    width: sidePanelWidth,
    setWidth: setSidePanelWidth,
    minWidth: MIN_SIDE_PANEL_WIDTH,
    minContentWidth: 240, // MIN_CONVERSATION_WIDTH
    getContainerWidth: () => {
      const mainWidth = bodyRef.current?.getBoundingClientRect().width ?? 0;
      if (!mainWidth) return 0;
      return mainWidth + sidePanelWidth;
    },
  });

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

  // Extract current active plan from messages (last message with planSteps)
  // Hide plan when all steps are completed
  const currentPlan = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const planSteps = messages[i].planSteps;
      if (planSteps && planSteps.length > 0) {
        // Check if all steps are completed - if so, hide the plan
        const allCompleted = planSteps.every((step) => step.status === 'completed');
        if (allCompleted) {
          return undefined;
        }
        return planSteps;
      }
    }
    return undefined;
  }, [messages]);

  useTerminalLifecycle({
    terminalVisible: sidePanelVisible && activeSidePanelTab === 'terminal', // Sync lifecycle with unified state
    selectedSessionId,
    activeTerminalId,
    selectedCwd,
    setTerminalBySession,
    setTerminalVisible: (visible) => {
      // If the lifecycle wants to close the terminal, we close the panel if it's the terminal tab
      if (!visible && activeSidePanelTab === 'terminal') {
        setSidePanelVisible(false);
      }
      // If it wants to open, we open the panel
      if (visible) {
        setSidePanelVisible(true);
        setActiveSidePanelTab('terminal');
      }
    },
    setSessionNotices,
    t,
  });

  useEffect(() => {
    if (!modelOptions || modelOptions.length === 0) return;
    const available = new Set(modelOptions.map((option) => option.value));
    if (available.has(selectedModel)) return;

    const preferred = resolveOptionId({
      availableOptions: modelOptions,
      fallbackIds: [DEFAULT_MODEL_ID, modelCache.currentId],
      defaultId: DEFAULT_MODEL_ID,
    });

    if (!preferred || preferred === selectedModel) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === selectedSessionId ? { ...session, model: preferred } : session
      )
    );
  }, [modelCache.currentId, modelOptions, selectedModel, selectedSessionId, setSessions]);

  useEffect(() => {
    if (!agentOptions || agentOptions.length === 0) return;
    const available = new Set(agentOptions.map((option) => option.value));
    if (available.has(selectedMode)) return;

    const preferred = resolveOptionId({
      availableOptions: agentOptions,
      fallbackIds: [DEFAULT_MODE_ID],
      defaultId: DEFAULT_MODE_ID,
    });

    if (!preferred || preferred === selectedMode) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === selectedSessionId ? { ...session, mode: preferred } : session
      )
    );
  }, [agentOptions, selectedMode, selectedSessionId, setSessions]);

  useEffect(() => {
    void initCodex().catch((err) => {
      devDebug('[codex] init failed', err);
    });
  }, []);

  const handleModelOptionsFetched = useCallback(
    ({ options, currentId }: { options: SelectOption[]; currentId?: string }) => {
      applyModelOptions({
        options,
        currentId,
        fallbackCurrentId: DEFAULT_MODEL_ID,
      });
    },
    [applyModelOptions]
  );

  const { handleCwdSelect, handleSelectCwd, handleAddFile, handleFileSelect } =
    useFileAndCwdActions({
      t,
      selectedSessionId,
      selectedCwd,
      pickRemoteCwd,
      setSessions,
      setSessionDrafts,
      setSessionNotices,
      clearSessionNotice,
    });

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

      // 如果删除的是当前选中的会话，切换到第一个会话
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
      terminalBySession,
      t,
    ]
  );

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

  // 实际发送消息到后端的处理函数
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

      // 如果是第一条消息，用消息内容更新会话标题
      const sessionMessages_ = sessionMessages[sessionId] ?? [];
      if (sessionMessages_.length === 0) {
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
    [ensureCodexSession, sessionMessages, setSessions, setSessionMessages, t]
  );

  // 消息队列 Hook
  const {
    currentQueue,
    hasQueuedMessages,
    enqueueMessage,
    clearQueue,
    removeFromQueue,
    moveToTop,
  } = useMessageQueue({
    selectedSessionId,
    isGeneratingBySession,
    onSendMessage: doSendMessage,
  });

  // Prompt history hook for arrow key navigation
  const {
    addToHistory,
    goToPrevious: navigateToPreviousPrompt,
    goToNext: navigateToNextPrompt,
    resetNavigation: resetPromptNavigation,
  } = usePromptHistory();

  // 对外暴露的发送消息处理：支持排队
  const handleSendMessage = useCallback(
    (content: string) => {
      addToHistory(content);
      enqueueMessage(content);
    },
    [addToHistory, enqueueMessage]
  );

  // 清空当前会话的队列
  const handleClearQueue = useCallback(() => {
    clearQueue(selectedSessionId);
  }, [clearQueue, selectedSessionId]);

  // 从队列中移除消息
  const handleRemoveFromQueue = useCallback(
    (messageId: string) => {
      removeFromQueue(selectedSessionId, messageId);
    },
    [removeFromQueue, selectedSessionId]
  );

  // 将消息移到队首
  const handleMoveToTopInQueue = useCallback(
    (messageId: string) => {
      moveToTop(selectedSessionId, messageId);
    },
    [moveToTop, selectedSessionId]
  );

  // 编辑当前消息：从队列移除并放到输入框
  const handleEditInQueue = useCallback(
    (messageId: string) => {
      const queue = currentQueue;
      const message = queue.find((msg) => msg.id === messageId);
      if (message) {
        handleDraftChange(message.content);
        removeFromQueue(selectedSessionId, messageId);
      }
    },
    [currentQueue, handleDraftChange, removeFromQueue, selectedSessionId]
  );

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

  return (
    <>
      <ChatContainer
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        sessionCwd={selectedCwd}
        sessionNotice={sessionNotice}
        messages={messages}
        approvals={approvalCards}
        sidebarVisible={sidebarVisible}
        isGenerating={isGenerating}
        currentPlan={currentPlan}
        messageQueue={currentQueue}
        hasQueuedMessages={hasQueuedMessages}
        onClearQueue={handleClearQueue}
        onRemoveFromQueue={handleRemoveFromQueue}
        onMoveToTopInQueue={handleMoveToTopInQueue}
        onEditInQueue={handleEditInQueue}
        inputValue={draftMessage}
        onInputChange={handleDraftChange}
        agentOptions={agentOptions}
        selectedAgent={selectedMode}
        onAgentChange={handleModeChange}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        slashCommands={slashCommands}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        onSendMessage={handleSendMessage}
        onAddClick={handleAddFile}
        onSideAction={handleSideAction}
        // Unified Side Panel Props
        sidePanelVisible={sidePanelVisible}
        activeSidePanelTab={activeSidePanelTab}
        sidePanelWidth={sidePanelWidth}
        onSidePanelClose={handleSidePanelClose}
        onSidePanelResizeStart={handleSidePanelResize}
        onSidePanelTabChange={handleSidePanelTabChange}
        // Feature specific props needed inside the panel
        terminalId={activeTerminalId ?? null}
        onPickLocalCwd={handleSelectCwd}
        onSetCwd={handleCwdSelect}
        cwdLocked={cwdLocked}
        onSessionDelete={handleSessionDelete}
        onSessionRename={handleSessionRename}
        onSidebarToggle={isNarrowLayout ? undefined : toggleSidebar}
        onSettingsClick={openSettings}
        bodyRef={bodyRef}
        onFileSelect={handleFileSelect}
        onNavigatePreviousPrompt={navigateToPreviousPrompt}
        onNavigateNextPrompt={navigateToNextPrompt}
        onResetPromptNavigation={resetPromptNavigation}
      />
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={settingsOpen}
            onClose={closeSettings}
            availableModels={modelOptions}
            onModelOptionsResolved={handleModelOptionsFetched}
          />
        </Suspense>
      )}
    </>
  );
}

// App component with Context Providers
export function App() {
  return (
    <UIProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </UIProvider>
  );
}
