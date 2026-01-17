import type { Meta, StoryObj } from '@storybook/react';

import { Approval } from './index';
import { devDebug } from '../../../../utils/logger';

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
    onSelect: (callId, optionId) => devDebug('Selected:', callId, optionId),
  },
};

export const LongCommand: Story = {
  args: {
    callId: 'call-4',
    type: 'exec',
    title: 'Execute: long command',
    status: 'pending',
    command:
      'python -m pip install -U "some-very-long-package-name[extra1,extra2,extra3]" --index-url https://example.com/simple --trusted-host example.com --no-cache-dir --disable-pip-version-check --timeout 120',
    onSelect: (callId, optionId) => devDebug('Selected:', callId, optionId),
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
    onSelect: (callId, optionId) => devDebug('Selected:', callId, optionId),
  },
};

export const RejectedWithFeedback: Story = {
  args: {
    callId: 'call-3',
    type: 'exec',
    title: 'Execute: rm -rf /',
    status: 'pending',
    command: 'rm -rf /',
    onSelect: (callId, optionId) => devDebug('Selected:', callId, optionId),
  },
};
