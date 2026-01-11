import { useState, useCallback } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import type { Message } from './types';
import { ChatMessageList } from './index';

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

const thinkingContent = `让我分析一下这个问题...

首先需要理解需求，然后给出合适的方案。`;

const assistantResponse = `React Hooks 是 React 16.8 引入的特性，让你在函数组件中使用状态和其他 React 特性。

常用的 Hooks 包括：

1. **useState** - 管理组件状态
2. **useEffect** - 处理副作用
3. **useRef** - 获取 DOM 引用或保存可变值
4. **useMemo** - 缓存计算结果
5. **useCallback** - 缓存函数引用

\`\`\`typescript
const [count, setCount] = useState(0);

useEffect(() => {
  document.title = \`Count: \${count}\`;
}, [count]);
\`\`\``;

function ChatDemo() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'user', content: '什么是 React Hooks？', timestamp: new Date(Date.now() - 120000) },
    { id: 2, role: 'assistant', content: assistantResponse, timestamp: new Date(Date.now() - 60000) },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(undefined);

  const newResponse = '好的，这是一个很好的问题！自动滚动功能会在新消息到来时将列表滚动到底部，但如果用户正在查看历史消息，则不会打断用户。';

  const addUserMessage = useCallback(() => {
    setMessages(prev => [
      ...prev,
      { id: Date.now(), role: 'user', content: '自动滚动是怎么实现的？', timestamp: new Date() },
    ]);
  }, []);

  const simulateResponse = useCallback(() => {
    addUserMessage();

    setTimeout(() => {
      setIsThinking(true);
      const startTime = Date.now();
      setThinkingStartTime(startTime);
      setThinkingDuration(undefined);

      setTimeout(() => {
        setIsThinking(false);
        setThinkingDuration((Date.now() - startTime) / 1000);
        setIsStreaming(true);
        setStreamContent('');

        let charIndex = 0;
        const streamInterval = setInterval(() => {
          if (charIndex >= newResponse.length) {
            clearInterval(streamInterval);
            setIsStreaming(false);
            setMessages(prev => [
              ...prev,
              { id: Date.now(), role: 'assistant', content: newResponse, timestamp: new Date() },
            ]);
            setStreamContent('');
            setThinkingStartTime(null);
            setThinkingDuration(undefined);
            return;
          }
          setStreamContent(newResponse.slice(0, charIndex + 1));
          charIndex++;
        }, 30);
      }, 1500);
    }, 100);
  }, [addUserMessage]);

  const displayMessages: Message[] = [
    ...messages,
    ...(isThinking || isStreaming
      ? [{
          id: 'streaming',
          role: 'assistant' as const,
          content: streamContent,
          isStreaming,
          thinking: {
            content: thinkingContent,
            isStreaming: isThinking,
            startTime: thinkingStartTime ?? undefined,
            duration: thinkingDuration,
          },
        }]
      : []),
  ];

  return (
    <div style={{ height: 500, display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)', borderRadius: 8 }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
        <button
          onClick={simulateResponse}
          disabled={isThinking || isStreaming}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: (isThinking || isStreaming) ? 'var(--color-bg-muted)' : 'var(--color-primary)',
            color: (isThinking || isStreaming) ? 'var(--color-text-secondary)' : 'white',
            cursor: (isThinking || isStreaming) ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          发送消息并模拟回复
        </button>
      </div>
      <ChatMessageList messages={displayMessages} />
    </div>
  );
}

export const Default: Story = {
  render: () => <ChatDemo />,
};
