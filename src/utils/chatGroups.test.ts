import { describe, it, expect } from 'vitest';

import { buildChatGroups } from './chatGroups';

import type { ApprovalProps } from '../components/ui/feedback/Approval';
import type { Message } from '../types/message';
import type { ToolCallProps } from '../components/ui/feedback/ToolCall';

describe('chatGroups', () => {
  it('builds working groups for thinking and tool calls', () => {
    const toolCalls: ToolCallProps[] = [
      {
        toolCallId: 'tool-1',
        title: 'Read file',
        status: 'pending',
      },
    ];
    const messages: Message[] = [
      { id: 'u1', role: 'user', content: 'hi' },
      {
        id: 'a1',
        role: 'assistant',
        content: 'ok',
        thinking: {
          content: 'thinking',
          isStreaming: true,
        },
        toolCalls,
      },
    ];

    const groups = buildChatGroups(messages);

    expect(groups).toHaveLength(3);
    const first = groups[0];
    expect(first?.type).toBe('message');
    if (first?.type === 'message') {
      expect(first.message.role).toBe('user');
    }
    const second = groups[1];
    expect(second?.type).toBe('working');
    if (second?.type === 'working') {
      expect(second.items).toHaveLength(2);
    }
    const third = groups[2];
    expect(third?.type).toBe('message');
    if (third?.type === 'message') {
      expect(third.message.role).toBe('assistant');
      expect(third.message.thinking).toBeUndefined();
      expect(third.message.toolCalls).toBeUndefined();
    }
  });

  it('inserts placeholder while generating with no messages', () => {
    const groups = buildChatGroups([], undefined, true);

    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group?.type).toBe('working');
    if (group?.type === 'working') {
      expect(group.isActive).toBe(true);
      expect(group.items[0]?.type).toBe('thinking');
    }
  });

  it('adds approvals as working items', () => {
    const approvals: ApprovalProps[] = [
      {
        callId: 'approval-1',
        type: 'exec',
        title: 'Approve command',
        status: 'pending',
      },
    ];
    const messages: Message[] = [{ id: 'u1', role: 'user', content: 'run this' }];

    const groups = buildChatGroups(messages, approvals, false);

    expect(groups).toHaveLength(2);
    const group = groups[1];
    expect(group?.type).toBe('working');
    if (group?.type === 'working') {
      expect(group.items[0]?.type).toBe('approval');
    }
  });

  it('groups thought and tool messages together', () => {
    const toolCalls: ToolCallProps[] = [
      {
        toolCallId: 'tool-1',
        title: 'Read file',
        status: 'completed',
      },
    ];
    const messages: Message[] = [
      { id: 'u1', role: 'user', content: 'hi' },
      {
        id: 't1',
        role: 'thought',
        content: 'thinking',
        isStreaming: false,
      },
      {
        id: 'tool-1',
        role: 'tool',
        content: '',
        toolCalls,
      },
    ];

    const groups = buildChatGroups(messages);
    expect(groups).toHaveLength(2);
    const working = groups[1];
    expect(working?.type).toBe('working');
    if (working?.type === 'working') {
      expect(working.items).toHaveLength(2);
      expect(working.isActive).toBe(false);
    }
  });

  it('inserts placeholder after the last user message while generating', () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'a1', role: 'assistant', content: 'hello' },
    ];

    const groups = buildChatGroups(messages, undefined, true);

    expect(groups).toHaveLength(3);
    expect(groups[1]?.type).toBe('working');
    expect(groups[2]?.type).toBe('message');
  });
});
