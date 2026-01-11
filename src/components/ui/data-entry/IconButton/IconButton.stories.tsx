import type { Meta, StoryObj } from '@storybook/react';

import { PlusIcon, SlidersIcon, MicrophoneIcon, SendIcon } from '../../data-display/Icon';

import { IconButton } from './index';

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
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <IconButton {...args} icon={<PlusIcon size={20} />} aria-label="添加" />
      <IconButton {...args} icon={<SlidersIcon size={20} />} aria-label="设置" />
      <IconButton {...args} icon={<MicrophoneIcon size={20} />} aria-label="语音" />
      <IconButton {...args} icon={<SendIcon size={20} />} aria-label="发送" variant="primary" />
    </div>
  ),
};
