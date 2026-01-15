import type { Meta, StoryObj } from '@storybook/react';

import { Sidebar } from './index';

import './Sidebar.stories.css';

const mockSessions = [
  { id: '1', title: '今天的天气怎么样' },
  { id: '2', title: '今天的天气怎么...' },
  { id: '3', title: '你啊和扩大睡觉...' },
  { id: '4', title: '"/Users/kittors/L...' },
];

const meta: Meta<typeof Sidebar> = {
  title: 'Business/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="sidebar-story__container">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  args: {
    sessions: mockSessions,
    selectedSessionId: '1',
  },
};
