import { useCallback, useRef } from 'react';
import type { TFunction } from 'i18next';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { createSession, setSessionMode, setSessionModel } from '../api/codex';
import { useCodexEvents } from './useCodexEvents';
import { formatError, resolveModelOptions, resolveModeOptions } from '../utils/codexParsing';
import { resolveOptionId, shouldSyncOption } from '../utils/optionSelection';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { SelectOption } from '../components/ui/data-entry/Select/types';
import type { ApprovalRequest } from '../types/codex';
import type { Message } from '../components/business/ChatMessageList/types';
import type { SessionNotice } from './useSessionMeta';

type SessionMessages = Record<string, Message[]>;

type OptionsPayload = {
  options: SelectOption[];
  currentId?: string;
  fallbackCurrentId?: string;
};

type UseCodexSessionSyncArgs = {
  sessions: ChatSession[];
  activeSessionIdRef: MutableRefObject<string>;
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setSessionMessages: Dispatch<SetStateAction<SessionMessages>>;
  setIsGeneratingBySession: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessionSlashCommands: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSessionModeOptions: Dispatch<SetStateAction<Record<string, SelectOption[]>>>;
  setSessionModelOptions: Dispatch<SetStateAction<Record<string, SelectOption[]>>>;
  setSessionNotices: Dispatch<SetStateAction<Record<string, SessionNotice>>>;
  clearSessionNotice: (sessionId: string) => void;
  applyModeOptions: (payload: OptionsPayload) => void;
  applyModelOptions: (payload: OptionsPayload) => void;
  registerApprovalRequest: (request: ApprovalRequest) => void;
  defaultModeId: string;
  defaultModelId: string;
  t: TFunction;
};

