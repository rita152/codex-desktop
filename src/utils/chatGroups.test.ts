import { describe, it, expect } from 'vitest';

import { buildChatGroups } from './chatGroups';

import type { ApprovalProps } from '../components/ui/feedback/Approval';
import type { Message } from '../components/business/ChatMessageList/types';
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
    expect(groups[0]?.type).toBe('message');
    expect(groups[0]?.message.role).toBe('user');
    expect(groups[1]?.type).toBe('working');
    expect(groups[1]?.items).toHaveLength(2);
    expect(groups[2]?.type).toBe('message');
    expect(groups[2]?.message.role).toBe('assistant');
    expect(groups[2]?.message.thinking).toBeUndefined();
    expect(groups[2]?.message.toolCalls).toBeUndefined();
  });

  it('inserts placeholder while generating with no messages', () => {
    const groups = buildChatGroups([], undefined, true);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.type).toBe('working');
    expect(groups[0]?.isActive).toBe(true);
    expect(groups[0]?.items[0]?.type).toBe('thinking');
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
    expect(groups[1]?.type).toBe('working');
    expect(groups[1]?.items[0]?.type).toBe('approval');
  });
});
