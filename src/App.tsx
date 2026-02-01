/**
 * App Component
 *
 * Main application entry point with Store-based state management.
 *
 * Architecture:
 * - UIStore: UI state (sidebar, panels, settings modal)
 * - SessionStore: Session state (sessions, messages, drafts, options)
 * - CodexStore: Codex state (approvals, queue, history, session mapping)
 * - SettingsStore: App settings (theme, shortcuts)
 *
 * Effects:
 * - useUIStoreInit: Responsive layout handling
 * - useSessionEffects: Auto-select model/mode
 * - useCodexEffects: Codex initialization and event handling
 */

import {
  useCallback,
  useRef,
  useMemo,
  useEffect,
  lazy,
  Suspense,
  Component,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { ChatContainer } from './components/business/ChatContainer';

// Error Boundary for debugging
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h1>Something went wrong</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

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
import { useCodexActions } from './hooks/useCodexActions';
import { useFileAndCwdActionsFromStore } from './hooks/useFileAndCwdActions';
import { useApprovalCardsFromStore } from './hooks/useApprovalCards';
import { useHistoryList } from './hooks/useHistoryList';
import { resumeSession } from './api/codex';
import { devDebug } from './utils/logger';

import type { ChatSession } from './types/session';
import {
  useUIStore,
  useUIStoreInit,
  useSettingsStore,
  useShortcuts,
  useSessionStore,
  useCodexStore,
  MIN_SIDE_PANEL_WIDTH,
} from './stores';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID, DEFAULT_SLASH_COMMANDS } from './constants/chat';

import type { SelectOption } from './types/options';
import './App.css';