export function useCodexSessionSync({
  sessions,
  activeSessionIdRef,
  setSessions,
  setSessionMessages,
  setIsGeneratingBySession,
  setSessionSlashCommands,
  setSessionModeOptions,
  setSessionModelOptions,
  setSessionNotices,
  clearSessionNotice,
  applyModeOptions,
  applyModelOptions,
  registerApprovalRequest,
  defaultModeId,
  defaultModelId,
  t,
}: UseCodexSessionSyncArgs) {
  const codexSessionByChatRef = useRef<Record<string, string>>({});
  const chatSessionByCodexRef = useRef<Record<string, string>>({});
  const pendingSessionInitRef = useRef<Record<string, Promise<string>>>({});

  const resolveChatSessionId = useCallback((codexSessionId?: string): string | null => {
    if (!codexSessionId) return null;
    return chatSessionByCodexRef.current[codexSessionId] ?? null;
  }, []);

  const updateSessionMode = useCallback(
    (sessionId: string, modeId: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId && session.mode !== modeId
            ? { ...session, mode: modeId }
            : session
        )
      );
    },
    [setSessions]
  );

  const updateSessionModel = useCallback(
    (sessionId: string, modelId: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId && session.model !== modelId
            ? { ...session, model: modelId }
            : session
        )
      );
    },
    [setSessions]
  );

  useCodexEvents({
    resolveChatSessionId,
    activeSessionIdRef,
    setSessionMessages,
    setIsGeneratingBySession,
    setSessionSlashCommands,
    setSessionModeOptions,
    setSessionModelOptions,
    setSessionMode: updateSessionMode,
    setSessionModel: updateSessionModel,
    onModeOptionsResolved: (modeState) => {
      applyModeOptions({
        options: modeState.options,
        currentId: modeState.currentModeId,
        fallbackCurrentId: defaultModeId,
      });
    },
    onModelOptionsResolved: (modelState) => {
      applyModelOptions({
        options: modelState.options,
        currentId: modelState.currentModelId,
        fallbackCurrentId: defaultModelId,
      });
    },
    registerApprovalRequest,
  });

  const registerCodexSession = useCallback((chatSessionId: string, codexSessionId: string) => {
    codexSessionByChatRef.current[chatSessionId] = codexSessionId;
    chatSessionByCodexRef.current[codexSessionId] = chatSessionId;
  }, []);

  const clearCodexSession = useCallback((chatSessionId: string) => {
    const existing = codexSessionByChatRef.current[chatSessionId];
    if (existing) {
      delete chatSessionByCodexRef.current[existing];
    }
    delete codexSessionByChatRef.current[chatSessionId];
  }, []);

  const ensureCodexSession = useCallback(
    async (chatSessionId: string) => {
      const existing = codexSessionByChatRef.current[chatSessionId];
      if (existing) return existing;

      const pending = pendingSessionInitRef.current[chatSessionId];
      if (pending) return pending;

      const task = (async () => {
        const sessionMeta = sessions.find((session) => session.id === chatSessionId);
        const cwd =
          typeof sessionMeta?.cwd === 'string' && sessionMeta.cwd.trim() !== ''
            ? sessionMeta.cwd
            : '.';
        const result = await createSession(cwd);
        registerCodexSession(chatSessionId, result.sessionId);
        const modeState = resolveModeOptions(result.modes, result.configOptions);
        if (modeState?.options && modeState.options.length > 0) {
          setSessionModeOptions((prev) => {
            const next = { ...prev };
            for (const session of sessions) {
              next[session.id] = modeState.options;
            }
            next[chatSessionId] = modeState.options;
            return next;
          });
          applyModeOptions({
            options: modeState.options,
            currentId: modeState.currentModeId,
            fallbackCurrentId: defaultModeId,
          });
        }
        const modelState = resolveModelOptions(result.models, result.configOptions);
        if (modelState?.options && modelState.options.length > 0) {
          setSessionModelOptions((prev) => {
            const next = { ...prev };
            for (const session of sessions) {
              next[session.id] = modelState.options;
            }
            next[chatSessionId] = modelState.options;
            return next;
          });
          applyModelOptions({
            options: modelState.options,
            currentId: modelState.currentModelId,
          });
        }

        const desiredMode = resolveOptionId({
          preferredId: sessionMeta?.mode,
          availableOptions: modeState?.options,
          fallbackIds: [modeState?.currentModeId, modeState?.options?.[0]?.value],
          defaultId: defaultModeId,
        });

        if (desiredMode && desiredMode !== sessionMeta?.mode) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === chatSessionId ? { ...session, mode: desiredMode } : session
            )
          );
        }

        const shouldSyncMode = shouldSyncOption({
          desiredId: desiredMode,
          currentId: modeState?.currentModeId,
          availableOptions: modeState?.options,
        });

        const desiredModel = resolveOptionId({
          preferredId: sessionMeta?.model,
          availableOptions: modelState?.options,
          fallbackIds: [modelState?.currentModelId, modelState?.options?.[0]?.value],
          defaultId: defaultModelId,
        });

        if (desiredModel && desiredModel !== sessionMeta?.model) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === chatSessionId ? { ...session, model: desiredModel } : session
            )
          );
        }

        const shouldSyncModel = shouldSyncOption({
          desiredId: desiredModel,
          currentId: modelState?.currentModelId,
          availableOptions: modelState?.options,
        });

        const syncTasks: Promise<void>[] = [];
        if (shouldSyncMode && desiredMode) {
          syncTasks.push(
            setSessionMode(result.sessionId, desiredMode)
              .then(() => {
                clearSessionNotice(chatSessionId);
              })
              .catch((err) => {
                const fallbackMode =
                  modeState?.currentModeId ?? modeState?.options?.[0]?.value ?? defaultModeId;
                setSessionNotices((prev) => ({
                  ...prev,
                  [chatSessionId]: {
                    kind: 'error',
                    message: t('errors.modeSetFailed', { error: formatError(err) }),
                  },
                }));
                setSessions((prev) =>
                  prev.map((session) =>
                    session.id === chatSessionId ? { ...session, mode: fallbackMode } : session
                  )
                );
              })
          );
        }
        if (shouldSyncModel && desiredModel) {
          syncTasks.push(
            setSessionModel(result.sessionId, desiredModel)
              .then(() => {
                clearSessionNotice(chatSessionId);
              })
              .catch((err) => {
                const fallbackModel =
                  modelState?.currentModelId ?? modelState?.options?.[0]?.value ?? defaultModelId;
                setSessionNotices((prev) => ({
                  ...prev,
                  [chatSessionId]: {
                    kind: 'error',
                    message: t('errors.modelSetFailed', { error: formatError(err) }),
                  },
                }));
                setSessions((prev) =>
                  prev.map((session) =>
                    session.id === chatSessionId ? { ...session, model: fallbackModel } : session
                  )
                );
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
    [
      applyModeOptions,
      applyModelOptions,
      clearSessionNotice,
      defaultModeId,
      defaultModelId,
      registerCodexSession,
      sessions,
      setSessionModeOptions,
      setSessionModelOptions,
      setSessionNotices,
      setSessions,
      t,
    ]
  );

  const getCodexSessionId = useCallback((sessionId: string) => {
    return codexSessionByChatRef.current[sessionId];
  }, []);

  return {
    clearCodexSession,
    ensureCodexSession,
    getCodexSessionId,
    resolveChatSessionId,
  };
}
