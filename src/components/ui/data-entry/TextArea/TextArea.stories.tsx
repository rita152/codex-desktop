import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { TextArea } from './index';

import './TextArea.stories.css';

const meta: Meta<typeof TextArea> = {
  title: 'UI/DataEntry/TextArea',
  component: TextArea,
  tags: ['autodocs'],
  argTypes: {
    minRows: {
      control: { type: 'number', min: 1, max: 10 },
    },
    maxRows: {
      control: { type: 'number', min: 1, max: 20 },
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Default: Story = {
  args: {
    placeholder: '请输入内容...',
    minRows: 1,
    maxRows: 6,
  },
  render: (args) => {
    const [value, setValue] = useState('');
    return (
      <div className="text-area-story__container">
        <TextArea {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};
