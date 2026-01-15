import type { Meta, StoryObj } from '@storybook/react';

import { FolderIcon, MenuIcon, PlusIcon, SendIcon } from '../../data-display/Icon';

import { IconButton } from './index';

import './IconButton.stories.css';

const meta: Meta<typeof IconButton> = {
  title: 'UI/DataEntry/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: 'select',
      options: ['default', 'primary', 'ghost'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    icon: <PlusIcon size={20} />,
    'aria-label': '添加',
    size: 'md',
    variant: 'default',
  },
  render: (args) => (
    <div className="icon-button-story__row">
      <IconButton {...args} icon={<PlusIcon size={20} />} aria-label="添加" />
      <IconButton {...args} icon={<MenuIcon size={20} />} aria-label="菜单" />
      <IconButton {...args} icon={<FolderIcon size={20} />} aria-label="目录" />
      <IconButton {...args} icon={<SendIcon size={20} />} aria-label="发送" variant="primary" />
    </div>
  ),
};
