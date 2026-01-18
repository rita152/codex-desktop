import type { Message } from '../components/business/ChatMessageList/types';

function findLastIndex<T>(list: T[], predicate: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i])) return i;
  }
  return -1;
}

type StreamCloseRole = 'assistant' | 'thought';

function closeActiveMessages(list: Message[], now: number, role: StreamCloseRole): Message[] {
  const lastIndex = findLastIndex(
    list,
    (message) => message.role === role && message.isStreaming === true
  );
  if (lastIndex === -1) return list;

  const message = list[lastIndex];
  const startTime = message.thinking?.startTime;
  const duration = startTime !== undefined ? (now - startTime) / 1000 : message.thinking?.duration;
  const baseMessage: Message = {
    ...message,
    isStreaming: false,
    timestamp: message.timestamp ?? new Date(now),
  };

  const nextMessage: Message =
    role === 'thought'
      ? {
          ...baseMessage,
          thinking: {
            content: message.thinking?.content ?? message.content,
            phase: 'done' as const,
            isStreaming: false,
            startTime,
            duration,
          },
        }
      : {
          ...baseMessage,
          thinking: message.thinking
            ? {
                ...message.thinking,
                phase: 'done',
                isStreaming: false,
                duration,
              }
            : undefined,
        };

  const nextList = [...list];
  nextList[lastIndex] = nextMessage;
  return nextList;
}

export function closeActiveThoughtMessages(list: Message[], now: number): Message[] {
  return closeActiveMessages(list, now, 'thought');
}

export function closeActiveAssistantMessages(list: Message[], now: number): Message[] {
  return closeActiveMessages(list, now, 'assistant');
}
