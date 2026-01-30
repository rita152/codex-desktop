import { useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatContainer } from './components/business/ChatContainer';

const SettingsModal = lazy(() =>
  import('./components/business/SettingsModal').then((module) => ({
    default: module.SettingsModal,
  }))
);
import { usePanelResize } from './hooks/usePanelResize';
import { useTerminalLifecycle } from './hooks/useTerminalLifecycle';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useSessionEffects } from './hooks/useSessionEffects';
import { useCodexEffects } from './hooks/useCodexEffects';
import { SessionProvider, useSessionContext, CodexProvider, useCodexContext } from './contexts';
import {
  useUIStore,
  useUIStoreInit,
  useSettingsStore,
  useShortcuts,
  MIN_SIDE_PANEL_WIDTH,
} from './stores';
import { DEFAULT_MODEL_ID } from './constants/chat';

import type { SelectOption } from './types/options';
import './App.css';

function AppContent() {
  const { t } = useTranslation();

  // Load settings on mount
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Get shortcuts from settings
  const shortcuts = useShortcuts();

  // UI Store - sidebar, side panel, settings (migrated from UIContext)
  const sidebarVisible = useUIStore((s) => s.sidebarVisible);
  const isNarrowLayout = useUIStore((s) => s.isNarrowLayout);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidePanelVisible = useUIStore((s) => s.sidePanelVisible);
  const setSidePanelVisible = useUIStore((s) => s.setSidePanelVisible);
  const activeSidePanelTab = useUIStore((s) => s.activeSidePanelTab);
  const setActiveSidePanelTab = useUIStore((s) => s.setActiveSidePanelTab);
  const sidePanelWidth = useUIStore((s) => s.sidePanelWidth);
  const setSidePanelWidth = useUIStore((s) => s.setSidePanelWidth);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const handleSideAction = useUIStore((s) => s.handleSideAction);
  const handleSidePanelClose = useUIStore((s) => s.handleSidePanelClose);
  const handleSidePanelTabChange = useUIStore((s) => s.handleSidePanelTabChange);

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

  // Toggle terminal panel
  const handleToggleTerminal = useCallback(() => {
    if (sidePanelVisible && activeSidePanelTab === 'terminal') {
      setSidePanelVisible(false);
    } else {
      setSidePanelVisible(true);
      setActiveSidePanelTab('terminal');
    }
  }, [sidePanelVisible, activeSidePanelTab, setSidePanelVisible, setActiveSidePanelTab]);

  // Stop generation (placeholder - needs backend implementation)
  const handleStopGeneration = useCallback(() => {
    // TODO: Implement stop generation when backend supports it
    // For now, this is a no-op
    console.log('Stop generation requested');
  }, []);

  // Global shortcut actions
  const shortcutActions = useMemo(
    () => ({
      newSession: handleNewChat,
      sendMessage: () => {
        // Send message is handled by the input component
        // This is a fallback that won't be triggered in normal usage
      },
      stopGeneration: handleStopGeneration,
      openSettings,
      toggleSidebar,
      toggleTerminal: handleToggleTerminal,
    }),
    [handleNewChat, handleStopGeneration, openSettings, toggleSidebar, handleToggleTerminal]
  );

  // Register global shortcuts
  useGlobalShortcuts({
    shortcuts,
    actions: shortcutActions,
    enabled: !settingsOpen, // Disable shortcuts when settings modal is open
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
  // Initialize UI store (handles responsive layout)
  useUIStoreInit();

  // Initialize session effects (handles auto-select model/mode)
  useSessionEffects();

  // Initialize Codex effects (handles Codex initialization)
  useCodexEffects();

  return (
    <SessionProvider>
      <CodexProvider>
        <AppContent />
      </CodexProvider>
    </SessionProvider>
  );
}
