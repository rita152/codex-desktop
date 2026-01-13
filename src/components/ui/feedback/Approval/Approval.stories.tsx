import type { Meta, StoryObj } from '@storybook/react';

import { Approval } from './index';

const meta: Meta<typeof Approval> = {
  title: 'UI/Feedback/Approval',
  component: Approval,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['exec', 'patch'],
    },
    status: {
      control: 'select',
      options: ['pending', 'approved', 'approved-for-session', 'rejected'],
    },
    disabled: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
    description: {
      control: 'text',
    },
    command: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Approval>;

export const Default: Story = {
  args: {
    callId: 'call-1',
    type: 'exec',
    title: 'Execute: npm install @tauri-apps/api',
    status: 'pending',
    disabled: false,
    loading: false,
    description: 'Need to install dependencies before build.',
    command: 'npm install @tauri-apps/api',
    onSelect: (callId, optionId) => console.log('Selected:', callId, optionId),
  },
};

export const PatchApproval: Story = {
  args: {
    callId: 'call-2',
    type: 'patch',
    title: 'Apply patch to src/App.tsx',
    status: 'pending',
    diffs: [
      {
        path: 'src/App.tsx',
        diff: `--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,3 +1,5 @@
 export function App() {
-  return <div>Hello</div>;
+  return (
+    <div>Hello Codex</div>
+  );
 }
`,
      },
    ],
    onSelect: (callId, optionId) => console.log('Selected:', callId, optionId),
  },
};

export const RejectedWithFeedback: Story = {
  args: {
    callId: 'call-3',
    type: 'exec',
    title: 'Execute: rm -rf /',
    status: 'pending',
    command: 'rm -rf /',
    feedback: '该命令风险过高，请提供安全替代方案。',
    onSelect: (callId, optionId) => console.log('Selected:', callId, optionId),
    onFeedbackChange: (value) => console.log('Feedback:', value),
  },
};
