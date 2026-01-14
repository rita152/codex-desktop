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
    title: 'read_file',
    kind: 'read',
    status: 'completed',
    locations: [
      { uri: 'src/App.tsx', range: { startLine: 1, endLine: 50 } },
    ],
    rawInput: {
      path: 'src/App.tsx',
      options: {
        encoding: 'utf-8',
        includeLineNumbers: true,
        includeMetadata: true,
      },
      extra: Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        note: `extra-field-${i + 1}`,
      })),
    },
    content: [
      {
        type: 'text',
        text: 'import { useState } from "react";\n\nexport function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <h1>Hello Codex</h1>\n      <button onClick={() => setCount(c => c + 1)}>\n        Count: {count}\n      </button>\n    </div>\n  );\n}',
      },
    ],
    duration: 0.08,
    defaultOpen: true,
  },
};
