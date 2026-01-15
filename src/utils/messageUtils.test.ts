import { describe, it, expect } from 'vitest';

import { closeActiveAssistantMessages, closeActiveThoughtMessages } from './messageUtils';

import type { Message } from '../components/business/ChatMessageList/types';

describe('messageUtils', () => {
  it('closes streaming thought messages', () => {
    const now = 10000;
    const list: Message[] = [
      {
        id: '1',
        role: 'thought',
        content: 'hi',
        isStreaming: true,
        thinking: {
          content: 'hi',
          isStreaming: true,
          startTime: 9000,
        },
      },
    ];
    const next = closeActiveThoughtMessages(list, now);
    expect(next[0]?.isStreaming).toBe(false);
    expect(next[0]?.thinking?.phase).toBe('done');
    expect(next[0]?.thinking?.duration).toBe(1);
    expect(next[0]?.timestamp instanceof Date).toBe(true);
  });

  it('closes streaming assistant messages', () => {
    const now = 10000;
    const list: Message[] = [
      {
        id: '2',
        role: 'assistant',
        content: 'ok',
        isStreaming: true,
        thinking: {
          content: 'ok',
          startTime: 9000,
        },
      },
    ];
    const next = closeActiveAssistantMessages(list, now);
    expect(next[0]?.isStreaming).toBe(false);
    expect(next[0]?.thinking?.phase).toBe('done');
    expect(next[0]?.thinking?.duration).toBe(1);
    expect(next[0]?.timestamp instanceof Date).toBe(true);
  });
});
