import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Select } from './index';

const meta: Meta<typeof Select> = {
  title: 'UI/DataEntry/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    borderless: {
      control: 'boolean',
    },
    placeholder: {
      control: 'text',
    },
    width: {
      control: 'select',
      options: [60, 80, 100, 120, 150, 200, 250, 300, '100%'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const options = [
  { value: 'apple', label: '苹果' },
  { value: 'banana', label: '香蕉' },
  { value: 'orange', label: '橙子' },
  { value: 'grape', label: '葡萄' },
];

export const Default: Story = {
  args: {
    options,
    placeholder: '请选择水果',
    size: 'md',
    disabled: false,
    borderless: false,
    width: 200,
    'aria-label': '选择水果',
  },
  render: (args) => {
    const [value, setValue] = useState<string>();
    return <Select {...args} value={value} onChange={setValue} />;
  },
};
