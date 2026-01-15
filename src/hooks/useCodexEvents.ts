import { useEffect } from 'react';
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

export interface UseCodexEventsParams {
  resolveChatSessionId: (codexSessionId?: string) => string | null;
  activeSessionIdRef: RefObject<string>;
  setSessionMessages: Dispatch<SetStateAction<SessionMessages>>;
  setIsGeneratingBySession: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessionTokenUsage: Dispatch<SetStateAction<SessionTokenUsage>>;
  setSessionSlashCommands: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSessionModeOptions: Dispatch<SetStateAction<Record<string, SelectOption[]>>>;
  setSessionMode: (sessionId: string, modeId: string) => void;
  onModeOptionsResolved?: (modeState: { options: SelectOption[]; currentModeId?: string }) => void;
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
  setSessionMode,
  onModeOptionsResolved,
  registerApprovalRequest,
}: UseCodexEventsParams) {
  useEffect(() => {
    const appendThoughtChunk = (sessionId: string, text: string) => {
      devDebug('[appendThoughtChunk]', {
        sessionId,
        textLen: text.length,
        text: text.slice(0, 50),
      });
      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        const lastMessage = list[list.length - 1];
        const now = Date.now();

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
      devDebug('[appendAssistantChunk]', { sessionId, textLen: text.length });
      setSessionMessages((prev) => {
        const baseList = prev[sessionId] ?? [];
        const list = closeActiveThoughtMessages(baseList, Date.now());
        const lastMessage = list[list.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
          const nextList = [...list];
          nextList[nextList.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + text,
            isStreaming: true,
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

      setSessionMessages((prev) => {
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

      setSessionMessages((prev) => {
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

    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        appendAssistantChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        devDebug('[codex:thought] Received', {
          sessionId: event.payload.sessionId,
          textLen: event.payload.text.length,
        });
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        appendThoughtChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const nowMs = Date.now();
        const now = new Date(nowMs);
        setSessionMessages((prev) => {
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

        setIsGeneratingBySession((prev) => ({ ...prev, [sessionId]: false }));
      }),
      listen<TokenUsageEvent>('codex:token-usage', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        setSessionTokenUsage((prev) => ({
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
        const sessionId = activeSessionIdRef.current;
        const errMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: i18n.t('errors.genericError', { error: event.payload.error }),
          isStreaming: false,
          timestamp: new Date(),
        };

        setSessionMessages((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), errMsg],
        }));

        setIsGeneratingBySession((prev) => ({ ...prev, [sessionId]: false }));
      }),
      listen<ApprovalRequest>('codex:approval-request', (event) => {
        registerApprovalRequest(event.payload);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:available-commands', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const commands = extractSlashCommands(event.payload.update);
        if (commands.length === 0) return;
        setSessionSlashCommands((prev) => ({ ...prev, [sessionId]: commands }));
      }),
      listen<{ sessionId: string; update: unknown }>('codex:current-mode', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const modeId = getString(update.currentModeId ?? update.current_mode_id);
        if (!modeId) return;
        setSessionMode(sessionId, modeId);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:config-option-update', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const configOptions = update.configOptions ?? update.config_options ?? update.configOption;
        const modeState = resolveModeOptions(undefined, configOptions);
        if (modeState?.options.length) {
          setSessionModeOptions((prev) => ({ ...prev, [sessionId]: modeState.options }));
          onModeOptionsResolved?.(modeState);
        }
        if (modeState?.currentModeId) {
          setSessionMode(sessionId, modeState.currentModeId);
        }
      }),
      listen<{ sessionId: string; toolCall: unknown }>('codex:tool-call', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const toolCall = asRecord(event.payload.toolCall);
        if (!toolCall) return;
        const parsed = parseToolCall(toolCall);
        upsertToolCallMessage(sessionId, parsed);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        applyToolCallUpdateMessage(sessionId, update);
      }),
    ];

    return () => {
      Promise.all(unlistenPromises)
        .then((unlisteners) => unlisteners.forEach((u) => u()))
        .catch(() => {});
    };
  }, [
    activeSessionIdRef,
    registerApprovalRequest,
    resolveChatSessionId,
    setIsGeneratingBySession,
    setSessionMessages,
    setSessionMode,
    setSessionModeOptions,
    setSessionSlashCommands,
    setSessionTokenUsage,
    onModeOptionsResolved,
  ]);
}
