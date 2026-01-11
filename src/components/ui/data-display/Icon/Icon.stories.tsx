import type { Meta, StoryObj } from '@storybook/react';

import {
  BoltIcon,
  ChatIcon,
  CommentIcon,
  CopyIcon,
  ChevronDownIcon,
  EditIcon,
  FolderIcon,
  ForwardIcon,
  HistoryIcon,
  MenuIcon,
  MicrophoneIcon,
  NotebookIcon,
  RobotIcon,
  SendIcon,
  SettingsIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
  SlashIcon,
} from './index';

const meta: Meta<typeof CopyIcon> = {
  title: 'UI/DataDisplay/Icon',
  component: CopyIcon,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'number', min: 12, max: 64 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CopyIcon>;

export const Default: Story = {
  args: {
    size: 24,
  },
  render: (args) => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
      <BoltIcon {...args} />
      <ChatIcon {...args} />
      <CommentIcon {...args} />
      <CopyIcon {...args} />
      <ChevronDownIcon {...args} />
      <EditIcon {...args} />
      <FolderIcon {...args} />
      <ForwardIcon {...args} />
      <HistoryIcon {...args} />
      <MenuIcon {...args} />
      <MicrophoneIcon {...args} />
      <NotebookIcon {...args} />
      <RobotIcon {...args} />
      <SendIcon {...args} />
      <SettingsIcon {...args} />
      <SidebarLeftIcon {...args} />
      <SidebarRightIcon {...args} />
      <SlashIcon {...args} />
    </div>
  ),
};
