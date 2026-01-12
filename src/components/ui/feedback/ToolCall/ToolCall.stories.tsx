import type { Meta, StoryObj } from '@storybook/react';

import { ToolCall } from './index';

const meta: Meta<typeof ToolCall> = {
  title: 'UI/Feedback/ToolCall',
  component: ToolCall,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['pending', 'in-progress', 'completed', 'failed'],
      description: '工具调用状态（与 ACP 一致）',
    },
    kind: {
      control: 'select',
      options: ['read', 'edit', 'execute', 'search', 'fetch', 'browser', 'mcp', 'other'],
      description: '工具类型',
    },
    title: {
      control: 'text',
      description: '工具调用标题',
    },
    toolCallId: {
      control: 'text',
      description: '工具调用唯一标识符',
    },
    rawInput: {
      control: 'object',
      description: '原始输入参数',
    },
    rawOutput: {
      control: 'object',
      description: '原始输出结果',
    },
    error: {
      control: 'text',
      description: '错误信息',
    },
    duration: {
      control: 'number',
      description: '执行时长（秒）',
    },
    defaultOpen: {
      control: 'boolean',
      description: '默认是否展开',
    },
  },
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof ToolCall>;

export const Default: Story = {
  args: {
    toolCallId: 'call_001',
    title: 'Reading file: src/App.tsx',
    kind: 'read',
    status: 'completed',
    locations: [
      { uri: 'file:///project/src/App.tsx' },
    ],
    rawInput: {
      path: 'src/App.tsx',
    },
    rawOutput: {
      content: 'import React from "react";\n\nexport function App() {\n  return <div>Hello</div>;\n}',
      size: 89,
    },
    duration: 0.12,
    defaultOpen: true,
  },
};
