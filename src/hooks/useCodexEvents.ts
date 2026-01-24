import { useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';

import { devDebug } from '../utils/logger';
import {
  asRecord,
  extractSlashCommands,
  getString,
  newMessageId,
  parseToolCall,
  resolveModelOptions,
  resolveModeOptions,
} from '../utils/codexParsing';
import i18n from '../i18n';
import { createCodexMessageHandlers } from './codexEventMessageHandlers';
import { useLatest } from './useLatest';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Message } from '../components/business/ChatMessageList/types';
import type { SelectOption } from '../components/ui/data-entry/Select/types';
import type { ApprovalRequest } from '../types/codex';
import type { PlanStep } from '../components/ui/data-display/Plan/types';

type SessionMessages = Record<string, Message[]>;

type UnlistenFn = () => void;

type ListenerState = {
  token: number;
  unlistenPromise: Promise<UnlistenFn[]> | null;
};

const getListenerState = (): ListenerState => {
  const globalScope = globalThis as typeof globalThis & {
    __codexEventListenerState?: ListenerState;
  };
  if (!globalScope.__codexEventListenerState) {
    globalScope.__codexEventListenerState = { token: 0, unlistenPromise: null };
  }
  return globalScope.__codexEventListenerState;
};

const beginListeners = () => {
  const state = getListenerState();
  if (state.unlistenPromise) {
    state.unlistenPromise
      .then((unlisteners) => unlisteners.forEach((unlisten) => unlisten()))
      .catch(() => { });
  }
  state.token += 1;
  return state.token;
};

const commitListeners = (token: number, listenPromises: Promise<UnlistenFn>[]) => {
  const state = getListenerState();
  if (state.token !== token) return;
  state.unlistenPromise = Promise.all(listenPromises);
};

const removeListeners = (token: number) => {
  const state = getListenerState();
  if (token !== state.token || !state.unlistenPromise) return;
  state.unlistenPromise
    .then((unlisteners) => unlisteners.forEach((unlisten) => unlisten()))
    .catch(() => { });
  state.unlistenPromise = null;
};

export interface UseCodexEventsParams {
  resolveChatSessionId: (codexSessionId?: string) => string | null;
  activeSessionIdRef: RefObject<string>;
  setSessionMessages: Dispatch<SetStateAction<SessionMessages>>;
  setIsGeneratingBySession: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessionSlashCommands: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSessionModeOptions: Dispatch<SetStateAction<Record<string, SelectOption[]>>>;
  setSessionModelOptions: Dispatch<SetStateAction<Record<string, SelectOption[]>>>;
  setSessionMode: (sessionId: string, modeId: string) => void;
  setSessionModel: (sessionId: string, modelId: string) => void;
  onModeOptionsResolved?: (modeState: { options: SelectOption[]; currentModeId?: string }) => void;
  onModelOptionsResolved?: (modelState: {
    options: SelectOption[];
    currentModelId?: string;
  }) => void;
  registerApprovalRequest: (request: ApprovalRequest) => void;
}

