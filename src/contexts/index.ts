export { UIProvider, useUIContext } from './UIContext';
export type { UIContextValue } from './UIContext';
export {
  SIDEBAR_AUTO_HIDE_MAX_WIDTH,
  DEFAULT_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  MIN_CONVERSATION_WIDTH,
} from './UIContext';

export { SessionProvider, useSessionContext } from './SessionContext';
export type { SessionContextValue } from './SessionContext';

export { CodexProvider, useCodexContext } from './CodexContext';
export type { CodexContextValue } from './CodexContext';

// Selective context access hooks
export {
  // UI selectors
  useSidebarVisible,
  useSidePanelVisible,
  useSidePanelControls,
  useSettingsModal,
  // Session selectors
  useSelectedSessionId,
  useCurrentMessages,
  useCurrentDraft,
  useCurrentModelAndMode,
  useIsGenerating,
  useCurrentCwd,
  useSessionList,
  // Codex selectors
  useMessageQueue,
  usePromptNavigation,
  useApprovalCards,
  useModelModeHandlers,
} from './selectors';
