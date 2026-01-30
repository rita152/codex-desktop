/**
 * Codex Effects Hook
 *
 * Handles all Codex-related side effects:
 * - Initialize Codex on mount
 * - Warmup codex-acp connection for faster first response
 * - Set up Tauri event listeners (via useCodexEvents)
 * - Provide ensureCodexSession for session management
 *
 * This hook consolidates useCodexSessionSync logic and should be called once at app root.
 *
 * @migration Replaces CodexContext + useCodexSessionSync with Store-based approach
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { initCodex, createSession, setSessionMode, setSessionModel, warmupCodex } from '../api/codex';
import { devDebug } from '../utils/logger';
import { formatError, resolveModelOptions, resolveModeOptions } from '../utils/codexParsing';
import { resolveOptionId, shouldSyncOption } from '../utils/optionSelection';
import { useCodexEvents } from './useCodexEvents';
import { setGlobalEnsureCodexSession } from './useCodexActions';
import { useSessionStore } from '../stores/sessionStore';
import { useCodexStore } from '../stores/codexStore';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';

// Warmup delay after initialization (avoid blocking first render)
const WARMUP_DELAY_MS = 500;

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

  // Warmup session info (can be reused by first ensureCodexSession call)
  const warmupResultRef = useRef<{
    sessionId: string;
    modeOptions?: { value: string; label: string }[];
    modelOptions?: { value: string; label: string }[];
    currentModeId?: string;
    currentModelId?: string;
  } | null>(null);

  // Initialize Codex on mount and warmup connection
  useEffect(() => {
    let warmupTimer: ReturnType<typeof setTimeout> | undefined;
    let isMounted = true;

    const initAndWarmup = async () => {
      try {
        // 1. Initialize Codex backend
        await initCodex();
        devDebug('[codex] initialized');

        if (!isMounted) return;

        // 2. Warmup connection after delay (avoid blocking first render)
        warmupTimer = setTimeout(async () => {
          if (!isMounted) return;

          try {
            // First, warmup the ACP connection (spawn process, initialize protocol)
            await warmupCodex();
            devDebug('[codex] connection warmed up');

            if (!isMounted) return;

            // Then create a warmup session to pre-fetch mode/model options
            const result = await createSession('.');
            devDebug('[codex] warmup session created', result.sessionId);

            if (!isMounted) return;

            // Store warmup result for reuse
            const modeState = resolveModeOptions(result.modes, result.configOptions);
            const modelState = resolveModelOptions(result.models, result.configOptions);

            warmupResultRef.current = {
              sessionId: result.sessionId,
              modeOptions: modeState?.options,
              modelOptions: modelState?.options,
              currentModeId: modeState?.currentModeId,
              currentModelId: modelState?.currentModelId,
            };

            // Apply mode/model options globally
            const sessionStore = useSessionStore.getState();
            if (modeState?.options && modeState.options.length > 0) {
              sessionStore.applyModeOptions({
                options: modeState.options,
                currentId: modeState.currentModeId,
                fallbackCurrentId: DEFAULT_MODE_ID,
              });
            }
            if (modelState?.options && modelState.options.length > 0) {
              sessionStore.applyModelOptions({
                options: modelState.options,
                currentId: modelState.currentModelId,
                fallbackCurrentId: DEFAULT_MODEL_ID,
              });
            }

            devDebug('[codex] warmup complete, options applied');
          } catch (err) {
            // Warmup failure is non-fatal, log and continue
            devDebug('[codex] warmup failed (non-fatal)', err);
          }
        }, WARMUP_DELAY_MS);
      } catch (err) {
        devDebug('[codex] init failed', err);
      }
    };

    void initAndWarmup();

    return () => {
      isMounted = false;
      if (warmupTimer) {
        clearTimeout(warmupTimer);
      }
    };
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
   * Will reuse warmup session if available and cwd matches.
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

        // Try to reuse warmup session if cwd is '.' (default)
        const warmupResult = warmupResultRef.current;
        if (warmupResult && cwd === '.') {
          // Consume warmup session (one-time use)
          warmupResultRef.current = null;
          devDebug('[codex] reusing warmup session', warmupResult.sessionId);

          codexStore.registerCodexSession(chatSessionId, warmupResult.sessionId);

          // Apply cached options
          if (warmupResult.modeOptions && warmupResult.modeOptions.length > 0) {
            sessionStore.setSessionModeOptions((prev) => {
              const next = { ...prev };
              for (const session of sessions) {
                next[session.id] = warmupResult.modeOptions!;
              }
              next[chatSessionId] = warmupResult.modeOptions!;
              return next;
            });
          }
          if (warmupResult.modelOptions && warmupResult.modelOptions.length > 0) {
            sessionStore.setSessionModelOptions((prev) => {
              const next = { ...prev };
              for (const session of sessions) {
                next[session.id] = warmupResult.modelOptions!;
              }
              next[chatSessionId] = warmupResult.modelOptions!;
              return next;
            });
          }

          // Resolve and sync mode/model
          const desiredMode = resolveOptionId({
            preferredId: sessionMeta?.mode,
            availableOptions: warmupResult.modeOptions,
            fallbackIds: [warmupResult.currentModeId, warmupResult.modeOptions?.[0]?.value],
            defaultId: DEFAULT_MODE_ID,
          });
          const desiredModel = resolveOptionId({
            preferredId: sessionMeta?.model,
            availableOptions: warmupResult.modelOptions,
            fallbackIds: [warmupResult.currentModelId, warmupResult.modelOptions?.[0]?.value],
            defaultId: DEFAULT_MODEL_ID,
          });

          if (desiredMode && desiredMode !== sessionMeta?.mode) {
            sessionStore.updateSession(chatSessionId, { mode: desiredMode });
          }
          if (desiredModel && desiredModel !== sessionMeta?.model) {
            sessionStore.updateSession(chatSessionId, { model: desiredModel });
          }

          // Sync to backend if needed
          const syncTasks: Promise<void>[] = [];
          const shouldSyncMode = shouldSyncOption({
            desiredId: desiredMode,
            currentId: warmupResult.currentModeId,
            availableOptions: warmupResult.modeOptions,
          });
          const shouldSyncModel = shouldSyncOption({
            desiredId: desiredModel,
            currentId: warmupResult.currentModelId,
            availableOptions: warmupResult.modelOptions,
          });

          if (shouldSyncMode && desiredMode) {
            syncTasks.push(
              setSessionMode(warmupResult.sessionId, desiredMode).catch((err) => {
                sessionStore.setNotice(chatSessionId, {
                  kind: 'error',
                  message: t('errors.modeSetFailed', { error: formatError(err) }),
                });
              })
            );
          }
          if (shouldSyncModel && desiredModel) {
            syncTasks.push(
              setSessionModel(warmupResult.sessionId, desiredModel).catch((err) => {
                sessionStore.setNotice(chatSessionId, {
                  kind: 'error',
                  message: t('errors.modelSetFailed', { error: formatError(err) }),
                });
              })
            );
          }
          if (syncTasks.length > 0) {
            await Promise.all(syncTasks);
          }

          return warmupResult.sessionId;
        }

        // No warmup session available or cwd doesn't match - create new session
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

  // Note: Auto-initialization is now handled by warmup in the init effect above.
  // The warmup creates a session and pre-fetches mode/model options, which will
  // be reused by the first ensureCodexSession call.
}