function AppContent() {
  const { t } = useTranslation();

  // Initialize stores and effects
  useUIStoreInit();
  useSessionEffects();
  useCodexEffects();

  // Load settings on mount
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const hasCompletedInitialSetup = useSettingsStore((state) => state.hasCompletedInitialSetup);
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Get shortcuts from settings
  const shortcuts = useShortcuts();

  // UI Store - sidebar, side panel, settings
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
  const settingsInitialSection = useUIStore((s) => s.settingsInitialSection);
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const handleSideAction = useUIStore((s) => s.handleSideAction);

  // First-time setup: auto-open settings modal to model section
  const initialSetupCheckedRef = useRef(false);
  useEffect(() => {
    // Only check once, and wait a bit for warmup to fetch model options
    if (initialSetupCheckedRef.current) return;
    initialSetupCheckedRef.current = true;

    if (!hasCompletedInitialSetup) {
      // Delay opening to allow warmup to fetch model options
      const timer = setTimeout(() => {
        openSettings('model');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedInitialSetup, openSettings]);
  const handleSidePanelClose = useUIStore((s) => s.handleSidePanelClose);
  const handleSidePanelTabChange = useUIStore((s) => s.handleSidePanelTabChange);

  // Load history sessions from rollout files (limit to 10 recent items)
  const { items: historyItems } = useHistoryList(true, 10);

  // Session Store - sessions, messages, options
  // Use primitive selectors to avoid infinite loops from derived values
  const activeSessions = useSessionStore((s) => s.sessions);
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);

  // Merge active sessions with history (history items shown after active sessions)
  // Filter out history items that already exist in active sessions
  const activeSessionIds = useMemo(
    () => new Set(activeSessions.map((s) => s.id)),
    [activeSessions]
  );

  // Map of history item id to rollout path (for resuming sessions)
  const historyRolloutPaths = useMemo(
    () => new Map(historyItems.map((item) => [item.id, item.rolloutPath])),
    [historyItems]
  );

  const historySessions: ChatSession[] = useMemo(
    () =>
      historyItems
        .filter((item) => !activeSessionIds.has(item.id))
        .map((item) => ({
          id: item.id,
          title: item.title,
          cwd: item.cwd,
          model: DEFAULT_MODEL_ID,
          mode: DEFAULT_MODE_ID,
        })),
    [historyItems, activeSessionIds]
  );

  // Sessions are now passed separately to Sidebar for grouped display
  // activeSessions = current app sessions
  // historySessions = loaded from rollout files
  // allSessions is used for internal lookups (finding activeSession, etc.)
  const allSessions = useMemo(
    () => [...activeSessions, ...historySessions],
    [activeSessions, historySessions]
  );
  const setSelectedSessionId = useSessionStore((s) => s.setSelectedSessionId);
  const sessionMessagesMap = useSessionStore((s) => s.sessionMessages);
  const sessionDraftsMap = useSessionStore((s) => s.sessionDrafts);
  const sessionNoticesMap = useSessionStore((s) => s.sessionNotices);
  const isGeneratingMap = useSessionStore((s) => s.isGeneratingBySession);
  const setDraft = useSessionStore((s) => s.setDraft);

  // Derive values outside of selectors to avoid reference issues
  const activeSession = allSessions.find((sess) => sess.id === selectedSessionId);
  const messages = useMemo(
    () => sessionMessagesMap[selectedSessionId] ?? [],
    [selectedSessionId, sessionMessagesMap]
  );
  const draftMessage = sessionDraftsMap[selectedSessionId] ?? '';
  const sessionNotice = sessionNoticesMap[selectedSessionId] ?? null;
  const isGenerating = isGeneratingMap[selectedSessionId] ?? false;
  const terminalBySession = useSessionStore((s) => s.terminalBySession);
  const setTerminalBySession = useSessionStore((s) => s.setTerminalBySession);
  const setSessionNotices = useSessionStore((s) => s.setSessionNotices);
  const updateSession = useSessionStore((s) => s.updateSession);
  const createNewChat = useSessionStore((s) => s.createNewChat);
  const addSession = useSessionStore((s) => s.addSession);
  const setCodexThreadInfo = useSessionStore((s) => s.setCodexThreadInfo);
  const applyModelOptions = useSessionStore((s) => s.applyModelOptions);
  const contextRemainingMap = useSessionStore((s) => s.contextRemaining);

  // Derived state
  const selectedModel = activeSession?.model ?? DEFAULT_MODEL_ID;
  const selectedMode = activeSession?.mode ?? DEFAULT_MODE_ID;
  const selectedEffort = activeSession?.reasoningEffort;
  const selectedCwd = activeSession?.cwd;
  const cwdLocked = messages.length > 0;
  const activeTerminalId = terminalBySession[selectedSessionId];
  const contextRemainingPercent = contextRemainingMap[selectedSessionId] ?? null;

  // Model/Mode options
  const sessionModelOptionsMap = useSessionStore((s) => s.sessionModelOptions);
  const sessionModelOptions = sessionModelOptionsMap[selectedSessionId];
  const modelCache = useSessionStore((s) => s.modelCache);
  const modelOptions = sessionModelOptions?.length
    ? sessionModelOptions
    : (modelCache.options ?? []);

  const sessionModeOptionsMap = useSessionStore((s) => s.sessionModeOptions);
  const sessionModeOptions = sessionModeOptionsMap[selectedSessionId];
  const agentOptions = sessionModeOptions?.length ? sessionModeOptions : undefined;

  // Slash commands
  const sessionSlashCommandsMap = useSessionStore((s) => s.sessionSlashCommands);
  const sessionSlashCommands = useMemo(
    () => sessionSlashCommandsMap[selectedSessionId] ?? [],
    [selectedSessionId, sessionSlashCommandsMap]
  );
  const slashCommands = useMemo(() => {
    const merged = new Set([...DEFAULT_SLASH_COMMANDS, ...sessionSlashCommands]);
    return Array.from(merged).sort();
  }, [sessionSlashCommands]);

  // Current plan from messages
  const currentPlan = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const planSteps = messages[i].planSteps;
      if (planSteps && planSteps.length > 0) {
        const allCompleted = planSteps.every((step) => step.status === 'completed');
        if (allCompleted) return undefined;
        return planSteps;
      }
    }
    return undefined;
  }, [messages]);

  // Codex Store - queue and session mapping
  const messageQueuesMap = useCodexStore((s) => s.messageQueues);
  const registerCodexSession = useCodexStore((s) => s.registerCodexSession);
  const currentQueue = useMemo(
    () => messageQueuesMap[selectedSessionId] ?? [],
    [messageQueuesMap, selectedSessionId]
  );
  const hasQueuedMessages = currentQueue.length > 0;

  // Codex Actions
  const {
    handleModelChange,
    handleModeChange,
    handleSessionDelete,
    handleSendMessage,
    handleClearQueue,
    handleRemoveFromQueue,
    handleMoveToTopInQueue,
    handleEditInQueue,
    navigateToPreviousPrompt,
    navigateToNextPrompt,
    resetPromptNavigation,
  } = useCodexActions();

  // File and CWD Actions
  const { handleCwdSelect, handleSelectCwd, handleAddFile, handleFileSelect } =
    useFileAndCwdActionsFromStore();

  // Approval Cards
  const approvalCards = useApprovalCardsFromStore();

  // Session Actions
  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(selectedSessionId, value);
    },
    [selectedSessionId, setDraft]
  );

  const handleNewChat = useCallback(() => {
    createNewChat(selectedCwd, t('chat.newSessionTitle'));
  }, [createNewChat, selectedCwd, t]);

  const handleSessionSelect = useCallback(
    async (sessionId: string) => {
      // Check if this is a history session that needs to be restored
      const isHistorySession = !activeSessionIds.has(sessionId);
      const rolloutPath = historyRolloutPaths.get(sessionId);

      if (isHistorySession && rolloutPath) {
        // Find the history session info
        const historySession = historySessions.find((s) => s.id === sessionId);
        if (!historySession) {
          devDebug('[app] history session not found', sessionId);
          return;
        }

        try {
          devDebug('[app] restoring history session', sessionId, rolloutPath);

          // Add the session to active sessions FIRST (before resumeSession)
          addSession({
            id: sessionId,
            title: historySession.title,
            cwd: historySession.cwd,
            model: historySession.model,
            mode: historySession.mode,
          });

          // Pre-register the session mapping BEFORE calling resumeSession
          // The history item ID equals the codex session ID (both are the original thread ID)
          registerCodexSession(sessionId, sessionId);

          // Resume the session from rollout
          const result = await resumeSession(rolloutPath, historySession.cwd);

          // Update the mapping if the returned session ID is different
          if (result.sessionId !== sessionId) {
            registerCodexSession(sessionId, result.sessionId);
          }

          // Store thread info for future reference
          setCodexThreadInfo(sessionId, {
            threadId: result.sessionId,
            rolloutPath,
          });

          devDebug('[app] history session restored', sessionId, result.sessionId);
        } catch (err) {
          devDebug('[app] failed to restore history session', err);
          // Still select the session even if restore fails
        }
      }

      setSelectedSessionId(sessionId);
    },
    [
      activeSessionIds,
      historyRolloutPaths,
      historySessions,
      addSession,
      registerCodexSession,
      setCodexThreadInfo,
      setSelectedSessionId,
    ]
  );

  const handleSessionRename = useCallback(
    (sessionId: string, newTitle: string) => {
      updateSession(sessionId, { title: newTitle });
    },
    [updateSession]
  );

  const bodyRef = useRef<HTMLDivElement | null>(null);

  const handleSidePanelResize = usePanelResize({
    isOpen: sidePanelVisible,
    width: sidePanelWidth,
    setWidth: setSidePanelWidth,
    minWidth: MIN_SIDE_PANEL_WIDTH,
    minContentWidth: 240,
    getContainerWidth: () => {
      const mainWidth = bodyRef.current?.getBoundingClientRect().width ?? 0;
      if (!mainWidth) return 0;
      return mainWidth + sidePanelWidth;
    },
  });

  useTerminalLifecycle({
    terminalVisible: sidePanelVisible && activeSidePanelTab === 'terminal',
    selectedSessionId,
    activeTerminalId,
    selectedCwd,
    setTerminalBySession,
    setTerminalVisible: (visible) => {
      if (!visible && activeSidePanelTab === 'terminal') {
        setSidePanelVisible(false);
      }
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

  // Stop generation (placeholder)
  const handleStopGeneration = useCallback(() => {
    console.log('Stop generation requested');
  }, []);

  // Global shortcut actions
  const shortcutActions = useMemo(
    () => ({
      newSession: handleNewChat,
      sendMessage: () => {},
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
    enabled: !settingsOpen,
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

  // Convert queue to expected format
  const formattedQueue = useMemo(
    () =>
      currentQueue.map((msg) => ({
        id: msg.id,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      })),
    [currentQueue]
  );

  return (
    <>
      <ChatContainer
        sessions={activeSessions}
        historySessions={historySessions}
        selectedSessionId={selectedSessionId}
        sessionCwd={selectedCwd}
        sessionNotice={sessionNotice}
        messages={messages}
        approvals={approvalCards}
        sidebarVisible={sidebarVisible}
        isGenerating={isGenerating}
        currentPlan={currentPlan}
        messageQueue={formattedQueue}
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
        selectedEffort={selectedEffort}
        onModelChange={handleModelChange}
        slashCommands={slashCommands}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        onSendMessage={handleSendMessage}
        onAddClick={handleAddFile}
        onSideAction={handleSideAction}
        sidePanelVisible={sidePanelVisible}
        activeSidePanelTab={activeSidePanelTab}
        sidePanelWidth={sidePanelWidth}
        onSidePanelClose={handleSidePanelClose}
        onSidePanelResizeStart={handleSidePanelResize}
        onSidePanelTabChange={handleSidePanelTabChange}
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
        contextRemainingPercent={contextRemainingPercent}
      />
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={settingsOpen}
            onClose={closeSettings}
            initialSection={settingsInitialSection}
            availableModels={modelOptions}
            onModelOptionsResolved={handleModelOptionsFetched}
          />
        </Suspense>
      )}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
