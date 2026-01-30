/**
 * Codex Effects Hook
 *
 * Handles side effects related to Codex backend:
 * - Initialize Codex on mount
 *
 * This hook is designed to be called once at the app root level.
 * Complex event handling is still managed by useCodexEvents (used within CodexContext).
 */

import { useEffect } from 'react';

import { initCodex } from '../api/codex';
import { devDebug } from '../utils/logger';

/**
 * Initialize Codex effects.
 * Call this once at the app root level (in App component).
 */
export function useCodexEffects(): void {
  // Initialize Codex on mount
  useEffect(() => {
    void initCodex().catch((err) => {
      devDebug('[codex] init failed', err);
    });
  }, []);
}
