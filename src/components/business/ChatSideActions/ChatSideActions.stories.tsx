import type { Meta, StoryObj } from '@storybook/react';

import { ChatSideActions } from './index';

import './ChatSideActions.stories.css';

const meta: Meta<typeof ChatSideActions> = {
  title: 'Business/ChatSideActions',
  component: ChatSideActions,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ChatSideActions>;

export const Default: Story = {
  render: () => (
    <div className="chat-side-actions-story__container">
      <div className="chat-side-actions-story__bubble">Hello, this is a prompt bubble.</div>
      <ChatSideActions />
    </div>
  ),
};
