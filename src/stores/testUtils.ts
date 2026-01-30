/**
 * Test utilities for Zustand stores
 *
 * Provides helpers for resetting store state between tests
 * and creating mock stores for isolated testing.
 */

import { useUIStore } from './uiStore';
import { useSessionStore } from './sessionStore';
import { useCodexStore } from './codexStore';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';

/**
 * Reset all stores to their initial state
 * Call this in beforeEach() to ensure test isolation
 */
export function resetAllStores(): void {
  // Clear localStorage to prevent persist middleware from restoring state
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  resetUIStore();
  resetSessionStore();
  resetCodexStore();
  resetSettingsStore();
}

/**
 * Reset UI Store to initial state
 */
export function resetUIStore(): void {
  useUIStore.setState({
    sidebarVisible: true,
    isNarrowLayout: false,
    sidePanelVisible: false,
    activeSidePanelTab: 'explorer',
    sidePanelWidth: 260,
    settingsOpen: false,
  });
}

/**
 * Reset Session Store to initial state
 */
export function resetSessionStore(): void {
  // Clear persist storage
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('codex-sessions');
  }
  const initialSessionId = String(Date.now());
  useSessionStore.setState({
    sessions: [
      {
        id: initialSessionId,
        title: 'New Chat',
        model: DEFAULT_MODEL_ID,
        mode: DEFAULT_MODE_ID,
      },
    ],
    selectedSessionId: initialSessionId,
    sessionMessages: { [initialSessionId]: [] },
    sessionDrafts: { [initialSessionId]: '' },
    sessionNotices: {},
    sessionSlashCommands: {},
    sessionModelOptions: {},
    sessionModeOptions: {},
    modelCache: { options: null, currentId: DEFAULT_MODEL_ID },
    modeCache: { options: null, currentId: DEFAULT_MODE_ID },
    isGeneratingBySession: { [initialSessionId]: false },
    terminalBySession: {},
  });
}

/**
 * Reset Codex Store to initial state
 */
export function resetCodexStore(): void {
  useCodexStore.setState({
    pendingApprovals: {},
    approvalStatuses: {},
    approvalLoading: {},
    messageQueues: {},
    promptHistory: [],
    historyIndex: -1,
    tempDraft: null,
  });
}

/**
 * Reset Settings Store to initial state
 */
export function resetSettingsStore(): void {
  useSettingsStore.setState({
    settings: {
      general: {
        theme: 'system',
        language: 'en-US',
      },
      model: {
        defaultModel: DEFAULT_MODEL_ID,
        apiProvider: 'openai',
        apiBaseUrl: '',
        apiKey: '',
      },
      shortcuts: {
        newSession: 'CmdOrCtrl+N',
        sendMessage: 'Enter',
        stopGeneration: 'Escape',
        openSettings: 'CmdOrCtrl+,',
        toggleSidebar: 'CmdOrCtrl+B',
        toggleTerminal: 'CmdOrCtrl+`',
      },
      version: 1,
    },
    loading: false,
    error: null,
    saveStatus: 'idle',
  });
}

/**
 * Create a test session with optional overrides
 */
export function createTestSession(
  overrides: Partial<{
    id: string;
    title: string;
    cwd: string;
    model: string;
    mode: string;
  }> = {}
): {
  id: string;
  title: string;
  cwd?: string;
  model: string;
  mode: string;
} {
  return {
    id: overrides.id ?? String(Date.now()),
    title: overrides.title ?? 'Test Session',
    cwd: overrides.cwd,
    model: overrides.model ?? DEFAULT_MODEL_ID,
    mode: overrides.mode ?? DEFAULT_MODE_ID,
  };
}

/**
 * Create a test message
 */
export function createTestMessage(
  overrides: Partial<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming: boolean;
  }> = {}
): {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
} {
  return {
    id: overrides.id ?? String(Date.now()),
    role: overrides.role ?? 'user',
    content: overrides.content ?? 'Test message',
    timestamp: overrides.timestamp ?? new Date(),
    isStreaming: overrides.isStreaming,
  };
}
