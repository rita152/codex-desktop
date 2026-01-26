import type { Meta, StoryObj } from '@storybook/react';

import {
  AccountIcon,
  ChatIcon,
  CheckIcon,
  ChevronDownIcon,
  CommentIcon,
  EditIcon,
  FolderIcon,
  ForwardIcon,
  GitBranchIcon,
  MenuIcon,
  NotebookIcon,
  PencilIcon,
  PlusIcon,
  RobotIcon,
  SendIcon,
  SettingsIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
  TrashIcon,
} from './index';

import './Icon.stories.css';

const meta: Meta<typeof ChatIcon> = {
  title: 'UI/DataDisplay/Icon',
  component: ChatIcon,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'number', min: 12, max: 64 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatIcon>;

export const Default: Story = {
  args: {
    size: 24,
  },
  render: (args) => (
    <div className="icon-story__grid">
      <AccountIcon {...args} />
      <ChatIcon {...args} />
      <CheckIcon {...args} />
      <ChevronDownIcon {...args} />
      <CommentIcon {...args} />
      <EditIcon {...args} />
      <FolderIcon {...args} />
      <ForwardIcon {...args} />
      <GitBranchIcon {...args} />
      <MenuIcon {...args} />
      <NotebookIcon {...args} />
      <PencilIcon {...args} />
      <PlusIcon {...args} />
      <RobotIcon {...args} />
      <SendIcon {...args} />
      <SettingsIcon {...args} />
      <SidebarLeftIcon {...args} />
      <SidebarRightIcon {...args} />
      <TrashIcon {...args} />
    </div>
  ),
};
