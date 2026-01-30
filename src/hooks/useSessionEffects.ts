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

import { useEffect, useRef } from 'react';

import { useSessionStore } from '../stores/sessionStore';
import { resolveOptionId } from '../utils/optionSelection';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';

/**
 * Initialize session effects.
 * Handles auto-selection of model/mode when current selection becomes unavailable.
 */
export function useSessionEffects(): void {
  // Track previous values to avoid unnecessary updates
  const prevModelRef = useRef<string | null>(null);
  const prevModeRef = useRef<string | null>(null);
  const isUpdatingRef = useRef(false);

  // Auto-select available model when current is unavailable
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state) => {
      // Prevent re-entrancy
      if (isUpdatingRef.current) return;

      const { selectedSessionId, sessions, sessionModelOptions, modelCache } = state;
      const session = sessions.find((s) => s.id === selectedSessionId);
      if (!session) return;

      const selectedModel = session.model ?? DEFAULT_MODEL_ID;

      // Skip if model hasn't changed and we've already checked
      if (prevModelRef.current === selectedModel) return;
      prevModelRef.current = selectedModel;

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

      // Update with guard
      isUpdatingRef.current = true;
      prevModelRef.current = preferred;
      useSessionStore.getState().updateSession(selectedSessionId, { model: preferred });
      isUpdatingRef.current = false;
    });

    return unsubscribe;
  }, []);

  // Auto-select available mode when current is unavailable
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state) => {
      // Prevent re-entrancy
      if (isUpdatingRef.current) return;

      const { selectedSessionId, sessions, sessionModeOptions } = state;
      const session = sessions.find((s) => s.id === selectedSessionId);
      if (!session) return;

      const selectedMode = session.mode ?? DEFAULT_MODE_ID;

      // Skip if mode hasn't changed and we've already checked
      if (prevModeRef.current === selectedMode) return;
      prevModeRef.current = selectedMode;

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

      // Update with guard
      isUpdatingRef.current = true;
      prevModeRef.current = preferred;
      useSessionStore.getState().updateSession(selectedSessionId, { mode: preferred });
      isUpdatingRef.current = false;
    });

    return unsubscribe;
  }, []);
}
