/**
 * Session Effects Hook
 *
 * Handles side effects that need to run based on SessionStore changes:
 * - Auto-select available model when current is unavailable
 * - Auto-select available mode when current is unavailable
 *
 * This hook subscribes to store changes and executes effects accordingly.
 * Call this once at the app root level (in App component).
 */

import { useEffect } from 'react';

import { useSessionStore } from '../stores/sessionStore';
import { resolveOptionId } from '../utils/optionSelection';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';

/**
 * Initialize session effects.
 * Handles auto-selection of model/mode when current selection becomes unavailable.
 */
export function useSessionEffects(): void {
  // Auto-select available model when current is unavailable
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe(
      (state) => ({
        selectedSessionId: state.selectedSessionId,
        sessions: state.sessions,
        sessionModelOptions: state.sessionModelOptions,
        modelCache: state.modelCache,
      }),
      (current) => {
        const { selectedSessionId, sessions, sessionModelOptions, modelCache } = current;
        const session = sessions.find((s) => s.id === selectedSessionId);
        if (!session) return;

        const selectedModel = session.model ?? DEFAULT_MODEL_ID;
        const modelOptions =
          sessionModelOptions[selectedSessionId]?.length > 0
            ? sessionModelOptions[selectedSessionId]
            : (modelCache.options ?? []);

        if (!modelOptions || modelOptions.length === 0) return;

        const available = new Set(modelOptions.map((option) => option.value));
        if (available.has(selectedModel)) return;

        const preferred = resolveOptionId({
          availableOptions: modelOptions,
          fallbackIds: [DEFAULT_MODEL_ID, modelCache.currentId],
          defaultId: DEFAULT_MODEL_ID,
        });

        if (!preferred || preferred === selectedModel) return;

        useSessionStore.getState().updateSession(selectedSessionId, { model: preferred });
      },
      { equalityFn: shallow }
    );

    return unsubscribe;
  }, []);

  // Auto-select available mode when current is unavailable
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe(
      (state) => ({
        selectedSessionId: state.selectedSessionId,
        sessions: state.sessions,
        sessionModeOptions: state.sessionModeOptions,
      }),
      (current) => {
        const { selectedSessionId, sessions, sessionModeOptions } = current;
        const session = sessions.find((s) => s.id === selectedSessionId);
        if (!session) return;

        const selectedMode = session.mode ?? DEFAULT_MODE_ID;
        const agentOptions = sessionModeOptions[selectedSessionId];

        if (!agentOptions || agentOptions.length === 0) return;

        const available = new Set(agentOptions.map((option) => option.value));
        if (available.has(selectedMode)) return;

        const preferred = resolveOptionId({
          availableOptions: agentOptions,
          fallbackIds: [DEFAULT_MODE_ID],
          defaultId: DEFAULT_MODE_ID,
        });

        if (!preferred || preferred === selectedMode) return;

        useSessionStore.getState().updateSession(selectedSessionId, { mode: preferred });
      },
      { equalityFn: shallow }
    );

    return unsubscribe;
  }, []);
}

// Shallow equality for subscription selector
function shallow<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b) as (keyof T)[];
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
