import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

import { closeActiveAssistantMessages, closeActiveThoughtMessages } from '../utils/messageUtils';
import { devDebug } from '../utils/logger';
import {
  applyToolCallUpdate,
  asRecord,
  extractSlashCommands,
  getString,
  getToolCallId,
  newMessageId,
  parseToolCall,
  resolveModelOptions,
  resolveModeOptions,
} from '../utils/codexParsing';
import i18n from '../i18n';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Message } from '../components/business/ChatMessageList/types';
import type { SelectOption } from '../components/ui/data-entry/Select/types';
import type { ToolCallProps } from '../components/ui/feedback/ToolCall';
import type { ApprovalRequest, TokenUsageEvent } from '../types/codex';

type SessionMessages = Record<string, Message[]>;

type SessionTokenUsage = Record<
  string,
  {
    totalTokens: number;
    lastTokens?: number;
    contextWindow?: number | null;
    percentRemaining?: number | null;
  }
>;

const ASSISTANT_APPEND_GRACE_MS = 1500;

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
      .catch(() => {});
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
    .catch(() => {});
  state.unlistenPromise = null;
};

export interface UseCodexEventsParams {
  resolveChatSessionId: (codexSessionId?: string) => string | null;
  activeSessionIdRef: RefObject<string>;
  setSessionMessages: Dispatch<SetStateAction<SessionMessages>>;
  setIsGeneratingBySession: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessionTokenUsage: Dispatch<SetStateAction<SessionTokenUsage>>;
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
  setSessionTokenUsage,
  setSessionSlashCommands,
  setSessionModeOptions,
  setSessionModelOptions,
  setSessionMode,
  setSessionModel,
  onModeOptionsResolved,
  onModelOptionsResolved,
  registerApprovalRequest,
}: UseCodexEventsParams) {
  const resolveChatSessionIdRef = useRef(resolveChatSessionId);
  const setSessionMessagesRef = useRef(setSessionMessages);
  const setIsGeneratingBySessionRef = useRef(setIsGeneratingBySession);
  const setSessionTokenUsageRef = useRef(setSessionTokenUsage);
  const setSessionSlashCommandsRef = useRef(setSessionSlashCommands);
  const setSessionModeOptionsRef = useRef(setSessionModeOptions);
  const setSessionModelOptionsRef = useRef(setSessionModelOptions);
  const setSessionModeRef = useRef(setSessionMode);
  const setSessionModelRef = useRef(setSessionModel);
  const onModeOptionsResolvedRef = useRef(onModeOptionsResolved);
  const onModelOptionsResolvedRef = useRef(onModelOptionsResolved);
  const registerApprovalRequestRef = useRef(registerApprovalRequest);

  useEffect(() => {
    resolveChatSessionIdRef.current = resolveChatSessionId;
  }, [resolveChatSessionId]);

  useEffect(() => {
    setSessionMessagesRef.current = setSessionMessages;
  }, [setSessionMessages]);

  useEffect(() => {
    setIsGeneratingBySessionRef.current = setIsGeneratingBySession;
  }, [setIsGeneratingBySession]);

  useEffect(() => {
    setSessionTokenUsageRef.current = setSessionTokenUsage;
  }, [setSessionTokenUsage]);

  useEffect(() => {
    setSessionSlashCommandsRef.current = setSessionSlashCommands;
  }, [setSessionSlashCommands]);

  useEffect(() => {
    setSessionModeOptionsRef.current = setSessionModeOptions;
  }, [setSessionModeOptions]);

  useEffect(() => {
    setSessionModelOptionsRef.current = setSessionModelOptions;
  }, [setSessionModelOptions]);

  useEffect(() => {
    setSessionModeRef.current = setSessionMode;
  }, [setSessionMode]);

  useEffect(() => {
    setSessionModelRef.current = setSessionModel;
  }, [setSessionModel]);

  useEffect(() => {
    onModeOptionsResolvedRef.current = onModeOptionsResolved;
  }, [onModeOptionsResolved]);

  useEffect(() => {
    onModelOptionsResolvedRef.current = onModelOptionsResolved;
  }, [onModelOptionsResolved]);

  useEffect(() => {
    registerApprovalRequestRef.current = registerApprovalRequest;
  }, [registerApprovalRequest]);

  useEffect(() => {
    let isActive = true;
    const appendThoughtChunk = (sessionId: string, text: string) => {
      setSessionMessagesRef.current((prev) => {
        const list = prev[sessionId] ?? [];
        const lastMessage = list[list.length - 1];
        const now = Date.now();
        const lastContent = lastMessage?.thinking?.content ?? lastMessage?.content ?? '';

        devDebug('[appendThoughtChunk]', {
          sessionId,
          textLen: text.length,
          textPreview: text.slice(0, 50),
          lastLen: lastContent.length,
          isStreaming: lastMessage?.isStreaming ?? false,
          isAppendDuplicate: text.startsWith(lastContent),
        });

        if (!lastMessage || lastMessage.role !== 'thought' || !lastMessage.isStreaming) {
          const nextMessage: Message = {
            id: newMessageId(),
            role: 'thought',
            content: text,
            isStreaming: true,
            thinking: {
              content: text,
              phase: 'thinking',
              isStreaming: true,
              startTime: now,
            },
          };
          return { ...prev, [sessionId]: [...list, nextMessage] };
        }

        const current = lastMessage;
        const currentContent = current.thinking?.content ?? current.content;
        const nextContent = currentContent + text;
        const startTime = current.thinking?.startTime ?? now;
        const nextList = [...list];
        nextList[nextList.length - 1] = {
          ...current,
          content: nextContent,
          isStreaming: true,
          thinking: {
            content: nextContent,
            phase: 'thinking',
            isStreaming: true,
            startTime,
            duration: current.thinking?.duration,
          },
        };
        return { ...prev, [sessionId]: nextList };
      });
    };

    const appendAssistantChunk = (sessionId: string, text: string) => {
      setSessionMessagesRef.current((prev) => {
        const baseList = prev[sessionId] ?? [];
        const now = Date.now();
        const list = closeActiveThoughtMessages(baseList, now);
        const lastMessage = list[list.length - 1];
        const lastContent = lastMessage?.content ?? '';
        const lastTimestampMs =
          lastMessage?.timestamp instanceof Date ? lastMessage.timestamp.getTime() : undefined;
        const timeSinceCloseMs =
          lastTimestampMs !== undefined ? now - lastTimestampMs : undefined;
        const canAppendToClosedAssistant =
          lastMessage?.role === 'assistant' &&
          lastMessage.isStreaming === false &&
          timeSinceCloseMs !== undefined &&
          timeSinceCloseMs <= ASSISTANT_APPEND_GRACE_MS;
        devDebug('[appendAssistantChunk]', {
          sessionId,
          textLen: text.length,
          textPreview: text.slice(0, 50),
          lastLen: lastContent.length,
          isStreaming: lastMessage?.isStreaming ?? false,
          isAppendDuplicate: text.startsWith(lastContent),
          timeSinceCloseMs,
          canAppendToClosedAssistant,
        });

        if (
          lastMessage?.role === 'assistant' &&
          (lastMessage.isStreaming === true || canAppendToClosedAssistant)
        ) {
          const nextList = [...list];
          const nextIsStreaming = lastMessage?.isStreaming ?? true;
          nextList[nextList.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + text,
            isStreaming: nextIsStreaming,
          };
          return { ...prev, [sessionId]: nextList };
        }

        const nextMessage: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: text,
          isStreaming: true,
        };
        return { ...prev, [sessionId]: [...list, nextMessage] };
      });
    };

    const upsertToolCallMessage = (sessionId: string, toolCall: ToolCallProps) => {
      const isStreaming = toolCall.status === 'in-progress' || toolCall.status === 'pending';

      setSessionMessagesRef.current((prev) => {
        const list = prev[sessionId] ?? [];
        let updated = false;
        const nextList = list.map((msg) => {
          if (!msg.toolCalls) return msg;
          const index = msg.toolCalls.findIndex((call) => call.toolCallId === toolCall.toolCallId);
          if (index === -1) return msg;
          updated = true;
          const nextCalls = [...msg.toolCalls];
          nextCalls[index] = toolCall;
          return {
            ...msg,
            toolCalls: nextCalls,
            isStreaming,
            timestamp: msg.timestamp ?? (isStreaming ? undefined : new Date()),
          };
        });

        if (!updated) {
          const now = Date.now();
          const nextListWithThoughts = closeActiveThoughtMessages(list, now);
          const nextListWithAssistant = closeActiveAssistantMessages(nextListWithThoughts, now);
          const nextMessage: Message = {
            id: toolCall.toolCallId,
            role: 'tool',
            content: '',
            toolCalls: [toolCall],
            isStreaming,
            timestamp: isStreaming ? undefined : new Date(),
          };
          return { ...prev, [sessionId]: [...nextListWithAssistant, nextMessage] };
        }

        return { ...prev, [sessionId]: nextList };
      });
    };

    const applyToolCallUpdateMessage = (sessionId: string, update: Record<string, unknown>) => {
      const toolCallId = getToolCallId(update);
      if (!toolCallId) return;

      setSessionMessagesRef.current((prev) => {
        const list = prev[sessionId] ?? [];
        let updated = false;
        const nextList = list.map((msg) => {
          if (!msg.toolCalls) return msg;
          const index = msg.toolCalls.findIndex((call) => call.toolCallId === toolCallId);
          if (index === -1) return msg;
          updated = true;
          const nextCall = applyToolCallUpdate(msg.toolCalls[index], update);
          const isStreaming = nextCall.status === 'in-progress' || nextCall.status === 'pending';
          const nextCalls = [...msg.toolCalls];
          nextCalls[index] = nextCall;
          return {
            ...msg,
            toolCalls: nextCalls,
            isStreaming,
            timestamp: msg.timestamp ?? (isStreaming ? undefined : new Date()),
          };
        });

        if (!updated) {
          const nextCall = applyToolCallUpdate(undefined, update);
          const isStreaming = nextCall.status === 'in-progress' || nextCall.status === 'pending';
          const now = Date.now();
          const nextListWithThoughts = closeActiveThoughtMessages(list, now);
          const nextListWithAssistant = closeActiveAssistantMessages(nextListWithThoughts, now);
          const nextMessage: Message = {
            id: nextCall.toolCallId,
            role: 'tool',
            content: '',
            toolCalls: [nextCall],
            isStreaming,
            timestamp: isStreaming ? undefined : new Date(),
          };
          return { ...prev, [sessionId]: [...nextListWithAssistant, nextMessage] };
        }

        return { ...prev, [sessionId]: nextList };
      });
    };

    const listenerToken = beginListeners();
    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        appendAssistantChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        devDebug('[codex:thought] Received', {
          sessionId: event.payload.sessionId,
          textLen: event.payload.text.length,
        });
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        appendThoughtChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const nowMs = Date.now();
        const now = new Date(nowMs);
        setSessionMessagesRef.current((prev) => {
          const list = prev[sessionId] ?? [];
          const next = list.map((m) => {
            if (m.role === 'user' || !m.isStreaming) return m;
            if (m.role === 'thought') {
              const startTime = m.thinking?.startTime;
              const duration =
                startTime !== undefined ? (nowMs - startTime) / 1000 : m.thinking?.duration;
              return {
                ...m,
                isStreaming: false,
                thinking: {
                  content: m.thinking?.content ?? m.content,
                  phase: 'done' as const,
                  isStreaming: false,
                  startTime,
                  duration,
                },
                timestamp: m.timestamp ?? now,
              } satisfies Message;
            }
            if (m.thinking) {
              const startTime = m.thinking.startTime;
              const duration =
                startTime !== undefined ? (nowMs - startTime) / 1000 : m.thinking.duration;
              return {
                ...m,
                isStreaming: false,
                thinking: {
                  ...m.thinking,
                  phase: 'done' as const,
                  isStreaming: false,
                  duration,
                },
                timestamp: m.timestamp ?? now,
              } satisfies Message;
            }
            return {
              ...m,
              isStreaming: false,
              timestamp: m.timestamp ?? now,
            };
          });
          return { ...prev, [sessionId]: next };
        });

        setIsGeneratingBySessionRef.current((prev) => ({ ...prev, [sessionId]: false }));
      }),
      listen<TokenUsageEvent>('codex:token-usage', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        setSessionTokenUsageRef.current((prev) => ({
          ...prev,
          [sessionId]: {
            totalTokens: event.payload.totalTokens,
            lastTokens: event.payload.lastTokens,
            contextWindow: event.payload.contextWindow,
            percentRemaining: event.payload.percentRemaining,
          },
        }));
      }),
      listen<{ error: string }>('codex:error', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
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
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        registerApprovalRequestRef.current(event.payload);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:available-commands', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const commands = extractSlashCommands(event.payload.update);
        if (commands.length === 0) return;
        setSessionSlashCommandsRef.current((prev) => ({ ...prev, [sessionId]: commands }));
      }),
      listen<{ sessionId: string; update: unknown }>('codex:current-mode', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const modeId = getString(update.currentModeId ?? update.current_mode_id);
        if (!modeId) return;
        setSessionModeRef.current(sessionId, modeId);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:config-option-update', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
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
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const toolCall = asRecord(event.payload.toolCall);
        if (!toolCall) return;
        const parsed = parseToolCall(toolCall);
        upsertToolCallMessage(sessionId, parsed);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
        if (!isActive) return;
        if (listenerToken !== getListenerState().token) return;
        const sessionId = resolveChatSessionIdRef.current(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        applyToolCallUpdateMessage(sessionId, update);
      }),
    ];
    commitListeners(listenerToken, unlistenPromises);

    return () => {
      isActive = false;
      removeListeners(listenerToken);
    };
  }, [activeSessionIdRef]);
}