export function useCodexEvents({
  resolveChatSessionId,
  activeSessionIdRef,
  setSessionMessages,
  setIsGeneratingBySession,
  setSessionSlashCommands,
  setSessionModeOptions,
  setSessionModelOptions,
  setSessionMode,
  setSessionModel,
  onModeOptionsResolved,
  onModelOptionsResolved,
  registerApprovalRequest,
}: UseCodexEventsParams) {
  const resolveChatSessionIdRef = useLatest(resolveChatSessionId);
  const setSessionMessagesRef = useLatest(setSessionMessages);
  const setIsGeneratingBySessionRef = useLatest(setIsGeneratingBySession);
  const setSessionSlashCommandsRef = useLatest(setSessionSlashCommands);
  const setSessionModeOptionsRef = useLatest(setSessionModeOptions);
  const setSessionModelOptionsRef = useLatest(setSessionModelOptions);
  const setSessionModeRef = useLatest(setSessionMode);
  const setSessionModelRef = useLatest(setSessionModel);
  const onModeOptionsResolvedRef = useLatest(onModeOptionsResolved);
  const onModelOptionsResolvedRef = useLatest(onModelOptionsResolved);
  const registerApprovalRequestRef = useLatest(registerApprovalRequest);
  const messageHandlers = useMemo(
    () => createCodexMessageHandlers(setSessionMessagesRef),
    [setSessionMessagesRef]
  );

  useEffect(() => {
    let isActive = true;
    const isListenerActive = () => isActive && listenerToken === getListenerState().token;
    const {
      appendAssistantChunk,
      appendThoughtChunk,
      applyToolCallUpdateMessage,
      finalizeStreamingMessages,
      upsertToolCallMessage,
    } = messageHandlers;

    const listenerToken = beginListeners();
    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        appendAssistantChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:thought] Received', {
          sessionId: event.payload.sessionId,
          textLen: event.payload.text.length,
        });
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        appendThoughtChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        finalizeStreamingMessages(sessionId);
        setIsGeneratingBySessionRef.current((prev) => ({ ...prev, [sessionId]: false }));
      }),
      listen<{ error: string }>('codex:error', (event) => {
        if (!isListenerActive()) return;
        const sessionId = activeSessionIdRef.current;
        const errMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: i18n.t('errors.genericError', { error: event.payload.error }),
          isStreaming: false,
          timestamp: new Date(),
        };

        setSessionMessagesRef.current((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), errMsg],
        }));

        setIsGeneratingBySessionRef.current((prev) => ({ ...prev, [sessionId]: false }));
      }),
      listen<ApprovalRequest>('codex:approval-request', (event) => {
        if (!isListenerActive()) return;
        registerApprovalRequestRef.current(event.payload);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:available-commands', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const commands = extractSlashCommands(event.payload.update);
        if (commands.length === 0) return;
        setSessionSlashCommandsRef.current((prev) => ({ ...prev, [sessionId]: commands }));
      }),
      listen<{ sessionId: string; update: unknown }>('codex:current-mode', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const modeId = getString(update.currentModeId ?? update.current_mode_id);
        if (!modeId) return;
        setSessionModeRef.current(sessionId, modeId);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:config-option-update', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const configOptions = update.configOptions ?? update.config_options ?? update.configOption;
        const modeState = resolveModeOptions(undefined, configOptions);
        if (modeState?.options.length) {
          setSessionModeOptionsRef.current((prev) => ({ ...prev, [sessionId]: modeState.options }));
          onModeOptionsResolvedRef.current?.(modeState);
        }
        if (modeState?.currentModeId) {
          setSessionModeRef.current(sessionId, modeState.currentModeId);
        }
        const modelState = resolveModelOptions(undefined, configOptions);
        if (modelState?.options.length) {
          setSessionModelOptionsRef.current((prev) => ({
            ...prev,
            [sessionId]: modelState.options,
          }));
          onModelOptionsResolvedRef.current?.(modelState);
        }
        if (modelState?.currentModelId) {
          setSessionModelRef.current(sessionId, modelState.currentModelId);
        }
      }),
      listen<{ sessionId: string; toolCall: unknown }>('codex:tool-call', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const toolCall = asRecord(event.payload.toolCall);
        if (!toolCall) return;
        const parsed = parseToolCall(toolCall);
        upsertToolCallMessage(sessionId, parsed);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        applyToolCallUpdateMessage(sessionId, update);
      }),
      listen<{ sessionId: string; steps: PlanStep[] }>('codex:plan', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const steps = event.payload.steps;
        if (steps && Array.isArray(steps)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messageHandlers.updatePlan(sessionId, steps as any);
        }
      }),
    ];
    commitListeners(listenerToken, unlistenPromises);

    return () => {
      isActive = false;
      removeListeners(listenerToken);
    };
  }, [activeSessionIdRef, messageHandlers]);
}
