/**
 * Context Selectors
 *
 * These hooks provide selective access to context values,
 * helping components subscribe only to the state they need.
 * This can reduce unnecessary re-renders when used appropriately.
 *
 * Note: React contexts re-render all consumers when the context value changes.
 * These selectors provide a cleaner API but don't prevent re-renders by themselves.
 * For true selective subscriptions, consider using external state management like Zustand.
 */

import { useUIContext } from './UIContext';
import { useSessionContext } from './SessionContext';
import { useCodexContext } from './CodexContext';

// ============================================================================
// UI Context Selectors
// ============================================================================

/** Get sidebar visibility state */
export function useSidebarVisible(): boolean {
  return useUIContext().sidebarVisible;
}

/** Get side panel visibility state */
export function useSidePanelVisible(): boolean {
  return useUIContext().sidePanelVisible;
}

/** Get side panel controls */
export function useSidePanelControls() {
  const {
    sidePanelVisible,
    setSidePanelVisible,
    activeSidePanelTab,
    setActiveSidePanelTab,
    sidePanelWidth,
    setSidePanelWidth,
    handleSidePanelClose,
    handleSidePanelTabChange,
  } = useUIContext();

  return {
    visible: sidePanelVisible,
    setVisible: setSidePanelVisible,
    activeTab: activeSidePanelTab,
    setActiveTab: setActiveSidePanelTab,
    width: sidePanelWidth,
    setWidth: setSidePanelWidth,
    close: handleSidePanelClose,
    changeTab: handleSidePanelTabChange,
  };
}

/** Get settings modal controls */
export function useSettingsModal() {
  const { settingsOpen, openSettings, closeSettings } = useUIContext();
  return { isOpen: settingsOpen, open: openSettings, close: closeSettings };
}

// ============================================================================
// Session Context Selectors
// ============================================================================

/** Get current session ID */
export function useSelectedSessionId(): string {
  return useSessionContext().selectedSessionId;
}

/** Get current session's messages */
export function useCurrentMessages() {
  return useSessionContext().messages;
}

/** Get current session's draft */
export function useCurrentDraft() {
  const { draftMessage, handleDraftChange } = useSessionContext();
  return { draft: draftMessage, setDraft: handleDraftChange };
}

/** Get current session's model and mode */
export function useCurrentModelAndMode() {
  const { selectedModel, selectedMode, modelOptions, agentOptions } = useSessionContext();
  return { model: selectedModel, mode: selectedMode, modelOptions, agentOptions };
}

/** Get generation state */
export function useIsGenerating(): boolean {
  return useSessionContext().isGenerating;
}

/** Get current working directory */
export function useCurrentCwd() {
  const { selectedCwd, cwdLocked, handleCwdSelect, handleSelectCwd } = useSessionContext();
  return {
    cwd: selectedCwd,
    locked: cwdLocked,
    setCwd: handleCwdSelect,
    pickCwd: handleSelectCwd,
  };
}

/** Get session list and actions */
export function useSessionList() {
  const {
    sessions,
    selectedSessionId,
    handleSessionSelect,
    handleNewChat,
    handleSessionRename,
  } = useSessionContext();

  return {
    sessions,
    selectedId: selectedSessionId,
    select: handleSessionSelect,
    createNew: handleNewChat,
    rename: handleSessionRename,
  };
}

// ============================================================================
// Codex Context Selectors
// ============================================================================

/** Get message queue state */
export function useMessageQueue() {
  const {
    currentQueue,
    hasQueuedMessages,
    handleSendMessage,
    handleClearQueue,
    handleRemoveFromQueue,
    handleMoveToTopInQueue,
    handleEditInQueue,
  } = useCodexContext();

  return {
    queue: currentQueue,
    hasQueued: hasQueuedMessages,
    send: handleSendMessage,
    clear: handleClearQueue,
    remove: handleRemoveFromQueue,
    moveToTop: handleMoveToTopInQueue,
    edit: handleEditInQueue,
  };
}

/** Get prompt history navigation */
export function usePromptNavigation() {
  const { navigateToPreviousPrompt, navigateToNextPrompt, resetPromptNavigation } =
    useCodexContext();

  return {
    previous: navigateToPreviousPrompt,
    next: navigateToNextPrompt,
    reset: resetPromptNavigation,
  };
}

/** Get approval cards */
export function useApprovalCards() {
  return useCodexContext().approvalCards;
}

/** Get model/mode change handlers */
export function useModelModeHandlers() {
  const { handleModelChange, handleModeChange } = useCodexContext();
  return { changeModel: handleModelChange, changeMode: handleModeChange };
}
