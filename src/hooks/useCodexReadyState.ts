/**
 * Codex Ready State Hook
 *
 * Provides a simple state indicator for Codex initialization status.
 * Used to show loading indicators and disable inputs during warmup.
 */

import { useSessionStore } from '../stores/sessionStore';
import { useCodexStore } from '../stores/codexStore';

/**
 * Codex ready state enumeration.
 * - 'initializing': Codex backend is starting up
 * - 'warming': Connection is warming up, options being fetched
 * - 'ready': Codex is ready for use
 */
export type CodexReadyState = 'initializing' | 'warming' | 'ready';

/**
 * Hook to track Codex initialization state.
 *
 * @returns Current ready state
 */
export function useCodexReadyState(): CodexReadyState {
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const modelOptions = useSessionStore((s) => s.modelCache.options);
  const hasCodexSession = useCodexStore(
    (s) => !!s.codexSessionByChat[selectedSessionId]
  );

  // If we have a codex session for current chat, we're ready
  if (hasCodexSession) {
    return 'ready';
  }

  // If we have model options (from warmup), we're warming/ready
  if (modelOptions && modelOptions.length > 0) {
    return 'warming';
  }

  // Otherwise still initializing
  return 'initializing';
}

/**
 * Check if Codex is ready for user interaction.
 *
 * @returns true if Codex is ready or warming (can accept input)
 */
export function useIsCodexReady(): boolean {
  const state = useCodexReadyState();
  // Allow input during 'warming' state since warmup session will be reused
  return state === 'ready' || state === 'warming';
}
