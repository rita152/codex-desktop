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

export const TerminalOutput: Story = {
  args: {
    toolCallId: 'call_002',
    title: 'Run npm run build',
    kind: 'execute',
    status: 'in-progress',
    content: [
      {
        type: 'terminal',
        terminalId: 'term_01',
        cwd: '/Users/zp/Desktop/codex-desktop',
        output: 'npm run build\n\n> codex-desktop@0.1.0 build\n> tsc && vite build\n\n[info] building...',
      },
    ],
    startTime: Date.now() - 1200,
    defaultOpen: true,
  },
};

export const DiffPreview: Story = {
  args: {
    toolCallId: 'call_003',
    title: 'Edit src/App.tsx',
    kind: 'edit',
    status: 'completed',
    content: [
      {
        type: 'diff',
        path: 'src/App.tsx',
        diff: `--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,4 +1,6 @@
-export function App() {
-  return <div>Hello</div>;
-}
+export function App() {
+  return (
+    <div>Hello Codex</div>
+  );
+}
`,
      },
    ],
    duration: 0.58,
    defaultOpen: true,
  },
};
