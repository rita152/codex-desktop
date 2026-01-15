import type { Message } from '../components/business/ChatMessageList/types';

function findLastIndex<T>(list: T[], predicate: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i])) return i;
  }
  return -1;
}

export function closeActiveThoughtMessages(list: Message[], now: number): Message[] {
  const lastThoughtIdx = findLastIndex(
    list,
    (message) => message.role === 'thought' && message.isStreaming === true
  );
  if (lastThoughtIdx === -1) return list;

  const message = list[lastThoughtIdx];
  const startTime = message.thinking?.startTime;
  const duration = startTime !== undefined ? (now - startTime) / 1000 : message.thinking?.duration;
  const content = message.thinking?.content ?? message.content;
  const nextMessage: Message = {
    ...message,
    isStreaming: false,
    thinking: {
      content,
      phase: 'done' as const,
      isStreaming: false,
      startTime,
      duration,
    },
    timestamp: message.timestamp ?? new Date(now),
  };

  const nextList = [...list];
  nextList[lastThoughtIdx] = nextMessage;
  return nextList;
}

export function closeActiveAssistantMessages(list: Message[], now: number): Message[] {
  const lastAssistantIdx = findLastIndex(
    list,
    (message) => message.role === 'assistant' && message.isStreaming === true
  );
  if (lastAssistantIdx === -1) return list;

  const message = list[lastAssistantIdx];
  const startTime = message.thinking?.startTime;
  const duration = startTime !== undefined ? (now - startTime) / 1000 : message.thinking?.duration;
  const nextMessage: Message = {
    ...message,
    isStreaming: false,
    thinking: message.thinking
      ? {
          ...message.thinking,
          phase: 'done',
          isStreaming: false,
          duration,
        }
      : undefined,
    timestamp: message.timestamp ?? new Date(now),
  };

  const nextList = [...list];
  nextList[lastAssistantIdx] = nextMessage;
  return nextList;
}
