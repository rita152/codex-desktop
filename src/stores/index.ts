/**
 * Zustand Stores - Centralized State Management
 *
 * This module exports all Zustand stores, selectors, and types.
 * Prefer using fine-grained selectors over full store subscriptions.
 *
 * @example
 * // Good: Use fine-grained selectors
 * const messages = useCurrentMessages();
 * const isGenerating = useIsGenerating();
 *
 * // Avoid: Full store subscription (causes unnecessary re-renders)
 * const store = useSessionStore();
 */

// =============================================================================
// UI Store
// =============================================================================
export {
  useUIStore,
  // Fine-grained selectors
  useSidebarVisible,
  useIsNarrowLayout,
  useSidePanelVisible,
  useActiveSidePanelTab,
  useSidePanelWidth,
  useSettingsOpen,
  // Grouped selectors
  useSidebarState,
  useSidePanelState,
  useSettingsModalState,
  // Constants
  SIDEBAR_AUTO_HIDE_MAX_WIDTH,
  DEFAULT_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  MIN_CONVERSATION_WIDTH,
} from './uiStore';
export type { UIStore } from './uiStore';

// UI Store Init Hook
export { useUIStoreInit } from './useUIStoreInit';

// =============================================================================
// Session Store
// =============================================================================
export {
  useSessionStore,
  // Fine-grained selectors
  useActiveSession,
  useCurrentMessages,
  useCurrentDraft,
  useIsGenerating,
  useSelectedModel,
  useSelectedMode,
  useSelectedCwd,
  useSessionNotice,
  useModelOptions,
  useAgentOptions,
  useSlashCommands,
  useCwdLocked,
  useActiveTerminalId,
  useCurrentPlan,
  // Grouped selector (compatibility layer)
  useSessionViewState,
} from './sessionStore';
export type { SessionStore, SessionNotice, OptionsCache } from './sessionStore';

// Session Store Sync Hook - REMOVED (migration complete)

// =============================================================================
// Codex Store
// =============================================================================
export {
  useCodexStore,
  // Fine-grained selectors
  usePendingApprovals,
  useMessageQueueForSession,
  useHasQueuedMessages,
  usePromptHistory,
  useCodexSessionId,
  useIsPendingSessionInit,
} from './codexStore';
export type { CodexStore, QueuedMessage } from './codexStore';

// =============================================================================
// Settings Store
// =============================================================================
export {
  useSettingsStore,
  // Fine-grained selectors
  useShortcuts,
  useTheme,
  useSettingsLoading,
  useSettingsError,
} from './settingsStore';
export type { SettingsStore } from './settingsStore';
