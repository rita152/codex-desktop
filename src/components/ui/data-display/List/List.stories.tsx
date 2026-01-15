import type { Meta, StoryObj } from '@storybook/react';

import { List } from './index';
import { ListItem } from '../ListItem';
import { CommentIcon } from '../Icon';

const meta: Meta<typeof List> = {
  title: 'UI/List',
  component: List,
  tags: ['autodocs'],
  argTypes: {
    scrollable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof List>;

export const Default: Story = {
  args: {
    scrollable: false,
  },
  render: (args) => (
    <List {...args}>
      <ListItem icon={<CommentIcon size={18} />} selected>
        今天的天气怎么样
      </ListItem>
      <ListItem icon={<CommentIcon size={18} />}>今天的天气怎么...</ListItem>
      <ListItem icon={<CommentIcon size={18} />}>你啊和扩大睡觉...</ListItem>
    </List>
  ),
};
