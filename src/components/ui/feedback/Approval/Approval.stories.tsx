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
    onSelect: (callId, optionId) => console.log('Selected:', callId, optionId),
  },
};
