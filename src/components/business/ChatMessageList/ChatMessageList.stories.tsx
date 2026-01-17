import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'vitest';

import type { Message } from './types';
import { ChatMessageList } from './index';
import type { ApprovalProps } from '../../ui/feedback/Approval';
import type { ToolCallProps } from '../../ui/feedback/ToolCall';

import './ChatMessageList.stories.css';

const meta: Meta<typeof ChatMessageList> = {
  title: 'Business/ChatMessageList',
  component: ChatMessageList,
  tags: ['autodocs'],
  argTypes: {
    autoScroll: {
      control: 'boolean',
      description: '是否自动滚动到底部',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatMessageList>;

const assistantResponse = `React Hooks allow function components to use state and other React features.

Common hooks include:

1. **useState** for local state
2. **useEffect** for side effects
3. **useRef** for refs and mutable values
4. **useMemo** for memoized values
5. **useCallback** for memoized callbacks`;

const toolCalls: ToolCallProps[] = [
  {
    toolCallId: 'call_001',
    title: 'read_file',
    kind: 'read',
    status: 'completed',
    locations: [{ uri: 'src/App.tsx', range: { startLine: 1, endLine: 20 } }],
    content: [
      {
        type: 'text',
        text: 'import { useState } from "react";',
      },
    ],
    duration: 0.12,
  },
  {
    toolCallId: 'call_002',
    title: 'search',
    kind: 'search',
    status: 'completed',
    content: [
      {
        type: 'text',
        text: 'Found 3 relevant matches in the codebase.',
      },
    ],
    duration: 0.24,
  },
];

const messages: Message[] = [
  {
    id: 1,
    role: 'user',
    content: 'What is React Hooks?',
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: 2,
    role: 'thought',
    content: 'Analyzing the request and outlining key points.',
    thinking: {
      content: 'Analyzing the request and outlining key points.',
      phase: 'done',
      duration: 2.4,
    },
  },
  {
    id: 3,
    role: 'tool',
    content: '',
    toolCalls: toolCalls,
  },
  {
    id: 4,
    role: 'assistant',
    content: assistantResponse,
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: 5,
    role: 'thought',
    content: 'Drafting the final response...',
    isStreaming: true,
    thinking: {
      content: 'Drafting the final response...',
      phase: 'thinking',
      isStreaming: true,
      startTime: Date.now() - 2500,
    },
  },
];

const approvals: ApprovalProps[] = [
  {
    callId: 'approval_001',
    type: 'exec',
    title: 'Approve command execution',
    status: 'pending',
    command: 'npm install',
    options: [
      { id: 'approved-for-session', label: 'Always', kind: 'allow-always' },
      { id: 'approved', label: 'Yes', kind: 'allow-once' },
      { id: 'abort', label: 'No', kind: 'reject-once' },
    ],
    onSelect: () => {},
  },
];

export const Default: Story = {
  render: () => (
    <div className="chat-message-list-story__container">
      <ChatMessageList messages={messages} approvals={approvals} />
    </div>
  ),
};

const orderingMessages: Message[] = [
  {
    id: 'prev-assistant',
    role: 'assistant',
    content: 'Previous assistant message.',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: 'new-user',
    role: 'user',
    content: 'New prompt message.',
    timestamp: new Date(Date.now() - 30000),
  },
  {
    id: 'new-assistant',
    role: 'assistant',
    content: 'Streaming response starts.',
    isStreaming: true,
    timestamp: new Date(Date.now() - 10000),
  },
];

export const WorkingPlacement: Story = {
  render: () => (
    <div className="chat-message-list-story__container">
      <ChatMessageList messages={orderingMessages} isGenerating />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const messageNodes = Array.from(
      canvasElement.querySelectorAll('.chat-message')
    ) as HTMLElement[];
    const userMessage =
      messageNodes.find((node) => node.textContent?.includes('New prompt message.')) ?? null;
    const assistantMessage =
      messageNodes.find((node) => node.textContent?.includes('Streaming response starts.')) ?? null;
    const working = canvasElement.querySelector('.working') as HTMLElement | null;

    expect(userMessage).not.toBeNull();
    expect(assistantMessage).not.toBeNull();
    expect(working).not.toBeNull();

    const userBeforeWorking =
      userMessage &&
      working &&
      (userMessage.compareDocumentPosition(working) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const workingBeforeAssistant =
      working &&
      assistantMessage &&
      (working.compareDocumentPosition(assistantMessage) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    expect(userBeforeWorking).toBe(true);
    expect(workingBeforeAssistant).toBe(true);
  },
};
