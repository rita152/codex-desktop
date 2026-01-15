import { useState, useEffect, useCallback } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Thinking } from './index';
import type { ThinkingPhase } from './types';
import { cn } from '../../../../utils/cn';

import './Thinking.stories.css';

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
    phase: {
      control: 'select',
      options: ['working', 'thinking', 'done'],
      description: '当前阶段',
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
  const [phase, setPhase] = useState<ThinkingPhase>('done');
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [startTime, setStartTime] = useState<number | null>(null);

  // 实时更新计时
  useEffect(() => {
    if (phase !== 'thinking' || !startTime) return;

    const timer = setInterval(() => {
      setDuration((Date.now() - startTime) / 1000);
    }, 100);

    return () => clearInterval(timer);
  }, [phase, startTime]);

  const startStreaming = useCallback(() => {
    // 阶段 1: Working
    setContent('');
    setPhase('working');
    setDuration(undefined);
    setStartTime(null);

    // 500ms 后切换到 Thinking
    setTimeout(() => {
      const now = Date.now();
      setStartTime(now);
      setPhase('thinking');

      let stepIndex = 0;
      let charIndex = 0;
      let currentContent = '';

      const streamInterval = setInterval(() => {
        if (stepIndex >= thinkingSteps.length) {
          clearInterval(streamInterval);
          setPhase('done');
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
    }, 500);
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setPhase('done');
    setDuration(undefined);
    setStartTime(null);
  }, []);

  const isActive = phase === 'working' || phase === 'thinking';

  return (
    <div className="thinking-story">
      <div className="thinking-story__controls">
        <button
          onClick={startStreaming}
          disabled={isActive}
          className={cn(
            'thinking-story__button',
            'thinking-story__button--primary',
            isActive && 'thinking-story__button--disabled'
          )}
        >
          {phase === 'working' ? 'Working...' : phase === 'thinking' ? 'Thinking...' : '开始模拟'}
        </button>
        <button
          onClick={reset}
          className={cn('thinking-story__button', 'thinking-story__button--secondary')}
        >
          重置
        </button>
      </div>

      {(content || isActive || duration) && (
        <Thinking
          content={content}
          isStreaming={phase === 'thinking'}
          phase={phase}
          startTime={startTime ?? undefined}
          duration={phase === 'done' && duration ? duration : undefined}
        />
      )}

      <div className="thinking-story__status">
        <strong>状态：</strong>
        {phase === 'working' ? (
          <span
            className={cn('thinking-story__status-text', 'thinking-story__status-text--working')}
          >
            Working (等待响应)
          </span>
        ) : phase === 'thinking' ? (
          <span
            className={cn('thinking-story__status-text', 'thinking-story__status-text--thinking')}
          >
            Thinking ({duration?.toFixed(1)}s)
          </span>
        ) : duration ? (
          <span className="thinking-story__status-text">已完成，耗时 {duration.toFixed(1)} 秒</span>
        ) : (
          <span className="thinking-story__status-text">等待开始</span>
        )}
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <StreamingDemo />,
};
