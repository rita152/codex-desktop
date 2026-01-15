import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import type { WorkingItem } from './types';
import { Working } from './index';

import './Working.stories.css';

const meta: Meta<typeof Working> = {
  title: 'UI/Feedback/Working',
  component: Working,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof Working>;

const sampleItems: WorkingItem[] = [
  {
    type: 'thinking',
    data: {
      content: 'Breaking down the request into concrete tasks and constraints.',
      phase: 'thinking',
      isStreaming: true,
      startTime: Date.now() - 2500,
    },
  },
  {
    type: 'toolcall',
    data: {
      toolCallId: 'call_001',
      title: 'read_file',
      kind: 'read',
      status: 'completed',
      locations: [{ uri: 'src/components/App.tsx', range: { startLine: 1, endLine: 20 } }],
      content: [
        {
          type: 'text',
          text: 'import { useState } from "react";',
        },
      ],
      duration: 0.08,
    },
  },
  {
    type: 'approval',
    data: {
      callId: 'approval_001',
      type: 'exec',
      title: 'Approve command execution',
      status: 'pending',
      command: 'npm install',
      showFeedback: false,
      options: [
        { id: 'approved-for-session', label: 'Always', kind: 'allow-always' },
        { id: 'approved', label: 'Yes', kind: 'allow-once' },
        { id: 'abort', label: 'No', kind: 'reject-once' },
      ],
      onSelect: () => {},
    },
  },
];

function WorkingDemo() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Working
      items={sampleItems}
      isOpen={isOpen}
      isActive
      onToggle={() => setIsOpen((prev) => !prev)}
    />
  );
}

export const Default: Story = {
  render: () => (
    <div className="working-story__container">
      <WorkingDemo />
    </div>
  ),
};
