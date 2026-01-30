/**
 * Codex Effects Hook
 *
 * Handles all Codex-related side effects:
 * - Initialize Codex on mount
 * - Set up Tauri event listeners (via useCodexEvents)
 * - Provide ensureCodexSession for session management
 *
 * This hook consolidates useCodexSessionSync logic and should be called once at app root.
 *
 * @migration Replaces CodexContext + useCodexSessionSync with Store-based approach
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { initCodex, createSession, setSessionMode, setSessionModel } from '../api/codex';
import { devDebug } from '../utils/logger';
import { formatError, resolveModelOptions, resolveModeOptions } from '../utils/codexParsing';
import { resolveOptionId, shouldSyncOption } from '../utils/optionSelection';
import { useCodexEvents } from './useCodexEvents';
import { setGlobalEnsureCodexSession } from './useCodexActions';
import { useSessionStore } from '../stores/sessionStore';
import { useCodexStore } from '../stores/codexStore';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';

/**
 * Initialize Codex effects.
 * Call this once at the app root level (in App component).
 *
 * Sets up:
 * - Codex initialization
 * - Tauri event listeners
 * - Session management (ensureCodexSession)
 */
export function useCodexEffects(): void {
  const { t } = useTranslation();

  // Pending session init promises (to avoid duplicate init)
  const pendingSessionInitRef = useRef<Record<string, Promise<string>>>({});

  // Initialize Codex on mount
  useEffect(() => {
    void initCodex().catch((err) => {
      devDebug('[codex] init failed', err);
    });
  }, []);

  // Callbacks for mode/model options resolution
  const handleModeOptionsResolved = useCallback(
    (modeState: { options: { value: string; label: string }[]; currentModeId?: string }) => {
      useSessionStore.getState().applyModeOptions({
        options: modeState.options,
        currentId: modeState.currentModeId,
        fallbackCurrentId: DEFAULT_MODE_ID,
      });
    },
    []
  );

  const handleModelOptionsResolved = useCallback(
    (modelState: { options: { value: string; label: string }[]; currentModelId?: string }) => {
      useSessionStore.getState().applyModelOptions({
        options: modelState.options,
        currentId: modelState.currentModelId,
        fallbackCurrentId: DEFAULT_MODEL_ID,
      });
    },
    []
  );

  // Set up Tauri event listeners
  useCodexEvents({
    onModeOptionsResolved: handleModeOptionsResolved,
    onModelOptionsResolved: handleModelOptionsResolved,
  });

  /**
   * Ensure a Codex session exists for a chat session.
   * Creates one if it doesn't exist, syncs mode/model options.
   *
   * @param chatSessionId - The chat session ID
   * @returns The Codex session ID
   */
  const ensureCodexSession = useCallback(
    async (chatSessionId: string): Promise<string> => {
      const codexStore = useCodexStore.getState();
      const sessionStore = useSessionStore.getState();

      // Check if session already exists
      const existing = codexStore.getCodexSessionId(chatSessionId);
      if (existing) return existing;

      // Check if init is already pending
      const pending = pendingSessionInitRef.current[chatSessionId];
      if (pending) return pending;

      // Create new session
      const task = (async () => {
        const sessions = sessionStore.sessions;
        const sessionMeta = sessions.find((session) => session.id === chatSessionId);
        const cwd =
          typeof sessionMeta?.cwd === 'string' && sessionMeta.cwd.trim() !== ''
            ? sessionMeta.cwd
            : '.';

        const result = await createSession(cwd);
        codexStore.registerCodexSession(chatSessionId, result.sessionId);

        // Resolve and apply mode options
        const modeState = resolveModeOptions(result.modes, result.configOptions);
        if (modeState?.options && modeState.options.length > 0) {
          sessionStore.setSessionModeOptions((prev) => {
            const next = { ...prev };
            for (const session of sessions) {
              next[session.id] = modeState.options;
            }
            next[chatSessionId] = modeState.options;
            return next;
          });
          sessionStore.applyModeOptions({
            options: modeState.options,
            currentId: modeState.currentModeId,
            fallbackCurrentId: DEFAULT_MODE_ID,
          });
        }

        // Resolve and apply model options
        const modelState = resolveModelOptions(result.models, result.configOptions);
        if (modelState?.options && modelState.options.length > 0) {
          sessionStore.setSessionModelOptions((prev) => {
            const next = { ...prev };
            for (const session of sessions) {
              next[session.id] = modelState.options;
            }
            next[chatSessionId] = modelState.options;
            return next;
          });
          sessionStore.applyModelOptions({
            options: modelState.options,
            currentId: modelState.currentModelId,
          });
        }

        // Resolve desired mode
        const desiredMode = resolveOptionId({
          preferredId: sessionMeta?.mode,
          availableOptions: modeState?.options,
          fallbackIds: [modeState?.currentModeId, modeState?.options?.[0]?.value],
          defaultId: DEFAULT_MODE_ID,
        });

        if (desiredMode && desiredMode !== sessionMeta?.mode) {
          sessionStore.updateSession(chatSessionId, { mode: desiredMode });
        }

        const shouldSyncMode = shouldSyncOption({
          desiredId: desiredMode,
          currentId: modeState?.currentModeId,
          availableOptions: modeState?.options,
        });

        // Resolve desired model
        const desiredModel = resolveOptionId({
          preferredId: sessionMeta?.model,
          availableOptions: modelState?.options,
          fallbackIds: [modelState?.currentModelId, modelState?.options?.[0]?.value],
          defaultId: DEFAULT_MODEL_ID,
        });

        if (desiredModel && desiredModel !== sessionMeta?.model) {
          sessionStore.updateSession(chatSessionId, { model: desiredModel });
        }

        const shouldSyncModel = shouldSyncOption({
          desiredId: desiredModel,
          currentId: modelState?.currentModelId,
          availableOptions: modelState?.options,
        });

        // Sync mode/model to backend
        const syncTasks: Promise<void>[] = [];
        if (shouldSyncMode && desiredMode) {
          syncTasks.push(
            setSessionMode(result.sessionId, desiredMode)
              .then(() => {
                sessionStore.clearSessionNotice(chatSessionId);
              })
              .catch((err) => {
                const fallbackMode =
                  modeState?.currentModeId ?? modeState?.options?.[0]?.value ?? DEFAULT_MODE_ID;
                sessionStore.setNotice(chatSessionId, {
                  kind: 'error',
                  message: t('errors.modeSetFailed', { error: formatError(err) }),
                });
                sessionStore.updateSession(chatSessionId, { mode: fallbackMode });
              })
          );
        }
        if (shouldSyncModel && desiredModel) {
          syncTasks.push(
            setSessionModel(result.sessionId, desiredModel)
              .then(() => {
                sessionStore.clearSessionNotice(chatSessionId);
              })
              .catch((err) => {
                const fallbackModel =
                  modelState?.currentModelId ?? modelState?.options?.[0]?.value ?? DEFAULT_MODEL_ID;
                sessionStore.setNotice(chatSessionId, {
                  kind: 'error',
                  message: t('errors.modelSetFailed', { error: formatError(err) }),
                });
                sessionStore.updateSession(chatSessionId, { model: fallbackModel });
              })
          );
        }
        if (syncTasks.length > 0) {
          await Promise.all(syncTasks);
        }

        return result.sessionId;
      })();

      pendingSessionInitRef.current[chatSessionId] = task;
      try {
        return await task;
      } finally {
        delete pendingSessionInitRef.current[chatSessionId];
      }
    },
    [t]
  );

  // Store ensureCodexSession globally for useCodexActions
  useEffect(() => {
    setGlobalEnsureCodexSession(ensureCodexSession);
    return () => {
      setGlobalEnsureCodexSession(null);
    };
  }, [ensureCodexSession]);
}
