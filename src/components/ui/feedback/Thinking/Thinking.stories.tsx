import { useState, useEffect, useCallback } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Thinking } from './index';

const meta: Meta<typeof Thinking> = {
  title: 'UI/Thinking',
  component: Thinking,
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
      description: '思考内容',
    },
    isStreaming: {
      control: 'boolean',
      description: '是否正在流式传输',
    },
    duration: {
      control: 'number',
      description: '思考时长（秒）',
    },
    defaultOpen: {
      control: 'boolean',
      description: '默认是否展开',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Thinking>;

const thinkingSteps = [
  '让我分析一下这个问题...\n',
  '\n首先，我需要理解用户的需求：\n',
  '1. 创建一个可折叠的思考组件\n',
  '2. 支持流式传输时的动画效果\n',
  '3. 显示思考时长\n',
  '\n接下来，我会考虑实现方案：\n',
  '- 使用 CSS Grid 实现平滑的展开/折叠动画\n',
  '- 通过 shimmer 效果展示流式传输状态\n',
  '- 自动管理展开状态\n',
  '\n这个方案应该能满足需求。',
];

function StreamingDemo() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [startTime, setStartTime] = useState<number | null>(null);

  // 实时更新计时
  useEffect(() => {
    if (!isStreaming || !startTime) return;

    const timer = setInterval(() => {
      setDuration((Date.now() - startTime) / 1000);
    }, 100);

    return () => clearInterval(timer);
  }, [isStreaming, startTime]);

  const startStreaming = useCallback(() => {
    setContent('');
    setIsStreaming(true);
    setDuration(undefined);
    const now = Date.now();
    setStartTime(now);

    let stepIndex = 0;
    let charIndex = 0;
    let currentContent = '';

    const streamInterval = setInterval(() => {
      if (stepIndex >= thinkingSteps.length) {
        clearInterval(streamInterval);
        setIsStreaming(false);
        setDuration((Date.now() - now) / 1000);
        return;
      }

      const currentStep = thinkingSteps[stepIndex];
      if (charIndex < currentStep.length) {
        currentContent += currentStep[charIndex];
        setContent(currentContent);
        charIndex++;
      } else {
        stepIndex++;
        charIndex = 0;
      }
    }, 50);

    return () => clearInterval(streamInterval);
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setIsStreaming(false);
    setDuration(undefined);
    setStartTime(null);
  }, []);

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={startStreaming}
          disabled={isStreaming}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: isStreaming ? 'var(--color-bg-muted)' : 'var(--color-primary)',
            color: isStreaming ? 'var(--color-text-secondary)' : 'white',
            cursor: isStreaming ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          {isStreaming ? '思考中...' : '开始模拟流式传输'}
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
      
      {(content || isStreaming) && (
        <Thinking
          content={content || '准备思考...'}
          isStreaming={isStreaming}
          startTime={startTime ?? undefined}
          duration={!isStreaming && duration ? duration : undefined}
        />
      )}

      <div style={{ 
        marginTop: 16, 
        padding: 12, 
        background: 'var(--color-bg-muted)', 
        borderRadius: 6,
        fontSize: 13,
        color: 'var(--color-text-secondary)',
      }}>
        <strong>状态：</strong>
        {isStreaming ? (
          <span style={{ color: 'var(--color-primary)' }}>
            流式传输中 ({duration?.toFixed(1)}s)
          </span>
        ) : duration ? (
          <span>已完成，耗时 {duration.toFixed(1)} 秒</span>
        ) : (
          <span>等待开始</span>
        )}
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <StreamingDemo />,
};
