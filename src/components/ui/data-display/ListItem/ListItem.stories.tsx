import type { Meta, StoryObj } from '@storybook/react';

import { ListItem } from './index';
import { CommentIcon } from '../Icon';

const meta: Meta<typeof ListItem> = {
  title: 'UI/ListItem',
  component: ListItem,
  tags: ['autodocs'],
  argTypes: {
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ListItem>;

export const Default: Story = {
  args: {
    children: '今天的天气怎么样',
    icon: <CommentIcon size={18} />,
    selected: false,
    disabled: false,
  },
};
