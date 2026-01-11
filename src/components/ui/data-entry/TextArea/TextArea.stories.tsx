import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { TextArea } from './index';

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
      <div style={{ maxWidth: '500px', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '8px' }}>
        <TextArea {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};
