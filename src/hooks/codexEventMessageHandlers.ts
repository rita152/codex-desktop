import { closeActiveAssistantMessages, closeActiveThoughtMessages } from '../utils/messageUtils';
import { devDebug } from '../utils/logger';
import { applyToolCallUpdate, getToolCallId, newMessageId } from '../utils/codexParsing';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { PlanStep } from '../components/ui/data-display/Plan/types';
import type { Message } from '../components/business/ChatMessageList/types';
import type { ToolCallProps } from '../components/ui/feedback/ToolCall';
import type { ToolCall } from '../types/codex';

type SessionMessages = Record<string, Message[]>;

type SetSessionMessagesRef = RefObject<Dispatch<SetStateAction<SessionMessages>>>;

type UpdateMessages = (updater: SetStateAction<SessionMessages>) => void;

const ASSISTANT_APPEND_GRACE_MS = 1500;

export type CodexMessageHandlers = {
  appendThoughtChunk: (sessionId: string, text: string) => void;
  appendAssistantChunk: (sessionId: string, text: string) => void;
  upsertToolCallMessage: (sessionId: string, toolCall: ToolCallProps) => void;
  applyToolCallUpdateMessage: (sessionId: string, update: ToolCall) => void;
  finalizeStreamingMessages: (sessionId: string) => void;
  updatePlan: (sessionId: string, steps: PlanStep[]) => void;
};

const buildUpdater = (setSessionMessagesRef: SetSessionMessagesRef): UpdateMessages => {
  return (updater) => {
    const setSessionMessages = setSessionMessagesRef.current;
    if (!setSessionMessages) return;
    setSessionMessages(updater);
  };
};

export function createCodexMessageHandlers(
  setSessionMessagesRef: SetSessionMessagesRef
): CodexMessageHandlers {
  const updateMessages = buildUpdater(setSessionMessagesRef);

  const appendThoughtChunk = (sessionId: string, text: string) => {
    updateMessages((prev) => {
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
    updateMessages((prev) => {
      const baseList = prev[sessionId] ?? [];
      const now = Date.now();
      const list = closeActiveThoughtMessages(baseList, now);
      const lastMessage = list[list.length - 1];
      const lastContent = lastMessage?.content ?? '';
      const lastTimestampMs =
        lastMessage?.timestamp instanceof Date ? lastMessage.timestamp.getTime() : undefined;
      const timeSinceCloseMs = lastTimestampMs !== undefined ? now - lastTimestampMs : undefined;
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

    updateMessages((prev) => {
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

  const applyToolCallUpdateMessage = (sessionId: string, update: ToolCall) => {
    const toolCallId = getToolCallId(update);
    if (!toolCallId) return;

    updateMessages((prev) => {
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

  const finalizeStreamingMessages = (sessionId: string) => {
    const nowMs = Date.now();
    const now = new Date(nowMs);
    updateMessages((prev) => {
      const list = prev[sessionId] ?? [];
      const next = list.map((m) => {
        if (m.role === 'user' || !m.isStreaming) return m;
        if (m.role === 'thought') {
          const startTime = m.thinking?.startTime;
          const duration = startTime !== undefined ? (nowMs - startTime) / 1000 : m.thinking?.duration;
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
          const duration = startTime !== undefined ? (nowMs - startTime) / 1000 : m.thinking.duration;
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
  };

  const updatePlan = (sessionId: string, steps: PlanStep[]) => {
    updateMessages((prev) => {
      const list = prev[sessionId] ?? [];
      const lastMessage = list[list.length - 1];

      if (lastMessage?.role === 'assistant') {
        const nextList = [...list];
        nextList[nextList.length - 1] = {
          ...lastMessage,
          planSteps: steps,
        };
        return { ...prev, [sessionId]: nextList };
      }

      const nextMessage: Message = {
        id: newMessageId(),
        role: 'assistant',
        content: '',
        planSteps: steps,
        isStreaming: true,
        timestamp: new Date(),
      };
      return { ...prev, [sessionId]: [...list, nextMessage] };
    });
  };

  return {
    appendThoughtChunk,
    appendAssistantChunk,
    upsertToolCallMessage,
    applyToolCallUpdateMessage,
    finalizeStreamingMessages,
    updatePlan,
  };
}
