import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ChatContainer } from './index';

import type { Message } from '../ChatMessageList/types';
import type { ChatSession } from '../Sidebar/types';

const mockSessions: ChatSession[] = [
  { id: '1', title: '关于 React 的问题' },
  { id: '2', title: 'TypeScript 类型推断' },
  { id: '3', title: 'Tauri 桌面应用开发' },
];

const mockMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: '你好，请介绍一下 React 19 的新特性',
    timestamp: new Date(),
  },
  {
    id: '1b',
    role: 'thought',
    content: '用户询问 React 19 新特性，需要整理并概括主要更新点。',
    thinking: {
      content: '用户询问 React 19 新特性，需要整理并概括主要更新点。',
      phase: 'done',
      duration: 3,
    },
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'React 19 带来了许多令人兴奋的新特性，包括：\n\n1. **Actions** - 简化表单处理和数据变更\n2. **use() Hook** - 在渲染时读取资源\n3. **Server Components** - 改进的服务端渲染支持\n4. **改进的 Suspense** - 更好的加载状态处理',
    timestamp: new Date(),
  },
];

const meta: Meta<typeof ChatContainer> = {
  title: 'Business/ChatContainer',
  component: ChatContainer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    sidebarVisible: {
      control: 'boolean',
    },
    isGenerating: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatContainer>;

function ChatContainerWithState() {
  const [sessions] = useState<ChatSession[]>(mockSessions);
  const [selectedSessionId, setSelectedSessionId] = useState('1');
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  return (
    <ChatContainer
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      messages={messages}
      sidebarVisible={sidebarVisible}
      onSessionSelect={setSelectedSessionId}
      onNewChat={() => setMessages([])}
      onSendMessage={handleSendMessage}
      onSidebarToggle={() => setSidebarVisible((v) => !v)}
    />
  );
}

export const Default: Story = {
  render: () => <ChatContainerWithState />,
};
