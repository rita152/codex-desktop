import { useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatContainer } from './components/business/ChatContainer';

const SettingsModal = lazy(() =>
  import('./components/business/SettingsModal').then((module) => ({ default: module.SettingsModal }))
);
import { useApprovalCards } from './hooks/useApprovalCards';
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
  CodexProvider,
  useCodexContext,
  MIN_SIDE_PANEL_WIDTH,
} from './contexts';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from './constants/chat';
import { resolveOptionId } from './utils/optionSelection';

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
    setSessionDrafts,
    setSessionNotices,
    clearSessionNotice,
    modelCache,
    applyModelOptions,
    setTerminalBySession,
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
    isGeneratingBySession,
    // Session Actions
    handleDraftChange,
    handleNewChat,
    handleSessionSelect,
    handleSessionRename,
  } = useSessionContext();

  // Codex Context - backend communication and actions
  const {
    resolveChatSessionId,
    handleModelChange,
    handleModeChange,
    doSendMessage,
    handleSessionDelete,
    pendingApprovals,
    approvalStatuses,
    approvalLoading,
    setApprovalStatuses,
    setApprovalLoading,
    clearApproval,
  } = useCodexContext();

  const pickRemoteCwd = useRemoteCwdPicker();

  const bodyRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-select available model/mode when current is unavailable
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
        <CodexProvider>
          <AppContent />
        </CodexProvider>
      </SessionProvider>
    </UIProvider>
  );
}
