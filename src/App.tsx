import { useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatContainer } from './components/business/ChatContainer';

const SettingsModal = lazy(() =>
  import('./components/business/SettingsModal').then((module) => ({
    default: module.SettingsModal,
  }))
);
import { usePanelResize } from './hooks/usePanelResize';
import { useTerminalLifecycle } from './hooks/useTerminalLifecycle';
import {
  UIProvider,
  useUIContext,
  SessionProvider,
  useSessionContext,
  CodexProvider,
  useCodexContext,
  MIN_SIDE_PANEL_WIDTH,
} from './contexts';
import { DEFAULT_MODEL_ID } from './constants/chat';

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
    selectedSessionId,
    setSessionNotices,
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
    currentPlan,
    // Session Actions
    handleDraftChange,
    handleNewChat,
    handleSessionSelect,
    handleSessionRename,
    // File and CWD Actions
    handleCwdSelect,
    handleSelectCwd,
    handleAddFile,
    handleFileSelect,
  } = useSessionContext();

  // Codex Context - backend communication, queue, and actions
  const {
    handleModelChange,
    handleModeChange,
    handleSessionDelete,
    // Message queue
    currentQueue,
    hasQueuedMessages,
    handleSendMessage,
    handleClearQueue,
    handleRemoveFromQueue,
    handleMoveToTopInQueue,
    handleEditInQueue,
    // Prompt history
    navigateToPreviousPrompt,
    navigateToNextPrompt,
    resetPromptNavigation,
    // Approvals
    approvalCards,
  } = useCodexContext();

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
        onNavigatePreviousPrompt={(currentDraft) => navigateToPreviousPrompt(currentDraft)}
        onNavigateNextPrompt={() => navigateToNextPrompt()}
        onResetPromptNavigation={() => resetPromptNavigation()}
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
