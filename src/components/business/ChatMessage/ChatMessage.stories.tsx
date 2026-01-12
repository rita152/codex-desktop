import { useState, useCallback } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ChatMessage } from './index';
import type { ThinkingPhase } from '../../ui/feedback/Thinking';

const meta: Meta<typeof ChatMessage> = {
  title: 'Business/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  argTypes: {
    role: {
      control: 'select',
      options: ['user', 'assistant'],
      description: '消息角色',
    },
    content: {
      control: 'text',
      description: '消息内容',
    },
    isStreaming: {
      control: 'boolean',
      description: '是否正在流式输出',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatMessage>;

const assistantResponse = `好的，我来帮你分析这个问题。

这是一个关于 React 组件设计的问题，主要涉及以下几点：

1. **组件职责单一** - 每个组件只做一件事
2. **Props 设计** - 清晰的接口定义
3. **样式隔离** - 使用 CSS 变量和模块化

\`\`\`typescript
function ChatMessage({ role, content }: Props) {
  return <div className={role}>{content}</div>;
}
\`\`\`

希望这个解释对你有帮助！`;

const thinkingContent = `让我思考一下这个问题...

首先需要理解用户的需求：
- 创建一个聊天消息组件
- 支持用户和 AI 两种角色
- 需要展示思考过程

这个方案应该可行。`;

function ConversationDemo() {
  const [messages, setMessages] = useState<Array<{
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([
    { id: 1, role: 'user', content: '帮我解释一下 React 组件设计的最佳实践', timestamp: new Date(Date.now() - 60000) },
  ]);
  const [phase, setPhase] = useState<ThinkingPhase>('done');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(undefined);
  const [thinkingStreamContent, setThinkingStreamContent] = useState('');

  const simulateResponse = useCallback(() => {
    // 阶段 1: Working
    setPhase('working');
    setThinkingStreamContent('');
    setStreamContent('');

    // 500ms 后切换到 Thinking
    setTimeout(() => {
      const startTime = Date.now();
      setThinkingStartTime(startTime);
      setPhase('thinking');

      // 流式输出思考内容
      let thinkingCharIndex = 0;
      const thinkingInterval = setInterval(() => {
        if (thinkingCharIndex >= thinkingContent.length) {
          clearInterval(thinkingInterval);
          // 思考结束，开始输出正文
          setPhase('done');
          setThinkingDuration((Date.now() - startTime) / 1000);
          setIsStreaming(true);

          let charIndex = 0;
          const streamInterval = setInterval(() => {
            if (charIndex >= assistantResponse.length) {
              clearInterval(streamInterval);
              setIsStreaming(false);
              setMessages(prev => [
                ...prev,
                {
                  id: Date.now(),
                  role: 'assistant',
                  content: assistantResponse,
                  timestamp: new Date(),
                },
              ]);
              setStreamContent('');
              setThinkingStreamContent('');
              setThinkingStartTime(null);
              setThinkingDuration(undefined);
              return;
            }
            setStreamContent(assistantResponse.slice(0, charIndex + 1));
            charIndex++;
          }, 20);
          return;
        }
        setThinkingStreamContent(thinkingContent.slice(0, thinkingCharIndex + 1));
        thinkingCharIndex++;
      }, 30);
    }, 500);
  }, []);

  const reset = useCallback(() => {
    setMessages([
      { id: 1, role: 'user', content: '帮我解释一下 React 组件设计的最佳实践', timestamp: new Date(Date.now() - 60000) },
    ]);
    setPhase('done');
    setIsStreaming(false);
    setStreamContent('');
    setThinkingStreamContent('');
    setThinkingStartTime(null);
    setThinkingDuration(undefined);
  }, []);

  const isActive = phase === 'working' || phase === 'thinking' || isStreaming;

  return (
    <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={simulateResponse}
          disabled={isActive}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: isActive ? 'var(--color-bg-muted)' : 'var(--color-primary)',
            color: isActive ? 'var(--color-text-secondary)' : 'var(--color-text-inverse)',
            cursor: isActive ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          {phase === 'working' ? 'Working...' : phase === 'thinking' ? 'Thinking...' : isStreaming ? '输出中...' : '模拟 AI 回复'}
        </button>
        <button
          onClick={reset}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          重置
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))}

        {isActive && (
          <ChatMessage
            role="assistant"
            content={streamContent}
            isStreaming={isStreaming}
            thinking={{
              content: thinkingStreamContent,
              isStreaming: phase === 'thinking',
              phase: phase,
              startTime: thinkingStartTime ?? undefined,
              duration: thinkingDuration,
            }}
          />
        )}
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <ConversationDemo />,
};
